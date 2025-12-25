# AI_DETAILED_NODE_CONNECTION_AND_SOCKET_FSD_TSD.md

Updated: **2025-12-24 08:30 UTC** • POC Release: **0.1.0**

This is the **living source of truth** for:
- Node visual language (color, layout, sockets)
- Connector kinds (execution vs data vs tool vs db)
- Socket shapes + meaning
- Connection validation rules
- How the runtime interprets graphs

> **Agent note:** Any change to ports, colors, shapes, or connector semantics requires updating:
> - `src/lib/nodeCatalog.ts`
> - `src/lib/types.ts`
> - `src/features/graph/ForgeNode.tsx` (render)
> - `src/features/graph/GraphEditorPage.tsx` (validation / styling)
> - `src/features/graph/graphRuntime.ts` (execution)
> - this document

---

## 1) Canonical node layout

Each node uses a **fixed physical grammar** so graphs remain readable at scale.

### 1.1 Socket placement rules

| Socket type | Side | Vertical band | Meaning |
|---|---|---|---|
| Exec In | Left | Top 50% | Incoming execution requests (control flow) |
| Exec Out | Right | Top 50% | Outgoing execution requests |
| Data In | Left | Bottom 50% | Input values / payloads |
| Data Out | Right | Bottom 50% | Produced values |
| DB | Top | Top edge | Databases / queryable data sources |
| Tool | Bottom | Bottom edge | External tools / APIs / UI mounts |

> **Invariants:**
> - Exec connectors never carry data.
> - Data connectors never start execution.
> - Tool + DB connectors are **capability links** (what you can call/query), not a control-flow wire.

---

## 2) Connector kinds, colors, and how they are used

| Kind | Color (wire) | Purpose | Runtime behavior |
|---|---|---|---|
| Execution (`exec`) | Blue | Defines explicit control flow | Traversed in-order; can be async/await |
| Data (`data`) | Green | Passes typed values | Pulled (lazy) when a node executes |
| Tool (`tool`) | Purple | Grants access to a tool/mount | Resolved as a capability ref |
| Database (`db`) | Orange | Grants access to a data source | Resolved as a capability ref |
| Error (`error`) | Red | Carries error payloads | Used for debug/telemetry flows |

### 2.1 Blue vs Green (why they differ)
- **Blue (execution)**: ordering + causality. If A → B in blue, B does not run until A finishes.
- **Green (data)**: value wiring. If A outputs a value, B may pull it when it needs it.

---

## 3) Socket shapes

Sockets are **shape-coded** to be readable even in monochrome screenshots.

| Socket kind | Shape | Rationale |
|---|---|---|
| Exec | Triangle | Directional, "play button" semantics |
| Data | Circle | Neutral payload/value |
| Tool | Diamond | Capability / service access |
| DB | Square | Storage / persistence |
| Error | Hexagon | Visually distinct for exceptional flows |

---

## 4) Connection validation rules

### 4.1 Hard rules (cannot connect)

| Rule | Example | Why |
|---|---|---|
| Kind must match | exec → data | Prevents hidden semantics |
| Direction must match | out → out | Must have source & sink |
| Port must exist | connecting to deleted port | Prevents invalid graph |

### 4.2 Soft rules (allowed but may warn)

| Rule | Warning condition |
|---|---|
| Data type mismatch | connecting `number` to `string` input |
| Multiple data edges into one input | last-write-wins is not allowed in v0.1; reject |

---

## 5) Runtime interpretation

### 5.1 Execution model
1. A listener node emits an **exec trigger**.
2. The runtime walks the exec graph **depth-first, linear** (single outgoing chain in v0.1).
3. Each node:
   - resolves its input data (green) and capabilities (purple/orange)
   - runs its action
   - writes outputs to runtime memory
4. The next exec node runs.

### 5.2 Data resolution (lazy)
Data values are resolved by following the incoming green edge to an upstream output port.

### 5.3 Current POC limitations
- No parallel exec branches
- No loop nodes
- No per-node concurrency policy
- Minimal type-checking

---

## 6) Node catalog (implemented in POC)

> The canonical machine-readable catalog is `src/lib/nodeCatalog.ts`.

| Group | Node type | Purpose | Key ports |
|---|---|---|---|
| Events & Listeners | `event.uiHover` | Starts execution when user hovers a selector | execOut `trigger`, dataOut `event` |
| Tools | `tool.uiRoot` | Provides an overlay mount (capability) | toolOut `uiRoot` |
| Data | `data.constString` | Emits a string | dataOut `value` |
| Data | `data.constNumber` | Emits a number | dataOut `value` |
| UI | `ui.spawnEmoji` | Creates an emoji element | exec in/out, dataOut `element`, toolIn `uiRoot` |
| UI | `ui.animateFly` | Animates element across screen | exec in/out, dataIn/out `element` |
| UI | `ui.removeElement` | Removes element | exec in/out, dataIn `element` |
| Debug | `debug.log` | Console logger | exec in/out, dataIn `any` |
| Logic | `logic.evalJs` | Runs unsafe JS (dev only) | exec in/out, dataOut `result`, errorOut `error` |

---

## 7) Planned connector extensions (next)

| Feature | Description |
|---|---|
| Multi-branch exec | switch/if nodes with multiple exec outputs |
| Typed JSON schema pins | enforce JSON shape via schema refs |
| Multiplayer signals | event kinds for remote player actions |
| Deterministic replay | record all triggers + random seeds |

