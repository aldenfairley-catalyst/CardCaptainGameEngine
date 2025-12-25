import fs from "node:fs";

const required = ["package.json"];
for (const f of required) {
  if (!fs.existsSync(f)) {
    console.error(
      `[preflight] Missing ${f} in repo root. Are you building from the correct directory?`
    );
    process.exit(1);
  }
}

const lockfiles = [
  "package-lock.json",
  "npm-shrinkwrap.json",
  "yarn.lock",
  "pnpm-lock.yaml",
];

const found = lockfiles.filter((f) => fs.existsSync(f));
console.log(`[preflight] lockfiles found: ${found.length ? found.join(", ") : "(none)"}`);

if (!found.length) {
  console.warn(
    "[preflight] No lockfile found. CI will use `npm install` (non-deterministic). " +
    "Recommended: run `npm install` locally and commit package-lock.json."
  );
}

console.log("[preflight] Node:", process.version);
