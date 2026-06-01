# Weapon Proficiency System Living Tracker

Status: active
Last updated: 2026-05-31

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
| T2 | active | Verify and close remaining combat proficiency gaps: action warning visibility and fresh rendered alignment checks. | Worker D | 2026-05-31 | `11-combat-ui-warnings.md`; `START-HERE.md` | Inspect combat action-selection/confirmation UX and add/confirm warning surface for non-proficient weapons. | Rendered validation and test confirmation for warning and penalty messaging. |

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|
| G1 | not_started | in_scope_now | Worker D | `GAPS.md` | `11-combat-ui-warnings.md` | No dedicated combat action-level warning for non-proficient weapon attacks. | Current UX can be unclear when penalty and mastery restriction apply. | Add or verify warning signal in combat action path. | UI inspection of combat action selection/confirmation in current build. |
| G2 | not_started | support_needed_now | Worker D | `GAPS.md` | `START-HERE.md`, `NORTH_STAR.md` | No fresh rendered verification after prior logic proof. | Stale verification weakens confidence in warning/penalty consistency across UI. | Run focused render+regression pass for warning texts, tooltips, and combat roll results. | Test evidence attached to a future audit/proof note. |

## Next Checks

- Confirm whether `useActionExecutor.ts` and combat UI warning surfacing are fully aligned when using non-proficient selected weapons.
- Verify no regression in existing weapon mastery gating and proficiency bonus behavior by re-running relevant combat tests.

## Update Rules

- Update this tracker before starting the next operational slice.
- Keep every active/blocked/waiting row with owner, evidence, and next proof.
- Keep gaps in-project when the task cannot move without them; send unrelated gaps to `docs/projects/GLOBAL_GAPS.md`.
