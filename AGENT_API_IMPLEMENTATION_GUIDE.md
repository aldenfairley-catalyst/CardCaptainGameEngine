# AGENT_API_IMPLEMENTATION_GUIDE.md

Updated: **2025-12-24 08:30 UTC** • Target: **CJ Forge POC 0.1.x**

This document is the **implementation guide** for the CRUD API (current in-browser API + future server API). It is written for agents who need to add endpoints, align schema validation, and update docs consistently.

---

## Route Implementation

> **POC reality (today):** routes are implemented as **TypeScript service functions** in `src/lib/storage.ts` (SQLite via wa-sqlite + IDBFS). There is **no HTTP server** in GitHub Pages.
>
> **Near-future (local server):** we will add a minimal Node server to expose HTTP endpoints using the same request/response shapes as in `API_SPEC.md`.

### Health route
- **Server:** `GET /api/health`
- **Returns:** build + schema versions + migrations applied

### Meta routes
- `GET /api/meta/versions`
- `GET /api/meta/node-catalog`
- `GET /api/meta/schemas`

### Validate routes
- `POST /api/validate/card`
- `POST /api/validate/graph`
- `POST /api/validate/deck`
- `POST /api/validate/scenario`

### Cards routes
- `GET /api/cards`
- `POST /api/cards`
- `GET /api/cards/:cardId`
- `PUT /api/cards/:cardId`
- `DELETE /api/cards/:cardId`
- `POST /api/cards/import`

### Graph routes
- `GET /api/graphs`
- `POST /api/graphs`
- `GET /api/graphs/:graphId`
- `PUT /api/graphs/:graphId`
- `DELETE /api/graphs/:graphId`
- `POST /api/graphs/import`

### Deck routes (planned)
- `GET /api/decks` ...

### Scenario routes (planned)
- `GET /api/scenarios` ...

### Game routes (planned)
- `POST /api/game/start`
- `POST /api/game/step`
- `POST /api/game/sync`

### Networking / Multiplayer routes (planned)
- `WS /ws` (authoritative server)

### Assets routes (planned)
- `POST /api/assets/upload`
- `GET /api/assets/:id`

### Proxy Server Wiring (planned)
- A dedicated proxy service will handle external tool/API calls so the client never stores API keys.

---

## Schema definition
- Canonical TS types live in `src/lib/types.ts`
- Canonical JSON docs live in `AI_JSON_GUIDE.md`

---

## Documentation Updates (mandatory)
If you touch *anything* in the API:
1. Update `API_SPEC.md`
2. Update `AI_JSON_GUIDE.md` if any payload shape changes
3. Update `AI_DIRECTORY_GUIDE.md` if files/routes change
4. Add a release note entry in `RELEASE_NOTES.md`
