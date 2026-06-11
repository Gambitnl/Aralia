# Encounter Generator Living Tracker

Status: review-required
Last updated: 2026-06-09

## Active Task Queue

| ID | Status | Task | Owner | Last updated | Evidence | Next action | Next check |
|---|---|---|---|---|---|---|---|
| T1 | done | Refresh encounter-generator docs with runtime evidence map | Worker B | 2026-05-31 | NORTH_STAR.md | Keep updates limited to project docs | Confirm all three files are consistent and ASCII only |
| T2 | done | Track implemented state and integration points for cold-start handoff | Worker B | 2026-06-09 | `docs/projects/encounter-generator/NORTH_STAR.md`, `docs/projects/encounter-generator/GAPS.md` | Handoff should now be compact and current | Verify tracker, North Star, and gap wording stay aligned |
| T3 | blocked | Close seeded encounter generation and difficulty contract slice | Worker B | 2026-06-09 | `src/components/Combat/EncounterModal.tsx`, `src/hooks/actions/handleEncounter.ts`, `src/services/gemini/encounters.ts`, `src/services/geminiServiceFallback.ts`, `src/utils/world/bestiaryEncounterGenerator.ts`, `src/utils/world/encounterUtils.ts`, `src/utils/combat/encounterDifficulty.ts` | Keep slice bounded to seed + difficulty contract and route non-seeded AI replay gap | Pause forward implementation until G4 decision is recorded; maintain review gate in GAPS and then continue with explicit scope note |

## Status Vocabulary

- `not_started`
- `active`
- `waiting`
- `blocked`
- `done`
- `superseded`
- `out_of_scope`

## Update Rules

- Update this file when scope, owner, or proof path changes.
- Keep links to evidence files current so a cold agent can validate claims quickly.

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G1 | not_started | adjacent_follow_up | future agent | docs/projects/PROJECT_CARD_SCHEMA.md | schema normalization | Replace this seeded gap row with project-specific findings if any remain after the next bounded gap sweep | docs/agent-workflows/living-project-task-protocol/templates/GAPS.md | The workflow requires durable gaps to have a consistent table shape and evidence path | Perform a bounded gap sweep and either update this row or close it as no longer applicable | Updated GAPS.md and TRACKER.md agree on the project gap state |
