# World3D skip stones: a thrown stone on calm water

Verified: 2026-09-29 against `src/systems/world3d/ocean/oceanSkipMath.ts`, `oceanSkip.ts`, `oceanSkipWorker.ts`, the `lake` sea state in `oceanSeaStates.ts` and `src/components/DesignPreview/steps/sidebyside/oceanExtras/skip.ts` (ocean gauntlet, skip stones, round 2).

## What it is

Remy asked on 2026-09-28 for "a modal where i can throw rocks into the water, and see if it will or wont skip based on angle of the throw and the type of rock". It is a piece of the ocean viewer: the FFT sea on a calm `lake` sea state, a stone a person throws, the splash and rings at each touch, and a readout that says how many times it skipped and why it stopped.

It is not in the game. It is a Design Preview view, and its physics module is pure CPU code a game system could call.

## Where to open it

- The water page's header: **Skip stones** (beside "River — flow"). It opens the ocean viewer inside the window with `sea=lake&extras=skip`.
- The address `?step=water&ocean=1&sea=lake&extras=skip` (add `&full=1` for the full frame).
- The panel shows to a person and hides in captures (`navigator.webdriver`); `&skippanel=1` forces it on. It holds:
  - the stone (one list that always names the chosen stone);
  - speed, flight angle at the first touch, tilt, spin and release height;
  - the presets, Throw, Reset, the drag mode and the follow camera;
  - the readout.

## The pipeline

