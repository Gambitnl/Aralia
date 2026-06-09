# 3D Combat Map Audit / Proof

Status: active
Last updated: 2026-06-08

This file holds durable proof summaries and the standing acceptance checks for the
3D combat map. It is not a raw log archive - keep entries concise and link to the
code surface that the proof exercises.

## Next-Check List (durable definitions)

These are the two standing checks introduced by tracker task T4. The compact index
lives in `TRACKER.md` (Next-Check List For Future Slices); the full steps and
pass/fail bars live here so the proof survives the chat session.

### NC1 - Visual smoke check (post-processing / console cleanliness)

- Type: visual smoke.
- Guards: G2.
- Primary surface: `src/components/BattleMap/BattleMap3D.tsx` - `<Canvas>` (`:364`),
  `PostProcessingStack` Bloom+Vignette (`:238-251`), `ContactShadows` (`:437`).
- Steps:
  1. Start the app and enter a combat encounter that produces a battle map.
  2. Toggle the map to 3D (`CombatView` 2D/3D toggle, `CombatView.tsx:583`).
  3. Let the scene render for ~5 seconds while moving the camera (orbit/zoom).
  4. Capture the browser console for that window.
- Pass bar: the scene shows terrain, grid overlay, and character actors, and the
  console logs **no repeated** `GL_INVALID_OPERATION`, `glBlitFramebuffer`,
  `SSAO`, or `NormalPass` errors across frames.
- Fail bar: any per-frame WebGL/postprocessing error, a blank canvas, or context loss.
- Evidence to record here when run: one-line result + a short console excerpt
  (date, resolution, pass/fail).

### NC2 - Integration check (pop-out lifecycle + render-mode restore)

- Type: integration.
- Guards: G3.
- Primary surface: `src/components/Combat/CombatView.tsx` - `renderMode` state
  (`:141`), inline toggle (`:583`), pop-out toggle (`:485`), pop-out container
  (`:477-503`).
- Steps:
  1. Enter combat and set render mode to 3D.
  2. Trigger the battle-map pop-out.
  3. Interact inside the pop-out (move/select a token, advance a turn).
  4. Return from / close the pop-out back to the embedded view.
- Pass bar: `renderMode` is still `3d` after the round trip, turn order and the
  selected token persist, and the 2D<-3D toggle still works afterward.
- Fail bar: render mode silently reverts to 2D, the 3D canvas fails to remount,
  or combat lifecycle state (turn/selection) is lost.
- Evidence to record here when run: one-line result + before/after screenshots or
  a captured state note (date, pass/fail).

## Proof Log

| Date | Check | Result | Evidence |
|---|---|---|---|
| 2026-06-07 | T4 docs | NC1/NC2 defined and wired to G2/G3 | This file + `TRACKER.md` Next-Check List |
| 2026-06-08 | G4 structural clamp | pass | `src/components/BattleMap/terrain/terrainTileMapping.test.ts`, `src/components/BattleMap/terrain/__tests__/TerrainMesh.import.test.ts` |
| 2026-06-08 | NC1 browser visual smoke | pass for original post-processing guard | Battle Map Demo loaded from saved party state, 3D view mounted one 766x1068 canvas, and the console showed no repeated `GL_INVALID_OPERATION`, `glBlitFramebuffer`, `SSAO`, or `NormalPass` errors. A single terrain shader warning was routed to G6 instead of blocking G2 closure. |
| 2026-06-08 | NC1 independent reproduction (Claude/Opus) | pass | Second headless run (port 5174, forest, canvas 918px, software GL): 0 `GL_INVALID_OPERATION`/`glBlitFramebuffer`/`SSAO`/`NormalPass` across a ~6.5s camera-movement window; settled screenshot shows terrain+tree variety+gold active actor+red enemy rings. Reusable harness: `.agent/3d-visual-quality/captures/nc1-console.mjs`, `nc1-forest.png`. Corroborates G2 closure. |
| 2026-06-08 | NC2 integration | **BLOCKED (not run)** | Offline autosave fixture loads the World3D exploration surface (Controls→Open Map/Exit to Menu, 3D, Atlas, CHAT History) with no ActionPane System Menu, so the headless Dev Menu → Generate Encounter → Simulate Battle → `CombatView` path is unreachable. Ready harness once a 2D-exploration fixture exists: `.agent/3d-visual-quality/captures/nc2-combatview.mjs`. See F-2026-06-08-03; G3 stays open. |

## Findings

### F-2026-06-07-01 - SSAO/NormalPass already removed in code (G2 reclassification)

- Source: `src/components/BattleMap/BattleMap3D.tsx:228-251`.
- Finding: the post-processing stack no longer contains SSAO or `enableNormalPass`.
  A documented removal comment states the SSAO + `enableNormalPass` combination
  fired `GL_INVALID_OPERATION: Read and write depth stencil attachments cannot be
  the same image` on every frame under WebGL2 + three r170 +
  `@react-three/postprocessing` 3.x, eventually exhausting the WebGL context.
  `ContactShadows` (`:437`) now provides the soft ground darkening SSAO used to give.
