# 3D Visual Quality — Gap Registry

Issues found during visual quality work that are real but out of scope.
These should be addressed in a follow-up pass, not during this visual quality sprint.

> Rule: Record immediately. Do not fix. Do not get distracted. Review at end.

## Gaps

| # | Issue | Found During | File(s) | Impact | Why Out of Scope |
|---|-------|-------------|---------|--------|------------------|
| 1 | SSAO "NormalPass" console error spam | Baseline audit | BattleMap3D.tsx PostProcessingStack | 8+ error lines per render cycle. Non-crashing but noisy. | Investigated in Task #6 — if it can't be fixed there, becomes a gap to revisit. |
| 2 | CombatView pop-out window doesn't support 3D toggle | Baseline audit | CombatView.tsx lines 445-465 | Pop-out WindowFrame renders BattleMap3D but the toggle state isn't synced if user switches while popped out | UX issue, not visual quality |
| 3 | Duplicate React key warnings in console | Baseline audit | Multiple components | "Encountered two children with the same key" — ~26 errors on page load | Pre-existing bug, not related to 3D rendering |
| 4 | Terrain click handler doesn't account for height offset | Baseline audit | TerrainMesh.tsx line 270-271 | `Math.floor(px / TILE_SIZE)` ignores that heightfield displaces vertices, so clicks on steep slopes may register on wrong tile | Functional bug, not visual |
| 5 | BattleMapDemo.tsx has no biome prop on BattleMap3D | Baseline audit | BattleMapDemo.tsx | Biome selector changes mapData but BattleMap3D reads biome from `mapData.theme` which may not update consistently | Functional, not visual |
