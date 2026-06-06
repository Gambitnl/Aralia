# Demo Area Tracker

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
| T1 | done | Create this project docs shell and run a narrow demo/dev/test scan | Worker B | 2026-05-31 | `docs/projects/PROJECT_TRACKER.md`, `src/App.tsx` | Keep only scope files in docs/projects/demo-area and record scan result | Presence of the three required files and evidence-backed status wording |
| T2 | done | Classify Demo Area status after scan | Worker B | 2026-05-31 | `src/components/demo/CombatMessagingDemo.tsx`, `src/App.tsx`, `src/components/debug/DevMenu.tsx` | Set project classification as reference-only with retention/removal decision pending | `src/components/demo/CombatMessagingDemo.tsx` remains unreferenced by App/state |
| T3 | active | Resolve demo area retention decision | Worker B | 2026-06-05 | `docs/projects/demo-area/GAPS.md`, `docs/projects/PROJECT_TRACKER.md` | Decide keep/move/remove for `src/components/demo/CombatMessagingDemo.tsx`; add mount path if keeping | App route/action evidence and state transition updates |

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G1 | in_progress | blocked_human_decision | Worker B | docs/projects/demo-area/GAPS.md | registry scan + code scan | Decide whether `src/components/demo/CombatMessagingDemo.tsx` should be retained, moved, or removed | `src/components/demo/CombatMessagingDemo.tsx` has no imports/actions/phase wiring | Prevents unintentional behavioral loss or stale scope claims | Confirm decision with feature owner before any deletion or re-homing | Decision recorded and referenced in TRACKER |
| G2 | not_started | support_needed_now | Worker B | `src/types/core.ts`, `docs/projects/PROJECT_TRACKER.md` | scan | Reconcile registry evidence path (`src/components/demo`) with active demo implementations under `components/BattleMap` and `components/World3D` | `docs/projects/PROJECT_TRACKER.md`, `src/App.tsx` | Keeps project registry accurate and discoverable | Update registry path or migrate note in this project docs | Registry/path evidence check complete |

## Update Rules

- Update this tracker before starting any significant feature-scoped slice.
- Keep status fields current with owner and next proof.
- Keep durable unresolved items in `docs/projects/demo-area/GAPS.md`.
