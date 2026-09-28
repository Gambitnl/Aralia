# Water: foam, buoyancy, and audio

> **REVIEWED, AND IT DID NOT ALL SURVIVE.** A second agent attacked every claim
> in this file against the real solver and the real package list. Verdict: 32
> claims checked, 15 failed. Read
> [the review](water-foam-buoyancy-audio-REVIEW.md) BEFORE you build from any
> section here. All three top recommendations are blocked as written:
>
> 1. **The discharge is private.** This file says per-cell flux is "already
>    computed each step", which is true, and implies it is reachable, which is
>    not. `fluxL/R/D/U` are `private readonly` on `ShallowWaterField` with no
>    getter. Five techniques here read it, including the top foam pick and the
>    top sound pick.
> 2. **The flux is not a discharge.** It is a depth decrement in meters. The
>    conversion given omits the `/ dt`, which makes every Froude number come out
>    at least 30 times too small, so the fast-water test never fires. That
>    failure is SILENT: the code looks implemented and produces no foam.
> 3. **There is no physics engine.** The buoyancy section assumes
>    `applyForceAtPoint`. No rapier, cannon, ammo or matter-js is installed.
>
> The one public speed field the solver DOES expose, `exitSpeed`, is never
> mentioned here.
>
> Nothing below has been edited. A research file that is quietly corrected stops
> being evidence of what was actually claimed.

Research for a three.js r172 WebGL project (React Three Fiber, no WebGPU).

## The constraint set this is judged against

The water is a CPU-side shallow-water height field. One depth value per ground
cell. A 240 x 240 grid at 1 m, so 57,600 cells. Per-cell depth `d` and per-cell
discharge (outflow flux) are already computed each step.

