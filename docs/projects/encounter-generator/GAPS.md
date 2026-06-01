# Encounter Generator Gaps

Status: active
Last updated: 2026-05-31

Use this file for durable unresolved findings that belong directly to encounter generation in this project.

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker | Found during | Gap | Evidence | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G1 | not_started | adjacent_follow_up | Worker B | `TRACKER.md` | docs update pass | Seedability is missing for encounter generation | `src/utils/world/bestiaryEncounterGenerator.ts`, `src/services/gemini/encounters.ts`, `src/services/geminiServiceFallback.ts`, `src/components/Combat/EncounterModal.tsx` | Replays cannot be reproduced across sessions when debugging, balancing, or sharing results | Design seeded generation contract and wire through AI/custom/bestiary paths | Manual deterministic run test with a fixed seed input |
| G2 | not_started | in_scope_now | Worker B | `TRACKER.md` | docs update pass | Difficulty rule ambiguity between AI, custom, and bestiary flows | `src/utils/combat/encounterDifficulty.ts`, `src/components/Combat/EncounterModal.tsx` | Players can see inconsistent challenge labels or unexpected combat scaling | Define a single difficulty policy and validate each generation path against it | Difficulty acceptance test covering Easy/Medium/Hard/Deadly across source types |
| G3 | waiting | support_needed_now | Worker B | `TRACKER.md` | docs update pass | Existing feature naming suggests a fuller EncounterGenerator subsystem than currently implemented | `docs/projects/PROJECT_TRACKER.md`, `src/components/EncounterGenerator/PartyManager.tsx` | Scope can drift between registry intent and runtime reality | Record a scope decision before refactors split ownership | Project owner decision and scope note in NORTH_STAR.md |

## Classification Reference

- `in_scope_now`: Must be resolved for current feature completion.
- `support_needed_now`: Needed to progress safely but not core to MVP implementation.
- `adjacent_follow_up`: Related and useful, but not required in current pass.
- `out_of_scope`: Explicitly excluded.
- `blocked_human_decision`: Requires owner/product decision.
- `blocked_external_state`: Waiting on external dependency.

