import SQLiteESMFactory from 'wa-sqlite/dist/wa-sqlite.mjs';
import * as SQLite from 'wa-sqlite';
import type { SQLiteAPI } from 'wa-sqlite';
import { makeHoverEmojiDemoGraph } from '@/assets/sample/demoGraph';
import { makeDemoCard } from '@/assets/sample/demoCard';
import { ActionGraph, Card, DbInitInfo, ListResult } from './types';

type Maybe<T> = T | null;

const DB_DIR = '/cjdb';
const DB_FILE = `${DB_DIR}/cjforge.db`;

const nowIso = () => new Date().toISOString();

function promisifySyncfs(FS: any, populate: boolean): Promise<void> {
  return new Promise((resolve, reject) => {
    FS.syncfs(populate, (err: any) => (err ? reject(err) : resolve()));
  });
}

export class StorageService {
  private sqlite3: Maybe<SQLiteAPI> = null;
  private module: any = null;
  private db: Maybe<number> = null;
  private flushTimer: any = null;
  private idbfsEnabled = false;

  async init(): Promise<DbInitInfo> {
    if (this.sqlite3) return { kind: this.idbfsEnabled ? 'ready' : 'fallback', detail: this.idbfsEnabled ? 'IDBFS' : 'MEM' };

    try {
      const module = await SQLiteESMFactory();
      const sqlite3 = SQLite.Factory(module);

      // Try to mount Emscripten IDBFS so the DB persists across sessions.
      // If it fails (e.g. older environments), we still run with an in-memory FS.
      const FS = module.FS;
      const IDBFS = module.IDBFS ?? FS?.filesystems?.IDBFS;
      if (FS && IDBFS) {
        try {
          if (!FS.analyzePath(DB_DIR).exists) FS.mkdir(DB_DIR);
          // eslint-disable-next-line @typescript-eslint/no-unsafe-call
          FS.mount(IDBFS, {}, DB_DIR);
          await promisifySyncfs(FS, true);
          this.idbfsEnabled = true;
        } catch {
          this.idbfsEnabled = false;
        }
      }

      const db = await sqlite3.open_v2(DB_FILE);

      this.sqlite3 = sqlite3;
      this.module = module;
      this.db = db;

      await this.migrate();
      await this.seedIfEmpty();

      return { kind: this.idbfsEnabled ? 'ready' : 'fallback', detail: this.idbfsEnabled ? 'IDBFS persisted' : 'MEM (no persistence)' };
    } catch (e) {
      console.error('DB init failed; falling back to localStorage:', e);
      this.sqlite3 = null;
      this.module = null;
      this.db = null;
      this.idbfsEnabled = false;
      // localStorage fallback still lets the UI work for debugging.
      await this.seedLocalStorage();
      return { kind: 'fallback', detail: 'localStorage' };
    }
  }

  private assertReady() {
    if (!this.sqlite3 || this.db === null) throw new Error('Storage not initialized');
  }

