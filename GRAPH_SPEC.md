# GRAPH_SPEC.md

Updated: **2025-12-24 08:30 UTC**

This file is a compact technical spec for the graph system.

For the full living guide, see:
- `AI_DETAILED_NODE_CONNECTION_AND_SOCKET_FSD_TSD.md`
- `AI_JSON_GUIDE.md`

---

## Design principles

- Graphs must model **explicit execution** separately from **data flow**.
- Graph export/import is **JSON-first**.
- Nodes are typed via a registry, not free text.
- Ports have explicit `kind` + `dataType` + `side` + `slot`.

## Connector kinds

| Kind | Meaning |
|---|---|
| exec | Control flow (blue)
| data | Values (green)
| tool | External tools/services (purple)
| db | Database sources (orange)
| error | Error channels (red)

## POC node types

See `src/lib/nodeCatalog.ts`.
