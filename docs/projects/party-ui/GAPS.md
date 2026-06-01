# Party UI Gaps

Status: active
Last updated: 2026-05-31

Use this for durable unresolved findings that remain in Party UI scope.

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|
| G1 | in_progress | adjacent_follow_up | Worker B | docs/projects/party-ui/TRACKER.md / Party-Companion Rule Boundary | Cold-start docs refresh | Define companion-party binding rules (membership, identity collisions, lifecycle when companion data changes) | `src/components/Party/RelationshipsPane.tsx`, `src/components/CharacterSheet/CharacterSheetModal.tsx`, `src/types/companions.ts` | Needed for rule consistency across CharacterSheet, relationships UI, and party edit/save flows | Add explicit rule text in NORTH_STAR once owner confirms canonical model | Compare with future companion subsystem outputs and save/load behavior |
| G2 | in_progress | support_needed_now | Worker B | Party State / SaveLoad | Docs refresh | Verify `shortRestTracker` continuity and reset behavior after load/save and multi-day time advance in overlay + handler paths | `src/state/initialState.ts`, `src/state/reducers/worldReducer.ts`, `src/hooks/actions/handleResourceActions.ts` | Incorrect tracker handling breaks rest UX and daily economy pacing | Add verification checklist to docs and keep test expectations aligned | Run focused test or reasoning check against `SHORT_REST`, `ADVANCE_TIME`, `LONG_REST` interactions |
| G3 | in_progress | support_needed_now | Worker B | Project Docs / UI consistency | Docs refresh | Align README artifacts under `src/components/Party/*` with current implemented behavior (cards, overlay controls, short rest state) | `src/components/Party/PartyOverlay.README.md`, `src/components/Party/PartyPane.README.md`, `src/components/Party/PartyPane/PartyPane.README.md` | Stale docs can mislead future execution and increase onboarding cost | Update or explicitly flag old README guidance during next UI update | Audit each README and mark outdated behavior where applicable |

## Classification

- `in_scope_now`: blocks current implementation tasks.
- `support_needed_now`: must be verified to prevent regressions.
- `adjacent_follow_up`: meaningful but not required for this project slice.
- `blocked_human_decision`: owner choice required to close.
- `blocked_external_state`: dependent on external subsystem or API evolution.
- `out_of_scope`: keep in other project trackers.

## Update Rules

- Keep active gaps in this file if they affect party UI behavior, correctness, or handoff.
- Move global or unrelated gaps to `docs/projects/GLOBAL_GAPS.md` before closing this project.
