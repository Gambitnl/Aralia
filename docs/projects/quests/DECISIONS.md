# Quests System Decisions

Status: active
Last updated: 2026-06-10

Use this file for durable choices that affect project scope, required documentation, or protocol interpretation. Keep operational notes in `AUDIT_OR_PROOF.md` and re-openable workflow deltas in `TRACKER.md` or `GAPS.md`.

## Decision Log

### D1: Required-doc surface initialized

Date: 2026-06-10

Owner: schema migration pass

Decision point:
`NORTH_STAR.md` declares `DECISIONS.md` as part of the required living-project surface.

Decision made:
Create this concise decisions file so the project folder matches the declared schema contract.

Rationale and evidence:
- Project folder: `docs/projects/quests`
- Schema source: `docs/projects/PROJECT_CARD_SCHEMA.md`
- Current North Star last updated date: `2026-06-05`

Follow-up:
Record future durable project decisions here instead of hiding them in chat handoffs.

### D2: Quest schema migration path — phased adapter bridge

Date: 2026-06-10

Owner: QTS-3 iteration agent

Decision point:
`QuestDefinition` (rich schema with stages, typed objectives, prerequisites, failure conditions, richer rewards) exists in `src/types/quests.ts` but is not consumed by any runtime code. The reducer, QuestManager, data layer, and UI all operate on the legacy `Quest` interface. A migration path is needed to unlock richer quest authoring without breaking the live gameplay contract.

Decision made:
Adopt a **phased adapter-bridge** migration. The legacy `Quest` type stays as the runtime state contract; `QuestDefinition` becomes the authoring/template contract. An adapter function bridges the two until the reducer and UI are progressively migrated.

Compatibility boundary preserved:
- All existing reducer actions (`ACCEPT_QUEST`, `UPDATE_QUEST_OBJECTIVE`, `COMPLETE_QUEST`) continue to operate on `Quest`.
- All UI quest-log and journal reads continue to consume `Quest` from `state.questLog`.
- `QuestManager.checkQuestDeadlines` continues to work on the legacy deadline/deadlineConsequence fields.
- Existing quest templates in `src/data/quests/index.ts` remain valid.

Migration phases:
1. **Phase 1 — Adapter layer** (next slice): Introduce `adaptQuestDefinitionToQuest(def: QuestDefinition): Quest` in `src/systems/quests/questAdapter.ts`. This flattens the active stage's objectives into the legacy `QuestObjectiveProgress[]` shape and maps `QuestReward` to `QuestRewards`. Quest authors can start writing in `QuestDefinition`; runtime still consumes `Quest`.
2. **Phase 2 — Stage-aware reducer**: Add `ADVANCE_QUEST_STAGE` action and internal stage-tracking fields to the reducer. The adapter continues to produce the flat view for UI, but the reducer now understands stage progression internally.
3. **Phase 3 — UI migration**: QuestLog modal and journal sidebar switch to reading stage-aware quest state. The flat `Quest` view is retired from UI consumers.
4. **Phase 4 — Legacy retirement**: Remove the `Quest` interface, `QuestObjectiveProgress`, and `QuestRewards` types. Make `QuestDefinition` the canonical runtime and authoring contract. Update contract tests.

Key field mapping (Phase 1 adapter):
- `QuestDefinition.stages[currentStageId].objectives` → `Quest.objectives` (flattened)
- `QuestDefinition.rewards` → `Quest.rewards` (gold, xp, items mapped from itemIds)
- `QuestDefinition.failureConditions[type=Deadline]` → `Quest.deadline` + `Quest.deadlineConsequence`
- `QuestDefinition.prerequisites` → deferred (not needed in legacy runtime)
- `QuestDefinition.type` → `Quest.questType`
- `QuestDefinition.regionId` → `Quest.regionHint`

Blockers and risks:
- No current test covers the adapter boundary. Phase 1 must ship with a unit test that round-trips a `QuestDefinition` through the adapter and asserts the legacy `Quest` shape.
- The existing contract test (`quests.contract.test.ts`) tests both shapes independently but does not test the adapter mapping.
- Prerequisite graph checks and stage branching are deferred to Phase 2+.

Rationale and evidence:
- `src/types/quests.ts` lines 160–194: `QuestDefinition` interface with stages, prerequisites, failure conditions.
- `src/types/quests.ts` lines 217–241: `Quest` interface with flat objectives, simple rewards, deadline.
- `src/state/reducers/questReducer.ts` line 30: imports only `Quest`, not `QuestDefinition`.
- `src/systems/quests/QuestManager.ts` line 27: imports `Quest`, uses legacy deadline fields.
- `src/data/quests/index.ts` line 5: imports `Quest` and `QuestTemplate`, no `QuestDefinition` usage.
- Reducer TODO at line 36: "Migrate questReducer to use the new `src/types/quests.ts` structure."

Follow-up:
QTS-3 is closed as a decision task. QTS-5 (new) tracks Phase 1 adapter implementation. GQ-1 is resolved by this decision.

Update 2026-06-25:
QTS-5 is implemented for the adapter bridge. `src/systems/quests/questAdapter.ts`
now exposes `adaptQuestDefinitionToQuest`, and the focused adapter plus
QuestManager deadline proof passed. GQ-7 remains open for factory/helper
adoption so reducer-facing tests can consume legacy `Quest` without casts.
