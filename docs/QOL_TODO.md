# Aralia Quality-Of-Life Backlog

**Last Updated**: 2026-03-11  
**Purpose**: Track quality-of-life, polish, and technical refinement tasks that are useful but are not the same thing as primary feature delivery.

## How This File Differs From `FEATURES_TODO.md`

Use this file for:
- polish work
- consistency cleanups
- QA and accessibility improvements
- incremental technical refinements

Use [`FEATURES_TODO.md`](./FEATURES_TODO.md) for larger feature-delivery backlog items.

## Pending

- [ ] Audit ad-hoc buttons and migrate them toward shared button helpers or a common button component. (`src/styles/buttonStyles.ts`)
- [ ] Exercise tooltip edge and corner placements, then refine margin or flip rules if clipping persists. (`src/components/ui/Tooltip.tsx`)
- [ ] Profile callback dependencies in `App`, `useGameActions`, and `useGameInitialization` if re-render hotspots appear. (`src/App.tsx`)
- [ ] Add lifecycle diagrams for `useGameInitialization`, `useGameActions`, `useBattleMap`, and `useAudio`. (`src/hooks/useGameInitialization.README.md`)
- [ ] Document the styling source of truth more clearly across the current CSS surfaces. (`docs/@DOCUMENTATION-GUIDE.md`)
- [ ] Add cross-browser QA checklist guidance. (`docs/DEVELOPMENT_GUIDE.md`)
- [ ] Add mobile-responsiveness QA checklist guidance. (`docs/DEVELOPMENT_GUIDE.md`)
- [ ] Add console-error cleanup checklist guidance for core flows. (`docs/DEVELOPMENT_GUIDE.md`)
- [ ] Add automated accessibility coverage for focus-trap and keyboard-navigation behavior in save-slot flows. (`src/components/SaveSlotSelector.tsx`)
- [x] Cache `findBuildingAt` results by tile coordinate while the village layout is stable. (`src/components/VillageScene.tsx`)
- [ ] Add on-canvas affordances that surface `integrationTagline` before click. (`src/components/VillageScene.tsx`)
- [ ] Expand biome-specific village profiles so each biome has more distinct hooks and flavor. (`src/data/villagePersonalityProfiles.ts`)
- [ ] Derive the UI toggle list in `useGameActions` from a shared action registry to reduce drift. (`src/hooks/useGameActions.ts`)

## Recently Completed

These are kept here as short-term context and can be demoted later if they no longer help active backlog reading:

- [x] Type the action-handler registry against `Action['type']` with exhaustive coverage checks.
- [x] Validate merchant action payloads before dispatch.
- [x] Replace label-based custom action branching with explicit action types and config.

## Related Docs

- [`FEATURES_TODO.md`](./FEATURES_TODO.md) for broader feature backlog items
- [`DEVELOPMENT_GUIDE.md`](./DEVELOPMENT_GUIDE.md) for developer workflow guidance
