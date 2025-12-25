# RELEASE_NOTES.md

AI agents must update this file on every pull request.

---

## CJ Forge Release 0.1.0
**Date:** 2025-12-24

### Added
- Card List screen (create/import/export/delete)
- Card Edit screen (metadata + actions list + link to Graph Editor)
- Action Graph editor with explicit execution + data wires
- Minimal runtime: listener → spawn emoji → animate → remove
- wa-sqlite persistence via IDBFS (best-effort)
- GitHub Pages deploy workflow

### Changed
- N/A

### Fixed
- N/A

### Schema
- Card schema: `CJ-0.1`
- Graph schema: `CJ-GRAPH-0.1`
- Migrations: none (new)

### Registry
- Node catalog implemented in `src/lib/nodeCatalog.ts`

### Compatibility Notes
- Imports supported: `CJ-0.1` (no migrations yet)
- Breaking changes: none

### Known Issues
- wa-sqlite persistence depends on browser support for IndexedDB; if unavailable, the app falls back to non-persistent mode.
- Graph runtime is intentionally minimal; only a small node subset executes.
