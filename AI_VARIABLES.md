# AI_VARIABLES.md

Version: **CJ Docs 1.2** (AI-first, comprehensive) • Updated: **2025-12-24 08:30 UTC**

This document defines:
- Variable scopes used by graphs and gameplay
- Variable data types and how they are produced/consumed by nodes
- Expression & condition language (for node configs)

> **Agent note:** if you add or change any node that reads/writes variables, you **must** update this file.

---

## Variable scopes

**Description for agents:** Variables are key/value pairs stored in specific lifetimes (“scopes”). A node may **read** from a scope and may **write** into a scope if permitted by validation rules.

### Scope table

| Scope | Lifetime | Owner | Read/Write | Typical uses | Example keys |
|---|---|---|---|---|---|
| `run` | One graph execution (one trigger → completion) | Runtime | R/W | ephemeral intermediate values | `run.lastDamage`, `run.roll` |
| `node` | One node execution (recomputed each time node runs) | Runtime | R/W (internal) | caching computed outputs | `node.<id>.out.element` |
| `action` | Bound to one action instance on a card (persisted) | Card system | R/W | cooldowns, per-action state | `action.cooldownTurns` |
| `card` | Bound to a specific card instance (persisted) | Card system | R/W | flags, counters | `card.isEquipped`, `card.stacks` |
| `deck` | Bound to one deck instance (persisted) | Deck system | R/W | discard counts, reshuffle triggers | `deck.resetCount` |
| `scenario` | Bound to scenario runtime (persisted) | Scenario system | R/W | objectives, phase state | `scenario.phase`, `scenario.waterLevel` |
| `entity` | Bound to a game entity on battlefield (persisted) | Game system | R/W | HP, status, stats | `entity.hp`, `entity.status.stunned` |
| `global` | Global to the app / save (persisted) | App | R/W (restricted) | preferences, user settings | `global.user.theme` |

---

## Variable data types

**Description for agents:** Types are used for pin compatibility and for safe-ish expression evaluation. A data pin always declares a type.

### Type table

| Type | Description | Examples | Produced by |
|---|---|---|---|
| `any` | Unknown / mixed | `42`, `{...}` | most nodes (fallback) |
| `number` | Floating point | `120`, `3.14` | `data.constNumber`, math nodes |
| `string` | UTF-8 text | `"🔥"`, `"hoverTarget"` | `data.constString` |
| `boolean` | true/false | `true` | comparisons, conditions |
| `json` | Arbitrary JSON object | `{ "hp": 40 }` | `logic.evalJs`, parsers |
| `vector2` | `{x:number,y:number}` | `{ "x": 120, "y": 40 }` | UI + movement nodes |
| `event` | UI or game event payload | `{ "type":"mouseover","clientX":12 }` | `event.uiHover` |
| `handle` | Opaque runtime handle (DOM entity, entity ref, etc.) | `"dom:abc"` | UI + engine nodes |
| `entityRef` | Reference to an entity id | `"ent_123"` | selectors |
| `cardRef` | Reference to a card id | `"card_abc"` | deck/card nodes |
| `deckRef` | Reference to a deck id | `"deck_01"` | deck nodes |
| `error` | Structured error object | `{ "message":"..." }` | error pins |

---

## Entity state vs variables

- **Entity state** is authoritative gameplay state (HP, statuses, position). It is stored in `entity` scope and typically mirrored in SQLite.
- **Variables** can be derived, temporary, or UI-oriented values (run-time computations, formatting, intermediate results).

Rule of thumb:
- If it affects gameplay resolution or replay determinism → **entity state**.
- If it is intermediate, UI-only, or debug-only → **variables**.

---

## Expression language guide

Expressions are small strings used in node configs (e.g., computed numbers, formatted text). The POC supports a minimal safe subset.

| Goal | Expression | Output | Notes |
|---|---|---|---|
| Literal number | `120` | `120` | parsed as number |
| Literal string | `"🔥"` | `🔥` | must be quoted |
| Variable read | `$run.roll` | `17` | reads from scope |
| Coalesce | `$run.missing ?? 0` | `0` | nullish coalesce |
| Simple math | `$entity.hp - 10` | `30` | limited operators |
| String concat | `"HP: " + $entity.hp` | `"HP: 40"` | use `+` |
| JSON literal | `{ "a": 1 }` | object | only when field expects `json` |

---

## Condition language

Conditions gate execution (e.g., IF nodes, listener filters). A condition yields boolean.

| Condition | Meaning | Example |
|---|---|---|
| `$entity.hp <= 0` | entity is dead | used in scenario triggers |
| `$event.type == "mouseover"` | hover event type | UI listener filters |
| `has($entity.status.stunned)` | status exists | helper predicate |
| `in($card.tags, "legendary")` | array contains | helper predicate |

**Condition evaluation rules (POC):**
- If condition throws → treat as `false` and write an `error` variable.
- Strict equality: `==` for primitives.

---

## Reserved runtime variables

| Key | Scope | Purpose |
|---|---|---|
| `$event` | `run` | current trigger payload |
| `$now` | `run` | ISO timestamp |
| `$rng.seed` | `scenario` | deterministic RNG seed (planned) |

---

## Planned (not yet implemented)

- Deterministic RNG primitives and replay logs
- Typed entity schemas (stats, equipment, action points, etc.)
- Multiplayer reconciliation variables (`net.tick`, `net.authority`)
