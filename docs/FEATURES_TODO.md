# Aralia RPG Feature Backlog

**Last Updated**: 2026-03-11  
**Purpose**: Track active feature-level backlog items that are still relevant to the current repo, while pointing completed work to the archive instead of leaving merge artifacts and stale verification notes in the live backlog.

## How This File Works

This is a live backlog surface for feature work that is still pending or partially complete.

Use it for:
- active feature gaps
- major gameplay and system additions that still need implementation
- cross-system work that is too broad for a local subtree TODO

Do not use it for:
- completed work that already belongs in [`archive/@FEATURES-COMPLETED.md`](./archive/@FEATURES-COMPLETED.md)
- one-off verification notes tied to old PR review passes
- stale merge artifacts or branch-specific audit fragments

## Status Markers

- `[ ]` not started
- `[~]` partially complete or underway
- `[x]` completed and ready to move to the completed-features archive when the surrounding work band is fully settled

## Pending Feature Work

### Core gameplay systems

- [ ] Expand spell-to-ability translation coverage for more spells and effects. (`src/utils/spellAbilityFactory.ts`)
- [ ] Add NPC quest-giver hooks for quest offers and updates through dialogue. (`src/hooks/actions/handleNpcInteraction.ts`)
- [ ] Replace hardcoded location quest triggers with data-driven metadata. (`src/hooks/actions/handleMovement.ts`)
- [ ] Replace hardcoded item quest triggers with data-driven metadata. (`src/hooks/actions/handleItemInteraction.ts`)
- [ ] Add party recruitment and leave actions tied to gameplay. (`src/state/reducers/characterReducer.ts`)
- [ ] Add level-up UI flows for ASI, feat, and spell choices. (`src/state/reducers/characterReducer.ts`)
- [ ] Grant class abilities and spells on level-up and persist spellbook updates. (`src/utils/characterUtils.ts`)
- [ ] Implement remaining feat-selection and feat-effect UI contracts for skill and damage-type choices. (`src/types/character.ts`, `src/data/feats/featsData.ts`)
- [ ] Route dice rolls through secure or server-validated RNG if the project introduces that trust boundary. (`src/utils/combatUtils.ts`)
- [ ] Extend combat AI for allied party-member tactics. (`src/utils/combat/combatAI.ts`)

### World and exploration

- [ ] Replace naive biome clustering with stronger procedural generation. (`src/services/mapService.ts`)
- [ ] Generate location metadata for unkeyed tiles and towns during map build. (`src/services/mapService.ts`)
- [ ] Emit town metadata alongside village layouts for the description system. (`src/services/villageGenerator.ts`)
- [ ] Hook proximity checks into town metadata and description loading. (`src/hooks/actions/handleMovement.ts`)
- [ ] Merge quest objectives and discovered-location markers into map markers. (`src/utils/locationUtils.ts`)
- [ ] Generate world POIs procedurally and distribute them across the map. (`src/data/world/pois.ts`)
- [ ] Add NPC routines and faction schedules to world events. (`src/hooks/actions/handleWorldEvents.ts`)
- [ ] Extend season and time modifiers beyond travel cost and surface them in the UI. (`src/utils/timeUtils.ts`)

### 3D exploration and combat

- [~] 3D exploration modal scaffold exists; the remaining roadmap still lives in [`docs/tasks/3d-exploration/1A-3D-EXPLORATION-ROADMAP.md`](./tasks/3d-exploration/1A-3D-EXPLORATION-ROADMAP.md)
- [ ] Implement the scene controller and event bridge for React UI actions.
- [ ] Build the full outdoor tile generator with chunking, biome-driven props, and cache integration.
- [ ] Add time-of-day lighting and fog updates driven by the game clock.
- [ ] Add combat overlays for range shapes, ruler logic, and movement enforcement.
- [ ] Implement dungeon and town scene-generation paths.
- [ ] Cache generated scenes by seed and wire entry toggles into submap and world UI.

### AI and storytelling

- [ ] Improve Gemini storyteller consistency with shared prompt scaffolds. (`src/services/geminiService.ts`)

### UI, UX, and audio

- [ ] Add inventory container browsing and item comparison UI. (`src/components/InventoryList.tsx`)
- [ ] Add ambient music and biome-based sound layers. (`src/hooks/useAudio.ts`)
- [ ] Add centralized modal focus management and keyboard navigation. (`src/components/layout/GameModals.tsx`)
- [ ] Re-enable scene visuals when image generation is viable again. (`src/components/ImagePane.tsx`)

### Bugs and performance

- [ ] Guard Pixi initialization races that cause canvas setup errors. (`src/components/Submap/SubmapRendererPixi.tsx`)
- [ ] Capture and replay turn-order transitions to diagnose combat-log anomalies. (`src/hooks/combat/useTurnOrder.ts`)

## Recently Completed But Still Referenced

These items are kept visible here only as near-term context and should eventually live only in the completed-features archive:

- [x] Slasher feat selection and speed/crit mechanics. (`src/data/feats/featsData.ts`)
- [x] 3D exploration modal scaffold with R3F canvas, WASD input, and third-person camera. (`src/components/ThreeDModal/`)

## Related Docs

- [`archive/@FEATURES-COMPLETED.md`](./archive/@FEATURES-COMPLETED.md) for archived completed feature work
- [`QOL_TODO.md`](./QOL_TODO.md) for quality-of-life and technical-polish backlog items
- [`SPELL_INTEGRATION_STATUS.md`](./SPELL_INTEGRATION_STATUS.md) for the spell-system status surface
- [`CHANGELOG.md`](./CHANGELOG.md) for historical project change records
