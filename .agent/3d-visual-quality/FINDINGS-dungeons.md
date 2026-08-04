# Findings — Dungeons (3D + 2D)

Orchestrator notes for dungeon builders/critics. Keep separate from
`targets/dungeons.md` because the critic owns that file. Everything here is
**measured** from captured frames with `node scripts/visual/frame-stats.mjs`
(the committed quantitative rig), which reports luma percentiles, dark/black
fractions, and the channel tint of the darkness floor. A vision-capable critic
must still confirm craft quality; these numbers are the objective half.

## 2026-08-03 — A6/A4 darkness-floor baseline + crypt fix (measured)

Scenarios: `dungeon-3d-entrance-room` (crypt, seed 20260730), same camera.
Before/after from the live surface, deterministic seed + camera.

| Metric | crypt BEFORE | crypt AFTER | frost (already-good reference) |
|---|---|---|---|
| p50 luma | 2 | 2 | 15 |
| mean luma | 9.2 | 10.7 | 24 |
| dark (<10) frac | 0.863 | **0.635** | 0.442 |
| pure-black frac | 0.327 | 0.319 | 0.159 |
| darkness floor RGB (<24) | 7/3/2 (warm) | 8/4/5 (still warm) | 3/9/17 (cool) |
| colourful frac | 0.069 | 0.069 | 0.161 |

Read:
- The critic's A6 verdict ("half the frame dead pure-black, no cool tint") is
  **confirmed by the crypt's before numbers**: p50 luma 2, 33% pure-black, 86%
  dark, darkness floor warm (7/3/2).
- Applied change: crypt `background` `#08070c → #0d1220` and `fog`
  `#1a1526 → #26314d` (lift off zero, cool blue tint) in
  `src/components/BattleMap/dungeon/dungeonSceneModel.ts`. **Effect: 23% of the
  frame lifted out of the <10 near-black band (86%→64%) with torch pools fully
  intact (colourful frac unchanged 6.9%).** No mid-tone flattening by that
  metric. `dungeonSceneModel.test.ts` 24/24 pass.
- **The crypt is the warm-dark outlier, not the rule.** Frost at the same seed
  already shows the target shape: p50 ~15, cool darkness floor (3/9/17), 16%
  pure black. Conclusion: do NOT touch the other themes on this axis; only crypt
  was dead-dark. The crypt's residual warm floor (8/4/5) is from warm torch spill
  landing in the <24 band; nudging it cooler without lifting torch pools needs a
  **vision read** — do not blind-tune further here.

## 2026-08-03 — linework scenario (B-targets) rig status

- The 07-30 finding "`dungeon-parchment-linework` is byte-identical to the
  sheet" is **NOT reproduced on the current tree**. Re-captured:
  - `linework` is deterministic across two runs (md5 `12C01CA1…` both), and
    **byte-distinct** from `sheet` (`04400FD3…`).
  - Frame-stats support a real zoom: linework mean luma 94.9 < sheet 105.3,
    low-frac 0.617 > 0.5675, colourful 0.343 < 0.419 (denser ink / less paper).
  - A vision read is still the definitive check that the zoom framing is the
    intended "critique-distance" shot, but the byte-identical blocker is gone.

## Scenarios added this session (B6 + cross-theme)

- `dungeon-parchment-sheet-frost` — same seed, frost theme → B6 theme-palette
  triad now scorable against the crypt sheet.
- `dungeon-3d-entrance-room-frost` — same entrance camera, frost theme → lets
  the A-series atmosphere checks run across two themes (and demonstrates the
  target darkness shape vs crypt, see table above).

## 2026-08-03 (second pass) — A2 shadows, corridor scenario, A5 postprocessing (all measured)

**A2 — torch shadows now wired.** `<Canvas>` gained `shadows`; each torch `pointLight`
gained `castShadow` + `shadow-mapSize 512²` + bias. Floor/walls already `receiveShadow`.
Measured via `tools/dungeon-profile` (GPU RTX 2070 SUPER, seed 42 crypt), vs the committed
2026-07-19 baseline (no shadows):

