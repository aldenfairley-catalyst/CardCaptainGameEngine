# AI-TEST-AND-CICD-DIAGNOSTICS-REGISTRY
Version: CJ Docs 1.0 • Updated: 2025-12-25

This document lists CI/CD diagnostics steps, what problems they detect, and where they are implemented.
Goal: when CI breaks, the logs should already contain enough evidence to fix the issue without guesswork.

## Diagnostics Catalog

| Diagnostic ID | Name | Where | Command(s) | Purpose | Typical Failures Caught | Notes |
|---|---|---|---|---|---|---|
| DIAG-001 | Environment baseline | `.github/workflows/ci.yml` | `pwd`, `ls -la`, `node -v`, `npm -v` | Confirm runner context, versions, and repo checkout | Wrong directory, unexpected Node version, missing files | Keep early in pipeline |
| DIAG-002 | Lockfile detection | `ci.yml`, `deploy-pages.yml`, `scripts/ci-preflight.mjs` | `find ... package-lock.json ...` | Determine deterministic vs non-deterministic install strategy | Missing lockfile causing `setup-node` cache errors; hard-to-reproduce builds | Recommended: commit `package-lock.json` |
| DIAG-003 | Dependency snapshot | `ci.yml` | `npm ls wa-sqlite` (and other critical deps later) | Confirm the resolved dependency version in CI | Version drift between local and CI | Add other “core deps” over time |
| DIAG-004 | Source excerpt around known failure hot-zones | `ci.yml` | `nl -ba src/lib/storage.ts | sed -n '260,340p'` | Print the exact code near a failing TS line number | TypeScript arity/type errors, accidental bad characters | Tune the line window per failure |
| DIAG-005 | TS compiler identity | `ci.yml` | `npx tsc -v` | Confirm compiler version | Subtle TS differences causing build failures | Useful when upgrading TS |

## Policy

1. If a pipeline failure happens twice with unclear root cause, add/expand diagnostics.
2. Keep diagnostics steps fast (prefer `ls`, `nl`, `npm ls` over heavy tooling).
3. Diagnostics should never leak secrets (do not print env vars wholesale).
4. Once stable: reduce log noise, but keep DIAG-001 and DIAG-002 permanently.

## Recommended Next Additions

- A “Vite base path check” that prints `vite.config.ts` and ensures `base` is set correctly for GitHub Pages.
- A “dist sanity check” after build: `ls -la dist` and verify `index.html` exists.
