# Character Sheet Gaps

Status: active  
Last updated: 2026-05-31

Use this file only for durable unresolved findings that belong to this project.

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G1 | active | in_scope_now | Worker B | docs/projects/character-sheet/TRACKER.md | docs/scan + feature evidence | Align character sheet fields with character schema | `docs/projects/PROJECT_TRACKER.md` (Character Sheet row) and `src/components/CharacterSheet/*` | Current implementation renders many fields from `character` payloads without one stable field map | Create a field mapping table for `PlayerCharacter` -> Overview/Skills/Details/Spells/Journal expectations and close after review | mapping table and approval note in `NORTH_STAR.md` |
| G2 | not_started | support_needed_now | Worker B | `src/state` / `src/components/CharacterSheet` | implementation scan | Normalize sheet inventory action contract | `src/components/CharacterSheet/Overview/InventoryList.tsx`, `src/types/actions.ts`, `src/state/actionTypes.ts`, `src/state/reducers/characterReducer.ts` | Mixed action casing and loosely typed payload comments create risk for future item interaction refactors | Decide whether to treat existing `use_item`/`USE_ITEM` contract path as stable or align types | Small action contract test or typed acceptance note |
| G3 | not_started | support_needed_now | Worker B | `src/components/CharacterSheet/Journal` | implementation scan | Confirm Journal tab state contract | `src/components/CharacterSheet/CharacterSheetModal.tsx`, `src/components/CharacterSheet/Journal/JournalTab.tsx` | Optional `journal` prop and quest linkage can diverge across save/load or panel entry | Verify all journal call sites and confirm null/empty behavior is intentional | Journal render smoke test with and without journal payload |
| G4 | not_started | adjacent_follow_up | Worker B | project docs | implementation scan | Keep one canonical map of tab feature intent | `src/components/CharacterSheet/CharacterSheetModal.README.md`, `src/components/CharacterSheet/README.md` | Local READMEs mention features and expected semantics that may drift from implementation | Add diff note when intent changes and update README pointers if needed | Manual audit of README-vs-source assertions |

## Classification Reference

| Classification | Use when |
|---|---|
| `in_scope_now` | The task cannot honestly continue without it. |
| `support_needed_now` | Required for the project to progress safely in the same scope. |
| `adjacent_follow_up` | Related future work that should be tracked but is not blocking current continuity. |
| `out_of_scope` | Explicitly not part of this project/task. |
| `blocked_human_decision` | Owner approval or external policy decision is required. |
| `blocked_external_state` | Waiting on another actor or external dependency. |

## Update Rules

- Keep each row linked to concrete evidence.
- Keep only durable project-owned gaps here; route unrelated items to `docs/projects/GLOBAL_GAPS.md`.
