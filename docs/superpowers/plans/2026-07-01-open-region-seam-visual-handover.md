# Handover — see the open-region seam fix in the live 3D world

**Date:** 2026-07-01
**Owner of prior work:** (this session)
**Goal for you (next session):** get a *visual, in-game 3D* confirmation of the region seam-continuity fix.
**One-line status:** the code fix is done, tested, and eyeballed offline; the in-engine view of the actual seam is **blocked** on a small build (explained below).

---

## 1. What already landed (don't redo)

The big landforms (ridges/valleys) in each map region used to be rolled with per-region
dice on a per-region grid, so two neighbouring regions did not line up — a ~350 ft cliff
wherever the world would hand off region→region. Fixed by making that relief noise a pure
function of **world position** (world seed + octave, world-feet indexed), mirroring the trick
the fine-detail layer already used.

- **Changed:** `src/systems/worldforge/region/generateRegion.ts` (the `generateHeightfield`
  octave loop — now uses `makeWorldFeetNoise` from `../local/worldFeetNoise`).
- **Test (permanent numeric proof):** `generateRegion — cross-region seam continuity` in
  `src/systems/worldforge/region/__tests__/generateRegion.test.ts` (mismatch at a shared
  point 0.177 → <0.01).
- **Offline visual proof:** `.agent/scratch/seam-proof/before.png` and `after.png`
  (flat-atlas strip straddling a region boundary; before = collision, after = continuous).
- **Goldens re-frozen (intentional):** region golden hash, region smoothness-laplacian,
  generateLocal golden snapshot, and the pipeline chain golden
  (`src/systems/worldforge/__integration__/pipeline.test.ts`, dated note added). Smoothness
  + determinism invariants stayed green.
- **Known unrelated failure:** `townEngine.test.ts` "a dock pier reaches seaward" fails on
  BOTH old and new code — pre-existing, not caused by this work. Leave it.

Full design context: `docs/superpowers/specs/2026-06-29-open-region-wilderness-design.md`.

---

## 2. The blocker (read this before trying to screenshot the seam)

**You cannot see the cross-region seam in the live game today**, because the live 3D ground
mode is **bounded**: `World3DWrapper.tsx` anchors on ONE FMG cell and builds ONE ~3,000 ft
`LocalArtifact` with a hard edge fall-off (`EDGE_FALL_M` in `groundChunkLoader.ts`). Walking
to the edge loads *nothing* — the neighbour region is never streamed in. There is no place in
the shipping game where two regions are rendered adjacent, so there is no seam to look at yet.

The fix is **preparatory**: it makes the underlying terrain data continuous so that when the
streamer *is* built, regions join with no cliff. Seeing that in-engine requires building the
streamer (the "seam-first vertical slice").

So there are two tracks. Pick based on what Remy wants.

---

## 3. Track A — eyeball the NEW relief in one region, live, now (quick, no new code)

This does NOT show the seam. It confirms the new noise looks good in-engine (no regression:
ridges read as natural landforms, not clouds/speckle, no artifacts).

1. Start the dev server (preview tool): launch config **`dev:preview`** (port 5176) from
   `.claude/launch.json`, or `dev` (5174). Use `preview_start`.
2. Enter 3D ground via deep link. The existing capture rig uses:
   `http://localhost:5176/Aralia/?phase=world3d&ground=1&gx=16&gy=4`
   ⚠️ **Verify the params first.** The legacy 30×20 grid was fully retired 2026-07-01, so
   `gx`/`gy` ground-addressing may have changed — confirm the current mapping in
   `src/hooks/useHistorySync.ts` and `World3DWrapper.tsx` before trusting that URL.
3. Capture headlessly (see §5 — `preview_screenshot` HANGS on the R3F canvas, do not use it):
   ```
   URL='http://localhost:5176/Aralia/?phase=world3d&ground=1&gx=16&gy=4' \
   OUT=relief-check WHEEL=6 TILT=120 \
   node .agent/scratch/shootGroundTown.mjs
   ```
   Output PNG lands next to the script. Eyeball: coherent ridge/valley structure, smooth,
   no seams within the cell.

---

## 4. Track B — actually SEE the seam (the real goal; needs the seam-first slice)

This is the "seam-first vertical slice" from the design spec: make the ground mode load a
neighbour region and place it adjacent, so you can walk across the boundary. Minimum build:

1. In the ground loader (`groundChunkLoader.ts` / `World3DWrapper.tsx`), when the player nears
   a locale edge, generate the **neighbour** region+locale (reuse `getWorldforgeLocalForCell`)
   and register it at the correct world-space offset (locale origins must be world-aligned).
2. Remove/soften the `EDGE_FALL_M` fall-off at the shared border so the two locales' heights
   (now continuous thanks to this fix) render as one surface.
3. Bare ground only — no scenery/vistas/water yet (per the agreed risk-ordered slice).
4. Spawn the player straddling a region boundary and capture with the shoot rig + camera pose.

