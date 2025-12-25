# API_SPEC.md

Updated: **2025-12-24 08:30 UTC** • Target: **CJ Forge 0.1.x**

This specification defines the CRUD API surface for:
- Cards
- Graphs
- Decks (planned)
- Scenarios (planned)
- Game runtime sessions (planned)

> **POC note:** the current app runs on GitHub Pages and uses **in-browser SQLite** via wa-sqlite. The "API" is a client library (`src/lib/storage.ts`). This doc also defines the **future server HTTP API** so we can move to a multi-user hosted architecture without rewriting clients.

---

## Conventions

- JSON bodies are UTF-8
- IDs are URL-safe strings (we use `nanoid` in the UI)
- Times are ISO timestamps (`2025-12-24T08:30:00Z`)
- Errors use the following envelope:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human readable summary",
    "details": { "field": "...", "hint": "..." }
  }
}
```

---

## Health route

### `GET /health`
Returns an "OK" and the server version.

**Response 200**
```json
{ "ok": true, "service": "cj-forge", "version": "0.1.0" }
```

---

## Meta routes

### `GET /meta/schemas`
Returns supported schema versions.

**Response 200**
```json
{
  "card": ["CJ-0.1"],
  "graph": ["CJ-GRAPH-0.1"],
  "deck": [],
  "scenario": []
}
```

---

## Validate routes

### `POST /validate/card`
Validate a card JSON blob.

### `POST /validate/graph`
Validate a graph JSON blob.

---

## Cards routes

### `GET /cards`
List cards.

**Response 200**
```json
{
  "items": [
    { "cardId": "card_123", "name": "My Card", "updatedAt": "..." }
  ]
}
```

### `GET /cards/:cardId`
Get a full card.

### `POST /cards`
Create a card.

### `PUT /cards/:cardId`
Replace a card.

### `DELETE /cards/:cardId`
Delete a card.

---

## Graph routes

### `GET /graphs`
List graphs.

### `GET /graphs/:graphId`
Get a full graph.

### `POST /graphs`
Create a graph.

### `PUT /graphs/:graphId`
Replace a graph.

### `DELETE /graphs/:graphId`
Delete a graph.

---

## Deck routes (planned)

### `GET /decks`
### `GET /decks/:deckId`
### `POST /decks`
### `PUT /decks/:deckId`
### `DELETE /decks/:deckId`

---

## Scenario routes (planned)

### `GET /scenarios`
### `GET /scenarios/:scenarioId`
### `POST /scenarios`
### `PUT /scenarios/:scenarioId`
### `DELETE /scenarios/:scenarioId`

---

## Game routes (planned)

### `POST /games`
Create a game session.

### `GET /games/:gameId`
Get session state.

### `POST /games/:gameId/events`
Submit a player event.

---

## Networking / Multiplayer routes (planned)

### `GET /ws`
WebSocket upgrade entrypoint.

---

## Assets routes (planned)

### `GET /assets/cards/:cardId/art`
### `POST /assets/upload`

---

## Proxy Server Wiring (planned)

When the client runs on GitHub Pages, direct calls to AI APIs will hit CORS and key-leak issues.

**Approach:**
- Local dev uses a small Node proxy (`/proxy`) that:
  - reads the API key from env
  - adds authentication headers
  - forwards to the AI provider

---

## Schema definition

Canonical TS types live in:
- `src/lib/types.ts`

Runtime validation is planned for:
- `src/lib/schemas.ts` (future)

---

## Documentation Updates (mandatory)

If you change any route or payload shape, update:
- `API_SPEC.md`
- `AGENT_API_IMPLEMENTATION_GUIDE.md`
- `AI_JSON_GUIDE.md`
- `RELEASE_NOTES.md`
