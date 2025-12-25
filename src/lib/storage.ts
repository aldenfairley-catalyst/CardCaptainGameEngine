// src/lib/storage.ts
import * as SQLite from "wa-sqlite";

const DB_FILE = "cj_forge.sqlite";

/**
 * Split a SQL script into statements.
 * Simple splitter: handles semicolons; ignores empty statements.
 * (Good enough for our PoC migration scripts.)
 */
function splitSqlScript(script: string): string[] {
  return script
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => s + ";");
}

/**
 * A tiny wa-sqlite wrapper aimed at:
 * - Running in the browser (WASM)
 * - Persisting via wa-sqlite (file-backed in WASM VFS)
 * - Avoiding TypeScript typing drift between wa-sqlite versions
 *
 * IMPORTANT: we intentionally route calls via Function.apply(...) to prevent
 * TypeScript "wrong arity" (TS2554) compile failures when typedefs differ.
 */
class WASQLiteStorage {
  private sqlite3: any | null = null;
  private db: number | null = null;
  private ready: Promise<void> | null = null;

  private getApi(): { sqlite3: any } {
    if (!this.sqlite3) throw new Error("DB not initialized");
    return { sqlite3: this.sqlite3 };
  }

  private call(name: string, args: any[] = []): any {
    const { sqlite3 } = this.getApi();
    const fn = sqlite3?.[name];
    if (typeof fn !== "function") {
      throw new Error(`wa-sqlite: missing function ${name}()`);
    }
    // Use apply to avoid TS arity mismatches.
    return fn.apply(sqlite3, args);
  }

  async init(): Promise<void> {
    if (this.ready) return this.ready;

    this.ready = (async () => {
      // Factory loads the wasm module internally.
      // Typings differ between versions; keep it any.
      const sqlite3: any = (SQLite as any).Factory
        ? await (SQLite as any).Factory()
        : (SQLite as any);

      this.sqlite3 = sqlite3;

      // open_v2(name, flags?, vfs?)
      // Using apply avoids TS arity checks.
      this.db = await this.call("open_v2", [DB_FILE]);

      await this.migrate();
      await this.seedIfEmpty();
    })();

    return this.ready;
  }

  async close(): Promise<void> {
    if (!this.sqlite3 || this.db === null) return;
    try {
      await this.call("close", [this.db]);
    } finally {
      this.db = null;
      this.sqlite3 = null;
      this.ready = null;
    }
  }

  private async ensureReady(): Promise<void> {
    if (!this.ready) await this.init();
    else await this.ready;
    if (!this.sqlite3 || this.db === null) throw new Error("DB not ready");
  }

  // -------- Statement helpers --------

  /**
   * Prepare a statement handle.
   * wa-sqlite offers prepare_v2(db, sql). Some versions/examples also expose
   * statements(db, sql) returning an iterator. We support both.
   */
  private async prepare(sql: string): Promise<number> {
    await this.ensureReady();
    const db = this.db as number;

    // Prefer prepare_v2 if present.
    if (this.sqlite3?.prepare_v2) {
      return await this.call("prepare_v2", [db, sql]);
    }

    // Fallback to statements iterator if present.
    if (this.sqlite3?.statements) {
      const iterator: AsyncIterable<number> = await this.call("statements", [db, sql]);
      for await (const stmt of iterator) return stmt;
      throw new Error("wa-sqlite: statements() produced no statements");
    }

    throw new Error("wa-sqlite: no prepare_v2() or statements() available");
  }

  private async finalize(stmt: number): Promise<void> {
    // finalize(stmt)
    if (this.sqlite3?.finalize) {
      await this.call("finalize", [stmt]);
      return;
    }
    // Some APIs use "close" for statements (rare).
    if (this.sqlite3?.close) {
      await this.call("close", [stmt]);
      return;
    }
  }

  private async bind(stmt: number, bind?: any[]): Promise<void> {
    if (!bind || bind.length === 0) return;

    // bind_collection(stmt, values) exists in wa-sqlite 1.x
    if (this.sqlite3?.bind_collection) {
      await this.call("bind_collection", [stmt, bind]);
      return;
    }

    // Fallback: bind(stmt, idx, value) style (not guaranteed)
    if (this.sqlite3?.bind) {
      for (let i = 0; i < bind.length; i++) {
        await this.call("bind", [stmt, i + 1, bind[i]]);
      }
      return;
    }

    // If we reach here, we have no binding support.
    throw new Error("wa-sqlite: no bind_collection() or bind() available");
  }

  private async step(stmt: number): Promise<number> {
    // step(stmt) -> rc
    return await this.call("step", [stmt]);
  }

  private async reset(stmt: number): Promise<void> {
    if (this.sqlite3?.reset) {
      await this.call("reset", [stmt]);
    }
  }

  private async columnNames(stmt: number): Promise<string[]> {
    // column_names(stmt) -> string[]
    if (this.sqlite3?.column_names) {
      return await this.call("column_names", [stmt]);
    }
    // Some wrappers use columnNames()
    if (this.sqlite3?.columnNames) {
      return await this.call("columnNames", [stmt]);
    }
    throw new Error("wa-sqlite: no column_names() available");
  }

  private async column(stmt: number, i: number): Promise<any> {
    // column(stmt, i) -> any
    if (this.sqlite3?.column) return await this.call("column", [stmt, i]);
    // Some wrappers use "get(stmt, i)"
    if (this.sqlite3?.get) return await this.call("get", [stmt, i]);
    throw new Error("wa-sqlite: no column() available");
  }

  // -------- SQL ops --------

