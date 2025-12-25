# AI_PLAY_GUIDE.md

Updated: **2025-12-24 08:30 UTC** • Scope: **POC + forward-compatible rules timing**

This file is a **rules & timing reference** for AI agents generating card logic graphs.

> **Agent note:** A graph can be syntactically valid but still break gameplay if it violates timing windows or resource rules. This doc helps keep authored graphs sane.

---

## Core resources

| Resource | Type | Notes |
|---|---|---|
| HP | integer (10-pt increments) | Damage and healing must be multiples of 10 |
| AP | integer | Action budget per turn/window |
| Action Cards | hand (set) | Properties gate actions + activation economy |
| Umbra / Aether | -10…+10 | Energy alignment; interacts with abilities |
| Status Effects | set | e.g., Stunned, Silenced, Prone |
| Zones | board model | e.g., water tiles, sand zones, resonance fields |

---

## Turn loop

| Phase | Purpose | Typical graph triggers |
|---|---|---|
| Setup | Initialize scenario, shuffle decks | `onScenarioStart`, `onDeckShuffled` |
| Draw | Draw action cards | `onHandChanged` |
| Player Turn (main) | Spend AP, play cards, move | `onPlayerActionRequested` |
| Reactions | Interrupts / triggered abilities | `onBeforeDamage`, `onAfterMove`, `onStatusApplied` |
| End Turn | Cleanup, DOT, decay | `onTurnEnded` |

---

## Timing windows

| Window | When it occurs | Allowed operations | Disallowed operations |
|---|---|---|---|
| Pre-Action | Before selecting a move | Query state, show UI, preview costs | Mutating battlefield state |
| Commit | When confirming an action | Spend AP/cards, lock targets | Any additional target selection without explicit UI |
| Resolve | Applying effects | Damage/heal, statuses, movement | Drawing extra cards without explicit node |
| After-Resolve | Immediately after resolve | Trigger listeners, chain steps | Rewriting already-resolved logs/events |

---

## Environment model (draft)

Notes for future versions:
- Battlefield is a grid with typed tiles (land, water, hazard, zone overlays)
- Entities have state: position, HP, AP, stats, statuses, tags, inventory
- Decks/hands/discards are stateful containers with deterministic shuffle seeds for multiplayer
- Graph execution must be deterministic when network-synchronized (no `Math.random()` without seed)

---

## AI authoring guardrails

| Rule | Why |
|---|---|
| Always keep an explicit exec chain | Makes timing and determinism visible |
| Keep data side-effect-free | Allows caching + easier replay |
| Separate UI from rules | UI nodes should not mutate game state |
| Use constants sparingly | Prefer reading from state/query nodes |

