import SQLiteESMFactory from 'wa-sqlite/dist/wa-sqlite.mjs';
import * as SQLite from 'wa-sqlite';

import { makeHoverEmojiDemoGraph } from '@/assets/sample/demoGraph';
import { makeDemoCard } from '@/assets/sample/demoCard';
import type { ActionGraph, Card, DbInitInfo, ListResult } from './types';

type Maybe<T> = T | null;

const DB_DIR = '/cjdb';
const DB_FILE = `${DB_DIR}/cjforge.db`;
const nowIso = () => new Date().toISOString();

function safeJsonParse<T>(s: string, fallback: T): T {
  try {
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
}

// ---------- localStorage fallback (if WASM init fails) ----------
function localKeyCards() {
  return 'cjforge_local_cards_v1';
}
function localKeyGraphs() {
  return 'cjforge_local_graphs_v1';
}
function loadLocalCards(): Record<string, Card> {
  return safeJsonParse<Record<string, Card>>(localStorage.getItem(localKeyCards()) ?? '{}', {});
}
function saveLocalCards(cards: Record<string, Card>) {
  localStorage.setItem(localKeyCards(), JSON.stringify(cards));
}
function loadLocalGraphs(): Record<string, ActionGraph> {
  return safeJsonParse<Record<string, ActionGraph>>(localStorage.getItem(localKeyGraphs()) ?? '{}', {});
}
function saveLocalGraphs(graphs: Record<string, ActionGraph>) {
  localStorage.setItem(localKeyGraphs(), JSON.stringify(graphs));
}

function promisifySyncfs(FS: any, populate: boolean): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      FS.syncfs(populate, (err: any) => (err ? reject(err) : resolve()));
    } catch (e) {
      reject(e);
    }
  });
}

/**
 * Simple SQL script splitter for POC migrations:
 * - strips "-- ..." comments
 * - splits on ";"
 * POC-safe: avoid semicolons inside string literals.
 */
function splitSqlScript(script: string): string[] {
  const noLineComments = script
    .split('\n')
    .map((line) => line.replace(/--.*$/g, ''))
    .join('\n');

  return noLineComments
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean);
}

export class StorageService {
  private sqlite3: Maybe<any> = null;
  private module: any = null;
  private db: Maybe<any> = null;

  private idbfsEnabled = false;
  private flushTimer: any = null;

  async init(): Promise<DbInitInfo> {
    if (this.sqlite3 && this.db !== null) {
      return { kind: this.idbfsEnabled ? 'ready' : 'fallback', detail: this.idbfsEnabled ? 'IDBFS' : 'MEM' };
    }

    try {
      const module = await SQLiteESMFactory();

      // Force `any` to avoid TS signature mismatches across wa-sqlite builds.
      const sqlite3: any = (SQLite as any).Factory(module);

      const FS = module.FS;

      // Attempt persistence via Emscripten IDBFS (IndexedDB-backed)
      try {
        try {
          FS.mkdir(DB_DIR);
        } catch {
          // ignore if exists
        }

        try {
          FS.mount(FS.filesystems.IDBFS, {}, DB_DIR);
          await promisifySyncfs(FS, true); // IndexedDB -> memfs
          this.idbfsEnabled = true;
        } catch {
          this.idbfsEnabled = false;
        }
      } catch {
        this.idbfsEnabled = false;
      }

      // open_v2 might return a numeric handle or a db object depending on build.
      const db: any = await sqlite3.open_v2(DB_FILE);

      this.sqlite3 = sqlite3;
      this.module = module;
      this.db = db;

      await this.migrate();
      await this.ensureSeed();

      return { kind: this.idbfsEnabled ? 'ready' : 'fallback', detail: this.idbfsEnabled ? 'IDBFS' : 'MEM' };
    } catch (e) {
      console.warn('[StorageService] wa-sqlite init failed; falling back to localStorage:', e);
      this.sqlite3 = null;
      this.module = null;
      this.db = null;
      this.idbfsEnabled = false;
      return { kind: 'fallback', detail: 'LOCALSTORAGE' };
    }
  }

