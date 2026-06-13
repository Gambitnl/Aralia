# Environment System Gap Registry

Status: active
Last updated: 2026-06-09

Use this file for durable unresolved findings that are too important or too large to live only in the tracker and that genuinely belong to this project. Put cross-project, orphaned, or out-of-current-scope gaps in the global gap tracker instead.
## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|

## Local context notes

- The above gaps are aligned with `docs/projects/environment/TRACKER.md` and should be treated as the local default scope unless re-routed by a stricter domain owner.
- No cross-project or orphaned gaps were added to `docs/projects/GLOBAL_GAPS.md` yet.
- This pass removed the `G1` blocking runtime wiring gap and resolved `G2`; `G3`, `G4`, and `G5` are now resolved as well, while runtime weather progression and seeded replay remain live and the legacy weather bridge remains in place for compatibility.

### Runtime progression proof (2026-06-09)

- Implemented `resolveBiomeId` + daily `updateWeather` progression in `src/state/reducers/worldReducer.ts`.
- Wired `daysPassed` cadence through `ADVANCE_TIME`, with `TimeOfDay` derived from progressive day timestamps.
- Added reducer tests in `src/state/reducers/__tests__/worldReducer.test.ts` to verify:
  - day-advance triggers weather update,
  - non-day advance does not trigger weather update,
  - `coord_x_y` biome lookup is used for map-tile locations.

### Seeded replay proof (2026-06-09)

- Added explicit seeded RNG plumbing for weather progression in `src/state/reducers/worldReducer.ts` and seeded voyage/crew plumbing in `src/state/reducers/navalReducer.ts`.
- Updated `src/systems/environment/WeatherSystem.ts`, `src/systems/naval/VoyageManager.ts`, `src/systems/naval/CrewManager.ts`, `src/data/naval/voyageEvents.ts`, and `src/types/naval.ts` to avoid ambient/random-date sources on the active replay path.
- Added replay-stability tests in:
  - `src/systems/environment/__tests__/WeatherSystem.test.ts`
  - `src/systems/naval/__tests__/VoyageManager.test.ts`
  - `src/state/reducers/__tests__/worldReducer.test.ts`
  - `src/state/reducers/__tests__/navalReducer.test.ts`

## Classification Reference

| Classification | Use when |
|---|---|
| `in_scope_now` | The task cannot honestly complete without it. |
| `support_needed_now` | It is not the product task, but the task cannot move without it. |
| `adjacent_follow_up` | Useful and related, but not required for this slice. |
| `out_of_scope` | It should not be part of this project/task. |
| `blocked_human_decision` | A real owner/operator choice is needed. |
| `blocked_external_state` | Waiting on PR, CI, vendor, service, environment, or another person. |

## Update Rules

- Keep each gap tied to evidence and a next proof/check.
- Link back to a global gap ID when this project imports one.
- If the current project should not own a gap, add or update the global gap tracker instead of keeping the gap here.
- Do not mark a gap done unless completion evidence is linked or summarized.
- Add dated testimony or status notes to an existing gap instead of opening duplicates.
