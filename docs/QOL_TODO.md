
# Aralia RPG - Quality of Life Improvements & TODO List

This file lists Quality of Life improvements and TODO items identified
from code reviews and feature planning. Each item is rated by urgency/impact and includes a detailed approach.

## Pending
- [ ] Audit ad-hoc buttons and migrate to BTN_* helpers/shared Button for consistent padding/hover/focus. (`src/styles/buttonStyles.ts:6`)
- [ ] Exercise tooltip edge/corner placements and refine margin/flip rules if clipping persists. (`src/components/ui/Tooltip.tsx:30`)
- [ ] Profile callback dependencies in App/useGameActions/useGameInitialization if re-render hotspots appear. (`src/App.tsx:197`)
- [ ] Add lifecycle diagrams for useGameInitialization/useGameActions/useBattleMap/useAudio. (`src/hooks/useGameInitialization.README.md:3`)
- [ ] Document styling source-of-truth (Tailwind vs index.css vs public/styles.css). (`docs/@DOCUMENTATION-GUIDE.md:69`)
- [ ] Add cross-browser testing checklist for QA. (`docs/AGENT.md:13`)
- [ ] Add mobile responsiveness checklist for QA. (`docs/AGENT.md:14`)
- [ ] Add console-error cleanup checklist for core flows. (`docs/AGENT.md:15`)
- [ ] Add automated accessibility tests (axe) for SaveSlotSelector focus trap/keyboard navigation. (`src/components/SaveSlotSelector.tsx:87`)
- [ ] Cache findBuildingAt results by tile coordinate while layout is stable. (`src/components/VillageScene.tsx:132`)
- [ ] Add on-canvas affordances (icons/hover hints) to surface integrationTagline before click. (`src/components/VillageScene.tsx:189`)
- [ ] Expand biome-specific village profiles so each biome has distinct hooks and flavor. (`src/data/villagePersonalityProfiles.ts:22`)
- [ ] Derive UI toggle list in useGameActions from shared action registry to avoid drift. (`src/hooks/useGameActions.ts:74`)
- [x] Type action handler registry against Action['type'] with exhaustive check to catch missing/renamed actions. [DONE - Refactored `actionHandlers.ts` to use `Record<ActionType, ActionHandler>`]
- [x] Validate merchant action payloads (item/cost/value) before dispatch. [DONE - Implemented `validateMerchantTransaction` in `handleMerchantInteraction.ts` and integrated into `actionHandlers.ts`]
- [ ] Replace label-based custom action branching with explicit action types/config. (`src/hooks/actions/actionHandlers.ts:281`)
