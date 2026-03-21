# Spell Engine Gap Registry

> **Status Note (2026-03-11):**
> - this file is a convention-level registry for tracking unresolved spell-engine limitations during migration work
> - it should not be read as proof that every listed gap is still fully unsolved at runtime
> - current validator support already exists for some related schema fields such as `savePenalty`, `on_target_move`, `on_enter_area`, and `on_attack_hit`
> - if a migration task relies on one of these codes, re-verify the specific runtime behavior against current code before treating the gap as still open

This file defines the standard codes for bundled gaps in the D&D 5e / PHB 2024 spell engine. These codes are intended for migration notes, gap logs, and optional structured metadata where a gap-tracking field exists.

## Engine/Behavior Gaps

### Core Combat
- `ENG_REACTION_TRIGGER`: The engine lacks plumbing for these specific reaction triggers (e.g., "when targeted," "when hit").
- `ENG_CONCENTRATION_RETARGET`: Lacks support for swapping the target of a concentration spell (e.g., *Hex*, *Hunter's Mark*).
- `ENG_SAVE_PENALTY_MODIFIER`: Runtime/application support for persistent save penalties still needs verification even though validator/schema support now exists for `savePenalty` data.

### Area & Persistence
- `ENG_AREA_TICK_TURN`: Treat turn-start/turn-end area ticking as a runtime re-verification point even though schema support exists for those trigger concepts.
- `ENG_AREA_TICK_ENTER`: Treat first-entry area damage as a runtime re-verification point even though schema support exists for `on_enter_area`.
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
- `TODO_MECHANICS`: Documentation-only catch-all for complex riders mentioned in `_todo` strings or similar notes; do not assume this code is schema-backed unless the target surface explicitly supports it.
