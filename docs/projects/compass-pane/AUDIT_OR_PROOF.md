# Compass Pane Audit And Proof

Last updated: 2026-06-24

This note keeps the durable proof for the movement/action regression slice so
future agents do not have to reconstruct it from chat output.

## Proof Summary

- Verified `move` dispatch from the compass grid.
- Verified `look_around` dispatch from the center action.
- Verified edge disablement for movement at the world boundary while
  `look_around` stays available.
- Verified CompassPane uses `currentLocation.mapCoordinates` for world-boundary
  pre-checks instead of display-only `worldMapCoords`.
- Verified movement into an adjacent impassable world tile is disabled before
  dispatch.
- Verified pass-time confirmation emits a `wait` action with seconds payload.
- Verified main exploration context shows world-map, submap, and 3D toggles.
- Verified submap context keeps world-map access visible and hides submap/3D toggles.
- Verified the restored submap toggle emits `toggle_submap_visibility`.

## Verification Run

```text
npm exec vitest run src/components/CompassPane/__tests__/CompassPane.test.tsx
```

## Source Evidence

- `src/components/CompassPane/index.tsx`
- `src/components/CompassPane/__tests__/CompassPane.test.tsx`
- `src/hooks/actions/actionHandlers.ts`
- `src/hooks/actions/handleMovement.ts`
- `src/hooks/actions/handleObservation.ts`

## Notes

No Required Review Brief was needed for this slice. The affordance decision
work remains tracked separately in `docs/projects/compass-pane/GAPS.md` and
`docs/projects/compass-pane/TRACKER.md`. G3 is closed with the pre-check rule
table in `NORTH_STAR.md` and scoped CompassPane regression tests.

## T5 Documentation Continuity Proof

Date: 2026-06-20

G4 resolved: `src/components/CompassPane/README.md` verified against
`src/components/CompassPane/index.tsx`. Verified items:

- File name: README header references `index.tsx` (not the old `CompassPane.tsx`).
- Props: all 9 props in `CompassPaneProps` interface match the README prop table
  (currentLocation, currentSubMapCoordinates, worldMapCoords, subMapCoords,
  onAction, disabled, mapData, gameTime, isSubmapContext).
- Pass-time modal: README documents `PassTimeModal` integration and `wait` action dispatch.
- Submap context: README documents `isSubmapContext` prop and its effect on toggle visibility.
- Toggle rules: README documents world-map always visible, submap/3D hidden in submap context.
- Imports: README data dependencies match source imports (types, constants, mapConfig,
  TimeWidget, PassTimeModal, Tooltip, UI_ID).

G6 resolved: `src/components/CompassPane/index.tsx` JSDoc header updated from
`@file CompassPane.tsx` to `@file index.tsx` with PassTimeModal and `isSubmapContext`
mentions added.

No source code behavior was changed. All project docs refreshed.

## T6 Context Toggle Proof

Date: 2026-06-24

G5 resolved: `src/components/CompassPane/__tests__/CompassPane.test.tsx` now
proves both documented context rules:

- Main exploration renders the world-map, submap, and 3D toggles.
- Submap context renders only the world-map toggle and hides redundant submap/3D
  controls.
- The restored submap toggle dispatches the existing `toggle_submap_visibility`
  action instead of introducing a new action contract.

The implementation change is limited to `src/components/CompassPane/index.tsx`:
the missing main-context submap button was restored beside the existing world
map and 3D buttons, and it is hidden by the same `isSubmapContext` condition as
the 3D entry.

Verification:

```text
npm exec vitest run src/components/CompassPane/__tests__/CompassPane.test.tsx
```

Result: pass, 8 tests.
