// src/lib/storage.ts
import SQLiteESMFactory from "wa-sqlite/dist/wa-sqlite.mjs";
import * as SQLite from "wa-sqlite";

import { makeHoverEmojiDemoGraph } from "@/assets/sample/demoGraph";
import { makeDemoCard } from "@/assets/sample/demoCard";
import type { ActionGraph, Card, DbInitInfo, ListResult } from "./types";

type Maybe<T> = T | null;

const DB_DIR = "/cjdb";
const DB_FILE = `${DB_DIR}/cjforge.db`;
const nowIso = () => new Date().toISOString();

/**
 * We store full domain objects as JSON. For lists, we return summaries
 * but still shaped as `{ items: [...] }` because the UI expects that.
 */

function safeJsonParse<T>(s: string, fallback: T): T {
  try {
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
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
 * Small SQL script splitter for migrations.
 * POC-safe: semicolons inside string literals are not handled, but our scripts don’t do that.
 */
function splitSqlScript(script: string): string[] {
  const noLineComments = script
    .split("\n")
    .map((line) => line.replace(/--.*$/g, ""))
    .join("\n");

  return noLineComments
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
}

// -------- localStorage fallback (if WASM init fails) --------
const LS_CARDS = "cjforge_local_cards_v1";
const LS_GRAPHS = "cjforge_local_graphs_v1";

function loadLocalCards(): Record<string, Card> {
  return safeJsonParse<Record<string, Card>>(localStorage.getItem(LS_CARDS) ?? "{}", {});
}
function saveLocalCards(cards: Record<string, Card>) {
  localStorage.setItem(LS_CARDS, JSON.stringify(cards));
}
function loadLocalGraphs(): Record<string, ActionGraph> {
  return safeJsonParse<Record<string, ActionGraph>>(localStorage.getItem(LS_GRAPHS) ?? "{}", {});
}
function saveLocalGraphs(graphs: Record<string, ActionGraph>) {
  localStorage.setItem(LS_GRAPHS, JSON.stringify(graphs));
}

// Summary types the UI tends to display in list screens
export type CardSummary = {
  id: string;
  name: string;
  cardType: string;
  rarity: string;
  updatedAt: string;
};

export type GraphSummary = {
  id: string;
  name: string;
  ownerType: string;
  ownerId: string;
  updatedAt: string;
};

/**
 * Keep the class name `WASQLiteStorage` because your UI error messages
 * indicate it already imports/uses that name.
 */
export class WASQLiteStorage {
  private sqlite3: Maybe<any> = null;
  private module: any = null;
  private db: Maybe<any> = null;

  private idbfsEnabled = false;
  private flushTimer: any = null;

  async init(): Promise<DbInitInfo> {
    // already init’d
    if (this.sqlite3 && this.db !== null) {
      return { kind: this.idbfsEnabled ? "ready" : "fallback", detail: this.idbfsEnabled ? "IDBFS" : "MEM" };
    }

    try {
      const module = await SQLiteESMFactory();
      const sqlite3: any = (SQLite as any).Factory(module);
      const FS = module.FS;

      // Attempt persistence via IDBFS.
      try {
        try {
          FS.mkdir(DB_DIR);
        } catch {
          // ignore
        }
        try {
          FS.mount(FS.filesystems.IDBFS, {}, DB_DIR);
          await promisifySyncfs(FS, true); // populate from IndexedDB
          this.idbfsEnabled = true;
        } catch {
          this.idbfsEnabled = false;
        }
      } catch {
        this.idbfsEnabled = false;
      }

      // open_v2 signature differs across builds; using apply avoids TS arity mismatch.
      const db: any = await sqlite3.open_v2.apply(sqlite3, [DB_FILE]);

      this.sqlite3 = sqlite3;
      this.module = module;
      this.db = db;

      await this.migrate();
      await this.ensureSeed();

      return { kind: this.idbfsEnabled ? "ready" : "fallback", detail: this.idbfsEnabled ? "IDBFS" : "MEM" };
    } catch (e) {
      console.warn("[WASQLiteStorage] wa-sqlite init failed; falling back to localStorage:", e);
      this.sqlite3 = null;
      this.module = null;
      this.db = null;
      this.idbfsEnabled = false;
      return { kind: "fallback", detail: "LOCALSTORAGE" };
    }
  }

  // ---------- persistence flush ----------
  private scheduleFlush() {
    if (!this.idbfsEnabled || !this.module) return;
    const FS = this.module.FS;

    if (this.flushTimer) clearTimeout(this.flushTimer);
    this.flushTimer = setTimeout(async () => {
      try {
        await promisifySyncfs(FS, false); // flush to IndexedDB
      } catch (e) {
        console.warn("[WASQLiteStorage] syncfs flush failed:", e);
      }
    }, 250);
  }

  // ---------- low-level SQLite helpers (typed as any to avoid signature drift) ----------
  private assertReady() {
    if (!this.sqlite3 || this.db === null) throw new Error("Storage not ready. Call storage.init() first.");
  }

  private async prepare(sql: string): Promise<any> {
    this.assertReady();
    const sqlite3: any = this.sqlite3;
    const db: any = this.db;

    if (typeof sqlite3.prepare_v2 === "function") return sqlite3.prepare_v2.apply(sqlite3, [db, sql]);
    if (typeof sqlite3.statements === "function") return sqlite3.statements.apply(sqlite3, [db, sql]);
    if (typeof sqlite3.prepare === "function") return sqlite3.prepare.apply(sqlite3, [db, sql]);

    throw new Error("wa-sqlite: no prepare method found (prepare_v2/statements/prepare).");
  }

  private async finalize(stmt: any): Promise<void> {
    const sqlite3: any = this.sqlite3;
    if (sqlite3?.finalize) return sqlite3.finalize.apply(sqlite3, [stmt]);
  }

  private async bind(stmt: any, bind?: any[]) {
    const sqlite3: any = this.sqlite3;
    if (!bind || bind.length === 0) return;

    if (sqlite3?.bind_collection) return sqlite3.bind_collection.apply(sqlite3, [stmt, bind]);

    if (sqlite3?.bind) {
      for (let i = 0; i < bind.length; i++) {
        await sqlite3.bind.apply(sqlite3, [stmt, i + 1, bind[i]]);
      }
      return;
    }

    throw new Error("wa-sqlite: no bind_collection/bind available for parameters.");
  }

  private async step(stmt: any): Promise<number> {
    const sqlite3: any = this.sqlite3;
    return sqlite3.step.apply(sqlite3, [stmt]);
  }

  private async columnNames(stmt: any): Promise<string[]> {
    const sqlite3: any = this.sqlite3;
    if (sqlite3?.column_names) return sqlite3.column_names.apply(sqlite3, [stmt]);
    if (sqlite3?.columnNames) return sqlite3.columnNames.apply(sqlite3, [stmt]);
    throw new Error("wa-sqlite: no column_names available");
  }

  private async column(stmt: any, i: number): Promise<any> {
    const sqlite3: any = this.sqlite3;
    if (sqlite3?.column) return sqlite3.column.apply(sqlite3, [stmt, i]);
    if (sqlite3?.get) return sqlite3.get.apply(sqlite3, [stmt, i]);
    throw new Error("wa-sqlite: no column/get available");
  }

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

  // ---------- schema ----------
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
    const cards = await this.listCards();
    const graphs = await this.listGraphs();
    if (cards.items.length > 0 || graphs.items.length > 0) return;

    const demoCard = makeDemoCard("card_demo_1");
    const demoGraph = makeHoverEmojiDemoGraph("graph_demo_hover_1", "Hover Emoji Demo");

    await this.upsertCard(demoCard);
    await this.upsertGraph(demoGraph);
  }

  // ---------- Cards API (UI-facing) ----------
  async listCards(): Promise<ListResult<CardSummary>> {
    // localStorage fallback
    if (!this.sqlite3 || this.db === null) {
      const cards = loadLocalCards();
      const items = Object.values(cards)
        .map((c) => ({
          id: c.cardId,
          name: c.name,
          cardType: (c as any).cardType ?? "Unknown",
          rarity: (c as any).rarity ?? "Common",
          updatedAt: c.meta?.updatedAt ?? c.meta?.createdAt ?? nowIso(),
        }))
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      return { items };
    }

    // DB
    const rows = await this.queryAll("SELECT id, name, json, updated_at FROM cards ORDER BY updated_at DESC");
    const items = rows.map((r: any) => {
      const json = safeJsonParse<any>(String(r.json), {});
      return {
        id: String(r.id),
        name: String(r.name),
        cardType: String(json.cardType ?? "Unknown"),
        rarity: String(json.rarity ?? "Common"),
        updatedAt: String(r.updated_at),
      } satisfies CardSummary;
    });

    return { items };
  }

  async getCard(cardId: string): Promise<Card | null> {
    if (!this.sqlite3 || this.db === null) {
      const cards = loadLocalCards();
      return cards[cardId] ?? null;
    }

    const rows = await this.queryAll("SELECT json FROM cards WHERE id = ?", [cardId]);
    if (!rows.length) return null;
    return JSON.parse(String((rows[0] as any).json)) as Card;
  }

  async upsertCard(card: Card): Promise<void> {
    const now = nowIso();
    const card2: Card = {
      ...card,
      meta: {
        ...card.meta,
        createdAt: card.meta?.createdAt ?? now,
        updatedAt: now,
      },
    };

    if (!this.sqlite3 || this.db === null) {
      const cards = loadLocalCards();
      cards[card2.cardId] = card2;
      saveLocalCards(cards);
      return;
    }

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
    if (!this.sqlite3 || this.db === null) {
      const cards = loadLocalCards();
      delete cards[cardId];
      saveLocalCards(cards);
      return;
    }
    await this.run("DELETE FROM cards WHERE id = ?", [cardId]);
    this.scheduleFlush();
  }

  // ---------- Graphs API (UI-facing) ----------
  async listGraphs(): Promise<ListResult<GraphSummary>> {
    if (!this.sqlite3 || this.db === null) {
      const graphs = loadLocalGraphs();
      const items = Object.values(graphs)
        .map((g) => ({
          id: g.graphId,
          name: g.name,
          ownerType: (g.meta as any)?.ownerType ?? "card",
          ownerId: (g.meta as any)?.ownerId ?? "",
          updatedAt: g.meta?.updatedAt ?? g.meta?.createdAt ?? nowIso(),
        }))
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      return { items };
    }

    const rows = await this.queryAll("SELECT id, name, json, updated_at FROM graphs ORDER BY updated_at DESC");
    const items = rows.map((r: any) => {
      const json = safeJsonParse<any>(String(r.json), {});
      const meta = json.meta ?? {};
      return {
        id: String(r.id),
        name: String(r.name),
        ownerType: String(meta.ownerType ?? "card"),
        ownerId: String(meta.ownerId ?? ""),
        updatedAt: String(r.updated_at),
      } satisfies GraphSummary;
    });

    return { items };
  }

  async getGraph(graphId: string): Promise<ActionGraph | null> {
    if (!this.sqlite3 || this.db === null) {
      const graphs = loadLocalGraphs();
      return graphs[graphId] ?? null;
    }

    const rows = await this.queryAll("SELECT json FROM graphs WHERE id = ?", [graphId]);
    if (!rows.length) return null;
    return JSON.parse(String((rows[0] as any).json)) as ActionGraph;
  }

  async upsertGraph(graph: ActionGraph): Promise<void> {
    const now = nowIso();
    const graph2: ActionGraph = {
      ...graph,
      meta: {
        ...graph.meta,
        createdAt: graph.meta?.createdAt ?? now,
        updatedAt: now,
      },
    };

    if (!this.sqlite3 || this.db === null) {
      const graphs = loadLocalGraphs();
      graphs[graph2.graphId] = graph2;
      saveLocalGraphs(graphs);
      return;
    }

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
    if (!this.sqlite3 || this.db === null) {
      const graphs = loadLocalGraphs();
      delete graphs[graphId];
      saveLocalGraphs(graphs);
      return;
    }
    await this.run("DELETE FROM graphs WHERE id = ?", [graphId]);
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

  async importAll(payload: { cards?: Card[]; graphs?: ActionGraph[] }): Promise<void> {
    for (const c of payload.cards ?? []) await this.upsertCard(c);
    for (const g of payload.graphs ?? []) await this.upsertGraph(g);
  }
}

// Keep existing import style in UI: `import { storage } from ...`
export const storage = new WASQLiteStorage();
