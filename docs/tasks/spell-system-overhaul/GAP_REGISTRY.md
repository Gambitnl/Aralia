# Spell Engine Gap Registry

This file defines the standard codes for "Bundled Gaps" in the D&D 5e / PHB 2024 spell engine. These codes are used in the `gapAnalysis.gaps` field of spell JSONs to track mechanical implementation progress.

## Engine/Behavior Gaps

### Core Combat
- `ENG_REACTION_TRIGGER`: The engine lacks plumbing for these specific reaction triggers (e.g., "when targeted," "when hit").
- `ENG_CONCENTRATION_RETARGET`: Lacks support for swapping the target of a concentration spell (e.g., *Hex*, *Hunter's Mark*).
- `ENG_SAVE_PENALTY_MODIFIER`: Lacks a system to apply persistent penalties to saving throws (e.g., *Mind Sliver*).

### Area & Persistence
- `ENG_AREA_TICK_TURN`: Area damage does not trigger correctly on turn start/end within the zone.
- `ENG_AREA_TICK_ENTER`: Area damage does not trigger correctly when a creature first enters the zone on a turn.
- `ENG_AREA_PERSIST_MOVE`: Persisting areas (e.g., *Cloud of Daggers*) do not correctly follow move/teleport logic.

### Behavior & AI
- `ENG_BEHAVIOR_RESTRICTION`: The engine cannot enforce "must approach," "must flee," or "cannot move toward" logic for AI.
- `ENG_BEHAVIOR_CHARM`: Proper "Neutral/Friendly" state for Charmed creatures is not handled in targeting.
- `ENG_BEHAVIOR_REDIRECT`: Lacks support for re-targeting an attack (e.g., *Sanctuary*).

### Summons & Entities
- `ENG_SUMMON_INITIATIVE`: Summons do not correctly share or insert into the initiative order.
- `ENG_SUMMON_SENSES`: Shared senses/telepathy with summons is not implemented in the UI/POV.

### Utility & Exploration
- `ENG_RITUAL_FLOW`: No UI support for identifying or performing ritual casting time.
- `ENG_ITEM_CONSUMPTION`: Component costs/item-spending is not enforced in the casting flow.

## Legacy Gaps
- `LEGACY_FORMAT`: The spell is in an old JSON format and lacks structural fidelity.
- `TODO_MECHANICS`: General catch-all for complex riders mentioned in `_todo` strings.
