# World3D river water: flowing rivers

Verified: 2026-10-02 (rivers round 5, step 1, the variant tunes: `uTune`, `uTuneSlab`, `setTunes`, the four levers and the slab fix, against the materials and the scene; the first blind verdict, V2 at riffle-down, recorded; the river's Node tests, 53 of 53, run in a cloud checkout, and the scoped typecheck of the five main river files, which reports 9 errors that are three 0.172's TSL typings refusing node arguments the runtime takes (`vec3(node, node)`, `vec4(node, node)`, `cross` and `dot` on a loose node, a `sample` at an `ivec2`): visible debt, left as is, since the frames were verified on 2026-09-30 with that code; see "The variant tunes (round 5)"; before it, 2026-09-30, the WebGPU port: the renderer, the TSL materials, the frames and the frame cost against the WebGL scene; see "The renderer (WebGPU)"; before it, 2026-09-29, the flip fix) against `src/systems/world3d/river/` and `src/components/World3D/water/river*.ts` (the node heights: a height handle on each control point, the mound, the pond behind a raised point and its pass, the node reports, the water's accounting, the judged fields kept for a height; before them, the live river editor: the live solver in a worker, the flow-map worker, the bed patch, the edit mode's path and bank handles, the live sliders; see "The live river editor"; before it, the ocean gauntlet lead: the River shape panel, a width scale, a depth scale and a flow that rebuild the reach and solve its flow again; water gauntlet, rivers, round 4: LOW SUMMER WATER at 1.5 m^3/s in a low-water thread with a raised outlet sill, the rock field of 2,000 rocks and 140 half-sunk pool stones, the wetted share of the channel against the clips, the small stones' world position under the water, the still pool as a near-mirror, the shallow-water roughness from the Froude number, the tighter white water, per-pose culling and the mirror's stand-ins, the ground and the rocks in tiles, the float-exact hash and the surface height the shader writes, the paper boat and the mallards (`riverFloaters.ts`, `riverSurfaceMirror.ts`, `riverFloatersView.ts`), the boat camera and the free look; round 3: the scene the water mirrors, the camera's auto exposure, two waters, the water's shape around each rock in a third flow-map texture, oriented ripples along the flow (fixed stretches, blended by the speed), a reflection normal without the fine ripples in smooth water, a darker submerged bed, 52 rocks at the bend head, the region luma percentiles against the clips; round 2: the surface turbulence, rock-face white water, physical refraction and reflection breakup, depth color, wet bands and ragged banks; round 1: the judged reach, the steady flow solver, the flow map and the flowing-water look).

## What it is

A river whose water moves downstream and reads as moving in one still frame. Two halves:

1. **The flow.** A 2D shallow-water solver with momentum runs the river's discharge over its bed until the flow is steady, then averages it. The water comes out fast in the narrow and steep reaches, slow in the wide pool and at the banks, and turned back into eddies behind rocks and bends. The solver finds all of that from the bed; nothing about the flow is drawn by hand.
2. **The look.** The ripples, the white water, the foam streaks and the breakup of the reflection ride that flow, with a two-phase flow map. The bed shows through shallow water, deep water reads dark, and the surface mirrors the banks and the sky.

It is not in the game yet. The in-game rivers are ribbons drawn by `waterSurfaceMaterial.ts` at the shared waterline of `waterGeometry.ts` (see the plan map topic `ground3d-water-surface`), with no flow map. The look module takes any flow map, so the step to the game is a flow map per river course and chunk, not a new material.

## The pipeline

| Step | File | What it does |
|---|---|---|
| Reach | `src/systems/world3d/river/riverReach.ts` | The judged reach: a course line, a bed with pools, riffles, bars and an island, the valley, about 2,700 boulders (round 4: the rock field and the pool's half-sunk stones; those in the channel are in the solver's bed). A pure function of the seed. |
| Solver | `src/systems/world3d/river/riverSolver.ts` | HLL finite volumes, the hydrostatic reconstruction of Audusse et al. (2004), semi-implicit Manning friction, an adaptive step at Courant 0.45; inflow cells and a transmissive outlet edge; steady run plus a time average (mean depth and velocity, and the unsteady part `uRms`). |
| Flow map | `src/systems/world3d/river/riverFlowField.ts` | `solveReach` (the start state, the wet ceiling, the inflow) and `buildFlowMap` (textures, foam, surface). |
| Phase math | `src/systems/world3d/river/riverFlowPhase.ts` | The two-phase blend, the Gaussian tools, on the CPU, where the tests prove them. |
| Worker | `src/systems/world3d/river/riverWorker.ts` | Runs reach, solver and flow map off the main thread (about 11 s here) and hands back every array. |
| Water look | `src/components/World3D/water/riverWaterMaterial.ts` | The water material (a TSL node material on WebGPU since 2026-09-30; it was GLSL), the flow functions the banks share (`createRiverFlowNodes`), the flow textures, the procedural ripple and foam textures, the water sheet geometry. |
| Bank look | `src/components/World3D/water/riverBankMaterial.ts` | The bed stones, the wet band at the waterline, the caustics on the submerged bed (a standard node material with TSL color, normal and roughness nodes and a lighting model for the caustics). |
| Scene | `src/components/World3D/water/riverReachScene.ts` | The judged scene on three's `WebGPURenderer` (since 2026-09-30): four passes, the poses, the capture hooks, the per-viewer cache of the flow data. |
| Dressing | `src/components/World3D/water/riverVegetation.ts` | ez-tree trees and shrubs near the river, canopy shapes on the valley sides. |
| Floaters | `src/systems/world3d/river/riverFloaters.ts` | The paper boat and the mallards: pure, deterministic from the seed and the water clock (round 4). |
| Surface mirror | `src/components/World3D/water/riverSurfaceMirror.ts` | The drawn surface on the CPU: the flow map's texels and the shader's wave height, term by term (round 4). |
| Floater meshes | `src/components/World3D/water/riverFloatersView.ts` | The boat and the ducks on the drawn water, their poses (round 4). |
| Page | `src/components/DesignPreview/steps/water/RiverScene.tsx` (local-only) | `?step=water&river=1`; the water page's "River — flow" button opens it. |
| Live river | `src/systems/world3d/river/riverLive.ts` | The live run and the edits: `LiveRiver` (the solver run on, the bed patch, the field frames) and `LiveFlowMapper` (the flow map, the sheet and the textures of a frame). Pure, tested in Node. |
| Live workers | `riverWorker.ts` (its live role), `riverMapWorker.ts` | The live solver and the flow mapper, each in its own worker. |
| Sheet and half floats | `src/systems/world3d/river/riverWaterSheet.ts` | The water sheet's arrays and the half-float packing, with no three.js (the judged sheet and the live sheet come from it). |
| Live client | `src/components/World3D/water/riverLiveClient.ts` | The page's side: the two workers, one edit in flight, the round-trip log. |
| Edit handles | `src/components/World3D/water/riverEditHandles.ts` | The edit mode's path and bank handles, the course line, the pick and the drag. |

## The solver

- **Why momentum.** The land page's `shallowWater.ts` is a virtual-pipe grid: its water only runs downhill of its own surface, so it cannot keep its speed past a rock or turn back into an eddy. The river solver follows the beach swash (`oceanBeachMath.ts`) term by term, cut down to a river.
- **Grid.** 0.5 m cells, 350 m x 140 m. The boulders that make the white water are 0.4 to 2.6 m across, and a solver needs several cells across an obstacle to leave a wake behind it.
- **Work.** Only the cells under the wet ceiling (the design level plus 0.8 m, within 6 m of the banks) and a one-cell margin are stepped, as run lists per row: 34,000 of 196,000 cells, 5.4 ms a step.
- **Start state.** The design level (`designLevelAt`), calibrated on a 430 s run (steady to 1 %), with the discharge spread over each cross-section. After 60 s of spin-up and 20 s of averaging the outflow is within about 5 % of the inflow.
- **Determinism.** The step sequence is a pure function of the start state; the same seed gives the same field (tested). The page keeps the result in this viewer's IndexedDB (`RIVER_DATA_VERSION`); a private window computes the same field again.
- **Open.** First order is diffusive: the wake of a 1 m boulder is shorter and weaker than a real one (the eddy beside the jet at the pool entrance is resolved). A second-order reconstruction (MUSCL) would sharpen both.

## The flow map

One texel per solver cell, two half-float RGBA textures:

