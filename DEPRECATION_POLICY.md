# DEPRECATION_POLICY.md

Updated: **2025-12-24 08:30 UTC**

Schema and registry are expected to evolve. This policy keeps old content working.

## Rules

1. **Never silently break imports.**
2. If you rename a node type, keep an alias mapping in migration code.
3. If you remove fields, they must either:
   - be migrated to new fields, or
   - be preserved under `meta.legacy`.
4. Deprecations must be documented in `RELEASE_NOTES.md`.

## Deprecation lifecycle

| Stage | Meaning | Editor behavior | Runtime behavior |
|---|---|---|---|
| Active | Fully supported | Normal | Normal |
| Deprecated | Still supported; avoid for new content | Show warning badge | Normal |
| Removed | No longer supported without migration | Hidden from palette | Import must migrate or error |
