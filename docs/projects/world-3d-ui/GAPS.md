# World 3D UI Gap Registry

Status: active
Last updated: 2026-06-10 (iteration 4 monitor pass: scoped World3D suite green 25/25; seeded Gap Log row G1 closed after bounded sweep â€” no open project gaps)

North Star: `docs/projects/world-3d-ui/NORTH_STAR.md`

Scope: unresolved findings for the **2Dâ†”3D transition + in-3D HUD** layer. Rendering-engine
gaps belong in `docs/projects/world3d/GAPS.md`; generation gaps in `docs/projects/worldsim-service/GAPS.md`.

Merge note (2026-06-10, D5 in `docs/projects/DECISION_BLITZ_2026-06-10.md`): this surface
now also owns all 3D entrypoint contracts (modal launch, phase transition, close/focus
policy) from the merged `three-d-modal` project. Its open items â€” global-vs-submap
entry/close/focus policy, the shared `onMove` movement contract, submap 3D launch/close
test coverage, and the CMA-G14 `Scene3D.tsx`/`PropsLayer.tsx` split route â€” remain listed
in `docs/projects/three-d-modal/GAPS.md` (merged-reference) and should be triaged into
W3DUI rows when work on them is scheduled.

| Gap ID | Status | Classification | Owner | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|

Use this file for durable unresolved findings that are too important or too large to live only in the tracker and that genuinely belong to this project. Put cross-project, orphaned, or out-of-current-scope gaps in the global gap tracker instead.

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|

## Classification Reference

| Classification | Use when |
|---|---|
| `in_scope_now` | The task cannot honestly complete without it. |
| `support_needed_now` | It is not the product task, but the task cannot move without it. |
| `adjacent_follow_up` | Useful and related, but not required for this slice. |
| `out_of_scope` | It should not be part of this project/task. |
| `blocked_human_decision` | A real owner/operator choice is needed. |
| `blocked_external_state` | Waiting on PR, CI, vendor, service, environment, or another person. |

## Update Rules

- Keep each gap tied to evidence and a next proof/check.
- Link back to a global gap ID when this project imports one.
- If the current project should not own a gap, add or update the global gap tracker instead of keeping the gap here.
- Do not mark a gap done unless completion evidence is linked or summarized.
- Add dated testimony or status notes to an existing gap instead of opening duplicates.
