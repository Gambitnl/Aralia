# Memory System Living Tracker

Status: active
Last updated: 2026-06-05

Current state: Docs-only refresh on 2026-06-05. The implementation queue is unchanged, with T2 still carrying the tracker-level gap-registry work and the GAPS table still exposing the runtime slice order.

## Active Task Queue

| ID | Status | Task | Owner | Last updated | Evidence | Next action | Next check/proof |
|---|---|---|---|---|---|---|---|
| T1 | done | Replace scaffold-only docs with concrete cold-start Memory System context and implemented-state mapping. | Worker A | 2026-05-31 | `src/types/world.ts`, `src/state/reducers/npcReducer.ts`, `src/hooks/actions/handleWorldEvents.ts`, `src/hooks/actions/handleResourceActions.ts` | Keep this tracker as the owned handoff surface and update `GAPS.md` with concrete implementation blockers. | Verify updated docs include concrete file map, boundaries, and gap proofs. |
| T2 | in_progress | Finalize Memory System gap registry for schema unification and gameplay wiring coverage. | Worker A | 2026-06-05 | `src/types/memory.ts`, `src/types/world.ts`, `src/services/gemini/items.ts`, `src/hooks/actions/handleGeminiCustom.ts`, `src/systems/memory/MemorySystem.ts` | Confirm each gap has a stable owner, proof source, and follow-up check. | Add explicit "done" markers only when each gap receives resolution action. |

## Status Vocabulary

- `not_started`
- `in_progress`
- `active`
- `blocked`
- `done`
- `superseded`
- `out_of_scope`

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|
| G1 | active | schema_drift | Worker A | `docs/projects/memory/GAPS.md` | Bounded code scan | Two memory shapes coexist: `NpcMemory` (`src/types/world.ts`) and `NPCMemory` (`src/types/memory.ts`), with reducers and AI paths using mixed assumptions. | `src/types/world.ts`, `src/types/memory.ts`, `src/hooks/actions/handleNpcInteraction.ts`, `src/hooks/actions/handleGeminiCustom.ts`, `src/state/reducers/npcReducer.ts` | Define canonical schema and map adapter functions before adding any new memory event wiring. | Check reducer/action tests for a single memory interface and no TODOs requiring runtime casts. | Track progress by leaving this gap active until casts are removed. |
| G2 | active | integration_gap | Worker A | `docs/projects/memory/GAPS.md` | Bounded code scan | `src/systems/memory/MemorySystem.ts` is not connected to gameplay flows; memory creation/updates happen in reducer actions and utility handlers. | `src/systems/memory/MemorySystem.ts`, `src/state/reducers/npcReducer.ts`, `src/hooks/actions/handleNpcInteraction.ts`, `src/hooks/actions/handleResourceActions.ts` | Prevent duplicated memory behavior and uncertain ownership of side effects. | Decide whether to retire this lane or route combat/spell/event producers through it. | Confirm one ownership decision and update docs for whichever lane remains active. |
| G3 | active | persistence | Worker A | `docs/projects/memory/GAPS.md` | Bounded code scan | Save/load migration only normalizes old `knownFacts: string[]`; additional shape fields (`attitude`, interaction history types, timestamps) remain drift-prone. | `src/state/appState.ts`, `src/types/world.ts`, `src/state/initialState.ts` | Avoid silent loss or malformed states on older/newer saves. | Define and implement a broader migration policy for legacy/future memory envelopes. | Capture migration test case for one legacy fixture and one fresh save fixture. |
| G4 | in_progress | coverage | Worker A | `docs/projects/memory/GAPS.md` | Bounded code scan | Memory-event production is incomplete for several social branches (combat, some custom spell outcomes, and ritual branches). | `src/hooks/actions/handleGeminiCustom.ts`, `src/hooks/actions/handleMovement.ts`, `src/hooks/actions/handleWorldEvents.ts`, `src/state/actionTypes.ts` | Keeps social consistency incomplete and difficult to reason about across systems. | Build explicit action-to-memory mapping before additional behavior work. | Add an action coverage list to `TRACKER.md` and validate with unit/integration checks. |
