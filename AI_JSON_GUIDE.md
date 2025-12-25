# AI_JSON_GUIDE.md

Updated: **2025-12-24 08:30 UTC** • Schemas: **CJ-0.1** / **CJ-GRAPH-0.1**

This guide is written so an AI agent can:
1) Read exported JSON (cards, graphs)
2) Modify it safely
3) Generate **fully valid** new JSON from scratch
4) Keep compatibility across schema versions

---

## 1) Schema versioning rules

- Every JSON blob includes a `schemaVersion` field.
- When a schema change is made:
  - bump the version string
  - add a migration function
  - update docs + sample JSON + validators

**POC schema versions**
- Card schema: `CJ-0.1`
- Graph schema: `CJ-GRAPH-0.1`

---

## 2) Card JSON

### Card shape

```json
{
  "schemaVersion": "CJ-0.1",
  "cardId": "card_demo_emoji",
  "name": "Emoji Cannon (Demo)",
  "description": "Hover ...",
  "tags": ["demo"],
  "actions": [
    {
      "actionId": "action_...",
      "name": "Hover Emoji Demo",
      "graphId": "graph_demo_hover_emoji"
    }
  ],
  "createdAt": "2025-12-24T08:30:00.000Z",
  "updatedAt": "2025-12-24T08:30:00.000Z"
}
```

### Card rules
- `cardId` must be globally unique (stable identifier).
- `actions[].graphId` must reference an existing saved graph.

---

## 3) Graph JSON

### Graph shape

```json
{
  "schemaVersion": "CJ-GRAPH-0.1",
  "graphId": "graph_demo_hover_emoji",
  "name": "Hover Emoji Demo",
  "nodes": [ ... ],
  "edges": [ ... ],
  "createdAt": "...",
  "updatedAt": "...",
  "meta": {
    "authoringTool": "CJ Forge POC",
    "notes": "Demo graph for hover emoji"
  }
}
```

---

## 4) Node JSON

### Node fields

| Field | Type | Description |
|---|---|---|
| `id` | string | Unique within graph |
| `type` | string | Must exist in the node catalog / registry |
| `title` | string | Display title |
| `color` | string | Node color (theme accent) |
| `position` | `{x:number,y:number}` | Canvas location |
| `ports` | `PortSpec[]` | Sockets/handles |
| `config` | object | Node-specific config |

---

## 5) PortSpec JSON

| Field | Type | Description |
|---|---|---|
| `id` | string | Unique within node |
| `name` | string | Display label |
| `kind` | `exec|data|tool|db|error` | Connector kind |
| `direction` | `in|out` | Socket direction |
| `side` | `left|right|top|bottom` | Socket position on node |
| `slot` | number | Ordering along the side |
| `dataType` | string? | Only for data ports |
| `shape` | `triangle|circle|square|diamond|hex` | Visual cue |
| `color` | string | Visual cue |

---

## 6) Edge JSON

| Field | Type | Description |
|---|---|---|
| `id` | string | Unique within graph |
| `kind` | connector kind | Must match the ports being linked |
| `from` | `{nodeId,portId}` | Source socket |
| `to` | `{nodeId,portId}` | Target socket |

---

## 7) Node catalog (POC)

See `src/lib/nodeCatalog.ts` for the canonical registry.

### Implemented nodes
- `event.uiHover` — starts execution on UI hover
- `tool.uiRoot` — provides UI overlay mount point
- `data.constString` — outputs a string
- `data.constNumber` — outputs a number
- `ui.spawnEmoji` — creates emoji element
- `ui.animateFly` — animates element across screen
- `ui.removeElement` — removes element
- `debug.log` — logs to console
- `logic.evalJs` — executes user JS (unsafe)

---

## 8) Full example graph JSON (demo)

This is the exported form of the built-in hover emoji demo.

```json
REPLACE_WITH_EXPORT_FROM_APP
```

> In the POC app, open the Graph Editor for the demo action and use **Export Graph JSON**. Paste here when promoting docs to a non-POC release.

---

## 9) Migration notes

### CJ-GRAPH-0.1 → CJ-GRAPH-0.2 (planned)
- Introduce `nodeVersion` for per-node schema evolution
- Add `edge.meta` with optional `coerce` rules for data conversion
- Add `subgraphs` for reusable macros

