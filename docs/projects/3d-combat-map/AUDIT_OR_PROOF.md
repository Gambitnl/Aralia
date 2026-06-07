# 3D Combat Map Audit / Proof

Status: active
Last updated: 2026-06-07

This file holds durable proof summaries and the standing acceptance checks for the
3D combat map. It is not a raw log archive — keep entries concise and link to the
code surface that the proof exercises.

## Next-Check List (durable definitions)

These are the two standing checks introduced by tracker task T4. The compact index
lives in `TRACKER.md` (Next-Check List For Future Slices); the full steps and
pass/fail bars live here so the proof survives the chat session.

### NC1 — Visual smoke check (post-processing / console cleanliness)

- Type: visual smoke.
- Guards: G2.
- Primary surface: `src/components/BattleMap/BattleMap3D.tsx` — `<Canvas>` (`:364`),
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

### NC2 — Integration check (pop-out lifecycle + render-mode restore)

- Type: integration.
- Guards: G3.
- Primary surface: `src/components/Combat/CombatView.tsx` — `renderMode` state
  (`:141`), inline toggle (`:583`), pop-out toggle (`:485`), pop-out container
  (`:477-503`).
- Steps:
  1. Enter combat and set render mode to 3D.
  2. Trigger the battle-map pop-out.
  3. Interact inside the pop-out (move/select a token, advance a turn).
  4. Return from / close the pop-out back to the embedded view.
- Pass bar: `renderMode` is still `3d` after the round trip, turn order and the
  selected token persist, and the 2D⇄3D toggle still works afterward.
- Fail bar: render mode silently reverts to 2D, the 3D canvas fails to remount,
  or combat lifecycle state (turn/selection) is lost.
- Evidence to record here when run: one-line result + before/after screenshots or
  a captured state note (date, pass/fail).

## Proof Log

| Date | Check | Result | Evidence |
|---|---|---|---|
| 2026-06-07 | T4 docs | NC1/NC2 defined and wired to G2/G3 | This file + `TRACKER.md` Next-Check List |

## Findings

### F-2026-06-07-01 — SSAO/NormalPass already removed in code (G2 reclassification)

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
