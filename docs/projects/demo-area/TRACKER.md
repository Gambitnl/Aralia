# Demo Area Living Tracker

Status: reference-only; retention decision recorded 2026-06-10 (retain as reference artifact)
Last updated: 2026-06-10

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
| T1 | done | Create this project docs shell and run a narrow demo/dev/test scan | Worker B | 2026-05-31 | `docs/projects/PROJECT_TRACKER.md`, `src/App.tsx` | Keep only scope files in docs/projects/demo-area and record scan result | Presence of the three required files and evidence-backed status wording |
| T2 | done | Classify Demo Area status after scan | Worker B | 2026-05-31 | `src/components/demo/CombatMessagingDemo.tsx`, `src/App.tsx`, `src/components/debug/DevMenu.tsx` | Set project classification as reference-only with retention/removal decision pending | `src/components/demo/CombatMessagingDemo.tsx` remains unreferenced by App/state |
| T3 | done | Resolve demo area retention decision | Human owner | 2026-06-10 | `docs/projects/demo-area/GAPS.md`, `docs/projects/PROJECT_TRACKER.md`, `docs/projects/DECISION_BLITZ_2026-06-10.md` D19 | Decided 2026-06-10 (Remy, D19): retain `CombatMessagingDemo.tsx` as a reference artifact — no re-home, no removal; no runtime change required | Decision recorded in DECISIONS.md D2 and NORTH_STAR Decision section |

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G1 | done | blocked_human_decision | Worker B | docs/projects/demo-area/GAPS.md | registry scan + code scan | Decide whether `src/components/demo/CombatMessagingDemo.tsx` should be retained, moved, or removed | `src/components/demo/CombatMessagingDemo.tsx` has no imports/actions/phase wiring; `docs/projects/DECISION_BLITZ_2026-06-10.md` D19 | Prevents unintentional behavioral loss or stale scope claims | Decided 2026-06-10 (Remy, D19): retain as a reference artifact; no deletion or re-homing | Decision recorded 2026-06-10 in DECISIONS.md and NORTH_STAR |
| G2 | done | support_needed_now | Worker B | `src/types/core.ts`, `docs/projects/PROJECT_TRACKER.md` | scan | Reconcile registry evidence path (`src/components/demo`) with active demo implementations under `components/BattleMap` and `components/World3D` | `docs/projects/PROJECT_TRACKER.md`, `src/App.tsx` | Keeps project registry accurate and discoverable | Decided 2026-06-11: Mounted CombatMessagingDemo to DevMenu and verified it runs, keeping the registry path src/components/demo aligned | Registry/path evidence check complete |

## Update Rules

- Update this tracker before starting any significant feature-scoped slice.
- Keep status fields current with owner and next proof.
- Keep durable unresolved items in `docs/projects/demo-area/GAPS.md`.
