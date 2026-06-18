# Rituals System Living Tracker

active_agent: Kilo application agent
agent_pass_status: finished
agent_pass_started_at: 2026-06-17T17:10:42+02:00
agent_pass_ended_at: 2026-06-17T17:18:06+02:00

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
| RIT-3 | active | Capture and verify ritual execution coupling between combat spell casting and ritual start flow. | Kilo | 2026-06-17 | `src/hooks/combat/useActionExecutor.ts` TODO, `src/systems/rituals/RitualManager.ts`, `docs/projects/rituals/GAPS.md` RG-1/RG-9 | Re-validate `startRitual(` caller surface and rift data-model evidence into RG-9 after confirming no production dispatch exists. | Search for live `startRitual(` usage outside tests and capture the final call chain; confirm whether ritual actions are intentionally unreachable. |
| RIT-4 | active | Verify ritual typing, event shape, and duplication cleanup path (`ritual.ts` vs `rituals.ts`). | Kilo | 2026-06-05 | `src/types/ritual.ts`, `src/types/rituals.ts`, `src/state/actionTypes.ts`, `src/state/reducers/ritualReducer.ts`, `docs/projects/rituals/GAPS.md` RG-2/RG-6/RG-10 | Keep canonical type path aligned and resolve which file owns the runtime ritual state contract. | Confirm import graph for both ritual type files and decide merge/deprecation direction with typed event support evidence. |

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| RG-1 | active | functional | Worker A | `docs/projects/rituals/GAPS.md` | scoped source verification | No live combat-to-reducer start path exists for ritual-tagged or long-cast spells outside tests. | `src/hooks/combat/useActionExecutor.ts` TODO about `startRitual`; full `src` regex scan found no non-test caller of `startRitual(` and no production dispatch of ritual actions. | Ritual execute path remains unrealized until a combat dispatch is introduced or intentionally deferred. | Re-run source scan before implementation and keep GAPS.md RG-1/RG-9 evidence aligned. | Confirm whether ritual actions are intentionally unreachable now or reserved for future feature branch. |
| RG-2 | active | technical-debt | Worker A | `docs/projects/rituals/GAPS.md` | source scan | Ritual event payload is untyped at the action boundary (`RitualEvent = unknown`). | `src/state/actionTypes.ts` TODO and `src/state/reducers/ritualReducer.ts` use ad-hoc event casts instead of shared interface. | Interrupt semantics can silently accept wrong payload shapes. | Replace `RitualEvent` alias with a minimal shared interface in `src/types/rituals.ts` and import it in action/reducer paths. | Typecheck passes without casting to unknown/intermediate object. |
| RG-3 | active | design | Worker A | `docs/projects/rituals/GAPS.md` | source scan | Backlash, cost, and ritual consequence math remain placeholders. | `src/systems/rituals/RitualManager.ts` `getBacklashOnFailure` returns `[]`; no ritual cost/influence fields exist. | Failed rituals cannot model penalties or resource semantics. | Design ritual cost/blowback schema and thread it through manager and reducer branches. | Regression coverage for non-empty backlash outputs and failure side effects. |
| RG-4 | active | architecture | Worker A | `docs/projects/rituals/GAPS.md` | source scan | Duplicate ritual type definitions live in `src/types/ritual.ts` and `src/types/rituals.ts`. | `src/types/combat.ts` imports `RitualState` from `./ritual.js` while actions/reducers use `./rituals.js`. | Divergent schemas risk drift in reducer contracts and serializer logic. | Deprecate `src/types/ritual.ts` or merge it after import mapping is finalized. | Dependency sync shows one canonical ritual type file. |

## Update Rules

- Update this tracker before starting a new slice.
- Update it when implementation changes the current state.
- Every active, waiting, or blocked row needs owner, last updated date, evidence or next proof, and next action.
- Record new gaps here or link the owning subsystem tracker.
- Keep raw process artifacts out unless a concise summary helps future work.
