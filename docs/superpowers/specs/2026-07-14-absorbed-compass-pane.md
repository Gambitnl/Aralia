# Compass Pane Absorption Spec

Absorbed 2026-07-14 from `docs/projects/compass-pane/`.

## Purpose

Compass Pane is the player movement and orientation control UI for exploration workflows. Implements 8-direction movement grid, look-around action, pass-time modal, and view toggles (world map, submap, 3D).

## Navigation Affordance Rules (T3)

Context-aware toggle visibility — proven in `src/components/CompassPane/__tests__/CompassPane.test.tsx`:

| Context | Map Toggle | Submap Toggle | 3D Toggle |
|---|---|---|---|
| GameLayout (main exploration) | ✅ Visible | ✅ Visible | ✅ Visible |
| SubmapPane (submap modal) | ✅ Visible | ❌ Hidden | ❌ Hidden |

**Rationale**: World map provides global context from submap; submap/3D toggles are redundant when user is already inside submap view.

## UI Pre-check Contract (G3)

CompassPane pre-checks only what it can verify from props:
- Global `disabled` flag → disable all controls
- Current world location vs `mapData.gridSize` → disable out-of-bounds directions  
- Adjacent world tile biome passability → disable impassable directions

**Handler ownership**: `handleMovement` owns submap terrain validation and messaging. In-bounds submap moves remain enabled in UI.

## File Map

| File | Role |
|---|---|
| `src/components/CompassPane/index.tsx` | Navigation UI, movement disable logic, action dispatch, pass-time modal wiring |
| `src/components/CompassPane/__tests__/CompassPane.test.tsx` | Regression coverage: move/look-around dispatch, edge disablement, context-aware toggles, pass-time confirmation |
| `src/hooks/actions/handleMovement.ts` | Movement contract: submap/world movement, bounds, tile validation, time advance |
| `src/hooks/actions/handleObservation.ts` | Look-around descriptions |
| `src/hooks/actions/handleSystemAndUi.ts` | Map/submap/3D toggle handlers |

## Cold-Start Path

1. Read NORTH_STAR.md for full project scope and file map
2. Review the navigation affordance rules and UI pre-check contract above
3. Run `npm exec vitest run src/components/CompassPane/__tests__/CompassPane.test.tsx` to verify all 8 tests pass
4. For new Compass Pane work: read the existing test suite to understand regression coverage, then propose changes against proven affordance rules
