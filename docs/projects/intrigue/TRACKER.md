# Intrigue System Living Tracker

Status: active
Last updated: 2026-06-15

## Status Vocabulary
- `done`
- `active`
- `blocked`
- `waiting`
- `superseded`

## Active Task Queue

| Task ID | Status | Task | Owner | Evidence | Next action | Next check |
|---|---|---|---|---|---|---|---|
| I2 | done | Audit leverage chain from player-discovered secrets to actionable social consequences. | Claude Codex Spark | `src/state/payloads/identityPayloads.ts` (ApplyLeveragePayload), `src/state/actionTypes.ts:245` (APPLY_LEVERAGE), `src/state/reducers/identityReducer.ts:109` (reducer case), `src/components/Town/Intrigue/LeverageUI.tsx` (UI component), `src/systems/intrigue/__tests__/LeverageSystem.test.ts` (integration tests: 2 new) | LeverageSystem wired with production action/reducer path and LeverageUI component; next is dialog/npc-interaction surface integration. | After dialog integration, verify a dialog-triggered leverage attempt produces persistent faction-standing change. |
| I3 | active | Resolve rumor lead handling contract (lead type currently non-actionable). | Spark Worker | `src/systems/intrigue/TavernGossipSystem.ts`, `src/components/Town/Intrigue/RumorMill.tsx`, `src/components/Trade/MerchantModal.tsx` | Define payload contract and ownership target (quest/world marker/schedule). | Add at least one end-to-end proof path test. |
| I4 | active | Decide generator canonicalization for secrets/noble houses (intrigue vs world utils). | Spark Worker | `src/systems/intrigue/SecretGenerator.ts`, `src/utils/secretGenerator.ts`, `src/systems/intrigue/NobleHouseGenerator.ts`, `src/utils/world/nobleHouseGenerator.ts` | Choose single source-of-truth and document migration notes. | Add regression tests for schema compatibility. |
| I5 | waiting | Capture any additional intrigue-logic spillovers from adjacent systems (quests, crime, merchant, faction systems). | Spark Worker | `src/systems/world/FactionManager.ts`, `src/state/reducers/worldReducer.ts`, `src/components/Trade/MerchantModal.tsx` | Run targeted scan of world/quest/crime callsites and route missing ownership. | Add cross-project references only if evidence is clear. |

## Gap Log

| Gap ID | Status | Classification | Owning tracker/subsystem | Evidence | Why it matters | Next check |
|---|---|---|---|---|---|---|
| G-001 | active | implementation | Intrigue `GAPS.md` | `src/types/identity.ts`, `src/systems/intrigue/IdentityManager.ts` | Intrigue check/disguise outcome model exists but is not in flow. | Confirm whether a detect/fail path is required before social content expands. |
| G-002 | active | implementation | Intrigue `GAPS.md` | `src/systems/intrigue/TavernGossipSystem.ts` (TODO on lead payload) | Purchased leads do not create a follow-up action. | Define lead-to-quest/world objective contract. |
| G-003 | active | architecture | Intrigue `GAPS.md` | dual secret generators and dual noble house generators | Divergent output contracts can drift and create inconsistent lore. | Decide canonical generator and update imports. |
| G-004 | resolved | architecture | Intrigue `GAPS.md` (G-005) | `src/state/actionTypes.ts:245`, `src/state/reducers/identityReducer.ts:109`, `src/components/Town/Intrigue/LeverageUI.tsx`, `src/systems/intrigue/__tests__/LeverageSystem.test.ts` (5/5 pass) | APPLY_LEVERAGE action, reducer case, LeverageUI component, and integration tests now wired. Next: dialog/npc-interaction surface integration. | After dialog integration, verify dialog-triggered leverage produces persistent faction-standing change. |
| G-005 | waiting | quality | Intrigue `GAPS.md` | TODO markers in intrigue and world files | Several placeholder parameters/types indicate unfinished intent. | Keep documentation updated when intent is resolved. |

## Update Rules

- Update this tracker before starting a new slice.
- Update it when implementation changes the current state.
- Every active, waiting, or blocked row needs owner, last updated date, evidence or next proof, and next action.
- Record new gaps here or link the owning subsystem tracker.
- Keep raw process artifacts out unless a concise summary helps future work.
