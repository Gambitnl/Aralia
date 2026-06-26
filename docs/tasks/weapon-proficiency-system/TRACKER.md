# Weapon Proficiency System Living Tracker

Status: active
Last updated: 2026-06-25

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
| T1 | done | Refresh the three living docs (`NORTH_STAR.md`, `TRACKER.md`, `GAPS.md`) from current-state evidence. | Worker D | 2026-05-31 | `START-HERE.md`; `@PROJECT-INDEX.md`; `src/commands/factory/__tests__/AbilityCommandFactory.test.ts` | Pause; handoff remains in `T2`. | Confirm this tracker reflects active in-project gaps. |
| T2 | active | Verify and close remaining combat proficiency gaps: fresh rendered alignment checks. | Codex | 2026-06-25 | `src/components/BattleMap/AbilityButton.tsx`; `src/components/BattleMap/__tests__/AbilityButton.test.tsx`; `GAPS.md` G2 | Run rendered combat action-selection proof for non-proficient weapon warning marker, tooltip/accessibility copy, and penalty alignment. | Screenshot or Playwright/browser proof recorded in an audit/proof note. |

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|
| G1 | done | in_scope_now | Codex | `GAPS.md` | retired `11-combat-ui-warnings.md`; `AbilityButton.tsx` | Dedicated combat action-level warning for non-proficient weapon attacks now exists on the ability button. | Current UX can be unclear when penalty and mastery restriction apply. | Closed as source/test proof; rendered sign-off remains in G2. | Focused Vitest run passed 51 tests. |
| G2 | active | support_needed_now | Codex | `GAPS.md` | `START-HERE.md`, `NORTH_STAR.md`, `AbilityButton.tsx` | No fresh rendered verification after warning UI and logic proof. | Stale verification weakens confidence in warning/penalty consistency across UI. | Run focused render+regression pass for warning texts, tooltips, and combat roll results. | Screenshot or browser proof attached to a future audit/proof note. |

## Next Checks

- Confirm rendered combat UI warning placement and tooltip behavior for non-proficient selected weapons.
- Preserve the focused regression run that already confirms no command/opportunity attack proficiency-bonus regression.

## Update Rules

- Update this tracker before starting the next operational slice.
- Keep every active/blocked/waiting row with owner, evidence, and next proof.
- Keep gaps in-project when the task cannot move without them; send unrelated gaps to `docs/projects/GLOBAL_GAPS.md`.

<!-- aralia-backlog-walked: {"source":"docs/tasks/backlog-retirement/RETIREMENT_LEDGER.md","path":"docs/tasks/weapon-proficiency-system/TRACKER.md","sha256WithoutMarker":"f4747fbd67f5b54799e58846133a65e2697ab0141e8a46a7594fb92dee2a50ea","markedAtUtc":"2026-06-25T22:29:38.614Z"} -->
