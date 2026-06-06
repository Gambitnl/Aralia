# Character Sheet Tracker

Status: active  
Last updated: 2026-05-31

## Status Vocabulary

- `not_started`
- `active`
- `waiting`
- `blocked`
- `done`
- `superseded`
- `out_of_scope`

## Active Task Queue

| ID | Status | Task | Owner | Last updated | Evidence | Next action | Next check/proof |
|---|---|---|---|---|---|---|---|
| T1 | done | Build first complete living docs for Character Sheet and capture concrete implementation evidence | Worker B | 2026-05-31 | `docs/projects/character-sheet/*`, `src/components/CharacterSheet/*` | Keep docs as implementation snapshot only; continue with schema alignment work | Confirm this file set documents modal entrypoints, tab map, and reducer integration |
| T2 | active | Preserve and route known gap: sheet fields vs schema alignment | Worker B | 2026-06-05 | `docs/projects/PROJECT_TRACKER.md` row: Character Sheet; `docs/projects/character-sheet/NORTH_STAR.md` acceptance criteria | Use the explicit acceptance criteria in NORTH_STAR.md to complete the field-by-field schema map and record any drift in GAPS.md | Signed-off field map against `src/types/character.ts` and render use sites, or a documented blocker if validation cannot be completed |
| T3 | not_started | Run a focused gap check for item action contracts (e.g., use/equip/drop) and document any mismatch | Worker B | 2026-05-31 | `src/components/CharacterSheet/Overview/InventoryList.tsx`, `src/types/actions.ts`, `src/state/reducers/characterReducer.ts` | Validate typed action contract and update docs with decision or implementation fix | Action unit/integration test evidence or explicit exception note |
| T4 | not_started | Verify tab surface coverage against actual player-facing claims in docs/README files | Worker B | 2026-05-31 | `src/components/CharacterSheet/*.README.md` | Reconcile component README claims and modal behavior | Add mismatch notes and ownership decision in GAPS.md |

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|
| G1 | active | in_scope_now | Worker B | docs/projects/character-sheet/GAPS.md | tracker conversion + implementation read | Align sheet fields with schema | `docs/projects/PROJECT_TRACKER.md` row and modal/tab field usage | Prevents silent field drift between UI claims and character model | Capture `PlayerCharacter` field-by-field map and finalize acceptance checklist | Signed-off map in `docs/projects/character-sheet/GAPS.md` + updated NORTH_STAR |
| G2 | not_started | support_needed_now | Worker B | docs/projects/character-sheet/GAPS.md | implementation review | Validate journal data contract for `JournalTab` | `src/components/CharacterSheet/Journal/JournalTab.tsx`, `src/components/CharacterSheet/CharacterSheetModal.tsx` | Journal tab can silently fail if schema optionality is not aligned with runtime save/load | Add explicit "journal schema contract" entry and test hook | Small render or unit check in journal path |
| G3 | not_started | support_needed_now | Worker B | docs/projects/character-sheet/GAPS.md | implementation review | Normalize item interaction action contract | `src/components/CharacterSheet/Overview/InventoryList.tsx`, `src/state/actionTypes.ts`, `src/types/actions.ts`, `src/state/reducers/characterReducer.ts` | Unclear or drifting action typing can break future item interaction work | Decide whether to unify naming and tighten payload assumptions in implementation notes | Add note in tracker after contract decision |

## Update Rules

- Keep statuses current when task coverage changes.
- Keep `T1` done unless a structural tracker rule changes.
- Keep unresolved technical findings in `GAPS.md` with evidence and proof checks.
