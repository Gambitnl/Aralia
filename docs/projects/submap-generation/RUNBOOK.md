# Submap Generation Runbook

Status: merged-reference
Last updated: 2026-06-09

## Resume Steps

1. Read `NORTH_STAR.md` for scope, source-backed contract, and current
   merged-reference status.
2. Read `TRACKER.md` for the open task queue and next proof target.
3. Read `GAPS.md` for the active gap list and classifications.
4. Check `src/hooks/useSubmapProceduralData.ts` plus the two live consumers:
   `src/components/Submap/SubmapPane.tsx` and `src/components/Minimap.tsx`.
5. Keep `src/components/Submap/submapVisuals.ts` and
   `src/components/Submap/useSubmapGrid.ts` aligned with the contract fields.
6. Preserve the `adjacentBiomeIds` note as generation-extraction evidence.
7. Assign active generation extraction through `docs/projects/submap/` G4.
8. Do not assign this project separately.

## Verification

- Run `node scripts/audit-living-project-docs.cjs`.
- Run `git diff --check`.
- If the contract changes, refresh `AUDIT_OR_PROOF.md` and the North Star
  snapshot before ending the pass.
- If Submap G4 adopts, extracts, or retires the adjacency thread, refresh this
  proof note as historical evidence.

## Notes

The runbook stays intentionally narrow. It is a handoff aid, not a substitute
for the live tracker or gap registry.
