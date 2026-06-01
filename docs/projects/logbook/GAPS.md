# Logbook Gaps

Status: active
Last updated: 2026-05-31

Use this file for durable unresolved findings that belong in the Logbook scope.

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G1 | not_started | adjacent_follow_up | Current thread | `docs/projects/logbook/TRACKER.md` | Direct code scan | Define retention policy and prune strategy for `discoveryLog` | `src/state/logReducer.ts`, `src/state/reducers/logReducer.ts`, `src/services/saveLoadService.ts` | Prevents unbounded growth of runtime and save data | Specify cap/age rule and truncation trigger; include migration expectations | Verify save/load and clear/read behavior after implementation |
| G2 | not_started | adjacent_follow_up | Current thread | `docs/projects/logbook/TRACKER.md` | Direct code scan | Add pagination for discovery and dossier UI lists | `src/components/Logbook/DiscoveryLogPane.tsx`, `src/components/Logbook/DossierPane.tsx` | Improves responsiveness and usability for long sessions | Define paging model (windowed list, server side, or client-side chunks) | Validate navigation and sort/filter interaction on large data |
| G3 | not_started | support_needed_now | Current thread | `docs/projects/logbook/TRACKER.md` | Direct code scan | Clarify dedupe rules beyond `locationId` | `src/state/reducers/logReducer.ts`, `src/hooks/actions/handleItemInteraction.ts`, `src/useGameActions.ts` | Existing location dedupe may still allow noisy duplicates from item/world/quest sources | Decide dedupe policy and where to enforce it | Confirm entry quality with regression checks |
| G4 | not_started | adjacent_follow_up | Current thread | `src/components/Logbook/DossierPane.tsx` / `src/state` | Direct code scan | Define whether dossier data has any retention/archival lifecycle | `src/components/Logbook/DossierPane.tsx` currently has no retention hooks | Preserves consistency between discovery and dossier memory behavior | Decide if dossier entries should be bounded or immutable | Review expected future UX requirements |

## Classification Reference

- `in_scope_now`: required for current task completion.
- `support_needed_now`: required for safe continuation, but not core task scope.
- `adjacent_follow_up`: useful and related, but not required now.
- `out_of_scope`: explicit exclusion.
- `blocked_human_decision`: requires owner decision.
- `blocked_external_state`: blocked on other team/system state.

## Update Rules

- Keep each gap tied to evidence and next check.
- Route true cross-project or non-Logbook gaps to `docs/projects/GLOBAL_GAPS.md`.
- Do not mark a gap done without a follow-up action and proof reference.