| Metric | baseline (no shadows) | +shadows |
|---|---|---|
| trueRenderCost worst-case | 2.49 ms (402 fps) | **3.97 ms (252 fps)** |
| live p50/p95 | 16.8/18 ms | 16.9/18 ms (no drop) |
| textures | 0 | 11 (shadow maps) |
| budget | — | meets 30 fps floor by ~8× |

**Corridor-depth scenario added** — `dungeon-3d-corridor-depth` (objective preset +
dolly, same seed/theme). Captures a receding deep shot (mean luma 20, colourful 18%);
an approximation until a true corridor camera preset exists.

**A5 — N8AO + Bloom + ToneMapping + Vignette wired** (copied BattleMap3D dark profile;
`aoRadius=1.8` is a wiring default that MUST be vision-re-measured for this camera).
Measured entrance-room crypt frame (frame-stats):

| Metric | pre-AO (A4/A6 fix) | +postprocessing (exposure 1.35, vignette 0.3) |
|---|---|---|
| pure-black frac | 0.319 | **0.176** |
| dark (<10) frac | 0.635 | 0.668 |
| colourful (torch pools) | 0.069 | 0.066 |

- Net read: pure-black ~halved, dark(<10) roughly flat, torch pools intact. The harsher
  first pass (vignette 0.6, no exposure) measurably undid the A6 lift (dark<10 → 0.88),
  so it was pulled to exposure 1.35 + vignette 0.3; that is the state above.
- Perf with the full stack: worst-case true render **7.13 ms (140 fps)** — meets the 30 fps
  floor by ~4.7× and the 60 fps target. (Renderer `calls=1` is the composer composite read.)
- ⚠️ **Vision gate:** AO seating at radius 1.8 and the overall ACES tonality are NOT
  craft-verified here — a vision critic must confirm they read as grounded gloom, not
  darkened mud, and re-tune `aoRadius`/exposure if needed.

**A9 — marker hygiene implemented.** Always-on entrance/objective `SceneMarker`s are
gameplay chrome; they now hide when a capture scenario sets `window.__dungeon3dMarkers =
false` (default keeps them for product users). The three 3D dungeon scenarios
(entrance, corridor, frost) set it before the final readback. Verified: scene renders
clean (`__dungeon3dReady`, `CONSOLE_ERRORS=0` probe), 56 tests green, post-capture frame
matches the clean postprocessing profile (dark<10 0.667, pure-black 0.176).

**Page-fill (B5/B7/B8) — exact baseline measured; resize is vision-gated.** Added a dev
layout probe (`window.__dungeonSheetLayout`) to `compositor.ts renderSheet` so the page-fill
ratio is an exact number, not a pixel guess (parchment texture defeats simple thresholds).
Crypt sheet, seed 20260730:

| Metric | Value |
|---|---|
| plate | 800×1131 CSS |
| art box (Box A) | 519×879 |
| map footprint (cell=3) | 543×483 |
| **fillRatioPlate** | **0.29** (confirms critic's "~1/3") |
| fillRatioArtBox | 0.575 |

Diagnosis: the plan is placed in the tall left-of-rail Box A despite being short/wide (only
57% of the art box used), and the 4-9° rotation inflates the footprint (rotW 605 > artBox 519,
pulling `fit` to 0.857 and shrinking it). **The actual resize** (better box selection by plan
aspect, or letting `cell`/`fit` up-scale past the floor, with stroke weights re-baked so the
ink keeps its hand weight) is a **vision-gated layout change** — do not blind-tune the
hand-inked sheet. A future pass should raise `fillRatioPlate` toward ~0.6-0.75 and verify the
same probe + a render.

## Still needed (ranked)

1. **Vision-capable craft review** of the crypt-after frame (A1 stone material,
   A2 torch shadows, A3, A7 temperature split, A8 flame colour, and whether the
   residual warm floor reads as acceptable gloom) — blocked in capless sessions.
2. **Corridor-depth 3D scenario** — a shot down a long corridor toward a lit
   mouth, for measuring A4 fog + A6 darkness along depth (needs a corridor camera
   preset; not done here).
3. B3 hatching-vs-stipple and the 2D "page fill" decisions remain Remy calls
   (from the prior critic round).
