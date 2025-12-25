# AI_DIRECTORY_GUIDE.md

Version: **CJ Docs 0.1** (AI-first, comprehensive) • Updated: **2025-12-24 08:30 UTC**

This guide is meant to help AI agents modify the codebase safely.

---

## High-level architecture

**Client-only POC** (runs on GitHub Pages):
- React + TypeScript + Vite
- In-browser persistence: **wa-sqlite** (SQLite in WASM) + **Emscripten IDBFS** file persistence
- JSON-first data model: cards, graphs, and links are serialized exactly as JSON objects
- Minimal graph runtime executes explicit execution flows and reads/writes typed data pins

---

## Directories

| Directory | Purpose |
|---|---|
| `src/app` | App shell, routing, global init |
| `src/features/cards` | Card List + Card Edit feature code |
| `src/features/graph` | Graph editor + runtime + node UI |
| `src/lib` | Schemas, types, node registry/catalog, storage layer |
| `src/assets/sample` | Seed demo content |
| `src/styles` | Global + graph styles |
| `.github/workflows` | GitHub Pages deploy workflow |

---

## Files

> **Agent note:** if you add a new file in `src/`, update this table.

| File | Location | Purpose | Core functions / exports |
|---|---|---|---|
| `README.md` | `/` | Setup + how to run + POC scope | — |
| `AGENT_UPDATE_PLAYBOOK.md` | `/` | Non-negotiables + update process | — |
| `AI_JSON_GUIDE.md` | `/` | Canonical JSON schemas + examples | — |
| `AI_VARIABLES.md` | `/` | Variable model + expression language | — |
| `AI_PLAY_GUIDE.md` | `/` | Gameplay timing + resources reference | — |
| `AI_DETAILED_NODE_CONNECTION_AND_SOCKET_FSD_TSD.md` | `/` | Connector/pin UI semantics + validation | — |
| `API_SPEC.md` | `/` | CRUD + future server API contract | — |
| `PAGES_AND_COMPONENT_BREAKDOWN.md` | `/` | UI decomposition + journeys | — |
| `RELEASE_NOTES.md` | `/` | Release log (update every PR) | — |
| `vite.config.ts` | `/` | Vite config + GitHub Pages base path | default export |
| `.github/workflows/deploy-pages.yml` | `/.github/workflows` | CI build+deploy to Pages | — |
| `src/main.tsx` | `src/` | React entry + router + styles | — |
| `src/app/App.tsx` | `src/app` | App layout + routes + DB init status | `App()` |
| `src/components/Modal.tsx` | `src/components` | Simple modal used by editor UIs | `Modal()` |
| `src/features/cards/CardListPage.tsx` | `src/features/cards` | Card list UI + import/export | `CardListPage()` |
| `src/features/cards/CardEditPage.tsx` | `src/features/cards` | Card editing UI + actions link | `CardEditPage()` |
| `src/features/graph/GraphEditorPage.tsx` | `src/features/graph` | Graph editor UI + run preview | `GraphEditorPage()` |
| `src/features/graph/ForgeNode.tsx` | `src/features/graph` | Custom node UI (ports on sides) | `ForgeNode` |
| `src/features/graph/NodeInspector.tsx` | `src/features/graph` | Node config modal | `NodeInspector()` |
| `src/features/graph/graphRuntime.ts` | `src/features/graph` | Executes graphs + event listeners | `startRuntime()` |
| `src/lib/types.ts` | `src/lib` | Canonical TS types for JSON | types |
| `src/lib/nodeCatalog.ts` | `src/lib` | Node registry + ports + defaults | `nodeCatalog`, `makeNodeFromType()` |
| `src/lib/storage.ts` | `src/lib` | wa-sqlite init + CRUD helpers | `storage` |
| `src/assets/sample/demoCard.ts` | `src/assets/sample` | Seed card JSON | `makeDemoCard()` |
| `src/assets/sample/demoGraph.ts` | `src/assets/sample` | Seed graph JSON | `makeHoverEmojiDemoGraph()` |
| `src/styles/global.css` | `src/styles` | Shared global styles | — |
| `src/styles/graph.css` | `src/styles` | Graph/node styling | — |

---

## Key invariants (do not break)

1. **Schema versions are explicit** (`CJ-0.1`, `CJ-GRAPH-0.1`).
2. **Ports are authoritative** for connection typing (kind + dataType + direction + side).
3. **Edges must only connect compatible port kinds** (exec↔exec, data↔data, tool↔tool, db↔db).
4. **Runtime matches editor semantics**: if editor can create it, runtime must execute or throw a clear error.
5. **Every save** updates `updatedAt` timestamps.

---

## Safe change patterns

- Add a node type:
  1) Update `src/lib/nodeCatalog.ts`
  2) Update docs: `AI_DETAILED_NODE_CONNECTION_AND_SOCKET_FSD_TSD.md` + `AI_JSON_GUIDE.md`
  3) Add runtime support in `src/features/graph/graphRuntime.ts`
  4) Add config UI in `src/features/graph/NodeInspector.tsx` (or ensure JSON editor works)

- Add schema fields:
  1) Update `src/lib/types.ts`
  2) Update `AI_JSON_GUIDE.md`
  3) Add migration plan (future: `src/lib/migrations.ts`)

