# Pages and Component Breakdown

Updated: **2025-12-24 08:30 UTC** • POC Release: **0.1.0**

This document describes the UI as a system: pages, components, assemblies/subassemblies, user journeys, and the data interactions between screens.

---

## Page Index

| Page | Route/Mode | Primary Goal |
|---|---|---|
| Home Shell | `#/` | Provide global nav, DB status, and route outlet |
| Card List | `#/cards` | Create/import/export/delete and open cards |
| Card Edit | `#/cards/:cardId` | Edit card metadata, manage linked action graphs |
| Action Graph | `#/graph/:graphId` | Author an executable graph and preview it |

---

# Page: Card List

## Assembly Overview

| Assembly | Location | Associated data types | Purpose |
|---|---|---|---|
| CardListPage | `src/features/cards/CardListPage.tsx` | `Card` | Browse cards and perform list-level actions |
| ImportModal | `src/components/Modal.tsx` | `Card` JSON | Paste-import a card JSON |
| CardRow | (inline) | `Card` | Render a single card summary row |

## Subassembly Breakdown

| Subassembly | Components | Functional Description | Technical Notes |
|---|---|---|---|
| Load & Render | CardListPage | Loads card list on mount and renders a table | Uses `storage.listCards()` |
| Create | CardListPage | Creates a new demo card + graph and navigates to edit | Calls `storage.upsertGraph` then `storage.upsertCard` |
| Export | CardRow | Downloads JSON file for a card | Uses Blob + `a.download` |
| Import | ImportModal | Parses JSON, validates minimally, upserts | Stores full card object as JSON |

## User Journeys

| Journey name | Detailed Steps | Technical notes | Edge Cases |
|---|---|---|---|
| Create a card | Click `+ New demo card` → navigates to edit | Auto-creates a demo graph | If DB init failed, fallback storage is used |
| Import a card | Click Import → paste JSON → Import | `storage.upsertCard` | If JSON invalid, show alert |
| Export a card | Click Export | Exports raw stored object | Export may include references to missing graphs |
| Delete a card | Click Delete → confirm | Deletes row | Orphan graphs remain unless explicitly cleaned |

## Interaction Table

| Interaction | Input | Output | Related Data |
|---|---|---|---|
| Load list | Route enter | Card table rows | `cards` table / localStorage |
| Import JSON | Textarea JSON | New/updated card | `Card` schema |
| Export JSON | Click | Download file | Stored `card_json` |

---

# Page: Card Edit

## Assembly Overview

| Assembly | Location | Associated data types | Purpose |
|---|---|---|---|
| CardEditPage | `src/features/cards/CardEditPage.tsx` | `Card` | Edit card metadata and manage actions |
| ActionList | (inline) | `CardActionRef` | List actions and open graphs |
| ImportModal | `src/components/Modal.tsx` | `Card` JSON | Paste-import card JSON |

## Subassembly Breakdown

| Subassembly | Components | Functional Description | Technical Notes |
|---|---|---|---|
| Load card | CardEditPage | Fetch card by id and populate form | `storage.getCard(cardId)` |
| Edit fields | CardEditPage | Updates local state, saves on button | `storage.upsertCard(next)` |
| Add action | CardEditPage | Creates new graph + action ref | Graph stored separately; action points to graph |
| Open graph | ActionList | Navigate to graph editor | `#/graph/:graphId` |
| Export card | CardEditPage | Download JSON | Blob download |
| Import card | Modal | Overwrites current card | Should keep schemaVersion; agent must add migration later |

## User Journeys

| Journey name | Detailed Steps | Technical notes | Edge Cases |
|---|---|---|---|
| Add action graph | Click `+ Add Action Graph` → auto creates graph → shows in list | Creates graph first, then adds ref | If graph create fails, card should not be saved |
| Edit action name | Update text field in actions list | Saved on Save | Validate non-empty later |
| Export + re-import | Export then paste in import | Roundtrip | Missing graphs not recreated |

## Interaction Table

| Interaction | Input | Output | Related Data |
|---|---|---|---|
| Save card | Form fields | DB update | `cards.card_json` |
| Create graph | Button click | New `graphs` row | `graphs.graph_json` |
| Navigate | Action click | Route change | Graph id reference |

---

# Page: Action Graph Editor

## Assembly Overview

| Assembly | Location | Associated data types | Purpose |
|---|---|---|---|
| GraphEditorPage | `src/features/graph/GraphEditorPage.tsx` | `ActionGraph` | Edit, connect, run graphs |
| ForgeNode | `src/features/graph/ForgeNode.tsx` | `GraphNode`, `PortSpec` | Visual node with port handles |
| NodeInspector | `src/features/graph/NodeInspector.tsx` | `GraphNode.config` | Modal config UI per node type |
| Runtime | `src/features/graph/graphRuntime.ts` | `ActionGraph` | Execute explicit exec edges |

## Subassembly Breakdown

| Subassembly | Components | Functional Description | Technical Notes |
|---|---|---|---|
| Palette | GraphEditorPage | Lists node types by group; adds nodes | Uses `nodeCatalog` |
| Wiring | ReactFlow | Creates edges between handles | Validates connector kind matches |
| Inspector | NodeInspector | Edits node config and writes into graph JSON | Typed form for common fields |
| Live JSON | GraphEditorPage | Shows live JSON | `JSON.stringify(graph)` |
| Save/Load | GraphEditorPage + storage | Persists graph JSON | `storage.upsertGraph()` |
| Run preview | Runtime | Registers listeners and executes exec chain | Web Animations API |

## User Journeys

| Journey name | Detailed Steps | Technical notes | Edge Cases |
|---|---|---|---|
| Wire exec path | Drag exec handle → target exec input | Adds `kind=exec` edge | Prevents data↔exec mismatches |
| Configure listener | Click listener node → set selector + event | Changes runtime binding | Selector not found -> warns |
| Trigger emoji flight | Click Run → hover preview target | Event triggers chain | Multiple triggers can overlap animations |
| Export graph | Click Export | Download JSON | Exports current in-memory graph |
| Import graph | Paste JSON | Replaces editor state | No migration yet |

## Interaction Table

| Interaction | Input | Output | Related Data |
|---|---|---|---|
| Connect ports | Drag connection | New edge in graph | `GraphEdge` |
| Move node | Drag node | Position update | `GraphNode.position` |
| Run | Click Run | Runtime starts | Listener nodes register DOM events |

---

## Cross-Page Integration Matrix

| From | To | Integration | Data contract | Failure mode |
|---|---|---|---|---|
| Card List | Card Edit | Navigate with `cardId` | `Card.cardId` | Missing id → show error |
| Card Edit | Graph Editor | Navigate with `graphId` | `CardActionRef.graphId` | Missing graph → auto-create in future |
| Graph Editor | Card Edit | Back navigation | None | Unsaved graph changes can be lost |
| Any | Storage | CRUD operations | `Card` / `ActionGraph` JSON | SQLite init failure → fallback storage |