- `t0` = smoothed velocity (u, v), depth, water level (the level is extended past the banks and then filled smoothly over the whole grid, for the wet band).
- `t1` = white water, foam streaks, distance to the nearest water (m, capped at 8), surface turbulence (0 glassy, 1 a riffle's chop). The shader computes the Froude number from the speed and the depth.
- `t2` (round 3) = the water's shape around each rock that stands out of the water or lies within 0.35 m under it: surface height (m; a PILLOW on the upstream face of the stagnation head U^2 / 2g, at most 0.25 m, a TROUGH in the lee, a BOIL downstream of a submerged rock, and the two ridges of a V-WAKE leaving the flanks at asin(1 / F), 34 degrees in subcritical flow, fading over 2 to 8 m), and the V ridges' line strength. The look takes the height's gradient as surface slope. The pillows and the V roots also feed the white water's cover, so white water starts at the rocks. A depth-averaged solver at 0.5 m smears these shapes away; they are laid in from the rock list and the local flow.

White water is a steady solution of `dW/dt + u . grad W = k max(0, cover - W) - W / life` with a 2 s life. Since round 2 the local cover comes mostly from where the water MEETS something: the approach speed toward an emergent rock within two cells (weighted by the cosine to the rock), a steep surface (the drop over a submerged rock or a bed step), the shear at a wake's edge and the wake's unsteady part. The broad terms (Froude number, friction dissipation) keep a small share: in round 1 they covered whole riffles, and three blind judges read the result as speckle "sprayed on the gravel, tied to no rock". `k` is the larger of 1/life and speed / 1 m, so a lone rock brings its white water up to its cover and a tongue fades downstream over speed x life. Streak foam is conservative (it collects where the surface converges) with a 40 s life, fed by a share of the white water's decay.

Since round 3 the steep-surface and wake terms are smaller (0.3 and 0.2) and a submerged rock's own white is 0.15: over submerged rocks they drew white patches "with no rock under" them.

The surface TURBULENCE is the same relaxation at lower thresholds, with a 6 s life and a 2 m generation zone: made where the water loses energy (friction over a shallow bed, shear, the unsteady wake, a drop, a rock face) and carried downstream, so a rock leaves a rough wake several meters long and a riffle's tail breaks the head of the pool below it. It paints no foam; the look turns it into ripple slope, reflection breakup and roughness.

The drawn sheet: one vertex per wet cell at the water level; film cells (under 2 cm) tuck 3 cm under the bed; the sheet runs on over every rock's footprint at the level around it, and 2 cells under the banks, so the depth test cuts the waterline cleanly.

## The look

- **A still frame shows the flow (round 2).** Three blind judges read round 1's surface as a flat mirror in all three views. The surface roughness is now the larger of the turbulence field and what the speed alone gives (a run is never glassy), and it drives three ripple scales that each ride the flow: 0.2 m ripples (1.6 m tile, RMS world slope 0.028 to 0.10), 0.7 m chop (5.5 m tile, 0.016 to 0.26, partly drawn out along fast flow, with a 0.45 m octave that breaks the drawn-out stripes) and 2.2 m boils (18 m tile, 0.036 to 0.06, the calm pool's wobble). The texture's RMS slope and the line blur's kept spread are measured on the textures when they are built (`RIVER_TEX_STATS`), so the targets are real world slopes. A riffle's 0.26 tilts a 2.5-sigma facet 33 degrees: seen from above, it mirrors the sky while the facet beside it shows the dark bed. Where the pixel cannot resolve the facets, the reflected-ray cone reaches the bright sky and the Fresnel share rises (a floor of 0.16; 0.28 matched the reference hue and drew a frosted, flat sheet). Broken fast water also carries bubbles under its surface: a veil of up to 30 % in the chop's troughs, lit by the sky only.
- **Round 3: oriented ripples, a separate reflection normal, two waters.** The 0.2 m ripples and the 0.7 m chop are STRETCHED ALONG THE FLOW, by a FIXED 2 and 3 times, from 8 fixed orientations 22.5 degrees apart, blended by the local direction; the stretched tile is then blended with the isotropic tile by the local speed (0 under 0.3 and 0.4 m/s, 1 over 1.5 and 2 m/s). Both blends keep the variance. The standing waves have their crests across the flow. The calm ends of the ripple amplitudes went down (a calm pool is a wavering mirror, not a fine texture). In smooth water the mirror is displaced by the swells, the chop, the standing waves and the rocks' shapes but not by the 0.2 m ripples, which blur it instead (turning a mirror by a few-pixel ripple scattered the reflected trees into noise); in broken water (roughness 1) the 0.2 m ripples displace it too and do not blur it. The boulder reach and the bend carry clear granite water (extinction 0.62, 0.32, 0.28 per meter: red goes first, blue-grey); the pool reach east of x = 140 m carries tea-colored water (0.6, 0.45, 0.8). The key is where the water is. The submerged bed darkens to 0.55 of its albedo in the clear water and 0.45 in the tea water, with a film of algae and silt.
- **Two-phase flow map, no phase offset.** Two copies of each detail texture ride the flow for one 1.0 s cycle each, half a cycle apart; each resets where its own weight is 0. The blend divides by `sqrt(w0^2 + w1^2)`, so the texture's variance holds at every phase (a plain blend loses half at mid-cycle). There is NO per-point phase offset: an offset field `off(x)` makes a feature move at `u / (1 - T u . grad off)`, and the first cut drew the riffle 20 % slow. An offset that is constant along the streamlines would keep both; it is open.
- **Gaussian foam.** The foam texture's mask channels are rank-transformed to a Gaussian (sigma 0.16). A sum of two Gaussians with those weights is the same Gaussian, so a threshold at the Gaussian quantile of (1 - cover) covers exactly the flow map's share at every phase: the foam does not breathe. Past the size where a foam clump falls under a pixel, the mask fades to its expected value (the cover).
- **No per-pixel transform of world coordinates.** A texture coordinate may be rotated or stretched only by a value that is the SAME AT EVERY PIXEL. A rotation of absolute world coordinates by the local flow direction sheared the pattern by the distance from the origin (hair on the foam, fingerprint rings in the riffle, round 1). A stretch by a factor that followed the local speed did the same in round 3: at about 150 m from the origin, a stretch change of 0.1 over a meter moves the pattern by 13 m per meter, and fine lines ran along the streamlines wherever the speed changed across the flow (the eddy, the bend, the pool jet; the advected ripples there tracked at 0.15 to 0.26 of the model speed until the fix). Only the BLEND WEIGHTS between fixed transforms may change from pixel to pixel. The foam is drawn out along the flow by a short line blur along the local direction.
- **Standing waves** fixed to the bed, at the wavelength `2 pi u^2 / g`, from three fixed scales blended by that wavelength.
- **Depth and light.** Since round 2 the view ray REFRACTS at the rippled surface (index 1.33) and runs down to the bed at the flow map's depth; the bed is read where that bent ray lands on screen, so grass and stones under a shallow channel waver (round 1 shifted the read by a pixel and a judge saw the grass "as if under glass"). The absorption runs over the bent path plus the path down to the bed, with extinction (0.6, 0.45, 0.8) per meter: a 0.2 m margin keeps most of the bed's color, a 1.3 m run reads olive-brown, a 2.3 m pool tea-dark.
- **Reflection.** A half-size planar mirror render (the three.js Reflector's oblique clip, in WebGPU's 0..1 depth range since the port; the sky drawn first with the true projection, and without the sun disk, which the water's own glint draws). Since round 2 the rippled normal turns the reflected ray, and the mirror is read where that ray meets a bank object 18 m away: a pool's reflections waver, a riffle's break into fragments. The mip level (at most 2.5) blurs only the slope the pixel cannot resolve; a deeper blur turned a sky gap between trees into one smooth white disk.
- **Sun glint.** GGX on the rippled normal, with a roughness of only the slope the pixel cannot resolve, so the resolved ripples break the sun into sparkles.
- **White water drawn.** Masses of the Gaussian foam texture read by a line blur upstream (so each mass is drawn out downstream), a finer bubbly octave near the eye, lumpy shading (0.5 to 1.0 by the fine texture), a translucent lace at the edge, at most 72 % of the surface where the flow map's cover is full; crest flecks on the most broken chop; and contact foam where broken water is under 12 cm over a rock or a bank.
- **Banks and rocks.** Round stones set in gravel, with a bump per stone that fades once a stone is under about 4 pixels; the far fade goes to a MEAN that itself varies in 1.5 m and 5 m patches, and the Nerang-side bars are warm brown pebbles. The wet band has a ragged edge (it wanders 8 cm at 1.2 m and 4 cm at 0.35 m); gravel darkens to 0.62 of its albedo, a rock to 0.5, from 0.1 to 0.25 m over the water (dry pale tops over a dark waterline band); under the water stones darken only to 0.82. The bank's cross-section wanders sideways by up to 2.5 m (40 % in the pool reach) and its bed is lumpy near the edge, so the waterline has bays and points. Rocks are cut by three to five soft cleavage planes each. Grass clumps grow on the bars 0.08 to 1.2 m over the water in patches, tall tussocks on the Nerang side. Caustics on the submerged bed from the same advected ripple layers.

## The river's shape (the River shape panel)

Remy asked for "controls on the rivers width and depth" (2026-09-28). The river scene (`?step=water&river=1`) has a **River shape** panel under the camera buttons, hidden in captures (`navigator.webdriver`).

- **Three numbers**, in `RiverShape` (`riverReach.ts`): `widthScale` (0.6 to 1.6) multiplies the half width at every course key, the low-water thread's width, the rock field's thread gap and the island's place and size; `depthScale` (0.5 to 2) drops the bed under the bank top (the banks keep their height) and scales the thread's raise; `dischargeM3S` (0.5 to 12) is the solver's inflow.
- **Module state.** `setRiverShape` sets the shape before a build. The flow worker takes it in its message (`{ seed, shape }`), and the view sets it on the main thread before it builds, because the vegetation and the floaters read `courseKeyAt`.
- **The default is the judged river, bit for bit.** At the default shape `courseKeyAt` returns the table's own key, `designLevelAt` takes its old path, every scale is exactly 1, the ceiling margin is 0.8 m and the cache key is the old one. `__tests__/riverShape.test.ts` holds this: the default builds the same bed before and after another shape.
- **A changed shape** gets a design level from the default table's rules, with each depth over the thalweg scaled by the flow's depth factor, (flow per unit width)^(3/5) after Manning, and each held pool taken from the thalweg that holds it (the bend from the riffle head at s = 140, the pool reach from the sill at s = 272). The solver's wet ceiling rises to 0.8 m times that factor plus 0.8 m, so no water is cut off. The level is only a start; the drawn level is the solver's.
- **Live in a browser** (since the live river editor, below). A slider acts while it is dragged: each move is a bed patch over the judged reach, and the running water fills the new shape. A release writes `&rw=`, `&rd=` and `&rq=` to the address. The panel shows the live mean speed, mean depth, Froude number and wet area.
- **Rebuild on release, in a static page only** (a capture, or `&live=0`). A release rebuilds the reach for the shape (`buildRiverReach` with the module shape) and solves its flow (22 s for one width step here), and each shape has its own cache entry. A capture with a shape in the address draws this canonical build, so a capture stays a pure function of the address. Its rocks differ from the live patch's: the build places them again for the shape, and the patch moves the judged ones.
- **Checked** (headless Chrome with WebGPU, 2026-09-29, the rebuild): width x1.05 by a slider step (wet area 3,879 to 4,045 m²); width x1.5, depth x0.6, 6 m³/s (10,613 m², mean speed 0.80 m/s, Froude 0.37); width x0.7, depth x1.8, 1.5 m³/s (2,261 m², 0.44 m/s). No page errors.

## The live river editor

Remy asked (2026-09-29): "make it so i can grab the river and i can manipulate the river shape live, without reloading". In a browser the river scene now runs its solver live, and the River shape panel's sliders and the EDIT MODE's handles change the bed while they are dragged. The water keeps flowing and fills the new shape on screen. The judged captures do not change (0 px over 8/255 against a baseline taken first, with and without the cache).

**Two ways the page runs.**

- **Static** (every capture rig: Playwright sets `navigator.webdriver`): the steady field, as before. `&live=1` makes a capture live; a course edit (`&rc=`) exists only live, so it makes the page live too.
- **Live** (a browser, or `&live=1`): the page opens on this viewer's cached steady field of the judged river (a warm start; the solver runs on from it), or, with no cache, on the design level (a cold start; the water spins up on screen). `&live=0` turns it off. `&edit=1` opens in the edit mode (for a capture of the handles). `&speed=auto|realtime|fast` sets the solver's pace.

**The two workers.** The live solver (`riverWorker.ts`, its live role) steps the solver in slices of about 24 ms, so edits get in between. Every 250 ms it sends a FIELD FRAME to the flow mapper (`riverMapWorker.ts`): the mean of the steps since the last frame, smoothed over 1.5 s of flow (the unsteady part over 6 s), so a wake that sheds does not flicker the textures. The mapper makes the flow map (`flowMapCore` in its `step` mode: the white water, the turbulence and the streak foam move on by the frame's own time instead of being solved to steady), the water sheet and the half-float textures, and sends them to the page. The page swaps the textures' data, the sheet's geometry and the floaters' water, and acknowledges; a newer frame replaces one not yet mapped (latest wins). A map costs about 180 ms, and in a worker of its own it never slows the solver.

**The pace.** 'fast' steps as fast as the worker can: 6 to 8 times real time here. 'realtime' keeps the flow's clock on the wall clock (the page's status line reads 1.0x). 'auto' (the default) runs fast after the start and after each edit until the river SETTLES: at least 45 s of flow, then until the outflow (smoothed over 10 s) is within 5 % of the inflow, at most 900 s. From the design level the run dips to 1.23 of 1.5 m³/s at 300 s of flow while the pool fills, and settles within 1 % by 900 s of flow (`settleCheck`: 2,408 m³ on the grid).

**The bed patch** (`LiveRiver.applyEdit`). The ground of an edited river is a pure function of the edit, not of the drag that made it: `ground = judged + (edited - judged) x w`. `edited` is `terrainHeightAt` (the judged ground function, now split into its parts) on the edited course with the edited key table. `w` is 1 in the edited channel and in the judged channel, each with 10 m of floodplain past its bank (the CARVE BAND), along the stretches of course that differ from the judged one; it falls to 0 over 14 m across and 10 m along. So an edit carves its channel and floodplain into the valley and fills the channel it left; past the band the judged valley stays. The valley's walls do not follow the course: a full rebuild would move whole mountainsides while a point is dragged, at about 8 µs a point.

- **The design s.** A moved point stretches its four segments in space but not in s (`RiverCourse` with a `reference`), so the pools, the riffle and the sill downstream keep their places; a sample keeps its s, and a segment the edit left alone keeps its judged samples.
- **Kept per cell** for speed: each cell's projection on the course and its eight noise values (`RIVER_TERRAIN_NOISE`), so a cell costs about 0.4 µs instead of 8 µs. A coarse 4 m mask marks where a new projection is needed and where the band can reach.
- **The rocks** ride their place (s, n) on the course where the course or the width changed, and their ground's change everywhere; `riverLateralN` scales n inside the banks and keeps the distance to the bank outside them. **The small stones** do the same on the page. **The plants** stay where they grow, ride the ground's change, and hide where a new channel runs over them (a patch that widens a bank moves the forest floor in the band, so a top view of that forest changes in 26 % of its pixels).
- **Exact at the judged river.** An edit that ends on the judged river leaves the judged ground, bed and rocks bit for bit. A drag and a jump to the same edit agree within 1.7 mm (the outside fields at a lattice point blend every course sample, and a patch refreshes them 20 m past its box; `riverLive.test.ts` holds 5 mm).
- **The refresh's cut.** A refresh leaves out the course samples past 120 m (a sixth of the work). Away from the channel that moves the ground from its judged value by up to 9.3 mm about 30 m from the channel, and by 11 mm for a width of x1.001 (measured 2026-09-29; the code's note said under 1 mm). An edit that keeps the judged course and widths (node heights only, or the judged river again) does not refresh: it copies the judged fields (`OutsideFields.copyBox`), exactly.

