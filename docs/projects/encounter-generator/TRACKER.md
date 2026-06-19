# Encounter Generator Living Tracker

Status: review-required
Last updated: 2026-06-18

## Active Task Queue

| ID | Status | Task | Owner | Last updated | Evidence | Next action | Next check |
|---|---|---|---|---|---|---|---|
| T3 | blocked | Close seeded encounter generation and difficulty contract slice | Worker B / Codex CLI pass | 2026-06-18 | `src/components/Combat/EncounterModal.tsx`, `src/hooks/actions/handleEncounter.ts`, `src/services/gemini/encounters.ts`, `src/services/geminiServiceFallback.ts`, `src/utils/world/bestiaryEncounterGenerator.ts`, `src/utils/world/encounterUtils.ts`, `src/utils/combat/encounterDifficulty.ts` | Keep slice bounded to seed + difficulty contract and route non-seeded AI replay gap | Pause forward implementation until G4 decision is recorded; existing focused seed/fallback tests pass as of 2026-06-18 |

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
