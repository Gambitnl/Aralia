# Quests System Gap Registry

Status: active
Last updated: 2026-06-05

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|
| GQ-1 | open | support_needed_now | Worker A | `docs/projects/quests/TRACKER.md` | 2026-05-31 scan | Legacy runtime shape is not aligned with the richer quest schema | `src/types/quests.ts`, `src/state/reducers/questReducer.ts` | New quest features cannot be built safely on partial contracts | Define migration plan from `Quest` to `QuestDefinition`, or freeze the legacy contract | Add a type-level and reducer test that locks the accepted schema |
| GQ-2 | open | support_needed_now | Worker A | `docs/projects/quests/TRACKER.md` | 2026-05-31 scan | Quest triggers are hardcoded by ID instead of metadata | `src/hooks/actions/handleMovement.ts`, `src/hooks/actions/handleItemInteraction.ts` | New content requires manual code edits and hidden trigger drift | Decide metadata-driven trigger config and loader contract | Verify one trigger declaration can add at least one new quest without code changes |
| GQ-3 | open | support_needed_now | Worker A | `docs/projects/quests/TRACKER.md` | 2026-05-31 scan | Dialogue reads quest status, but quest-giver outcomes are not generalized | `src/services/dialogueService.ts`, `src/hooks/actions/handleNpcInteraction.ts` | Dialogue cannot reliably grant, advance, or branch quests through content data | Add quest-giver/action hooks and expected payload contracts | Add an end-to-end dialogue-to-quest action test |
| GQ-4 | open | support_needed_now | Worker A | `docs/projects/quests/TRACKER.md` | 2026-05-31 scan | Advanced failure and consequence fields are underused in runtime | `src/types/quests.ts`, `src/systems/quests/QuestManager.ts`, `src/state/reducers/questReducer.ts` | Rich failure conditions and branching are not represented in play behavior | Define a minimum viable consequence/failure contract, then phase fields in | Add tests for each consequence and branch behavior |
| GQ-5 | open | support_needed_now | Worker A | `docs/projects/quests/TRACKER.md` | 2026-05-31 scan | UI truth is split across the modal and journal quest surfaces | `src/components/QuestLog/*`, `src/components/CharacterSheet/Journal/QuestLogSidebar.tsx`, `src/state/appState.ts` | Inconsistent states can desync what the player sees and what is persisted | Document and lock the single source and rendering contract | Add a regression that opens both paths after load and compares status |
| GQ-6 | open | globalize | Worker A | `docs/projects/GLOBAL_GAPS.md` | 2026-05-31 scan | Contract/test drift suggests staged quest shapes that runtime does not yet consume | `src/test/contracts/quests.contract.test.ts`, `src/types/quests.ts` | Contract drift may hide runtime mismatch in CI and editor workflows | If this repeats across domains, raise as `GLOBAL_GAPS` `G-QUESTS-001` | Cross-check with adjacent schema owners (dialogue/world) |

## Notes
- Keep GAPS scoped to the quests project unless evidence shows repeated contract-surface mismatch across unrelated projects.
- The current emphasis remains migration planning, trigger source-of-truth, and UI/source-of-state harmonization rather than new gameplay behavior.
- No new project-local gap was added during this docs-only pass; the registry was tightened and re-dated for the next agent.