**The water across a patch** (`RiverFlowSolver.updateBed`). A wet cell keeps its water SURFACE: a raised bed leaves less water (none over the old surface), a lowered bed more. A film under 2 cm keeps its depth where the bed drops, so a carved bank does not fill with a pool at once. A shape change moves the kept surface by the change of the design level (the flow held at its old value), so a deeper or shallower channel keeps its water's depth; a new flow keeps the surface, and the river rises as the new inflow comes down. A dry cell stays dry, and water runs into a new channel from upstream. The step's size is taken again from the new state (`refreshWaveSpeed`), and the ceiling and the inflow are built again where the patch reached them. Mass is not kept across a patch: a narrowed channel loses the water over its new banks, and a moved pool starts dry. At the summer flow the inflow needs about 20 minutes of flow to fill a pool of 2,000 m³, so the panel's **Top up** button (and **Reset river**) fills the channel to its design level at once; it can overfill by the design level's error (up to about 0.15 m), which drains in a few minutes of flow.

**The edit mode** (`riverEditHandles.ts`). The panel's "Edit the river's path" button turns it on. It shows the course line over the water and, at each control point inside the solver grid (points 4 to 22):

- a blue PATH HANDLE: drag it over the ground and the river's path follows (the handle moves at once; the ground follows with each patch);
- two amber BANK HANDLES, one on each bank: drag one away from the water to widen the channel there, toward it to narrow it (x0.4 to x2; both banks move, so the channel keeps its thalweg);
- a green HEIGHT HANDLE (a diamond) 26 px to the right of the path handle on screen: drag it up to raise the bed there, down to lower it (-3 to +5 m, in 1 cm steps; a pixel is the meters a pixel spans at the handle's distance). Its label names the point's height against the judged bed and what the height does to the water ("-1.58 m · deeper", "+4.65 m · dry hump: water goes round", "+1.73 m · blocks: water ponds"), and has a "Reset height" button for that point. "Reset river" resets every point. See "The node heights" below.

A press on a handle takes the drag; a press on a label is the label's; a press anywhere else still turns the camera. "Leave edit mode (Esc)" or the Esc key leaves it. A release writes `&rc=` to the address (for example `&rc=c12:14:4_w15:1.77_h9:-1.58`: point 12 moved 14 m east and 4 m south, point 15 at 1.77 times its width, point 9's bed 1.58 m lower), so a reload opens on the same river. The handles draw over the finished frame (`RiverReachView.overlay`) at a fixed size on screen, never in a capture unless `&edit=1` asks. When no patch has come for 0.7 s the edit SETTLES: the shadow map is drawn again and the paper boat and the ducks start again on the new water. `__RIVER__.live` has the scripts' side: `status`, `patchLog`, `snapshotLog`, `edit`, `editState`, `setEditMode`, `handleScreen` (a path, bank or height handle), `nodeReports`, `setSpeed`, `setPaused`, `topUp`, `editInfo`, `drawn`.

