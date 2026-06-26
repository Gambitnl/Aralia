# Feature Capabilities Gaps

Status: active
Last updated: 2026-06-25

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|
| G1 | done | blocked_human_decision | Worker B / Codex | `docs/projects/character-creator/TRACKER.md` | capability scan; backlog-retirement re-walk 2026-06-25 | Clarify whether Character Creator should enforce strict step locking or keep permissive sidebar navigation | `docs/tasks/feature-capabilities/character-creator.md`, `docs/projects/character-creator/TRACKER.md`, `src/components/CharacterCreator/CreationSidebar.tsx`, `src/components/CharacterCreator/config/sidebarSteps.ts` | The older gap was stale: the capability note now states permissive sidebar navigation with locked placeholders is the intentional design choice, and the Character Creator tracker records G2 resolved on 2026-06-08. | Closed for the decision question; future changes to stricter step locking need a new Character Creator owner row. | Current docs agree on permissive navigation; no rendered UX proof claimed in this backlog-retirement pass. |
| G2 | active | in_scope_now | Economy docs owner | `docs/projects/economy/TRACKER.md` | capability scan | Confirm whether merchant pricing exchange/rule acceptance is complete enough for this project handoff | `docs/tasks/feature-capabilities/merchant-pricing-economy.md`, `docs/projects/economy/GAPS.md`, `docs/projects/economy/TRACKER.md`, `src/utils/economy/economyUtils.ts` | This folder states shared pricing is implemented but enterprise acceptance is owned by economy/economy-ui trackers | Align acceptance criteria wording and mark completion once audit checks are done | Add one cross-reference row in this folder once economy acceptance is closed |
| G3 | active | adjacent_follow_up | Worker A | `docs/projects/companions/GAPS.md` | capability scan | Define whether companion banter UI burst behavior needs additional test or queue contract in this project scope | `docs/tasks/feature-capabilities/companion-banter.md`, `src/hooks/useCompanionBanter.ts`, `src/components/ui/CompanionReaction.tsx`, `src/components/ui/CollapsibleBanterPanel.tsx` | Hook behavior may be complete while UX and burst visibility still have edge risk | Keep gap decision in companions project unless this folder expands into UX acceptance | Route this gap if acceptance requires UI burst tests |
| G4 | active | adjacent_follow_up | Worker D | `docs/tasks/feature-capabilities/voyage-management.md` | capability scan | Confirm voyage-management player-facing loop and encounter coupling before claiming feature complete | `docs/tasks/feature-capabilities/voyage-management.md`, `src/state/reducers/navalReducer.ts`, `src/systems/naval/VoyageManager.ts`, `src/components/Naval/*` | Current evidence is state-first; UI end-to-end is not yet mapped | Keep as partial in this folder and avoid false "done" closure | Add a follow-up check in this folder when UI loop is verified |
| G5 | active | adjacent_follow_up | Economy docs owner | `docs/projects/world/*` | capability scan | URL sync is verified at hook level, but rendered history transition proof is not included | `docs/tasks/feature-capabilities/url-history-state-sync.md`, `src/hooks/useHistorySync.ts` | Hook-level correctness without flow assertions can miss regressions | Add interaction checks in owning project scope before this folder upgrades status | Add Playwright/flow check if navigation regressions return |

## Classification Reference

- `in_scope_now`: required to complete current project handoff with reliable acceptance.
- `support_needed_now`: needed for project continuation but not itself the core implementation.
- `adjacent_follow_up`: useful, relevant, but outside the strict docs handoff scope.
- `out_of_scope`: explicitly unrelated to this project.
- `blocked_human_decision`: needs an owner/owner team decision.
- `blocked_external_state`: waiting on external system state or another actor.

## Import Rule

- Route cross-project gaps to `docs/projects/GLOBAL_GAPS.md` only when they do not belong here.

<!-- aralia-backlog-walked: {"source":"docs/tasks/backlog-retirement/RETIREMENT_LEDGER.md","path":"docs/tasks/feature-capabilities/GAPS.md","sha256WithoutMarker":"e042a7ab9f9ebb5e3a0dcf997ef39bc7ccc981d0bf80606298d1b8a04e9ca2ee","markedAtUtc":"2026-06-25T22:29:38.607Z"} -->
