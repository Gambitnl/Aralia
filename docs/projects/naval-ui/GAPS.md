# Naval UI Gaps

Status: active
Last updated: 2026-06-05

Use this file for durable unresolved findings that belong to Naval UI.

## Gap Log

| Gap ID | Status | Classification | Source | Evidence | Why it matters | Next action |
|---|---|---|---|---|---|---|
| NU-1 | active | in_scope_now | Action surface mismatch | `src/state/actionTypes.ts`, `src/state/reducers/navalReducer.ts` | `NAVAL_REPAIR_SHIP` exists as a declared action but has no reducer behavior | Implement reducer branch or remove action contract before extending dashboard controls |
| NU-2 | active | in_scope_now | Voyage start route missing | `src/hooks/actions/handleMovement.ts`, `src/state/reducers/navalReducer.ts` | Water is blocked as impassable in movement/quick-travel logic and no voyage launch path exists | Add transport-to-voyage flow and proof action dispatch |
| NU-3 | active | in_scope_now | Combat/status dead-end | `src/data/naval/voyageEvents/index.ts`, `src/systems/naval/VoyageManager.ts`, `docs/projects/naval` | Voyage logs support `Combat` status but no naval dashboard flow consumes or exposes it | Define event-to-combat/handoff strategy and UI state reflection |
| NU-4 | active | in_scope_now | Duplicate input source | `src/data/naval/voyageEvents.ts`, `src/data/naval/voyageEvents/index.ts` | Two event catalogs exist with overlapping names/behavior | Choose one canonical source before adding new UI status/encounter wiring |
| NU-5 | active | support_needed_now | UI action gap | `src/components/Naval/ShipPane.tsx` | Dashboard is inspection-only (Overview/Crew/Cargo) and cannot trigger recruit/repair/voyage actions | Either add controls or confirm read-only contract explicitly |

## Uncertainties

- The intended behavior for `currentVoyage` status in UI remains undefined at the Naval UI layer.
- No dedicated voyage progress or status panel exists in Naval UI beyond ship-centric views.
- Clarify whether voyage and combat handoff should be represented in a new modal family instead of `ShipPane`.
- This docs-only refresh did not surface a new project-specific blocker; the five rows above remain the active Naval UI gap set.
