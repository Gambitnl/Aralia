# Aralia RPG - Feature TODO List

This file tracks **active** planned features, enhancements, and tasks for the Aralia RPG project.

---

## 📋 Workflow: Managing Completed TODOs

### When to Archive a TODO

TODOs are moved from this file to [archive/@FEATURES-COMPLETED.md](./archive/@FEATURES-COMPLETED.md) when:

1. **Standalone Task Complete**: A single, independent task is marked `[DONE]` and has no dependencies
2. **Project Fully Complete**: ALL sub-tasks within a larger project group are marked `[DONE]`

### When to Keep a TODO Here

TODOs remain in this file when:

1. **Partially Complete Projects**: Some sub-tasks are `[DONE]` but others remain `[TODO]` or `[PARTIALLY DONE]`
   - Example: Combat System has 4 items done but 1 still in progress
   - Keep all sub-items together until the entire project is complete
2. **Active Work**: Any task currently being worked on or planned for near-term implementation
3. **Dependencies**: Tasks that are complete but blocked waiting for dependent work

### Status Markers

*   `[TODO]` - Not yet started
*   `[PARTIALLY DONE]` - In progress, significant work remaining
*   `[ONGOING]` - Continuous improvement task with no clear end state
*   `[PAUSED]` - Temporarily suspended (include reason)
*   `[DONE]` - Completed (will be archived per rules above)

---

## Pending

### Core Gameplay Systems
- [ ] Expand spell-to-ability translation coverage for more spells and effects. (`src/utils/spellAbilityFactory.ts:18`)
- [ ] Add NPC quest-giver hooks for quest offers/updates via dialogue. (`src/hooks/actions/handleNpcInteraction.ts:63`)
- [ ] Replace hardcoded location quest triggers with data-driven metadata. (`src/hooks/actions/handleMovement.ts:133`)
- [ ] Replace hardcoded item quest triggers with data-driven metadata. (`src/hooks/actions/handleItemInteraction.ts:67`)
- [ ] Add party recruitment/leave actions tied to gameplay (NPC join/leave flow). (`src/state/reducers/characterReducer.ts:28`)
- [ ] Add level-up UI flows for ASI/feat/spell choices. (`src/state/reducers/characterReducer.ts:325`)
- [ ] Grant class abilities/spells on level-up and persist spellbook updates. (`src/utils/characterUtils.ts:673`)
- [ ] Add selectableSkillCount UI/validation in feat selection. (`src/components/CharacterCreator/FeatSelection.tsx:194`)
- [ ] Implement Resilient ability selection and save proficiency logic. (`src/data/feats/featsData.ts:115`)
- [ ] Implement Skilled skill selection UI. (`src/data/feats/featsData.ts:127`)
- [ ] Implement Tavern Brawler selection and unarmed/improvised mechanics. (`src/data/feats/featsData.ts:190`)
- [ ] Implement Elemental Adept damage type selection and resistance rules. (`src/data/feats/featsData.ts:229`)
- [x] ~~Implement Slasher selection and speed/crit mechanics.~~ [DONE - Combat mechanics complete: once-per-turn speed reduction, crit disadvantage via ActiveEffect]
- [ ] Implement feat skill selection UI contracts in types. (`src/types/character.ts:261`)
- [ ] Implement feat damage type selection UI contracts in types. (`src/types/character.ts:269`)
- [ ] Route dice rolls through secure or server-validated RNG. (`src/utils/combatUtils.ts:70`)
- [ ] Extend combat AI to support allied party member tactics. (`src/utils/combat/combatAI.ts:45`)
- [ ] Persist AoE reachability/impact caches per turn. (`src/utils/combat/combatAI.ts:394`)

