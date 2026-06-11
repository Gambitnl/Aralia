# Organization Living Tracker

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
| T1 | done | Create and align living-project protocol docs from registry and code evidence | Worker B | 2026-05-31 | [docs/projects/PROJECT_TRACKER.md](/F:/Repos/Aralia/docs/projects/PROJECT_TRACKER.md), [src/components/Organization/README.md](/F:/Repos/Aralia/src/components/Organization/README.md) | Keep protocol docs stable with current implementation evidence | Confirm evidence links and scope notes remain accurate |
| T2 | active | Capture concrete integration debt for organization slice before implementation | Worker B | 2026-06-05 | [src/services/organizationService.ts](/F:/Repos/Aralia/src/services/organizationService.ts), [src/components/Organization/OrganizationDashboard.tsx](/F:/Repos/Aralia/src/components/Organization/OrganizationDashboard.tsx), [src/services/legacyService.ts](/F:/Repos/Aralia/src/services/legacyService.ts), [src/state/initialState.ts](/F:/Repos/Aralia/src/state/initialState.ts) | Pick the first implementation check from the current gap set; keep permission and persistence wiring visible | App-entrypoint smoke navigation and persistence round-trip proof after integration |
| T3 | not_started | Define permission and grouping contract for org actions | Worker B | 2026-05-31 | [src/types/organizations.ts](/F:/Repos/Aralia/src/types/organizations.ts), [src/services/legacyService.ts](/F:/Repos/Aralia/src/services/legacyService.ts) | Document required permission/group/faction model and who can act as org actor | Decision log + at least one test case for denied action |

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G1 | done | adjacent_follow_up | Worker B | `docs/projects/organization/GAPS.md` | registry-to-scaffold upgrade | Define grouping and permission model | [docs/projects/PROJECT_TRACKER.md](/F:/Repos/Aralia/docs/projects/PROJECT_TRACKER.md) | Registry-surface gap still informs long-term ownership | Keep as unresolved project intent in `GAPS.md` | Active entry present in `GAPS.md` |
| G2 | active | support_needed_now | Worker B | `docs/projects/organization/GAPS.md` | this doc refresh | Add explicit permission checks on recruit/promote/missions actions | [src/components/Organization/OrganizationDashboard.tsx](/F:/Repos/Aralia/src/components/Organization/OrganizationDashboard.tsx) | Without a guard model, action safety and player ownership are ambiguous | Draft permissions API and add at least one failing test for unauthorized actor | Permission test path defined in tracker before coding |
| G3 | active | support_needed_now | Worker B | `docs/projects/organization/GAPS.md` | this doc refresh | Wire organization into game state, modal flow, and persistence | [src/state/initialState.ts](/F:/Repos/Aralia/src/state/initialState.ts), [src/services/legacyService.ts](/F:/Repos/Aralia/src/services/legacyService.ts), tests under [src/services/__tests__/organizationService.test.ts](/F:/Repos/Aralia/src/services/__tests__/organizationService.test.ts) | Missing lifecycle linkage blocks repeated use in gameplay | Choose owner state container and connect UI launch + save/load path | Proof by app-level smoke navigation + persistence test |
| G4 | not_started | adjacent_follow_up | Worker B | `docs/projects/organization/GAPS.md` | this doc refresh | Confirm faction/grouping and rivalry model for org identities | [src/services/organizationService.ts](/F:/Repos/Aralia/src/services/organizationService.ts), [src/components/Organization/OrgMissionsList.tsx](/F:/Repos/Aralia/src/components/Organization/OrgMissionsList.tsx) | Rival and allegiance behavior is local only and may diverge from world model | Add alignment proposal with faction owners before mission/rival expansion | Decision accepted by owning subsystem |
| G5 | not_started | adjacent_follow_up | Worker B | `docs/projects/organization/GAPS.md` | this doc refresh | Organization succession transfer is hardcoded in legacy service instead of using an org-specific authority rule | [src/services/legacyService.ts](/F:/Repos/Aralia/src/services/legacyService.ts) | Death/retirement can move org control by a flat chance, which can drift from the intended ownership model | Define the transfer rule and add a test for the chosen authority path | Succession transfer test or decision note |

## Update Rules

- Update this tracker before starting any significant feature-scoped slice.
- Keep active/blocked/waiting rows current with owner, date, and next proof.
- Keep unresolved long-lived gaps in `docs/projects/organization/GAPS.md`.
