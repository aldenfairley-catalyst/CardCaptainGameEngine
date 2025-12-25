# AI Test and CI/CD Diagnostics Registry
Version: CJ Docs 1.0 • Updated: 2025-12-25 00:00

This is a living registry of all automated tests, CI checks, and diagnostic steps used in the CJ Forge / CardCaptainGameEngine repo.
Agents must update this doc whenever they add, remove, or materially change:
- GitHub Actions workflows
- npm scripts used by CI
- test suites, lint rules, typecheck rules
- diagnostic steps (preflight, environment info, dependency introspection)

## Non-negotiables
1. CI must fail fast with actionable output (not silent “something broke”).
2. Deploy workflows must never depend on a missing lockfile unless explicitly required.
3. Typecheck must run in CI for every PR (or equivalent validation must exist).
4. Diagnostics must help identify: working directory, lockfiles, Node/npm versions, and key deps (wa-sqlite).

## Registry: Workflows

| Workflow File | Trigger | Purpose | Fails On | Produces |
|---|---|---|---|---|
| .github/workflows/deploy-pages.yml | push to main, manual | Build + deploy to GitHub Pages | Typecheck, build errors | dist artifact + deployed site |
| .github/workflows/ci.yml | PR, push (non-main), manual | Validate build on changes without deploy | Typecheck/build/test errors | logs |

## Registry: Required CI Steps

| Step Name | Where | Why it exists | Command/Implementation | Expected Output |
|---|---|---|---|---|
| Checkout | all workflows | get code | actions/checkout | repo available |
| Setup Node | all workflows | consistent Node version | actions/setup-node | node installed |
| CI Preflight | all workflows | fail early if repo layout is wrong | `node scripts/ci-preflight.mjs` | confirms package.json + lockfile presence |
| Install | all workflows | install deps | `npm ci` if lockfile else `npm install` | node_modules ready |
| Diagnostics: deps | optional | debug dependency problems | `npm ls wa-sqlite` etc | version visibility |
| Typecheck | build step | prevent TS regressions | `tsc -p tsconfig.json --noEmit` | TS validation |
| Lint | optional | catch common issues | `npm run lint --if-present` | lint report |
| Tests | optional | verify runtime logic | `npm run test --if-present` | test report |
| Build | deploy + CI | ensure production build passes | `vite build` | dist/ created |

## Registry: npm Scripts (expected)

| Script | Purpose | Used in CI | Notes |
|---|---|---:|---|
| build | typecheck + vite build | Yes | must be deterministic |
| test | run tests | If present | should be fast |
| lint | lint code | If present | should be fast |
| dev | local dev server | No | optional |

## Diagnostics Catalog

### D-001: “No lockfile found” / setup-node cache error
Symptoms:
- `Error: Dependencies lock file is not found...`
Root cause:
- setup-node configured with `cache: npm` but no lockfile committed at expected location
Fix:
- Remove caching OR commit lockfile OR use correct cache-dependency-path for monorepos

### D-002: TypeScript “Invalid character” in TSX
Symptoms:
- TS1127, TS1381, TS1382 in a TSX file
Root cause:
- invalid JSX attribute string escaping (e.g., `placeholder="\"stuff\""` in TSX)
Fix:
- Use expression form: `placeholder={'{"x":1}'}`

### D-003: wa-sqlite type mismatch / exec signature mismatch
Symptoms:
- TS2305 missing exported members, TS2554 wrong arg count on sqlite calls
Root cause:
- wa-sqlite type surface differs between package builds/versions
Fix:
- Avoid relying on typed `exec(db, sql)`; use prepared statement flow:
  - `statements(db, sql) → bind_collection → step → finalize`
- Keep sqlite handle typed as `any` in POC

## How agents should add new tests/diagnostics
1. Add the script or workflow step.
2. Ensure it runs in CI (PR validation or deploy workflow).
3. Update this registry:
   - Workflow table
   - Required steps table
   - Diagnostics catalog entry if it covers a new failure mode

## Definition of Done for CI/CD changes
- Workflow passes on a clean clone
- Clear logs for:
  - node/npm versions
  - lockfile detection
  - key dependency versions (wa-sqlite)
- Build artifact exists (dist/) for Pages deploy
- Docs updated (this file + release notes if relevant)