**Where to pick a boundary:** at canonical scale a 25,000 ft region window is *smaller* than
one atlas cell (see the WF-G4 note in `generateRegion.ts`), so region windows don't naturally
tile — the slice must decide the tiling/offset scheme. Easiest first proof: force two adjacent
locales at a test-ish scale where windows overlap (the offline proof used `feetPerPixel=1000`),
or hard-code two neighbour cells and offset them by their world-feet delta.

**Residual caveat to keep in mind:** this fix removed the *dominant* (noise) discontinuity.
A *small* second one remains — the coarse IDW base averages a slightly different set of nearby
map cells on each side of a region switch. Expected to be minor (tens of feet at most); assess
it empirically once the slice renders. If visible, the follow-up is to standardize region
membership by world position.

---

## 5. Gotchas (from prior 3D-verification sessions — will bite you)

- **`preview_screenshot` hangs on the R3F/three.js canvas.** Capture via headless Playwright
  (`.agent/scratch/shootGroundTown.mjs`) or an in-page `requestAnimationFrame` readback. Never
  the preview screenshot tool for the 3D scene.
- **`preview_console_logs` is stale for world3d.** Verify acceptance via in-page deterministic
  replay, not the console buffer.
- **React StrictMode double-mounts** and can clobber one-shot map-drill / entry signals — if a
  one-shot "enter here" signal misfires, that's why.
- **Viewport fill:** the 3D world can render stuck in the top ~520px if a height:100% chain
  collapses under `min-h-screen`; the fix was the `TransitionController` root → `100dvh`. If the
  canvas looks letterboxed, check that.
- **Player cell ≠ town cell:** in ground mode the player's atlas cell is often *adjacent* to a
  town's cell; derive town-related things from `groundTownBurgs`, not `playerAtlasCell`.

---

## 6. Definition of done for this handover

- **Track A done:** a live 3D screenshot of one region's ground showing natural, smooth relief
  (no regression from the noise change).
- **Track B done (the real goal):** a live 3D screenshot of the player standing at a region
  boundary with the ground flowing across it seamlessly — no cliff — matching what
  `.agent/scratch/seam-proof/after.png` shows offline.

Memory pointer already updated: `open-region-wilderness-design.md` ("FIRST FIX LANDED").

---

## 7. RESULTS (2026-07-01, follow-on session) — BOTH TRACKS DONE

**Track A — done.** Live captures with the new relief in-engine:
`.agent/scratch/relief-town-wide.png` (rolling landform overview, town window),
`relief-fixed-src.png` (river valley window). Natural coherent relief, no speckle, no
artifacts, no in-cell seams.

**Track B — done via the stitched-seam probe.** New deep link
`?phase=world3d&ground=1&seam=1` (World3DDemo): picks the HILLIEST adjacent land-cell
pair, generates each side's own region, builds one locale per side flanking the shared
boundary, stitches them (`src/systems/worldforge/local/stitchLocalArtifacts.ts`) and
spawns ON the seam. The join sits mid-array — no `EDGE_FALL_M` masking. Captures:
`.agent/scratch/seam-along.png` (looking down the boundary line), `seam-cross.png`
(looking across it), `seam-live-hilly*.png`. **No cliff; the boundary is invisible.**
Probe module: `src/systems/worldforge/bridge/seamProbe.ts` (+ tests, all TDD'd green).

**Residual (the §4 caveat) measured empirically:** the `[seamProbe]` console line +
`seamProbe.test.ts` report max |regionA−regionB| at shared boundary points:
~1.4 ft on flat coast, 17–37 ft on the hilliest pairs — it SCALES WITH HEIGHT (IDW
membership term). Regression tripwire frozen at <50 ft. Follow-up task spawned:
standardize region membership by world position → then tighten to <1 ft.

**Bugs found and fixed along the way:**
- World3DDemo viewport collapse (R3F canvas squashed to a 150px strip under App's
  `min-h-screen`): fixed in source — demo root `100dvh` + absolute-inset scene slot.
- Mojibake em-dash in the demo header string.

**Bugs found and flagged (chips spawned, not fixed here):**
- Chunk-LOD crack slivers between ground-mode terrain chunks (pre-existing, grid
  pattern — clearly distinct from the region seam).
- IDW membership residual (above).

**Known churn, NOT this work:** `pipeline.test.ts` localMaterialHash golden +
road-material test flap because a CONCURRENT agent is reworking ROCK_SLOPE/ROCK_LINE in
`generateLocal.ts` (the "mountains never read Stone" spin-off). Agora-broadcast sent
asking them to lock + re-freeze. Dock-pier townEngine failure remains pre-existing.

**Capture rig for next time:** `.agent/scratch/shootSeam.mjs` — `POSEREL='dx,dy,dz,tdx,tdy,tdz'`
drives the existing `window.__wf3dSetPose` hook (FreeRoamCameraController) for
deterministic framing; mouse WHEEL/TILT barely works on MapControls headless.

**Still open for full open-region (next slice):** dynamic neighbour streaming in the
PLAYING ground loader (`groundChunkLoader.ts`/`World3DWrapper.tsx`) and the
canonical-scale region-window tiling decision (§4).