  private assertReady() {
    if (!this.sqlite3 || this.db === null) throw new Error('Storage not ready. Call storage.init() first.');
  }

  private scheduleFlush() {
    if (!this.idbfsEnabled || !this.module) return;
    const FS = this.module.FS;
    if (this.flushTimer) clearTimeout(this.flushTimer);
    this.flushTimer = setTimeout(async () => {
      try {
        await promisifySyncfs(FS, false); // memfs -> IndexedDB
      } catch (e) {
        console.warn('[StorageService] syncfs flush failed:', e);
      }
    }, 250);
  }

  // ---------- wa-sqlite compatibility helpers ----------
  private getApi() {
    this.assertReady();
    return { sqlite3: this.sqlite3 as any, db: this.db as any };
  }

  private async prepare(sql: string): Promise<any> {
    const { sqlite3, db } = this.getApi();

    // Some builds expose: sqlite3.statements(db, sql)
    if (typeof sqlite3.statements === 'function') {
      // Avoid TS arg-count checking by staying in `any`.
      // Try 2-arg first (db, sql), fall back to 1-arg (sql).
      try {
        return await sqlite3.statements(db, sql);
      } catch {
        return await sqlite3.statements(sql);
      }
    }

    // Some builds expose: db.statements(sql)
    if (db && typeof db.statements === 'function') {
      return await db.statements(sql);
    }

    // Some builds expose prepare / prepare_v2 variants.
    if (typeof sqlite3.prepare_v2 === 'function') {
      try {
        return await sqlite3.prepare_v2(db, sql);
      } catch {
        return await sqlite3.prepare_v2(sql);
      }
    }

    if (typeof sqlite3.prepare === 'function') {
      try {
        return await sqlite3.prepare(db, sql);
      } catch {
        return await sqlite3.prepare(sql);
      }
    }

    throw new Error('wa-sqlite: no known prepare/statements method found on this build.');
  }

  private async finalize(stmt: any) {
    const { sqlite3 } = this.getApi();
    if (typeof sqlite3.finalize === 'function') return sqlite3.finalize(stmt);
    if (stmt && typeof stmt.finalize === 'function') return stmt.finalize();
  }

  private async bind(stmt: any, bind?: any[]) {
    const { sqlite3 } = this.getApi();
    if (!bind || !bind.length) return;

    if (typeof sqlite3.bind_collection === 'function') return sqlite3.bind_collection(stmt, bind);
    if (stmt && typeof stmt.bind === 'function') return stmt.bind(bind);
  }

  private async step(stmt: any): Promise<number> {
    const { sqlite3 } = this.getApi();
    if (typeof sqlite3.step === 'function') return sqlite3.step(stmt);
    if (stmt && typeof stmt.step === 'function') return stmt.step();
    throw new Error('wa-sqlite: no step() available');
  }

  private async columnNames(stmt: any): Promise<string[]> {
    const { sqlite3 } = this.getApi();
    if (typeof sqlite3.column_names === 'function') return sqlite3.column_names(stmt);
    if (stmt && typeof stmt.column_names === 'function') return stmt.column_names();
    if (stmt && typeof stmt.columnNames === 'function') return stmt.columnNames();
    throw new Error('wa-sqlite: no column_names() available');
  }

  private async column(stmt: any, i: number): Promise<any> {
    const { sqlite3 } = this.getApi();
    if (typeof sqlite3.column === 'function') return sqlite3.column(stmt, i);
    if (stmt && typeof stmt.column === 'function') return stmt.column(i);
    if (stmt && typeof stmt.get === 'function') return stmt.get(i);
    throw new Error('wa-sqlite: no column() available');
  }