  private async run(sql: string, bind?: any[]): Promise<void> {
    await this.ensureReady();
    const stmt = await this.prepare(sql);
    try {
      await this.bind(stmt, bind);

      // Step until not ROW
      while (true) {
        const rc = await this.step(stmt);
        if (rc === (SQLite as any).SQLITE_ROW) continue;
        break;
      }
    } finally {
      await this.finalize(stmt);
    }
  }

  private async queryAll(sql: string, bind?: any[]): Promise<Array<Record<string, unknown>>> {
    await this.ensureReady();
    const stmt = await this.prepare(sql);

    try {
      await this.bind(stmt, bind);

      const cols = await this.columnNames(stmt);
      const out: Array<Record<string, unknown>> = [];

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

  private async queryOne(sql: string, bind?: any[]): Promise<Record<string, unknown> | null> {
    const rows = await this.queryAll(sql, bind);
    return rows.length ? rows[0] : null;
  }

  private async execScript(script: string): Promise<void> {
    const stmts = splitSqlScript(script);
    for (const s of stmts) await this.run(s);
  }

  // -------- Migrations / Schema --------

  private async migrate(): Promise<void> {
    await this.ensureReady();

    await this.execScript(`
      PRAGMA foreign_keys = ON;

      CREATE TABLE IF NOT EXISTS cards (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        cardType TEXT NOT NULL,
        rarity TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        json TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS graphs (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        ownerType TEXT NOT NULL,   -- 'card' | 'deck' | 'scenario' (future)
        ownerId TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        json TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_graphs_owner ON graphs(ownerType, ownerId);
    `);
  }

  private async seedIfEmpty(): Promise<void> {
    const row = await this.queryOne(`SELECT COUNT(1) as cnt FROM cards;`);
    const cnt = Number((row?.cnt as any) ?? 0);
    if (cnt > 0) return;

    const now = new Date().toISOString();
    const demoCard = {
      schemaVersion: "CJ-1.0",
      id: "card_demo_1",
      name: "Demo Card",
      cardType: "Action",
      rarity: "Common",
      actions: ["graph_demo_1"],
    };

    const demoGraph = {
      schemaVersion: "CJ-GRAPH-1.0",
      id: "graph_demo_1",
      name: "Hover Emoji Flyby",
      ownerType: "card",
      ownerId: "card_demo_1",
      nodes: [],
      links: [],
    };

    await this.upsertCard({
      id: "card_demo_1",
      name: "Demo Card",
      cardType: "Action",
      rarity: "Common",
      json: JSON.stringify(demoCard),
      createdAt: now,
      updatedAt: now,
    });

    await this.upsertGraph({
      id: "graph_demo_1",
      name: "Hover Emoji Flyby",
      ownerType: "card",
      ownerId: "card_demo_1",
      json: JSON.stringify(demoGraph),
      createdAt: now,
      updatedAt: now,
    });
  }

  // -------- Public CRUD API --------

  async listCards(): Promise<Array<{ id: string; name: string; cardType: string; rarity: string; updatedAt: string }>> {
    const rows = await this.queryAll(
      `SELECT id, name, cardType, rarity, updatedAt FROM cards ORDER BY updatedAt DESC;`
    );
    return rows as any;
  }

  async getCard(id: string): Promise<{ id: string; name: string; cardType: string; rarity: string; json: string } | null> {
    const row = await this.queryOne(
      `SELECT id, name, cardType, rarity, json FROM cards WHERE id = ?;`,
      [id]
    );
    return row as any;
  }

  async upsertCard(card: {
    id: string;
    name: string;
    cardType: string;
    rarity: string;
    json: string;
    createdAt: string;
    updatedAt: string;
  }): Promise<void> {
    await this.run(
      `
      INSERT INTO cards (id, name, cardType, rarity, createdAt, updatedAt, json)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name=excluded.name,
        cardType=excluded.cardType,
        rarity=excluded.rarity,
        updatedAt=excluded.updatedAt,
        json=excluded.json
    `,
      [card.id, card.name, card.cardType, card.rarity, card.createdAt, card.updatedAt, card.json]
    );
  }

  async deleteCard(id: string): Promise<void> {
    await this.run(`DELETE FROM cards WHERE id = ?;`, [id]);
  }

  async listGraphsForOwner(ownerType: string, ownerId: string): Promise<Array<{ id: string; name: string; updatedAt: string }>> {
    const rows = await this.queryAll(
      `SELECT id, name, updatedAt FROM graphs WHERE ownerType = ? AND ownerId = ? ORDER BY updatedAt DESC;`,
      [ownerType, ownerId]
    );
    return rows as any;
  }

  async getGraph(id: string): Promise<{ id: string; name: string; ownerType: string; ownerId: string; json: string } | null> {
    const row = await this.queryOne(
      `SELECT id, name, ownerType, ownerId, json FROM graphs WHERE id = ?;`,
      [id]
    );
    return row as any;
  }

  async upsertGraph(graph: {
    id: string;
    name: string;
    ownerType: string;
    ownerId: string;
    json: string;
    createdAt: string;
    updatedAt: string;
  }): Promise<void> {
    await this.run(
      `
      INSERT INTO graphs (id, name, ownerType, ownerId, createdAt, updatedAt, json)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name=excluded.name,
        ownerType=excluded.ownerType,
        ownerId=excluded.ownerId,
        updatedAt=excluded.updatedAt,
        json=excluded.json
    `,
      [graph.id, graph.name, graph.ownerType, graph.ownerId, graph.createdAt, graph.updatedAt, graph.json]
    );
  }

  async deleteGraph(id: string): Promise<void> {
    await this.run(`DELETE FROM graphs WHERE id = ?;`, [id]);
  }
}

export const storage = new WASQLiteStorage();