### World & Exploration
- [ ] Replace naive biome clustering with Perlin/cellular generation. (`src/services/mapService.ts:74`)
- [ ] Generate Location metadata for unkeyed tiles and towns during map build. (`src/services/mapService.ts:112`)
- [ ] Emit town metadata alongside village layouts for the description system. (`src/services/villageGenerator.ts:76`)
- [ ] Hook proximity checks into town metadata/description loading. (`src/hooks/actions/handleMovement.ts:390`)
- [ ] Merge quest objectives and discovered location markers into map markers. (`src/utils/locationUtils.ts:64`)
- [ ] Generate POIs procedurally and distribute them across the map. (`src/data/world/pois.ts:15`)
- [ ] Add NPC routines and faction schedules to world events. (`src/hooks/actions/handleWorldEvents.ts:15`)
- [ ] Extend season/time modifiers beyond travel cost and surface them in UI. (`src/utils/timeUtils.ts:131`)

### 3D Exploration & Combat (R3F)
- [ ] See roadmap for full scope and phases. (`docs/tasks/3d-exploration/1A-3D-EXPLORATION-ROADMAP.md`)
- [x] Add 3D exploration modal scaffold with R3F canvas, WASD input, and third-person follow/orbit camera. (`src/components/ThreeDModal/ThreeDModal.tsx`, `src/components/ThreeDModal/CameraRig.tsx`, `src/components/ThreeDModal/PlayerController.tsx`)
- [ ] Implement scene controller + event bridge for React UI actions (spells, combat state, LOS/range queries). (new: `src/components/ThreeDModal/SceneController.ts`, `src/components/ThreeDModal/SceneEvents.ts`)
- [ ] Build outdoor tile generator: 1 unit = 1 ft, ~9000 ft footprint, chunked LOD/instancing, biome-driven terrain/props, atmospheric fog (no hard clip). (PARTIAL: heightfield terrain + instanced props + shader grid live.) (`src/components/ThreeDModal/Terrain.tsx`, `src/components/ThreeDModal/PropsLayer.tsx`, `src/components/ThreeDModal/terrainUtils.ts`)
- [ ] Add time-of-day lighting/fog updates driven by the game clock with throttled lerp. (new: `src/components/ThreeDModal/LightingController.ts`)
- [ ] Combat overlays: 5 ft grid, range shapes (cone/cube/radius/emanation), ruler, and movement distance enforcement. (new: `src/components/ThreeDModal/CombatOverlay.tsx`)
- [ ] Dungeon scene path: CA/WFC-driven layouts, instanced props, and multiple level variants. (new: `src/components/ThreeDModal/DungeonGenerator.ts`)
- [ ] Cache generated tile scenes by seed and add entry toggle from submap/world UI. (new: `src/components/ThreeDModal/SceneCache.ts`, updates to `src/components/Submap/SubmapPane.tsx`)

### AI & Storytelling
- [ ] Improve Gemini storyteller consistency with shared prompt scaffolds. (`src/services/geminiService.ts:64`)

### UI/UX & Audio
- [ ] Add container browsing and item comparison UI in inventory. (`src/components/InventoryList.tsx:32`)
- [ ] Add ambient music and biome-based sound layers. (`src/hooks/useAudio.ts:53`)
- [ ] Add centralized modal focus management and keyboard navigation. (`src/components/layout/GameModals.tsx:54`)
- [ ] Re-enable scene visuals when image generation is viable. (`src/components/ImagePane.tsx:6`)

### Bugs & Performance
- [ ] Guard Pixi init races that cause canvas initialization errors. (`src/components/Submap/SubmapRendererPixi.tsx:196`)
- [ ] Capture/replay turn-order transitions to diagnose combat log anomalies. (`src/hooks/combat/useTurnOrder.ts:91`)

## 📚 See Also

*   **[Completed Features Archive](./archive/@FEATURES-COMPLETED.md)** - All finished features and tasks
*   **[QOL_TODO.md](./QOL_TODO.md)** - Quality of Life improvements and technical debt
*   **[SPELL_INTEGRATION_STATUS.md](./SPELL_INTEGRATION_STATUS.md)** - Spell system migration tracking
*   **[CHANGELOG.md](./CHANGELOG.md)** - Project history and release notes