**Measured** (headless Chrome with WebGPU on this machine, 2026-09-29; the round trip is from the edit sent to the patch back on the page):

| What | Updates a second while dragged | Round trip, median | In the worker, median | Cells a patch |
|---|---|---|---|---|
| Path handle, the bend (point 12), a 5.8 s drag | 4.9 | 182 ms (145 to 216) | 163 ms | 22,700 |
| Path handle, a fast 1.7 s drag | 3.6 | 263 ms | 235 ms | 22,900 |
| Bank handle (point 15), a 5 s drag | 9.3 to 9.7 | 64 to 68 ms | 48 to 52 ms | 19,200 |
| Width slider (x1 to x1.4) | 3.1 | 232 ms | 200 ms | 106,700 |
| Depth slider (x1 to x1.5) | 3.4 | 211 ms | 198 ms | 102,000 |
| Flow slider (1.5 to 4 m³/s) | 14.8 | 60 ms | 33 ms | 0 (the inflow and the ceiling) |
| Height handle, point 9 to -1.58 m (a pool) | 7.5 | 115 ms | 83 ms | 16,700 |
| Height handle, point 17 to +2.14 m (a riffle) | 7.3 | 102 ms | 71 ms | 16,800 |
| Height handle, point 17 to +4.65 m (a dry hump) | 9.8 | 57 ms | 42 ms | 16,800 |
| Height handle, point 9 to +1.73 m (a block) | 7.9 | 110 ms | 86 ms | 16,700 |
| Height handle, point 17 to +4.57 m, with the fields copied | 9.5 | 59 ms | 37 ms | 16,800 |

A path-handle patch splits (Node, 24 steps): the cells 72 to 96 ms (their new projections and ground), the outside fields about 21 ms, the solver's bed and runs about 16 ms. The flow maps come 3.7 to 4.0 times a second, at 107 to 180 ms (median 141 to 159 ms) in the mapper; a field frame costs 4 to 10 ms in the solver's worker. The page takes 0.4 to 2.4 ms of its own thread to draw a snapshot (the texture uploads go with the next frame), and it kept 60 frames a second while live (the vsync cap: the frame's true cost under it is not measured). The refill of a moved bend: the water front reaches the new bend 0.3 s after release, runs down it by 3 s, and fills it by 20 s (auto pace). Proof images are in `.agent/scratch/river-live/shots/` (not in git).

**Where it breaks** (`sweepLimits`: every shape corner, 40 m moves of points 6, 9, 12, 15, 18 and 21 in four directions, widths x0.4 and x2 at four points, each run with 30 s of flow):

- **The solver held every time:** its own stability check (`RiverFlowSolver.health`: a depth or a discharge that is not finite, a depth under zero, a speed over 25 m/s) never failed, and no state was restored. The transients reach 2.5 to 5.1 m/s (the wide, deep channel at 12 m³/s).
- **The grid's edge.** A channel pushed against the grid's north edge (point 6 moved 40 m north, which the clamp holds 8 m past the bank from the edge) spills past the wet ceiling (368 cells hold water outside it), and the carve reaches past the fine ground mesh: a straight seam shows where the fine mesh meets the 2 m outer lattice. Point 12 moved 40 m east spills 37 cells.
- **Folds.** No 40 m move of these points folds the course (two stretches of channel that overlap); the clamp keeps each point within 40 m of its judged place. Two neighbor points dragged toward each other can still fold it: the model does not stop that.
- **The pool.** A narrowed or moved pool reach loses its water (2,320 to 1,480 m³ at width x0.6) and refills only from upstream: Top up.
- **The look.** The carve band cuts gorge walls up to about 55 degrees where a channel moves into a hillside. The island's plants do not move with a moved island. The old channel of a moved bend reads as a dry gravel bar.

### The node heights

Remy asked (2026-09-29): "make it so that i can make the river nodes be able to go up and down individually (so i can make the river deeper or more shallow and even if possible raise above the bank at some points (so that the water is forced to go around that raised point)". Each control point in the solver grid (points 4 to 22) now has a HEIGHT: the bed's rise (+) or drop (-) there, m against the judged bed, from -3 to +5 m (`RiverCourseEdit.heights`, the address's `h<point>:<m>`).

- **Along the course** (`riverHeightAt`): a smoothstep from one point's height to the next, by the design s. It never overshoots, so a raised point makes no dip at its neighbors. The height of a lone point is 0 at its neighbors and past them.
- **Across the channel** (`riverMoundAt`): a mound, (1 - (t / 0.7)²)², with t 0 at the thalweg and 1 at the bank. The middle 70 % of the half width rises or drops; the outer 30 % on each side keeps the judged bed. So a large raise stands out of the water as a HUMP with a side channel on each side. A mound over the full width could only block: at low water the bend pool's water covers t under 0.58 only.
- **In the ground function**: `terrainHeightAt` adds the mound to the channel's cross-section (before the low-water thread) only when the edit has a height that is not 0. With no height the ground is the judged one, exactly.
- **The outside fields**: the heights do not enter them. A patch with heights only copies the judged fields (see "The refresh's cut" above), so a height changes the ground under its mound and nowhere else. The rocks in the span ride the change; a rock's footprint can reach a few meters past it.

**The pond** (`LiveRiver.buildLevelTable`). A raised point can stand over the design water level. The ceiling, the top-up and the inflow then read an EDITED DESIGN LEVEL (`levelAt`, a table in 1 m steps of s; `designLevelAt`'s values with no raise).

1. For each stretch of course with a raise, `passLevel` finds the lowest way over it. It is a minimax flood (a binary heap) over the new bed, inside the band (|n| under the half width + 6 m), from the cells 5 m upstream of the stretch to the cells 5 m downstream.
2. The PASS is the highest bed on the best way. The flood also gives the side of the sill (left, right or middle, looking downstream).
3. The stretch's level is the pass + 0.2 m (x the flow's depth factor): the depth of a spill over the pass.
4. A sweep upstream carries that level back until the bed's middle stands over it. That is the POND.

A change of the level builds the ceiling again over the whole grid, because a pond can reach far upstream of a patch's box. An earlier cut took the lowest point of each cross-section as the pond's level. It gave 3.64 m where the water spilled near 4.0 m, and 11 cells breached the ceiling; the pass flood gives 3.55 m and 0 breach cells at 90 s of flow.

**The node report** (`RiverNodeReport`, in each patch; `__RIVER__.live.nodeReports()`). For each point with a height, the report gives one of four kinds:

- **deeper**: the point is lowered;
- **shallower** (a riffle): the point is raised, and the bed's middle is still under the old level;
- **split**: the bed's middle is over the old level, and the pass is under it: a dry hump with water beside it;
- **block**: the pass is over the old level: the water ponds upstream and spills over the pass. `noPass` says that no way over stays inside the band.

The report also gives the bed's middle, the old and new levels, the pass and its side, and the pond's length. The handle's label and the panel read it; for a block the panel adds "spills over the right side at 3.57 m, pond 25 m long".

**The water's accounting** (GG-342 stays open: this reports the loss, it does not stop it). Each patch measures the water on the grid before and after `updateBed` (`volumeChange`). The panel shows:

- the water on the grid, and whether it stores or drains (the inflow against the outflow smoothed over 10 s);
- the water the last edit took or added, and the sums over all edits and top-ups;
- a warning when water stands against the grid's north or south edge (`edgeWetCells`; GG-343: the edge is a wall there).

**Measured** (Node, 90 s of flow after each edit, `heightCases.mts`; and headless Chrome with WebGPU, `heightProbe.mjs`, the drag rates in the table above):

| Edit | Report | What the water does |
|---|---|---|
| Point 9 -1.5 m | deeper | The middle's depth goes from 0.60 m to 1.84 m. In the browser (-1.58 m) the edit added 243 m³ (a lowered bed under standing water). |
| Point 17 +2 m | shallower | The middle's depth goes from 1.15 m to 0.59 m. |
| Point 17 +4.5 m | split | The bed's middle stands at 2.98 m, over a 2.45 m bank; the water runs 6.5 m wide beside the hump; 0 breach cells. |
| Point 9 +1.6 m | block | Pass 3.55 m on the right side, level 3.75 m, pond 25 m; the spill starts at the crest; 0 breach cells at 90 s. In the browser (+1.73 m) after 485 s of flow: 2,464 m³ on the grid and rising, out 0.95 of 1.5 m³/s, 3 breach cells, 0 edge cells. |

The four cases, each with its readout, are in `.agent/scratch/river-live/shots/node-heights-4case.png` (not in git). `riverNodeHeight.test.ts` holds the height's math (no overshoot, local to the neighbors, the mound), the clamp and the address key, a lowered point's ground (lowered only, between its neighbors only), the same bed for the same heights each time, the return to the judged ground, bed and rocks bit for bit, and the four report kinds.

**Open.** The pass flood sees only the band (GG-349). The refresh's cut still moves the ground by up to about 1 cm for a course or width edit (GG-350). The mound's shape is fixed, so the user cannot pick the side the water goes (GG-351). A pond fills from the inflow at the summer flow: minutes of flow; Top up fills it to the edited level at once.

