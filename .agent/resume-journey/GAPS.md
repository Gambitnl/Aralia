# Resume Journey Flow — Gap Registry

Issues found during resume-journey work that are real but out of scope.

> Rule: Record immediately. Do not fix. Do not get distracted. Review at end.

## Gaps

| # | Issue | Found During | File(s) | Impact | Why Out of Scope |
|---|-------|-------------|---------|--------|------------------|
| 1 | World3D free-roam camera can pan arbitrarily far off the world grid | Task 1 audit (saved z=-881) | `FreeRoamCameraController` / `World3DScene` | The live camera has no world-bounds clamp, so the player can fly into the void; task 2 only clamps what gets dispatched/saved, not the camera itself. | Gameplay-feel change (movement constraints), not a resume defect once the persisted position is clamped. |
| 2 | Pre-2026-06-11 saves carry playerWorldPos in the legacy ×128 m/cell frame | Task 1 audit | saves written before the worldCoords METERS_PER_CELL fix | Old positions are reinterpreted in the ×1024 frame → the player resumes at a different (but in-bounds, after task 2) map spot than where they stood. One-time discontinuity per old save; no data loss. | A frame-migration heuristic (scale by 8 when saveVersion is old) is guessy; positions saved off-map were already broken. Revisit only if wrong-place resumes get reported after task 2. |
| 3 | World3D streamed-world surface renders near-featureless terrain everywhere (smooth untextured slabs, single box site markers) | Task 2 control experiment | `World3DScene` / chunk pipeline (worldforge ground-mode lane) | Resuming into 3D mode is *correct* but looks broken — a player can't tell where they are. Control: `evidence/world3d-control.png` (the demo's known-good spawn looks the same, so it's not a resume defect). | This is the worldforge campaign's 3D-ground-mode work-in-progress (Remy's flagship lane); fixing terrain fidelity belongs there, not in the resume flow. If "resume looks broken" feedback persists, consider defaulting resume to the atlas surface until ground mode lands. |
