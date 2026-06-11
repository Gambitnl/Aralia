# Underdark Living Tracker

Status: active
Last updated: 2026-06-05

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
| T1 | done | Convert Underdark project scaffold into a concrete evidence-backed living pack. | Worker A | 2026-05-31 | `docs/projects/PROJECT_TRACKER.md` | Refresh `NORTH_STAR.md`, `GAPS.md`, and confirm all file paths exist. | Confirm each referenced file resolves. |
| T2 | active | Consolidate the active Underdark implementation boundary (system vs service logic). | Worker A | 2026-05-31 | `src/systems/underdark/UnderdarkMechanics.ts`, `src/services/underdarkService.ts` | Confirm source-of-truth and document acceptance choice in TRACKER + GAPS. | Add a tracked decision note plus a regression test target list. |
| T3 | not_started | Trace and wire geography/faction ownership updates into live runtime. | Worker A | 2026-05-31 | `src/state/reducers/worldReducer.ts`, `src/utils/world/encounterUtils.ts`, `src/data/travelEvents.ts` | Define where `currentDepth`, `currentBiomeId`, and `currentTerritoryFactionId` are written in production flow. | Add proof check from a travel/time contract test. |

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| UD-1 | not_started | in_scope_now | Worker A | `docs/projects/underdark/GAPS.md` | Source scan of state + reducer files | No obvious production flow updates `underdark.currentDepth` or `currentBiomeId`. | `src/state/initialState.ts`, `src/state/appState.ts`, `src/state/reducers/worldReducer.ts`, `rg` scan for `currentDepth` writes. | Underdark behavior can be tied to static defaults only, making geometry effects inert. | Capture and verify depth/biome owner path; add test that movement changes these fields. | Confirm one reducer/action updates both fields on location transition. |
| UD-2 | not_started | in_scope_now | Worker A | `docs/projects/underdark/GAPS.md` | Implementation scan in systems + reducer | Two underdark implementations diverge (`UnderdarkMechanics` vs `underdarkService.ts`) in base constants and edge rules. | `src/systems/underdark/UnderdarkMechanics.ts`, `src/services/underdarkService.ts` | Runtime behavior can fork by callsite, increasing bug risk and test drift. | Decide canonical implementation and align callers/tests around it. | Add a focused comparison test or remove one path. |
| UD-3 | not_started | support_needed_now | Worker A | `docs/projects/underdark/GAPS.md` | Runtime scan | Territory mechanics engine is not yet called from world progression loop. | `src/systems/underdark/UnderdarkFactionSystem.ts`, `src/state/reducers/worldReducer.ts` | Faction-area and region effects remain non-functional despite schema support. | Route `applyTerritoryMechanics` through the time/zone update flow. | Validate a non-passive faction mechanic changes sanity or faerzress during travel. |
| UD-4 | not_started | adjacent_follow_up | Worker A | `docs/projects/underdark/GAPS.md` | Integration scan | `useUnderdarkLighting` is UI-hook centered and returns a derived level not yet fully connected to reducer state updates. | `src/hooks/useUnderdarkLighting.ts`, `src/state/reducers/worldReducer.ts` | Light/sanity behavior can drift if inventory-derived light is not consistently used. | Decide whether hook output is authoritative or observational and document contract. | Verify one documented contract path in tracker and tests. |

## Update Rules

- Update this tracker before starting a new slice.
- Update it when implementation changes the current state.
- Every active, waiting, or blocked row needs owner, last updated date, evidence or next proof, and next action.
- Record new gaps here or link the owning subsystem tracker.
- Keep raw process artifacts out unless a concise summary helps future work.
