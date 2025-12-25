# Captain Jawa Forge / CardForge — Proof of Concept (POC)

This repo is an early proof-of-concept for a **JSON-serializable graph workflow editor** used to author card actions, deck events, and scenario triggers for **Captain Jawa**.

## What this POC includes

- ✅ Card List screen (create/import/export/delete)
- ✅ Card Edit screen (edit metadata + manage linked action graphs)
- ✅ Action Graph editor
  - Explicit execution wires (blue) vs data wires (green)
  - Node selection opens a config modal
  - Live JSON updates in realtime
  - Save/load graphs to a **browser-stored SQLite DB** (wa-sqlite)
- ✅ Demo graph: **UI Hover Listener → Spawn Big Emoji → Animate Fly → Remove**

## Tech stack (current)

- Vite + React + TypeScript
- React Flow (graph UI)
- wa-sqlite (SQLite in the browser) with Emscripten IDBFS persistence

> Notes
> - This is **not** the final architecture. It is intentionally minimal so we can validate the JSON model, node UX language, and runtime semantics.
> - Later we can split the runtime to a server / multiplayer sim, while keeping the editor JSON stable.

## Local dev

```bash
npm install
npm run dev
```

Open: http://localhost:5173

## Build

```bash
npm run build
npm run preview
```

## GitHub Pages

A GitHub Actions workflow is included at:

- `.github/workflows/deploy-pages.yml`

It builds and deploys the app to Pages. The Vite `base` path is set automatically from the repo name in CI.

## Where to start

- `src/features/cards` — Card List + Card Edit
- `src/features/graph` — Graph Editor, Node UI, and Runtime executor
- `src/lib/types.ts` — Canonical JSON-friendly types
- `src/lib/nodeCatalog.ts` — Node catalog (v0.1)
- `src/lib/storage.ts` — wa-sqlite persistence + CRUD

## Safety note: arbitrary code node

The POC includes a `logic.evalJs` node concept. Executing arbitrary code is **unsafe**. In a real version we should:

- run step code in a sandboxed worker
- gate it behind capability flags
- validate allowed APIs
- treat card/action packages as untrusted