**The judged scene kept.** The refactors (the split ground function, the design-s course, the stage-split flow map, the shared sheet builder, the recorders in the tile splits, the mirror's half-float path) draw the judged frames pixel for pixel: the reach and the flow map are bit for bit against the code before the editor (`checkReachBits`, `checkFlowBits`), and the four judged frames are 0 px over 8/255 (max 0) with the cache and without it. After the node heights they are 0 px (max 0) again, without the cache, against the same baseline. `RiverCourse.project` walks only each ring's edge and reads a dense bucket grid, with the same visit order: the reach builds in 1.2 s (it was 3 s) and the worker's cold build in 12 s (it was 27 s).

## Low summer water (round 4)

The Merced clips are late-summer low flow: most rocks stand out of the water, and the wetted channel is a set of narrow threads between them. Round 3 ran 8 m^3/s, and the channel filled bank to bank as one sheet.

- **The discharge is 1.5 m^3/s** (the Merced near Pohono Bridge runs about 1 to 3 m^3/s in late August and September). The outlet sill stands at +0.9 m (it was +0.45 m), so the pool keeps its 1.2 m level (a 480 s run: 1.21 to 1.22 m over s = 170 to 270). The design levels are calibrated again at 1.5 m^3/s (`designLevelAt`); an 80 s run ends at an outflow of 1.43 of 1.5 m^3/s.
- **The low-water thread.** In the boulder reach and the bend head (s under 108 m, gone by 118 m) the bed outside a thread stands 0.42 m higher (none at the bank top); the thread is a Gaussian of 2.6 m (sigma) about `threadCenterAt`, which wanders by 0.28 and 0.1 of the half width at 115 m and 41 m wavelengths, so the thread crosses between alternate bars.
- **The rock field.** 2,000 rocks of 0.22 to 0.97 m radius over the bed and the bars (s = -50 to 132), their tops 0.55 to 1.15 radii over the ground; three in four of those drawn in the thread itself are skipped (the flow moves them out onto the bars; with all of them the thread ponded 0.8 m deep). 140 half-sunk stones line the pool's margins, their tops from 0.08 m under the water to 0.15 m over it. A rock under 0.8 m of radius takes an icosphere of detail 2 (162 vertices), a larger one detail 3.
- **Wetted share of the channel** (`r4/wetStats.py`, from a class map: `readClassMap` marks vegetation, channel ground (under 1.8 m over the local water) and higher ground; the water from `readWaterInfo`), against point counts on the clips (`r4/refWet.py`: a 40 px grid, each point classified by eye as water, rock or other):

| Pose | Ours, all pixels | Ours, the clips' grid | Clip | Round 3 |
|---|---|---|---|---|
| bank-along | 0.37 | 0.33 | 0.28 | 0.61 |
| riffle-down | 0.48 | 0.54 | 0.46 | 0.71 |

- **The bed under the water.** The small stones (an instanced mesh) read the flow map, the wet line and their speckle at their LOCAL position before round 4 (the bank material left out `instanceMatrix`), so under the water they were "dry" pale granite: the judges' "pale blue blobs". Sunk rocks carry a patchy film (olive-brown, darker in patches at 0.3 m and 0.1 m) from 3 cm over the waterline down. The clear water's extinction is (0.6, 0.3, 0.42) per meter with a green in-scatter: the deeper threads go darker toward green.
- **Roughness from the depth.** Shallow fast water over cobbles is wrinkled by the bed: the roughness is at least 0.6 x smoothstep(0.3, 0.8) of the Froude number (from 2 to 8 cm of depth); a deeper, slower glide beside it stays glassy. The calm ends of the ripple amplitudes are 0.004, 0.004 and 0.008 (round 3: 0.012, 0.012, 0.03, and the 2.2 m swells alone moved the mirrored trees by about a meter): the still pool mirrors every trunk.
- **White water at the rocks.** The white water's life is 1.3 s (it was 2 s); the shear, unsteady-wake and dissipation weights are 0.15, 0.1 and 0.03; streak foam covers at most 5 % at 0.35 opacity; aeration starts at a cover of 0.15; contact foam only where something stands up out of the bed.

## The variant tunes (round 5)

Round 4's frames lost to the Merced clips, and the judges' notes pulled in four directions at once. Round 5, step 1, is a VARIANT ROUND: four levers, each one at full strength on its own, each judged blind against the clips before anything is combined. Every lever is a uniform the materials read, so one page shows any of them without a rebuild: `uTune` (x = V1, y = V2, z = V3, w = V4) on the water material (`createRiverWaterMaterial`) and on the bank material (`createRiverBankMaterial`: V1 and V4 only), and `uTuneSlab`. `RiverReachView.setTunes({ slab, v1, v2, v3, v4 })` sets them. ALL 0 DRAWS ROUND 4, PIXEL FOR PIXEL: every tune's term is a product with its lever, or inside an `If` on it.

- **slab** (every variant has it): the fix of the WHITE SLABS. Where the rippled read left the mirror's frame (the near water at the bottom edge) round 4 fell back to the open sky at its full radiance and drew hard-edged white cut-outs; the read now stays at the frame's edge. And the rough surface's reflection cone reaches what is ABOVE the reflected point, which over a walled reach is the canopy, not the open sky: the cone now reads the mirror render itself, upward and two mip levels blurrier, where round 4 mixed in the sky and blew the far reach out to a white plane.
- **V1, rock contact**: the water's shape around each rock (flow map `t2`) at three times its slope, so a rock under the surface bulges it; `nearSolid` (the water over a rock's flank or a bank is at least 8 cm thinner than the flow map's depth, within 8 cm of the surface) and the base of a rock wavers under the rippled surface; a V trail and eddy lines behind each rock at any speed over 0.2 m/s, torn by the foam texture, and a froth rim on the pillow at the rock's face; on the banks, A ROCK'S WET RIM: a dark glossy band from the waterline to 7 cm over it (a 12 cm band darkened the whole of the small rocks), and the rock's part under the water darker and green-tinted.
- **V2, white water placed by the flow**: white only where the flow map's white water is (a cover over 0.02 to 0.1: the top eighth of the low summer water's field, the rocks' faces, the drops, the squeezes between rocks), drawn with a LONG LINE BLUR of the foam texture's blob channel upstream along the flow (eight samples 0.45 m apart, `RIVER_TEX_STATS.foamLicLong`), so each mass is a tongue 2 to 3 m long pointing downstream, torn at its end by the fine octave, with a sharp edge, at most 70 % of the surface (95 % filled the tongues in to flat slabs), bright aerated white (0.84, 0.88, 0.9) with bands along the flow and lumps inside (0.62 to 1.0). Between the tongues the water is clear: no bubble veil (`aer` x (1 - V2)), no rough Fresnel floor, half the streak foam, no crest flecks.
- **V3, depth and direction**: the ripples drawn out along the current from 0.1 m/s (round 4: from 0.3), standing waves from a Froude number of 0.3 (the low summer narrows run 0.4 to 0.8), and FLOW STREAKS from the long blur's slope across the flow (0.01 m per unit of the field); the refraction at three times the ripples' tilt; the bed BLURS with depth (a five-tap cross of 3 % of the depth) and darkens to 0.8; the water clear over the shallows and olive-green in the deep threads (extinction (1.0, 0.42, 0.85) in the clear reach, (0.95, 0.62, 1.15) in the tea reach: green passes, red and blue go) with a green in-scatter; the far reach keeps half its reflected detail; the Fresnel share at most 0.8 at the grazing angle (the water still shows some of its body).
- **V4, stones and wet margins** (the scene and the banks): MIXED SIZES IN CLUSTERS, a second small-stone mesh (`stonesMixed`: patches on a 6 m noise, sizes log-uniform from 4 cm to 45 cm) that swaps in for round 4's even ovals, with the shadow map primed again; STREAM COLORS on the stones and the rocks (wet dark greys, grey-browns, ochres, olive-greys, pale granite on one rock in four: the judges' "pale gray-white gravel", "snow or ash"); sand where the current slackens and a few big cobbles in their own patches; A NARROW WET STRIP on the stones along every waterline (4 to 7 cm over the water, 0.4 of the albedo, a sharp top); the Nerang's banks brown earth and brown pebbles; on the water, THE WATERLINE: a darker line in the water's last 1.5 cm over the ground (the wet meniscus).

**Judged so far.** V2 at riffle-down against its Merced frame, two blind critics with the order swapped (the desktop session before this doc's date; the images are in that machine's scratch, not in git): BOTH CHOSE THE CLIP, high confidence. What they named, in the order of weight:

