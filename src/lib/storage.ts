import SQLiteESMFactory from 'wa-sqlite/dist/wa-sqlite.mjs';
import * as SQLite from 'wa-sqlite';
import { makeHoverEmojiDemoGraph } from '@/assets/sample/demoGraph';
import { makeDemoCard } from '@/assets/sample/demoCard';
import { ActionGraph, Card, DbInitInfo, ListResult } from './types';

// NOTE: wa-sqlite's public TypeScript surface can vary by build/version.
// Some docs/examples reference types that may not be exported in your installed package.
// For the POC we keep the sqlite handle typed as `any` and rely on runtime calls supported
// by wa-sqlite's Factory() output (open_v2/exec/statements/step/column/etc).

type Maybe<T> = T | null;

const DB_DIR = '/cjdb';
const DB_FILE = `${DB_DIR}/cjforge.db`;

const nowIso = () => new Date().toISOString();

function promisifySyncfs(FS: any, populate: boolean): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      FS.syncfs(populate, (err: any) => (err ? reject(err) : resolve()));
    } catch (e) {
      reject(e);
    }
  });
}

function safeJsonParse<T>(s: string, fallback: T): T {
  try {
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
}

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

export class StorageService {
  private sqlite3: Maybe<any> = null;
  private module: any = null;
  private db: Maybe<number> = null;
  private flushTimer: any = null;
  private idbfsEnabled = false;

  async init(): Promise<DbInitInfo> {
    if (this.sqlite3) {
      return {
        kind: this.idbfsEnabled ? 'ready' : 'fallback',
        detail: this.idbfsEnabled ? 'IDBFS' : 'MEM'
      };
    }

    try {
      const module = await SQLiteESMFactory();
      const sqlite3 = SQLite.Factory(module);

      // Try to mount Emscripten IDBFS so the DB persists across sessions.
      // If it fails, we still run with an in-memory FS and/or localStorage fallback for CRUD calls.
      const FS = module.FS;

      try {
        // Ensure directory exists
        try {
          FS.mkdir(DB_DIR);
        } catch {
          // ignore if exists
        }

        // Mount IDBFS at DB_DIR
        try {
          FS.mount(FS.filesystems.IDBFS, {}, DB_DIR);
          await promisifySyncfs(FS, true); // populate from IndexedDB -> memfs
          this.idbfsEnabled = true;
        } catch {
          this.idbfsEnabled = false;
        }
      } catch {
        this.idbfsEnabled = false;
      }

      const db = await sqlite3.open_v2(DB_FILE);

      this.sqlite3 = sqlite3;
      this.module = module;
      this.db = db;

      await this.migrate();
      await this.ensureSeed();

      return { kind: this.idbfsEnabled ? 'ready' : 'fallback', detail: this.idbfsEnabled ? 'IDBFS' : 'MEM' };
    } catch (e) {
      // If WASM/sqlite fails entirely, we fall back to localStorage CRUD
      console.warn('[StorageService] wa-sqlite init failed; falling back to localStorage:', e);
      this.sqlite3 = null;
      this.module = null;
      this.db = null;
      this.idbfsEnabled = false;
      return { kind: 'fallback', detail: 'LOCALSTORAGE' };
    }
  }

  private assertReady() {
    if (!this.sqlite3 || this.db === null) {
      throw new Error('Storage not ready. Call storage.init() first.');
    }
  }

  private scheduleFlush() {
    if (!this.idbfsEnabled || !this.module) return;
    const FS = this.module.FS;
    if (this.flushTimer) clearTimeout(this.flushTimer);
    this.flushTimer = setTimeout(async () => {
      try {
        await promisifySyncfs(FS, false); // flush memfs -> IndexedDB
      } catch (e) {
        console.warn('[StorageService] syncfs flush failed:', e);
      }
    }, 250);
  }

  private async migrate() {
    this.assertReady();
    const sqlite3 = this.sqlite3!;
    const db = this.db!;

    await sqlite3.exec(
      db,
      `
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
      `,
      undefined,
      undefined as any
    );
  }

  private async ensureSeed() {
    // Create demo content if DB is empty (optional convenience)
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

  // ---------- Query helpers ----------
  private async queryAll(sqlite3: any, db: number, sql: string, bind?: any[]) {
    const stmt = await sqlite3.statements(db, sql);
    try {
      if (bind) {
        await sqlite3.bind_collection(stmt, bind as any);
      }
      const cols = await sqlite3.column_names(stmt);
      const out: any[] = [];
      while ((await sqlite3.step(stmt)) === SQLite.SQLITE_ROW) {
        const row: any = {};
        for (let i = 0; i < cols.length; i++) {
          row[cols[i]] = await sqlite3.column(stmt, i);
        }
        out.push(row);
      }
      return out;
    } finally {
      await sqlite3.finalize(stmt);
    }
  }

  // ---------- Local fallback (localStorage) ----------
  private async listCardsLocal(): Promise<ListResult<{ id: string; name: string; updated_at: string }>> {
    const cards = loadLocalCards();
    const items = Object.values(cards)
      .map((c) => ({ id: c.cardId, name: c.name, updated_at: c.meta?.updatedAt ?? c.meta?.createdAt ?? nowIso() }))
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
      .map((g) => ({ id: g.graphId, name: g.name, updated_at: g.meta?.updatedAt ?? g.meta?.createdAt ?? nowIso() }))
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
    const rows = await this.queryAll(this.sqlite3!, this.db!, `SELECT id, name, updated_at FROM cards ORDER BY updated_at DESC;`);
    return { items: rows as any };
  }

  async getCard(cardId: string): Promise<Maybe<Card>> {
    if (!this.sqlite3 || this.db === null) return this.getCardLocal(cardId);
    const rows = await this.queryAll(this.sqlite3!, this.db!, `SELECT json FROM cards WHERE id = ?;`, [cardId]);
    if (!rows.length) return null;
    return JSON.parse(rows[0].json) as Card;
  }

  async upsertCard(card: Card): Promise<void> {
    if (!this.sqlite3 || this.db === null) return this.upsertCardLocal(card);

    this.assertReady();
    const sqlite3 = this.sqlite3!;
    const db = this.db!;
    const now = nowIso();

    const card2: Card = {
      ...card,
      meta: {
        ...card.meta,
        updatedAt: now,
        createdAt: card.meta?.createdAt ?? now
      }
    };

    await sqlite3.exec(
      db,
      `INSERT INTO cards(id, name, json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET name=excluded.name, json=excluded.json, updated_at=excluded.updated_at;`,
      (row: any) => row,
      [card2.cardId, card2.name, JSON.stringify(card2), card2.meta.createdAt, card2.meta.updatedAt] as any
    );

    this.scheduleFlush();
  }

  async deleteCard(cardId: string): Promise<void> {
    if (!this.sqlite3 || this.db === null) return this.deleteCardLocal(cardId);
    this.assertReady();
    await this.sqlite3!.exec(this.db!, `DELETE FROM cards WHERE id = ?;`, undefined, [cardId] as any);
    this.scheduleFlush();
  }

  // ---------- Graphs ----------
  async listGraphs(): Promise<ListResult<{ id: string; name: string; updated_at: string }>> {
    if (!this.sqlite3 || this.db === null) return this.listGraphsLocal();
    const rows = await this.queryAll(this.sqlite3!, this.db!, `SELECT id, name, updated_at FROM graphs ORDER BY updated_at DESC;`);
    return { items: rows as any };
  }

  async getGraph(graphId: string): Promise<Maybe<ActionGraph>> {
    if (!this.sqlite3 || this.db === null) return this.getGraphLocal(graphId);
    const rows = await this.queryAll(this.sqlite3!, this.db!, `SELECT json FROM graphs WHERE id = ?;`, [graphId]);
    if (!rows.length) return null;
    return JSON.parse(rows[0].json) as ActionGraph;
  }

  async upsertGraph(graph: ActionGraph): Promise<void> {
    if (!this.sqlite3 || this.db === null) return this.upsertGraphLocal(graph);

    this.assertReady();
    const sqlite3 = this.sqlite3!;
    const db = this.db!;
    const now = nowIso();

    const graph2: ActionGraph = {
      ...graph,
      meta: {
        ...graph.meta,
        updatedAt: now,
        createdAt: graph.meta?.createdAt ?? now
      }
    };

    await sqlite3.exec(
      db,
      `INSERT INTO graphs(id, name, json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET name=excluded.name, json=excluded.json, updated_at=excluded.updated_at;`,
      undefined,
      [graph2.graphId, graph2.name, JSON.stringify(graph2), graph2.meta.createdAt, graph2.meta.updatedAt] as any
    );

    this.scheduleFlush();
  }

  async deleteGraph(graphId: string): Promise<void> {
    if (!this.sqlite3 || this.db === null) return this.deleteGraphLocal(graphId);
    this.assertReady();
    await this.sqlite3!.exec(this.db!, `DELETE FROM graphs WHERE id = ?;`, undefined, [graphId] as any);
    this.scheduleFlush();
  }

  // ---------- Bulk import/export ----------
  async exportAll(): Promise<{ cards: Card[]; graphs: ActionGraph[] }> {
    const cardsRes = await this.listCards();
    const graphsRes = await this.listGraphs();

    const cards: Card[] = [];
    for (const row of cardsRes.items) {
      const c = await this.getCard(row.id);
      if (c) cards.push(c);
    }

    const graphs: ActionGraph[] = [];
    for (const row of graphsRes.items) {
      const g = await this.getGraph(row.id);
      if (g) graphs.push(g);
    }

    return { cards, graphs };
  }

  async importAll(payload: { cards?: Card[]; graphs?: ActionGraph[] }) {
    const cards = payload.cards ?? [];
    const graphs = payload.graphs ?? [];

    for (const c of cards) {
      await this.upsertCard(c);
    }
    for (const g of graphs) {
      await this.upsertGraph(g);
    }
  }
}

export const storage = new StorageService();