- Impact: G2 as originally worded ("post-processing still logs SSAO NormalPass
  errors") is stale. Reclassified rather than closed because the live
  console-clean confirmation (NC1) has not been re-run in this docs-only pass.
- Next proof: NC1.

### F-2026-06-08-01 - Terrain hit mapping now clamps edge drift instead of dropping border clicks

- Source: `src/components/BattleMap/terrain/terrainTileMapping.ts`,
  `src/components/BattleMap/terrain/TerrainMesh.tsx`.
- Finding: the 3D terrain click path now routes through a small helper that
  floors the raycast hit in tile units and clamps the result back into the
  playable grid. That keeps tiny floating-point drift at the map edge from
  turning a valid border click into a missing tile lookup.
- Impact: this narrows G4 from "coarse world-to-tile math" to "live slope proof
  still pending". The structural hit mapping is now covered by
  `terrainTileMapping.test.ts`; the remaining open question is whether the
  browser raycast path on a steep slope matches the intended visual tile in a
  live pass.
- Next proof: browser slope-click confirmation if the scene can be run; otherwise
  keep the structural clamp proof as the durable evidence for the current slice.

### F-2026-06-08-02 - NC1 browser smoke closes the stale SSAO/NormalPass gap

- Source: Browser Battle Map Demo at `http://localhost:3000/Aralia/?phase=battle_map_demo`.
- Setup: loaded an existing saved journey to provide a party, enabled Dev Mode,
  opened Battle Map Demo, and toggled `3D View`.
- Result: pass for the original G2/NC1 guard. The 3D scene mounted one canvas
  measuring approximately 766x1068 CSS pixels. The console did not repeat the
  previous `GL_INVALID_OPERATION`, `glBlitFramebuffer`, `SSAO`, or `NormalPass`
  errors during the render wait.
- Non-blocking finding: the console emitted one shader warning:
  `THREE.WebGLProgram ... warning X4000: use of potentially uninitialized variable (f_getTerrainColor)`.
  This is tracked separately as G6 because it is not the stale SSAO/NormalPass
  failure mode and did not prevent rendering.
- Next proof: G4 browser slope-click confirmation or NC2 pop-out lifecycle check.

### F-2026-06-08-03 - NC2 cannot be reached headlessly from the current save fixture (World3D surface)

- Source: headless drive attempts via `.agent/3d-visual-quality/captures/nc2-combatview.mjs`
  plus a clickable-element diagnostic against the loaded `storageState` autosave.
- Finding: the offline autosave (`aralia_rpg_autosave`, origin `http://localhost:5174`)
  loads into the **World3D exploration surface**, not the classic 2D exploration view.
  The only clickable controls in that phase are `Controls ▼` (→ `Open Map`,
  `Exit to Menu`), `3D`, `Atlas`, and `CHAT History`. There is **no ActionPane
  System Menu** in the DOM, so the in-game path to combat
  (System Menu → enable Dev Mode → Dev Menu → `Generate Encounter` → bestiary
  auto-roll → `Simulate Battle` → `START_BATTLE_MAP_ENCOUNTER` → `CombatView`) is
  unreachable. Toggling the world `3D` button and expanding `Controls` did not
  surface the System Menu. Reaching combat by reverse-engineering the World3D→combat
  trigger is out of this project's scope (NORTH_STAR: do not absorb World3D).
- Impact: NC2 (G3) and the CombatView-hosted variant of NC1 could not be empirically
  run this pass. The NC2 harness itself is complete and verified up to the
  System-Menu step; only the combat-reachability fixture is missing.
- Corroborating static evidence (lowers but does not eliminate G3 risk): the
  `CombatView` 3D path is structurally complete and was reworked after the stale
  2026-05-22 ".agent/3d-visual-quality task 24" note ("CombatView 3D broken — R3F
  Canvas silently fails in ErrorBoundary"). Current code: shared `renderMode`
  (`CombatView.tsx:141`), inline `BattleMap3D` (`:605`) and pop-out `BattleMap3D`
  (`:492`) inside `ErrorBoundary` (`:600`), with the map pane deliberately given a
  stable measured box (T5, `:566-570`) — the canvas-cannot-measure-its-box failure
  mode task 24 described. NC1 independently proves the same `BattleMap3D` component
  mounts and renders console-clean. So the residual NC2 risk is narrowed to the
  CombatView host-layout mount + pop-out remount, not the renderer itself.
- Next proof (unblock options, pick one): (a) capture a 2D-exploration save fixture
  (`save-bridge.mjs` while the app is in classic exploration) so the System Menu is
  present; (b) add a small dev hook to jump straight to a battle-map encounter; or
  (c) script the World3D→combat trigger if/when that path is documented. Then run
  `nc2-combatview.mjs` and record canvas-vs-ErrorBoundary-fallback + pop-out
  renderMode persistence.