1. Our white water is flat pure-white splotches "like snow or paint lying on the bed": it ignores the rocks, has no direction, thickness or spray. The clip's white is broken, streaky, aerated water that forms only just downstream of rocks and bed steps, brightest where the flow crests, thinning to translucent bubbly trails.
2. Our water has almost no SURFACE: no ripples, no sky sheen, no refraction wobble over the bed, so the channel reads as a faint teal tint on gravel. (V2 turns the rough floor and the veil off and adds nothing in their place; the surface terms of V3 are off in a V2 frame.)
3. Our color does not change with depth: the shallow edges and the middle of the channel carry the same weak cyan wash; the clip's calm pool is a clear olive-green that darkens with depth, with green algae in the slow water and grey-brown gravel in the fast run. (V3's water, off in a V2 frame.)
4. Where our water meets rocks and banks the join is hard and dry: no wet darkening, no bulge upstream, no wake downstream. (V1's contact, off in a V2 frame.)
5. Our riverbed shows through with no loss of detail: the rocks under the water as sharp and as bright as the dry ones. (V3's blur and darkening, off in a V2 frame.)

The clip's own weak point, by the critics: soft and low in detail, the fast water at the lower left a grey smear.

So the one-lever frame fails on what the other levers carry, and V2's own white water is still read as paint: it needs to be placed just downstream of each rock and step (the flow map's cover already starts at the rocks; the drawn tongue starts AT the rock, not behind it), brightest at the crest, thinning downstream into a translucent bubbly tail rather than an opaque mass with a sharp edge. The verdicts for V1, V3, V4 and for V2 at bank-along and calm-bridge did not reach the cloud session that wrote this; record them here as they come, and the step-2 combination after them.

**Where this runs.** The page (`RiverScene.tsx`) is local-only and the river draws with WebGPU only, so the tune-judge loop runs on the desktop. A cloud session can run the Node tests (`src/systems/world3d/river/__tests__/`) and the scoped typecheck on the river files, and nothing visual.

## The mirror's cost (round 4)

The reflection pass redrew every instance of the vegetation (8.9 million triangles). Now each instanced vegetation mesh is split in three: the camera's copy (layer 1), the mirror's near copy (layer 2) and the mirror's far copy (layer 2, a stand-in: every second leaf card at sqrt(2) times its size, each where it was). Whenever the camera moves, each copy is filled with the instances whose bounding sphere meets its own camera's frustum, and the mirror draws the stand-in past `RIVER_MIRROR_LITE_M` = 100 m from the mirrored eye. The culling changes no pixel (0 of the judged frames' pixels over 8/255); the stand-ins at 100 m move 0.3 % to 1.5 % of the pixels and the water's median luma by at most 0.006 (at 35 m it was 7 % and 0.03 at calm-bridge; a canopy-shape stand-in was dropped: it changed the far forest's outline). The shadow map is drawn once with every instance (`primeShadows`). The ground and the rocks are split into 24 m tiles, so three.js's own frustum test skips the parts a camera cannot see. Triangles drawn: the camera 0.6 M (bank-along), 0.04 M (riffle-down), 4.9 M (calm-bridge) of 9.0 M; the mirror 0.8 M, 0.8 M and 3.9 M.

## The floaters (round 4)

Remy's addendum: "a paper boat floating down the river ... and a few ducks going different directions, while being obviously carried to a degree by the river flow". `RiverFloaters` (`riverFloaters.ts`) integrates from t = 0 at a fixed 1/30 s step with a seeded generator, so a capture at a pinned time shows the same frame on every run; `at(t)` interpolates between the two steps around t.

- **The paper boat** (20 cm, folded, white paper with a wet band): its velocity relaxes to the flow map's surface velocity with a 0.45 s time constant; its heading turns at half the local curl plus a gentle lengthwise turn into the current (0.8/s at 0.4 m/s); rocks are circles at the waterline that it slides round (the velocity into a rock is removed); under its 1.2 cm draft it runs aground, and after 3 s aground or out of the reach it starts again at s = 40 m.
- **The mallards** (five: three drakes, two hens, procedural): each paddles at 0.45 to 0.7 m/s along its own heading and wanders every 3 to 6 s; its GROUND velocity is its paddle velocity plus the water's, and its body faces its paddle heading, so the crab angle shows the carry. They prefer slow water when the current beats the paddle, keep off the banks (15 cm), off the rocks and 1.2 m from each other, and turn back to their home water (the riffle's jet at the pool's head, 0.3 to 0.6 m/s) past 3 m from it.
- **The ride on the drawn water.** `RiverSurfaceMirror` follows the water shader's surface height `hWaves` term by term (the ripple scales with their tiles and RMS slopes, the oriented blend, the standing waves, the rocks' shapes); each floater sits on the water sheet plus that height and tilts to its slope. The shader's hash is an additive low-discrepancy sequence (it was fract(sin(n) x 43758), which a GPU and a CPU do not agree on). Debug output 10 writes the shader's height; `readSurfaceHeight` reads it back: 28 probes under the floaters at t = 6 to 30 s agree with the mirror to 1e-5 m (RMS height 5 mm).
- **Poses and camera.** `FLOATER_POSES['ducks-pool']` (kept apart from `RIVER_POSES`, whose stand points clear the trees) and `boat-follow`. "Pin camera to the paper boat" follows the boat EVERY frame (`followBoatStep`, the ocean viewer's method): the distance to where the boat was, the camera's own forward, turned by the boat's change of heading. The page has the ocean viewer's free look (`oceanFreeLook.ts`: drag, W A S D, E, Q, Shift, wheel), a floor 0.25 m over the water and the ground, a "Reset camera" button, and a hint line; the floaters, the buttons and the hint are off in a capture (`navigator.webdriver`) unless a script asks (`&floaters=1`, `setFloaters`, `setFollow`).

## The scene the water mirrors (round 3)

Water shows what it reflects, so the scene is part of the water. The bend head's 52 rocks have their tops 0.35 to 0.75 m over the design level (three in four) or up to 0.25 m over it (one in four): their own drag holds the solved water about 0.3 m over the design level there, and with tops 0.05 to 0.45 m over it, 25 of the 52 were under the solved water (`r3/emergeProbe.mts` reads the page's `levelAt` beside each rock). The right bank of the boulder reach and the bend is a 10 m boulder bar under a 0.7 forested canyon side (it was a lawn), with a closed canopy, understory crowns between the trees and a floor of needle duff; the left bank is the steep mountainside. The Nerang reach's banks close in (6 to 7 m under 0.35 to 0.45 slopes) and carry dense growth down to 0.25 m over the water: shrubs on a 2.5 m grid along the margin, trees at the edge leaning 12 to 26 degrees out over the water, reed stands of 2.2 to 3.4 m on the island, dark undergrowth for ground. The light is a bright hazy day (sun 1.1, sky light 1.9, a pale sky) and the sky dome has a radiance of its own (`skyGain` 3.4: an overcast sky is several times brighter than the leaves under it, and the water mirrors that). The camera AUTO-EXPOSES as a video camera does: the log-average luminance of the whole HDR frame, metered again when the pose or the size changes, brought to a key of 0.125. The tree clearings keep the bank cameras' stands (12 m, 22 m for trees) and a +-30 degree wedge only between the camera and the water it looks at; the bridge keeps a 6 m stand.

## The judged scene

`?step=water&river=1` (`&full=1` for captures, `&pose=`, `&t=` to pin the water clock, `&nocache=1`). Capture surface `window.__RIVER__`: `ready`, `setTime`, `setPose`, `poses`, `bench`, `ablate('water' | 'reflection' | 'caustics', on)`, `modelAt`, `drawnFlowAt`, `levelAt`, `courseAt`, `measureFoam`, `setNaiveBlend`, `readWaterInfo` (depth, speed and drawn foam per pixel), `setDebug` (1 speed, white water and roughness; 3 foam share by class; 4 advected ripples alone; 5 and 6 read-back channels; 7 reflection, 8 water body, 9 Fresnel share). The poses are in `RIVER_POSES`, each matched to one reference frame of the three river clips. The trees are cleared at each pose's stand point (the reference cameras stood on a walkway and a road bridge); the water is the same for every camera.

WEBGPU (2026-09-30): `render`, `bench`, `readWaterInfo`, `readClassMap`, `readSurfaceHeight`, `measureFoam` and `debugTargetSum` return promises (WebGPU reads back asynchronously); a rig awaits them (Playwright's `evaluate` waits for a returned promise). The probes and `bench` hold the page's loop while they run.

## Region luma percentiles (round 4)

The same measure (tag r4f):

| Pose | Ours p10 / p50 / p90 | Clip p10 / p50 / p90 | Round 3 |
|---|---|---|---|
| bank-along | 0.33 / 0.50 / 0.66 | 0.30 / 0.46 / 0.71 | 0.32 / 0.54 / 0.72 |
| riffle-down | 0.26 / 0.38 / 0.54 | 0.29 / 0.48 / 0.68 | 0.25 / 0.40 / 0.59 |
| calm-bridge | 0.24 / 0.35 / 0.64 | 0.26 / 0.40 / 0.82 | 0.24 / 0.39 / 0.68 |

Still-frame statistics (r4f): ripple sd ours / ref, bank-along fast 0.068 / 0.117 and calm 0.022 / 0.109, riffle-down fast 0.062 / 0.117, calm-bridge calm 0.104 / 0.102; white, bank-along fast 13.8 % / 12.2 %, riffle-down fast 1.7 % / 12.7 %; hue, bank-along fast 183 / 217, riffle-down fast 159 / 215, calm-bridge calm 90 / 50.

## Region luma percentiles (round 3)

`r3/regionStats.py` after `shootStillStats.mjs`: the 10th, 50th and 90th percentile luma of the water region at the judged size (ours: the water with the rocks standing in it filled in; the clips': hand-drawn polygons, `r3/refRegions.py`).

| Pose | Ours p10 / p50 / p90 | Clip p10 / p50 / p90 | Round 2 |
|---|---|---|---|
| bank-along | 0.32 / 0.54 / 0.72 | 0.30 / 0.46 / 0.71 | 0.39 / 0.51 / 0.64 |
| riffle-down | 0.25 / 0.40 / 0.59 | 0.29 / 0.48 / 0.68 | 0.42 / 0.51 / 0.61 |
| calm-bridge | 0.24 / 0.39 / 0.68 | 0.26 / 0.40 / 0.82 | 0.19 / 0.33 / 0.53 |

Round 3 final (tag t23), the same still-frame statistics as round 2 (below): ripple sd ours / ref, bank-along fast 0.069 / 0.117 and calm 0.072 / 0.109, riffle-down fast 0.067 / 0.117, calm-bridge calm 0.102 / 0.102. White: bank-along fast 19.2 % / 12.2 %, riffle-down fast 5.5 % / 12.7 %, calm-bridge calm 4.5 % / 13.5 %. Hue: bank-along fast 194 / 217, riffle-down fast 191 / 215, calm-bridge calm 73 / 50. The fast water's fine spread is still about 1.7 times under the clips'; in the clips it comes from many rocks and cobbles in the water and from fragmented white water, not from the reflection (a reflection that the 0.2 m ripples also turn, in broken water, raised it by 0.005 only).

## Still-frame statistics (round 2)

`.agent/scratch/water-gauntlet/river1/shootStillStats.mjs` then `stillStats.py`, at the judged size, ours against the reference frame: the luma sd of the water after a Gaussian high-pass (sigma 1 % of the frame width), the white-water share, the luma and hue, per zone (ours from the water info map; the references' by hand-picked boxes in the water). Round 2 final (tag s20):

| View | Zone | Ripple sd ours / ref | White ours / ref | Luma ours / ref | Hue ours / ref |
|---|---|---|---|---|---|
| bank-along | fast | 0.069 / 0.117 | 11.1 % / 12.2 % | 0.57 / 0.57 | 155 / 217 |
| bank-along | calm | 0.042 / 0.109 | 0 % / 2.3 % | 0.47 / 0.39 | 96 / 132 |
| riffle-down | fast | 0.063 / 0.117 | 2.2 % / 12.7 % | 0.54 / 0.56 | 154 / 215 |
| calm-bridge | calm | 0.059 / 0.102 | 0 % / 13.5 % | 0.33 / 0.46 | 76 / 50 |

Round 1 drew about 0.04 to 0.05 everywhere (a mirror). The references' spread stays about 1.7 times ours; their fast water's hue is the sky's blue-grey, ours a grey-green (a higher reflection floor matched the hue and drew a frosted sheet).

## Measured (round 4)

On the low-water field (1.5 m^3/s), six new points (`r4/pickPoints4.mts`: the fastest uniform windows of the thread, the riffle and the bend, the pool at s = 195, the weak eddy at the pool's head), the advected ripples alone: chute 0.62 against 0.61 m/s, riffle 1.14 against 1.08, bend 0.39 against 0.32 (1.20: the bend point holds rocks), pool jet 0.081 against 0.083, eddy 0.050 against 0.052 upstream; the pool bank's 0.010 m/s does not track in 0.15 s. The whole frame tracks at the chute (0.54) and the riffle (1.09) only: the clear shallow water shows the still bed, and the tracker locks on it. Bank slowdown at s = 195: model 0.123. Seams (now at the chute): the luma variance over one cycle varies by 3.2 % (1.7 % at the pulse frequency), the plain blend by 2.0 % and 1.1 %. Foam share: 8.3 % of fast shallow water, 0 of slow deep water.

## Measured (round 3)

The same six points, on the round-3 field (the bend head's rocks, 8 m^3/s; 80 s run: outflow 7.84 m^3/s, 430 s: 7.92), the advected ripples alone: chute 1.63 against 1.62 m/s, riffle 2.75 against 2.77, bend 1.79 against 1.78, pool jet 0.73 against 0.75, pool bank 0.088 against 0.090, eddy 0.74 against 0.74 (upstream); every direction within 1.1 degrees. The whole frame tracks at the chute (1.74 against 1.62), the riffle (2.76 against 2.77) and the pool jet (0.73 against 0.75, two of four origins), but NOT at the bend, the pool bank or the eddy: in plan view the clear water shows the static bed and the mirrored canopy there, and the tracker locks on them (0.05 m/s at the eddy; round 2 tracked 0.72). Bank slowdown at s = 195: model 0.119, drawn (ripples) 0.121. Seams at the bend point: the luma variance over one cycle varies by 7.6 % (4.6 % at the pulse frequency), the plain blend by 5.9 % and 4.0 %: the crop now holds rocks whose white water changes through the cycle, so both blends vary, and this crop no longer isolates the blend. Foam share: 12.4 % of fast shallow water, 0.020 % of slow deep water, steady to 2.2 % through the cycle.

## Measured (round 2)

On the round-2 field (the U section, the ragged edge, 8 m^3/s), six points, the advected ripples alone: chute 1.82 against 1.77 m/s, riffle 2.78 against 2.79, bend 1.07 against 1.07, pool jet 0.80 against 0.83, pool bank 0.107 against 0.098, eddy 0.72 against 0.74 (upstream); every direction within 3.5 degrees. Bank slowdown at s = 195: model 0.118, drawn 0.134. Seams: the luma variance over one cycle varies by 0.96 % (0.78 % at the pulse frequency); the plain blend 1.84 % and 2.07 %. Foam share: 11.8 % of fast shallow water, 0.015 % of slow deep water, steady to 1.9 % through the cycle.

## Measured (round 1)

See `.agent/scratch/water-gauntlet/river1/measure/` (not in git; `sweepRiverMeasure.mjs` then `measure.py`) and the round report. Speeds are tracked by phase correlation of three-frame differences (the time is pinned, so every static part of the frame cancels), median over four time origins.

- **Drawn speed against the model** (the advected ripples alone): chute 1.59 against 1.58 m/s, riffle 2.49 against 2.44, bend 0.88 against 0.89, pool jet 0.58 against 0.67 (the weakest track: slow deep water, correlation peak 0.04), eddy 0.58 against 0.60 running UPSTREAM; directions within 1 degree except the pool jet (8). The whole frame (foam, glints, caustics included) tracks the same at the chute, the riffle and the bend.
- **Bank slowdown:** at the pool cross-section the model runs 0.045 m/s at the bank and 0.67 m/s mid-channel (0.07); the drawn ripples run 0.052 and 0.58 (0.09).
- **Seams:** the luma variance of the frame through one 1.0 s flow-map cycle varies by 0.25 % (coefficient of variation), 0.10 % at the pulse frequency; the plain blend varies by 0.93 % and 1.12 %.
- **Foam share:** the drawn foam covers 20.7 % of fast shallow water (over 1.2 m/s in under 0.6 m) and 0.016 % of slow deep water (under 0.4 m/s in over 1 m), steady through the cycle (20.1 to 20.8 %).

## The renderer (WebGPU)

Remy asked (2026-09-29): "can we move this to webGPU?" The one water needs one renderer (GG-341, the Water and Land sheet's q35), and the FFT ocean has no WebGL path, so the river moved first. Since 2026-09-30 the river scene draws with three's `WebGPURenderer` (three 0.172). There is no WebGL path: `RiverReachView.init()` fails with an error when the browser has no WebGPU, or when the renderer starts on its WebGL2 fallback.

What changed with the renderer:

- **The shaders are TSL node graphs**, term by term from the GLSL, with the GLSL's comments kept at the terms they explain: the water (`createRiverWaterMaterial`: a `NodeMaterial` with a fragment node; the flow functions in `createRiverFlowNodes`, shared with the banks), the banks (`createRiverBankMaterial`: color, normal and roughness nodes, and a lighting model that scales the sun's diffuse light by the caustics), the canopy clumps and the leaf cards (`riverVegetation.ts`), the sky dome and the full-screen passes (`riverReachScene.ts`).
- **The targets.** WebGPU has no depth resolve, so the opaque pass's depth is a multisampled texture; the copy and the water read it at sample 0. An MSAA texture has one mip level, so the mirror renders into an MSAA target and a copy pass fills a mipmapped target that the water reads.
- **The mirror's oblique clip** is built for WebGPU's 0..1 depth: the third row is C / (C . q) with no + 1 (as three's `ReflectorNode`), and a bias of 0.0015 keeps WebGL's slack below the plane.
- **Asynchronous read-back.** `render()` returns a promise: a frame that meters the exposure waits for the meter's read-back before its output pass, so it goes out with its own exposure, as in WebGL. A read-back helper pads each row to 256 bytes (three 0.172's own read-back fails at widths such as 1,200 px of half floats).
- **Screen uv runs down** in WebGPU: the water flips v in each uv it builds from a projection.

**THREE 0.172 FAULTS, WORKED AROUND IN THE RIVER ONLY.** Each was found by a difference from the WebGL frames and fixed to it; GG-363 lists them for a three upgrade, GG-364 the ones that touch other pages.

- **The scene fog is applied twice** to every lit node material (the WGSL of a bank tile: `Output = mix(Output, fog, f)`, then the color again). The scene's density is `fogDensity / sqrt(2)`: two passes at d / sqrt(2) are one pass at d, exactly. The water hazes itself at the full density.
- **The hemisphere light** weighs the sky by the plain vertex normal, and dots that view-space normal with a world direction, so the sky light turned with the camera. `RiverHemisphereLight` and its node (registered on the view's own renderer's node library) use the shaded normal in world space, as WebGL did (a gray sphere drew 5 to 7 % darker before).
- **Alpha to coverage** keeps the texture's raw alpha as the coverage: the leaf cards take WebGL's ramp, smoothstep(0.45, 0.45 + fwidth(a), a), in their color node (the crowns drew thin, and the sky through them raised the meter).
- **A caster's alpha scales its shadow:** the leaf cards' cast-shadow node discards under 0.45 and writes alpha 1 (the canopy's shade on the bars was nearly gone).
- **The shadow map is kept per camera:** the prime draws it for the main camera and for the mirror's camera (with the main camera's layers), twice each (in the very first draw the leaf cards cast nothing).
- **An instanced mesh's matrix read is fixed by its `count` at the first draw** (under 1,001, a uniform array of that length): the plant copies keep `count` at the capacity and cull through their own geometry's `instanceCount`.
- Smaller ones: the quads read `positionGeometry` (`positionLocal` is a varying, and a varying read only in a custom vertex node broke the WGSL build); every base texture node has a placeholder uv (else each sample multiplies its uv by the texture's matrix, which breaks an integer load); a load is a sample with the sampler off (there is no `.load()`); `atan2` is `atan`.

**THE FRAMES AGAINST WEBGL** (`.agent/scratch/river-webgpu/shootPort.mjs` and `pair.py`, not in git: the four judged poses at their judged sizes and one free-look pose, t = 12 s, the perf badge's corner left out). Two renderers round and filter differently, so pixels move; each pair was looked at, and no term, color shift or lost reflection is left:

| Pose | Pixels over 8/255 | Mean | Max | Exposure WebGL / WebGPU |
|---|---|---|---|---|
| bank-along | 8.45 % | 2.81 | 221 | 0.929 / 0.929 |
| riffle-down | 8.73 % | 3.03 | 199 | 0.662 / 0.665 |
| calm-bridge | 25.6 % | 8.23 | 236 | 1.819 / 1.816 |
| pebble-close | 0.58 % | 0.68 | 49 | 0.6187 / 0.6188 |
| free-look | 13.5 % | 4.44 | 246 | 1.048 / 1.050 |

What is left is speckle: the leaf cards' coverage at their edges, and the pool's fine reflected detail. Two WebGPU captures are 0 px apart, with the cache and without it. The river has not won a judge yet: the port is judged fresh later.

**OTHER PROOF** (2026-09-30):

- The floaters' CPU mirror agrees with the shader's height (debug output 10) at 29 probes to 9.65e-6 m (RMS height 5.1 mm); the 30th probe falls on the bank beside the grounded boat. The boat and the ducks ride the water at boat-follow and ducks-pool, as in WebGL.
- The live editor: a path drag 3.9 updates a second (210 ms a round trip), the width slider 3.1 (211 ms), a node height 6.9 (75 ms), "Reset height" and "Reset river" by the mouse.
- The flip fix holds: the mirror plane eases from 2.38 m to about 6 m over a 36-step turn, with no alternation (`flipProbeGpu.mjs`; the free look turns with the left button now).
- The read-back probes agree with WebGL's: the class map to four digits, the fast-shallow foam share 0.0588 against 0.0593, the water share 13.7 % against 13.2 %.

## Frame cost

**WebGPU against WebGL (2026-09-30)** (`.agent/scratch/river-webgpu/benchPort.mjs`: page loads alternate WebGL, which is the scene as it was before the port, and WebGPU in the same minutes, three rounds, vsync and the frame-rate limit off, 1600 x 900, the GPU waited on after each frame; medians):

| Pose | WebGL frame | WebGPU frame | WebGL: water adds, reflection pass | WebGPU: water adds, reflection pass |
|---|---|---|---|---|
| bank-along | 11.0 ms | 16.9 ms | 4.7, 2.5 ms | 7.0, 6.0 ms |
| riffle-down | 8.1 ms | 12.0 ms | 4.8, 1.8 ms | 5.1, 4.5 ms |
| calm-bridge | 16.6 ms | 21.9 ms | 6.1, 3.5 ms | 5.0, 4.6 ms |
| pebble-close | 7.2 ms | 7.5 ms | 4.5, 1.9 ms | 2.0, 1.7 ms |
| free-look | 10.6 ms | 19.7 ms | 3.3, 1.9 ms | 6.3, 5.8 ms |

The WebGPU scene is CPU-bound. Both renderers issue the same draws (337 at bank-along and 437 at free-look, with the same triangles), and three 0.172's WebGPU path spends about 27 µs of CPU a draw against WebGL's 12 (buffer writes, bind groups, vertex buffers, the scene's matrices; a CPU profile shows no single hot spot in the river's code). The render calls take 8 to 13 ms of CPU a frame against WebGL's 2 to 4.6. The perf panel on the page (`perf-unify/shootPerf.mjs river`): WebGL 60.1 fps, GPU-bound (GPU 9.95 ms, CPU 4.35 ms); WebGPU 52.1 fps, CPU 16.4 ms a frame, and "no GPU clock", because three 0.172's timestamps record only the first pass (the panel says so). GG-362 holds the ways to cut the CPU.

At 1600 x 900 on this machine (RTX 2070 SUPER), A/B in the same minutes (`__RIVER__.bench(60)`, six alternations per pose, medians): the water adds 4.1 to 5.1 ms a frame, of which the reflection pass is 2.7 to 3.6 ms (it draws the whole scene again, 5.6 million triangles of vegetation included). The rest (the depth copy and the water shading) is about 1.4 ms. Whole frames: 7.9 ms (bank-along), 6.8 ms (riffle-down), 11.9 ms (calm-bridge). Round 2 (same method, same minutes): the water adds 4.3 ms (bank-along), 4.5 ms (riffle-down) and 5.5 ms (calm-bridge), of which the reflection pass is 2.0 to 3.9 ms; whole frames 8.2, 7.1 and 13.0 ms. The flow itself costs nothing per frame: it is solved once (about 11 s in a worker) and cached per viewer.

Round 3 (1600 x 900, the same method): the water adds 7.6 ms (bank-along), 7.0 ms (riffle-down) and 7.5 ms (calm-bridge), of which the reflection pass is 4.6, 4.6 and 5.6 ms; whole frames 15.0, 12.3 and 16.6 ms; the vegetation 8.9 million triangles in both passes.

Round 4 (`r4/benchCull.mjs`: round 3's vegetation drawing against the per-pose culling with the stand-ins, in the same minutes, two runs on a shared GPU): whole frames 16.8 to 18.8 ms against 16.6 to 16.7 ms (bank-along), 17.1 to 17.5 against 12.5 to 14.0 ms (riffle-down), 24.4 to 30.4 against 20.9 to 28.8 ms (calm-bridge). With the culling (`benchRiverAB.mjs`) the water adds 8.4, 6.7 and 7.8 ms, of which the reflection pass is 4.8, 3.1 and 5.3 ms: round 4's scene is heavier (2,600 rocks, the tiles, a heavier shader), and the culling pays that back but not more. The floaters add 0.0 to 0.9 ms (`r4/benchFloaters.mjs`, within the noise).

## Rules

- The judged water is a pure function of (seed, time): the time only moves textures along a steady field. The live river is not (it runs on the wall clock); the captures draw the judged water.
- An edit's ground is a pure function of the edit (the bed patch), never of the drag that made it.
- No look keyed on where the camera stands. The mirror plane is chosen from the look point (which plane the reflection is drawn in, not how much there is), and the foam and ripple fades are keyed on a texture's size on screen.
- A free camera's mirror plane (`mirrorPlaneFromCamera`) walks the view ray until it meets the water or the ground, and eases toward that water level at `RIVER_MIRROR_PLANE_RATE_M_PER_S` (2 m/s). Never cut the ray with the previous plane: on a river with two water levels that fed back, and the plane alternated 2.56 m and 4.06 m on every step of a drag (the flip Remy saw on 2026-09-29; probe `.agent/scratch/river-live/flipProbe.mjs`). A pinned pose and the boat camera set the plane from the look point as before, so the captures are unchanged (0 px on three judged poses, 1 px on calm-bridge).
- A dry inflow never kills the live river (2026-09-30). An edit that lifts the bed above the design level at the west edge leaves `reachInflow` no wet cell; `LiveRiver.updateInflow` then keeps the last inflow and sets `inflowDry`, which travels in the frame and the live status to an amber line on the page. Before, the throw left the worker's message handler, and the page showed a red error until a reload.
- The ocean files are read, never edited, from here.
- The river draws with WebGPU only (since 2026-09-30). A browser without WebGPU gets an error, never a WebGL copy.
- The three 0.172 workarounds ("The renderer (WebGPU)") belong to that version: on a three upgrade, check each one against the WGSL and the frames (GG-363).
