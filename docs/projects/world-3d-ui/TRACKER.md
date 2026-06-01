# World 3D UI Tracker

Status: active
Last updated: 2026-06-01

North Star: `docs/projects/world-3d-ui/NORTH_STAR.md`
Scope (clarified 2026-06-01): the **2D↔3D transition + in-3D HUD** layer that drives and
overlays the `world3d` rendering engine. Gaps are authoritative in
`docs/projects/world-3d-ui/GAPS.md`.

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
| T1 | done | Initial living-project scaffold + doc refresh | Worker B | 2026-05-31 | `docs/projects/world-3d-ui/` | — | protocol files exist |
| T4 | active | Fix `?phase=world3d` cold-load entry bounce (intermittent → main_menu) | claude (claimed) | 2026-06-01 | live debug; app-level phase race (GAPS W3DUI-5) | Instrument mount-time phase dispatch order; fix the override | 3 consecutive clean cold loads stick on world3d |
| T5 | not_started | Author Plan 4: 2D↔3D transition + camera dive + scene mount/unmount handoff + `playerWorldPos` + atlas marker sync | claude (claimed) | 2026-06-01 | spec §7–§9 (GAPS W3DUI-6/7) | Draft the plan after T4 | Plan 4 doc committed + reviewed |
| T6 | not_started | Define + build the in-3D HUD (control panel, view-mode toggle, nameplates, minimap, debug) | unassigned | 2026-06-01 | `World3DDemo` header only (GAPS W3DUI-8) | Scope HUD in Plan 4 | HUD mounts over scene without disturbing rendering |

Gaps are tracked in `docs/projects/world-3d-ui/GAPS.md` (W3DUI-1..8) — see it for the full gap log, including the routed entry/transition gaps from `world3d`.

## Update Rules

- Update this tracker before starting any significant feature-scoped slice.
- Keep active/blocked/waiting rows current with owner, date, and next proof.
- Keep unresolved long-lived gaps in `docs/projects/world-3d-ui/GAPS.md`.