  private scheduleFlush() {
    if (!this.idbfsEnabled || !this.module?.FS) return;
    if (this.flushTimer) return;
    this.flushTimer = setTimeout(async () => {
      this.flushTimer = null;
      try {
        await promisifySyncfs(this.module.FS, false);
      } catch (e) {
        console.warn('IDBFS flush failed:', e);
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
      CREATE TABLE IF NOT EXISTS meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

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
      `
    );

    // Schema version marker
    await sqlite3.exec(db, `INSERT OR IGNORE INTO meta(key, value) VALUES ('schemaVersion', 'CJ-0.1');`);
  }

  private async seedIfEmpty() {
    const cards = await this.listCards();
    if (cards.items.length > 0) return;

    const demoGraph = makeHoverEmojiDemoGraph('graph_demo_hover_emoji');
    const demoCard = makeDemoCard('card_demo_emoji');

    await this.upsertGraph(demoGraph);
    await this.upsertCard(demoCard);
  }

  private async seedLocalStorage() {
    const key = 'cjforge.local.seeded';
    if (localStorage.getItem(key)) return;
    const demoGraph = makeHoverEmojiDemoGraph('graph_demo_hover_emoji');
    const demoCard = makeDemoCard('card_demo_emoji');
    localStorage.setItem(`graph:${demoGraph.graphId}`, JSON.stringify(demoGraph));
    localStorage.setItem(`card:${demoCard.cardId}`, JSON.stringify(demoCard));
    localStorage.setItem(key, '1');
  }

  // ---------- Cards ----------
  async listCards(): Promise<ListResult<{ id: string; name: string; updated_at: string }>> {
    if (!this.sqlite3 || this.db === null) return this.listCardsLocal();
    const sqlite3 = this.sqlite3;
    const db = this.db;
    const rows = await this.queryAll(sqlite3, db, `SELECT id, name, updated_at FROM cards ORDER BY updated_at DESC;`);
    return { items: rows as any };
  }

  async getCard(cardId: string): Promise<Card | null> {
    if (!this.sqlite3 || this.db === null) return this.getCardLocal(cardId);
    const sqlite3 = this.sqlite3;
    const db = this.db;
    const rows = await this.queryAll(sqlite3, db, `SELECT json FROM cards WHERE id = ? LIMIT 1;`, [cardId]);
    if (rows.length === 0) return null;
    return JSON.parse(String((rows[0] as any).json)) as Card;
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
      (row) => row,
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

  async getGraph(graphId: string): Promise<ActionGraph | null> {
    if (!this.sqlite3 || this.db === null) return this.getGraphLocal(graphId);
    const rows = await this.queryAll(this.sqlite3!, this.db!, `SELECT json FROM graphs WHERE id = ? LIMIT 1;`, [graphId]);
    if (rows.length === 0) return null;
    return JSON.parse(String((rows[0] as any).json)) as ActionGraph;
  }

  async upsertGraph(graph: ActionGraph): Promise<void> {
    if (!this.sqlite3 || this.db === null) return this.upsertGraphLocal(graph);
    this.assertReady();
    const sqlite3 = this.sqlite3!;
    const db = this.db!;
    const now = nowIso();
    const g2: ActionGraph = {
      ...graph,
      meta: { createdAt: graph.meta?.createdAt ?? now, updatedAt: now }
    };
    await sqlite3.exec(
      db,
      `INSERT INTO graphs(id, name, json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET name=excluded.name, json=excluded.json, updated_at=excluded.updated_at;`,
      undefined,
      [g2.graphId, g2.name, JSON.stringify(g2), g2.meta.createdAt, g2.meta.updatedAt] as any
    );
    this.scheduleFlush();
  }

  async deleteGraph(graphId: string): Promise<void> {
    if (!this.sqlite3 || this.db === null) return this.deleteGraphLocal(graphId);
    this.assertReady();
    await this.sqlite3!.exec(this.db!, `DELETE FROM graphs WHERE id = ?;`, undefined, [graphId] as any);
    this.scheduleFlush();
  }

  // ---------- Export/Import (raw JSON objects) ----------
  async exportAll(): Promise<{ cards: Card[]; graphs: ActionGraph[] }> {
    const cardsMeta = await this.listCards();
    const graphsMeta = await this.listGraphs();
    const cards: Card[] = [];
    const graphs: ActionGraph[] = [];

    for (const c of cardsMeta.items) {
      const card = await this.getCard(c.id);
      if (card) cards.push(card);
    }
    for (const g of graphsMeta.items) {
      const graph = await this.getGraph(g.id);
      if (graph) graphs.push(graph);
    }
    return { cards, graphs };
  }

  async importAll(payload: { cards?: Card[]; graphs?: ActionGraph[] }): Promise<void> {
    for (const g of payload.graphs ?? []) await this.upsertGraph(g);
    for (const c of payload.cards ?? []) await this.upsertCard(c);
  }

  // ---------- Helpers ----------
  private async queryAll(sqlite3: SQLiteAPI, db: number, sql: string, bindings?: any[]): Promise<Record<string, unknown>[]> {
    const out: Record<string, unknown>[] = [];
    for await (const stmt of sqlite3.statements(db, sql)) {
      if (bindings) sqlite3.bind_collection(stmt, bindings as any);
      const colNames = sqlite3.column_names(stmt);
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const rc = await sqlite3.step(stmt);
        if (rc !== (SQLite as any).SQLITE_ROW) break;
        const row: Record<string, unknown> = {};
        for (let i = 0; i < colNames.length; i++) {
          row[colNames[i]] = sqlite3.column(stmt, i);
        }
        out.push(row);
      }
      await sqlite3.finalize(stmt);
    }
    return out;
  }

  // ---------------- localStorage fallback (non-SQLite) ----------------
  private listCardsLocal(): ListResult<{ id: string; name: string; updated_at: string }> {
    const items: { id: string; name: string; updated_at: string }[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith('card:')) continue;
      const card = JSON.parse(localStorage.getItem(k) || 'null') as Card | null;
      if (card) items.push({ id: card.cardId, name: card.name, updated_at: card.meta.updatedAt });
    }
    items.sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1));
    return { items };
  }

  private getCardLocal(cardId: string): Card | null {
    const raw = localStorage.getItem(`card:${cardId}`);
    return raw ? (JSON.parse(raw) as Card) : null;
  }

  private upsertCardLocal(card: Card): void {
    localStorage.setItem(`card:${card.cardId}`, JSON.stringify({ ...card, meta: { ...card.meta, updatedAt: nowIso() } }));
  }

  private deleteCardLocal(cardId: string): void {
    localStorage.removeItem(`card:${cardId}`);
  }

  private listGraphsLocal(): ListResult<{ id: string; name: string; updated_at: string }> {
    const items: { id: string; name: string; updated_at: string }[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith('graph:')) continue;
      const graph = JSON.parse(localStorage.getItem(k) || 'null') as ActionGraph | null;
      if (graph) items.push({ id: graph.graphId, name: graph.name, updated_at: graph.meta.updatedAt });
    }
    items.sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1));
    return { items };
  }

  private getGraphLocal(graphId: string): ActionGraph | null {
    const raw = localStorage.getItem(`graph:${graphId}`);
    return raw ? (JSON.parse(raw) as ActionGraph) : null;
  }

  private upsertGraphLocal(graph: ActionGraph): void {
    localStorage.setItem(`graph:${graph.graphId}`, JSON.stringify({ ...graph, meta: { ...graph.meta, updatedAt: nowIso() } }));
  }

  private deleteGraphLocal(graphId: string): void {
    localStorage.removeItem(`graph:${graphId}`);
  }
}

export const storage = new StorageService();
