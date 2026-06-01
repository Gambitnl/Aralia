# Quests System Gap Registry

Status: active
Last updated: 2026-05-31

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|
| GQ-1 | open | support_needed_now | Worker A | `docs/projects/quests/TRACKER.md` | 2026-05-31 scan | Legacy runtime shape is not aligned with advanced quest schema | `src/types/quests.ts`, `src/state/reducers/questReducer.ts` | New quest features cannot be built safely on partial contracts | Define migration plan from `Quest` to `QuestDefinition` or freeze legacy contract | Add type-level and reducer test that locks accepted schema |
| GQ-2 | open | support_needed_now | Worker A | `docs/projects/quests/TRACKER.md` | 2026-05-31 scan | Quest triggers are hardcoded (two location IDs and one item ID) | `src/hooks/actions/handleMovement.ts`, `src/hooks/actions/handleItemInteraction.ts` | New content requires manual code edits and hidden trigger drift | Decide metadata-driven trigger config and implement loader contract | Verify one trigger declaration can add at least one new quest without code changes |
| GQ-3 | open | support_needed_now | Worker A | `docs/projects/quests/TRACKER.md` | 2026-05-31 scan | Hard requirement checks are partial (`quest_status` read in dialogue) but no generalized quest giver/action outcomes | `src/services/dialogueService.ts`, `src/hooks/actions/handleNpcInteraction.ts` | Dialogue cannot reliably grant, advance, or branch quests through content data | Add quest-giver/action hooks and expected payload contracts | Add end-to-end dialogue-to-quest action test |
| GQ-4 | open | support_needed_now | Worker A | `docs/projects/quests/TRACKER.md` | 2026-05-31 scan | Advanced failure and consequence fields are underused in runtime | `src/types/quests.ts`, `src/systems/quests/QuestManager.ts`, `src/state/reducers/questReducer.ts` | Rich failure conditions and branching are not represented in play behavior | Define minimum viable consequence/failure contract; phase in fields with migration | Add tests for each consequence and branch behavior |
| GQ-5 | open | support_needed_now | Worker A | `docs/projects/quests/TRACKER.md` | 2026-05-31 scan | UI state truth split across modal and journal surfaces | `src/components/QuestLog/*`, `src/components/CharacterSheet/Journal/QuestLogSidebar.tsx`, `src/state/appState.ts` | Inconsistent states can desync what the player sees and what is persisted | Document/lock single source and rendering contract | Add regression that opens both paths after load and compares displayed status |
| GQ-6 | open | globalize | Worker A | `docs/projects/GLOBAL_GAPS.md` | 2026-05-31 scan | Type-driven expectations from `src/test/contracts/quests.contract.test.ts` suggest staged shapes that runtime does not yet consume | `src/test/contracts/quests.contract.test.ts`, `src/types/quests.ts` | Contract/test drift may hide runtime mismatch in CI and editor workflows | If this pattern repeats across domains, raise as GLOBAL_GAPS `G-QUESTS-001` | Cross-check with adjacent schema owners (dialogue/world) |

## Notes
- Keep GAPS scoped to the quests project unless evidence shows repeated contract-surface mismatch across unrelated projects.
- Current status suggests the primary work is migration planning, trigger source-of-truth, and UI/source-of-state harmonization, not new gameplay behavior.