  // ---------- sqlite ops ----------
  private async run(sql: string, bind?: any[]) {
    const stmt = await this.prepare(sql);
    try {
      await this.bind(stmt, bind);
      while (true) {
        const rc = await this.step(stmt);
        if (rc === (SQLite as any).SQLITE_ROW) continue;
        break;
      }
    } finally {
      await this.finalize(stmt);
    }
  }

  private async queryAll(sql: string, bind?: any[]) {
    const stmt = await this.prepare(sql);
    try {
      await this.bind(stmt, bind);

      const cols = await this.columnNames(stmt);
      const out: any[] = [];

      while ((await this.step(stmt)) === (SQLite as any).SQLITE_ROW) {
        const row: Record<string, unknown> = {};
        for (let i = 0; i < cols.length; i++) {
          row[cols[i]] = await this.column(stmt, i);
        }
        out.push(row);
      }

      return out;
    } finally {
      await this.finalize(stmt);
    }
  }

  private async execScript(script: string) {
    const stmts = splitSqlScript(script);
    for (const s of stmts) await this.run(s);
  }

  // ---------- migrations ----------
  private async migrate() {
    if (!this.sqlite3 || this.db === null) return;

    await this.execScript(`
      PRAGMA foreign_keys = ON;

      CREATE TABLE IF NOT EXISTS cards (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS graphs (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);
  }

  private async ensureSeed() {
    if (!this.sqlite3 || this.db === null) return;

    const cards = await this.listCards();
    const graphs = await this.listGraphs();

    if (cards.items.length === 0 && graphs.items.length === 0) {
      const c = makeDemoCard('card_demo_1');
      const g = makeHoverEmojiDemoGraph('graph_demo_hover_1', 'Hover Emoji Demo');
      await this.upsertCard(c);
      await this.upsertGraph(g);
    }
  }

  // ---------- localStorage fallback ----------
  private async listCardsLocal(): Promise<ListResult<{ id: string; name: string; updated_at: string }>> {
    const cards = loadLocalCards();
    const items = Object.values(cards)
      .map((c) => ({
        id: c.cardId,
        name: c.name,
        updated_at: c.meta?.updatedAt ?? c.meta?.createdAt ?? nowIso()
      }))
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
    return { items };
  }

  private async getCardLocal(cardId: string): Promise<Maybe<Card>> {
    const cards = loadLocalCards();
    return cards[cardId] ?? null;
  }

  private async upsertCardLocal(card: Card): Promise<void> {
    const cards = loadLocalCards();
    cards[card.cardId] = card;
    saveLocalCards(cards);
  }

  private async deleteCardLocal(cardId: string): Promise<void> {
    const cards = loadLocalCards();
    delete cards[cardId];
    saveLocalCards(cards);
  }

  private async listGraphsLocal(): Promise<ListResult<{ id: string; name: string; updated_at: string }>> {
    const graphs = loadLocalGraphs();
    const items = Object.values(graphs)
      .map((g) => ({
        id: g.graphId,
        name: g.name,
        updated_at: g.meta?.updatedAt ?? g.meta?.createdAt ?? nowIso()
      }))
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
    return { items };
  }

  private async getGraphLocal(graphId: string): Promise<Maybe<ActionGraph>> {
    const graphs = loadLocalGraphs();
    return graphs[graphId] ?? null;
  }

  private async upsertGraphLocal(graph: ActionGraph): Promise<void> {
    const graphs = loadLocalGraphs();
    graphs[graph.graphId] = graph;
    saveLocalGraphs(graphs);
  }

  private async deleteGraphLocal(graphId: string): Promise<void> {
    const graphs = loadLocalGraphs();
    delete graphs[graphId];
    saveLocalGraphs(graphs);
  }

  // ---------- Cards ----------
  async listCards(): Promise<ListResult<{ id: string; name: string; updated_at: string }>> {
    if (!this.sqlite3 || this.db === null) return this.listCardsLocal();
    const rows = await this.queryAll(`SELECT id, name, updated_at FROM cards ORDER BY updated_at DESC`);
    return { items: rows as any };
  }

  async getCard(cardId: string): Promise<Maybe<Card>> {
    if (!this.sqlite3 || this.db === null) return this.getCardLocal(cardId);
    const rows = await this.queryAll(`SELECT json FROM cards WHERE id = ?`, [cardId]);
    if (!rows.length) return null;
    return JSON.parse(String((rows[0] as any).json)) as Card;
  }

  async upsertCard(card: Card): Promise<void> {
    if (!this.sqlite3 || this.db === null) return this.upsertCardLocal(card);

    const now = nowIso();
    const card2: Card = {
      ...card,
      meta: {
        ...card.meta,
        createdAt: card.meta?.createdAt ?? now,
        updatedAt: now
      }
    };

    await this.run(
      `INSERT INTO cards(id, name, json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         name=excluded.name,
         json=excluded.json,
         updated_at=excluded.updated_at`,
      [card2.cardId, card2.name, JSON.stringify(card2), card2.meta.createdAt, card2.meta.updatedAt]
    );

    this.scheduleFlush();
  }

  async deleteCard(cardId: string): Promise<void> {
    if (!this.sqlite3 || this.db === null) return this.deleteCardLocal(cardId);
    await this.run(`DELETE FROM cards WHERE id = ?`, [cardId]);
    this.scheduleFlush();
  }

  // ---------- Graphs ----------
  async listGraphs(): Promise<ListResult<{ id: string; name: string; updated_at: string }>> {
    if (!this.sqlite3 || this.db === null) return this.listGraphsLocal();
    const rows = await this.queryAll(`SELECT id, name, updated_at FROM graphs ORDER BY updated_at DESC`);
    return { items: rows as any };
  }

  async getGraph(graphId: string): Promise<Maybe<ActionGraph>> {
    if (!this.sqlite3 || this.db === null) return this.getGraphLocal(graphId);
    const rows = await this.queryAll(`SELECT json FROM graphs WHERE id = ?`, [graphId]);
    if (!rows.length) return null;
    return JSON.parse(String((rows[0] as any).json)) as ActionGraph;
  }

  async upsertGraph(graph: ActionGraph): Promise<void> {
    if (!this.sqlite3 || this.db === null) return this.upsertGraphLocal(graph);

    const now = nowIso();
    const graph2: ActionGraph = {
      ...graph,
      meta: {
        ...graph.meta,
        createdAt: graph.meta?.createdAt ?? now,
        updatedAt: now
      }
    };

    await this.run(
      `INSERT INTO graphs(id, name, json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         name=excluded.name,
         json=excluded.json,
         updated_at=excluded.updated_at`,
      [graph2.graphId, graph2.name, JSON.stringify(graph2), graph2.meta.createdAt, graph2.meta.updatedAt]
    );

    this.scheduleFlush();
  }

  async deleteGraph(graphId: string): Promise<void> {
    if (!this.sqlite3 || this.db === null) return this.deleteGraphLocal(graphId);
    await this.run(`DELETE FROM graphs WHERE id = ?`, [graphId]);
    this.scheduleFlush();
  }

  // ---------- Bulk import/export ----------
  async exportAll(): Promise<{ cards: Card[]; graphs: ActionGraph[] }> {
    const cardsRes = await this.listCards();
    const graphsRes = await this.listGraphs();

    const cards: Card[] = [];
    for (const row of cardsRes.items) {
      const c = await this.getCard((row as any).id);
      if (c) cards.push(c);
    }

    const graphs: ActionGraph[] = [];
    for (const row of graphsRes.items) {
      const g = await this.getGraph((row as any).id);
      if (g) graphs.push(g);
    }

    return { cards, graphs };
  }

  async importAll(payload: { cards?: Card[]; graphs?: ActionGraph[] }) {
    const cards = payload.cards ?? [];
    const graphs = payload.graphs ?? [];

    for (const c of cards) await this.upsertCard(c);
    for (const g of graphs) await this.upsertGraph(g);
  }
}

export const storage = new StorageService();
