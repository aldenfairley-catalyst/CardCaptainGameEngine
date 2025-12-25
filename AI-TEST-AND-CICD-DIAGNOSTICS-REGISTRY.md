# AI Test and CI/CD Diagnostics Registry
Version: CJ Docs 1.0 • Updated: 2025-12-25 00:00

This is a living registry of automated tests, CI checks, and diagnostic steps used in CardCaptainGameEngine.
Agents must update this doc when changing workflows, build scripts, tests, or diagnostics.

## Non-negotiables
1. CI fails fast with actionable logs.
2. Deploy does not depend on lockfiles unless explicitly enforced.
3. Typecheck runs in CI for every PR (or equivalent validation).
4. Diagnostics must reveal Node/npm versions, working directory, lockfiles, and critical deps (wa-sqlite).

## Workflows

| Workflow | File | Trigger | Purpose |
|---|---|---|---|
| Pages Deploy | `.github/workflows/deploy-pages.yml` | push to main, manual | Build + deploy GitHub Pages |
| CI | `.github/workflows/ci.yml` | PR + non-main pushes, manual | Build/test validation without deploy |

## Required pipeline phases

| Phase | Command/Step | Goal | Typical Failures |
|---|---|---|---|
| Preflight | `node scripts/ci-preflight.mjs` | Confirm correct repo layout + lockfile detection | wrong working dir, missing package.json |
| Install | `npm ci` (if lockfile) else `npm install` | Get deterministic deps when possible | lockfile mismatch, network failures |
| Typecheck | `tsc -p tsconfig.json --noEmit` | Catch TS errors early | invalid TSX, typing mismatches |
| Build | `vite build` | Confirm production build works | asset base path, bundler issues |
| Test | `npm run test --if-present` | Catch runtime regressions | missing deps, failing unit tests |

## Diagnostics catalog

### D-001 Lockfile missing but cache enabled
Symptom:
- `Dependencies lock file is not found...`
Fix:
- Remove `cache: npm` OR commit `package-lock.json` OR set `cache-dependency-path`.

### D-002 TSX invalid character
Symptom:
- TS1127/TS1381/TS1382
Cause:
- Incorrect escaping inside TSX attribute strings.
Fix:
- Use expression strings: `placeholder={'{...}'}`.

### D-003 wa-sqlite signature mismatch
Symptom:
- TS2554 “Expected 0-1 arguments, got 2”
Cause:
- wa-sqlite builds differ in typed API shape (db handle vs db object methods).
Fix:
- Route calls through compatibility wrappers using `any`, try both call shapes.

## How to add new tests/diagnostics
1. Add the workflow step or npm script.
2. Ensure it runs on PR CI (preferred).
3. Document it here (tables + a new diagnostic entry if it’s new failure mode).