That last fact decides most of this document. A depth-and-discharge grid is the
[virtual pipe model of O'Brien, as used by Mei, Decaudin and Hu
(2007)](http://www-evasion.imag.fr/Publications/2007/MDH07/FastErosion_PG07.pdf).
Their grid stores exactly what this project stores: "terrain height b, water
height d, ... the outflow flux f = (f L, f R, f T , f B) and velocity vector
v = (u, v)".

The bridge from discharge to a velocity field is their equations 8 and 9:

```
W_X = ( f_R(x-1,y) - f_L(x,y) + f_R(x,y) - f_L(x+1,y) ) / 2
l_Y * d_avg * u = W_X          ->   u = W_X / (l_Y * d_avg)
```

with `d_avg` the mean water height across the step. The Y component follows the
same way. At `l_X = l_Y = 1 m` this is four adds, a halving and one divide per
cell per axis.

**Everything below that "gets foam or sound cheaply" gets it from `d`, from
`grad(d + b)`, or from `u` derived by those two equations.** No second
simulation is needed for any of it.

One external confirmation that this is the production path: Sea of Thieves runs
its shallow-water surface features on exactly this solver family. From [The
Technical Art of Sea of Thieves, SIGGRAPH 2018
Talks](https://history.siggraph.org/wp-content/uploads/2022/09/2018-Talks-Ang_The-Technical-Art-of-Sea-of-Thieves.pdf):
"For shallow water features, such as water splashing on the deck of a ship, we
use a GPU water surface simulation based on [Mei et al. 2007]."

### Sources I could not read

Be aware of these gaps before trusting a line in this document.

- `audiokinetic.com` returns HTTP 403 to the fetcher. The Wwise
  `SetMultiplePositions` API page, the spline-emitter blog post and the *Game of
  Thrones: Winter is Coming* ambience blog post are cited from search-engine
  summaries only. I did not read the pages.
- The [NVIDIA/Gaijin *Ocean simulation and rendering in War Thunder*
  deck](https://developer.download.nvidia.com/assets/gameworks/downloads/regular/events/cgdc15/CGDC2015_ocean_simulation_en.pdf)
  is an image-only PDF. No text is extractable. I have not cited its content.
- `moddb.com` and `gamedev.net` return 403. The Ghost of Tsushima
  multi-position claim and the "5 x 5 grid over 512 x 512 m" claim in the audio
  section come from search summaries of those pages, not the pages. Treat both
  as unverified.
- Unity's HDRP foam documentation pages fetch as navigation shells. Only the
  settings names below are confirmed.

---

# 1. Foam and white water

## F1. Persistent foam field with per-frame decay

**How it works.** Keep one scalar foam value per cell in its own buffer. Each
step, add foam from source terms, then multiply the whole field by a decay
factor. Foam then lingers behind the event that made it instead of popping on
and off with the source.

**Where.** Crest Ocean System for Unity calls this its foam simulation: foam
"values persist in a texture-based LOD system and gradually dissipate each
update cycle", tuned by a `Foam Fade Rate` setting, per the [Crest ocean
simulation
docs](https://crest.readthedocs.io/en/4.12/user/ocean-simulation.html). Sea of
Thieves does the same with an extra step: "We progressively blur the result of
the foam buffer with feedback to simulate the foam dispersing and to give us a
softer mask, more in keeping with the style of the game. The resulting mask is
blended with artist-authored textures" ([SIGGRAPH 2018
Talks](https://history.siggraph.org/wp-content/uploads/2022/09/2018-Talks-Ang_The-Technical-Art-of-Sea-of-Thieves.pdf)).

**FITS.** This is the single highest-value technique for this constraint set.
The field is one more `Float32Array(57600)` beside `depth`. It is written on the
CPU next to the solver, where every source term is already in registers. Because
the buffer is CPU-side, the decay is trivially time-correct: multiply by
`exp(-k*dt)`, not by a fixed per-frame constant.

**COST.** One extra 230 KB Float32Array. One multiply-add pass over 57,600
cells per step, which is a handful of flops per cell - order of a tenth of a
millisecond in JS, but that is an estimate and has not been measured in this
repo. Upload as a 240 x 240 single-channel `DataTexture` (57.6 KB as R8, 230 KB
as R32F) each frame; `texture.needsUpdate = true` on an existing texture avoids
a reallocation. Complicates: the foam field is now state, so it must be reset,
resized and serialized wherever the depth field is.

## F2. Foam from shallow depth (the wet-dry band)

**How it works.** Generate foam wherever the water depth is below a threshold.
This paints the shoreline, the sand bar and the edge of a spreading film without
any surface analysis.

**Where.** Crest exposes this directly: "If water depth input is provided to the
system, the foam sim can automatically generate foam when water is very shallow
to approximate accumulation of foam at shorelines", governed by
`Shoreline Foam Max Depth` and `Shoreline Foam Strength` ([Crest
docs](https://crest.readthedocs.io/en/4.12/user/ocean-simulation.html)).

**FITS, and it is free.** `d` is the primary state variable of the solver. The
source term is `foam += k * smoothstep(maxDepth, 0, d)`.

**COST.** One smoothstep per cell. Effectively zero on top of F1.

**The trap this project has already hit.** Do not use `step()` or a bare
comparison on `d` here. `docs/water-hall-of-shame.md` entry 4, "the shoreline
that flickers", records exactly this failure on the ripple layer: a `step()` on
depth in a spreading film makes every shallow cell switch on and off at frame
rate. Ramp with `smoothstep` across a band. The fix cost nothing.

## F3. Foam from flow speed and from the Froude number

**How it works.** Generate foam where the water moves fast for its depth. The
dimensionless form is the Froude number `Fr = |u| / sqrt(g * d)`. `Fr > 1` is
supercritical flow: a chute, a spill lip, the throat of a rapid. A cell where
`Fr` falls from above 1 to below 1 is a hydraulic jump, which is the standing
white wave at the bottom of a drop.

**Where.** The physics is standard open-channel hydraulics
([Wikipedia: hydraulic jump](https://en.wikipedia.org/wiki/Hydraulic_jump)); a
jump "forms only where the flow enters as supercritical (Fr>1) and leaves as
subcritical (Fr<1)". The closest thing to a game citation is oblique: Alex
Vlachos scales water normal strength by flow speed in Left 4 Dead 2 and Portal 2
("We scale down the strength of the normal in tangent space by the flow speed",
[Water Flow in Portal 2, SIGGRAPH
2010](https://cdn.akamai.steamstatic.com/apps/valve/2010/siggraph2010_vlachos_waterflow.pdf)).

**Be blunt: I found no shipped game that cites the Froude criterion by name for
foam.** I am recommending it on physics, not on precedent. What is verified is
that the two inputs are already on hand and that flow speed is an accepted foam
and normal-strength driver.

**FITS, and it is the best-value new source term here.** `|u|` comes from the
discharge by the Mei equations above. `d` is already there. `Fr` needs one
`sqrt` and one divide per cell. It automatically distinguishes a slow deep pool
(no foam) from a thin fast sheet over a rock (white), which no depth-only or
speed-only test does.

**COST.** One sqrt, one divide, one smoothstep per cell, plus the two-axis
discharge-to-velocity conversion if it is not already cached. Complicates:
`d_avg` in the denominator goes to zero at the dry edge, so clamp it, or `Fr`
explodes across the whole shoreline and F2 and F3 fight each other.

## F4. Foam advected by the flow field

**How it works.** Move the foam field downstream with the water instead of
leaving it pinned to the cell that made it. Semi-Lagrangian advection: for each
cell, look up the foam at `p - u*dt` and copy it in.

**Where.** Chentanez and Müller advect their foam this way: "Foam is advected by
the velocity field of the fluid simulation and projected onto the fluid surface.
Its lifetime is a user-defined parameter modulated with some noise. It nicely
conveys the horizontal swirling water motion" ([Real-time Simulation of Large
Bodies of Water with Small Scale Details, SCA
2010](https://matthias-research.github.io/pages/publications/hfFluid.pdf)). They
also state the reason the shallow-water equations were chosen over the wave
equation at all: "The presence of a horizontal velocity field allows us to
correctly advect floating objects and foam particles on the surface."

**FITS.** This is what turns F1's decaying blobs into a river that reads as
flowing. A foam patch born at a rock trails downstream and fades, which is the
single strongest visual cue that water is moving.

**COST.** One bilinear gather per cell per step, plus a second 230 KB buffer to
ping-pong into. Roughly the cost of F1 again, maybe two to three times it
because of the scattered reads. Complicates: semi-Lagrangian advection is
diffusive, so foam smears and softens over distance. Sea of Thieves turned that
same softening into the art direction. Also complicates volume bookkeeping if
anyone later treats foam as mass; it is not mass, it is a stain.

## F5. Flow-map distortion of the foam and normal textures

**How it works.** Store a 2D flow vector per texel. In the shader, offset the
foam and normal texture UVs by `flow * time`. Because the offset grows without
bound, run two layers a half-cycle apart and cross-fade between them, so each
layer's reset is hidden under the other. Add a noise offset per pixel to break
the shared pulse.

**Where.** Alex Vlachos, [Water Flow in Portal 2, SIGGRAPH
2010](https://cdn.akamai.steamstatic.com/apps/valve/2010/siggraph2010_vlachos_waterflow.pdf),
shipped in Left 4 Dead 2 and Portal 2. Flow maps there were artist-authored in
Houdini at "~4 texels/meter". His stated future work is precisely this project's
situation: "Render dynamic flow vectors per-frame so animated objects cause flow
changes" and "Use flow map with our physics simulation to have objects flow on
the water surface using the same data."

**FITS, and three.js already implements the shader.** `node_modules/three/examples/jsm/objects/Water2.js`
in r172 is this exact algorithm - it carries `flowMap`, `flowMapOffset0`,
`flowMapOffset1`, `halfCycle` and the `flowLerp` cross-fade. Feed it a
`DataTexture` built from the discharge-derived `u` and it becomes a
simulation-driven flow map instead of a painted one. A 240 x 240 grid at 1 m is
1 texel per meter, four times coarser than Valve's 4 texels/m; that is a
resolution risk, not a blocker, because the flow field is smooth.

**COST.** Vlachos measured it against scrolling two normal maps: "Additional
texture fetches: 2 - flow & noise. Additional arithmetic pixel shader
instructions: 21." That is a fragment-shader cost, paid per covered pixel, not
per cell. CPU side, one RG texture upload per frame (115 KB as RG8). Complicates:
Water2 is a self-contained material with its own reflector; wiring a custom foam
mask into it means either forking it or patching via `onBeforeCompile`.

## F6. Depth-buffer intersection foam around objects

**How it works.** In the water fragment shader, read scene depth, reconstruct
the distance from the water surface to whatever is behind it, and draw foam
where that distance is small. This puts a foam collar around anything poking
through the surface, with no per-object work.

**Where.** Sea of Thieves: foam "is also added around objects that intersect the
water surface within a camera centered window using depth buffer comparisons",
and for streams this lets "a character standing in a running stream to have foam
interacting with their feet where they intersect with the water surface"
([SIGGRAPH 2018
Talks](https://history.siggraph.org/wp-content/uploads/2022/09/2018-Talks-Ang_The-Technical-Art-of-Sea-of-Thieves.pdf)).
The tutorial-grade version, with code, is [3D Game Shaders For Beginners:
Foam](https://lettier.github.io/3d-game-shaders-for-beginners/foam.html):
`float depth = (positionTo.xyz - positionFrom.xyz).y;` then
`amount = clamp(depth / foamDepth.x, 0, 1); amount = 1 - amount; amount *= mask.r;`
with the easing `amount * amount / (2 * (amount * amount - amount) + 1)`. Alex
Tardif's [Water Walkthrough](https://alextardif.com/Water.html) adds it to
surface foam as `foamAmount += pow((1.0 - depthSoftenedAlpha), 3)`.

**FITS, but it is the odd one out.** It is a screen-space pass that knows
nothing about the solver. It is the correct way to foam around a character or a
dropped crate, which the height field cannot see. Use it *in addition to*
F1 to F4, not instead of them.

**COST.** Requires a depth texture bound to the water material. In three.js
WebGL that means an extra depth render target or `WebGLRenderer` depth-texture
support, plus one texture fetch and a linearization per water pixel. Complicates:
it is resolution-dependent and it fights with any transparent sorting. It also
does not decay, so a collar snaps on and off as an object enters and leaves.
Feeding it into the F1 accumulation buffer instead of drawing it directly fixes
that, which is what Sea of Thieves does.

## F7. Foam particles spawned where the height field fails

**How it works.** Detect cells the 2D model cannot represent - a waterfall lip,
a breaking front - and convert the water there into spray, splash and foam
particles that carry the mass and momentum across the discontinuity.

**Where.** Chentanez and Müller, [SCA
2010](https://matthias-research.github.io/pages/publications/hfFluid.pdf). Their
waterfall test is a terrain-slope threshold: face `(i+1/2, j)` is a waterfall
face if `(H_ij - H_i+1,j) / dx > H_cap` and `H_ij > eta_i+1,j`, with
`H_cap = 3` in all their examples. Their breaking-wave test needs three
conditions together: steep enough (`|grad eta| > gamma_minSplash * g * dt / dx`),
rising fast at the front of a wave (`(eta - eta_prev)/dt > v_minSplash`), and near
the top (`laplacian(eta) < l_minSplash`), with `v_minSplash = 4`,
`gamma_minSplash = 0.45`, `l_minSplash = -4`. Foam particles are then "rendered
as diffuse disks with normals perpendicular to the height field water surface".

**PARTIALLY FITS.** The waterfall criterion fits perfectly and is nearly free:
it is a bed-slope test on data already held. It also has a stability payoff they
call out - "steep terrain slopes cause numerical instabilities" and routing that
volume into particles removes the instability. The breaking-wave criterion does
not fit as well, because a 1 m cell on a 240 m patch will rarely resolve a
breaking wave, and the `eta_prev` term needs a second height buffer.

**COST.** Their own numbers, on a 2010 GTX 480 and Core i7: particle generation
`Gen` was 5.1 ms and particle simulation `Par` 7.5 to 16.2 ms on the CPU for the
boat scene at 250K particles; on the GPU, `Gen` 0.8 to 1.9 ms. On the CPU the
whole boat frame ran 69 to 94 ms. **Read that as a warning.** A JS particle
system at that scale is not viable. A few hundred short-lived sprites at a
waterfall lip is. Complicates: particles need their own draw path, their own
lifetime pool, and two-way mass exchange with the grid if volume must balance.

## F8. Wave-crest / Jacobian foam (DOES NOT FIT)

**How it works.** For an FFT ocean, foam goes where the horizontal displacement
map folds - where the Jacobian of the displacement goes negative, or where the
choppiness offset is large.

**Where.** Tessendorf, *Simulating Ocean Water* (SIGGRAPH 2001 course notes) is
the origin - Sea of Thieves cites it as its reference paper. Sea of Thieves
states plainly "Foam is generated at wave peaks using the method
described in the reference paper" and derives its wave-peak mask "from the FFT
choppiness vertex offsets". Crest's equivalent is foam from "choppy water
(_pinched_ wave crests)".

**DOES NOT FIT.** There is no displacement map and no choppiness term in a
shallow-water depth-and-discharge grid. There is nothing to take a Jacobian of.
Listed here so nobody spends a day porting it.

**COST.** Not applicable.

## Foam: what the solver gives you for free

Ranked by value per line of code:

| Source term | Input already held | Extra math per cell |
| --- | --- | --- |
| Shoreline / wet-dry (F2) | `d` | one smoothstep |
| Fast-shallow, Froude (F3) | `d`, discharge | one sqrt, one divide |
| Waterfall lip (F7 criterion only) | bed `b`, `d` | one slope test |
| Flow direction for the flow map (F5) | discharge | eqs. 8 and 9 |

None of these needs a new simulation. All four write into the same F1 buffer.

---

# 2. Buoyancy and floating objects

## B1. Single-point probe

**How it works.** Sample the water surface height at the object's center. If the
center is below it, push up with a force proportional to the submerged depth.
One sample, one force, no torque from the water.

**Where.** The baseline in every engine. It is the degenerate case of Unreal's
pontoon system with one pontoon; Epic's [Water Buoyancy Component
docs](https://dev.epicgames.com/documentation/en-us/unreal-engine/water-buoyancy-component-in-unreal-engine)
implicitly contrast it by noting that "In order for objects to balance and sit
upright on the water's surface" you need more than one.

**FITS.** Sampling is a bilinear read of `b + d` on the grid. That is about ten
flops. For a barrel, a crate, a corpse, a leaf, or anything the camera sees at
distance, this is the right answer.

**COST.** Effectively free. Complicates: nothing. It simply cannot produce pitch
or roll, so the object sits flat and reads as dead.

## B2. Multi-point probes (pontoons)

**How it works.** Attach N sample points to the rigid body. Each frame,
transform each point to world space, sample the surface height there, and apply
an independent upward force at that point. The offsets do the rest - differing
submersion across the points generates the torque that produces pitch and roll.

**Where.** Unreal Engine 5's Water plugin. Its Buoyancy Component "uses spheres
(pontoons) to create a simplistic volumetric approximation of the object", the
documented example uses **four** pontoons at the corners of a boat, and each
carries its own `Radius` and `Relative Location`. Damping is split: two
Z-velocity-based damping values plus linear, squared and angular drag
coefficients ([Epic
docs](https://dev.epicgames.com/documentation/en-us/unreal-engine/water-buoyancy-component-in-unreal-engine)).

**FITS, and this is the recommendation.** Four probes on a raft cost four
bilinear samples per frame. The height field is CPU-side, so there is no query
latency, no readback, no polling, and no frame of delay - the whole class of
problem that Crest and UE have to engineer around simply does not exist here.

**COST.** N bilinear samples plus N `applyForceAtPoint` calls per body per
frame. For a dozen floaters at four probes each that is 48 samples - noise. It
complicates one thing seriously: probe forces are a spring, and a stiff spring
plus a large `dt` oscillates. Epic ships two separate damping coefficients for
exactly this reason. Budget for tuning damping, and clamp the submerged depth
used in the force so a probe that suddenly finds itself 3 m under does not
launch the body.

## B3. Submerged-triangle integration (surfacic method)

**How it works.** Walk the hull mesh. For each triangle, classify its three
vertices as above or below the water. Keep fully submerged triangles, discard
fully dry ones, and cut the mixed ones into a wet sub-triangle. Integrate
hydrostatic pressure over each wet triangle and sum the linear and angular
impulses about the center of gravity.

**Where.** Jacques Kerner (Avalanche Studios), [Water interaction model for
boats in video
games](https://www.gamedeveloper.com/programming/water-interaction-model-for-boats-in-video-games)
and [part
2](https://www.gamedeveloper.com/programming/water-interaction-model-for-boats-in-video-games-part-2),
derived from Just Cause 3's boat physics. The per-triangle vertical force is
`F = rho * g * A * h_c`. He is explicit that the force application point must
account for pressure varying with depth rather than sitting at the triangle
centroid, or the torque is wrong. His budget: "less than 1 ms per boat".

**FITS, but only for one hero object.** It is the correct model for a rowboat or
a ferry the player stands on. It is overkill for floating debris.

**COST.** Kerner's own figure is under 1 ms per boat on a console-era CPU, in
C++. In JavaScript, on a low-poly hull of a few hundred triangles, expect the
same order but verify. Complicates: it needs a dedicated low-poly buoyancy hull
separate from the render mesh, plus the triangle-cutting code and its
degenerate cases.

## B4. Cached water patch (sample once, reuse for every query)

**How it works.** Before the physics step, evaluate the water surface once at
evenly spaced points around the body and store it as a small local height map
with precomputed per-triangle plane equations. Every subsequent height query in
that step is a plane evaluation against the cache, not a call into the wave
model.

**Where.** Kerner again. He samples "once and for all at equally spaced points
around the body, therefore creating a height map which is used for all subsequent
height queries", because calling into an FFT or Gerstner evaluator hundreds of
times per body per frame is what makes B3 expensive.

**ALREADY DONE - the grid is the water patch.** This is the single clearest
"you are already there" result in this document. Kerner builds a cached
grid-of-heights because his wave source is expensive. This project's wave source
*is* a cached grid of heights. B3 therefore costs materially less here than it
did for Just Cause 3.

**COST.** Zero. The saving is the point.

## B5. Two-way coupling - the object displaces the water

**How it works.** After computing the water's force on the body, modify the
height field and velocity field to account for the volume the body swept through
during the step. The boat pushes a bow wave, and that wave is real water that
then flows away.

**Where.** Chentanez and Müller, section 2.3, [SCA
2010](https://matthias-research.github.io/pages/publications/hfFluid.pdf). The
height change is the swept volume `V_disp` divided by the cell area, scaled by
`C_dis = 1.0`; the velocity adaptation uses `C_adapt = 0.2`. Their measured
coupling cost `Cou` was 2.2 to 3.1 ms.

**FITS, with a caveat this repo has already documented.** The mechanism is
in-tree: `src/components/BattleMap/terrain/VolumeArenaWater.tsx` already
redistributes displaced volume onto a rim when the bed changes, with the
comment "A bed that DROPPED (a crater) keeps its column's water MASS." The same
machinery serves a hull. The caveat is the paper's own: "although the height
integration step conserves volume, the coupling and the overshooting reduction
do not."

**COST.** Their 2.2 to 3.1 ms was one boat on a 900 x 135 grid in C++/CUDA.
Scale to a 240 x 240 grid and a handful of floaters and it is smaller, but this
is the most expensive item in the buoyancy section and the only one that can
destabilize the solver. Complicates: volume drift, and a new coupling between
the physics step rate and the fluid step rate.

## B6. Horizontal advection - floaters ride the current

**How it works.** Apply a drag force toward the local water velocity `u`, so a
floating object is carried downstream instead of bobbing in place.

**Where.** Chentanez and Müller name this as the reason they chose the shallow
water equations at all: "The presence of a horizontal velocity field allows us to
correctly advect floating objects and foam particles on the surface." Vlachos
lists it as future work for Portal 2: "Use flow map with our physics simulation
to have objects flow on the water surface using the same data."

**FITS, and it is nearly free.** `u` comes from the discharge. The force is
`F_drag = c * (u_water - v_object_horizontal)`, sampled at the body center.

**COST.** One velocity sample and one force per body. Complicates: the drag
coefficient interacts with B2's vertical damping; tune them together or a raft
will either skate or stick.

## B7. GPU async readback queries (DOES NOT FIT)

**How it works.** When the height field lives in a GPU texture, upload query
positions to a compute shader, sample the water data there, and read the results
back asynchronously. Results arrive one or more frames late, so gameplay code
polls for them.

**Where.** Crest Ocean System's collision system: "query positions are uploaded
to a compute shader which then samples the ocean data and returns the desired
results", and "the results can take a couple of frames to return to the CPU".
Queries need globally unique IDs, and "querying a second time using the same ID
will stomp over the last query points" ([Crest collision
docs](https://crest.readthedocs.io/en/4.12/user/collision-shape-for-physics.html)).
Crest's alternative provider evaluates Gerstner waves on the CPU instead,
trading GPU cost for CPU cost.

**DOES NOT FIT - and that is the good news.** This entire subsystem exists to
work around a GPU-resident height field. This project's field is CPU-resident.
The right response is to *not build any of it*, and to resist any future
proposal to move the solver to the GPU without first pricing the readback path
that buoyancy would then need. WebGL2 has no compute shaders and its
`getBufferSubData` readback path stalls the pipeline far worse than Unity's
`AsyncGPUReadback`. Moving this solver to the GPU would make buoyancy
substantially harder, not easier.

**COST.** Not applicable.

---

# 3. Water sound

The engine constraint matters here more than in the other two sections. This
project has **no audio middleware**: `package.json` has no Wwise, FMOD, Howler
or Tone, and `src/hooks/useAudio.ts` drives raw Web Audio with a single
`GainNode`. three.js r172 does ship `PositionalAudio`, which wraps a Web Audio
`PannerNode` and exposes `setRefDistance`, `setRolloffFactor`,
`setDistanceModel`, `setMaxDistance` and `setDirectionalCone`, plus a filter
chain on `Audio`. **One `PannerNode` has exactly one position.** Every technique
below has to be read against that.

## A1. Multi-position emitter - one voice, many points

**How it works.** Register a list of world positions against a single playing
sound. The engine computes attenuation and panning from all of them at once, so
a coastline or a river reads as a wide line source rather than a point, at the
cost of one voice.

**Where.** Wwise's `SetMultiplePositions`. Per the [Audiokinetic *Game of
Thrones: Winter is Coming*
post](https://www.audiokinetic.com/en/blog/game-of-thrones-interactive-environment-sound-design/),
"Coasts and rivers have complex shapes, and the key is to set the emitting
positions properly for the terrain blocks", with emitting positions configured
for the `Sea_Loop` SFX and "only the coast trend and important islands being
considered". Ghost of Tsushima is reported to use multi-position mode with a
large number of hand-placed water emitters.

**Both of those citations are search-summary only.** Audiokinetic and ModDB both
403'd the fetcher. Do not treat the Ghost of Tsushima detail as confirmed.

**DOES NOT FIT directly.** Web Audio has no multi-position panner. Emulating it
with N `PannerNode`s costs N voices and N times the panning work, which defeats
the purpose. The salvageable idea is A2.

**COST.** Not applicable as stated.

## A2. Virtual emitter at the nearest, or energy-weighted, wet cell

**How it works.** Each frame, scan the water grid near the listener. Move one
positional emitter to the loudest place - either the nearest wet cell, or the
centroid of cells weighted by how much noise they should make. Set the emitter's
gain from the total weight in the neighborhood. One emitter tracks the water
instead of the water being decorated with emitters.

**Where.** This is the technique a gamedev.net thread on ocean sound placement
describes: a grid of 5 x 5 sample points around the camera spread over 512 x 512
m to determine water proximity, with the observation that sampling "how much of
it was under water ... might give a better idea of how loud the water should be
at that point than a distance check". **Search-summary only; the thread 403'd.**
It is also the degenerate one-position case of A1, which is well attested.

**FITS BEST, and it is the cheapest sound in this document.** The weight per
cell is the same expression as the foam source term. Reuse it directly:

```
w = d_wet * (a * shoreline_term + b * froude_term + c * waterfall_term)
```

Scan a window around the listener - a 64 x 64 window is 4,096 cells, and it need
not run every frame. Accumulate `sum(w)`, `sum(w * x)`, `sum(w * z)`. Place the
emitter at the weighted centroid; set gain from `sum(w)`. That is the whole
system. **This gets positional water audio out of the foam data with no new
simulation, no spline authoring, and one voice.**

**COST.** One pass over a windowed subset of cells, at maybe 4 Hz rather than
60. Sub-millisecond. Complicates: a single centroid between two separate streams
lands in the dry gap between them. Fix by clustering into two or three emitters,
or by clamping the emitter to the highest-weight cell rather than the mean.

## A3. Spline-following single emitter

**How it works.** Author a spline down the middle of the river. Each frame find
the closest point on the spline to the listener and move one emitter there. The
river sounds like a continuous line without N emitters.

**Where.** The standard practice, per the [Game Audio Learning Portal on
ambiences](https://www.gameaudiolearning.com/knowledgebase/how-to-make-ambiences-for-games):
"draw a spline through the middle of the river and attach a single emitter to
it", which is "great for saving time, memory and processing, as we only have to
use a single asset as opposed to lots of emitters". Audiokinetic published a
spline emitter implementation for UE4 with Wwise (I could not read the page - it
403'd). Commercial packages exist: the Fab *Procedural River Sound* Blueprint
spawns "a River Sound Audio Component that follows the character along the setup
spline" and blends five water types - small stream, big stream, small river, big
river, waterfall.

**DOES NOT FIT WELL.** It requires an authored spline. This project's water is
procedural and time-varying; the wet region moves as the solver runs, so there is
no stable centerline to author. A2 is the same idea with the spline replaced by
the live wet mask, and it costs less to build.

**COST.** Closest-point-on-spline per frame is cheap if seeded from last frame's
parameter. The real cost is authoring and maintaining splines that the simulation
can invalidate.

## A4. Parameter-driven loop blending, and distance layering

**How it works.** Two separate mechanisms that combine.

Blend by state: expose a continuous parameter - flow speed, depth, turbulence -
and cross-fade loops against it. Wwise calls these RTPCs; FMOD calls them
parameters. Still pond, riffle, rapid, fall are four beds on one axis.

Blend by distance: author each water feature as a near layer and a far layer.
"For a waterfall, you might have separate loops for different distances: a
detailed, splashy texture up close, and a softer low rumble heard from far",
and close falls have "brighter spray and sharper transients" while distant ones
become "low-mid rumble with softer attacks". The Game Audio Learning Portal adds
a spatialization rule: "gradually reduce the intensity of any spatial effects as
the player gets closer to the emitter, until you are left with a '2D' stereo
sound with no spatial information when the player is right next to it."

**Where.** [Game Audio Learning Portal - How To Make Ambiences For
Games](https://www.gameaudiolearning.com/knowledgebase/how-to-make-ambiences-for-games).
The parameter mechanism is core Wwise/FMOD and is what every river blueprint
above is built on.

**FITS, and the parameter is free.** The solver already produces exactly the
right axis. In hydraulic terms it is the Froude number from F3 - subcritical
`Fr << 1` is a pond, `Fr` near 1 is a riffle, `Fr > 1` is a chute, and a jump is
a fall. **This is the answer to "how is a waterfall made to sound different from
a still pond": it is not a different system, it is a different value of the same
number the foam already uses.** Depth `d` is a good second axis - deep and slow
is a hushed pool, shallow and slow is a trickle.

Web Audio has no crossfade graph, so this is hand-built: N `AudioBufferSourceNode`
loops, each into its own `GainNode`, each gain driven from the parameter with
`setTargetAtTime`. Distance layering is the same pattern with distance as the
axis, or is partly free via `PositionalAudio.setDistanceModel` plus a
`BiquadFilterNode` lowpass whose cutoff falls with distance.

**COST.** N simultaneously decoded and playing loops per emitter, all of them
audible-or-not, so N voices whether or not they are heard. Keep N at three or
four. Gain ramps must use `setTargetAtTime` or equivalent; stepping `gain.value`
per frame clicks. Complicates: the parameter must be smoothed. The raw Froude
number of the cell under the listener is noisy, and unsmoothed it will chatter
the blend - the audio version of `docs/water-hall-of-shame.md` entry 4.

## A5. Randomized one-shots seeded from turbulent cells

**How it works.** Keep the beds smooth, and layer discrete events on top -
a plop, a gulp, a slap. Trigger them at random intervals from positions sampled
out of the high-weight cells, so the detail is not baked into the loop and never
repeats identically.

**Where.** Standard ambience practice: detail sounds are "usually edited out of
ambient loops and recorded separately ... Adding these sounds as independent
audio events allows us to randomise their timing and avoid creating obvious
repetition" ([Game Audio Learning
Portal](https://www.gameaudiolearning.com/knowledgebase/how-to-make-ambiences-for-games)).

**FITS.** The sampling distribution is the A2 weight field, already computed.
Pick a cell with probability proportional to `w`, place a one-shot there, done.

**COST.** One transient voice per event. Complicates: needs a rate limiter and a
minimum spacing, or a violent frame fires fifty one-shots at once.

## A6. Procedural synthesis from bubble resonance (DOES NOT FIT - yet)

**How it works.** Water noise is mostly resonating bubbles. Detect bubble
creation from the fluid state, give each bubble a Minnaert resonance
(`f ≈ 3.26 / r` Hz with `r` in meters), and synthesize an exponentially decaying
sinusoid per bubble. Sum them. No recorded loops at all.

**Where.** Moss, Yeh, Hong, Lin and Manocha, [Sounding Liquids: Automatic Sound
Synthesis from Fluid Simulation, ACM TOG
2010](http://gamma.cs.unc.edu/SoundingLiquids/). Directly relevant: they
demonstrate it "using a real-time shallow-water fluid simulator as well as a
hybrid grid-SPH simulator", which is the same class of solver as this one. Their
benchmarks ran up to 1,530 bubbles per frame for pouring and up to 15,000 for
dam-break and object-drop scenes.

**DOES NOT FIT at the target scale.** 1,530 concurrent decaying oscillators is
not a Web Audio graph; it is a DSP kernel. Web Audio would need an
`AudioWorkletProcessor` writing samples by hand, and 15,000 voices is out of
reach in a browser sharing a thread with a 3D game. The *idea* is sound and the
paper is the right citation for "sound from a shallow-water solver", but the
implementation is a research project, not a feature.

**A cheap borrow that does fit:** use the bubble-count estimate as a modulator
rather than a synthesizer. Bubble entrainment scales with turbulent energy, which
is the same Froude/velocity-gradient term already computed. Drive a filter
cutoff and a fizz-layer gain from it. That is one number per frame, not 1,530
oscillators.

**COST.** As published, an AudioWorklet plus a per-bubble oscillator bank. Do not
attempt it.

---

# Ranked recommendations

## Foam

1. **F1 persistent foam field with decay** - the substrate. Everything else
   writes into it. Without it, foam pops.
2. **F2 wet-dry shallow band + F3 Froude term** - the two source terms. Both are
   free from `d` and the discharge. Together they separate pond from rapid from
   shoreline with about six lines of solver code.
3. **F4 advection by the flow field** - what makes it read as a river rather than
   a stained map. Add once 1 and 2 look right.
4. **F5 flow map into three.js `Water2`** - the shader is already in
   `node_modules`. Feed it discharge-derived vectors.
5. **F6 depth-buffer intersection foam** - add later, for characters and props.
   It is a separate, screen-space concern.
6. **F7 waterfall criterion** - take the slope test only, for particle spawn
   points at falls. Skip the breaking-wave test.
7. **F8 Jacobian foam** - do not build. There is no displacement map.

**Most likely failure: threshold flicker at the wet-dry edge.** This project has
already shipped this bug once, in the ripple layer, and it is written up as entry
4 of `docs/water-hall-of-shame.md`. The foam source terms are all thresholds on
`d`, and `d` is noisiest exactly where the foam is brightest. `smoothstep` every
one of them across a band, and put the F1 decay buffer between the source terms
and the screen so no single frame's noise is visible.

## Buoyancy

1. **B2 multi-point pontoon probes**, four per body, over a bilinear sample of
   `b + d`. This is the whole feature for almost everything that floats.
2. **B6 horizontal drag toward `u`** - one extra sample, and it is what makes a
   floating object look like it is in a river instead of on a pond.
3. **B4 is already true** - the grid *is* Kerner's cached water patch. State this
   in the design so nobody builds a caching layer over a cache.
4. **B3 submerged-triangle integration** - only if a boat the player rides
   exists, and only for that one hull.
5. **B5 two-way coupling** - last, and behind a flag. It is the only item that
   can destabilize the solver.
6. **B7 GPU readback** - do not build, and treat it as an argument against
   moving the solver to the GPU.

**Most likely failure: probe oscillation.** A stiff buoyancy spring plus a
variable browser frame time is an unstable numerical loop, and it shows as a raft
that vibrates or slowly launches itself. Epic ships two distinct damping
coefficients for this reason. Clamp the submerged depth used in the force,
integrate buoyancy at a fixed sub-step rather than at render `dt`, and damp
before tuning stiffness.

## Sound

1. **A2 virtual emitter at the energy-weighted wet centroid**, with the weight
   reusing the foam source terms verbatim. One voice, one windowed grid pass, no
   authoring, and it moves with the water because it is computed from the water.
2. **A4 parameter-driven blending on the Froude number**, three or four loops,
   with a smoothed parameter and `setTargetAtTime` ramps. This is what makes a
   fall sound unlike a pond, and it needs no new data.
3. **A4 distance layering** - near/far pair per emitter, plus a distance-driven
   lowpass. Cheap, and it does most of the work of "sounds far away".
4. **A5 randomized one-shots** sampled from the same weight field, rate-limited.
5. **A1 multi-position** - not available in Web Audio; A2 is the substitute.
6. **A3 splines** - wrong shape for procedural, time-varying water.
7. **A6 bubble synthesis** - take only the modulator idea, not the synthesizer.

**Most likely failure: the emitter jumping.** A weighted centroid over a region
with two separate water bodies sits in the dry gap between them, and when the
weights shift the emitter teleports, which is audible as a pan snap and a
Doppler chirp. Guard it three ways: cluster into at most two or three emitters
rather than one, clamp the emitter's per-frame movement speed, and cross-fade
gain rather than moving a playing source across a large distance.

---

## Sources

- Ang, Catling, Cifariello Ciardi, Kozin. [The Technical Art of Sea of Thieves](https://history.siggraph.org/wp-content/uploads/2022/09/2018-Talks-Ang_The-Technical-Art-of-Sea-of-Thieves.pdf). SIGGRAPH 2018 Talks.
- Chentanez, Müller. [Real-time Simulation of Large Bodies of Water with Small Scale Details](https://matthias-research.github.io/pages/publications/hfFluid.pdf). SCA 2010.
- Mei, Decaudin, Hu. [Fast Hydraulic Erosion Simulation and Visualization on GPU](http://www-evasion.imag.fr/Publications/2007/MDH07/FastErosion_PG07.pdf). PG 2007.
- Vlachos. [Water Flow in Portal 2](https://cdn.akamai.steamstatic.com/apps/valve/2010/siggraph2010_vlachos_waterflow.pdf). SIGGRAPH 2010.
- Kerner. [Water interaction model for boats in video games](https://www.gamedeveloper.com/programming/water-interaction-model-for-boats-in-video-games) and [part 2](https://www.gamedeveloper.com/programming/water-interaction-model-for-boats-in-video-games-part-2). Game Developer, 2015-2016.
- Epic Games. [Water Buoyancy Component in Unreal Engine](https://dev.epicgames.com/documentation/en-us/unreal-engine/water-buoyancy-component-in-unreal-engine).
- Wave Harmonic. [Crest Ocean System - Ocean Simulation](https://crest.readthedocs.io/en/4.12/user/ocean-simulation.html) and [Collision Shape for Physics](https://crest.readthedocs.io/en/4.12/user/collision-shape-for-physics.html).
- Lettier. [3D Game Shaders For Beginners - Foam](https://lettier.github.io/3d-game-shaders-for-beginners/foam.html).
- Tardif. [Water Walkthrough](https://alextardif.com/Water.html).
- Moss, Yeh, Hong, Lin, Manocha. [Sounding Liquids: Automatic Sound Synthesis from Fluid Simulation](http://gamma.cs.unc.edu/SoundingLiquids/). ACM TOG 2010.
- Game Audio Learning Portal. [How To Make Ambiences For Games](https://www.gameaudiolearning.com/knowledgebase/how-to-make-ambiences-for-games).
- Audiokinetic. [Designing the Interactive Ambient Sound System for Game of Thrones: Winter is Coming](https://www.audiokinetic.com/en/blog/game-of-thrones-interactive-environment-sound-design/) - **not read, 403**.
- Audiokinetic. [A Spline Based Audio Emitter / Volumetric Audio Emitter For Custom Shapes](https://www.audiokinetic.com/en/volumetric_audio_emitter_for_custom_shapes_in_ue4/) - **not read, 403**.
- ModDB. [Environmental Audio](https://www.moddb.com/features/environmental-audio) - **not read, 403**.
- GameDev.net. [How to place ocean sound?](https://gamedev.net/forums/topic/711862-how-to-place-ocean-sound/) - **not read, 403**.
- NVIDIA/Gaijin. [Ocean simulation and rendering in War Thunder](https://developer.download.nvidia.com/assets/gameworks/downloads/regular/events/cgdc15/CGDC2015_ocean_simulation_en.pdf) - **image-only PDF, no text extractable, nothing cited from it**.
- 80.lv. [Breakdown: Approaches to Realtime Foam Rendering](https://80.lv/articles/breakdown-back-approaches-to-realtime-foam-rendering) - read; it covers material-authoring foam (soap-suds texturing), not simulation-driven foam. Nothing here applies.
- Unity. [Foam in the HDRP water system](https://docs.unity3d.com/Packages/com.unity.render-pipelines.high-definition@14.0/manual/WaterSystem-foam.html) - read; only `Simulation Foam Amount` and `Wind Speed Dimmer` are documented in usable detail. Thin.
- In-repo: `node_modules/three/examples/jsm/objects/Water2.js` (r172), `node_modules/three/src/audio/PositionalAudio.js`, `src/hooks/useAudio.ts`, `src/components/BattleMap/terrain/VolumeArenaWater.tsx`, `docs/water-hall-of-shame.md`.
