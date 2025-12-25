import fs from "node:fs";

const required = ["package.json"];
for (const f of required) {
  if (!fs.existsSync(f)) {
    console.error(`[preflight] Missing ${f} in repo root. Are you building from the correct directory?`);
    process.exit(1);
  }
}

const hasLock =
  fs.existsSync("package-lock.json") ||
  fs.existsSync("npm-shrinkwrap.json") ||
  fs.existsSync("yarn.lock") ||
  fs.existsSync("pnpm-lock.yaml");

console.log(`[preflight] lockfile present: ${hasLock}`);

if (!hasLock) {
  console.warn("[preflight] No lockfile found. CI will use `npm install` (non-deterministic). Consider committing package-lock.json.");
}
