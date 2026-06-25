# Submap Runbook

Status: active
Last updated: 2026-06-10

## Before Any Future Work

1. Read `NORTH_STAR.md`, especially the dependent-system inventory and Open
   Architecture Questions.
2. Read `DEPENDENCY_CONTRACT.md`.
3. Accept only extraction/inventory/proof work. Do not accept deletion,
   renderer replacement, or broad UI removal work.

## Review-Gated Rule

Do not delete, replace, or bypass the DOM/tile Submap surface while extraction
is incomplete. Safe work includes dependent-system inventory, modularization
plans, small retained-function extraction with proof, and reviewer-facing proof
capture.

## After The Decision

1. Record the replacement owner and chosen renderer authority in
   `DECISIONS.md`.
2. Update `NORTH_STAR.md`, `TRACKER.md`, `GAPS.md`, and
   `COLD_START_AGENT_PROMPT.md`.
3. Run a focused proof comparing:
   - one `QUICK_TRAVEL` payload from `SubmapPane` to `handleQuickTravel`
   - one `inspect_submap_tile` payload from `SubmapPane` to
     `handleInspectSubmapTile`
4. Keep world `MapData` and combat `BattleMapData` contracts separate unless a
   dedicated migration plan proves a replacement.

## Current Extraction Targets

- Wire `SubmapPane` through `src/utils/spatial/submapActionContracts.ts` (G7).
- Extract `generateLocalTerrainData` per `GAPS.md` G4/G8 (the retired generation-modularization plan is imported there).
- Action menu and compass local movement affordances.
- `getSubmapTileInfo` / material and terrain lookup behavior.
- `submapVisuals`, `useSubmapGrid`, and painter-path reusable visual semantics.
- Town/village generation overlap with seeded village features.
- Dungeon puzzle/lock/mechanism expectations.

## Verification Commands

```text
npx vitest run src/utils/spatial/__tests__/submapActionContracts.test.ts
git diff --check
```
