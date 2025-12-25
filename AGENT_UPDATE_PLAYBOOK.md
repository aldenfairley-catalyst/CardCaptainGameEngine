# Captain Jawa Forge / CardForge — Agent Update Playbook

Version: **1.1** • Last Update **2025-12-24 08:30 UTC** • Release: **0.1.0**

This document is the **standard operating procedure** for any AI agent or developer making updates to this codebase.

---

## 0) Purpose & Non-Negotiables

### What this repo is
A multi-tool ecosystem (Forge/Card Builder, Library, Deck Builder, Scenario Builder) that shares a single rules system and schemas.

### Non-negotiables (must hold after every change)
1. **Import/Export compatibility**: previously exported JSON must still import (or migrate cleanly).
2. **No silent schema drift**: if schema changes, update validators + types + docs + sample JSON + version notes.
3. **Registry parity**: any new node/step type, enum, or UI flow must be added to the registry (so it never becomes `UNKNOWN_NODE`).
4. **Validation parity**: validator rules must match gameplay constraints (not just shape-checks).
5. **Docs parity**: root markdown docs must always describe the current truth.
6. **Runtime parity**: if the editor can author it, the runtime must either execute it or fail loudly with an actionable error.

---

## 1) First Actions: Review Documentation & Build Context

### 1.1 Read ALL root docs (required)
Open and scan:
- `AI_JSON_GUIDE.md`
- `AI_VARIABLES.md`
- `AI_PLAY_GUIDE.md`
- `AI_DETAILED_NODE_CONNECTION_AND_SOCKET_FSD_TSD.md`
- `AI_DIRECTORY_GUIDE.md`
- `API_SPEC.md`
- `PAGES_AND_COMPONENT_BREAKDOWN.md`
- `RELEASE_NOTES.md`
- `README.md`

**Goal**: identify what the system *claims* it supports vs what code *actually* supports.

### 1.2 Run the app and reproduce current behavior
- Run locally and confirm:
  - Card List load, create, import/export
  - Card Edit save
  - Graph Editor save/load
  - Demo graph runtime: hover → flying emoji
- Note exact console errors + validation errors.

---

## 2) Develop a Plan

### 2.1 Create a short plan (must include)
- **User story**: what capability is being added/fixed
- **Schema impact**: yes/no (and which versions affected)
- **Registry impact**: which nodeTypes/enums/uiFlows must be added
- **UI impact**: which screens/editors change
- **Validation impact**: which invariants need enforcement
- **Migration strategy**: if schema changes, how imports are migrated

### 2.2 Critique your plan (must do)
Ask:
- Does this introduce new concepts that should be generalized vs hard-coded?
- Are we adding a one-off special case that should be a reusable node or policy?
- Can existing content import/export without manual editing?
- Are we duplicating logic (validator vs editor vs runtime)?
- Will future cards require a more generic design than the current implementation?

---

## 3) Update Specs Before Coding

Before changing code, update the relevant living docs:
- For JSON/schema: `AI_JSON_GUIDE.md`
- For variables/refs: `AI_VARIABLES.md`
- For gameplay timing constraints: `AI_PLAY_GUIDE.md`
- For sockets/edges/node catalog: `AI_DETAILED_NODE_CONNECTION_AND_SOCKET_FSD_TSD.md`
- For UI/editor flows: `PAGES_AND_COMPONENT_BREAKDOWN.md`

Each feature spec must include:
- Inputs the user provides (UI)
- Outputs/state changes
- Edge cases
- Validation rules
- Import/export representation
- Runtime behavior

---

## 4) Schema Versioning Rules

- Schema changes must bump `schemaVersion` (e.g., `CJ-GRAPH-0.1` → `CJ-GRAPH-0.2`).
- Add a migration path:
  - Import older schema
  - Transform to latest schema in memory
  - Export in latest schema

**Rule:** No schema changes without:
- Type updates (`src/lib/types.ts`)
- Validator updates (future: `src/lib/validate.ts`)
- Registry updates (`src/lib/nodeCatalog.ts` and/or future `blockRegistry.json`)
- Docs updates (root docs)
- Release note entry (`RELEASE_NOTES.md`)

---

## 5) Directory Structure Guidelines

- `src/features/<domain>/...` for large tool areas (cards, graphs, decks, scenarios).
- `src/components/...` for reusable UI pieces.
- `src/lib/...` for core shared logic (schemas, storage, migrations, runtime).
- `src/assets/...` for registry catalogs, templates, sample JSON.

If you move files:
- Update imports
- Update docs referencing paths
- Confirm GitHub Pages build works

---

## 6) Implementation Checklist

### 6.1 If you change schema
- Update `src/lib/types.ts`
- Update node catalog or registries
- Update importer/exporter behavior
- Update sample JSON
- Update runtime execution
- Add migration notes

### 6.2 If you add node types
- Add to `src/lib/nodeCatalog.ts` (and future `blockRegistry.json`)
- Add editor config UI fields
- Add runtime execution handler (or explicit unsupported error)
- Update node/socket docs

### 6.3 If you change storage
- Keep the CRUD contract stable for cards + graphs
- Provide forward path for server mode
- Confirm wa-sqlite persistence still functions

---

## 7) Definition of Done

A change is “done” only when:
- App builds and runs (local + GH Pages)
- Import/export works for existing JSON
- Validation errors are accurate and actionable
- Docs updated and reflect current reality
- Release notes updated

---

## 8) Mandatory PR Notes Template

Include in your PR description:
- User story
- Schema impact (versions)
- Registry impact
- UI impact
- Validation impact
- Migration strategy
- Demo steps (how to verify)

