# Crafting System Runbook

Status: active
Last updated: 2026-06-09

## Resume Steps

1. Read `docs/projects/crafting/NORTH_STAR.md`.
2. Read `docs/projects/crafting/TRACKER.md`.
3. Read `docs/projects/crafting/GAPS.md`.
4. G1 compatibility proof is closed; do not reopen it unless a new evidence-backed migration slice appears.
5. Do not advance G5 until Refining/Enchanting UI placement is decided.

## Verification

- Focused compatibility proof: `npm exec vitest run src/systems/crafting/__tests__/craftingCompatibility.test.ts`
- Living-project audit: `node scripts/audit-living-project-docs.cjs`
- Whitespace check: `git diff --check -- src/systems/crafting/__tests__/craftingCompatibility.test.ts docs/projects/crafting docs/projects/PROJECT_TRACKER.md`