| Step | File | What it does |
|---|---|---|
| Physics | `src/systems/world3d/ocean/oceanSkipMath.ts` | The stones, their meshes and inertia; the water's height (flat, or the sea's own modes summed at a point); the rigid-body run; the launch solve; the end sentence; the presets; the ring table. Pure and deterministic. |
| Worker | `src/systems/world3d/ocean/oceanSkipWorker.ts` | Builds the sea's modes once and runs each throw off the main thread (1 to 4 s of CPU for the presets on the lake). |
| View | `src/systems/world3d/ocean/oceanSkip.ts` | The stone, the crown sheets and their mirror twins, the drops, the foam, and the hollow, rings and marks on the water. A pure function of the sea time. |
| Piece | `src/components/DesignPreview/steps/sidebyside/oceanExtras/skip.ts` | Mounts the view, the worker, the panel, the drag throw, the follow camera and the probe (`__OCEAN__.extras.skip`). |
| Sea | `src/systems/world3d/ocean/oceanSeaStates.ts` (`lake`) | 2 m/s over 1 km, a 7 m ripple patch (0.055-0.6 m, 0.26 of JONSWAP's energy) and a 41 m wavelet patch (0.6-20 m): Hs 3.5 cm, no fold. Each value's measurement is in its comment. |
| Tests | `src/systems/world3d/ocean/__tests__/oceanSkipMath.test.ts` | 26 tests: the published experiments, the presets, determinism, the tilt sweep, the free top, the lake, the end sentence. |

## The physics, in one paragraph

The stone is a rigid body (a 24-sided disc with a rim, or a 10 x 20 ellipsoid). Each step, every triangle is clipped at the local water plane. A wet face moving into the water takes the dynamic pressure of Rosellini, Hersen, Clanet and Bocquet (J. Fluid Mech. 543, 2005, eq. 4.2: `1/2 rho U^2 S_wet sin(alpha + beta)` along the face normal), a wet face takes the still-water pressure, and a dry face takes the same law with the air's density. A flat face's load acts at the planing center of pressure (Savitsky 1964) of its part under the raised line of the spray root (Wagner 1932), in the water and, since round 2, in the air too (thin-plate theory's quarter chord). The angular momentum integrates the torque, and between the torque kicks the orientation follows the exact torque-free motion of a symmetric top, so a spinning stone precesses and a still one pitches over. Skipping, sinking, surfing, tumbling and floating all come from these forces; the end sentence only names what happened, using the stone's own window (the steepest path and the lowest speed that bounce, found by the same model).

## The tilt at a person's speed (GG-340)

Round 1's stone held its tilt at the papers' 3.5 m/s but drifted 10 to 40 degrees a touch at a person's 12 m/s, so the best throw ended after 2 to 4 skips. Round 2 found two causes. Neither fix is a rule that holds the tilt.

1. **The free top.** The orientation step was an explicit rotation about the instant angular velocity. In a flight with no torque it moved spin into wobble: the spin fell from 188 to 157 rad/s and the wobble rose from 83 to 206 rad/s in half a second. The step now does the exact motion of a free symmetric top (Landau and Lifshitz, Mechanics, sec. 33): a turn about the stone's own axis at `L_n (1/I_axis - 1/I_perp)`, then a turn of the whole stone about the angular momentum at `|L| / I_perp`. A test holds the spin within 1% over a flight.
2. **The air's center of pressure.** The air's load on a flat face acted at the face's middle, so a flying disc had no pitching moment. Thin-plate theory puts each chordwise strip's lift at its quarter chord, `4R / (3 pi)` = 0.42 R ahead of the center for a disc. The water's load pitches the stone nose down at each touch and the air's pitches it nose up through each flight, and a spinning stone turns each into a lean to the side in opposite senses. With no spin, the stone now pitches over in the air before the first touch.

After both, on flat water at 12 m/s, a 12 degree path and a 0.3 m release (`.agent/scratch/ocean-gauntlet/skip/probe29.txt`):

| Tilt | 30 turns/s: free | 30 turns/s: tilt held | 35 turns/s: free | 35 turns/s: tilt held |
|---|---|---|---|---|
| 5 | 3 | 7 | 6 | 7 |
| 8 | 7 | 10 | 8 | 10 |
| 10 | 6 | 10 | 8 | 10 |
| 12 | 4 | 10 | 6 | 10 |
| 15 | 5 | 10 | 4 | 10 |
| 20 | 4 | 8 | 4 | 9 |
| 25 | 3 | 7 | 3 | 7 |

The best throw (tilt 10, 35 turns a second) skips 8 times over 19.7 m, with gaps of 4.7, 3.6, 2.7, 1.5, 1.0, 0.8, 0.5 and 0.5 m, and 6 to 8 times over +-0.5 m/s and +-1 degree of path. On the lake the same throw, released at 24 different sea times, skips 3 to 15 times, 9 at the median (`probe33.txt`). At a tilt of 15 to 25 the water's torque still turns the lean 5 to 15 degrees a touch (`probe30.txt`: the water's, not the air's), so that part of GG-340 stays open.

Why the best throw uses a tilt of 10 and not [C04]'s "magic" 20: 20 is the tilt of the lowest speed that skips and of the widest window of paths (this model finds both at 15 to 20). The longest runs come lower, because each touch takes about `tan(tilt)` of the vertical impulse off the forward speed. [R05]'s own many-skip runs were thrown at 7 and 10 degrees.

## What was checked against the papers

| Published | This model (round 2, `probe32.txt`) |
|---|---|
| [R05] fig. 3: stone 1 (R 2.5 cm, h 2.75 mm) at 3.5 m/s, 65 turns/s, alpha = beta = 20: bounces, 32 ms contact, tilt constant | bounces, 36 ms, tilt 19.5 at the end, bank 1.4 |
| [R05] fig. 5: no spin, alpha 35, beta 20: tumbles and dives | no rebound, tilt -33 (nose down) at the end of the touch |
| [R05] fig. 7: 10 turns/s: tilt dips to about 0 and recovers, bounces | bounces, tilt dips to 9 |
| [R05] fig. 6b / [C04]: lowest bouncing speed 2.6 m/s, least near alpha 20 | 2.23 m/s at 15, 2.24 at 20; 3.74 at 5, 4.07 at 50 |
| [R05] fig. 6c: no path over 45 bounces; widest window at alpha 20 | steepest bouncing path 42.6 at alpha 20, 35.9 at 10, 36.8 at 30, 26.8 at 40 |
| Johnson and Reid (1975): a sphere ricochets under 18 / sqrt(SG) = 11 degrees | the pebble sinks on the 15 degree preset path at 12 m/s |

The tilt sweep over flight angle and the lowest speed of seven stones against `sqrt(g h rho_s / rho_w)` are in `.agent/scratch/ocean-gauntlet/skip/sweep-r2.txt` (`sweep2.ts`).

## The presets

| Preset | The throw | Flat water | The lake (release 42.5 s) |
|---|---|---|---|
| The best throw | slate, 12 m/s, 12 degree path, tilt 10, 35 turns/s, 0.3 m | 8 skips, 19.7 m, planed | 15 skips, 21.9 m, planed |
| Too steep | a 50 degree path | 0, steep (window up to 34 degrees) | 0, steep |
| No spin | 0 turns/s | 0, tumbled (pitched to 39 degrees in the air) | 0, tumbled |
| Too slow | 2 m/s | 0, slow (needs 4.1 m/s) | 0, slow |
| A round pebble | the pebble on a 15 degree path | 0, round | 0, round |
| Pumice (floats) | pumice, 8 m/s, tilt 20, 20 turns/s | 4 skips, floated | 5 skips, floated |

## The end sentence

The readout names why a run ended: floated, round, tumbled (the attitude left the throw's, or the stone came in banked, or it still wobbled from the touches before), planed (the path grew flatter than 4 degrees), steep, slow, or rippled. Rippled (round 2) is a touch that still water would bounce at that speed, path, tilt and bank, where the lake's own slope under the touch was half a degree or more. Round 1 called every such end "too slow" and could print a speed over the one it said was needed; a test now holds that.

## The splash

Judged against a clip Remy approved on 2026-09-28: "Rock skipping in slow motion2.webm", TonyRaccoon, CC BY 3.0, Wikimedia Commons (Lake Baron, Lake Tahoe). Round 1's crown lost the judge (r-spl1-A: "cellophane", a base pinched to two points above the water, a sharp bright reflection, a sparse even sprinkle of drops, no white water). Round 2 builds:

- **The crown sheet.** Ballistic parcels launched from the rim of the stone's footprint through the contact at 0.7 of the stone's normal speed into the water. **The root:** after the stone leaves, the closing cavity feeds the sheet's foot, slower and slower (seven rows over 0.34 s, speed falling as `exp(-t / 0.07 s)`), so the crown stays joined to the water.
- **Its light.** A mix of clear water (the frame behind, bent, and the sky by Fresnel) and milky, bubbly water lit as a scattering medium, by the sheet's aeration. The milky part takes the sun on the side it faces, the sun through the sheet, a forward-scatter lobe toward the sun and the sky's light, so the crown shades itself. Aeration is high at the churned foot, in the rivulets and fine striations that run up the sheet, and at the torn top. Hard sun glints sit on the striations, which tilt the normal across the sheet.
- **The tear.** Holes open in the film from the top down; the film draws back into the striations (the ligaments, Culick's retraction), and those go too, while the drops fly on.
- **The drops: three gamma-distributed sizes.** Villermaux (2007, Annu. Rev. Fluid Mech. 39:419; Marmottant and Villermaux 2004, J. Fluid Mech. 498:73) shows a torn sheet's drops follow a gamma law of order n about 4, one per source. The view draws:
  - jet drops pinched off the fingers at the top, mean 3.4 mm (Rayleigh and Plateau: about 1.9 times a 2 mm finger);
  - rim spray from the torn film, mean 1.1 mm;
  - mist, mean 0.35 mm, and a few soft puffs of the finest mist.

  Each drop's drag time is its fall speed over g, from the fit of Atlas, Srivastava and Sekhon (1973) to Gunn and Kinzer's measurements. The count scales with the water pushed and the square of the sheet's speed; the best throw's run plans about 6,400 drops over its touches.
- **The foam.** A dense churn over the footprint while the cavity closes, then a ring that stands at the crown's foot, spreads as `0.12 m * sqrt(t)` after the crown falls, and fades out by 6 s. Worley bubble cells, broken into patches.
- **The mirror twin.** The crown's image in the calm water, dim (Fresnel at the ray's angle times 0.8), dark (0.55 of its light), short (0.7 of the crown's height, gone 14 cm under the water line) and cut into streaks by a noise that drifts along the water.
- **The hollow and the rings.** One linear capillary-gravity field (Cauchy-Poisson with surface tension and viscosity, `skipRingTable`), drawn as a factor on the water's own reflection, and a patch of churned water at each touch.

The crown's luma against the clip's, in a band of rows through the crown's lower body (`.agent/scratch/ocean-gauntlet/skip/crownband-r2.txt`, `crownBand.py`; white = luma over 185 and saturation under 0.2):

| Frame | Crown luma | Background | Difference | White share | Luma p10 / p50 / p90 |
|---|---|---|---|---|---|
| clip sk_017 | 160 | 95 | 65 | 17.7% | 125 / 159 / 195 |
| clip sk_018 | 153 | 95 | 58 | 16.2% | 103 / 158 / 194 |
| clip sk_019 | 146 | 107 | 39 | 13.4% | 94 / 151 / 190 |
| clip sk_020 | 136 | 115 | 21 | 11.9% | 85 / 133 / 190 |
| round 1, 90 ms | 160 | 119 | 41 | 35.2% | 118 / 168 / 202 |
| round 1, 130 ms (judged) | 148 | 118 | 30 | 19.3% | 105 / 142 / 191 |
| round 1, 180 ms | 134 | 121 | 13 | 6.6% | 87 / 134 / 179 |
| round 2, 90 ms | 160 | 118 | 42 | 25.3% | 121 / 165 / 202 |
| round 2, 130 ms (judged) | 159 | 117 | 42 | 20.9% | 120 / 164 / 197 |
| round 2, 180 ms | 156 | 121 | 35 | 18.8% | 117 / 163 / 194 |

Round 2's crown luma spread sits on the clip's. Its difference over the background stays under the clip's because this view's background (haze and far sea) is about 22 levels brighter than the clip's trees and dark water. The sheet's speed share, elevation, tear times, aeration, light, foam spread and mirror gains are set by eye against the clip's stills, not measured (the clip has no scale bar).

## Cost

Measured A/B at 1600 x 900, vsync off, on the shared GPU, in the same minutes (`.agent/scratch/ocean-gauntlet/skip/perfSkip.mjs`, `perfIdle.mjs`; A is the lake with only the underwater piece):

- **Idle** (mounted, no throw): no cost above the run-to-run noise (the idle skip page ran 2.7 to 3.7 ms a frame, A 2.95 to 3.7).
- **A splash in the air**, 130 and 240 ms after the first touch: +1.6 to 2.5 ms a frame over four runs (frame medians). Most of it is the renderer's CPU for the added draws and uploads (render CPU 3.3 to 4.5 ms against A's 1.7 to 2.0). The piece's own update adds up to 1.3 ms. No compute pass.
- The five judged ocean scenes and the no-extras views are unchanged to the pixel.

## Open

- **The tilt at 15 to 25 degrees (GG-340, narrowed).** The water's torque at each touch still turns the lean 5 to 15 degrees there, and the best throw's shape skips 4 times where its held tilt gives 9. A measured attitude over many touches at 10 to 12 m/s (high-speed video) would settle where the late-contact load acts.
- **The splash's set values** (speed share, elevation, tear, aeration, light, foam, mirror) have no measured source; the clip gives no scale bar.
- **The crown's shape.** It is a crown round the footprint, open at the back; the clip's side view shows a wall along the path. The judged pose looks along the path, where the two read alike; a side view is untested against the clip.
- **At most 8 sheets at once.** A touch takes a pooled sheet while its splash lives (about 0.8 s); a ninth splash in the air at one time is not drawn.
- **The lake is the ocean's water shading.** Its body color is the open sea's; a lake's greener, darker water is the surface owner's.
- **A late run.** On the live page a run that the worker returns after its release time plays from its start, over waves up to a few seconds later than the ones it skipped on (millimeters on this sea). Captures pin the release and are exact.
