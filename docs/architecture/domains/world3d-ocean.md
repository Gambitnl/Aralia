# World3D ocean: the FFT sea surface

Verified: 2026-09-27 against `src/systems/world3d/ocean/` (beach round 2: the crop found wholly under the backwash film at every instant from 36 to 48 s, the swash foam tile drawn with the foam piece's coverage-true threshold and a gentle flow map, the film's caustic web and ripples, the veil and milk weaker, stranded foam wetting the sand, a smooth grain through the hook's optional `grain`, debris in real proportion with contact shadows, the five judged scenes 0 pixels, the cost re-measured; beach round 1: a new piece, the swash on a sand cay in the lagoon (2D shallow water with momentum forced by the FFT sea's own height at the grid's edge), the sheet soaking into the registry's sand with an exact ledger, the wet sand drying from the top down, shells, sticks and weed pushed by the sheet, the seabed's optional island and shore hook with LAGOON_SEABED's map bit for bit unchanged, the five judged scenes 0 pixels against the seabed files before the piece; wake round 17: the foam's edge, grain and opacity profile measured against the references, a graded margin of translucent lace under the threshold, a wider cover ramp, fine bubble holes from the second field at 1 m, clots, the foam thinning toward its holes, milky water under and round the sheet, the arms as soft translucent lines, a faster fade; the halo, the world blur and the bubble dots built and off (two of them cost minutes of shader compile), `r16`, `r15`, `r14` and `r11` 0 pixels against the round-16 files on one surface, the no-boat scenes 0 pixels, the cost re-measured; distance round 7: the far read's span along the view capped at 4 short axes at grazing footprints, the short cascades' far slope times 2.0 and the long ones' times 0.35 on the same share, the far mean ray's elevation capped at 30 degrees, the calm's opening at 1.7, every change behind a tune whose off value draws round 6's eight open-sea poses, the five judged scenes and the caustics view to 0 pixels, the sweep, the cost re-measured; wake round 16: the quarter pose re-matched as `quarter-m` with the white band's width, the trail drawn as one connected sheet down its core with a clear edge, holes of mixed size, a cellular lace that opens with age, the arms as lines on the wake's own crests, the calm lane that damps the wake's own waves under the sheet, a soft edge from a coarser mip with its orbit proof, the wake edge and the flakes measured against the references, `r15`, `r14`, `r13` and `r11` 0 pixels against the round-15 files on one surface, the no-boat scenes 0 pixels, the cost re-measured; distance round 6: the clouds fade into the haze by their structure (a new haze copy, the clouds blurred along the azimuth, read by the ray's elevation), the far texture's energy read coarser so it draws long horizontal streaks, the calm lighter and the far haze at 3.5 km so the streaks reach the line, all three far terms keyed on how drawn out the footprint is, the lobe clouds at 0.4, every change behind a tune whose off value draws round 5's eight open-sea poses, the five judged scenes and the caustics view to 0 pixels, the sweep, the cost re-measured; wake round 15: the trail graded by its age, a young bright core in a milky film over a whiter glow, the lace opening into a network of strands, then streaks, then gone, the arms as lines, the hairlines gone, the age thirds and the glow measured against the references, the quarter pose measured against the reference's and a re-matched pose proposed, `r14`, `r13` and `r11` 0 pixels against the round-14 files on one surface, the no-boat scenes 0 pixels, the cost re-measured; distance round 5: the thin bright haze (a pale near-neutral glow, a cool foot, no plain dim) fitted to the reference's low-sky profile, the far water reflecting the clouds' mean over its lobe of rays (the sky's new lobe copy), the calm's fresnel opening at 0.7, the near low rays ending at 150 m, a navy mid-field body, the far haze at 2.5 km, every change behind a tune whose off value draws round 4's eight open-sea poses and the five judged scenes to 0 pixels (the wake view above its trail; the trail's own files changed during the round), the height, heading and pitch sweep, the cost re-measured; wake round 14: the trail, a ranked gradient-noise field of many octaves in place of the lace, the net and the layer, sheared by the jet and the lanes, eaten by the wake's own amount with a dense race, filaments at the thin edges, graded holes, opaque foam lit at 0.66, spreading arms, the old trail dissolving, the hole statistics of both judged crops measured against the references', `r11` and `r13` 0 pixels against the round-13 files on today's surface, the no-boat scenes 0 pixels, the cost re-measured; distance round 4: the far texture calmed where the long footprint passes 80 to 300 m, the far dashes soft, the far water toward the haze's tone, the far body less violet, the sky band with a flat foot and a cooler line, every change behind a tune whose off value draws round 3's judged poses and the five judged scenes to 0 pixels, the height, heading and pitch sweep, the cost re-measured; distance round 3: the far texture read from the field, the normal mip's w as each level's mean squared slope with two turned reads against the patch's repeat, in place of the round-2 dashes, grain and far tap jitter; the far haze closing over the last 30 rows (3 km, power 1.3) and thinned with the eye's height; the sky band darkening into the line; every change behind a tune whose off values draw the five judged scenes and the judged poses to 0 pixels over 8/255; a sweep over height, heading and pitch; the cost re-measured; wake round 13: the layer opaque, lit by its slope toward the sun with a mean of 1, the wake's own slope and the raft's grain, dark popped bubbles, the bubble glow kept under the core, round 11's arms back, `r11` and `r12` against their judged frames 0 pixels in the judged crops, the no-boat scenes 0 pixels, the cost re-measured; wake round 12: the trail's core a layer of foam (`wakeMassImage`: thickness, veins and relief in one texture; a density across and along the trail, boils, a few popped bubbles, a ragged crest line, its own relief and band-profile light, soft streaks in the alpha), the lace kept at the sides and the thinner arms, `r11` against round 11's judged frames 0 pixels, the no-boat scenes 0 pixels, the cost re-measured; buoyancy round 16: the roll drag at about 11% of critical and the mooring a third as stiff for a lean that reaches 19 degrees across the view at the crest, the splash drops only where the water meets the flare hard, the collar and the white on the steel from a stricter event, the darker water and the float's shadow, every change behind a switch whose off value draws strip e15a to the pixel, the cost re-measured; the wake reader's optional `opacity` field (2026-09-26); buoyancy round 15: the judged window at 52.0 s, the navigation buoy with 176 kg carried high for a 3.1 s roll that follows the wave face, the splash drops keeping their own light, the collar in streaks along the flow, the wet band and its drain, the darker water at the hull, every change behind a switch whose off value draws strip d14w to the pixel, the cost re-measured; wake round 11: the reader's `opacity` share for the young core, the solid band as a dense lace, two-octave voids ringed with lace that clear the whole glow, the swell keys cut, round 9's edge lines back, `r10` against round 10's judged frames 0 pixels, the cost re-measured; buoyancy round 14: the collar, the white on the steel, the lace and the trail deposit driven by a per-angle event state with a dimmer foam white, a breaking crest's push through the step's new external force, the judged window measured as one no crest reaches and a strike window proposed, every change behind a switch whose off value draws strip b13f to the pixel, the cost re-measured; wake round 10: the core band's young foam one near-solid mass torn by voids of a low-frequency field, cut by round 8's boils, the stern wave's lip torn by the same field, the crest pile gated to the band, the sides and the crests' thin foam cut, `r9` against round 9's judged frames 0 pixels, the cost re-measured; buoyancy round 13: the wash as a broken collar round the waterline on every side and broken streaks off the flanks, the foam field stopped by the hull, the roll damping at 0.6 of round 12's after the mooring was found to hold the lean, a pinned run's sea center set from the camera, every change behind a switch whose off value draws strip s13j to the pixel, the cost re-measured; wake round 9: the core band's clumped raft for 4 s more with its own fade, the thin sides, firmer edge lines, the clump shade, round 5's on-screen stretch key back at gentler values and over the net too with its orbit proof, `r8` against round 8's judged frames 0 pixels, the cost re-measured; underwater round 5: the level view's light split into its four terms, the clear open-sea water, no sun in the blurred window, the fine tile toward the sun, the share gain at 0.65, a third snow population, the near-flake fade and a 3.5 mm largest flake, every new path behind a control whose off value reproduces round 4 bit for bit, the cost re-measured on a quiet GPU; wake round 8: the core's dark boils, clumps and bubble grain, the lane's own turbulent lumps through the back-face cap, the glow keyed on the shaped amount, the fine net drawn out 3 times, the last view-keyed look path off, `r7` against round 7's judged frames 0 pixels, the cost re-measured on a quiet GPU; underwater round 4: the level-view fan found mirrored and a pose proposed that matches the reference's, the underside's curve drop that took out the row of dots, the march's 0.4 m mid by the step's foot with an interleaved-noise start, the snow's pixel floor and gain, `benchPiece` through the viewer's paused bench, every new path behind a control whose off value reproduces round 3 bit for bit, the cost re-measured; wake round 7: the core band down the track that ages 1.2 s later and keeps its white on the back slope and in the troughs, the net's soft wall ramp and coarser tile, the aerated milky glow, the haze gated by the amount, `r6` against round 6's judged frames 0 pixels, the cost re-measured; wake round 6: the trail's one structure in world space, the net lace, the trail's edge and its two lines, the stern wave's back slope, the edge haze, the glints dead across the lane through the reader's `glint`, every path behind a control whose off value (`r5`) draws round 5b bit for bit, the cost re-measured; the sea's dense center follows the camera and the buoy's patch and probe follow it; the near and far looks measure from the eye in 3D; the wake reader's optional `glint` share; the glint fix: each pixel reads the 3x3 spark cells with three gates, the near lit share by the cell's area on screen; the underwater piece mounted on every page; underwater round 3: the level pose measured against the reference and re-matched (1.5 m down, 8 degrees up, the sun 80 degrees off the view), the ceiling's edge cap and its blurred mirror on the long waves' facet, the shafts integrated across each step of a coherent march on the fixed range, the wide mid lens tile, the sheet level at 1.0, the focus ramp at 0.4 m, every new path behind a control whose off value reproduces round 2 bit for bit, the cost re-measured; wake round 5b: the structure paths world-space at every view after the lead's ruling, the on-screen key kept for the lace's stretch alone with its mix re-equalized and an orbit proof, the chase view retuned to hold round 2's traits; wake round 5: the mat torn into clumps at its edges and tail, pinholes, a dark rim, foam piled on the wake's crests, a thinning tail, the flat-plane side ratio; round 4's film and wisps off; the cost re-measured; wake round 4: round 2's read restored behind look controls and proved against the round-2 frame, round 3's changes kept as named values, the trail's age read from the breaking buffer as a world-space key for the quarter view's fade, wisps and shade, the back-face cap with a knee, the cost re-measured; foam round 9: the hair fill with a floor per fiber so the filament count follows the coverage, the age clock A in its own buffer, the light and coverage graded by the foam's own age, old foam torn into windrows and given a halo, the fresh rafts compact, the round-8 fine and fringe tables kept behind their controls; buoyancy round 12: the wash as foam in the water that leaves the hull, the field at 24 m and 6 s with the Stokes drift, the wake and pile deposits, the ring's vertices on the GPU at the inverted grid point of the patch's formula, out to 5.3 R with 520 sampler slots gone, the impact gates and the cling at the far pose's scale, the splash burst, the cost re-measured; buoyancy round 11: the ring's mark gated to the camera side, in patches, sized by the run-up; the `setReflector` hook designed with the buoy's reader, and landed in `oceanSurface.ts` by the lead with 0 pixels changed on the five judged scenes; heave damping to half of critical on three strips of the pinned window; buoyancy round 10: the heave resonance against the chop measured by a linear RAO map and the CPU sea, heave damping at critical, the cost re-measured; foam round 6: round 4 restored bit for bit, the fold-laid field G with its own fade, the head on the lay ramp, the curl grain by scale, the round-5 controls off; foam rounds 7 and 8: the view from above carried by G with the crest crackle and the wisps, the round-7 pitch key removed (GG-311) so the look holds at every angle, G on a wide ramp, the fine regime's wisp-led texture, the crest lines and small breaks of every fold, fringes dissolving into bubbles, the crest segment and the curve built and off; buoyancy round 9: 750 kg carried high for a 4.8 s roll period, the waterline line back at rest, the design waterline 0.60 m up the flare with the probes re-laid against the lathe's buoyancy curve, no rim line and a bounded deck image over an awash deck, the cost re-measured; buoyancy round 8: the `choppy` sea re-measured against the reference, a 16 m chop on a doubled 47 m swell, the buoy's phase against wave period as the reason, the counted window chosen by lean phase, the wash thresholds on the new sea; buoyancy round 7: the near hull's fill light at the sea's grazing brightness and the paint's sky sheen, the resting waterline rim nearly off and the wash drawn from a threshold on the per-angle foam state, the plunge weighted to the up-wave face, the impact drive on the run-up heights the deposit uses, the foam field's downwind drift, the hull under the water as a band that fades with depth, the cost re-measured; foam round 5: the deposit at the breaker's strength squared, each breaker's own life, the spread at 0.15, the read's body and core kept apart, age by density, the tear, the crumbled core rim, the fold's dusting, wider and shorter fibers, the net-first young lace; buoyancy round 6: the near hull as a sea floor the surface sees through its water via the routed `setSeabed` hook, the ring's rim and cling cut down, pitch damping back to 30% on a measured lag, the cost re-measured; buoyancy round 5: the young `choppy` sea, the ring and its reads on the waterline center, the water standing up against the hull, the waterline rim, the lighter reflection and shadow, pitch damping 15%, the piece's measured cost; performance pass: one compute call, filtered atlases for the normal mips and the render-side plane reads, the FFT in workgroup memory, deck noise only under overcast, the sky mesh drawn last, lit-only sparks; see Frame cost). Earlier, 2026-09-24 (waves round 4: waterpro heading and chop spreading, Elfouhaily taper, grazing-view attribution; buoyancy round 4: pressure at depth, added mass, band kinematics, deeper light-buoy draft, shared sampler (GG-273), run-up, breaking crests and an advected foam grid, a carried fine patch, contact trial; shading round 4 takeover: baked cumulus sky, glitter points, far slope restore, GG-274 contact foam, GG-276 visible share; spray round 3: strands rooted on drawn foam, bowed ribbons, then plume body (lift, falloff, soft bottom, world streaks, dimmer head); spray round 2 and rain round 4 sections added by the lead; distance round: blue sky rising from the horizon with a thin blue-white glow, far reflection bends and spread, the far residual dashes, the far haze, the 25 km skirt, storm unchanged; distance round 2: the horizon haze band, one-row far dashes, far grain, gust patches, the finer far read, the bends' far share, Earth curvature); wake round 1: the Kelvin wake as a closed-form forced field, touches, white water, the hull; wake round 2: the foam lace and its read; wake round 3: back-face cap, foam volume, core grain; the lead landed the `setWake` hook in `oceanSurface.ts`; underwater round 1: the underside, Snell's window, the path light and the camera, the shafts buffer, marine snow, the waterline; underwater round 2: caustic-sheet shafts, the water by its chlorophyll, the closed-form window edge and its glow, the storm's surface bubble layer, denser snow, the exposure refit; foam round 1: the persistent foam field, its store, breaker, residual and baked lace, drawn through `setFoam`; foam round 4: the breakers' own headings, the spread, the crackle lace and the read's three kinds of foam (head, trail, old), the grazing veil; foam cost split: the A/B rerun alone, the read named as the cost, the step's GPU and CPU share, the timestamp and fence probe traps).

## What it is

An unbounded, statistically correct open-sea surface for maritime travel: a
JONSWAP + TMA wave spectrum realized by a GPU FFT on three.js WebGPU + TSL
(`three/webgpu`, `three/tsl`). It is a wave FIELD, not a fluid solver; it
imports nothing from the volumetric water in `src/systems/worldforge/terrain/`.
WebGPU is required; there is no WebGL path (`oceanCapability.ts`).

The surface is a pure function of (seed, time). `OceanField.step(renderer, t)`
takes an absolute time and holds no accumulated state, so a replay reproduces
the sea and a ship's heave is deterministic.

## Files

| File | Owns |
|---|---|
| `oceanConfig.ts` | `CascadeParams`, the unit rule (public feet, internal meters), `DEFAULT_CASCADES` |
| `oceanSeaStates.ts` | Named sea states picked by `?sea=<name>`: `default`, `storm`, `waterpro`, `waterpro-swell` (alias of `waterpro` since round 3 put the swell in), `choppy`, plus `waterpro-r3` (round 3 as judged, kept one round for A/B) |
| `oceanSpectrum.ts` | JONSWAP (omega^-5 or omega^-4 tail, optional Elfouhaily taper), TMA, dispersion, directional spreading (Mitsuyasu or Hasselmann cosine-2s, Donelan-Banner sech^2, or Ewans bimodal), the seeded initial spectrum h0(k) built on the CPU |
| `oceanCompute.ts` | The GPU kernels: `pack` (evolve to time t, 4 complex fields per cascade), `hAxis` and `vAxis` (the 8 radix-2 Stockham stages of one axis in workgroup memory, one dispatch each), `unpack` (displacement, normal, folding Jacobian), `planeAtlas` (the bordered `dispTex` and `normTex` atlases) |
| `oceanFieldReference.ts`, `oceanFftReference.ts` | The same pipeline on the CPU, used only by tests and by the GPU cross-check |
| `oceanSurface.ts` | The warped 512x512 mesh to 9 km with its outer ring pushed to 25 km (`OCEAN_SKIRT_M`) and dropped with the Earth's curvature about the camera (`EARTH_CURVE`), per-cascade distance and footprint LOD, water shading (sky reflection with a far-field bend and spread, sea-self reflection, glitter points on a Beckmann lobe, body color, fold and contact foam, the far residual, the far haze); `setContact` for floating bodies; a twelve-uniform tuning channel |
| `oceanReflector.ts` | The contract of the routed `setReflector` hook on the surface: a reader gets the mirrored view ray (`ReflectorShadeInput`) and returns a radiance and a coverage (`ReflectorShadeOutput`) that the surface mixes into the reflected radiance before the Fresnel weight. With no reader the surface is unchanged to the pixel (0 pixels on the five judged scenes when it landed, 2026-09-25). First reader: the buoy (`oceanExtras/buoys.ts`) |
| `oceanSampler.ts` | The one bilinear read of a cascade plane and the per-cascade range fade, shared by the mesh and (GG-273) the buoyancy probe. With `{ filtered: true }` (the render-side readers) it reads `disp` and `norm` through the atlases: one hardware-filtered fetch |
| `oceanNormalMip.ts` | A mip chain of the normal buffer, rebuilt each frame after the FFT, copied into a bordered texture atlas, read anisotropically by the shader (one filtered fetch per level). Its w holds each level's mean squared slope (distance round 3), so a read returns the mean slope and the slope energy under it; `sampleTop` reads a patch's mean |
| `oceanSky.ts` | The sky the water reflects and the viewer draws: a clear-sky gradient (blue rising from the horizon, a blue-white glow low over it, a greyer haze band dimming into the line; its horizon terms on the shared `OCEAN_SKY_TUNE` uniforms), cumulus marched ONCE into a texture (`OceanSky.bake`), the storm deck, the sun; `oceanSkyRadiance(..., upSpread)` averages the gradient over a band of elevations for a rough reflector; the lobe copy (distance round 5: the clouds averaged over a far pixel's tall, thin lobe of rays, `oceanSkyLobeClouds`, `oceanSkyCloudOver`); the haze copy (distance round 6: the clouds blurred along the azimuth, which every cloud read fades toward with falling elevation) |
| `oceanField.ts` | The one object a caller builds: `createOceanField({ seed, n, cascades, sunDir })` |
| `oceanBuoyancy.ts` | A floating rigid body on the sea, CPU only: per-probe Froude-Krylov pressure, added mass as a 6 x 6 mass matrix, drag and form drag, mooring, fixed-step integration; the water at depth (`bandDepthDecay`, `createBandKinematics`, `probeWaterAtDepth`); `probeHydrostatics`; `invertDisplacement` for the choppy surface |
| `oceanBuoyancyProbe.ts` | The surface height above a set of world points, read from the GPU `disp` buffers through the surface's own sampler (`createOceanSampler`, the same sampling and LOD as the mesh), plus the inversion, with a readback; kinematic slots also return each band's displacement at the new and the two previous grid points |
| `oceanBuoyModel.ts` | Procedural buoys (light buoy, can, sphere), each returned with the `FloatingBodySpec` that floats it |
| `oceanSpray.ts` | Sea spray on the GPU: strands rooted on the foam the surface draws, fed while their whitecap holds, drawn as camera-facing ribbons bowed by the lip updraft; the fixed-step plan that makes a pinned capture reproduce. Mounted by `oceanExtras/spray.ts` (`?extras=spray`, with `&sea=storm` for a wind that throws spray) |
| `oceanRain.ts` | Rain: instanced streaks (one draw, alpha blend toward the drop's radiance), the murk dome (Beer-Lambert to the cloud base or the sea, with rain shafts along the horizon), crowns and rings on the sea read from `disp`. Mounted by `oceanExtras/rain.ts` (`?extras=rain`, with `&sea=storm`) |
| `oceanRainMath.ts` | Every rain number and its CPU twin (streak alpha and width by distance, the blend, the field wrap, murk path and transmittance, splash timing, `rainSlopeVariance` for the surface) |
| `oceanWakeMath.ts` | The wake's model and its CPU mirror: the hull as a surface pressure, the course as straight pieces, each piece's wave integral in closed form, touches, the stern churn, the breakers and their deposit, the foam lace and its coverage table, the net lace (round 6), the look's controls, the Kelvin measurements |
| `oceanWake.ts` | The wake on the GPU (pack, 17 Stockham stages, unpack, deposit, in one compute call) and the read the surface draws it with (`lift`, `shade`), through `setWake(reader)`. Mounted by `oceanExtras/wake.ts` (`?extras=wake`) |
| `oceanWakeBoat.ts` | The hull that makes the wake: a procedural stern trawler, fitted to the sea and its own wake on the GPU each frame |
| `oceanWakeTrail.ts` | The wake's foam trail (round 14): the trail texture (`wakeTrailImage`: two ranked gradient-noise fields and a relief), and the CPU mirrors of how the read lays it along the trail (the jet's and the lanes' shear, the cover; round 16: the sheet's share `wakeTrailBandShare` and the arm lines `wakeTrailArmShare`; round 17: the graded margin `wakeTrailFringe` and the milky water's profile `wakeTrailMilkWater`) |
| `oceanUnderwater.ts` | The view from under the surface: the underside mesh on the surface's geometry, the dome, the lens tiles and the shaft buffer, marine snow, the meniscus. Mounted by `oceanExtras/underwater.ts` (`?extras=underwater`) |
| `oceanUnderwaterMath.ts` | Every underwater number and its CPU twin: Snell's window, the exact Fresnel from the water side, the refracted sun, the water's optics (clear and storm), the closed-form path light, the phase functions, the daylight that enters, the exposure and white balance, the shaft contrast, the lens tiles' spread |
| `oceanFoamMath.ts` | The persistent foam's model and its CPU mirror: every constant with its measurement, the fixed step, the breaker and the residual, the swell and wave-group gains, the clipmap, the stepping plan, the periodic lace and its CDF, the kernel as a CPU reference |
| `oceanBeachMath.ts` | The beach's physics and its CPU mirror, no three import: the sand's water numbers (the registry's `Material.Sand`, Brooks-Corey, Green-Ampt), the swash field (HLL shallow water with momentum, the absorbing sea edge, Manning friction, the skin and deep stores, foam, suspended sand, the swash mark), the FFT sea's own height at the sea edge (`IncidentWaves`), the debris, the fixed-step clock with checkpoints, the site on the cay, the GPU pack |
| `oceanBeachWorker.ts` | The beach stepped in a worker: `init`, then `advance` to a time, back with three half-float texture payloads and the debris poses |
| `oceanBeach.ts` | The beach on the GPU: the floor with the beach's hook (`LAGOON_CAY_SEABED`), the sand mesh, the swash sheet (a film, or the floor's reader where thick), the foam lace and milk, the debris meshes. Mounted by `oceanExtras/beach.ts` (`?extras=beach&sea=shallow`) |
| `oceanFoam.ts` | Persistent foam on the GPU (two toroidal clipmap levels stepped at 1/30 s, a display texture per level, the lace tile baked once) and the read the surface draws it with (`shade`, `coverageAt`), through `setFoam(reader)`; `setStamp` lays foam down from outside. Mounted by `oceanExtras/foam.ts` (`?extras=foam`, with `&sea=storm`) |

Viewer: `src/components/DesignPreview/steps/sidebyside/SideBySideOcean.tsx` at
`/Aralia/misc/design.html?step=water&ocean=1&full=1`. `window.__OCEAN__` is
the capture surface (`setTime`, `setPose`, `setDebug`, `bench`, `crossCheck`,
`hashField`). Pieces plug in through `oceanExtras/<piece>.ts` and `?extras=`;
`?extras=buoys` mounts the floating bodies.

A person can look around (`oceanFreeLook.ts`, 2026-09-25): drag to look (the scene follows the cursor), W A S D to fly along the view, E and Q up and down, Shift four times faster, the wheel a step forward or back; the speed grows with the height above the water. It moves the camera ONLY on input, so a pose that `setPose` or a preset sets stays exactly as set (0 pixels changed on the judged scenes), and every pose setter re-syncs it. `cameraPose()` on the capture surface reads the camera back (position, view direction, fov).

## Buffer layout

Per cascade, `n * n` cells (n = 256). `disp` is vec4 per cell: dispX, height,
dispZ, foldJacobian. `dispTex` and `normTex` hold the same two planes as
half-float textures for the render-side readers: one column of n + 2 texels
per cascade, the plane inside a one-texel border that holds the opposite
edge, so a hardware-bilinear fetch wraps as the buffer read does. `norm` is vec4: nx, nz, ny (unnormalized, ny is the
Jacobian), unused. The wavevector grid is centered on k = 0, which costs a
(-1)^(x+z) sign in the unpack pass. The Nyquist row and column carry no
energy so every field is exactly real.

## Conventions that are load-bearing

- **THE DENSE CENTER FOLLOWS THE CAMERA** (2026-09-25). The sea mesh is a
  warped grid, 0.24 m between vertices at its center and 15 m at 500 m,
  and the sampler fades the ripple and chop cascades with distance from
  that center (`cascadeLod`). The viewer's frame loop calls
  `surface.setCenter(camera.x, camera.z)` at the top of each frame, before
  the step and the pieces' updates. Every piece that samples the sea copies
  `surface.center` in its update: spray, underwater, wake, the wake boat,
  rain (`setSeaCenter`), and the buoy mount, which also places its fine
  patch mesh at the center and calls the probe's `setCenter`. Nothing
  called `setCenter` before, so after a free-look flight the detail stayed
  in a round patch at the world origin. A camera at x = z = 0 (most judged
  poses) keeps the center at 0; poses away from the origin (the shallow
  views, the buoy strip, the wake views) changed and were re-judged.
- **THE WAKE READER CHOOSES ITS OWN GLINT AND OPACITY** (2026-09-25 and
  2026-09-26). `OceanWakeReader.shade()` may return two optional nodes.
  `glint` is the share of the sea's specular that survives (without it,
  1 - foam): churned wake water is matte foam and a slick. `opacity` is
  the wake foam's share of the mix cap: the surface mixes all foam over the
  water at 0.85 x its alpha, so 15% of the water always shows through, and
  with `opacity` the cap is 0.85 + 0.15 x opacity, so dense young churn can
  reach solid white. Without either field the surface draws as before
  (0 pixels changed when each landed).
- **Near and far looks measure from the eye, in 3D** (2026-09-25). `dist0`
  and `distGrid` in `oceanSurface.ts` key about 20 terms (the glint fade,
  the far slope gain, the dashes, grain and sheen, the Fresnel flatten,
  the cloud reflection, the deep color, the near height, the haze). They
  were the flat distance from the mesh center, so from a camera 1.6 km up
  the water straight below counted as 0 m away and drew the near sparks.
  From the judged 18 m camera the two measures differ by 6% at 50 m; the
  judged scenes changed on 0.17% of the pixels at most. The sampler's
  `cascadeLod` stays flat: it follows the mesh spacing, which is flat.
- **Units.** Every constant in the spectrum is metric. Only `oceanUnits.ts`
  converts, using the canonical `FEET_PER_METER`.
- **The displacement sign.** Tessendorf's horizontal displacement
  `D = sum -i (k/|k|) hhat e^{ikx}` moves surface points AWAY from crests
  under this pipeline's transform convention (measured on `h = cos(kx)`:
  Jacobian 1.79 at the crest, 0.21 in the trough). Both the pack kernel and
  the CPU mirror therefore apply the choppiness NEGATED, so crests cusp and
  fold foam sits on crests. A positive `choppiness` in a cascade always means
  "the crest sharpens". The sign gate in `__tests__/oceanSpectrum.test.ts`
  holds it.
- **Choppiness flips D and every derivative of D together**, so the folding
  Jacobian's distribution does not depend on the sign; only its location
  does. Measured foam coverages survive a sign change.
- **Stage constants are compiled in, not uniforms.** Eight dispatches in one
  frame would all see the last uniform value written. Both ping-pong
  directions are built up front because TSL binds storage at build time.
- **Cascades combine by summing displacements and slopes**; the flagged
  cascades' Jacobian deficits ADD (det(I + A + B) is approximately
  jacA + jacB - 1 at these deformations, measured RMS error 0.010).

## Sea states and how a new one is justified

A sea state is a full cascade list. Each patch is prime so the summed field
repeats only at the product of the patch sizes. Each band should hold its
longest wave at least three times, or the band tiles visibly (the `default`
layout does not yet do this; see GG-271). A patch also repeats VISIBLY when
a feature it carries alone (foam is the usual one) is still drawn where two
or more patches fit across the view: on `waterpro` round 1 the chop's foam
repeated at 89 m with an autocorrelation of 0.31-0.47 at 200-300 m because
its normal, which carries the foam deficit, faded to 2000 m while its
geometry was gone by 600 m. A cascade's `normalLod` is therefore its foam
range too, and it must end before its patch fits twice across the view at
the judged pose. `periodicity.ts` beside `measure.ts` measures this. The
heading matters as much as the layout, and it must be read for the part of
the frame that is judged: see "Reading a grazing view" below. Every number
carries the
measurement behind it, made with the CPU reference on the 256 grid:
per-cascade Hs, peak wavelength, RMS slope split along and across the wind,
the Jacobian fraction under 0.7 / 0.6 / 0.5 and under 0 (self-intersection,
which must be zero), and the same on the combined surface sampled onto one
grid. The script that does this lives in the ocean gauntlet scratch
(`.agent/scratch/ocean-gauntlet/waves/measure.ts`); it is disposable, its
method is not.

Oracles used: JONSWAP peak and variance identities, Cox and Munk's
mean-square slope and its along/cross ratio (1.45 at 11.5 m/s, 1.49 at 15),
Monahan's whitecap fraction, Donelan and Banner's spreading widths.

**`choppy` is a young sea on the chop band (buoyancy round 5, 2026-09-25;
round 8 moved the chop's peak to 16 m and doubled the swell, see below).**
It is the only sea the buoy is judged on, against the reference's Choppy
clip, and both round-4 judges read "the waves are tiny next to the buoy":
the `waterpro` layout's 47 m peak is longer than the whole 10.7 m judged
crop, so the crop showed ripple. The scale was measured along image rows
with the buoy's 1.84 m deck as the ruler (`lateralScale.py` in the
buoyancy scratch): the share of the water's luminance variance at scales
over two deck widths, and the mean scale in deck widths. Reference 0.51
and 1.90; round 4 0.12 and 1.02; the sea below 0.35 and 1.77. Each value
was tried on the judged crop through a page hook (`seaCandidates.ts`,
`shootStrip.mjs TRIAL_SEA=`) before it was written into
`oceanSeaStates.ts`:

- The chop band is fetch limited: the same 15 m/s over 4,770 m
  (`CHOPPY_FETCH_M`), which the JONSWAP fetch law puts at a 10.0 m peak
  (T 2.53 s). The clip is shot beside an island cliff, where a short fetch
  is the rule. Peaks of 8, 10 and 12 m were tried; 10 took the buoy's pitch
  period from 3.3 to 4.0 s down to 2.7 to 3.0 s.
- Its variance is 3 times the fetch law's (`CHOPPY_CURRENT_GAIN`, written
  as the band's `energyScale`): Hs 0.82 m, steepness 0.082. At the law's own
  0.47 m the band did not show at the crop's scale. The reason is a wave
  against a current: a 2.53 s wave (c0 3.95 m/s) into a 0.7 m/s opposing
  stream gains A^2 / A0^2 = c0^2 / (c (c + 2U)) = 3.1 (Longuet-Higgins and
  Stewart 1961), a common tidal stream off a headland. `oceanConfig.ts`
  still documents `energyScale` as a fraction (a swell's decay), and this
  is the first cascade that uses it as a gain; see Open.
- The ripple keeps 0.4 of its energy (`CHOPPY_RIPPLE_ENERGY`, Hs 0.24 to
  0.15 m): the same stream blocks the waves whose group speed it exceeds
  (c0 under 4|U| = 2.8 m/s, shorter than 5 m), so only the local wind's own
  ripple is left. On the crop 0.4 took the share under half a deck width
  from 0.31 to 0.25 (reference 0.08, part of it the video's blur) and the
  glitter from a white carpet to broken patches; 0.2 flattened the near
  water to paint.
- The sea band (30 m and up, the 47 m peak) and the choppiness [1.0, 1.5,
  1.2] are unchanged: the swell round the island and the 6 s heave under
  the chop.

Measured on the CPU (`measureSea.ts` in the buoyancy scratch, candidate
q10b3r4c15o1), the combined surface: Jacobian minimum 0.25, under 0.7 on
8.69%, under 0.6 on 3.14%, under 0.5 on 0.81%, no cell folds through; total
Hs 1.91 m (2.15 before). The chop band alone: minimum 0.40, under 0.6 on
1.70%. `cmpSea.ts` beside it checks the written state against the trial:
the fetch rounded 4769.29 to 4770 m, and the sea band's absent
`energyScale` is the trial's 1.

**Round 8 (2026-09-25) made it one step rougher**, on two measurements
written in its comment: the buoy's own phase (a 3.3 s pitch period that no
ballast moves, so only waves of 5 s and longer tilt it in phase; the lean
must come from the 47 m swell and the whitecaps from the chop) and the
reference near its buoy (crest lines 15 to 25 m apart, faces 1 to 1.5 m,
on a longer face of about 2 m). The chop's fetch is 9,720 m (a 16.0 m
peak, T 3.2 s, Hs 1.36 m, steepness 0.085) at choppiness 1.3 (1.5 folded
the combined surface to a 0.09 minimum at this energy), and the sea band
carries twice its open-sea variance (`CHOPPY_SWELL_GAIN`, Hs 2.43 m):
total Hs 2.79 m, combined Jacobian minimum 0.15, under 0.7 on 10.83%,
under 0.6 on 4.57%, under 0.5 on 1.47%, no fold (candidate r8f of
r8a to r8g). Monahan's whitecap fraction at 15 m/s is 4.0%, so the
whitecaps are fully out, as the Choppy stills show them. See "Floating
bodies" for what the buoy does on it.

## Spreading models

`spreading: 'mitsuyasu'` (absent) is cosine-2s with the Mitsuyasu power,
which narrows with wave age and clamps to near isotropic in the short
waves. `spreading: 'donelan'` is sech^2 with Donelan (1985) widths and
Banner's (1990) short-wave extension: 22 degrees half-width at the peak, 41
at 1.6 fp, 73 at 3 fp. On the `waterpro` layout it reproduces Cox-Munk's
along/cross slope ratio (1.38 against 1.49) where Mitsuyasu gives 0.95.
`spreading: 'ewans'` is Ewans (1998) bimodal: two sech^2 lobes either side
of the wind, 14.9 degrees apart at and below the peak (where they merge into
one flat-topped hump) and separating as exp(5.453 - 2.75 fp/f) degrees above
it, 37 at 1.5 fp, 59 at 2 fp, capped at 60; each lobe 16.7 degrees wide at
the peak and 11.6 by 1.5 fp. It was the chop's spreading on `waterpro` in
round 2: a second, oblique wave family that crosses the sea's crests. Its
cost is the
along/cross slope ratio, 0.97 on the combined surface, because the lobes
reach 60 degrees; the ratio does not see that the chop is two crossing
families rather than a fan, so the choice was made by eye.
`spreading: 'hasselmann'` is cosine-2s with the Hasselmann, Dunckel and
Ewing (1980) power: 9.77 at the peak for every wave age (30 degrees
half-width), (f/fp)^4.06 below it, and above it (f/fp)^mu with
mu = -2.33 - 1.45 (U/cp - 1.17), so a younger sea spreads its chop wider.
It is the sea's spreading on `waterpro` from round 3, and was the chop's in
round 3 only: the chop band is 1.25 to 2.7 fp, past the 2 fp the 1980 buoys
reached, and the power extrapolated there goes almost isotropic (s = 0.47 at
2.6 fp), which rendered alone is a field of round lumps. Round 4 put the chop
back on Donelan-Banner, whose short-wave widths Banner measured (66 degrees at
2.6 fp); the along/cross slope variance of the whole sea went from 1.17 to
1.37 against Cox and Munk's 1.49.

## How long a crest is

Crest length is set by the directional spread of the band that carries
the energy at the range in view, and it is measured, not read off the
spread: `crestLength.ts` beside `measure.ts` gives, per band, the
Longuet-Higgins (1957) ratio of crest-wise to wave-wise zero-crossing
spacing from the spectrum, and the crest-wise first zero of the realized
height's autocorrelation doubled, which is the span of one crest as the eye
sees it. For the `waterpro` sea band (47 m peak, 15 m/s): Donelan-Banner
173 m (3.7 wavelengths), Hasselmann 73 m (1.6), Mitsuyasu 44 m (0.9). At
the judged eye-level pose 60 degrees off square, a 173 m crest spans the
whole 58-116 m crop at 100-200 m and two critics read it as brushed metal;
round 3 moved the sea and chop to Hasselmann for that reason. From above,
round 1 had read the reference's crests as three to five wavelengths, so
the two poses want different answers and the eye-level one won.

`energyScale` on a cascade is a swell's decay away from its storm (Snodgrass
et al. 1966): a JONSWAP peak keeping a fraction of its variance.

`tailPower` is the spectral tail exponent above the peak: 5 (absent) is
JONSWAP's omega^-5, 4 is the omega^-4 equilibrium range Toba, Donelan and
Phillips (1985) measured. It is a per-cascade choice because the range is a
property of the waves near the peak: on `waterpro`, omega^-4 on the chop and
sea bands with omega^-5 on the ripple resolves a mean-square slope of 0.0475
(six tenths of Cox-Munk's 0.080 total, the gravity-wave share); omega^-4
carried down to 0.1 m gives 0.228 and self-intersects.

`tailTaper` multiplies the tail above the peak by Elfouhaily et al.'s (1997)
exp(-(U10/cp)/sqrt(10) (omega/omegaP - 1)): 1 at the peak, and a few peak
frequencies up it takes omega^-4 back to about JONSWAP's level (on
`waterpro`, 1.09, 1.15 and 1.05 times JONSWAP at 30, 13 and 6.5 m, against
1.25, 1.90 and 2.69 untapered), so an omega^-4 band can meet a shorter
omega^-5 band without a step. No sea uses it: it was built to test whether
that step drew the round-3 dark bands, and it did not (see below).

## Reading a grazing view

The judged open-water pose (`ref-open`: 12 m up, 7.8 degrees down, 52 degree
vertical field of view) sees the sea at 5 to 30 degrees of grazing. Two
facts decide what the eye reads there, and both were measured in round 4.

- **The along-view slope is what shades.** A slope toward or away from the
  eye swings the reflected ray up or down and moves the fresnel; a slope
  across the view only turns the ray sideways. A wave family shows in
  proportion to cos^2 of the angle between its heading and the view ray.
- **The judged crop is the LEFT third** (x 0-533 of 1600). Its columns look
  16 to 41 degrees left of the frame's center line. Rounds 2 and 3 set the
  heading (150 degrees) from crest angles read as if the view looked down
  -Z; in the crop that heading sent the wind sea 76 to 90 degrees off the
  view rays, nearly invisible, and what showed was the spreading's tails,
  the part of the chop that travels across the wind. Round 4 turned the wind
  to 0 degrees (49 to 74 degrees off the rays, 60 at the crop's middle).

A CPU copy of the judged frame, `proxy.ts` in the gauntlet scratch, marches
each pixel's ray against the displaced surface, reads the normals as the
shader does, and draws the below-horizon self-reflection as a mask. Its mask
matched the GPU's dark streaks (median dash width 16 against 16.5 px, 90th
percentile 66 against 69). Rendered one cascade at a time it attributed the
round-3 "five or six parallel dark bands at near-equal spacing": the ripple
alone gave uniform dark dashes, the chop alone six smooth streaks, the sea
and swell alone none, and ripple with chop the bands. So the bands were the
ripple's back-facing facets, each drawn as a full dark pixel, grouped along
the chop's back slopes. Weighting that term by the facet's visible share,
dot(n, v) / dot(nGeo, v) with nGeo the normal of the waves the mesh carries,
took the dark pixels of the crop's middle third from 11.5% to 3.0% in the
proxy. That weighting belongs to the surface shader; it is listed under Open.

The crop measures used in round 4 (`bands.py`, `grain.py`, `orient.py` in
the scratch, all on the critics' crop against the reference crop): the
vertical autocorrelation of the dark-pixel envelope at its first peak
(regular band spacing; round 3 0.21, round 4 -0.04, reference -0.15), the
envelope's length over its thickness (5.5, 3.4, 3.3), the near-field glint
and foam pixels over 200 sRGB (10.8%, 5.1%, 4.9%), and the fine grain past
100 m (12.4, 10.9, 10.6).

## Floating bodies

A body is a `FloatingBodySpec` (mass, principal inertia, buoyancy probes,
drag, added-mass coefficient, mooring) and a `FloatingBodyState` (center of
mass, orientation, velocities), advanced by `stepFloatingBody` at a FIXED dt
from a known start. The sea stays a pure function of (seed, time); the body
is the only state, and N fixed steps from a pinned start reproduce bit for
bit.

- **Probes, not a hull mesh.** Each probe is a sphere fixed in the body
  frame; its submerged volume is the spherical cap under the surface height
  read above it. Twenty-five probes through the light buoy's hull (round 9;
  twenty-two in rounds 4 to 8) give heave, pitch and roll; the probes
  across the waterplane give the righting moment for free.
- **The surface above a point needs an inversion.** The FFT moves grid point
  G to G + D(G).xz. The height above world P is D(G).y for the G with
  G + D(G).xz = P, found by four fixed-point iterations of G <- P - D(G).xz.
  Reading D(P) directly puts the body on the wrong slope by up to the
  choppy displacement (about 1 m on the default sea).
- **The force at each probe is the water's own pressure gradient AT THAT
  PROBE'S DEPTH** (Froude-Krylov): rho V_sub (a_x, g + a_y, a_z), where a is
  the water's acceleration there. Linear theory says a wave's motion dies as
  e^{-k d} with depth, so each FFT band's surface motion is scaled by that
  band's RMS decay at the probe's depth (`bandDepthDecay`, integrated from
  the band's own spectrum). Round 3 applied the SURFACE's motion at every
  probe, which makes the body a parcel of surface water: its heave followed
  the surface with a correlation of 0.991 and the waterline never moved on
  the hull. With the decay the hull feels less of a short wave than its
  waterline sees and answers with its own heave resonance (the Smith effect):
  on the choppy sea the waterline travels 12 to 15 cm RMS on the hull, and
  the counterweight holds the body in slower water, so the water streams
  past the hull at about 0.5 m/s RMS.
- **The horizontal pressure gradient is -g times each band's slope**, fitted
  as a plane through the band's heights over all the probes (hull-scale).
  Not the parcels' own horizontal acceleration, for two measured reasons: the
  FFT's choppiness moves parcels sideways 1.5 times a linear orbit on the
  choppy sea's chop band (`kinematicConsistency()`: regression slope = the
  band's choppiness, correlation 0.9999), and a pointwise push at each probe
  under a sharpened crest capsized the light buoy within a second. The
  horizontal VELOCITY for drag is the parcels' divided by the choppiness.
- **Added mass is solved as a 6 x 6 mass matrix.** Each probe drags along
  C_a rho V_sub of water (C_a = 0.5, a sphere's); that mass sits in the
  hull, above the center of mass, so a push at the waterline tips the body
  as well as moving it. It adds C_a rho V_sub a_w to the forcing (Morison's
  inertia coefficient 1 + C_a) and lengthens the heave and pitch periods.
- **Drag is against the water's velocity at the probe's depth**, not still
  water, or the body brakes on every rise. Heave also has a quadratic FORM
  drag (Morison), 1/2 rho C_d A of the bilge and counterweight, which holds
  down the largest relative heaves without damping the ordinary ones.
- **The water's motion comes from Lagrangian differences.** Every body
  probe is a kinematic slot of the sampler: the readback also carries each
  band's displacement at the grid point found now and at the two grid points
  the last two samples found (`setPreviousGrids`), so a parcel is seen at
  three sea times and its velocity and acceleration are exact differences
  (`createBandKinematics`). Differencing at the moving probe mixes the
  surface's slope times the body's drift into the result.
- **The mass follows the painted waterline.** `massForWaterline` sets the
  mass to the water the probes displace at the design draft. The light
  buoy's damping is a FRACTION OF CRITICAL computed from its hydrostatics
  (`probeHydrostatics`: volume, center of buoyancy, waterplane area and
  second moment), heave 18% and pitch 30% (round 6; 15% in round 5, 30% in
  round 4), so it follows the hull when the hull changes. The pitch
  fraction is set by blind judgment: on the old 47 m `choppy` sea, at 20 to
  27% the buoy resonated to 12 to 25 degree leans and the self-check
  critics read a light model swinging; at 50% it leaned only with the water
  under it and they read it as pinned upright; 30% was the middle. Both
  counted round-4 judges then read the same buoy the other way ("heave,
  pitch and roll are too small and do not match the waves under it"), and
  the young `choppy` sea passes a crest every 2.5 s, so round 5 set 15%,
  the top of the textbook range: on the synthetic copy of that sea
  (`synthFloatC.ts`) the mean tilt went from 6.1 to 8.1 degrees (15.1 to
  16.8 at the 95th percentile) against a 6 m slope of 4.6 (9.4). On the
  round-5 strip (r7f1464) the tilt ranged 29 degrees on screen over 2.2 s
  with two reversals, and the waterline travelled 17.6 cm RMS on the hull
  (max 44 cm) against a 52 cm RMS surface.
  **Round 6 measured the lean against the water under the hull** (the
  pinned run's trace now carries the hull-scale slope, a plane through the
  waterline probes' heights, with and without the ripple band). At 15% the
  lean's correlation with the long bands' slope at zero lag was -0.10 (x)
  and -0.25 (z) over 12 s, and its best alignment came 0.75 s late, a
  quarter of the 3.0 s pitch period: the chop's periods straddle the pitch
  period, so the lean trails the slope, which is what a critic reads as
  "tilts more than the water under it seems to justify". Damping does not
  move that phase (at 30% the best lag is the same 0.75 s, correlation
  0.83); it sets the size, and 30% took the rms lean from 9.3 to 7.2
  degrees (0.99 to 0.82 of the long slope's rms) and the counted strip's
  on-screen swing from 30 to 19 degrees, still with two reversals
  (strips s6f1464 and s6g1464). A lean that trails the water reads as
  unjustified in any one frame, so the smaller one was kept. Round 4
  sank the light buoy 0.42 m up its flare (`NAV_BUOY_SINK_M`): blind
  critics read the cone's narrow end at the water as a hull resting ON the
  surface.
- **Sampling reads the GPU buffers.** `oceanBuoyancyProbe.ts` reads the sea
  through `createOceanSampler` (`oceanSampler.ts`), the same `sampleCascade`
  and `cascadeLod` the surface calls (GG-273, landed in round 4; the probe
  held a node-for-node copy before), so the body sits on the water the mesh
  draws, not on a second evaluation of the sea. The readback is asynchronous and resolves one to five frames
  after it is issued: the live viewer carries the sampled heights forward
  by their age with the sampled water velocity and acceleration (the same
  formula with age zero on the pinned path); the capture probe awaits every
  step, so a pinned run is exact.

The mount, `oceanExtras/buoys.ts`, owns the fixed clock (1/60 s, at most
twelve steps a frame), five moored buoys, the wash around the near buoy, the
scene's only lights, and the capture probe `__OCEAN__.extras.buoys`:
`runFixed({ t0, steps })` steps from rest at `t0 - 15 s` and returns the sea
time to pin; `verifySampler()` reads the whole `disp` buffer back and re-does
the sampling, the per-band kinematic samples included, on the CPU;
`bodies()` reports each body's waterline, the sampled surface under it, the
difference, and its tilt; `kinematicConsistency()` and `scaleBandWater()`
are diagnoses.

The wash is driven by the physics, per world angle round the near hull:

- **Everything round the hull is centered on the WATERLINE center**, the
  point where the body's up axis crosses its design waterline, not on the
  center of mass (round 5). The two part by the lean: at 13 degrees they
  were 0.37 m apart, so every "water beside the hull" read, the ring and
  the wash sat that far off the steel on the leaning side. The ring's
  circles now hug the hull's radius at the water (`rm` and `rwater`
  attributes, 0.92 to 1.10 R over the waterline's travel), with three more
  circles at 0.88, 0.94 and 0.99 R where the waterline moves: with only
  0.60 and 1.03 R there the ring lay under the fine patch between circles
  and its rim showed as a white arc detached from the steel by a dark gap.
- **Run-up.** Water climbs the hull by its stagnation head: u^2 / g for a
  flow u into the hull (the flare turns the stopped flow upward, so twice
  u^2 / 2g), plus v^2 / 2g for water rising against the hull at v, held
  with a 0.4 s decay and capped at the deck plate's height over the design
  waterline (`NAV_BUOY_DECK_FREEBOARD_M`, 0.30 m in round 9; a fixed 0.45
  before). The skirt draws it as a sheet of sea-colored water up the hull
  with a broken white top.
- **The water stands up against the hull** (round 5, `MOUND_SHARE`). Half
  of the run-up is drawn as a rise of the SEA SURFACE at the hull, falling
  away with the potential-flow pressure ahead of a cylinder,
  Cp = 1 - (1 - (R / r)^2)^2 (44% one radius out, 21% at two); the other
  half stays the sheet on the steel. By angle it is the run-up's first
  three harmonics, so the patch, the ring and the skirt read seven numbers
  and no texture. On the final strip the rise is 1.2 to 4.5 cm mean per
  frame, 2 px at the judged pose, so it reads only where the run-up peaks.
- **The waterline rim.** A bright 5 to 8 cm core line where the water meets
  the steel, with a floor of 0.4 (`LACE_BASE`) when the water is quiet;
  the plunge and the flow into the hull take it to full. Round 4 drew the
  lace only on a plunge, and both judges saw "only a thin dark line where
  hull meets water"; the reference hull carries a thin bright line at its
  waterline in 11 of its 12 strip frames. Round 6 cut the ring's side of
  it: the ring's core line is 0.35 bright at rest (full only on a plunge
  or where the water runs in), and the all-round "cling" that widened with
  the plunge is a tenth of the plunge (it was 0.8 of it; the plunge is a
  mean round the rim and stood at 0.2 to 0.7 in every frame of the round-5
  strip, so the cling drew a white band about 12 cm wide round the whole
  base every frame, and both counted judges read the hull "sitting on a
  bright collar of foam"). The per-angle wash on the side the water runs
  into keeps its width.
  **Round 7 took the resting rim to a hint** (the skirt's lace 0.15, the
  ring's core nothing) and draws both from a THRESHOLD on the per-angle
  foam state (nothing under 0.30, full at 0.85): at the counted far pose
  (`buoy-abeam-far`, the hull 30 pixels wide) the 5 to 8 cm line was one
  bright pixel under a dark hull in every frame, and the losing judge of
  round 6b named it "a hard, straight bottom edge sitting on top of the
  water"; the reference's line under a quiet hull is invisible at that
  scale (t0047.63). The whole-hull plunge (`uSlosh`, a mean round the rim)
  no longer lights the rim on its own and takes 0.05 of the cling. The
  plunge drive itself now has a side: weighted full on the face that looks
  into the waves' travel (the chop band's wind heading) and 0.2 on the lee,
  because the crest reaches the up-wave face first and breaks against it;
  across a 1.6 m hull the sampled rise differed too little side to side,
  and a whole-hull plunge drew "a perfectly symmetric halo like a decal".
  The impact drive starts at 0.45 m/s and is full at 1.3 (was 0.12 to
  0.7): the run-up heights the foam deposit already used (a 2 cm sheet and
  the 17 cm sheet that breaks), because on the counted window the flow ran
  0.3 to 1.2 m/s and at 0.12 the faces meeting it sat at full in nearly
  every frame, "the same lower-left spot regardless of lean". The rim and
  cling now appear on the struck face of a plunge and on a bow wash past
  about 0.9 m/s, and on nothing else (strips s7a to s7c1464f; the
  overlay sheet `light/sheet-o7.jpg` names the ring as the line's source).
- **Foam in the water.** A 128 x 128 grid over 10 m round the anchor (7.8 cm
  cells) is carried each fixed step with the waterline's mean surface
  velocity (semi-Lagrangian), decays with a 2.5 s e-folding time, and takes
  a deposit at the rim only where a run-up sheet is tall enough to break as
  it falls (6 cm, a flow of 0.77 m/s into the hull, full at 18 cm), or where
  the sea's own whitecap touches the hull. So the hull leaves foam behind
  it as the water moves past, and a hull in ordinary 0.5 m/s flow leaves
  none. A deposit on every flow into the hull drew "a thin even
  bright-white ring in every frame" (strip r5a888). The grid does not
  resample to carry: the water's motion is one velocity for the whole
  grid, so the grid is a torus whose origin travels with the water, and a
  step costs only its deposits (0.31 to 0.025 ms a step).
  **The field drifts downwind (round 7)**: the parcel velocity alone
  orbits, so foam laid at the hull came back to it half a period later and
  the wash never trailed. Foam rides the surface film, which drifts at
  about 3% of the 10 m wind (Wu 1975): 0.45 m/s along the chop band's
  heading on the choppy sea, a trail 1.1 m long at the field's 2.5 s
  e-folding time. The Stokes drift of the chop band (0.27 m/s) is not
  added: the FFT's parcels orbit without it. The flare slamming into the
  water (the rim driven down faster than 0.25 m/s relative to the water,
  the roll's low side and a plunge) also lays foam beside that side, at
  the drive squared times 0.6.
- **A breaking crest at the hull.** Where the sea's fold deficit beside the
  hull passes its whitecap ramp (0.40 to 0.62, the surface's own), the
  crest's water runs in at 0.4 of the foam band's phase speed (4.6 m/s on
  the choppy sea) on the side it faces, and its run-up climbs the hull to
  the deck-rim cap; its foam gathers against that side. The FFT is a sum
  of linear waves and its parcels never reach a breaker's speed; the 0.4 is
  held against the reference strip, not measured.
- **Wet mark.** The highest recent water line per angle, drained at
  0.12 m/s, drawn as darker glossy paint with a Fresnel sheen of what the
  reflected view ray meets: the sky where it climbs, the sea where it falls
  (a sky sheen on every facet drew a bright rim along a lifted hull's
  underside). The run-up and the wet mark are smoothed round the hull over
  plus or minus 18 degrees before the skirt draws them, or one saturated
  segment beside a low one drew saw teeth.
- **The hull in the water beside it.** The ring darkens the water where the
  hull's reflection falls (toward the eye) and its shadow (away from the
  sun), both one-sided. An even darkening round the whole rim was tried and
  removed: critics read it as a contact shadow standing in for a waterline.
  Round 5 took the reflection from 0.55 to 0.25 and the shadow from 0.30 to
  0.12 after the counted judges named "a dark contact shadow" edging the
  hull; the lit rust reads through a hatch lid at roughness 0.85 (0.6
  mirrored the low sun as a white oval on the deck in every frame).
- **A fine water patch.** A 6 m square at 0.1 m cells, carried to the
  waterline center each frame (snapped to its 10 cm lattice), drawn with a
  clone of the ocean material and the coarse mesh's own triangle heights
  at its edge, so the cut at the hull follows the sampled field and not the
  1.8 m mesh. It and the ring pass the depth test by moving each vertex
  toward the camera along its view ray (12 cm and 24 cm): same pixel,
  nearer depth. It draws BEFORE the ocean (`renderOrder` -1), so the ocean
  fragments under it fail the depth test before their shader runs. A 10 m
  square fixed at the anchor and drawn after the ocean cost 2.5 ms a frame
  at 1600 x 900; this one costs about 0.16 ms (`benchPiece.mjs`, patch
  alone). The clone follows the ocean's fragment stage when another piece
  sets a surface reader (`setWake`, `setSeabed`, `setFoam`).
- **Cost after round 11: 0.1 ms of live frame, 0.17 ms of draw, the
  reflector included** (`cost-abeam11.json`, `buoyCost.mjs 5 abeam abeam11`
  with `TRIAL_SURFACE=1`, so both pages carry the patched surface and the A
  page sets the reflector: five paired rounds, of which 2 and 5 are bursts
  on both pages (the B page's compute 0.87 and 0.68 against 0.50 to 0.52
  in the clean rounds). Clean rounds 1, 3 and 4: the piece adds 0.10 ms to
  the live frame (2.3 against 2.2), 0.16 to 0.21 ms to the GPU draw (2.22
  to 2.23 against 2.05 to 2.06), 0.13 to 0.18 ms to the bench's whole
  frame and 0.19 ms of main-thread update; the in-page hide of its objects
  0.07 to 0.11 ms of draw. Three quadrics per water fragment within 4.5 m
  of the hull and the ring's two extra gates cost nothing the gauge can
  see against round 10's 0.18 ms of draw.)
- **Cost after round 10: 0.1 ms of live frame, 0.18 ms of draw**
  (`cost-abeam10.json`, `buoyCost.mjs 5 abeam abeam10`, five paired rounds
  with another session's load on the GPU throughout, the B page's compute
  0.51 to 0.55 ms on every round: the piece adds 0.10 ms to the live frame
  (2.1 against 2.0), 0.18 ms to the GPU draw (2.34 against 2.16; 0.14 to
  0.20 in every round), 0.13 ms to the bench's whole frame (0.10 to 0.19)
  and 0.17 ms of main-thread update; the in-page hide of its objects 0.12
  ms (0.10 to 0.18). The round changed one damping constant; the draw's
  extra 0.06 over round 9 sits inside the two runs' spread.)
- **Cost after round 9: 0.1 ms of live frame, 0.12 ms of draw**
  (`cost-abeam9.json`, `buoyCost.mjs 5 abeam abeam9` on the round-9 draft,
  five paired rounds with another session's load on the GPU throughout,
  the B page's own compute 0.55 to 0.57 ms on every round: the piece adds
  0.10 ms to the live frame (2.2 against 2.1; round 3's 3.9 is a burst,
  its paired bench difference 0.14), 0.12 ms to the GPU draw (2.33 against
  2.22), 0.13 ms to the bench's whole frame (0.07 to 0.15 in every round),
  and 0.18 ms of main-thread update; the in-page hide of its objects 0.12
  ms (0.10 to 0.13, one burst at 0.71). Three more probes (25 for 22), one
  more ring attribute and the deck's radial bound cost nothing the gauge
  can see.
- **Cost after round 8: 0.2 ms of live frame, 0.13 ms of draw**
  (`cost-abeam8.json`, `buoyCost.mjs 5 abeam` on the round-8 sea, five
  paired rounds with another session's load on the GPU throughout, the B
  page's own compute 0.54 to 0.56 ms: the piece adds 0.20 ms to the live
  frame (2.1 against 1.9), 0.13 ms to the GPU draw, 0.19 ms to the bench's
  whole frame (round 2's 3.21 is a burst), and 0.18 ms of main-thread
  update; the in-page hide of its objects 0.13 ms (0.09 to 0.15, one burst
  at 0.82). The sea change costs the piece nothing: the same probes, the
  same draws.
- **Cost after round 7: 0.1 ms of live frame, 0.17 ms of draw**
  (`cost-abeam7.json`, 2026-09-25, `buoyCost.mjs 5 abeam`: five paired
  rounds at the counted abeam pose with another session holding the GPU at
  100% throughout, the load gauge on the B page 0.54 to 0.78 ms, in the
  quiet range; round 1's paired frame of -1.2 ms is the burst). Medians:
  the piece adds 0.10 ms to the live frame (2.3 against 2.2), 0.17 ms to
  the GPU draw (2.44 against 2.27), 0.50 to the bench's whole frame (0.15
  to 0.73 in the four clean rounds), and 0.18 ms of main-thread update; the
  in-page hide of its objects reads 0.14 ms of draw (0.02 to 0.32). The
  round's new work is one exponential in the hull reader and a Fresnel term
  on the rust paint: nothing measurable against round 6b's 0.1 to 0.3.
- **Cost: about 0.2 ms a frame, round 6 included** (2026-09-25 evening,
  `cost-abeam6b.json`: at the counted abeam pose, four quiet rounds of
  five (load gauge 0.35 to 0.46 ms on both pages; the fifth, at 2.3 and
  1.4, is void) give the piece 0.1 to 0.3 ms of live frame, 0.05 to 0.45
  of draw, 0.05 to 0.54 of the bench's whole frame and 0.08 ms of
  main-thread time; the in-page hide of its objects 0.09 to 0.11 ms of
  draw. The hull reader in the ocean shader, the one new GPU cost this
  round, was measured on its own by setting and clearing it in one page
  in the same seconds (`readerCost.mjs`, four rounds, load gauge 0.44 to
  0.47): 0.07 ms median of draw (0.04, 0.07, -0.03, 0.15). A first run of
  the same evening on a GPU another session held at 100% read 4.7 ms of
  live frame for the piece with the load gauge at 1.2 to 2.1 on both pages
  in every round: void, all five, and a reminder that the gauge decides.)
  The round-5 figures follow (2026-09-25, after the performance pass;
  `buoyCost.mjs` in the buoyancy scratch, results `cost-near5.json` and
  `cost-abeam5b.json`). Two pages that differ only by
  `extras=buoys` against `extras=none`, alternated A B then B A for five
  rounds in the same minutes, the clock live so the bodies step and read
  back every frame, 1600 x 900, vsync off. At the lead's buoy pose the
  piece adds 0.20 ms to the live frame (2.7 to 2.9 ms; every paired round
  0.2 to 0.7), 0.11 ms to the GPU draw, 0.21 ms to the bench's whole
  frame and 0.16 ms of main-thread time (the physics step, the probe
  dispatch and its readback). At the counted abeam pose the quiet rounds
  give 0.10, 0.13 to 0.17 and 0.14 to 0.21 ms. The load gauge is the sea's
  own compute on the page WITHOUT the piece: 0.8 ms when quiet; a round
  where it reads 2 to 3 ms on both pages is a burst from another session
  on this GPU and is void (three of five abeam rounds were). Hiding the
  piece's objects in one page (`__OCEAN__.ablate('extras', false)`) needs
  a 2 s pause before the next bench: the lights are among the objects, a
  lights change gives every lit material a new pipeline, and a bench that
  follows at once times that rebuild as 9 ms a frame (`benchSeq.mjs`).
- **The hull under the water (round 6).** With opaque water the hull ended
  on its waterline, and a waterline on a cone is an ellipse: both counted
  round-5 judges read "the whole bottom ellipse of the hull stays above the
  water ... a model on a picture". The near hull is now a SEA FLOOR the
  surface sees through its water, on the routed `setSeabed` hook that the
  caustics piece uses: the reader (`hullReader` in `buoys.ts`) refracts the
  view ray at the long-wave normal, hits a cone about the body's axis in
  the hull's own frame (radius 0.805 at the design waterline, narrowing
  0.32 m per meter to the bilge at -1.44 m, within 10 cm of the lathe),
  and returns the path transmittance, e^{-c s} with c = (0.8, 0.35, 0.25)
  per meter (coastal water), and the steel's own dark light after it. The
  surface takes that share from its BODY term only, body x (1 - trans) +
  through, so the sky reflection and the sun's glints on the same pixel
  stay: at the counted pose's 16 degree look-down the ray enters at 74
  degrees and runs on at 44 degrees under the surface, so the hull shows
  through the water within about 1.4 m in front of its waterline, darkest
  at the rim, and on wave faces turned toward the eye, where the body
  shows. The bilge fades over its last 0.6 m and the cone's grazing quarter
  fades with the hit's cosine, so no hard line marks the image's edge. The
  reader runs in every water fragment behind a distance test; the cone hit
  only within 2.6 m of the hull.
  Two overlay passes were tried first (a lathe of the hull drawn over the
  water without a depth test: multiply the pixel by 1 - w per channel, add
  the hull's light): the multiply took the glints too, and Beer's law
  takes more green and blue than red, so over the backlit glitter the
  ghost drew PINK (strips s6b1464, s6c1464), and a short fade read as a
  grey shadow under the rim (s6a1464). Round 4's translucent copy through
  a nudged depth test drew a dark arc where the test cut it
  (`overlayAB.mjs`). The pixel's reflected share cannot be separated after
  the fact; the surface's body term can.
  **Round 7 made it a band.** Beer's law alone fades the cone over about
  1.5 m of path, and at the counted far pose the hull showed through the
  water as a dark blob half a hull-height below the rim, offset toward the
  eye by the refraction: a shadow under a placed object (lighting sheet
  `light/sheet-l7a.jpg`, every variant), where the judged Choppy stills
  show nothing under their rim. The transmittance now also fades as
  e^{-depth / 0.25 m} of the hit's depth and takes at most 0.6 of the
  body term (`HULL_VISIBILITY`; a pixel's body light comes from a column of
  water round the ray, not the ray alone), and the hull's own light under
  the rim is its shaded flank's diffuse, (0.016, 0.006, 0.0035), so what is
  left is a wet band under the waterline, darkest at the rim, gone by
  0.5 m. Round 8 measures that depth below the surface the ray entered
  (the ray's length times minus its direction's y), not from the design
  waterline: with a crest 0.5 m up the flare, a hit on the flare above the
  design line got no fade and drew a dark crescent floating in the water
  under the hull (s8b922n, f04 to f07). The same crest puts the water
  pixels over the float INSIDE the cone's radius, where the side-hit test
  (the ray starts outside the cone) fails and left the water over the hull
  bright while rays entering the cone's side 0.3 m out darkened it: a
  crescent detached from the hull. Such a ray now takes the deck first, a
  plane at the cone's top, at a depth of the swamp less the deck's height,
  with the deck's own light and fades. Its radiance (0.087, 0.034, 0.022)
  is the dry deck's measured mean (0.18, 0.07, 0.045) times 0.86 under the
  surface (the sun's 70 degree Fresnel loss; refraction bends the beam
  steeper but conserves the flux through a horizontal patch) times 1 / n
  squared out of the water. Its visibility 0.9 and image depth 0.6 m
  replace the flank's 0.6 and 0.25 m: a wide face square to the ray is not
  spread away by the surface as a thin flank at grazing incidence is, and
  the body light over a deck 7 cm down comes from a 7 cm column. At the
  16 degree look-down the surface's sheen and glints are as bright as the
  deck's light after its path, so a swamped deck is a warm grey under the
  glare, darker and warmer than the water beside it, not a brown plate.
- **The hull is not a black cutout (round 7).** Measured at the critic's
  scale (300 x 324 tiles, the flare band's median luminance over the
  water beside it, `measureLight.py`): the round-6b hull was 4 to 8 of 255
  against water at 91 to 104, a ratio of 0.05 to 0.08; the reference's
  hull is 29 to 58 against 114 to 162, a ratio of 0.23 to 0.36. A hull
  five times darker than any hull under that sky makes every edge it has a
  hard one. The fill light's ground half (the sea seen from the hull's
  flank) was the water seen from above, (0.10, 0.15, 0.19) at 1.6; from a
  flank the water round it lies at 5 to 20 degrees, where it mirrors the
  horizon sky at a third to a half and carries its glitter and foam. A
  lighting A/B at the counted pose (`lightAB.mjs`, frame 4, `setLights` on
  the probe) set the ground at (0.42, 0.50, 0.58) and the intensity at
  2.4: the flank at 0.24 (37, 20, 14 display), against 0.13 at 1.6 and an
  orange hull at 3.2 with a lighter paint. At 2.4 the sky half is pi times
  a sky of about 0.35, the Lambertian irradiance under it. The paint also
  carries the sky's sheen (`oceanBuoyModel.ts`): the reference's shaded
  flank is a grey-brown, blue at 0.58 of red, while Lambertian rust under
  a blue-grey sky stays a saturated red-brown (0.30); a rough clear coat
  mirrors the sky at Fresnel (F0 0.05), and with no environment map to
  reflect, the sky's horizon radiance stands in for it as the skirt's wet
  film does, the sea where the reflected ray falls. On a flank that faces
  down it adds little (the ray falls to the sea), so the hue stays redder
  than the reference's; the level is the reference's. The blind judge of
  round 6b did not name the hue.
  What the judge called "the hull base shows a hard, straight bottom edge"
  was measured, not the flare the lead suspected: at the far pose's 13.5
  degree look-down the waterline ellipse on a 30 pixel hull bows 3.5
  pixels, straight at that scale, and the reference's own hull bottom is
  the same convex curve (t0048.21 at 4x); the edge was hard because the
  hull was black, a bright line ran under it, and a dark blob sat below
  that. The shape was left alone: a drum or tumblehome float would put the
  waterplane's area up a quarter and its roll stiffness up 40% (the probes
  and mass budget re-laid), a re-tune the round could not judge blind.
  The roll rate was measured against the same complaint ("snaps from a
  right lean to a left lean in one step" between counted frames 5 and 6):
  the mast's on-screen lean at the far pose over the counted frames is
  9.8, 11.3, 4.5, -4.5, -6.9, -4.1 degrees, so frames 5 and 6 lean the
  same way and differ by 2.8 degrees; what reverses between them is the
  water's slope under the hull (-8 to +8.6 degrees in z over 0.4 s, a
  crest passing at the chop's 2.5 s period) and the water's height on the
  hull (+32 to -7 cm). The pitch period is 3.33 s (I 4673 + 1868 added
  kg m^2 against K 23.3 kN m/rad, GM 1.12 m); the tail's cross-flow added
  inertia, which the sphere probes under-represent, would add 5% (3.51 s).
  A slower roll would need a longer sea, not a heavier buoy.
- **The sea sets the phase, and round 8 changed the sea.** The round-7
  strip (s7c1464f) lost its blind order on the water: "no visible heave",
  "the lean does not point downhill on the wave face", "no crest ever hides
  the hull's base". The pitch period is 3.33 s and no mass budget moves it
  (all the ballast in the counterweight gives 3.12 s: the inertia grows
  with the lever as fast as the stiffness), so a wave's period alone sets
  whether the lean follows the slope: 134 degrees of lag on the 2.5 s chop
  (the lean nearly opposes the slope), resonance at 3.2 to 3.6 s, and a
  lean that points downhill (about 30 degrees) only on waves of 5 s and
  longer. So the wave that lifts and tilts the buoy must be the sea band's
  47 m, 5.5 s wave, and the chop is for the whitecaps. The reference near
  its buoy (`_lead/sel/refc`, the buoy's 3.2 m from waterline to lamp and
  the 7 m boat as rulers): breaking crest lines 15 to 25 m apart with faces
  about 1 to 1.5 m high, on a longer face rising about 2 m over the boat.
  The `choppy` state now puts the chop's JONSWAP peak at 16 m (a 9.72 km
  fetch, T 3.2 s, Hs 1.36 m, steepness 0.085) at choppiness 1.3 and
  doubles the sea band's variance (Hs 2.43 m at 47 m): total Hs 2.79 m,
  combined Jacobian minimum 0.15, under 0.6 on 4.57%, no fold
  (`measureSea.ts`, candidates r8a to r8g; its comment carries the
  numbers). On the pinned run the water climbs 49 cm up the hull and drops
  21 cm below the line inside one 2 s window while the mast swings 15
  degrees with two reversals (window 92.2, `findWindow.mjs`, which now
  reads the 12-column trace, projects to the far pose and scores each
  window's lean against the long-band slope: 0.89 at 92.2, -0.55 at the
  larger-heave 104.6). The counted far strip s8b922f: swamp +3, +44, +49,
  +37, +10, -21 cm over the counted frames (the base under water in three
  of them), the waterline 0.7 m down and 0.3 m back up. The wash
  thresholds moved with the sea: the buoy now rides the waves, so the
  water rises against the rim at 0.2 to 0.5 m/s where the old chop gave
  1 m/s, and the plunge drive starts at 0.12 m/s (full at 0.8) with the
  ring drawn from 0.20 of the foam state, so a crest climbing the flare
  draws its ring on the face it climbs and a quiet hull draws none. The
  buoy is the only piece judged on `sea=choppy`.
- **Round 9: the roll's rate, the line at rest, and the draft.** The
  round-8 far judge (ours lost both orders) read a spring-damped model: the
  buoy "snaps from a 15 degree lean to bolt upright" between counted frames
  1 and 3, then "sits almost frozen" while chop passes; the reference's
  roll "builds slowly and continuously across the six frames the way a
  tall tower buoy with a long roll period should"; ours showed no line at
  the waterline; and "the hull's widest part rides above a flat, hard
  horizontal cut ... the float should sit deeper (only the top of the float
  above water)". Three changes, each with its measurement.
  *The roll.* The strip's trace on the round-8 sea gives the surface under
  the hull a 4.8 s zero-crossing period and the chop 1 to 2.7 s; the 3.33 s
  roll answered the chop at half amplitude and swung 9 degrees in 0.4 s.
  Moving the counterweight cannot lengthen it (the inertia grows with the
  lever as fast as the stiffness: 700 to 300 kg gave 3.33 to 3.39 s), but
  mass carried HIGH raises the center of mass and the inertia together:
  `oceanBuoyModel.ts` now carries 750 kg on the tower (176 in rounds 3 to
  8; the platform, lamp, cage, daymark, and the tank's batteries or gas),
  for a 4.8 s pitch period (I 8166 + 1307 added kg m^2 against 16.3 kN
  m/rad, GM 0.65 m) with the same 30% damping. On the counted far strip
  (s9c922f) the on-screen lean runs 11.1, 10.0, 8.1, 6.0, 4.4, 3.5, 3.1,
  2.5, 1.5, 0.2, -1.5 degrees over the 2.2 s window with no reversal,
  and its best alignment with the long slope comes 1.1 s late (corr 0.72):
  the lean builds and decays across the strip instead of snapping.
  *The line.* The ring's core is 0.45 bright at rest again (`RIM_REST`;
  round 7 had turned it off when the hull was black): the relative flow at
  the waterline is never quiet on this sea (0.46 m/s rms, 0.97 at the 95th
  percentile), so broken water rings the base at all times, and the struck
  face carries more. `rimFar.py` finds the line in the counted frames whose
  rim is clear of the water.
  *The draft.* Measured at the critic's scale (`measureFloat.py`,
  `farZoom.py`), the reference's dark hull shows 0.3 to 0.45 of its deck
  width below the widest ring at a 14 degree look-down, of which the
  deck's own ellipse is 0.24, so 0.1 to 0.4 m of flare shows as the water
  moves; ours at 0.38 m of freeboard bared the whole flare and the waist in
  the troughs (s8g922f f10: 0.59 m of cone). `NAV_BUOY_SINK_M` is 0.60
  (0.42 before): the rim 0.20 m and the deck plate 0.30 m over the design
  waterline, the waterline radius 0.85 m. The probes were re-laid against
  the lathe's own buoyancy curve (`draftLay.ts` integrates the hull, the
  sealed tank and the tail at each water rise): an eight-sphere waterplane
  ring (six of the width this waterplane needs under-represent its second
  moment by a quarter), a middle ring round the waist, a flare ring 2 cm
  under the rim, the tank inside the tower as reserve buoyancy once a crest
  is over the deck, and the center, bilge, tail and counterweight on the
  axis: 2.49 m^3 against 2.51 at rest, within 4% from 0.1 m down to 0.1 m
  up, 8% at 0.2 up and 0.3 down, 11% at 0.3 up. Mass 2549 kg (2117), 280
  kg of it new hull-bottom ballast, heave period 2.42 s, surge drag 1050 N
  s/m for the flare band under water. The hull reader's cone follows
  (radius 0.85 at the water, 0.30 per meter, bottom at -1.62, top at the
  rim's 0.20), and the run-up cap is the deck plate's 0.30. On the CPU copy
  of the sea the rim goes under 24% of the time and the plate 12% (2% and
  6% at the old freeboard) and no trough bares the waist; on the counted
  window the water on the hull runs -23, +15, +30, +32, +14, -15 cm over
  the six frames, so the top of the float shows in four of them and the
  deck is awash in two. *A rim under water draws no line.* The ring's
  core and cling fade as the water climbs the first 2 to 15 cm over the
  rim (`over`, per angle): with the rim under, the broken water is under
  the surface too, and the ring had drawn a bright white ellipse round a
  grey awash deck at 4x (s9a922f f04, f06), a decal. *The deck's image ends
  at its rim.* The hull reader's deck hit (round 8) gated only on the ray
  starting inside the cone extrapolated to the surface, and drew the awash
  deck as a flat dark-brown plate out to about 1.15 m from the axis at the
  near pose, wider than the 0.92 m deck, with a hard edge (the round-8 near
  strip had it at +45 cm; `light/sheet-o9n-tight.jpg` names the ghost).
  The image now fades over the deck's last 12 cm of radius and is gone 3 cm
  past the rim; what remains is the deck's refracted image, shifted toward
  the eye by its depth. What is left to judge: in the two awash frames the
  float is wholly under a smooth crest with no foam over the plate, where
  the reference hides its float only behind a breaking crest with foam.
  Still open at the NEAR pose (not judged): with the deck awash and the
  hull leaning toward the eye, the flank's image through the surface draws
  a flat pinkish-grey lobe on the low side out to about 0.7 m past the rim
  (s9f922n f06, f07; the round-8 near strip had it at +45 cm). The pixel
  diff of the deck bound touched only a crescent at the deck's edge, so
  the lobe is the CONE hit: its body term removed under glitter that
  stays, the round-6 pink mechanism, on a face that leans up toward the
  eye and so images far in front of the hull.
- **Round 10: the heave resonance.** The round-9 far judge (ours lost both
  orders): the hull "alternately buries itself and lifts clear of the
  surface with no water reacting to it ... heave should track the visible
  wave, not pump independently"; the reference's waterline stays at
  mid-hull. The lead's lead was a heave resonance against the chop, and it
  measures so. The chop band's JONSWAP peak is 3.20 s (`rao.ts`, from the
  9.72 km fetch at 15 m/s), the sea band's 5.49 s; the heave period was
  2.42 s, 0.76 of the chop's peak. The linear transfer of the RELATIVE
  motion (the step's spring acts on hull against surface, and its drag,
  Froude-Krylov and added-mass terms on the water's motion at the probes'
  depth, so a band the probes feel in full moves the hull as a parcel and
  the deficit 1 - s drives the rest through the heave resonance) is 1.27 at
  the chop's peak against 0.30 at half the period. `rao.ts` integrates it
  over the choppy spectrum for a sweep of heave periods and damping
  fractions: the floor is the wave-follower regime, periods under 1.6 s (3
  to 7 cm rms), which this hull cannot reach (2 pi sqrt((m + A) / rho g
  Aw); 1.6 s needs the mass-to-waterplane ratio cut 2.3 times, a float 1.5
  times as wide); at any period, damping on the relative velocity flattens
  the resonance to about 11 cm at critical. The CPU copy of the sea
  (`synthFloatC.ts`, 60 s, `DUMP` + `synthDump.py`) agrees and adds what
  the linear map misses: the water on the hull ran 23 cm rms (43 at the
  95th percentile) and its power sat in the chop's 2.5 to 4 s band (410 of
  the surface's 914 cm^2 there, 26 of 2507 in the sea band's 4 to 7 s), the
  waterline trailing the surface by 0.17 s; the mooring is taut 13% of the
  time and changes little (25.9 against 22.8 cm). Heave damping at 50, 100
  and 150% of critical gave 14.4, 11.8 and 11.3 cm rms (p95 30, 23, 22;
  correlation with the surface 0.973, 0.984, 0.987; the rim under 7, 5, 5%
  of the time against 24%); halving the added-mass coefficient (a 2.2 s
  period) 18.9; removing the quadratic form drag 28.4 (it stays). Doubling
  the pitch damping trimmed the 0.4 s swing (p95 9.0 to 6.9 degrees) but
  left the lean's lag behind the long slope at 1.0 s: that lag is the 4.8 s
  roll period against the 4.8 to 5.5 s sea, not the damping, and the roll
  stays as round 9 set it. `HEAVE_ZETA` is 1.0 (0.18 since round 4;
  `oceanBuoyModel.ts` carries the physics it stands for: a wide float's
  radiation damping, which the probe model lacks, the flare pushing water
  aside, the chain). Round 1's 35% "lagged a rising crest" against STILL
  water; since round 4 the drag is relative to the water, so heavier
  damping couples the hull to the water instead of braking it. On the
  counted far strip (s10a922f, the same window) the water on the hull runs
  -25, -10, -1, +7, +12, -1 cm over the six frames (round 9: -23, +15, +30,
  +32, +14, -15), the waterline error 9.8 cm rms (18.7), the heave's
  correlation with the surface 0.981 (0.961), the on-screen lean 9.5 to
  -0.3 degrees with no reversal, and `rimFar.py` finds the line under the
  hull in the three frames whose rim sits within 12 cm of the water. What
  is left: f00 rides a crest 25 cm clear beside the whitecap, the one frame
  that bares the waist.
- **Round 11: the oval, the hull in the water beside it, and the bob.** The
  round-10 far judge (ours lost both orders, high confidence): "the hull's
  bottom rim is drawn as a complete closed oval sitting on top of the
  water ... so nothing is submerged"; the reference has "a dark
  reflection/shadow smear under the base that ties it to the surface" and
  ours "no reflection, shadow, or darkened wet band under or around the
  hull in any frame"; "A has no heave: the buoy slides down-screen
  monotonically about 30 px over six frames".
  *Never a closed ring.* The resting line ran all round the hull, and at
  the far pose's 13 degree look-down its near half plus the hull's dark
  cut closed an ellipse under the float, the rounds-5-and-6 read. The
  ring's mark now has three gates, none a circle (`buoys.ts`, `core`):
  the side toward the camera (`facing`, the near quarter to half of the
  rim, gone on the flanks and the far side), patches from a low-frequency
  suds noise along the ring (about half its length in lumps 15 to 40 cm
  long), and a width from the local run-up (5 cm quiet, 12 cm where the
  water climbs that angle). The exposed band was re-measured at the
  critic's scale (`measureFloat.py`): ours shows 1 to 5 px of float under
  the widest ring against the reference's 7 to 8, so the band is not too
  tall; the read came from the outline, not the draft.
  *The hull in the water beside it* (`oceanReflector.ts`, the routed
  `setReflector` hook, the same shape as `setSeabed`: one reader or null,
  the shader rebuilt on set, nothing emitted with no reader). The surface
  reflects the analytic sky only, so no floating thing ever showed in it.
  The reader (`reflectorReader` in `buoys.ts`) mirrors the view ray in the
  SHADING normal (a mirror in the long normal drew the hull as one
  hard-edged dark block beside the base, s11b922f; the ripples break a
  real image, s11c922f), carries it into the hull's frame with the hull
  reader's uniforms, meets the hull cone, the sealed tank (a cone 0.56 to
  0.34 m across, hull-frame 0.90 to 1.82) and the lattice as a 0.60 m
  cylinder covering a third of a ray, keeps the nearest hit, and returns
  the steel's light (the shaded flank's measured radiance plus the rust's
  diffuse under the mount's sun over pi times the hit normal's cosine)
  with a coverage that fades over the hit's grazing half, with the ray's
  length past 1.5 m (gone by 4 m: a rough sea's image of a thin distant
  part dissolves where its base's does not), where the mirrored ray dips,
  and never past 0.75 (`MIRROR_MAX_COVER`; the rest stays sky). The
  surface mixes it into the reflected radiance before the Fresnel weight.
  The flare's outward normal points down and out, so with the sun at 20
  degrees its image is dark on every side: the reference's smear. The hook
  lands through the lead (`buoyancy/patchReflectorHook.mjs` edits the
  lead-owned, CRLF `oceanSurface.ts` at five single-line anchors, keeps the
  endings and refuses a second run; `reflectorHook.diff` is its diff);
  until then the mount warns once and draws no reflection. The round's
  strips were shot with the patched module served to the page in place of
  the tracked one (`shootStrip.mjs` and `buoyCost.mjs`, `TRIAL_SURFACE=1`:
  a copy under the scratch folder with its imports on the `@/` alias,
  which Vite transforms like any file under the root), so no tracked file
  changed and no other page saw it.
  *The bob.* At critical heave damping the hull rode the 5.5 s swell's
  face and slid through the chop's bump under it: on the counted window
  (`bobMeasure.py`: the waterline's on-screen height about its trend, at
  the critic's scale) the hull moved 4.1 px rms with no reversal while the
  water beside it moved 3.3 px with two; the reference's own deck row
  climbs 98 px across its six stills (its camera moves), so its bob is
  not a clean bar. Three strips of the same pinned run at 1.0, 0.7 and 0.5
  of critical (s11c, s11e, s11d922f): bob 4.1, 5.3 and 6.6 px rms with 0,
  0 and 2 reversals; the water on the hull 9.8, 10.8 and 12.6 cm rms over
  the last 12 s (maxima 28, 34, 43), a range of 37, 38 and 41 cm on the
  six frames; the linear map has the heave at the chop's peak at 0.79,
  0.85 and 0.92 of the wave. `HEAVE_ZETA` is 0.5: the only one of the
  three that rises and falls with the bump the water shows (f04 to f08),
  for 3 cm rms more of creep, and far from round 9's 0.18 (10.2 px of
  pumping against the water's 3.6 at 23 cm rms). On the CPU sea 0.5 gives
  14.4 cm rms and the rim under 7% of the time (0.7: 12.9 and 6%; 1.0:
  11.8 and 5%).
  On the counted far strip (s11g922f, the patched surface served to the
  page): the water on the hull -27, -1, +9, +14, +9, -5 cm over the six
  frames, the hull's on-screen height reversing twice with the water's,
  the mark on the near rim in three frames by eye (f02, f04, f08; one by
  `rimFar.py`'s threshold of 20 over both neighbors), and the hull's dark
  image under and left of the base from f02 on, broken by the ripples,
  where a mirror in the long normal drew one hard block (s11b922f). What
  is left: f00 still rides a crest 27 cm clear with the flare bare; the
  reflection is a dark blot under the base rather than the reference's
  soft, wide smear (the surface's roughness spread is not applied to the
  reader's ray, only the ripple's tilt); the lean's lag behind the long
  slope is unchanged (round 10).

- **Round 12: the sea reacts to the buoy.** Six blind judges in a row
  (rounds 7 to 11) named one fault whatever else they said: "no foam ring,
  wash or wetted band where the hull meets the water" in any counted
  frame, and (round 11r, at the reference's pixel count) "the whitecap in
  frame 1 passes through the buoy with no splash, shadow or break in its
  foam, as though the buoy were not there". Measured at the far pose (the
  hull 30 pixels wide, 5.7 cm a pixel), every wash term was sized for the
  near pose and gated on flows the counted window never reaches: the
  skirt's band needed a 6 cm run-up (a 0.77 m/s flow into the hull; the
  window runs 0.2 to 0.5 m/s, a run-up of 0.4 to 2.5 cm), the impact drive
  started at 0.45 m/s, the ring's cling reached 27 cm and was broken by 7 cm
  suds that average to grey at that pixel size, and the foam field lived
  2.5 s at a 0.45 m/s drift, a trail 1.1 m long. Four changes, each held
  against a strip of the same pinned window (s12a to s12c922f).
  *The wash is foam in the water that leaves the hull.* The field is 24 m
  across at 12.5 cm cells (192 x 192; 10 m at 7.8 cm before) and lives 6 s
  (2.5); it drifts with the film's 3% of the wind (round 7) PLUS the Stokes
  drift of the chop and sea bands, (a k)^2 c summed, 0.49 m/s or 3.3% of
  the chop's 15 m/s wind (`FOAM_STOKES_DRIFT_FRACTION`), 0.9 m/s together:
  at 0.45 m/s the drift was under the 0.5 m/s orbital flow past the hull,
  so foam laid at the rim circled the hull once a swell period before it
  left and the wake drew as a collar on every side (s12b922f). Round 7 left
  the Stokes drift out because the FFT's parcels orbit without it; the foam
  is not an FFT parcel, and real surface water has that net drift. The
  field takes a deposit at every step from the ordinary flow into the rim
  (`WAKE_DEPOSIT`, the square root of the impact drive, at 12 per second: a
  cell is under the rim for 0.1 to 0.2 s and takes that share; round 4's
  rule of no deposit on plain flow was set on a field that did not drift
  and drew a ring), and where the sea's fold deficit at the hull passes
  0.35 (full at 0.55, `SEA_STRIKE_START`; the surface draws its whitecap
  from 0.40, and the deficit at the 1.03 R circle peaks at 0.45 to 0.55
  when a drawn crest runs into the hull) a pile at twice full out to 1.5 m
  on the up-wave face, three radial deposits (`GATHER_DEPOSIT`). The draw
  is near-solid where the foam is dense: coverage 0.70 to 0.22 on the foam
  to the 0.7 (0.72 to 0.38 before), the grain half the 20 cm suds, a 12 cm
  middle and a fifth of the 7 cm fine.
  *The ring takes the sea on the GPU.* Until round 11 every ring vertex was
  a sampler slot (560 of 840) and the ring reached 3.2 R. Each vertex now
  finds its own surface point in the vertex stage: the probe's fixed-point
  loop on the fine sea's horizontal displacement, G <- P - D(G).xz, four
  iterations from the exact buffers, then the fine patch's own formula once
  at that grid point (`patchSurfaceAt`: the coarse cell, the fine sea, their
  blend and the mound), so the vertex lands on the drawn surface at its own
  world XZ, the radial coordinate stays true at the hull, and beyond the
  fine zone the ring lies on the coarse mesh's own triangles instead of
  under them (there the coarse XZ differs from the fine by centimeters,
  which only moves where a trail vertex lands; the foam is read at the
  landing point). The lift and the view-ray nudge are as before. The ring
  has 17 circles to 5.3 R (4.5 m) for the trail (a first pass at 6.2 R cost
  0.35 ms of draw, the transparent area under a five-noise fragment shader;
  the counted trail ends by 4.3 R); the CPU samples one circle of 40 points
  at 1.03 R for the per-angle state (the hull reads), and the sampler holds
  320 slots. The patch's own pixels did not move (it calls the same formula
  with the ocean's vertex stage as its fine sea).
  *The wash at the steel.* The impact gates are 0.15 to 0.9 m/s (0.45 to
  1.3): a flared float in a 0.5 m/s flow on a 1.4 m chop slaps every wave
  with its rim, and the reference's base carries broken water in every
  still. The ring's threshold on the state is 0.18 to 0.65 (0.20 to 0.75; a
  first pass at 0.08 drew the cling over 260 degrees of the rim, s12b922f),
  its cling reaches 0.95 radial units (46 cm, 8 pixels at the far pose;
  0.55 before) at a coverage of 0.25 at the steel and 0.6 plus 0.3 of the
  state in brightness. The skirt's band is 4 plus 30 cm tall, dense at the
  water (coverage 0.30), gated on the state from 0.18 to 0.50 instead of on
  the 6 cm run-up. The per-angle state's memory is 0.5 s (1.1): the
  relative flow's heading turns 15 degrees per 0.2 s across the window, so
  1.1 s smeared the struck arc 80 degrees round the rim; the field carries
  the memory in the water now.
  *The splash burst* (`stepBurst`): a pool of 2,048 drops thrown from the
  rim where the strike drive (the whitecap on the up-wave face, the water
  rising against the rim, or a flow into it over 0.8 m/s) passes 0.35, at
  250 a second per segment at full strike, scaled by the strike to the
  1.5 power, upward at up to 4 m/s (a throw of 0.8 m, the height of the
  reference's spray at its base, t0048.85), with the drag time of the spray
  piece's millimeter drop (0.30 s) toward the air, life 0.35 to 0.8 s, as
  clumps 8 to 16 cm across (a slam jet's, not single drops). They are
  stepped in the fixed step with a seeded generator, reset at every pinned
  start, so a strip replays them, and drawn as one mesh of camera-facing
  quads with a two-pixel floor (the light conserved by the size ratio
  squared, floor 0.6). On the counted window 68 to 93 are in the air across
  f00 to f06 (the crest's strike at f00 and the plunge of f04 to f06), none
  from f09. A first pass drew 12 cm clumps half transparent and dragged
  them toward ten times the film's drift: at the near pose they read as
  grey bubbles floating off to leeward (s12c922n); the drops are 5 to 10 cm,
  opaque, and feel three times the film's drift, the log profile's third of
  the 10 m wind in the first half meter over the sea.
  On the counted far strip (s12d922f, the round-8 window 92.2, the same
  pose, crop and sun): white water at the hull in all six counted frames,
  at the critic's scale and at the reference's pixel count
  (`criticStripEq.py`), heaviest on the downwind side and streaming off it
  one to two hull widths, the whitecap of f00 banked white on the crest
  side with the trail on the other, the flare bare above the wash at f00
  (27 cm clear on the crest) and the wash at the rim by f06 (+14 cm), so
  the heave up on the crest and the settle into the trough read against
  the wash. Still open: the trail is one to two hull widths long where the
  reference's runs three to four; the drops do not resolve at the far pose
  (two pixels) and read only as a ragged top on the wash.
- **Cost after round 12: 0.2 ms of live frame, 0.28 ms of draw**
  (`cost-abeam12b.json`, `buoyCost.mjs 5 abeam abeam12b`, five paired
  rounds with the foam builder's sweep on the GPU throughout, the B page's
  compute 0.36 to 0.37 ms on rounds 1, 2, 3 and 5; round 4 is a burst on
  both pages, 0.46, and is void). Clean rounds: the piece adds 0.1 to 0.3
  ms to the live frame (median 0.2; 1.9 against 1.7), 0.24 to 0.36 ms to
  the GPU draw (median 0.28; 1.71 against 1.43), 0.24 to 0.34 ms to the
  bench's whole frame and 0.23 ms of main-thread update (the physics, the
  probe dispatch and readback, the 36,864-cell foam byte copy and the
  burst's 8,192 vertices); the in-page hide of its objects 0.19 to 0.26 ms
  of draw (median 0.21). Against round 11 (0.10 live, 0.17 draw) the round
  costs 0.1 ms, and it is the ring: its transparent area went from 3.2 R
  to 5.3 R under a five-noise fragment shader (a first pass at 6.2 R read
  0.35 of draw and 0.30 of live frame, `cost-abeam12.json`, five clean
  rounds at 0.36), while the sampler lost 520 slots. The live path
  (`liveCheck.mjs`, `live/live12.log`): 287 fixed steps in 287 frames with
  287 readbacks, no capped frame, the sample age at most 18 ms, the
  carry-forward's prediction 0.2 cm rms, and the ring reading the sea the
  frame draws instead of a carried-forward height. Its three 4.8 s windows
  read the waterline against the water at each sample's own time at 42, 7.5
  and 31 cm rms (round 8's: 8, 17 and 9), and `liveKick.mjs` (two runs)
  finds why: near sea times 21 and 24 to 26 s and again at 31.5 s the near
  body leans 26 to 40 degrees and stands 0.6 to 1.0 m off the surface mean,
  with the raw kinematic water acceleration at 24 m/s^2 (the step clamps
  it at 0.75 g). The PINNED path does the same at the same times
  (`pinnedKick.mjs`, from rest at 15 s: 25 degrees and 96 cm at 20.4 to
  24.7 s), so it is the sea and the rounds-9-to-11 physics at a steep crest
  (a launch off it, and a parcel jump in the Lagrangian differences there),
  not the live path and not this round's change; the counted window at
  92 s never reaches it (43 cm at most over its last 12 s). OPEN, for the
  next round: find what the differences see at those crests (a fold at a
  probe, or the inversion oscillating beside one) and bound it before the
  clamp does.

- **Round 13: a collar, not a stamp.** After the sea's center began to
  follow the camera, and the buoy's patch and probe with it, the counted
  strip (s13j: the waterline error 10.9 cm rms, 29.5 at most) split its
  judges (round 14: ours won side A and lost side B, both medium). Both
  named the wash: "one oversized soft white stamp, three to four hull
  widths across, that slides well off to the left of the hull", "a large,
  hard-edged, flat oval ... It should be a thin, broken ring that hugs the
  waterline all around the hull". Round 12's strip had the same fault
  (the lead's check). Measured at the far pose (5.7 cm a pixel, a 13 degree
  look-down) it has three causes: the foam field was drawn near-solid
  (coverage 0.22 at full), so the patch's outline was the field's smooth
  bilinear contour cut by one threshold; flat foam at 13 degrees is
  squashed 4.4 times, so a patch 1.5 m deep and 3 m wide draws as a flat
  oval; and the field, one velocity for all its cells, carried the foam
  laid on the struck face straight under the hull and out behind it as a
  patch the hull's width. Four changes, each behind a switch in `buoys.ts`
  (`R13_DEFAULT_ON`: `?buoyR13=0` turns every switch off at load, the
  probe's `setR13` one at a time), and one fix. With all of them off the
  strip is s13j to the pixel (b13off: 0 pixels over 8/255 in all twelve
  frames, at most 1/255; the same trace and waterline error).
  *Foam cannot pass under the hull* (`block`, `blockField`): each fixed
  step the field's cells inside 0.95 of the waterline radius are emptied
  and what they held is laid on the flank on its own side of the
  centerline, seen along the foam's motion relative to the hull (the
  relative flow plus the drift), 10 cm outside the steel in three deposits
  from 15 cm upstream to 25 cm downstream: the two lines of foam a floating
  object in a current trails from its flanks, with a darker lee between
  them. About 200 cells a step; the CPU cost does not show (0.03 ms).
  *The trail is broken streaks* (`trail`, `fieldLaceT`): a grain streaked
  along the wind (`sudsNoise(3)`; the 7 cm grain at a tenth, since at the
  far pose it drew single white pixels like glitter), its threshold from
  0.58 at a trace of foam to 0.47 at full over a 0.04 ramp, at most 0.85
  white. A first pass at 0.82 to 0.52 drew nothing under full foam (the
  grain's spread is near 0.07), which hid the trail entirely (u13a).
  *The collar* (`collar`, `collarFoam`, in place of round 12's cling and
  rim line): a band on the ring from the steel out to 22 cm plus 40 cm by
  the struck state (its ramp 0.05 to 0.40; on the counted window the state
  peaks at 0.25 to 0.39) plus 25 cm by a new per-angle AGITATION (the
  water rising or falling on the steel, the flow sliding past it, the flow
  into it, held 0.3 s, under the strip's 0.4 s between counted frames),
  its edge ragged by half its width, broken into lumps about 25 cm long
  (about half of a quiet arc white) by a noise in the water's coordinate
  that boils 3.4 times faster than the suds, so the lumps are new ones in
  the next counted frame. On the steel the skirt's broken lace takes a
  floor of 0.35 plus 0.45 of the agitation (0.15 before), because on the
  hull's near side the flat collar is squashed to a pixel. At the far pose
  the collar is 4 pixels at the flanks and one to four under the hull. Two
  of my passes went too far, one each way: 7 cm plus 26 cm drew a thin line
  under the hull and the base no longer read as in the water (u13a,
  l13c); 25 cm plus 45 cm with 65% white drew a solid white crescent
  under the hull, the "clean arc" of the round-14 judge (l13k, r13a f06).
  *The roll* (`roll`, `R13_PITCH_DRAG_SCALE` 0.6, 18% of critical): "the
  roll is nearly frozen at one left lean through frames 1 to 4". What
  holds the lean is the MOORING: the waves' mean force carries the hull 2
  to 2.7 m from its anchor through the window, the line (2 m of slack,
  then 15 kN/m at the tail's foot, 2.45 m under the center of mass) is
  taut at 92.2 s (2.65 m), and the buoy leans away from the pull until its
  foot is near the slack circle: 13 degrees; the lean then decays as fast
  as the roll damping lets it, 12.0 to 2.0 degrees on screen over the
  window. Pinned sweeps of the same window: roll drag 1.0, 0.7, 0.6, 0.5
  gave 12.0 to 2.0, 15.2 to 1.6, 16.7 to -1.3 and 18.3 to -2.7 degrees,
  the waterline error 10.9, 11.4, 11.8 and 12.1 cm rms; heave drag 0.6 and
  1.6 moved the error to 13.9 and 10.0 cm with the roll unchanged; 3 m or
  4 m of slack, or a fifth of the stiffness, only let the hull drift 2 m
  farther onto another patch of sea (16.8 to 17.4 cm rms, swamps of -53 to
  -59 cm), so the line stays. 0.6 is the least drag at which the roll
  crosses upright in the window, smoothly (no reversal, 3 to 4 degrees a
  counted frame).
  *A pinned run reads the camera it is shot from* (a fix, not a switch):
  `runFixed` sets the surface's and the probe's center from the camera at
  every call. Only the viewer's frame loop moved them before, so a run
  started in the same task as `setPose` stepped the bodies on the sea
  about the old camera (5 cm of swamp and 6 degrees of tilt apart at 93 s
  between two scripts). `shootStrip.mjs` waits for frames after the pose,
  so it did not change (b13off above).
  On the counted far strip (b13f, the same window, pose, crop and sun): a
  broken white collar round the base in f02 to f10, heaviest where the
  struck side faces the camera, streaks trailing off the left flank for
  two to three hull widths, no solid patch; the mast's on-screen lean
  16.7, 13.7, 10.5, 7.2, 3.1, -1.3 degrees over the counted frames; the
  water on the hull -33, -13, +6, +15, +13, -3 cm; the hull's bob 7.3 px
  rms with 2 reversals against the water's 4.4 px (`bobMeasure.py`); the
  waterline error 11.8 cm rms, 34.1 at most (s13j: 10.9 and 29.5). Still
  open: f00 rides a crest 33 cm clear with the flare bare (27 cm in s13j;
  the larger lean lifts it); the collar is at most one pixel under the
  hull where the side facing the camera is quiet; and the buoy leans on a
  crude line (a hard stop 2 m out, where a chain's catenary pulls
  gradually).
- **Cost after round 13: 0.4 ms of live frame, 0.41 ms of draw**
  (`cost-abeam13.json`, `benchBuoyCost13.mjs 5 abeam abeam13`, a copy of
  `buoyCost.mjs` named so other builders' GPU gates see it; five paired
  rounds, the B page's compute 0.35 ms throughout, no burst). The B page
  is now `extras=underwater`, since the underwater piece mounts on every
  page that names any piece. The piece adds 0.3 to 0.4 ms to the live
  frame (2.1 against 1.7), 0.39 to 0.42 ms to the draw (1.87 against
  1.46), 0.35 to 0.40 ms to the bench's whole frame and 0.35 ms of CPU;
  the in-page hide is void this run (-0.2 to 0.5 ms). Against round 12's
  0.28 ms of draw (another hour, and a B page without the underwater
  piece) that is about 0.13 ms more; the round's only new GPU work is the
  collar's two noises and the trail's streak noise in the ring's fragment
  stage. The switches
  on against off in one A/B (`abeam13r`, both pages mounting the buoys)
  read 0.00 ms of draw and -0.01 of total: a mix at 0 still runs both
  branches, so the off value pays the new noises too.
- **Round 14: foam as an event, and a crest that pushes.** Round 13's
  strip (b13f) lost both orders (medium, high): "the same even, bright
  white foam collar at its base while the chop passes", "the same flat,
  bright white foam patch in all six frames ... no crest ever rises against
  the hull or washes over it", "the tilt has no visible cause", "no heave".
  The judges praised the reference's EVENT: a breaking crest runs in and
  reaches the hull, the hull rides high with its round bottom showing, dips,
  leans hard as the crest washes across its base, and wash clings after.
  Three switches in `buoys.ts` (`R14_DEFAULT_ON`: `?buoyR14=0` turns them
  off at load, the probe's `setR14` one at a time); with all three off the
  strip is b13f to the pixel (d14off: 0 pixels over 8/255 in all twelve
  frames, at most 1/255; the same trace and waterline error).
  *The event state* (`event`, `evState`): per world angle round the hull,
  the most of the water rising on the rim (0.10 to 0.50 m/s), the run-up
  (3 to 20 cm) and a whitecap at the hull on the strike ramp (weighted to
  the up-wave face), held 0.35 s, and drained with 0.15 s where the water
  falls away from the rim faster than 0.15 m/s. The ring's collar is 3 cm
  plus 55 cm of it, its share of white from a few flecks to two thirds;
  the white on the steel climbs 3 cm plus 40 cm of it; the lace is 0.10
  plus 0.85 of it. Every foam white is dimmer: (0.66, 0.72, 0.76) at 0.75
  cover on the ring (0.90 at 0.9 before, about 230 of 255 after the tone
  map, brighter than the sea's own whitecaps), (0.68, 0.73, 0.77) on the
  steel, (0.70, 0.75, 0.79) for the splash drops; the trail is a third
  fainter. *The trail in pulses* (`eventField`): the ordinary flow's wake
  deposit is 0.15 plus 0.85 of the event at its angle. *The breaker's push*
  (`breaker`, `BREAKER_PUSH_CD`): where the whitecap signal at the hull
  passes the strike ramp, its roller's water runs into the up-wave face at
  `BREAKER_SPEED_FRACTION` of the phase speed (1.8 m/s), which the FFT's
  linear parcels never reach; F = 1/2 rho Cd D h u^2 along the waves'
  travel at the up-wave waterline, Cd 1.2, D 1.7 m, h 0.30 m at a full
  strike, u less the hull's own speed along the travel. It enters the step
  through a new optional force on `ProbeWater` (`external`,
  `oceanBuoyancy.ts`: absent or null leaves the step bit for bit, two new
  tests), so the 6 x 6 mass matrix sees it. At a full strike on a hull at
  rest it is 1.1 kN at 1.65 m over the center of mass, a static lean of 6
  degrees.
  *The judged window has no crest at the hull.* A long pinned run at the
  far pose (27 to 160 s, `sweepWindow14.mjs`, with a new per-step event
  trace from `runFixed`) scored 550 two-second windows by the reference's
  event. At T0 92.2 the whitecap signal at the hull peaks at 0.23 (the
  surface whitecaps from 0.40), the run-up at 6 cm and the lean against
  the on-screen tilt of the wave face under the hull correlates at 0.04:
  the lean there is the mooring's (round 13). The best window is T0 52.0:
  a crest's whitecap reaches the hull in frames 4 and 5 (0.56, 0.58), the
  run-up is 30 cm at frame 4, the hull heaves 1.4 m up the crest, the push
  is 1.9 to 2.3 kN in frames 4 and 5, a thousand splash drops fly, and the
  lean follows the wave face (correlation 0.96; -6.7, -6.3, -3.4, -2.9,
  -7.9, -13.1 degrees on screen; with the three switches off the same
  window gives 0.18, the lean -9.1 to 7.1 degrees, d14woff). It is
  PROPOSED to the lead, not taken: the judged window stays 92.2.
  Strips (same pose, crop and sun): d14f at 92.2 (the collar at the rising
  water of f00 to f04, the base nearly bare as the water falls in f06 to
  f10; lean 12.9 to -1.6 degrees; the waterline error 12.3 cm rms, 34.6 at
  most) and d14w at 52.0 (the crest's foam washing round the base from
  frame 3, drops over the float's near face, the hull showing its round
  bottom in frame 1 as the reference's does in its frame 3; the error over
  the run's last 12 s 24.8 cm rms, 77.8 at most, because 40 to 54 s holds
  steeper crests than 80 to 94 s). With no buoy the five judged scenes
  are unchanged by this round: open, storm, shallow and under 0 pixels
  against the round-13 shots (b13 against b14); the wake scene moved on
  5.5% of its pixels between the two, from the wake builder's and the
  lead's saves of `oceanWake*.ts` and `oceanSurface.ts` in between (the
  wake page does not mount the buoys, and only the buoy mount imports
  `oceanBuoyancy.ts`). Still open: in the judged window the
  lean still has no visible cause and the hull still rides 30 cm clear in
  f00; the splash drops at the far pose draw as white speckles on the
  float rather than a sheet of white water; no wet band shows above the
  waterline at the far pose (the wet mark is 0.34 of the paint).
- **Cost after round 14: 0.4 ms of live frame, 0.39 ms of draw**
  (`cost-abeam14.log`, `benchBuoyCost13.mjs 5 abeam abeam14`, five paired
  rounds, the B page `extras=underwater`, the B page's compute
  0.34 to 0.35 ms): 0.40 ms of the bench's whole
  frame and 0.34 ms of CPU. The round's own GPU work is three event
  reads in the ring and the skirt; the push and the event state are a few
  microseconds of CPU a step.
- **Round 15: a lighter tower, and wash that is not a plate.** The lead
  took the proposed window: the judged strip is T0 52.0 s since round 15.
  Its round-14 strip (d14w) split its judges: side B won ("water that cuts
  across the lower hull ... clear rolls from frame to frame that line up
  with the crests passing under it"), side A lost ("in all six frames our
  tower points nearly straight up ... It should roll and pitch by about 5
  to 15 degrees in changing directions, following the local wave slope
  with a slight lag"), and both named "an oversized flat white patch that
  hides the whole base" in frames 4 and 5. Five switches in `buoys.ts`
  (`R15_DEFAULT_ON`: `?buoyR15=0` turns them off at load; `setR15` turns
  the look switches in the page); with all off the strip is d14w to the
  pixel (e15off: 0 pixels over 8/255 in all twelve frames, at most 1/255).
  *What the white patch was* (`overlay15.jpg`, each overlay hidden at the
  strike frames): the white over the float's near face was the splash
  drops, a thousand of them at the two-pixel floor with round 12's 0.6
  light floor drawn as one plate; the white spreading several hull widths
  in front of the hull is the SEA's own whitecap on the crest, drawn by the
  surface, which is there with every buoy overlay hidden.
  *The roll* (`top`, load only, `R15_TOP_KG`): the water under the hull
  runs at 3.4 s in this window, and round 9's 4.8 s roll (750 kg on the
  tower) is above that resonance: the lean lagged the face by more than 90
  degrees at half its size and read as upright on screen, because most of
  the tilt was toward the camera. With the mass budget re-balanced
  (`periodTop15.ts`: 750, 450, 350, 250, 176 kg give 4.79, 3.77, 3.50,
  3.26, 3.09 s), the pinned sweep of the window read the on-screen lean
  against the on-screen tilt of the face under the hull; only 250 and 176
  kg roll through upright with the crest (10 to 21 degrees a swing), and
  176 kg follows best (correlation 0.81). 176 kg is the rounds-3-to-8
  tower; the rest is hull-bottom ballast (center of mass 1.76 m under the
  waterline, GM 1.17 m). On the strip (e15a) the lean on screen is -11.4,
  -8.3, -0.6, 9.8, 7.5, -3.3 degrees, and its part across the screen
  (world z) trails the face's by 0.2 to 0.4 s (over the counted frames the
  face's z tilt 7.8, 2.8, -9.3, -18.3, -10.8, 14.6 degrees, the lean's
  11.2, 8.0, 0.5, -8.7, -6.8, 3.2).
  *The spray* (`spray`): each drop keeps its own light, (size / drawn
  size) squared with a floor of 0.12 at 0.8, so a burst is a broken, partly
  clear spray over the float. *The collar in streaks* (`streak`): its lumps
  come from a noise stretched 3.3 times along the water's flow past the
  hull, and its widest reach is 45 cm (58). *The wet band* (`wet`): the
  band the water leaves on the steel is drawn at 0.62 (0.34) with its
  film's sky sheen 1.6 times as bright, and water drains down it in thin
  streaks a third of its area. *The water darker at the hull* (`contact`):
  the ring darkens the water next to the steel all round, 0.14 at the
  steel, gone by 0.5 m, broken by the suds, for the sky the hull hides
  from the water column there; rounds 4 and 5 drew an even 0.35 ring and
  judges read a contact shadow.
  On the counted strip (e15a): a broken white collar at the base in
  frames 1 to 3 as the water climbs, the crest's own whitecap beside the
  hull in frames 4 and 5 with the float's base dark and broken white, the
  foam trailing in frame 6; the water on the hull -14, -17, -14, -11, -14,
  -28 cm (d14w: -12, -11, -2, -1, -14, -38); the hull bobs 6.6 px rms; the
  waterline error over the run's last 12 s 26.9 cm rms, 85.1 at most (d14w
  24.8 and 77.8: the lighter tower's hull moves more against the steep
  crests of 42 to 54 s). Still open: the sea's own whitecap in frames 4
  and 5 is a flat, bright patch drawn by the surface (it is not the
  buoy's); the hull rides 11 to 28 cm high through the window; the drops
  still read as white speckles on the float at the far pose.
- **Cost after round 15: 0.4 ms of live frame, 0.42 ms of draw**
  (`cost-abeam15.log`, `benchBuoyCost13.mjs 5 abeam abeam15`, five paired
  rounds against `extras=underwater`, the B page's compute
  0.34 to 0.36 ms): 0.39 ms of the bench's whole frame and
  0.34 ms of CPU. The round adds two noises (the collar's flow streak and
  the drain) and one smoothstep product (the darker water).
- **Round 16: a lean that reads, and splashes only where the water hits.**
  Round 15's strip (e15a) split its judges again (side A lost, side B won,
  both medium). Both named two faults: the tower "stays close to vertical
  for chop that heavy" (the losing one: "It should rise on the crest, tilt
  10 to 20 degrees with the crest's slope, drop into the trough and swing
  back past vertical"), and "a bright, near-constant white blob stuck to
  the base (clearest in frames 2, 3 and 6) that looks painted on". Five
  switches in `buoys.ts` (`R16_DEFAULT_ON`: `?buoyR16=0` turns them off at
  load, `setR16` one at a time); with all off the strip is e15a to the
  pixel (f16off: 0 pixels over 8/255 in all twelve frames, at most 1/255).
  *What the blob was* (`overlay16.jpg`, each overlay hidden in frames 2, 3
  and 6): the splash drops, 1,250 to 1,630 in the air. They flew wherever
  the water rose against the rim faster than 0.12 m/s or ran into it
  faster than 0.8 m/s, and with round 15's lighter tower the waterline
  sweeps through the water at 1.5 to 1.9 m/s in counted frames 1 to 4 (the
  roll alone, 20 degrees at 3.1 s and 1.76 m from the center of mass, is
  1.2 m/s). *The splash* (`burst`, `R16_BURST_RISE_START`): the rise drives
  the drops from 0.6 m/s (full at 1.4), the flow into the hull from 1.2
  (full at 2.2), at 0.4 of the rate; a crest striking the hull keeps the
  full rate. 11 to 170 drops are in the air over the counted frames.
  *Why the tower read upright*: of round 15's 18 to 21 degrees of tilt at
  the crest, most leaned toward the camera; the part across the view peaked
  at 9.8 degrees, and the reference's buoy leans about 16 as its crest
  arrives (`leanRef2.py`). *The roll drag* (`roll`, `R16_PITCH_DRAG_SCALE`
  0.6, about 11% of critical) and *the mooring* (`moor`,
  `R16_MOOR_STIFF_SCALE` 0.3: 4.5 kN/m beyond the 2 m of slack, a stand-in
  for a chain's catenary; GG-318 stays open), from a pinned sweep of the
  window (`sweepWindow14.mjs`): the on-screen lean over the counted frames
  -12.4, -9.9, -0.9, 13.5, 18.9, 8.2 degrees (e15a: -11.4, -8.3, -0.6, 9.8,
  7.5, -3.3) against a face of -8, -3, +9, +19, +13, -14, so the lean peaks
  one counted frame after the face and swings back toward vertical as the
  trough arrives; a push of the breaker two to eight times as strong
  carried the hull to the mooring's stop before the window and held the
  lean one way, so the push stays as round 14 set it.
  *The collar* (`collar`): the collar, the white on the steel and the lace
  come from a stricter event (`ev16State`: a rise from 0.25 m/s full at
  0.8, a run-up from 10 cm full at 30, the strike; held 0.25 s, drained
  with 0.12 s), the collar at most half white and 34 cm wide, the white on
  the steel only along the top 6 cm of the water that climbs it, the trail
  a third fainter again. *The darker water* (`contact`): 0.26 at the steel
  out to 0.8 m, and the float's shadow away from the sun, 0.28 out to
  1.4 m.
  On the counted strip (f16f): the base in darker water with a broken edge
  of white where the water climbs (frames 1 to 3), the hull leaning 13 and
  19 degrees across the view as the crest passes (frames 4 and 5) and
  coming back as it drops into the trough; the water on the hull -18, -24,
  -17, -13, -18, -33 cm; the hull bobs 5.9 px rms; the waterline error
  over the run's last 12 s 29.4 cm rms, 89.4 at most (e15a: 26.9 and 85.1),
  because the hull rolls and moves more against the water. Still open: the
  hull still rides 13 to 33 cm high; with the splash cut, the wash at the
  base as the crest strikes is thin (the side-B judge of round 17 praised
  "a white wash wrapped around the base"); the sea's own whitecap in frames
  4 and 5 is routed separately.
- **Cost after round 16: 0.4 ms of live frame, 0.42 ms of draw**
  (`cost-abeam16.log`, `benchBuoyCost13.mjs 5 abeam abeam16`, five paired
  rounds against `extras=underwater`, the B page's compute
  0.34 to 0.35 ms): 0.40 ms of the bench's whole frame and
  0.33 ms of CPU. The round's new GPU work is two smoothstep products in the
  ring and one in the skirt; fewer splash drops fly.

`?contact=1` also feeds the near waterline into the surface's own contact
foam (GG-274, `surface.setContact`) at the breaking sheet's strength; it is
a trial, off by default.

Pinned runs repeat bit for bit within one page (five 6,816-step runs, and
a second read of every step, agreed). On the shared dev server another
builder's edit hot-updates the page mid-run; `shootStrip.mjs` lists every
hot update it saw next to its repeat proof, so a DIFFERS can be traced.

## Shading and sky

Read `oceanSurface.ts` from the `shade` function and `oceanSky.ts` from
`oceanSkyRadiance`; every constant named here carries its measurement in the
file. The judged frame is the `open-horizon` pose of
`.agent/scratch/ocean-gauntlet/shootOurs.mjs`, cropped to 540 x 900 against
`ref/demo/orbit-away.png`.

- **One sky, two uses.** The background and every reflected ray call
  `oceanSkyRadiance`. The clear sky (distance rounds 1 and 2) is a blue that
  rises from (152, 173, 195) sRGB at the horizon to (124, 154, 187) at 19
  degrees, a blue-white glow ((180, 190, 200), e-folding over 2.9 degrees),
  and under it a haze band (e-folding over 2.9 degrees) that greys the sky by
  up to 55% toward its own luminance and dims it by up to 30%. Round 1 put
  the glow's peak ON the line, and critics in both pair orders read it as "a
  thin bright white line across the whole horizon, a seam"; with the band the
  brightness no longer climbs to the line (169, 168, 166 sRGB luma at 80, 40
  and 0 rows above it at the judged pose, against 170, 175, 186 in round 1),
  the water under it runs 162, 159, 157 at 1, 2 and 4 rows, and the line is
  the least saturated part of the sky (11). Rounds 1 to 4 of the shading
  piece drew a flat grey band with a hard top there ("a fog wall"); a band
  1.1 degrees tall read as a thin grey strip. The band's terms are shared
  uniforms (`OCEAN_SKY_TUNE`); a change needs a re-bake for the far clouds'
  air. Distant cumulus fade over 8 km of air (5 km before), so the cloud field
  thins toward the horizon and does not end on one line.
  Distance round 3 darkens the band into the line (`SKY_BAND_DIM` 0.38,
  `SKY_BAND_K` 0.035, 2.0 degrees): 169, 166 and 157 luma at 60, 20 and 0
  rows above the line (round 2: 168, 168 and 166; the reference 175, 159
  and 153). The round-2 judge with ours as image A read the flat band as
  "a flat gray-beige haze band with a hard, straight bottom edge". Under
  the storm deck the band does not show; the storm frames did not change.
  Distance round 4 gives the band a flat foot and a cooler line. Both
  round-3 judges named "a tan-brown haze stripe directly on the horizon"
  that "reads as smog": the band fell 9 luma over its last 20 rows and the
  line was its greyest row. The dim is now exp(-(up / K)^2) with K 0.034
  (`SKY_BAND_FOOT`, `skyBandFoot`; flat at the line, steepest 1.4 degrees
  up), and the grey spreads 1.6 times higher (`SKY_GREY_K_MUL`) at 0.45
  (0.55 before): 173, 171, 165, 160, 157 and 157 luma at 60, 45, 30, 20, 10
  and 2 rows over the line (round 3: 169, 169, 168, 166, 162, 157; the
  reference 176, 172, 166, 160, 154, 154), and at the line saturation 14,
  red over blue -14, blue over green +8 (round 3: 11, -11, +6; the
  reference 16, -16, +9). The band is a mix of the two arguments, not a
  pow(), for the cost.
  Distance round 5 makes the haze thin and bright. Both round-4 judges
  named "a tall, flat, dull gray band ... about the lower 40 percent of the
  sky ... a dirty fog wall"; it should be "a thinner, brighter haze that
  starts pale ... and grades smoothly into the blue sky". Round 4's band
  was darker than the sky over it and bluer than the reference's
  (saturation 19 to 28 at 20 to 60 rows over the line, the reference 9 to
  13). The reference's low sky is a thin, cool, darker foot, then a pale,
  near-neutral haze that is the brightest part of the low sky, then the
  blue. Now the glow is a pale near-neutral (`SKY_GLOW_R5`, `skyGlowTint`)
  that e-folds over 4.7 degrees (`skyGlowK` 0.0829), the band does not dim
  (`skyBandDim` 0) but mixes toward a cool line color (`SKY_FOOT`,
  `skyFootTint`) on its flat-footed profile (`skyBandK` 0.0353), and the
  grey greys the line more and spreads less high (`skyBandGrey` 0.9,
  `skyGreyKMul` 1.3). The values are a least-squares fit of a CPU copy of
  the gradient (through the ACES fit and the sRGB encode,
  `distance5/skyfit.py`) to the reference's 10-row bands of luma,
  saturation and green minus blue. At the judged pose, 0 to 120 rows over
  the line in bands of ten (`distance5/sky5.py`; ours, the reference):

  | rows over the line | luma | saturation | luma change a row (up) |
  |---|---|---|---|
  | 0-10 | 153.6, 153.9 | 14.7, 15.3 | +0.16, -0.02 |
  | 10-20 | 157.3, 156.3 | 12.9, 13.2 | +0.54, +0.62 |
  | 20-30 | 163.4, 163.3 | 10.5, 9.7 | +0.61, +0.63 |
  | 30-40 | 168.9, 168.6 | 10.0, 8.8 | +0.47, +0.43 |
  | 40-50 | 172.6, 172.2 | 11.8, 9.9 | +0.28, +0.30 |
  | 50-60 | 174.6, 174.6 | 15.3, 13.3 | +0.10, +0.19 |
  | 60-80 | 176.1, 176.5 | 20.6, 19.8 | +0.08, +0.11 |
  | 80-120 | 176.6, 177.0 | 27.1, 25.0 | +0.02, -0.10 |

  Round 4 ran 156.9 to 174.9 luma with its saturation rising from 14 to 36
  all the way up. The flat band (the rows whose luma changes by under 0.3 a
  row with a saturation under 20) is 33 rows, the longest run 24 rows, 43 to
  66 rows over the line: the pale plateau (the reference 36 and 25, 44 to 68;
  round 4's 14-row run was its dark foot, 0 to 13). The far clouds fade into
  the new gradient in the bake, so their bases are pale. The sky part of the
  shading crop moves on 4.8% of its pixels, by at most 10 grey levels.
  Distance round 6 fades the clouds into the haze. Both round-5 distance
  judges still named the low sky ("a thick, flat, muddy mauve-gray wall",
  "a tall, flat brown-gray wall", "the haze band has a hard upper edge where
  the clouds stop"), although its luma matched the reference's band by band
  and its hue does too (red minus blue -14.7, -12.9, -10.5 and -10.0 at 0 to
  40 rows over the line, the reference -15.3, -13.2, -9.7 and -8.8; green
  minus blue -8.8 to -3.1 against -8.6 to -3.2). The fault was the clouds:
  twice the reference's contrast at every elevation over 6 degrees, standing
  as a row of crisp domes on one base line about 80 rows over the line. Each
  cloud read now mixes from a HAZE COPY (the reflection copy blurred along the
  azimuth, a tent 8 degrees to each side, built once in the bake) toward the
  sharp read by k(up) = mix(0.4, 1, smoothstep(0.03, 0.35, up)): 0.41 of the
  clouds' structure at 3 degrees, 0.48 at 6, 0.66 at 10, all of it from 20.
  The veil a cloud band adds at each elevation stays, so the band's luma moves
  by under 1.5 and round 5's fitted gradient holds. The blurred (7 x 7) row sd
  and the 98th luma percentile over the median, in 20-row bands at the judged
  pose (ours, the reference, round 5):

  | rows over the line | row sd | p98 - p50 |
  |---|---|---|
  | 80-100 | 2.0, 3.3, 3.4 | 4.5, 7.4, 7.8 |
  | 100-120 | 4.3, 3.6, 6.9 | 11.1, 9.4, 16.6 |
  | 120-140 | 5.4, 4.9, 9.6 | 13.2, 11.8, 21.2 |
  | 140-160 | 8.2, 7.2, 12.2 | 19.7, 16.9, 31.7 |
  | 160-180 | 7.5, 7.6, 10.8 | 20.8, 16.8, 29.4 |
  | 180-300 | 13 to 23, 6 to 13, 16 to 26 | 22 to 51, 17 to 35, 24 to 60 |

  The upper sky (the shading crop's clouds, 11 to 19 degrees) keeps most of
  its contrast on purpose; the reference's there is still half ours. Under
  60 rows the reference keeps a faint structure (row sd about 3, a veil and
  its dither) where ours is smooth (under 1). `skyCloudFade` 0 is round 5.
- **Clouds are baked.** `OceanSky.bake(renderer)` runs once before the first
  frame: a 2048^2 coverage map (Worley cells plus fBm), a CPU-built 64^3
  billow volume (`cloudPuffVolume`, tested), then a density march of 320
  steps per texel into a 4096 x 1024 half-float texture (square-root
  elevation rows), and a 4x4 box copy the water reflects. The viewer fails
  the page if the bake throws. `OceanSky.cloudTune` re-bakes with new values
  for a sweep.
- **The normal.** Four anisotropic taps of the mip chain per cascade, the
  level from the short footprint axis capped at a quarter of the long one.
  The shading stretches each cascade's `normalLod` three times
  (`NORMAL_RANGE_SCALE`) and gains the summed slope from 1 at 60 m to 2.5 at
  400 m (`FAR_SLOPE_GAIN`), because a footprint mean is flatter than the
  facets it averages.
- **Reflection.** Fresnel on a normal whose ripple share falls from 0.7 near
  the camera to none by 300 m, pulled all the way to the flat sea from 150 to
  900 m for the fresnel alone (0.8 by 2 km before). A ray that dips under the horizon returns the dark
  sea-self, weighted by the share of the facet the eye sees (GG-276); near
  the camera a ray under 0.1 returns 0.6 of the body's blue-green instead of
  the haze.
- **Sun.** One tight Beckmann lobe (the wide sheen lobe is gone). It sets the
  DENSITY of glitter points: one jittered point per world-space cell, the
  cell sized to about 8 pixels in octaves, lit with a probability that
  saturates in the lobe and is weighted 0.6 to 2.0 from trough to crest by
  the mesh height (GG-277, first step). Glints fade out from 50 to 130 m,
  where the reference has none.
- **Body.** Deep (0.006, 0.07, 0.10) seen at a slant, blue-green (0.03,
  0.14, 0.17) seen steeply, the deep color ramping to (0.04, 0.10, 0.18) by
  600 m; lit through the surface by the long waves' normal.
- **Foam.** The folding Jacobian of the steep cascades, plus contact foam
  from `setContact(i, x, z, radius, strength)`, eight slots, branch-skipped
  when none is live.
- **The far field (distance rounds 1 and 2).** A far pixel holds many
  unresolved facets (m, their RMS slope). The mean reflected ray climbs by
  0.35 m and the fresnel incidence opens by 0.2 m, and past 400 m the mean
  keeps a falling share of both, half by 2 km (`SHEEN_K`), because the
  texture below draws those facets one by one; the smooth water between
  returns the low sky as a pale sheen. The reflected sky is averaged over
  +-1.5 m of elevation, weighted by the unresolved share (`upSpread`). The
  reflected clouds fade out from 150 to 600 m. Round 1's soft residual (a
  noise 25 m by 300 m, 5 to 20 rows tall) read as "smooth winding stripes
  that do not shrink into fine chop"; round 2 draws the far texture as the
  reference does, sheen with dark, grainy patches:
  - every far term ramps in with the pixel's long footprint, 1 to 4 m
    (`FAR_GATE_LO_M`), so the plan view, whose far water is at 1 m
    footprints, keeps the waves it was judged with; none runs in the storm;
  - the far footprint is read finer across the view: past 100 to 250 m the
    mip level comes from a sixteenth of the long axis, not a quarter, and
    each of the four taps is jittered inside its quarter (one offset per tap
    per pixel-sized world cell), so the chop is not blurred across the view
    into long lines; the shading range of every cascade reaches three times
    its foam range (`FAR_RANGE_EXT`), the foam keeps the old one;
  - gust patches (`GUST_M`, 120 m across the wind, 2.5 times that along it,
    drifting at 6 m/s) take the ripple and chop slopes from 0.25 (a slick)
    to 1.6 (a cat's paw) past 120 to 300 m, and their unresolved variance
    by the square, so the far sea has smooth sheen and rough dark patches;
  - one-row dashes (`DASH_LEN_M`): a noise along each row of pixel-sized
    world cells, independent from row to row, so a crest far out is one row
    tall and 14 m wide and shrinks with range (12 px at 500 m, 3 px at
    3 km); the rows lie across each pixel's view ray (two world-aligned sets
    blended by the ray's heading), crowd under a 150 m envelope and in the
    rough gust patches, drift at the 15 m wave's group speed, and ramp in
    from 300 to 900 m; a dash lifts the reflected ray 0.3 and opens the
    fresnel 2.0;
  - a grain: one signed random slope per pixel-sized world cell, the
    unresolved RMS slope times (20 m / footprint)^0.5, from 250 to 600 m.
  They are statistical stand-ins, not a measurement (see Open). At the
  judged pose rows 0 to 10 under the horizon now carry a luma sd of 4 to 9
  (round 1: 3 to 5, reference 5 to 12) and rows 10 to 40 a saturation of 39
  to 48 (round 1: 44 to 51, reference 36 to 39). Cost: about 0.4 ms of draw
  at 1600 x 900 (medians of five alternated `bench(600)` runs, 4.54 against
  4.98 ms, under another process's GPU load).
- **The far texture is the sea's own roughness (distance round 3).** The
  round-2 judge with ours as image A named "the far ripples near the
  horizon look like grainy, speckled noise": the grain drew one-row bricks
  of light and dark from 250 m out, and the far taps' jitter added a salt
  across the view. Both are off (`farTex` 1, `farJitter` 0; the old path
  runs when `farTex` is 0). In their place:
  - the normal mip chain writes each cell's squared slope in the unused w
    of level 0 (ny floored at 0.2, capped at 4), and every coarser level
    averages it, so the four taps return the mean squared slope under the
    pixel for no extra fetch;
  - for each foam-driving cascade, that value over the patch's own mean (one
    fetch of the top level, `sampleTop`) is the local wave energy, 1 on
    average; its departure from 1, weighted by the cascade's slope variance,
    its under-resolved share (1 - fit for waves under 30 m; for the sea
    band 0.1 to 0.35 of its 30 m cutoff in long footprint, 220 to 420 m from
    the judged camera) and gust^2, goes to the dash channel (`farDash`,
    `FAR_TEX_K` 1.0), from 250 to 600 m with the far gate. Rough water opens
    the fresnel and lifts the ray (a dark patch), smooth water closes them
    (a pale sheen);
  - THE TEXTURE DOES NOT REPEAT WITH THE PATCH: the four taps' read is
    averaged with two single taps through coordinates turned by 31.7 and
    -57.3 degrees, and the departure takes back the spread with a gain of
    the square root of 3. Without them the 89 m and 421 m patches' energy
    maps drew a lattice of dark lines to the vanishing point from a 60 m and
    a 300 m camera.
  At the judged pose the rows 6 to 40 under the horizon now split as the
  reference's do: a sheen near 157 luma (the brightest fifth) and dark
  patches (the darkest fifth) of 134, 125 and 102 in the bands 6-10, 10-20
  and 20-40 (reference 160; 129, 105 and 100), luma sd 9, 13 and 21
  (reference 12, 20 and 22), saturation 27, 37 and 46 (reference 28, 36
  and 39). It evolves with
  the sea, where the round-2 noise only drifted. The keys are the footprint
  and the eye distance, as the mip read's are: the height, heading and pitch
  sweep (`distance3/sweep-g-*.png`) moves 3.6 to 4.4% of the pixels at every
  heading and pitch that shows far water (0 at 35 degrees down) and more with
  height as more of the frame is far water, with no tile lattice at any
  height. Cost: none measurable, a little under the round-2 path it
  replaces. Six alternated `bench(400)` runs of each in one page, the
  round-2 tune values against the new ones: the whole frame 2.365 against
  2.339 ms at `open-horizon` and 2.544 against 2.502 ms from 60 m (medians;
  the draw 1.922 against 1.895 and 2.111 against 2.075). The new reads (a
  top-level fetch and two turned taps for each of three cascades, only past
  250 m) cost less than the round-2 dashes' noise and the grain's hashes
  they skip.
- **The far sea calms where the footprint is long (distance round 4).**
  Round 3 lost in both orders on the last 15 to 30 px under the horizon: "a
  pale lavender-white band covered in bright white specks and dark dashes
  ... brighter than the sky right above it", "the water color jumps from
  teal to lavender-pink across only a few pixels", and the tan stripe above
  it (see One sky, two uses). Four changes in `oceanSurface.ts`, each behind
  a tune whose 0 draws round 3:
  - `farCalm` (FAR_CALM_LO_M): from 80 to 300 m of long footprint, on a log
    scale (10 and 3 rows under the horizon at the judged pose, 1.2 and
    2.3 km out), the far read goes back to the full filter, the resolved
    slope and the texture's dash go out, the mean bends take back their far
    share (SHEEN_K), and the fresnel opens by 0.05 (from 20 m of footprint,
    25 rows), the darkening a mean of dashes gave. A footprint key, as a mip
    level is: the plan view's far water, at 1 to 3 m, does not change.
  - `farSoft` (FAR_SOFT_K): the dash passes a soft limit d / (1 + 3 |d|)
    and opens the fresnel 1.2 a unit (2.0 before), so its edges ramp; a dash
    of 0.25 had taken the fresnel to the body's navy and drawn a hard black
    block. Its lift of the reflected ray is soft-capped at 0.15 (about 9
    degrees): a strong dash had lifted the ray into the sun's glow and drawn
    single white specks (from a 300 m eye, bright speckled patches).
  - `farTone` (FAR_TONE_K): before the haze, the water's color moves toward
    the haze color at the water's own luminance, by 0.5 (1 - exp(-(d /
    900 m)^1.5)) on the haze's own distance: 3% at 130 m, 17% at 500 m, 34%
    at 1 km, 48% at 2 km. Only the color moves, so the far sea keeps its
    value step under the sky. An eye match to the reference, not a model of
    the air.
  - `farBody`: DEEP_FAR (0.03, 0.10, 0.16), less violet than (0.04, 0.10,
    0.18); the far dark patches stay on the reference's navy.
  At the judged pose (`distance4/bands4.py`, columns 0 to 600, row 0 the
  first sea row; ours, round 3, the reference):

  | rows under the line | luma | luma sd | saturation | blue - green | brighter than the sky row |
  |---|---|---|---|---|---|
  | 1-5 | 151.6, 154.2, 152.8 | 2.2, 3.8, 5.8 | 18.8, 19.1, 22.0 | 9.9, 10.5, 10.1 | 0, 17.5, 42.2% |
  | 5-10 | 148.4, 149.1, 149.6 | 6.3, 9.3, 11.0 | 23.2, 27.9, 27.4 | 12.3, 15.3, 11.6 | 4.0, 16.7, 42.2% |
  | 10-20 | 146.6, 145.2, 138.9 | 10.3, 13.4, 21.0 | 30.7, 38.2, 37.0 | 16.3, 20.7, 15.5 | 5.8, 8.5, 30.8% |
  | 20-40 | 139.0, 137.2, 135.0 | 17.0, 20.8, 23.0 | 40.6, 46.5, 40.4 | 20.6, 24.4, 16.8 | 6.6, 9.6, 29.0% |

  The sky's 10 rows over the line: 156.9 luma, sd 0.2, saturation 14.0,
  blue over green 7.5 (round 3 159.0, 1.6, 12.5, 6.7; the reference 153.9,
  3.1, 15.3, 8.6). The sea's rows 1-5 sit 5.5 luma under the sky row just
  over the line (round 3: 2.9; the reference 1.2), and under it in all four
  150 px column bands (-4.4, -5.2, -5.9, -6.3; the reference +0.5, -3.4,
  -1.3, -0.4: its sheen is brighter than its sky row, its mean is not).
  Green over red now meets blue over green from 25 rows under the line
  (round 3: from 40). Tried and not kept: the fresnel flattening ended at
  4 km (FLATTEN_END_M, 900 m) darkened the rows 10 to 40 to the
  reference's (142, 134) but drew thin bright lines on the mid field's
  front faces, the fault the flattening was set against; a wider band grey
  on the low sky stops (the reflected sky there is 5 to 10 degrees up, so
  the sheen did not move).
  Sweep (`distance4/sweep-heights.png`, `sweep-turns.png`): 1.0 to 1.5% of
  the pixels over 8/255 at every heading and pitch that shows far water, 0
  at 35 degrees down, 0.07% from 1.8 m, 1.2% from 18 m, 4.2% from 60 m, 21%
  from 300 m and 14% from 1.5 km, where the far speckled patches become
  soft grey patches. Cost: 0.04 to 0.11 ms more of the surface's draw (2
  to 6%) at `open-horizon` and from 60 m, in three A/B runs of alternated
  `bench(400)` in the same minutes (tracked files against the working
  copies, one page load each, `distance4/perfRun.mjs`, `perfVar.mjs`); the
  whole frame 0.07 to 0.10 ms. No one part is over the noise: with the sky
  band, the tone, the calm and the soft dashes each switched out the draw
  moves by 0.01 to 0.04 ms, and with all four out it is round 3's.
- **The far sea meets the haze and reflects the clouds (distance round 5).**
  Round 4 split: the judge with ours as B picked it ("the far sea gets
  lighter and grayer as it recedes ... a soft, low-contrast line"), the
  judge with ours as A did not ("a visible brightness step between a
  blue-gray sea and a gray haze", "the water stays saturated teal too far
  out", "the far surface looks matte"), and the shading judge on round 4's
  frame with ours as A lost it too: "the far half of the sea ... is a dark,
  saturated teal that is darker than the sky above it", "the bright clouds
  show up nowhere on the water". Five changes in `oceanSurface.ts`, each
  behind a tune whose off value draws round 4:
  - `farCloud` (FAR_CLOUD_K 0.5): the far water reads the sky's lobe copy
    (the clouds averaged over a tent of elevations, 8 degrees to each side,
    and two 0.35-degree columns: a far pixel's lobe of rays is tall in
    elevation and thin in azimuth) along its MEAN reflected ray (the view
    ray mirrored in the flat sea, lifted by the mean bend), weighted by the
    unresolved share, from 60 to 300 m. Read along the facet's own ray the
    clouds drew white specks, the reason rounds 1 to 4 faded them out past
    600 m. The far sea under the far clouds brightens in soft patches: the
    rows 0 to 125 under the line rise 3.4 luma on average, 17 at most. No
    cost that a tune A/B can see.
  - `farCalmOpen` (FAR_CALM_OPEN_SHARE 0.7): the calm's fresnel opening at
    0.7 of round 4's. The step between the sea's rows 1 to 5 and the sky row
    over the line is -1.2, -1.2, -0.9 and -1.0 luma in the four column bands
    (round 4 -4.4 to -6.3; the reference +0.5, -3.4, -1.3, -0.4).
  - `nearSelfM` (NEAR_SELF_END_M 150; 600 before): the near low rays that
    return the body's teal end at 150 m, so the mid field's back faces return
    the pale low sky; the storm keeps 600 m.
  - `midBody` (DEEP_MID): the near deep goes to a navy (0.008, 0.05, 0.085)
    from 60 to 250 m, and DEEP_FAR takes over from 300 to 900 m (100 to
    600 m before): the darkest fifth of the rows 60 to 120 under the line
    is (49, 85, 109) and (47, 89, 113) sRGB (round 4 (51, 95, 117); the
    reference (51, 84, 109), (51, 88, 114)).
  - `hazeFar` 2500 (3000 before): see Haze and the horizon.
  At the judged pose (columns 0 to 540 for the lower rows; ours, round 4,
  the reference):

  | rows under the line | luma | saturation | mean sRGB |
  |---|---|---|---|
  | 1-5 | 152.2, 151.7, 152.5 | 17.6, 18.7, 21.4 | (146 153 163), (144 153 163), (143 155 165) |
  | 5-10 | 151.2, 148.5, 149.0 | 20.7, 23.0, 27.0 | (143 153 164), (140 150 163), (137 152 164) |
  | 10-20 | 150.4, 146.5, 138.9 | 26.7, 30.6, 36.1 | (140 153 167), (135 149 165), (122 143 159) |
  | 20-40 | 142.1, 139.3, 135.8 | 34.3, 40.3, 39.3 | (128 145 162), (123 143 163), (118 141 157) |
  | 40-60 | 125.7, 126.1, 124.1 | 42.0, 49.7, 41.6 | (108 130 150), (105 131 155), (106 129 147) |
  | 60-90 | 113.4, 111.3, 115.5 | 46.3, 54.8, 41.8 | (93 119 140), (86 118 141), (97 120 139) |
  | 90-120 | 109.2, 104.8, 112.7 | 51.7, 59.2, 46.2 | (86 116 138), (77 113 136), (92 118 138) |
  | 120-160 | 105.6, 99.9, 107.8 | 56.3, 62.3, 51.6 | (79 113 135), (69 109 132), (83 115 135) |

  The rows 1 to 5 keep round 4's calm (luma sd 1.0; the reference 5.8), and
  4.3% of their pixels are brighter than the sky row (the reference 42%):
  the reference's last rows carry streaks to the line. The mid field is
  still bluer than the reference's in its sheen (blue over red by 26 to 28
  in the rows 20 to 90, the reference 18 to 22): it reflects the sky 10 to
  19 degrees up, which is bluer than the reference's (GG-321). Tried and not
  kept: the lobe read at 1.0 put the last 10 rows 3 luma over the sky row
  (round 3's fault); the lobe read along the facet's partly flattened
  normal drew white specks; the fresnel bend at 0.1 or 0.05 lifted the mid
  field 4 to 7 luma but left its teal and put the last rows over the sky;
  a lower reflect bend (0.2, 0.25), a stronger far tone (0.8) and a
  bluer DEEP_FAR moved the mid field's colors by under 2; fading the steep
  view's turquoise share with range moved its darkest fifth by under 3.
  Sweep (`distance5/sweep-heights.png`, `sweep-turns.png`): 2.3% of the
  pixels over 8/255 from 1.8 m, 3.2% from 4 m, 8.4% from 18 m, 12.2% from
  60 m, 3.5% from 300 m, 2.0% from 1.5 km, 8.1 to 9.8% at every heading and
  8.4 to 8.6% at the pitches that show the horizon, 3.2% at 35 degrees down
  (the water 30 to 250 m out: the near low rays and the mid body). The keys
  are the eye distance, the footprint and, for the sky, the view ray's
  elevation; no step between the sweep's poses changes the look's kind.
  Cost: 0.14 to 0.26 ms more of the surface's draw (2.5 to 5%) at
  `open-horizon` and 0.20 ms from 60 m, the whole frame 0.19 to 0.25 ms
  more, on a GPU that other sessions loaded to 2.7 times the quiet figures
  of Frame cost (the frame 6.3 ms against 2.3). Six alternated rounds of
  `bench(400)` in the same minutes, the tracked files against the working
  copies, a page load each (`distance5/perfRun.mjs`): the draw 5.21 against
  5.47 ms, from 60 m 5.83 against 6.03; five rounds with temporary switches
  (`distance5/perfVar.mjs`, removed before the save): 5.33 against 5.46 ms.
  No one part is over the noise (0.1 ms): the lobe read's branch skipped by
  its tune in one page moves the draw by under 0.03 ms, so what cost there
  is comes with the shader's size, not the fetch.
- **The far sea draws streaks to the line (distance round 6).** Round 5 lost
  in both orders on the same strip: "a pale, speckled gray band that lifts the
  sea almost to sky brightness and blurs the join. It should be a slightly
  darker blue-gray band of fine, tightly packed horizontal ripple lines that
  ends in a crisp, continuous horizon line" (ours as B); "grainy and speckled,
  like a frosted noise pattern; it should resolve into long, smooth horizontal
  streaks", and "a slightly light, even rim" on the line (ours as A). Its far
  texture read the energy at the far read's own level, so its patches were a
  few meters wide and drew short, blocky one-row dashes, and the calm made
  the last 5 rows one even tone (luma sd 1.0; the reference 5.8). Changes, each
  behind a tune whose off value draws round 5:
  - `farTexBias` 2.5 (FAR_TEX_BIAS): the energy read 2.5 levels coarser (the
    two turned reads, and one centered read in place of the four taps'
    mean), so each patch is 5.7 times wider; the grazing view compresses it
    into a row or two, so it draws as a long horizontal streak, and the
    streaks pack tighter toward the line. `farTexGain` 4.5 gives back the
    departure the coarser mean takes out.
  - `farCalm` 0.4 (FAR_CALM_R6; 1 before), `farCalmOpen` 2.2 (0.7) and
    `hazeFar` 3500 (2500): the texture reaches the line, and the calm's
    opening (0.044, round 5 0.035) puts the step back on the reference's.
  - `farCloud` 0.4 (0.5): the lobe clouds had lifted the rows 5 to 40 by 3 to
    5 luma; at 0.25 the mid field (the shading piece's won far half) lost 2 to
    3 luma, at 0.4 about 1.
  - THE GRAZING SHARE: the three far terms above move from round 5's values
    to round 6's by the long footprint over the short one, from 8 (7.2
    degrees of grazing) to 24 (2.4 degrees). Without it the coarser read drew
    wide pale blotches over the far sea from 300 m and 1.5 km up. A key on the
    footprint's shape on screen, as the mip level is.
  At the judged pose (ours, round 5, the reference):

  | rows under the line | luma | luma sd | dark fifth sRGB |
  |---|---|---|---|
  | 1-5 | 152.1, 152.2, 152.5 | 2.7, 1.0, 5.6 | (141 150 161), (144 152 163), (134 146 159) |
  | 5-10 | 147.7, 151.2, 149.0 | 10.8, 5.6, 11.0 | (119 133 146), (133 144 156), (115 134 153) |
  | 10-20 | 146.4, 150.4, 138.9 | 15.2, 10.2, 20.4 | (106 125 143), (122 137 153), (82 111 138) |
  | 20-40 | 139.9, 142.1, 135.8 | 25.7, 20.6, 22.2 | (75 102 124), (89 113 134), (75 106 135) |
  | 40-60 | 124.2, 125.7, 124.1 | 24.0, 22.1, 25.3 | (64 94 119), (69 97 122), (61 93 122) |

  The dark runs (pixels under the band's 30th luma percentile) are 8 to 14 px
  long in the rows 1 to 20 (round 5: 7 to 8), and no pixel of the rows 1 to 40
  turned white. The step between the sea's rows 1 to 5 and the sky row over
  the line is -2.1, -1.7, -0.6 and -0.2 in the four column bands, -1.2 over
  the crop (the reference +0.5, -3.4, -1.3, -0.4 and -1.2). Tried and not
  kept: a stronger far slope gain, the fresnel flattening relaxed past 700 m
  and a larger far texture gain alone each moved the rows 10 to 20 by under 1
  of sd; the turned reads' slopes added to the shading normal (two copies of
  each foam cascade turned by 31.7 and -57.3 degrees, whose crests cross the
  view) drew single white pixels on the far rows; `farSoft` 0.8 drew as
  `farSoft` 1 with a larger gain.
  Sweep (`distance6/sweep-heights.png`, `sweep-turns.png`): 3.4% of the
  pixels over 8/255 from 1.8 m, 3.7% from 4 m, 5.2% from 18 m, 6.5% from 60 m,
  9.5% from 300 m (by at most 33) and 33% from 1.5 km (by at most 29: the
  thinner far haze), 5.3 to 6.1% at every heading, 4.0 to 5.1% at the pitches
  that show the horizon, 0 at 35 degrees down.
  Cost: 0.08 ms more of the surface's draw (2.1%) at `open-horizon` and
  0.13 ms (2.9%) from 60 m, the whole frame 0.07 to 0.08 ms, in six
  alternated rounds of `bench(400)` in the same minutes, the tracked
  round-5 files against the working copies, a page load each
  (`distance6/perfRun.mjs`): the draw 3.88 against 3.96 ms, from 60 m
  4.38 against 4.51 (medians; the frame 4.73 against 4.81 ms, a quieter GPU
  than round 5's run). The new reads (one centered energy read a
  foam-driving cascade past 250 m, and the haze copy's read with each cloud
  read) cost under the noise of one run.
- **The far read spans what a hardware filter spans (distance round 7).**
  Round 6 lost in both orders, and again on the horizon-aligned crop (ours 0
  191 600 290 against the reference's 0 170 600 290, both horizons on crop row
  147, the lead's ruling). Three judges (d5-B, d6-B, d6h-A) named one stable
  fault: "in the middle-to-far band, from about 10 to 70 px below the
  horizon, the ripples are round, even-sized blobs that barely shrink with
  distance. They should turn into thin horizontal streaks that get finer and
  run together into a smooth, sky-lit band near the horizon", and "the
  middle-distance waves are big, smooth, rounded shapes with no small detail
  on top, like a low-resolution heightfield". The lead's reading, checked:
  the range fades did not remove the short waves (the chop shades to 4 km,
  the ripple to 2.25 km at a grazing footprint), but the far read spread its
  four taps over the whole long footprint, 5 to 60 m along the view from 300
  m to 2 km out, and averaged every short wave out of each pixel; what was
  left was the long waves' smooth slope, which the far slope gain then made
  the strongest term. A hardware anisotropic filter with a 16:1 cap spans at
  most 16 short axes and leaves the rest of a grazing footprint unfiltered,
  which is why the reference's short waves draw as thin dark lines packed
  tighter toward the line. Changes in `oceanSurface.ts`, each behind a tune
  whose off value draws round 6:
  - `farSpan` (FAR_SPAN_K 4): the far read spans 4 short axes at most along
    the view, the taps and the mip level following the span, where the
    footprint is grazing (its long axis 3 to 10 times its short one) and the
    far read is on, out of the calm. A key on the footprint's shape, as the
    mip level is.
  - `farFineGain` 2.2 and `farCoarseGain` 0.35 (FAR_FINE_GAIN): on the same
    grazing far-read share, the cascades with waves under 30 m take 2.2 of
    their shading slope and the longer ones 0.35, so the short waves carry the
    far field and the long waves' rounded shapes recede. An eye match to the
    reference's far field.
  - `farRayCap` 0.5 (FAR_RAY_CAP): on the same share the reflected ray's
    elevation is capped at 30 degrees (the ray keeps its azimuth), since a
    footprint mean's ray does not climb to the sun; with the fine gain alone a
    few far facets had reflected the sun's disc as single white pixels.
  - `farCalmOpen` 1.7 (2.2 in round 6): the step at the line back on the
    reference's.
  The measurable half, 10-row bands from the line (ours, round 6, the
  reference; `distance7/aspect7.py`, `scales7.py`): L is the mean luma, sd
  the luma sd after each row's mean, Ev/Eh the vertical over horizontal
  gradient energy, lh the horizontal correlation length (px):

  | rows under the line | L | sd | Ev/Eh | lh |
  |---|---|---|---|---|
  | 0-10 | 149.6, 149.8, 151.2 | 8.0, 7.7, 8.5 | 20.0, 37.9, 11.1 | 8.1, 13.1, 9.1 |
  | 10-20 | 146.5, 146.9, 138.9 | 14.6, 14.7, 20.1 | 13.8, 16.1, 14.8 | 6.0, 9.0, 9.5 |
  | 20-30 | 140.6, 141.4, 133.0 | 24.9, 24.9, 23.3 | 10.8, 11.1, 10.7 | 7.5, 8.9, 7.1 |
  | 30-40 | 135.9, 137.8, 137.0 | 25.6, 25.0, 20.9 | 17.3, 18.6, 13.8 | 6.3, 8.2, 7.9 |
  | 40-50 | 127.7, 123.8, 130.1 | 26.1, 24.3, 22.9 | 23.3, 20.3, 9.7 | 7.9, 9.8, 8.1 |
  | 50-60 | 125.6, 124.1, 116.9 | 24.6, 22.7, 24.5 | 20.6, 21.0, 5.0 | 8.5, 13.5, 8.0 |
  | 60-70 | 112.8, 115.8, 114.0 | 29.4, 26.6, 22.7 | 22.8, 24.8, 3.9 | 8.4, 9.8, 7.6 |
  | 70-80 | 109.2, 109.5, 109.4 | 28.1, 26.3, 29.4 | 15.6, 15.0, 3.7 | 10.5, 10.5, 21.9 |

  The statistics barely separate the two looks (the vertical correlation
  length is under one row in both, and lh and Ev/Eh move by under a third):
  the difference the judges named is the shape of the dark marks, round
  lenses 30 to 80 px wide against thin lines 1 or 2 rows tall, which the
  zooms show (`distance7/zy7.png`, `sh_f7z.png`) and these numbers do not.
  Tried and not kept: a sixteenth-to-a-thirty-second cap alone (`aDiv`),
  eight taps in place of four, the ripple in the far reflection normal (each
  under 1 luma of change), the gains ramped in from 60 m as the far slope gain
  is (they moved the glitter of the waves crop by up to 194 grey levels), and a
  cap on the ray's y alone (the sky normalizes the ray, so it climbed back).
  Sweep (`distance7/sweep-heights.png`, `sweep-turns.png`): 0.4% of the
  pixels over 8/255 from 1.8 m, 1.0% from 4 m, 3.8% from 18 m, 5.5% from
  60 m, 1.3% from 300 m and 0 from 1.5 km (a steep far footprint keeps
  round 6's read), 3.7 to 4.1% at every heading, 3.8 to 3.9% at the pitches
  that show the horizon and 0 at 35 degrees down; no blotch or lattice at
  60 m, 300 m or 1.5 km. The white pixels in the rows 0 to 100 under the line
  stay at round 6's count (1, 56, 2 and 0 at `open-horizon`, `ref-open`,
  `side-horizon` and `sun-glitter`).
  Cost: 0.17 ms more of the surface's draw (2.5%) at `open-horizon` and
  0.25 ms (3.4%) from 60 m, in six alternated rounds of `bench(400)` in the
  same minutes, the tracked round-6 file against the working copy, a page
  load each (`distance7/perfRunPose.mjs`), on a GPU another process loaded
  to 1.8 times round 6's run (the frame 8.5 ms against 4.7): the compute,
  which this round does not touch, moved by 0.06 to 0.11 ms in the same
  runs, so the draw's rise is at the noise. The round adds no fetch: the
  taps and their count are round 6's; only their spread and level move.
- **Haze and the horizon.** 1.6e-4 per meter (2e-4 before) and a second
  term, 1 - exp(-(d / 6 km)^2), taken by max, so the water's last rows meet
  the sky's own value. Distance round 3 closes the second term earlier:
  1 - exp(-(d / 3 km)^1.3) (`hazeFar`, `hazeFarPow`). It passes the
  exponential at 260 m, so the near and mid water keep their haze, and is 9%
  at 500 m, 29% at 1.3 km, 49% at 2.2 km, 74% at 3.7 km and 97% at 7.7 km:
  rows 30, 10, 5, 2 and 0 under the horizon at the judged pose. The far sea
  greys into the line's color over its last 30 rows ("the last 20 to 30 px
  of sea should gray into that haze", the round-2 judge). Distance round 5
  closes it at 2.5 km (`hazeFar` 2500): 12% at 500 m, 35% at 1.3 km, 57% at
  2.2 km and 81% at 3.7 km, since the far water under it now reflects the
  clouds and is brighter. Distance round 6 opens it to 3.5 km (`hazeFar`
  3500): 8% at 500 m, 24% at 1.3 km, 42% at 2.2 km, 66% at 3.7 km, 94% at
  7.7 km, so the far streaks show to the line. Both terms take
  the eye distance times the mean air density of the path in a haze layer
  1 km thick (`HAZE_AIR_H_M`, `hazeAirH`; GG-316): 0.991 from the judged
  18 m camera, 0.93 from the 140 m plan view, 0.50 from 1.6 km up. The storm
  keeps its haze. The sea is curved (distance round 2, GG-289): the
  vertex stage drops each vertex by r^2 / (2 R) about the camera, so the
  horizon sits at the true dip, 15.1 km out and 2.2 px under the flat
  vanishing line from the judged 18 m camera, 4.8 km out from a 1.8 m eye.
  The sampler, the buoyancy probe and the underside mesh stay flat (0.8 mm
  off at 100 m). The grid's outer ring runs from 8.9 to 25 km; with the
  curve the drawn horizon is its 8.9 km rim, 0.3 px under the true one.
- **The storm keeps its round-4 far field.** Under `uOvercast` the haze, the
  two bends, the fresnel flattening and the residual blend back to the
  values the rain and spray pieces were judged with, and round 2's far terms
  are gated off. Only the curvature is new there: with `curve` 0 the
  `storm-deck` and `storm-away` captures match the build before round 2 to
  one grey level; with it, 0.1% of their pixels move by more than 8, all on
  the horizon line.
- **Tuning channel.** `surface.tune` holds `haze`, `farSlopeGain`,
  `fresnelFlatten`, `cloudReflection`, `glintRms`, `sparkDensity`,
  `sparkBrightness`, `reflBend`, `fresBend`, `reflSpread`, `farDash`,
  `farFres` (now the dashes' lift and opening), and from distance round 2
  `curve`, `hazeFar`, `gust`, `grain`, `sheen` and the sky's `skyGlowK`,
  `skyBandDim`, `skyBandK`, `skyBandGrey`, and from distance round 3
  `farTex`, `farJitter`, `hazeFarPow` and `hazeAirH` (round 2's frame:
  `farTex` 0, `farJitter` 1, `hazeFarPow` 2, `hazeFar` 6000, `hazeAirH` 0,
  `skyBandDim` 0.30, `skyBandK` 0.05, then a re-bake), and from distance
  round 4 `farCalm`, `farSoft`, `farTone`, `farBody` and the sky's
  `skyBandFoot` and `skyGreyKMul` (round 3's frame: the four at 0,
  `skyBandFoot` 0, `skyGreyKMul` 1, `skyBandGrey` 0.55, `skyBandK` 0.035,
  then a re-bake), and from distance round 5 `farCalmOpen`, `farCloud`,
  `nearSelfM`, `midBody` and the sky's `skyGlowTint` and `skyFootTint`
  (round 4's frame: `farCalmOpen` 1, `farCloud` 0, `nearSelfM` 600,
  `midBody` 0, `hazeFar` 3000, `skyGlowTint` 0, `skyFootTint` 0, `skyGlowK`
  0.05, `skyBandDim` 0.38, `skyBandK` 0.034, `skyBandGrey` 0.45,
  `skyGreyKMul` 1.6, then a re-bake), and from distance round 6
  `farTexBias`, `farTexGain` and the sky's `skyCloudFade`, `skyCloudFadeLo`
  and `skyCloudFadeHi` (round 5's frame: `farTexBias` 0, `farTexGain` 1,
  `farCalm` 1, `farCalmOpen` 0.7, `farCloud` 0.5, `hazeFar` 2500 and
  `skyCloudFade` 0; no re-bake), and from distance round 7 `farSpan`,
  `farFineGain`, `farCoarseGain` and `farRayCap` (round 6's frame: `farSpan`
  0, `farFineGain` 1, `farCoarseGain` 1, `farRayCap` 1, `farCalmOpen` 2.2);
  the probe's `setTune`, `getTune`,
  `setSkyTune` and `setContact` drive them from a rig (`setSkyTune({})`
  re-bakes after a sky change). Defaults are the shipped values.
- **Debug views.** `setDebug(6 | 7 | 8)` isolates the fresnel, the reflected
  radiance and the body (times 4), unhazed: the three terms a far-field
  look is made of.

## Spray

`oceanSpray.ts`, mounted by `?extras=spray`. The judged frame is `storm-deck`
(12 m up, 50 degrees, 42.0 s) on `&sea=storm`.

- **A strand per particle.** Each particle is one filament of a plume: a
  ROOT on a whitecap and a TIP where the drops that left it are now. The
  tip is integrated (drag toward the log-profile wind at its height, the
  drop's terminal fall, a lip updraft that dies over one wave height of
  run, a lee rise, plume-wide 33 m gusts and per-strand meter eddies); the
  root stays where it was born. The ribbon from root to tip is built per
  vertex in world space and bows up over the chord by the lip rise; a lee
  rise of 0.15 of the air speed lifts the plume about 9 degrees.
- **Rooted on DRAWN foam, not on the raw fold.** Births and the root hold
  read `seenDeficit`: each foam cascade's Jacobian averaged over the pixel
  footprint's long axis, times the surface's footprint fade (`fit`) and its
  stretched normal range fade, summed as the surface sums them. The raw
  fold put most ripple births where the surface draws nothing past 70 m.
  This is a MIRROR of the surface's foam mask (GG-281): a change to the
  foam mask must be repeated in the spray, and `spray/seenCheck.mjs`
  (gauntlet scratch) checks the two agree (the mirror reads about 0.02 of
  deficit under the surface).
- **A strand lives as long as its whitecap.** The drawn whitecap is the
  instantaneous fold and holds about half a second (measured on the CPU
  reference, `spray/rootTrack.ts`); a root may hop to foam within 1 m at
  about its own height, and its feed is capped at the whitecap's median
  life, 0.6 s times a per-plume factor. Then the strand fades and puffs out
  over 0.3 s. Plumes longer than that need persistent foam (GG-279).
- **Birth band.** A candidate is born with a chance from 0 at a seen deficit
  of 0.40 to 1 at 0.52: the band where the whitecap turns white on screen
  against the storm's dark water, measured against the frame drawn without
  strands.
- **Light.** The head is foam at 0.34 of the surface foam's radiance, a
  light gray dimmer than the whitecap; the thread is a forward-scattering
  veil of the sky behind the drop and a little sea, computed once a step
  per live strand in the update kernel.
- **Body.** The opacity falls off along the strand (an 8 m e-fold on top of
  the filament's dilution, with a ragged end), fades softly where the
  strand nears the water (water heights interpolated from root to tip, no
  sea reads per vertex), and is modulated by wind-aligned streaks in WORLD
  space, shared by every strand a pixel sees, whose period doubles until it
  spans 6 px so it never aliases. The plumes' hard lower edges were the
  line of dense heads on the crest, not depth occlusion (a 6 m depth pull
  changed nothing).
- **Determinism.** A fixed 1/60 s step from a known start; a pinned time,
  a jump backward, a long gap, or a camera that moved, turned or changed
  its footprint (height or field of view) restarts and re-integrates 4.5 s
  of warm-up, re-stepping the sea every fourth step. `shootOurs.mjs`
  shooting storm-eye then storm-deck in one page gives the same deck frame,
  bit for bit, as a page that only ever held the deck pose.
- **Cost.** About 0.6 ms of GPU a frame at the judged pose with 8,200
  strands alive (ribbon draw 0.55 ms, update 0.07 ms per dispatch; the
  quietest round of `spray/perfBatch.mjs`, whose update and clear are
  batched in one pass so a contended GPU's per-submit wait stays out of the
  reading).

## Rain

`?extras=rain&sea=storm`. The judged frame is `storm-away` (10 m up, 55 degrees,
42.0 s). Won blind in round 4, two critics both high.

- **A streak is one instanced quad per drop**, stretched along its own
  direction (the field's one velocity, plus the gust sheet's drift, plus a
  small per-drop jitter) by a 1/23 s exposure.
- **It blends toward the drop's radiance** in the linear frame buffer:
  `bg * (1 - a) + streakRadiance * a`. A drop is a lens onto the whole storm
  sky, so it barely shows against the sky and shows more against the dark
  sea. This is the fix that won: the first model drew a 0.62 scene-linear
  color that the tone map turned into near-white bars.
- **Alpha is set by distance**: a lens blur (`cocPxM / d` px) that widens and
  softens the near drops, a fall-off past 8 m that makes the far drops a
  faint curtain, a window at 45 to 56 m, and the gust sheet the drop sits in.
- **The drop field is world-fixed** and wraps in a box around the camera; the
  pattern is a pure function of (seed, time).
- **The murk** is a camera dome whose extinction varies along the horizon
  (rain shafts, computed per dome vertex).
- **Crowns and rings** sit on the FFT height read from `disp`, with one
  fixed-point step to undo the choppy displacement; a second crown population
  30 to 250 m out gives the far sea a faint stipple.
- The rain mirrors `sampleCascade` and `cascadeLod` from `oceanSurface.ts`,
  as the buoyancy probe does; `oceanSampler.ts` (GG-273) is the shared form.
- **Open:** the nearest streaks have hard, untapered edges, and no rain marks
  show on the water at the judged distance (both from the winning critics).

## Wake

`oceanWakeMath.ts` (the model, every constant, the CPU mirror),
`oceanWake.ts` (the GPU field and the surface's read), `oceanWakeBoat.ts`
(the hull), mounted by `oceanExtras/wake.ts` (`?extras=wake`, judged on
`&sea=waterpro` at 42.0 s). The surface draws it through its `setWake(reader)`
hook in `oceanSurface.ts` (landed 2026-09-24): extra height in the vertex
stage, and extra slope, foam and bubble light in the fragment stage. With no
reader set the surface shades exactly as before (0 of 1,440,000 pixels
changed on six test frames).

- **The waves are a closed form.** Each Fourier mode of a 512 x 256 window
  at 1 m (turned to the hull, the stem 30 m from its front edge) is a forced
  oscillator driven by the hull as a surface pressure: a box of the waterline
  length with its ends smoothed over 1.8 m, Gaussian across (sigma B / 4),
  holding the displaced volume times 0.7 (thin-ship theory runs high; see
  `WAKE_WAVE_MAKING`). The course is a polyline of straight pieces, and each
  piece's integral over the pressure's age is exact
  (`wakeSegmentIntegral`), so the pack kernel sums the pieces per mode and
  one inverse FFT (9 + 8 Stockham stages, the gather plan of `oceanCompute.ts`)
  gives height, slope and a 1.5 m low-passed height for the mesh. No state,
  no warm-up, no step: the wake is a pure function of the course and the sea
  time. Measured, not put in: the transverse wavelength is 2 pi U^2 / g
  within 3%; the wedge's edge (half the slope envelope's maximum) is at
  20.9 degrees for the trawler at Fr 0.35 and within 1.5 degrees of
  asin(1/3) = 19.47 for a small source; the line of steepest waves is at
  14.2 degrees, inside the cusp line as Rabaud and Moisy found for Fr over
  about 0.3; 1.7% of the slope energy lies past 23 degrees and none past 30;
  the highest wave one hull length abeam is 0.73 m (PIANC's 0.3 to 0.9 m).
- **The history and the window.** The transform is periodic over the
  window, so the history stops where the oldest pressure would leave it
  (70 s at 6 m/s) and the waves lose coherence over T = S / 3 (the cut's
  ghost is e^-3 and sits in the rear fade). In a turn the window's axis
  follows the chord of the last 35% of the history, and the wave history
  ends where the course leaves the window's inner box, its oldest 40% faded
  in four steps (`wakeSegments`).
- **Touches.** A point press (`WakeTouch`: a Gaussian of 0.4 m pressing for
  0.25 s by default) is a still piece with a round footprint in the same
  sum, so its rings come out of the dispersion relation: the outer rings are
  the longer (Cauchy-Poisson), which a ripple with one speed cannot do.
  `__OCEAN__.extras.wake.touch(x, z, t)`; the second bar's "ripples from a
  touch".
- **White water.** Three sources, each a function of where the water lies
  against the course (`wakeFoamAt`): the stern churn (0.9 of cover behind
  the transom decaying over 10 s, widening as (1 + d / 20)^0.35, plus a
  boil of 1.1 e^{-d / 12 m} at 0.6 of the trail's width, the propeller's
  jet); the wake's own breaking crests (linear slope 0.22 to 0.40 on a
  crest, inside the hull's wedge only, plus a contact breaker along the
  bow's forward third), whose foam is swept aft along streamlines that keep
  their offset from the hull's widest breadth (`wakeDepositCpu`), decaying
  over 2.5 s and covering at most 0.35; and a bubble cloud under both,
  clearing over 30 s, that adds a pale green glow to the body under the
  fresnel.
- **The lace (round 2).** A tileable image built once on the CPU
  (`wakeLaceImage`). Its raft channel is a ranked sum of a domain-warped
  fBm (the gaps of open water and the rafts), the popped cells and a
  bubble speckle, so gaps open at every scale (the tests check a spread of
  more than 30 times in gap area); round 1's popped cells alone read to both
  blind critics as "Swiss cheese". It is read in the trail's frame at 12,
  23, 19 and 97 m tiles (raft, clumps, streaks drawn out three times along
  the flow, patches), equalized by a coverage table (`wakeLaceCdfTable`) so
  an amount of a covers a. The read (`reader.shade`): the threshold is a
  soft ramp gated in by the amount, so a thin trail breaks into rafts and
  ribbons; the foam's opacity rises from 0.4 just over the threshold to 1,
  so thin foam is a see-through film; the lace just under the threshold, and
  the pockets of the dense core, glow as submerged bubbles; where the amount
  passes 0.55 the raft channel is read again at a 3.1 m tile for the
  turbulent pockets of the churn, and the streaks channel draws the core
  into ribbons; the cover goes as 1 / J of the sea's own folding Jacobian,
  so foam gathers on the chop's crests and thins on its slopes; the clumps'
  gradient gives the heaps of white a lit side (the holes have no rims, which
  round 1's critics read as an embossed solid). Past a 0.3 to 2 m footprint
  the lace hands over to its mean.
- **Round 3 (the quarter view).** The round-2 critic's "stair-stepped,
  pixelated" patch on the stern wave's lee face was not foam: the wake's
  slope turned whole patches of normal-mapped facets away from the camera,
  and the surface drew those back faces by their reflected ray. The read now
  saturates the wake's slope away from the eye at 0.7 of the view ray's
  elevation (`wakeCapAlong`, tested), so the wake alone never turns a facet
  away. (A Catmull-Rom read of the near field was tried against the same
  steps: no visible change, 0.12 ms, removed.) The foam has volume: the
  surface multiplies its foam color by the reader's `foamShade`, which greys
  the thin edges and hole rims to 0.7 and shades each heap's down-sun side
  by up to 0.22 (a routed change to `oceanSurface.ts`, one line; with no
  reader the factor is 1). The core behind the stern has grain: pockets at
  a 3.1 m tile go to 0.08 of the alpha and are left as dark water (lit from
  under they were round 2's "milky smear"), and a bubble speckle at a 1.1 m
  tile shows where a pixel resolves it. The streaks weigh 0.1 of the lace,
  down from 0.22, and the raft and streaks are drawn out 1.3 and 2 times
  along the flow, down from 1.8 and 3 (the critic's "parallel, evenly spaced
  diagonal streaks"). Round 3 lost both views blind: the chase view's core
  became "a see-through milky haze", the quarter view stayed "a stamped
  cell-noise decal".
- **Round 4 (round 2 restored; the quarter view by age).** Every round-3
  change now sits behind a field of `WakeLook` (`oceanWakeMath.ts`:
  `laceWeights`, `holeStretch`, `streakStretch`, `subGain`,
  `corePocketLo`, `corePocketRamp`, `pocketsGlow`, `coreGrain`,
  `foamVolume`, `backfaceCap`), build-time: a field that is off adds no
  node. `WAKE_LOOK_ROUND2` and `WAKE_LOOK_ROUND3` name the two builds;
  `parseWakeLook` reads a spec (`r2`, `r3`, `field:value` tokens) that the
  viewer mount takes from `&wakelook=`, so a capture rig shows any build
  from the one file with no save. Proof of the restore: the lead's chase
  frame of the round-2 build against a capture of `r2` differs on
  164 of 156,000 pixels of the judged crop by over 8/255,
  every one a single-pixel glint on open water (the surface's own changes
  since that frame: the distance round and the performance pass moved the
  sky, the far field and the glints, 17% of the whole frame, the same
  count with `r3` against the round-3 frame); `r3` against a capture of
  the round-3 file taken the same day differs on 0 pixels. The default is
  `WAKE_LOOK_ROUND4`: round 2's read plus four round-4 fields, each of
  which leaves the chase view's judged crop at 0 pixels (the age fields)
  or 125 pixels (the knee):
  - `backfaceKnee` 0.3 with `backfaceCap` 0.9: round 3's cap bent every
    wake slope from zero, which is why it changed the chase view; the
    knee leaves a slope under 0.3 of the view ray's elevation alone and
    squashes only the excess (`wakeCapAlong(along, cap, knee)`, tested),
    so the quarter view's stair-stepped back-face patch is gone and the
    chase view, whose elevation is 0.68 and up, keeps its shading.
  - The trail's AGE as a world-space key. The fragment reads the breaking
    buffer's `behind` (meters along the course from the hull's center,
    written by `unpack` for every texel) and takes (behind - L / 2) over
    the speed: seconds since the transom passed, the same from every
    camera. The chase view's judged crop lies 5 to 21 m behind the
    transom (0.9 to 3.5 s); the quarter view's runs 0 to 50 m, so a key
    that starts at 3.5 s shapes the one and cannot touch the other.
    `ageShade` [3.5, 7, 0.65, 1]: the foam's own light (`foamShade`) goes
    from 1 to 0.65 as the trail ages from 3.5 to 7 s, a brighter core and
    gray old foam (the reference's trail runs from 235 to 150 sRGB,
    t0027.png). `ageOpacity` [3.5, 7, 0.4]: the lace's opacity falls to
    0.4 of itself, so old foam is a see-through film. `wispStretch` 6 with
    `wispAge` [3, 6]: a second read of the raft channel drawn out six
    times along the flow replaces the first from 3 to 6 s, so the old
    trail is sheared into long wisps (two reads mixed, not one read at a
    stretch that varies: a varying stretch is a warp of a coordinate
    hundreds of meters from its origin, and it folds). Round 3 keyed the
    same wishes on the lace's rank and on the amount, which fall at the
    trail's edges as well as with age, and so greyed the chase view's
    core.
  - Built and off (their defaults are their off values): `laceSharp` and
    `coreSharp` (the ramp narrowed to 0.03 of rank where a pixel resolves
    the holes, footprint under 0.12 m, keyed on the lace's size on screen
    and never on the camera), `jacGatherMax` (1.3 moved 516 pixels of the
    chase frame: the gather is not why the quarter band read as one
    sheet), `streakJitter` (the ribbons wander across the flow with the
    clumps) and `edgeStreaks` (the thin-foam gate follows the streaks);
    the last two each moved about a tenth of the chase crop for little
    gain at the quarter view, so they wait for a critic's call.
  Judged: the chase view kept its round-2 win (125 crop pixels moved);
  the quarter view LOST (medium): "a continuous smeared veil with one
  uniform brush direction and cloud-soft edges everywhere ... a stretched
  noise mask painted over the swell"; wanted "a broken mat of separate
  foam clumps with ragged, high-contrast borders that thin into scattered
  flecks", a fade, grain inside the white, a darker disturbed rim where
  foam meets clear water, foam piled on crests.
- **Round 5 (the structure of the trail; the lace's shape on screen).**
  The two judged crops show the SAME water: foam 0.5 to 4 s old
  (`wake/r4/age-map-quarter.png`; round 4's age keys reached only the
  quarter crop's right edge). Round 5 built the structure the quarter
  critic asked for, each a `WakeLook` field whose off value adds no node
  (`r4` reproduces round 4's frames to 0 pixels), and first gated all of
  it on the view, so the chase crop got exactly 0 of it. THE LEAD RULED
  THAT OUT: foam tearing is a property of the water, and a wake that is a
  whole sheet from behind and islets from the side changes character as
  a player orbits the boat, the fault class of GG-311 (the foam piece's
  camera-pitch key). So since round 5b the structure applies at EVERY
  view, world-space only, retuned so the chase view holds round 2's
  traits (a dense core that splits into lanes, widens and frays, foam of
  uneven opacity that thins with age):
  - `clumpTear` [0.45, 0.55, 0.9] on the clumps channel at a 12 m
    tile (`clumpTearTile`), a REMOVAL-ONLY tear (a mean-preserving one
    draws flat chunks, the foam piece's round 5): the cover keeps itself
    where the field is over the top, loses the strength of itself under
    the foot, never in the core, gated by the amount (`clumpTearAmt`
    [0.3, 0.7]: the band's middle stays a whole mat, its edges and tail
    break into islets) and growing with the trail's age (`clumpTearAge`
    [2, 6]), with the raft's peaks over `fleckKeep` 0.85 left
    as scattered flecks between the clumps.
  - `sideSharp` 0.7: the lace's ramp narrows to 0.03 of rank
    where a pixel resolves the holes (footprint under 0.12 m, the
    texture's size on screen): high-contrast borders.
  - `pinholes` [0.5, 1.1]: the raft at a 1.1 m tile at its peaks (the
    top sixth) cuts that share out of the alpha where a pixel resolves
    them: the grain inside the white.
  - `darkRim` [0.6, 0.3]: the band of lace just under the threshold,
    outside a patch and the core (SUB_REACH of rank; the submerged glow
    gives way by the same share), draws as thin foam at that shade of the
    foam's light: matte, dark, no glints, the "aerated shadowed water"
    where foam meets clear water.
  - `crestPile` [0.5, 0.4]: the wake's own height (buffer B) raises
    the amount on a crest by the gain at +h0 and drains it at -h0, so the
    foam lies on the swell.
  - `sideFade` [2, 8, 0.5]: the amount falls to the floor of itself
    from t0 to t1 s: the thinning tail.
  What does depend on the view, and may (the same ruling), is how the
  lace's anisotropy lands on screen: a hole drawn out 1.8 times along the
  flow is seen along the flow (chase) at about 1.1 times, foreshortened,
  and across it (quarter) at 3 to 4, the "one uniform brush direction".
  `sideStretch` [0.6, 1] bounds it: second reads of the raft and
  the streaks at smaller stretches replace the first (two fixed reads
  mixed; a stretch that varies folds the coordinate) by sideW =
  smoothstep(0.85, 1.25, sideR), where sideR is one pixel's extent across
  the flow over its extent along the flow on the flat sea plane
  (`wakeSideRatio`, tested: with the camera h up, d out and phi off the
  flow, r^2 = (h^2 + d^2 sin^2 phi) / (h^2 + d^2 cos^2 phi); 0.55 to 0.8
  over the chase crop, 1.24 to 2.2 over the quarter crop; the same ratio
  from the sample coordinate's screen derivatives carries each chop
  facet's tilt and leaked onto 1.9% of the chase crop). Like anisotropic
  filtering it changes only how the same lace samples on screen: the
  mixed raft read is made uniform again (`wakeMixUniformCdf`, tested; a
  mix of two uniform reads is trapezoidal and would cover more of a dense
  trail and less of a thin one), so the cover at a given amount is the
  same at every view. THE ORBIT PROOF (`wake/r5b/orbit.mjs`, `orbit-o1.png`
  and `-alpha.png`): one camera 40 m out and 14 m up circling the point 20
  m behind the transom from behind to abeam in eight steps, sea and boat
  pinned, the surface's foam-alpha view captured with the key on and with
  the keyed read bypassed: the foam amount over the trail's pixels is
  0.96 to 1.04 (the control, the same read re-sampled at another tile offset with no key, spreads 0.93 to 1.06) of the bypassed read's at every step (alpha pixels moved
  by over 8/255: 0% from behind, 18% at 13 degrees, 51 to 78% from 26 degrees on; in the lit frames 0.4% to 33%, the re-sampled texture; the amount, the
  islets and the structure the same). Round 4's film and wisps are off
  (`WAKE_LOOK_ROUND5`; the sweeps `wake/r4/sheet-t1.png` to `-t3.png`
  for the paths one at a time, `sheet-u1.png` for the world-space
  retune, both crops per candidate).
- **Round 6 (one structure from the stern to the tail, in world space).**
  The round-5b critics split each view (ours won one order and lost the
  other) and named one structure at both: a bright opaque core at the
  stern that opens within a boat length into lace with dark windows of
  many sizes drawn out along the flow, then translucent streaks, with
  soft haze edges and no glints anywhere in the wake. Every round-6 path
  is a `WakeLook` field whose off value adds no node (`r5` against the
  lead's round-5b frames `ours/r6b-*`: 0 of 1,440,000 pixels, largest
  change 0, at the chase, quarter and high poses). Every key is world
  space: the trail's age, its offset from the track (the breaking
  buffer's `lateral`, read with `behind` in one fetch), the wake's own
  amounts and its own slope. No new key depends on the camera, so no
  sweep proof is needed beyond round 5b's for `sideStretch`.
  - `glintSlick` [1, 0.05, 0.4]: the reader returns the surface's
    optional `glint` share, (1 - foam) (1 - smoothstep(0.05, 0.4, s)),
    s the larger of the white-water amount and the bubble cloud. Churned
    water is matte foam over a slick that damps the short waves, so the
    sparks and the sun lobe die over the whole lane (1.5 times the
    churn's width, clearing over 30 s), not only under solid foam. Under
    the old rule, 1 - foam, a spark on half-cover foam kept about 29% of
    its light and an HDR spark clipped to white: the chase critic's
    "glint confetti".
  - `laceNet` [1, 3, 1, 1.6, 0.7]: THE NET LACE (`wakeNetImage`, a second
    512 x 512 texture built once, about 0.6 s on the CPU, only when the
    field is on). Foam walls round windows of open water: one jittered
    point per cell, cells joined to their neighbors by bond percolation
    (chance 0.38 and 0.3) so a window is one cell to a dozen, walls of
    varying thickness bent by a warp, a ragged speckle at their edges;
    a coarse net (9 cells a tile) and a fine one (23), ranked, read at
    `WAKE_NET_TILE_M` [12, 9] x 0.7 and drawn out 1.6 times along the
    flow, equalized by the same coverage-table code with
    `WAKE_NET_WEIGHTS`. From 1 to 3 s of the trail's age its cover
    replaces the raft's (the covers are mixed, not the ranks, so an
    amount still covers itself). The raft's threshold draws islands
    (137 components at a cover of 0.3 on a 128 tile), the "soft, cottony
    blobs with no interior"; the net draws one connected lace (2
    components, 97% in the largest) round windows whose areas span more
    than a decade (tested). Tried first and kept off: `laceFold`, the
    raft's rank folded at its median (uniform again, the same topology),
    which traced a ring round every popped cell, a doily (`wake/r6/
    sheet-s1.png`).
  - `envelope` [0.1, 0.5, 3, 0.25] and `edgeLines` [0.5, 0.1, 0.8, 5]: the
    turbulent wake has an edge, from the transom's corners (half-breadth
    3 m) out at 0.1 m a meter behind the transom. The thin foam the
    wake's own crests spill outside it keeps a quarter of itself from
    0.5 to 3 m past it (that foam made the trail widest at the stern,
    "a three-pronged fan"), and two lines of white run along it, amount
    0.5 e^(-age / 5 s), 0.8 m across: the wake is narrow at the stern,
    widens as it trails, with two firmer outer edges that soften as it
    ages.
  - `backSlope` [0.5, 0.12, 0.3]: on the stern wave's back slope (the
    wake's slope along the direction of motion from 0.12 to 0.3) the
    amount goes to the lace's full cover at most, less half of itself,
    so the hump behind the transom opens into lace behind a white lip
    (the quarter critic's "whipped cream"). A cut from slope 0 took
    the foam off the trail's own gentle transverse waves in bands across
    the chase view, and a cut without the cap left the core (amounts of
    2 and more) white.
  - `haze` [0.15, 0.25, 0.85]: the band of lace 0.25 of rank under the
    threshold draws as a film of up to 0.15 alpha at 0.85 of the foam's
    light: a soft bubble haze at every foam edge, in place of round 5's
    dark rim (off) and the "hard binary mask".
  - Retuned round-5 fields: the amount to 0.6 of itself from 2 to 8 s
    (`sideFade`, was 0.5), the opacity to 0.75 of itself from 2.5 to
    6 s (`ageOpacity`), the pinholes off (the "dalmatian spatter"), the
    submerged glow `subGain` 0.2 (with the rim off, 0.75 read as a milky
    lane).
  - `debugView` (0 off) draws the amount's contours (1), the age in
    0.5 s bands (2), the cover (3) or the glint share (4) as the foam
    alpha, for `setDebug(2)`; the rigs are in `wake/r6/` (`sweep.mjs`,
    `sheet.py`, `pair.py`, `ageMap.py`, which lays the flat plane's age
    and track lines over a judged frame: the chase crop holds 0.85 to
    3.5 s, the quarter crop -0.3 to 3.6 s).
  Still open: the lane's own short waves are not damped (the surface's
  normal is its own; a reader cannot subtract from it), so between the
  walls the lane is flat and pale where a real slick is glassy and dark;
  and the quarter view has no darker turbulent centerline.
- **Round 7 (the core band; soft walls; the aerated glow).** Round 6 WON
  the chase view in both orders (medium, medium: "a dense, bright core
  right behind the hull that widens into a fan and breaks into streaky,
  marbled lace"; weak points "streaks too thin and wiry, like marble
  veins", "a few closed rings") and LOST the quarter view in both (high,
  high: "an even net of thin, crisp, bright-white strands with no dense
  core anywhere"; no aeration, razor edges, no fade, no wake shape). The
  two crops hold foam of the same ages (0 to 3.6 s), so the fix is in
  world space, and no new key depends on the camera. Every path is a
  `WakeLook` field whose off value adds no node: `r6` against the lead's
  judged round-6 frames `ours/r6w-*` differs on 0 of 1,440,000 pixels
  (largest change 0) at the chase, quarter and high poses.
  - `coreBand` [0.6, 1.6, 1.2, 0.3]: the propeller's race down the
    track's middle is deeper and more aerated than the churn at its
    sides, so its white holds together longer. The structure's age key
    (the net, the fade, the film, the tear, the foam's light) is the
    trail's age less 1.2 s within 0.6 of the churn's width of the track
    (WAKE_STERN_HALF_WIDTH B (1 + d / 20)^0.35), none by 1.6 of it; and
    there the back slope's cut and a trough's drain (`crestPile`) keep
    only 0.3 of themselves. The debug view of the amount showed why the
    last part is needed: the stern wave's back slope and the transverse
    trough behind it cross the track 5 to 20 m behind the transom, and
    with round 6's cut and drain the middle of the trail there was its
    thinnest water, a U round the track, where the race is densest.
  - `netSoft` 0.28 and `laceNet` scale 0.9: the net's walls take their
    own cover ramp, wider than the sharpened one, so their flanks are a
    see-through falloff; the coarser tile makes them thicker. Tried and
    left out: the net drawn out 2.2 times (the chase view's walls turned
    to wiry streaks).
  - `aerate` [0.35, 0.6, 0.6] and `subGain` 0.45: the bubble weight gains
    0.35 as the wake's own white-water amount passes 0 to 0.6, and the
    glow moves 0.6 of the way to `BUBBLE_MILK` (0.13, 0.22, 0.21), a
    paler, whiter turquoise: milky churned water under and round the
    foam, the chase critic's "lighter turquoise glow" and what both
    quarter critics missed.
  - `haze` gated by the amount from 0.12 to 0.4 (round 6: 0 to 0.25, which
    drew the net's faint outlines over the open water); `edgeLines` 0.3
    over 4 s, so the trail is one fan, not three prongs; `sideFade` to
    0.4 from 1 to 4.5 s and `envelope` keeping 0.12 past the edge, so the
    old edges are sparse. Sweeps `wake/r7/sheet-s1.png` to `-s6.png`.
  Still open: at the quarter view the foam covers most of the stern
  wave's face (the band is the trail's full width, about 16 m at 1 to 3
  s, seen across), with no dark water under the band as the reference
  has; the fade to the right of the crop is weak (it ends at 3.6 s); the
  small specks along the crop's top edge are the far sea's own sparks and
  foam, not the wake's.
- **Round 8 (the core boils; the lane churns; no view key).** Round 7 WON
  the chase view in both orders again (medium, medium; both judges named
  the fresh core "a blown-out, textureless white smear" and one "a pale
  haze" over the gap between the trail's two arms) and LOST the quarter
  view in both at medium (round 6: high): "one flat sheet of speckles and
  blobs at one scale, draped over a smooth swell", holes round and of one
  size, no surface disturbance of the wake's own. The core was not
  clipped: 200 to 219 sRGB with a spread of 17, against the references'
  176 to 209 (spread 11 to 27): it was flat and pale, the pockets and the
  aerated glow filling every gap with milky light. Every path is a
  `WakeLook` field whose off value adds no node: `r7` against the lead's
  judged round-7 frames `ours/r7w-*` differs on 0 of 1,440,000 pixels
  (largest change 0) at the chase, quarter and high poses.
  - `coreBoil` [0.85, 6, 0.65, 0.75, 0.35]: in the core (coreW) the raft
    at a 6 m tile, drawn out twice along the flow, under 0.35 of its rank
    clears 0.85 of the alpha and of the whole bubble weight (the cloud,
    the aerated glow and the pockets' glow): dark upwelling boils of many
    sizes streaked along the path. Over the rest the foam's light runs
    from 0.65 to 1 with the same field (clumps of uneven light) and from
    0.75 to 1 with a 1.1 m bubble grain where a pixel resolves it
    (footprint under 0.15 to 0.4 m). The boils first cleared only the
    pockets' glow and read as gray, milky holes; the cloud and the
    aerated glow lit them.
  - `churnSlope` [0.2, 6, 4]: the lane's own turbulent lumps. The clumps
    channel at a 6 m tile, its gradient over a 64th of the tile, tilts
    the surface by up to about 0.2 (clamped at 0.35) where the wake's
    own white water is (buffer A, 0.05 to 0.5), fading as e^(-age / 4 s)
    and with the wake's slope past a 1.5 to 6 m footprint. It joins the
    wake's slope AHEAD of the back-face cap: added after it, it turned
    facets away from the quarter view's low eye into round 3's flat gray
    stair-stepped patches.
  - `aerate[3]` 1: the glow keys on the amount the read shaped (after the
    back slope, the pile, the fade, the envelope), so the gaps the read
    opens between the arms are clearer water.
  - `netFine` [3, 0.9]: the fine net alone drawn out 3 times along the
    flow, so its small windows become streaks along the path while the
    coarse walls keep 1.6 (2.2 on the coarse net made the chase walls
    wiry, round 7).
  - `sideStretch` [0, 0], OFF: round 5's on-screen bound squeezed the
    holes' stretch to 0.6 where a pixel is seen across the flow, which is
    why the quarter view's holes were round on screen, "an isotropic
    speckle ... like a tiled noise texture". It was the read's last
    view-keyed look path; with it off, no look keys on the camera (the
    back-face cap is a visibility bound, not a look).
  - `backfaceCap` 0.6 over `backfaceKnee` 0.25 (were 0.9 and 0.3): with
    the lace moved, more of the stern wave's far face showed through as
    flat gray back-face patches; the tighter cap halves them. The rest
    are the sea's own facets turned from a low eye beyond the stern
    wave's crest (they show in `r7` too, where the foam hid most of them),
    the surface's back-face rule, not the wake's.
  Sweeps `wake/r8/sheet-s1.png` to `-s3.png` and `-g3.png`. Still open:
  the quarter view's foam still covers most of the stern wave's face and
  has no dark water under the band; the fade to the right of that crop
  is weak; the crest's top edge is the wave's own smooth silhouette.
- **Round 9 (the quarter view's core, sides and strokes).** Round 8 WON the
  chase view in both orders again (medium, medium: "a darker, churned strip
  down the center from the stern with brighter foam arms spreading from it
  in a V") and LOST the quarter view in both (medium, medium: "a uniform,
  one-direction smear of white strokes, like a motion-blurred texture";
  "the streaks radiate from a point ... like a radial blur"; no fade, no
  clumps, no thickness). A sweep with one round-6 to round-8 path off at a
  time (`wake/r9/qsheet-dg.png`) showed that no single one made the smear:
  it was the lace's stretch along the flow landing on screen across the
  flow at 3 to 6 times (the fine net at 3 since round 8, with round 5's
  on-screen bound off), plus a trail whose middle and sides were one
  density past the lace's full cover. Every path is a `WakeLook` field
  whose off value adds no node: `r8` against the lead's judged round-8
  frames `ours/r8w-*` differs on 0 of 1,440,000 pixels (largest change 0)
  at the chase, quarter and high poses.
  - `sideStretch` [1, 1.5] and `sideNet` [1, 1.3]: round 5's filtering-like
    key is back, gentler (round 5: 0.6 and 1, and round 7's quarter critics
    read "round cells"), and it now bounds the coarse and the fine net
    too: second net reads at those stretches, their own offsets, the rank
    re-equalized (`wakeMixUniformCdf`). Seen along the flow (the chase
    pose, sideR 0.55 to 0.8) the key is 0 and the chase crop is round 8's
    to the pixel with the key alone. THE ORBIT PROOF (`wake/r5b/orbit.mjs
    r9 - sideStretch:0/0,sideNet:0/0`, `orbit-r9.png` and `-alpha.png`):
    the foam amount over the trail with the key on is 0.95 to 1.10 of the
    bypassed read's at the eight azimuths (1.000 from behind, 0.98 to 1.10
    from 26 degrees on; round 5b's key read 0.96 to 1.04 and its
    re-sampling control 0.93 to 1.06; the 1.10 at 39 degrees is the one
    step past that control); the islets and the structure are the same,
    only the texture's stretch changes. The streaks' mix is not
    re-equalized (as in round 5), which is the likely reason for that step.
  - `coreBand` [0.7, 1.6, 4, 0.3] (delay 1.2 -> 4 s) with `bandFade` [1.5,
    4, 0.55]: the core band keeps the raft's clumped lace with its dark
    holes (and round 8's boils) across both crops, the net only at its
    sides and far behind, and the band's amount falls to 0.55 of itself
    from 1.5 to 4 s of the TRUE age (its other keys are delayed): a core
    that thins as it trails.
  - `sideThin` [0.5, 1, 0.5, 0.5, 2]: between 0.5 and 1 of the churn's width
    from the track the amount falls to half, growing in from 0.5 to 2 s,
    before the edge lines are added: past the lace's full cover (0.82)
    the Gaussian churn drew the middle and the sides as one white.
  - `edgeLines` [0.6, 0.1, 1.3, 5] (was 0.3, 0.9 m, 4 s): the two firmer
    outer edges, now the V arms the chase judges praise, standing clear of
    the thinned sides.
  - `clumpShade` [0.25, 0.3, 0.2]: the foam's light is 0.75 at the lace's
    threshold, white by 0.3 of rank over it, and a heap's down-sun flank
    (the clumps' slope toward the sun) loses up to 0.2 more: a bright top
    and a shaded rim and flank (the quarter critics' "flat like a decal").
  Still open: the quarter view's foam is broken lace patches where the
  reference is one soft continuous band with dark holes; the foam at the
  stern wave's crest ends in the crest's own smooth silhouette (a vertex
  lift from the churn would have to be 0.3 m or more to break it, far
  over the churn's slope); the chase view's centre behind the core is now
  milky water with little foam, which one round-7 chase critic called "a
  pale haze".
- **Round 10 (one near-solid churned band, torn).** Round 9 WON the chase
  view in both orders (medium, medium; the fourth round in a row) and LOST
  the quarter view in both (high, medium: "one even cellular lace with
  round, same-sized holes ... should have a dense, nearly solid white core
  along the wake line with large, irregular dark tears in it"; "broad
  diagonal sheets that fill the frame"; a hard straight line on the
  crest). Every quarter verdict since round 6 asked for the same thing,
  and seen from the side ANY lace network (the raft's cells, the net's
  windows, whatever its stretch) reads as cells, so round 10 stops tuning
  the lace and makes the core band's young foam not a lace. Every path is a
  `WakeLook` field whose off value adds no node: `r9` against the lead's
  judged round-9 frames `ours/r9w-*` differs on 0 of 1,440,000 pixels
  (largest change 0) at the chase, quarter and high poses. No new key
  depends on the camera (the tear field is in the trail's frame; the rest
  is age, offset, amount and the wake's own height).
  - `coreSolid` [1, 5, 0.25, 0.05, 0.25, 0.93, 0.3, 0.7, 0.6, 0.25, 1]:
    within 0.3 to 0.7 of the churn's width of the track, where the amount
    is over 0.3 to 0.75, the lace hands over to a cover of 0.93 torn where
    the tear field (the clumps channel, five octaves of unranked value
    noise, at a 5 m tile drawn out twice along the flow) is under 0.25,
    that threshold rising by up to 0.25 with the trail's age over 4 s and
    toward the band's edge, over 0.05 of the field: a few irregular voids
    per band width, from hand-sized to several meters, that multiply as
    the mass ages. The voids clear the glow, the haze and the submerged
    light, so they are dark water. Round 8's boils cut the mass too (the
    chase view's "darker, churned strip down the center" stays). Its
    light replaces the other light terms: 0.6 to 1 over its heaps (the
    field at a third of the tile) and at its voids' rims, 0.25 of it a
    bubble mottle from the raft. First builds: the band's full width at a
    14 m tile drew one flat grey sheet with a few huge voids (the other
    light terms multiplied it grey, and the haze and glow filled the voids
    with a milky film).
  - `ridgeTear` 0.06: the back slope's cut starts up to 0.06 of slope
    earlier or later with the tear field, and the solid band's void
    threshold rises by 0.06 on the wake's highest crests (0.35 to 0.6 m):
    the foam's top edge along the stern wave's crest is torn. At twice
    that, from 0.2 m, the tear cleared most of the young mass (it lies on
    the stern wave's crest) and left cottony islands.
  - `crestOut` 0.3: outside the core band the crest pile's gain is 0.3 of
    itself; the stern wave's broad face is one long crest across the
    track, and the pile raised thin foam over all of it.
  - Retuned: `sideThin` floor 0.3 (was 0.5), `envelope` keep 0.05 (was
    0.12), `bandFade` to 0.45 from 1 to 3.5 s, `edgeLines` 0.45 over
    1.1 m and 4 s. The quarter crop's coverage (pixels over 150 sRGB)
    fell from 43% (round 9) to 31% (round 5b 31%, the reference 24%); the
    chase crop's from 38% to 25% (the reference 35%).
  Sweeps `wake/r10/qsheet-s1.png` to `-s8.png` and `csheet-*`; `cover.py`
  measures the coverage. Still open: the solid mass reads soft and
  cottony up close; the quarter view's older foam below the band is still
  the lace; the reference's band is continuous across its crop where ours
  fades into lace patches by the crop's right edge.
- **Round 11 (an opaque young core of dense lace).** Round 10 SPLIT the
  chase view (side A lost: "a blurry white smear under a foggy haze
  column ... it should be crisp foam lace (bright bubble clumps with sharp
  holes of dark water between them)"; side B won) and LOST the quarter
  view in both (medium, medium: "a thin, semi-transparent milky wash";
  "the water's color bleeds through everywhere, so even the dense parts
  never reach the solid white of fresh churn"; the voids "smooth, glassy,
  clean-edged cutouts"; "diagonal stripes on a big rolling wave face").
  The lead landed the reader's optional `opacity` share (the surface's
  foam cap 0.85 + 0.15 opacity; 0 pixels with no reader field). Every path
  is a `WakeLook` field whose off value adds no node: `r10` against the
  lead's judged round-10 frames `ours/r10w-*` differs on 0 of 1,440,000
  pixels (largest change 0) at the chase, quarter and high poses. No new
  key depends on the camera.
  - `coreOpacity` [0, 3, 1]: the solid band's alpha rises to 1 and the
    reader returns its weight (times the mass, so not in the voids) as
    `opacity`, both falling over 3 s of the trail's age: the young core
    reaches solid white, the older foam and the lace stay translucent.
    Alone it changed little (0.1% of the quarter crop over 180 sRGB): the
    mass itself was the soft part.
  - `coreLace` [0.85, 0.04]: inside the mass the lace's own rank is cut at
    a cover of 0.85 over a sharp ramp. From above it is crisp clumps with
    small dark holes of many sizes (the chase judges' ask); from the side
    the holes foreshorten and the band reads dense (round 5b's split win
    at the quarter view was this: a dense raft seen at a graze).
  - `coreTear` [0.4, 2.5, 0.12, 1]: the tear field mixes in a second read
    at 2 m (voids of many sizes, ragged edges); each void is ringed by the
    lace over 0.12 of the field under its edge, so the mass thins through
    lace into the water; a void clears the whole glow (round 10: 0.8). With
    `coreSolid`'s rim at 0.06 of the field and its light down to 0.55.
  - Swell keys cut, since both quarter critics read the band as "diagonal
    stripes on a big rolling wave face ... it should follow the boat's
    path": the sea's folding gathers the foam at most 1.2 times (was 1.8),
    the crest pile is 0.25 (was 0.5), the back slope's cut 0.3 (was 0.5).
  - `edgeLines` back to round 9's [0.6, 0.1, 1.3, 5], the V arms both
    round-9 chase judges praised.
  - Tried and left out: `ageShade` on the delayed age (no pixel moved: the
    trail's visible foam is inside the core band, where the delayed age is
    near 0); a darker void rim (light 0.5) and a wider lace ring (0.15),
    which greyed the chase core into mottled smudges.
  Coverage (pixels over 150 sRGB): the quarter crop 38% (round 10 31%,
  the reference 24%), the chase crop 32% (round 9 38%, the reference
  35%). Sweeps `wake/r11/qsheet-s1.png` to `-s3.png`, `csheet-*`. Still
  open: the quarter band's older part below the core is still lace
  streaked diagonally across the stern wave's face; its voids are dark
  teal where the reference's are grey-blue (the sea's own body color);
  the quarter crop's coverage is back over the reference's.
- **Round 12 (the trail's core is a layer of foam, not a lace).** Round 11
  WON the chase view in both orders (medium, medium: "lanes along the
  direction of travel ... foam densest and brightest near the hull that
  breaks into ragged patches as it ages"; one note, "the lanes are too
  parallel and evenly spaced") and LOST the quarter view in both (medium,
  medium, the sixth quarter loss in a row: "the same scattered, holey lace
  everywhere"; "parallel diagonal streaks like brush strokes ... punched
  full of same-size round holes"; hard-edged dark blobs at the crop's
  center). The lead's resolution test (wk12e-A: our frame at the
  reference's pixel scale lost with the same faults) showed that the gap is
  structure, not sharpness. A fresh builder read the twelve quarter
  verdicts as one ask and every build before as one fault: the trail's
  foam was always a THRESHOLD of a lace (the raft's popped cells, the net's
  windows), a cut through a pattern of one cell size, with no height. So
  round 12 draws the trail's CORE as a layer of foam of a varying thickness
  (`wakeMassImage`, the look's `mass` fields), world space only (the
  trail's frame, its age and its offset from the track); no key depends on
  the camera. Every path is a `WakeLook` field whose off value adds no node
  and no texture: `r11` against the lead's judged round-11 frames
  `ours/r11w-*` differs on 0 of 1,440,000 pixels (largest change 0) at the
  chase, quarter and high poses.
  - THE TEXTURE (`wakeMassImage`, 512 x 512, built once at mount, about
    0.26 s): R the thickness (gradient-noise fBm in five octaves, ranked:
    uniform); G the veins (the magnitude of a gradient-noise fBm drawn out
    1.7 times along the flow: its zero set is a network of meandering lines
    that never close into cells); B and A the slope of the thickness
    blurred over a fiftieth of the tile (the relief). One tap gives all
    three. Gradient noise, not value noise, so no threshold lines up on the
    lattice.
  - THE READ (in the white-water branch, after the lace): the layer's
    density across the trail is full to 0.3 of the wake's edge (the
    transom's corners, widening 0.1 m a meter) and gone by 0.62, that edge
    moved by up to 0.45 of it with the vein field (wisps along the flow);
    1.25, falling to 0.7 of it from 0.5 to 6 s. The thickness is that plus
    the R channel at a 10 m and a 3.7 m tile (the second turned 35 degrees:
    along the axis its short tile repeated every 5 m down the trail), drawn
    out 1.3 times along the flow. Boils, where the thickness is in its
    lowest 12% (19% on the track, the race), thin the layer by 0.8 of its
    density and keep half the glow (cleared, they read darker than the sea,
    round 11's "ink cut-outs"). The alpha rises from 0 at a thickness of
    0.38 to 1 at 0.62, with a film of 0.22 in the thin places. A few popped
    bubbles: the lace's own rank cut at a cover of 0.95 falling to 0.85 by
    4 s, over a soft ramp, keeping 0.25 of the alpha. On the wake's own
    crests (0.3 to 0.55 m) the layer thins by the noise, so the stern
    wave's crest line against the far water is ragged. Its light: the
    relief (0.3 m a unit of thickness, and 0.8 m a unit of the band's own
    profile across the trail, so the band is a raised mass with a flank
    toward the sun and one away from it), 0.88 in its thin places and at a
    bubble's rim, gray to 0.82 by 4 s, 0.9 of the white; the soft streaks
    along the flow (the vein field) go mostly into the alpha, thinner foam
    through which the water shows bluish, since as light alone they read as
    brown, dirty foam. Its opacity share rises from 0.7 to 1.05 of
    thickness. It hands over to the lace from 5 to 8 s, past both judged
    crops. Round 11's lace keeps the band's sides and the two arms, which
    are thinner: the sides to 0.25 of their amount (was 0.3), the edge lines
    0.5 over 1.2 m and 4.5 s (were 0.6, 1.3 m and 5 s).
  - Built and off, each for a reason a capture showed (the `WakeLook`
    docs): `massVeins` (the vein lines cut out of the layer: cracked ice
    from above), `massPores` (a sharp cut of a third, finer thickness read:
    flat camouflage shapes), `massWisp` with `massArms` (the arms drawn by
    the layer, its thin foam gathered along the vein lines: in the quarter
    view it clears the round-holed lace beside the band, but from above
    the arms become vertical translucent smears, a round-11 chase judge's
    "smeared vertically"; `qsheet-s23.png`, `csheet-s23.png`; without the
    gathering, floating cotton patches). Tried and dropped: a
    billowed heap field for the relief (crumpled foil), the relief at
    0.5 m a unit (mottled, dirty), the layer with no bubble cut (a
    textureless white slab from above, the round-10 chase fault), the layer
    over the trail's whole width (cotton clouds from above).
  - Coverage (pixels whose smallest channel is over 150 sRGB, which leaves
    out the bright turquoise sea): the quarter crop 26% (round 11 24%, the
    reference 20%), the chase crop 20% (round 11 19%, the reference 15%).
  Sweeps `wake/r12/qsheet-s1.png` to `-s23.png` and `csheet-*`; the
  offline model of the read `wake/r12/tools/proto.py`; the final pairs
  `wake/r12/final/`. Still open: in the quarter view the band still lies on
  the stern wave's bright turquoise face (the sea's own color; the
  reference's water is a dark blue), and the lace beside it (the near arm,
  lower left of that crop) still has the raft's round holes; the chase
  view's core is softer than round 11's crisp lace.
- **Round 13 (the layer opaque and lit as foam).** Round 12 LOST the
  quarter view in both orders (medium, medium) and the chase view in the
  order the lead ran (low; round 11 had won it in both). The quarter
  critics read the band's SHAPE as the nearest yet (one continuous band,
  soft holes, the lace pushed to the side) and its TONE as wrong: "a flat,
  translucent gray-white smear painted onto the surface", "gray smudged
  streaks running along it, like a dirty painted decal", "teal bleeding
  into the white", "its brightness does not change with the wave slopes";
  the chase critic: "soft, smeared and milky ... a milky white veil lies
  over the whole wake band, the gaps between the core and the arms
  included", the core's blobs "large, round and similar in size". Three
  findings, each measured: round 12 sent the soft tonal streaks mostly into
  the alpha, so the band was a film the turquoise sea showed through; its
  relief light (the cosine of the heaps' normal) had a mean of about 0.87,
  since every slope that does not face the sun is darker, so the band was
  gray (the debug view `debugView` 9); and the whole bubble glow lay across
  the trail's full width. Every round-13 path is a `WakeLook` field whose
  off value adds no node (`massSlope`, `massSun`, `massGrain`, `massGlow`,
  new; `debugView` 8 and 9 draw the layer's light and relief). The judged
  crops of `r11` and `r12` against the lead's `ours/r11w-*` and
  `ours/r12b-*`: 0 pixels over 8/255 at the chase and quarter crops and the
  whole high frame. (The distance builder's surface saves of 06:29 and
  06:45 moved the far sea: 84,591 pixels of the chase frame, rows 53 to
  269, and 43,763 of the quarter frame, rows 174 to 309, the same count for
  both presets and none in either judged crop.) No key depends on the
  camera.
  - OPAQUE: the alpha from 0 at a thickness of 0.45 to 1 at 0.55 with no
    film, the opacity share full from 0.7; no tonal streaks (tone 1); the
    band's edge moves only 0.12 of it with the veins.
  - LIT AS FOAM: the relief's light is the slope toward the sun alone,
    1 - 1.2 (slope . sun) / sun.y, clamped to 0.75 and 1.2 (`massSun`: a
    mean of 1), times the wake's own slope (`massSlope` 0.6: dimmer on the
    stern wave's face away from the sun), times the raft channel
    (`massGrain`: 0.65 in its gaps and popped cells, 1 over 0.7 of it; a
    bubble speckle to 0.75 at a 1.1 m tile where a pixel resolves it; 0.35
    less light at a popped bubble's lip), 0.65 in the layer's thin places,
    never under 0.45. Keyed on the mixed lace rank instead of the raft, the
    grain drew broad gray blotches (its clumps and patches).
  - Why the tone map matters: at a foam light of 0.9 and over, the band sat
    on ACES's shoulder (50th to 90th percentile 203 to 211 sRGB: flat
    white, whatever the light did); the reference's foam runs 152 to 198
    (10th to 90th percentile) with a median of 179. The band's foam now
    runs 161 to 210 with a median of 184.
  - DARK HOLES: more popped bubbles (the lace's rank cut at a cover of 0.84
    falling to 0.66 by 4 s), a film of 0.1, each clearing half the glow
    (`massGlow[3]`).
  - THE GLOW STAYS UNDER THE CORE (`massGlow`): the whole bubble glow keeps
    0.35 of itself past 0.8 of the wake's edge, all of it inside 0.45: the
    water between the core and the arms, and round the band at the quarter
    view, is clear and dark.
  - Round 11's arms back (edge lines 0.6 over 1.3 m and 5 s, sides 0.3); the
    density falls to 0.5 of itself by 4.2 s.
  - Coverage (smallest channel over 150 sRGB): the quarter crop 19% (round
    12 26%, the reference 20%), the chase crop 16% (round 12 20%, the
    reference 15%).
  Sweeps `wake/r13/qsheet-s1.png` to `-s11.png` and `csheet-*`; the final
  pairs `wake/r13/final/`. Still open: at the quarter view the band's upper
  left still starts along the stern wave's crest, and the lace beside it
  keeps the raft's round holes; at the chase view the core is broken
  clumps with gray patches, not round 11's fine lace, so round 13 may not
  hold that view.
- **Round 14 (the trail: a new structure for the holes and edges).**
  Round 13 LOST the quarter view (high) and the chase view (medium; round
  11 had won it in both orders), and every judge of rounds 6 to 13, in both
  views, named one fault: "hard-edged white blotches punched with round
  holes of nearly one size", "leopard spots", "Voronoi or Worley dots". A
  fresh builder measured it first (`wake/r14/measure.py`: the judged crops
  at the judged size, foam = the pixels whose smallest channel is over 150
  sRGB; holes = the non-foam regions the foam encloses, 4 px and more):
  round 13's quarter crop had 119 holes, a median of 12 px, a 90th to
  10th percentile area ratio (the SPREAD) of 17.2 and a mean axis ratio
  (the ELONGATION) of 2.36; the reference's quarter crop 27 holes, 43 px,
  24.1 and 3.95, every hole drawn out along the trail (7 and 2 degrees off
  it); the chase crop 78 holes, 9.5 px, 7.8 and 1.92 against the
  reference's 137, 10 px, 11.7 and 2.09. The holes came from the lace (the
  raft's popped cells, the net's windows) and the layer's popped bubbles
  (the same lace's rank), so round 14 replaces the STRUCTURE, not its
  tuning. THE TRAIL (`oceanWakeTrail.ts`, the look's `trail` fields) draws
  every foam pixel of the wake when it is on, and the lace, the net, the
  solid band and the layer are not built (their code moved one level into
  `if (!trailOn)`, node for node). Every path is a `WakeLook` field whose
  off value adds no node and no texture: on today's surface (the distance
  builder's save of 18:30) `r11` and `r13` from the round-14 files against
  the same presets from the round-13 files differ on 0 of 1,440,000 pixels
  (largest change 0) at the chase, quarter and high poses; against the
  judged frames `ours/r13w-*` and `ours/r11w-*` the judged crops move by at
  most 3/255 (r13) and on 123 pixels by 9/255 (r11's quarter crop), all
  from the surface's saves. No key depends on the camera: the trail reads
  the trail's frame, the breaking buffer's `behind` and `lateral`, the age,
  the amount and the lace's slow fields (all world space), and the pixel's
  footprint only to fade the texture to its mean and the grain where a
  pixel cannot resolve them (the texture's size on screen, as rounds 5 to
  13 did).
  - THE TEXTURE (`wakeTrailImage`, 512 x 512, built once at mount, about
    0.4 s in Node; the net and the layer, 0.6 and 0.26 s, are not built
    with it): R a ranked gradient-noise fBm, six octaves from 5 cells a tile
    at a gain of 0.62 (`trailTexture`; at 0.5 most of the field is its
    first octave and a cut draws smooth "cotton" blobs), warped by 0.07 of
    a tile; G a second ranked fBm on its own seeds; B and A the relief of
    R blurred over a 64th of the tile. No cell, no threshold of one scale:
    at a cover of 0.88 its lowest 12% are 124 holes a 256 tile with a 90th
    percentile of 63 texels and the largest 1800, where the raft's
    channel at the same cut is 457 holes, 21 and 1831 (tested).
  - THE FLOW LAYS IT OUT. R is read at a 4 m tile drawn out 1.6 times
    along the flow (a fixed stretch: one that changed with age would fold
    the coordinate, round 4); at the parcel's birth position, s + D, with
    D the jet's displacement aft (`trailShear`, 0.5 m over a 5 m width,
    growing over 2 s; `wakeTrailShearM`) and the lanes' (`trailLanes`: lanes
    of faster and slower water side by side, 1 m, 1.2 m across, wandering
    2 m with the lace's slow warp; `wakeTrailLanesM`), so the foam is
    sheared along the flow, more as it ages, and slides aft with the race.
    The coordinate never folds (its slope along the flow stays over 0.5
    for every offset, age and wander; tested). At 1.5 m over 2.5 m the
    jet drew a symmetric herringbone at the race's flanks.
  - THE AMOUNT EATS IT. The share of the field that is foam is 0.6 of the
    wake's own amount (round 13's churn, deposit, edge lines and fades),
    at least the race's core (`trailCore`: 1.3, full to 0.28 of the wake's
    edge and gone by 0.58, the edge widening 0.11 m a meter so the band
    spreads behind the boat, falling to 0.45 of itself from 0.5 to 3.8 s
    and as e^(-t / 5 s) after, so the band thins inside the chase crop and
    the old trail thins into lace and dissolves: without the tail it held
    0.84 for the whole 200 m of the view from above), times 1 +- 0.15 with the lace's 97 m patches, capped
    at 0.88 (`trailCover`): the densest churn keeps the field's deepest
    lows as holes, few and of many sizes; as the share falls with age and
    toward the edges they grow and merge into lace.
  - THE THIN EDGES FRAY INTO FILAMENTS (`trailFil`): G, read at a 1.4 m
    tile drawn out 1.8 times and turned 30 degrees, enters the rank folded
    at its median (1 - |2 g - 1|: uniform again, high along g's median
    contour, a network of meandering lines of many sizes), its weight 0.2
    where the share is over 0.75 and 0.6 under 0.25 (the mix made uniform
    again, `wakeMixUniformCdf`): the core keeps a few small holes, the edge
    lines and the band's sides are lace. G drawn out 4 times and unfolded
    drew diamond "flames" (sweep s7).
  - OPAQUE, WITH GRADED HOLES (`trailOpac`, `trailFilm`): the foam is opaque
    by 0.12 of rank over the threshold from 0.5 at it (at 0.3 the wide
    translucent fringe drew each patch as a puff of cloud); the holes of
    dense foam keep a film of 0.6 alpha that is gone 0.18 of rank under the
    threshold, so small holes (the field's shallow lows) are gray-blue
    thinned foam and large ones open to the water at their hearts; the
    reader's `opacity` share is the cover where the share passes 0.7 to
    0.95 (solid young churn).
  - ITS LIGHT (`trailLight`, `trailGrain`): 0.66 of the white (on ACES's
    shoulder a brighter foam is flat white: the quarter band's foam runs
    177, 189, 198 sRGB at its 10th, 50th and 90th percentiles against the
    reference's 167, 184, 200; round 13's 173, 188, 211), thin rims 0.12
    darker, a faint relief (0.04 m a unit of R's blurred height) lit by its
    slope toward the sun with a mean of 1, the wake's own slope (0.6),
    gray to 0.88 over 0.5 to 4 s, a bubble grain to 0.88 at a 0.3 m tile
    where a pixel resolves it. The glow (`trailGlow`): 0.15 of the share,
    kept under the core (0.35 of itself past 0.8 of the edge), the open
    holes of dense foam 0.3 clearer.
  - The arms: `edgeLines` 1.2 over 0.8 m, out at 0.18 m a meter (was 0.1)
    and fading over 4 s, so the V arms spread and thin (the round-13 chase
    critic: "the two outer arms stay parallel and keep one width").
  - MEASURED (the final frames `ours/r14w-*`, `wake/r14/final/measure-r14.json`):
    the quarter crop 21.8% white (the reference 20.2%, round 13 19.1%), 115
    holes, a median of 12 px, SPREAD 17.9 (reference 24.1, a factor 1.35),
    ELONGATION 3.57 (3.95, a factor 1.11; round 13 2.36), the holes 7
    degrees off the trail (R 0.97), holes 14% of the foam's area (10.6%);
    the chase crop 21.1% (14.9%, round 13 15.8%), 99 holes, 9 px, SPREAD
    14.9 (11.7, 1.27; round 13 7.8), ELONGATION 2.12 (2.09, 1.01), along
    the flow; the chase crop's white in its young, middle and old thirds
    34%, 30%, 27% (the reference 47%, 49%, 16%; round 13 32%, 34%, 34%).
    The hole COUNT at the quarter view is still four times the reference's:
    the video frame's blur hides holes under about 10 px, and ours are
    crisp.
  Sweeps `wake/r14/shots/s1` to `s21` (`sweep.mjs`, `sheet.py`,
  `measure.py`), the offline model `wake/r14/proto.py`, the final pairs
  `wake/r14/final/`. Still open: at the quarter view our white covers
  about a third more of the crop than the reference's, and the band lies on
  the stern wave's bright turquoise face (the sea's own color; the
  reference's water is dark blue); at the chase view the core reads as a
  soft, cloud-like mass where the reference is a fine lace; the fine
  bubble grain may read as noise up close.
- **Round 15 (the trail graded by its age).** Round 14 LOST the quarter
  view (high: "no dense core ... thin, sharp-edged white lace at one flat
  brightness from end to end", "no fade with distance", "no milky
  pale-turquoise bubble layer under and round the white; ours sits on the
  water like paint") and the chase view (medium: "solid white blobs, shaded
  like clouds ... 'cotton-wool clouds pasted on top of the sea'", it should
  be "a lacy foam network of white strands round dark holes ... over
  lighter aerated water", "no fade", the arms "thin, jagged white lines
  scattered like shader sparkle"). No judge named round holes or leopard
  spots: the trail's structure is kept. Both named one gap, AGE: the
  measure (`wake/r15/measure.py`, round 14's with the age thirds and the
  glow) put round 14's white by age third at 39, 37, 36% (quarter) and 34,
  30, 27% (chase; the reference's 47, 49, 16%), and the water in the
  trail's envelope 19 and 17 levels of luma over the open sea beside it at
  0.14 and 0.11 less saturation, where the references' is 53 and 38 at
  0.41 and 0.42 less: a milky, gray-turquoise water, not teal. So round 15
  grades the trail by its age, world space only (the age, the offset, the
  share): the young foam dense, bright and milky over a whiter bubble glow;
  a lace that opens with age into a network of strands; then loose streaks
  along the flow; then nothing. Every path is a `WakeLook` field whose off
  value adds no node: `r14`, `r13` and `r11` from the round-15 files
  against the same presets from the round-14 files (and `r14` against the
  judged frames `ours/r14w-*`), on the same surface (the distance
  builder's save of 18:30), differ on 0 of 1,440,000 pixels (largest
  change 0) at the chase, quarter and high poses.
  - THE YOUNG CORE: the race's share holds to 1.8 s and falls to 0.12 of
    itself by 3.2 s, then as e^(-t / 1.5 s) (`trailCore`); the young foam
    is 1.5 times as bright to 1.2 s, falling to 1 by 3 s (`trailYoung`); a
    milky film of fine surface bubbles in its gaps, 0.45 alpha round the
    white and 0.45 over the dense share, lit at 0.72 of the white, gone
    from 2 to 4 s (`trailMilk`); the bubble glow gains 1.6 x the share x
    e^(-age / 3 s) and moves to `BUBBLE_WHITE` (0.19, 0.24, 0.24), a paler,
    whiter glow (`trailMilkGlow`). No relief: round 14's 4 m heaps lit by
    the sun were the "cotton-wool clouds"; a fine relief at 0.8 to 1.2 m
    (`trailBump`, built and off) drew a regular ripple.
  - THE LACE OPENS (`trailAge[0..2]`): from 1.2 to 2.6 s the second field,
    folded at its median, takes 0.7 of the rank: a network of strands
    round dark holes, read at 2.6 m (was 1.4 m, a hairline mesh). Only
    where the share is over 0.15 to 0.4 (`trailThin`): at a thin share the
    fold is its median contour alone, one-pixel wavy lines over the open
    water.
  - THEN STREAKS (`trailAge[3..5]`, `trailStreak`): from 1.8 to 3.2 s a
    third read of the second field, at 2.5 m drawn out 4 times along the
    flow and turned -21 degrees, takes 0.7 of the rank, and 0.8 of it
    wherever the share is under 0.15 to 0.4 (`trailThin`); old foam goes
    translucent, 0.65 of its alpha from 2 to 3.4 s (`trailOld`), and gray
    (0.75, `trailLight`).
  - THE ARMS (`trailArms`): the edge lines take 0.8 of their rank from the
    streak read by their own profile, and their share is at least 0.8 of
    it, so an arm is a few long lines broken into dashes.
  - The light 0.62 of the white, its rims 0.12 darker over 0.2 of rank; the
    glow 0.3 of the share, the open holes 0.2 clearer.
  - MEASURED (the default against the references; `wake/r15/final/
    measure-r15.json`): white by age third, the quarter crop 46, 40, 19%
    (round 14 39, 37, 36%; the reference 60, 67, 77%), the chase crop 38,
    33, 21% (34, 30, 27%; 47, 49, 16%); hole SPREAD 15.1 and 10.0 (the
    references' 24.1 and 11.7), ELONGATION 3.27 and 2.56 (3.95 and 2.09);
    the water in the trail's envelope 25 and 19 levels of luma over the sea
    beside it at 0.18 and 0.12 less saturation (the references' 53 and 38 at
    0.41 and 0.42), its mean color (94, 143, 153) and (84, 139, 148) sRGB
    (round 14 (74, 132, 143) and (68, 131, 141); the references (127, 142,
    151) and (129, 162, 164)). The quarter reference's white RISES along
    its crop (its densest foam is its oldest, at the right edge), where
    both critics asked ours to fade with age; round 15 follows the critics
    and the chase reference.
  - THE QUARTER POSE (`wake/r15/poseFit.py`, `poseSheet.py`, the proof
    sheet `wake/r15/final/pose-proof.png`; not changed, the lead's call):
    in the reference the hull's axis (stern to bow) runs 14 degrees above
    the horizontal and the trail 14 degrees below it, the horizon at the
    frame's top edge; in ours both run 24 degrees, the horizon 20% down, the
    view 31 degrees off the course and 16 degrees down. The fit on the flat
    plane (the stern's place in the frame, both angles and the horizon) is
    back 34, side -40, up 22, lookAhead -10, fov 50: the view 59 degrees off
    the course and 25 degrees down, hull and trail at 14.4 degrees.
  Sweeps `wake/r15/shots/s1` to `s9`; the final pairs `wake/r15/final/`.
  Still open: the in-trail water is still more saturated than the
  references' (the glow is added to the body under the fresnel, so at
  these views it moves the color little); the quarter reference's foam
  densest at its old end, against the critics' ask; the old foam's
  translucent flakes may read as a milky smear.
- **Round 16 (the quarter pose re-matched; one connected sheet with a clear
  edge; the calm lane).** Round 15 LOST both views (high, high): its loose
  streaks and old foam drew "thousands of similar crisp white flakes laid on
  ripple crests at one angle, like foam decals or sun glints", over the open
  sea too, so the wake had no edge; its young core read as "a soft white
  haze, like fog or light shining up from under the water"; screen-vertical
  streak bands ran down the chase core. A fresh builder built on round 14's
  trail (no judge has named round holes since) with round 15's streaks,
  flakes, milk and old-foam film off. Every path is a `WakeLook` field whose
  off value adds no node: `r15`, `r14`, `r13` and `r11` from the round-16
  files against the same presets from the round-15 files, on one surface
  (the distance builder's save of 23:03), differ on 0 of 1,440,000 pixels
  (largest change 0) at the chase, quarter and high poses
  (`wake/r16/tools/offproof16.sh`, the files swapped and restored, checked
  with `cmp`); against the lead's `ours/r15L-*` the judged crops differ on 0
  pixels (by at most 3/255), against `ours/r14w-*` on 0 (chase) and 143
  pixels by at most 15/255 (quarter), all from the surface's saves of 21:03
  and 23:03. No key depends on the camera: the sheet reads the offset from
  the track, the distance behind the transom, the age, the wake's own height
  and the trail texture; `trailSoft` is a filtering key (below).
  - THE QUARTER POSE `quarter-m` (the lead's ruling; the viewer mount's POSES;
    `wake/r16/tools/poseFit16.py`, the proof sheet
    `wake/r16/final/pose-proof16.png`). The reference's white band, measured
    per column (`refband.py`: the smallest channel over 150 sRGB, blurred over
    4 px, the share over 0.3): its middle runs from (0.612, 0.506) to (0.971,
    0.682) of the frame, 15.4 degrees below the horizontal on screen, its
    height 0.10 of the frame by the stern and 0.12 at the right edge, the
    horizon at the top edge. Round 15's fit kept the look point on the course
    line (lookUp 0), and then the frame's center lies on the trail's image:
    the reference's line passes 0.05 of the height over its center, so no
    such pose fits (the fit's residual was the same at every fov). With the
    look point free in height and a band of +-3.5 m: back 30, side -31.4, up
    16.2, lookAhead -7.7, lookUp -2.1, fov 50: the band starts at (0.595,
    0.498) and leaves the right edge at 0.696, 15.4 degrees on screen, the
    horizon at -0.009, the band 0.10 and 0.13 of the height; the view 55
    degrees off the course and 25 degrees down, 35 m from the transom, the
    right edge 20 m (3.4 s) behind it (the old pose: 24 degrees, the horizon
    at 0.195, 31 degrees off the course, 16 down). For a band of one width
    the fit draws the same image of the sea plane at every fov (only the
    heights differ), so the old lens (50) was kept. Judged crop 990 431 610
    391: the reference's 660 300 452 290 in fractions of the frame, moved
    40 px right to clear the transom's corner; the reference scaled to 610 x
    391. The old `quarter` pose is kept.
  - MEASURED FIRST (`wake/r16/tools/measure16.py`: round 15's measures and
    two new ones; `edgeviz.py` draws what they count). THE WAKE EDGE: the
    trail's envelope from the white itself (blurred over 10 px, the share
    over 0.2, its regions of at least 5% of the largest, dilated 8 px); the
    white's share inside it, outside it, and `stray`, the share of all white
    outside it. FLAKES: the white's 8-connected blobs, the share of the white
    in blobs under 40 px, the blob-size spread (90th over 10th percentile, 3
    px and more) and the largest blob's share. The references' white is ONE
    blob (99% of the quarter's in its largest, 81% of the chase's), with
    none outside the quarter's envelope (the chase's 11%: its own foam bits)
    and 0.1% and 5.9% in flakes. Round 14 on the new pose: 69% and 65% in
    one blob, 9.7% and 13.2% stray, 7.8% and 12.7% flakes; round 15: 77% and
    56%, 16.8% and 17.0%, 3.0% and 10.1%.
  - THE CALM LANE (`trailCalm` [0.3, 8, 1, 5]). A diagnosis capture with the
    wake's own waves off (the tune `waveGain` 0, `wake/r16/shots/dwave*`)
    turned the same foam on the new pose from a band on the stern wave's
    lit face into a straight trail on the water: the "foam covering a wave
    face like a whitecap" every quarter critic named since round 6 was the
    wake's own stern and transverse waves under the foam. The propeller's
    race breaks those waves up where it runs (the lane lies flat and matte,
    kilometers long, from the air), so inside the sheet's half-width the
    wake's own slope (the shading) and lift (the mesh) keep 0.3 of
    themselves, all of it back by 8 m past the edge, grown in 1 to 5 m
    behind the transom (the water at the transom keeps the hull's rise). The
    sea's own waves are untouched: the sheet still rides the swell.
  - THE SHEET (`trailBand` [0.95, 3.2, 0.04, 0.9, 1.5, 20], `trailBandAge`
    [1.8, 3.6, 0.4, 2]). The share is at least 0.95 inside 3.2 m of the track
    (widening 0.04 m a meter), soft over 0.9 m either side of the edge, the
    edge moved by up to 1.5 m with the second field read at a 20 m tile
    along the flow and 3 m across (fingers along the flow); held to 1.8 s,
    0.4 of itself by 3.6 s, then as e^(-t / 2 s), so the holes grow and
    merge into lace down the trail. Round 14's race core is off (the sheet
    replaces it) and the amount's share is 0.4 of it (was 0.6).
  - THE HOLES AND THE CELLS. In the sheet the rank takes 0.45 of a coarse
    read of the structure field (`trailHoles` [0.45, 9, 1.6]: a 9 m tile,
    the mix made uniform again), so the young sheet's few holes are a meter
    or two long with ragged edges; round 15's age lace kept at half weight
    (`trailAge` [0.8, 2.4, 0.5, 3, 5, 0], the second field folded at its
    median, read at 1.8 m, `trail[3]`): the sheet turns cellular from 0.8 to
    2.4 s (from above, the chase judges' "connected cellular foam sheet";
    with it off the crops keep half their holes, `final/ablation16.png`).
  - NO FLAKES, A CLEAR EDGE. The amount's edge lines are off (`edgeLines[0]`
    0) and no share under 0.15 to 0.35 draws (`trailCut`): a thin share left
    only the field's highest peaks, round 15's flakes; with the cut off the
    white outside the quarter crop's envelope rises from 4.1% to 5.4%.
    `trailEdge` (the amount's share outside the sheet cut to `keep`) and round
    15's `trailThin` are built and off: neither moved either crop's
    measures, the cut already takes the thin share both act on.
  - THE ARMS (`trailArmLine` [0.75, 0.18, 0.7, 4, 0.05, 0.25, 0.25]): lines
    of 0.75 share, 0.7 m across, from the transom's corners out at 0.18 m a
    meter, fading over 4 s, full on the wake's own crests (buffer B's height
    0.05 to 0.25 m) and a quarter in its troughs: a few longer lines where
    the diverging waves' crests cross them.
  - THE SOFT EDGE (`trailSoft` 2): the structure reads take their mip from
    twice the pixel's footprint, so an edge softens over a few centimeters
    and the one-pixel crisp flakes go to their mean (flakes 5.4% to 3.9% of
    the quarter crop's white, 9.4% to 8.0% of the chase's). It changes how
    the same texture samples; the ORBIT PROOF (`wake/r16/tools/sweepOrbit16.mjs
    soft - trailSoft:1 8`, `orbitStats16.py`, `wake/r16/orbit-soft.png` and
    `-alpha.png`: one camera 40 m out and 14 m up round the point 20 m behind
    the transom, from behind to abeam in eight steps) reads the foam amount
    over the trail at 1.066 to 1.095 of the k = 1 read at every azimuth: the
    same few percent more cover at every view (the coarser mip narrows the
    rank above the cut), not a key on the view.
  - THE LIGHT AND THE GLOW: the foam 0.6 of the white (was 0.66), 0.6 at the
    threshold rising to 1 over half the rank above it (`trailBody` [0.6,
    0.5]: the foam thins toward its holes); opaque from 0.35 at the
    threshold over 0.2 of rank (`trailOpac`), the ramp 0.1 of rank
    (`trail[5]`); the glow 0.25 under the sheet, gone 2.5 m past it
    (`trailBandGlow`), the open holes 0.6 clearer (`trailGlow[4]`, was
    0.3), no relief (`trailLight[2]` 0: round 14's heaps were the "cotton").
  - MEASURED (the final frames `ours/r16w-*`, `wake/r16/final/measure-r16.json`;
    the references in parentheses): the quarter crop (`quarter-m`) 17.9%
    white (20.2%), 107 holes with a median of 15 px (27, 47), SPREAD 19.9
    (26.3), ELONGATION 4.33 (4.05); the wake edge: 49.5% of the envelope
    white (62.3%), 1.1% outside it (0.0%), 4.1% of the white stray (0.0%;
    round 14 9.7%, round 15 16.8%); flakes 3.9% of the white (0.1%; round 14
    7.8%), the largest blob 76% (99%); white by age third 53, 50, 31% (61,
    68, 77%). The chase crop 22.3% (14.9%), 102 holes, 16 px (137, 10),
    SPREAD 16.9 (11.7), ELONGATION 2.10 (2.09); 49.0% inside, 3.5% outside,
    9.2% stray (48.2%, 2.4%, 11.4%; round 14 13.2%); flakes 8.0% (5.9%;
    round 14 12.7%), the largest blob 65% (81%); white by age third 39, 38,
    29% (47, 49, 16%). The glow, the water in the envelope over the open sea
    beside it: +13.8 and +14.7 levels of luma at 0.14 and 0.12 less
    saturation (the references' +52.7 and +37.7 at 0.41 and 0.42).
  Sweeps `wake/r16/shots/s1` to `s11` (`tools/sweep.mjs`, `tools/sheet16.py`,
  `tmp/sh-s*.png`), the ablation `final/ablation16.png`, the pairs
  `wake/r16/final/r16w-*-ours{A,B}.png` (`tools/pair16.py`), the capture rig
  with the new pose `tools/shootWake16.mjs` (the lead's `shootLeadWake.mjs`
  with `quarter-m` added). Still open: the foam is still one flat white with
  crisp edges beside the references' soft, shaded foam (the video's blur,
  but also a white with no tonal streaks); the holes are the sea's bright
  turquoise where the quarter reference's are dark gray-blue (the glow
  measure is a third of the references'); the chase crop's white is half
  as much again as the reference's and its oldest third keeps 29% where the
  reference's falls to 16%; the quarter reference's white rises toward its
  right edge where ours falls, as the critics asked; the sun glints in the
  chase crop's corners are the sea's own.
- **Round 17 (the edge, the grain and the opacity profile).** Round 16 LOST
  both views on side A (quarter high, chase medium) and no judge named round
  holes, flakes, a wave face or a steep diagonal: the calm lane, the sheet,
  the clear edge and the new pose held. Both named the foam's EDGE, GRAIN and
  OPACITY PROFILE: the quarter critic "razor-sharp, binary white edges at
  full opacity, like broken ice or peeling paint ... they should be
  soft-edged foam with varying opacity: a thick, bright, lumpy core that thins
  into semi-transparent lace and fine filaments at the margins", "no bubbles
  under the surface ... it should be a lighter, milky turquoise", "no fade
  with distance", the thin streaks "crisp drawn lines on top of the surface";
  the chase critic the center "a flat, gray-white translucent wash with
  sharp, vector-like blob holes", "no fine bubble grain", "patches all about
  one size", "no readable taper", the edge streaks "jagged, bright
  splinters". Every path is a `WakeLook` field whose off value adds no node:
  `r16`, `r15`, `r14` and `r11` from the round-17 files against the same presets
  from the round-16 files, on one surface (the distance builder's save of
  02:50), differ on 0 of 1,440,000 pixels (largest change 0) at the chase,
  quarter-m and high poses (`wake/r17/tools/offproof17.sh`, the files
  swapped and restored, checked with `cmp`), and `r16` against its own
  capture on today's surface (`ours/r16s-*`) on 0 pixels; the no-boat
  scenes 0 pixels. No key depends on the camera; the grain's footprint gate is the
  texture-size key rounds 13 to 16 used.
  - MEASURED FIRST (`wake/r17/tools/measure17.py`, measure16 plus three):
    THE EDGE PROFILE, per signed distance s from the white's edge (+ inside,
    - outside, px at the judged size, inside the trail's envelope) the mean
    luma and FOAMNESS (the smallest channel's share of the way from the open
    water's median to the core's), and its RAMP, the width over which the
    foamness rises from 0.2 to 0.8 of its span from s = -12 to +12; THE CORE,
    the densest 25% of the envelope (the white blurred over 6 px): its white
    share, luma, saturation; THE FINE GRAIN, the share of the white's luma
    variance under 3 px (4 px and more inside its edge). The references: ramps
    6.8 px (quarter; the video's blur is part of it) and 5.5 px (chase, a
    sharp render), the water 12 px outside the white still 0.47 and 0.52 of
    the way to white (milky); cores 100% and 89% white at luma 190 and 176,
    saturation 0.04 and 0.11; grain 1.8% (the video's blur) and 26.9%. Round
    16 on today's surface (`ours/r16s-*`): ramps 1.7 and 1.7 px, 0.10 and
    0.08 at -12 px; cores 95% white at 186 and 184, saturation 0.05; grain
    9.9% and 8.8%.
  - THE GRADED MARGIN (`trailFringe` [0.2, 0.55, 0.35, 0.75, 0.85, 1.2]):
    under the cover's threshold, within 0.2 of rank, a translucent lace of up
    to 0.55, fading with the depth under the threshold, cut into filaments by
    the second field at a 1.2 m tile, lit at 0.85 of the white, only where the
    trail has a share. The cover's ramp is 0.2 of rank either side of the
    threshold (`trail[5]`, was 0.1), the foam opaque from 0.3 at the
    threshold over 0.4 of rank (`trailOpac`), the small holes' film 0.15
    (`trailFilm[2]`, was 0.5: at 0.5 the core was the "gray-white translucent
    wash").
  - THE BUBBLE HOLES AND THE GRAIN: the second field read at 1 m (`trail[3]`,
    was 1.8 m) with 0.4 of the rank (`trail[4]`, was 0.3), so the dense core
    is holed by many small bubble holes, under 0.35 of the coarse field's
    large holes (`trailHoles`) and clots along the trail (`trailClot` [0.25,
    14, 2]: the sheet's share 1 +- 0.25 with the structure field at a 14 m
    tile drawn out twice); the light 0.45 at the threshold rising to 1 over
    0.6 of rank (`trailBody`), a bubble grain to 0.8 at a 0.25 m tile where a
    pixel resolves it (`trailGrain`, a footprint under 0.06 to 0.16 m).
  - THE MILKY WATER (`trailMilkWater` [2, 3, 0.7, 3, 0.7]): under and within
    3 m of the sheet the bubble cloud's light is 3 times itself and 0.7 of
    the way to BUBBLE_WHITE, its weight at least 0.7, fading over 3 s of age.
    It is the body's light, under the surface's reflection and waves (not a
    veil over them, round 15's fog).
  - THE SOFT ARMS (`trailArmSoft` [0.45, 0.1, 0.9], `trailArmLine` 0.35 m
    across): the arm lines leave the share and its threshold (which cut them
    into bright jagged splinters) and draw as a translucent line of up to
    0.45, broken along its length by the second field.
  - THE FADE: the sheet held to 1.6 s and 0.3 of itself by 3.4 s
    (`trailBandAge`), 3.4 m across (was 3.2), old foam to 0.7 of its alpha
    from 2.2 to 3.6 s (round 15's `trailOld`).
  - BUILT AND OFF, each for a measured reason: `trailHalo` (the cover again
    from the structure field blurred over a width of the WORLD, translucent
    round the sharp cover) and `trailDots` (the second field at a 0.6 to 1 m
    tile in the sheet's rank through one more uniform mix): each made the
    surface shader's first compile far longer on this machine's D3D11 path
    (`tools/sweepLoadTime.mjs`: the viewer ready in 550 s with the dots
    against 115 s without, and a sweep page with the halo took 23 minutes);
    `trailBlur` (every structure read's mip at least blurM of the world):
    fewer, smooth, rounder holes, the "vector-like blobs" (sweep t4).
  - MEASURED (`ours/r17w-*`, `wake/r17/final/measure-r17.json`; the
    references, then round 16, in parentheses): the edge RAMP 2.2 px quarter
    and 2.7 px chase (6.8 and 5.5; 1.7 and 1.7), the water 12 px outside the
    white 0.34 and 0.22 of the way to white (0.47 and 0.52; 0.10 and 0.08);
    the core 99% and 98% white at luma 190 and 188, saturation 0.06 and 0.07
    (100% and 89%, 190 and 176; 95%, 186 and 184); the grain 22.2% and 22.0%
    (1.8% and 26.9%; 9.9% and 8.8%); the glow +34 and +21 levels of luma at
    0.22 and 0.14 less saturation (+53 and +38 at 0.41 and 0.42; +14 and
    +15); white by age third 60, 60, 28% and 42, 45, 23% (61, 68, 77% and 47,
    49, 16%; 53, 50, 31% and 39, 38, 29%); holes 146 of 10 px and 122 of 9 px
    (27 of 47 px and 137 of 10 px), their size spread 8.1 and 6.2 (26.3 and
    11.7); white 16.6% and 19.8% of the crops (20.2% and 14.9%).
  Sweeps `wake/r17/shots/t1` to `t8` (`tools/sweep.mjs`, `zoom17.py`,
  `sheet16.py`), the final pairs `wake/r17/final/r17w-*-ours{A,B}.png`, the
  zooms `final/r17w-zoom.png`. Still open: the edge ramp is a third to a half
  of the references' (the margin's lace is sparse and the white just inside
  its edge is already nearly opaque; the two paths that widened it, the dots
  and the halo, cost minutes of shader compile); the milky water is two
  thirds of the quarter reference's and half of the chase's; the hole sizes
  are now narrower in spread than either reference's; the soft arms and the
  calm lane's matte water beside the core draw soft vertical bands at the
  chase view.
- **The hull** is a lofted stern trawler (30 m, 8 m beam, 2.8 m draft) built
  on the waterline the foam reads, riding the sea by a plane fit of 15
  inverted surface samples plus its own wake beside it (sinkage and trim),
  computed on the GPU and read by the hull's vertex stage in the same frame.
  It has no inertia (open, below).
- **Cost** (the GPU's own clock, gauntlet `wake/`, timestamp on every pass):
  the wake's compute 0.19 ms on a straight and 0.24 ms in a turn (20 pieces;
  the modes the hull cannot drive, 56%, skip its pieces), the hull fit
  0.02 ms, and the whole frame 0.35 ms more with the wake than without it
  (3.74 against 3.40 ms, sea compute excluded, `gpuFrameMs`, round 2); the
  sea's Jacobian read in the foam costs about 0.02 ms of that. Round 3 was
  measured only under another program's load: 0.59 to 0.63 ms more with the
  wake, where round 2 read 0.58 under the same kind of load. Round 4 was
  measured with another builder's sweeps holding the GPU at 100% the whole
  session (`wake/r4/costAB.mjs`, the lead's `measureScene`, A/B in the same
  minutes at the chase pose; `abBench.mjs`, the wake's own probe): the
  round-4 fields cost 0.05 to 0.10 ms a frame over the `r2` look (bench
  draw +0.05, bench total +0.10, the live median within its 0.1 ms
  quantum; the age read is four more storage fetches and the wisp one more
  texture tap, in the foam branch only); the whole wake read 1.21 ms a
  frame with `r4` (5.14 against 3.90) and 1.20 with `r2` (4.87 against
  3.99) under that load, medians of four rounds of 120 frames. The
  quiet-GPU figure could not be measured in that session; round 2's
  0.35 ms stands for it. Round 5 (`wake/r4/costAB.mjs`, `r5` against
  `r2`, the chase pose, another builder's sweeps holding the GPU at 100%
  again, the live frame at 4.3 to 4.4 ms): +0.07 to +0.10 ms a frame (four
  more texture taps and the key's arithmetic, in the foam branch only);
  the whole wake with `r5` 2.15 ms a frame by `abBench.mjs` (10.07
  against 8.04 under about twice the load of the round-4 run, so not
  comparable with its 1.21; the A/B difference is the figure that holds).
  Round 5b (`wake/r4/costAB.mjs`, the default against `r2`, the chase pose, the GPU shared with another builder's captures, the live frame at 3.6 to 3.7 ms): +0.05 to +0.10 (bench total +0.05, bench draw +0.10; the live median moved by one 0.1 ms quantum the other way, noise) ms a frame for the round-5 paths
  over `r2`; the whole wake 1.95 (6.88 against 5.44 under that load) ms by `abBench.mjs`.
  Round 6 (`wake/r4/costAB.mjs`, `r5` against the default, the chase pose, two runs of four rounds of 400 frames, another session's bench holding the GPU at 100%, the live frame at 3.8 to 5.5 ms): bench total +0.02 ms in both runs, bench draw +0.14 and -0.27, the live median +0.2 and -0.1 (its 0.1 ms quantum), so the round-6 paths cost 0 to 0.2 ms a frame (the net's two taps and its table read, the breaking buffer's lateral and the keys' arithmetic, in the foam branch only; the glint share at every wake pixel, a few operations). The net texture is built once on the CPU at mount, about 0.6 s. The whole wake by `abBench.mjs` under that load read 2.09 ms (default) and 2.98 ms (`r5`): the load's noise; the A/B difference is the figure that holds.
  Round 7 (the same rig, `r6` against the default, two runs of four rounds of 400 frames, the GPU at 100% under another session's bench): bench total +0.10 and -0.02 ms, bench draw 0.00 and +0.09 ms, the live median -0.2 and 0.0 ms: 0 to 0.1 ms a frame (the band's width and age arithmetic and one more smoothstep in the bubble weight; no new texture tap).
  Round 8 (the same rig, eight rounds of 300 frames, after the dev server's restart and with no other capture or timing job running): `r7` against the default, bench total +0.04 to +0.06 ms in every round (median +0.05), bench draw +0.02 to +0.06 (median +0.05), the live p10 +0.1 ms; `r5` against the default (rounds 6 to 8 together), bench total and draw +0.05 to +0.08 ms in the five quiet rounds (medians +0.07 and +0.08; three rounds under another builder's capture read -1.2 to +1.4). So rounds 6 to 8 cost about 0.07 ms a frame together (five more texture taps in the foam branch: the boils, the grain and the churn's three).
  Round 9 (the same rig, eight rounds of 300 frames each, no other capture or timing job running): `r8` against the default, bench total -0.02 to -0.05 ms in every round (median -0.04), bench draw median -0.04, the live frame -0.1 ms: round 9 costs nothing over round 8 and reads slightly under it (its four new taps, the net's two second reads and the clump shade's one, are in the foam branch, and the thinned sides are cheaper to draw); `r5` against the default (rounds 6 to 9 together), bench total +0.03 to +0.04 ms in every round (median +0.03), bench draw median +0.03, the live frame 0.0: rounds 6 to 9 cost about 0.03 ms a frame together.
  Round 10 (the same rig, eight rounds of 300 frames each, no other capture or timing job running): `r9` against the default, bench total +0.11 to +0.17 ms in every round (median +0.16), bench draw median +0.13, the live frame +0.1 ms (the tear field's tap and the heaps' tap, the solid band's arithmetic, the lip's; all in the foam branch); `r5` against the default (rounds 6 to 10 together), bench total +0.18 to +0.21 ms in every round (median +0.19), bench draw median +0.18, the live frame +0.1 ms: rounds 6 to 10 cost about 0.19 ms a frame together.
  Round 11 (the same rig, eight rounds of 300 frames each, no other capture or timing job running): `r10` against the default, bench total -0.02 to 0.00 ms in every round (median -0.01), bench draw median -0.02, the live frame 0.0: round 11 costs nothing over round 10 (one more tap for the tear's second read; the lace cut reads the rank the read already has); `r5` against the default (rounds 6 to 11 together), bench total +0.13 to +0.20 ms (median +0.18), bench draw median +0.16, the live frame +0.1 ms: rounds 6 to 11 cost about 0.18 ms a frame together.
  Round 12 (the same rig, eight rounds of 300 frames each, no other capture or timing job running; the GPU's load shifted once, between rounds 5 and 6 of the first run): `r11` against the default, bench total +0.03 to +0.06 ms in the six rounds that do not straddle the shift (median of all eight +0.05), bench draw median +0.05, the live frame +0.1 ms (the mass's two texture taps and its arithmetic, in the foam branch only; the bubble cut reads the lace's rank the read already has; the texture is built once at mount, about 0.26 s); `r5` against the default (rounds 6 to 12 together), bench total +0.19 to +0.22 ms in every round (median +0.21), bench draw median +0.20, the live frame +0.2 ms: rounds 6 to 12 cost about 0.21 ms a frame together.
  Round 13 (the same rig, eight rounds of 300 frames each; NOT a quiet GPU: another session's headless browser, a `serve.mjs` job this session did not start, held the GPU at about 55% and the live frame at 11 ms against the usual 3.3 ms, with one shift of load inside the first run): `r12` against the default, bench total -0.14 to +0.18 ms by round (median -0.01), bench draw median -0.09, the live frame +0.1 ms: round 13 costs nothing measurable over round 12 (one more texture tap, the bubble speckle, and a few operations, in the foam branch only); `r5` against the default (rounds 6 to 13 together), bench total +0.32 to +0.57 ms in every round (median +0.48), bench draw median +0.38, under that load (round 12's quiet-GPU figure for rounds 6 to 12 was +0.21 ms). The quiet-GPU figure for rounds 6 to 13 is still to be taken.
  Round 14 (the same rig, `wake/r14/costAB-r14.txt`, eight rounds of 300 frames each; NOT a quiet GPU either: another program, not a capture or timing job and not stopped, held the GPU at 38 to 39% before the runs; one comment-only save of `oceanWake.ts` fell inside the first run): `r13` against the default, bench total -0.13 to -0.55 ms in every round (median -0.33), bench draw median -0.26, the live frame -0.3 ms: round 14 costs LESS than round 13 (the trail's five texture taps, the jet's and the lanes' arithmetic, in the foam branch only, replace the lace's, the net's, the solid band's and the layer's taps; the net and layer textures are not built, and the trail texture takes about 0.4 s at mount); `r5` against the default (rounds 6 to 14 together), bench total -0.13 to +0.22 ms by round (median -0.06), bench draw median -0.10, the live frame -0.1 ms: rounds 6 to 14 together cost nothing measurable over round 5.
  Round 15 (the same rig, `wake/r15/costAB-r15.txt`, eight rounds of 300 frames each; NOT a quiet GPU: another program held it at 50% before the first run and 79 to 98% between and after, and the first round of the first run read 2.5 ms apart under that load): `r14` against the default, bench total -0.03 to +0.48 ms in the seven other rounds (median of all eight +0.22), bench draw median +0.23, the live frame +0.2 ms: round 15 costs about 0.2 ms over round 14 (the streak read's texture tap, the milky film's and the age keys' arithmetic, in the foam branch only), so about 0.1 ms under round 13; `r5` against the default (rounds 6 to 15 together), bench total -0.16 to +0.14 ms by round (median +0.01), bench draw median -0.05, the live frame +0.2 ms: rounds 6 to 15 together cost nothing measurable over round 5.
  Round 16 (the same rig, `wake/r16/costAB-r16.txt`, eight rounds of 300 frames each; NOT a quiet GPU: another program held it at 79% before the first run and 100% through both, the live frame at 9 to 15 ms against the usual 3 to 6, and single rounds swung by 2 ms): `r14` against the default, the live frame +0.1 ms (p10 +0.1), bench total -0.98 ms, bench draw -0.76 ms; `r5` against the default (rounds 6 to 16 together), the live frame -1.7 ms (p10 -0.2), bench total -0.95, bench draw -0.28: under that load neither is a cost the rig can see, and the quiet-GPU figure is still owed. By construction round 16 adds two texture taps in the foam branch (the sheet's wobble and the coarse holes; the fold rides the fine read round 14 already made, and the coarser mip costs nothing), one more storage read per vertex in the lift (the breaking buffer, for the calm lane), and some arithmetic, and it drops round 14's race core: by rounds 8 to 12's measured cost per tap, about +0.03 to +0.06 ms a frame.
  Round 17 (the same rig, `wake/r17/costAB-r17.txt`, eight rounds of 300 frames each; NOT a quiet GPU: another program held it at 42% before the first run and every round read the load at 100%, the live frame at 7 to 8 ms, and one round of the second run read 0.8 ms, a glitch, in its median): `r16` against the default, the live frame 0.0 ms (p10 -0.1), bench total -0.04 ms, bench draw +0.06 ms: round 17 costs nothing the rig can see over round 16 (two texture taps in the foam branch, the clots' and the fringe's, which the soft arms share, and the milky water's arithmetic); `r13` against the default (rounds 14 to 17 together), the live frame -0.3 ms (p10 -0.4), bench total -0.33, bench draw -0.15: rounds 14 to 17 together cost LESS than round 13's layer. The quiet-GPU figure for rounds 14 to 17 is still owed: the GPU was never idle in this session. THE SHADER'S FIRST COMPILE is the cost that moved (`wake/r17/tools/sweepLoadTime.mjs`, the viewer's time to ready on this machine's D3D11 path): 105 to 199 s with `r16`, 113 s with round 17's first cut; the bubble dots (`trailDots`, one more tap through one more uniform mix) took it to 550 s, and a page with the halo (`trailHalo`) took 23 minutes, so both ship off.
- **Proof.** `npx vitest run src/systems/world3d/ocean/__tests__/oceanWake.test.ts`
  (62: the closed form against quadrature, splitting, the Kelvin
  measurements above, the touch's rings, the taper, the churn and the
  deposit, the lace's tiling, equalization and spread of gap sizes, the
  back-face cap and its knee, the look's presets, its spec parser and its
  coverage table, the flat-plane side ratio, the re-equalized mix, the
  round-6 look and the net lace's topology, ranks, tiling and table, the
  round-12 look and the foam mass texture's determinism, rank, tiling,
  veins and relief, the round-14 look and the trail texture's
  determinism, ranks, tiling, relief and hole sizes against the raft's,
  the jet's and the lanes' shear that never folds, the trail's cover,
  the round-15 look, the round-16 look and its off values in every earlier
  look, the sheet's share and the arm lines' mirrors, the round-17 look and
  its off values, the graded margin's and the milky water's mirrors,
  determinism);
  `__OCEAN__.extras.wake.crossCheck(t)` compares the GPU buffers with the
  CPU mirror texel by texel (relative RMS 6e-6 height, 7e-6 slope, 1e-6
  foam on the straight; 3e-4 foam in a turn); two runs of `shootWake.mjs`
  give the same frames bit for bit.

## Underwater

`?extras=underwater`, with `&sea=storm` for the storm from below. The judged
frames are the underwater poses of `.agent/scratch/ocean-gauntlet/shootLeadUnder.mjs`
(`under-level-r4` with `&sun=40,30`, `under-up`, `under-storm` with `&sea=storm`)
against `ref/demo/orbit-away-low`, `orbit-try-under` and `storm-away-low`.
The lead took `under-level-r4` as the judged level pose after round 4 (see
the round-4 bullet); `under-level-r3` stays in the rig.
The piece draws nothing and costs one compare while the eye is above the
waves' reach (1.2 Hs + 0.6 m), tests the waterline per dome vertex within
it, and draws the whole view below it.
Because of that, `oceanExtras.ts` mounts it on every page whose `?extras=`
is not `none` (2026-09-25): a person who flies the free-look camera under
the surface sees the water from below, not a flat gray view. The judged
scenes above the water changed 0 pixels (open, storm, shallow, wake).

- **The underside is its own mesh** on the surface's geometry
  (`BackSide`), displaced through `oceanSampler.ts`, so it sits on the drawn
  water. The surface draws its front side only (`material.side` in
  `oceanSurface.ts`), which is what keeps the top shading off the
  underside; the piece fails to mount if that changes. While the eye is
  fully under the waves' reach the piece hides the surface mesh: from under
  a single-valued height field no line of sight meets a front face, so its
  pass there is a vertex stage for no pixel.
- **Snell's window, exact, with a soft edge in closed form.** The eye ray is
  refracted up through the facet into the sky the viewer draws
  (`oceanSkyRadiance`, the blurred cloud bake), times n^2 and the exact
  unpolarized Fresnel transmission from the dense side. The last 2 degrees
  before the critical angle are not read from one normal: the transmission
  is held at its value 2 degrees inside and cut off by a normal cumulative
  of the distance to the edge over the pixel's unresolved RMS tilt
  (capillaries, faded cascades, the slope's change across the pixel). One
  normal per pixel drew "chrome-like", "contour-line" rims (round 1 up
  view); three taps drew banded, posterized edges (round 1 storm). Past
  48.6 degrees the facet mirrors the deep water.
- **The glow under the window.** The light the particles only nudge
  arrives blurred, so the far part of what the eye sees of the surface is
  the MEAN window: the long waves' facet (20 m and longer), its edge spread
  by the short waves' slopes, with the cloudless sky. Round 1 used the
  pixel's own light there, and the ripple kept its contrast through 10 m of
  water ("as if seen through air", a round-1 judge).
- **The water is light, not paint, and set by its chlorophyll.** Every line
  of sight gathers single scattering of the daylight at its depth in closed
  form (`inscatterPath`): a two-lobe Henyey-Greenstein for the sun (0.96 and
  0.55, Petzold's mean cosine), a broad lobe for the diffuse light, and a
  slower loss for the scattered light than for an object's contrast (70% of
  the scattering is so near forward it stays on the line of sight). The
  water is case 1 ocean water given by one number, its chlorophyll
  (`oceanWaterOptics`: Pope and Fry, Bricaud, Morel and Maritorena, Gordon
  and Morel). The fair sea was 0.15 mg/m^3 (27 m visibility, blue-green)
  from round 2 to round 4 (`FAIR_WATER_CHL`); since round 5 the view ships
  the clear open sea, 0.05 (41 m, `SHIPPED_CHL`, see the round-5 bullet).
  Round 1's clear table is kept as `UNDERWATER_OPTICS` and is the storm's
  water. The shaders read the water as two uniforms the CPU sets
  each frame from the deck blend, and `tune.chlorophyll` sweeps it.
- **The camera.** Physical light times one exposure, `UNDERWATER_EXPOSURE_REF
  (E / E_ref) ^ -UNDERWATER_ADAPTATION` (0.1375 and 0.437, fitted in round
  2 on the judged level crop and the storm frame together), and a white
  balance half-way to a grey card at the camera's depth. Only the window's
  sunlit share carries a gain (`WINDOW_GAIN`, 2.5; 3.5 in round 1, whose
  whites both up-view judges called clipped).
- **Light shafts are caustic sheets.** A compute pass turns the two finest
  cascades' fold deficit into periodic lens tiles at three blurs, each
  divided by its spread from the spectrum (`foldDeficitRms`). A second pass
  marches 640 x 360 lines of sight, 48 steps placed by the water's own
  attenuation, projects each step up the refracted sun onto the tiles, and
  stores the SHARE of extra or missing sunlight, weighted by the green's
  attenuation alone. The light at each step is `shaftSheetLight`: the foci
  of the crest lenses lie on a level set of the lens field (1.8 of its
  deviations up), drawn as thin Gaussian sheets over a tenth of the mean,
  with mean 1 so the pattern moves light and adds none. Round 1 drew a
  log-normal of the field, a smooth brightening under every crest, and both
  level-view judges called its shafts almost invisible. Each step widens the
  sheet by the distance it moves across the pattern (`SHEET_FOOT`), and the
  march starts at a white hash per texel; together they keep the far steps
  from drawing a hatch. Each pixel multiplies its own sunlit path light by
  the share, read through a 3 x 3 tent.
- **Marine snow**: two world-fixed drifting populations (6000 flakes in a
  6 m box around the eye, 2400 in a 24 m box), lit by the light at their
  depth and the shaft they sit in, defocused by a 20 mm aperture focused at
  2.5 m, so the near ones are soft discs. Round 1's frames held a dozen
  visible flakes and every judge said nothing drifted.
- **Foam and bubbles from below.** Whitecaps show as lit, soft patches
  (35% of the daylight on them); under the crests a bubble layer
  (Terrill et al.'s scattering) whose density follows Monahan's whitecap
  cover, over a floor that covers the whole underside (`BUBBLE_SURFACE_TAU`,
  0.5 straight up on the storm, 0.075 on the shipped sea). The floor dims
  and softens the storm's window, which both round-1 storm judges called
  "too milky-bright for an overcast sky".
- **The waterline.** Within the waves' reach the dome discards the lines of
  sight whose near-plane point is above the displaced surface, and a
  screen grid draws the meniscus where it crosses. The inversion of the
  choppy displacement is a TSL function with its point in a variable: as a
  plain expression it grew the shader by thousands of terms and froze the
  page for 20 s on the first frame under the water. `warmUp` builds every
  pipeline at mount.
- **The level view (round 3).** Round 2's level crop lost both orders with
  "no surface overhead, only a brighter teal band" (GG-299). The reference
  frame was measured before any shader changed: its rays were read as
  running from the upper left to the lower right at 33 to 38 degrees from
  the vertical and nearly parallel (a vanishing point about 4,000 px up and
  left of the frame), so its refracted sun was put about 80 degrees off the
  view and 50 degrees above the axis, which at the 40 degree sun is a view
  pitched about 5 degrees up (ROUND 4 FOUND THIS READING MIRRORED: see the
  round-4 bullet); its ripple streaks are 3 to 6 px thick and legible to
  the frame's middle, a surface 5 to 15 m out, so 1.5 m of depth. The new
  judged pose is `under-level-r3` (1.5 m down, 8 degrees up, aim -50, fov
  60); round 2's (6 m down, 20 degrees up) put the whole crop under the
  surface's vanishing line. Then the look, each behind a `tune` control
  whose off value reproduces round 2 bit for bit (0 pixels on all three
  judged views, `underwater/r3/pixdiff.py`):
  - *The ceiling's edge cap* (`spreadCap`, 0.06; off 0.35): the pixel's own
    slope change no longer spreads the window's cut-off past a 3.4 degree
    tilt, so the ceiling 5 to 15 m out keeps its patches instead of an even
    band. GG-300 asked for this cap; the storm frame moved by at most 3 of
    255 on any pixel.
  - *The blurred mirror on the long waves* (`meanMirror`): the mean surface
    the nudged light shows is reflected about the long waves' facet, not
    the flat sea, so the far ceiling undulates with the chop.
  - *The sheets integrated across each step* (`sheetIntegral`): the
    pattern is taken as linear from the last step's value to this one and
    the Gaussian sheet's mean over that chord is the erf difference in
    closed form (`shaftSheetSegment`, `erfApprox`); a sheet the chord
    crosses is counted at its true width whether or not a step lands on it,
    so the far sheets stay thin and SHEET_FOOT's widening is not needed
    (`sheetFootInt` 0). With it the march's steps are coherent between
    neighbors (`marchJitter` 0: the hash was against the point read's
    lattice hatch, and with the integral it drew the far rays as a mottle)
    and placed on the whole range for every line of sight, each step
    weighted by the share of its interval inside the segment
    (`marchFixed`; per-segment steps changed character along a line across
    the frame, and a hard cut drew rings on the ceiling).
  - *The wide mid tile* (`tileLens.w`, the mid comb again two texels apart,
    a 1 m box): the integrated march reads it in place of the 0.4 m mid,
    whose features a half-meter chord could not follow (wisps at 1 to 5 m),
    and reads no fine tile at all. The bubble clumps keep the 0.4 m mid.
  - *The sheet level at 1.0* (`sheetM0`, 1.8 in round 2) and the focus
    ramp at 0.4 m (`focusM`, 0.8): a level set at 1.8 deviations crosses a
    line once in 6 m of the 1 m pattern, so a 5 m line of sight to the
    ceiling met no sheet and the rays stopped a few meters under it; at 1.0
    it is once in 2 m and the rays reach the ceiling. The share carries a
    gain of 0.8 (`shareGain`) that puts the rays' contrast in the judged
    crop at the reference's (green band deviation 2.73 against 2.81).
  - What the round leaves: the ceiling is dimmer than the reference's and
    has no bright patches at 80 degrees from the sun (the window is closed
    at grazing incidence and the sky through a steep facet is 14 degrees
    over the horizon, not the sun's aureole); the rays' half-maximum width
    at mid-crop is 34 px against the reference's 33 by the same measure.
    The up view moved with the shipped defaults (13.6% of its pixels by
    over 8 of 255, mean 1.6%, most of it the shafts under the bright
    surface; its judged crop 1.1%); the storm by at most 3 on any pixel.
- **The level view (round 4).** Round 3's level crop lost both orders
  again: no surface overhead, faint shafts that start at a seam in
  mid-water, hard white flakes, and "a line of small square dots at about
  60% height" (GG-299). Every round-4 path is behind a `tune` control whose
  off value reproduces round 3: 0 pixels on all three judged views
  (`underwater/r4/r4a-off-*` against `underwater/r3/r3f-*`).
  - *The fan was mirrored.* The round-3 pose came from
    `underwater/r3/rayangle.py`, whose header says a ray from the upper left
    to the lower right reads negative; its own synthetic backslash
    (`synth-backslash.png`) reads +30, so the header's sign is reversed.
    The reference reads -24 in the judged crop: its rays run from the upper
    RIGHT to the lower left, and their fan converges on a point inside the
    frame near (499, 134) (`underwater/r4/vpfit.py`, 22 boxes), the refracted
    sun about 24 degrees left of and 23 degrees above the view axis. That is
    the bright lit patch the shafts hang from, above the crop's right end.
    The round-3 pose puts that point at (-981, -1964): its rays lean the
    other way, and no sun-side surface can be in its crop. The proposed
    `under-level-r4` (6 m down, 37.5 degrees up, aim -8, fov 60, with
    `&sun=40,30`; in `underwater/r4/shootR4.mjs`) puts it at (474, 103), and
    the crop's streak angles run -46, -36, -18, -8 degrees across its width
    against the reference's -42, -30, -18, +4.
  - *The row of dots was not snow* (it stayed with the snow hidden). The
    surface's vertex drops by the Earth's curve about the camera
    (`tune.curve` in `oceanSurface.ts`) and the underside did not, so the
    underside stood 2 to 3 mm over the surface 150 to 200 m out. Within the
    waves' reach the surface is drawn, and its front faces came through
    along the crest lines there: one bright pixel each, on the vanishing
    line. The underside now drops by the surface's own uniform
    (`undersideCurve`, `UNDERSIDE_CURVE`); the row is gone from the level and
    the storm frames (156 pixels on the storm).
  - *Many thin rays toward the sun* (`midFineFoot` 0.8, `fineJitter` 1,
    `jitterIgn` 1). Toward the sun a step of the march moves only 0.1 to
    0.3 m across the lens pattern, and the wide mid there drew two or three
    broad tubes of light. So a step whose foot is under half of
    `midFineFoot` reads the 0.4 m mid, with a smoothstep to the wide mid at
    `midFineFoot`: the rule of a texture's level of detail, the same caustic
    field read at the finest scale the march resolves. Where the mid is
    read, the march's start follows an interleaved gradient noise per
    buffer texel (the share of the first step that reads it sets how much),
    which breaks the rungs a fixed start drew at the step spacing without
    the white hash's sandy grain. The key is the step's own foot on the
    pattern. The sweep `underwater/r4/tilt-r4.png` (6 m down, 30 degrees
    up, 0 to 180 degrees from the sun, on and bypassed) moves 27% of the
    pixels by over 8 of 255 toward the sun, 4.6% at 90 degrees and 0 at 180,
    and the same beams split into finer rays.
  - *The snow* (`snowFloorPx` 1.4, was 0.9; `snowBright` 7, was 10): a far
    flake is a soft round speck, not a raster square, cross or diamond, and
    the flakes in focus clip less.
  - What moved with the shipped values: the up view 4.4% of its pixels by
    over 8 of 255 (its judged crop 4.3%, mean 1.2%, max 47: the shafts
    4.2%, the snow the rest), the storm 0.135% (the row of dots and the
    snow), the round-3 level pose 2.3%. The scenes above the water changed
    0 pixels (`perf/shots.mjs` tag uw4 against wk6 and wk7: open, storm,
    shallow, wake); the suite's `under` scene (the up pose on the waterpro
    sea) moved 9.4%, its shafts.
  - What the round leaves: at the proposed pose the crop's top is a bright
    glow with faint ripple streaks, not the reference's clear mottled
    ceiling; the sun's forward scattering lobe makes the crop about 1.7
    times the reference's brightness and its rays about three times the
    reference's band contrast (`underwater/r4/cropstat.py`; GG-317).
- **The level view (round 5).** At the new pose round 4 split: B won
  (medium) on the gradient toward the sun and the fan; A lost (low) on a
  flat pale cyan with no surface overhead, wide wedges of light "like stage
  fog", no falloff, a pool cyan, and few motes with one soft blob. Every
  round-5 path is behind a `tune` control whose off value reproduces round
  4: 0 pixels on all three judged views (`underwater/r5/r5a-off-*` against
  `underwater/r4/r4f-*`).
  - *The light, split* (`setDebugTerm(3..6)`: the sharp surface, the
    blurred surface, the path light, the shafts). In the round-4 crop the
    path light alone was (69, 128, 145) sRGB of the crop's (75, 137, 153);
    the sharp surface (1, 15, 19), the blurred one (0, 10, 19). So the
    ceiling was lost under the single-scattering veil toward the sun, not
    under a double count. The double count the round-4 report suspected is
    real but small: the blurred window's sky carried the sun's disc, glow
    and aureole, which is the same direct beam the path light's narrow sun
    lobe scatters toward the eye; the blurred window now reads its sky with
    no sun (`meanSun` 0). It changed only the sun's own spot.
  - *The clear open sea* (`chlorophyll` 0.05, `SHIPPED_CHL`; was 0.15). The
    veil follows the scattering b, which halves at 0.05, and the ceiling
    10 m out keeps 38% of its contrast through the beam, not 23%. The crop's
    mean went from (76, 137, 154) to (47, 110, 134), against the
    reference's (44, 90, 109) with its hue (red over green 0.43 against
    0.49, blue over green 1.23 against 1.21); the crop's lower half
    darkens to (24, 91, 117) under a top half of (69, 128, 151). Round 1
    judged the up view at 0.05 "as if seen through air", but it had no
    blurred window and a window gain of 3.5; both are in place now.
  - *Near the sun the fine tile* (`fineFoot` 0.25): a step of the march
    that moves under half of that across the pattern reads the 0.1 m fine
    tile, with a smoothstep to the 0.4 m mid, the next level of round 4's
    rule. The wide wedge along the crop's top splits into thinner rays of
    mixed width. The sweep `underwater/r5/tilt-r5.png` (6 m down, 30 degrees
    up, 0 to 180 degrees from the sun, on and bypassed) moves 3.4% of the
    pixels by over 8 of 255 toward the sun, 3.0% at 45 degrees and 0 from
    90 degrees on.
  - *The share gain at 0.65* (was 0.8): the rays were three times the
    reference's band contrast; at 0.65 they stay clearly brighter than the
    water and the ceiling shows between them.
  - *The motes*: a third population (`snowExtra` 0.8 of 8000 flakes in a
    12 m box, 3.7 per cubic meter out to 6 m), the flakes nearer than 1 m
    faded out (`snowNearM` 1.0, from 0.5 m), and the largest flake 3.5 mm
    (`snowRadiusMax`; was 6 mm, one in ten over 5 mm). The soft blob the
    judge read as a lens flaw was a 5 to 6 mm flake a meter from the lens.
  - Tried and dropped: a gain on the path light's sun lobe (at 0.5 the crop
    matched the reference's brightness, but the phase is Petzold's, so the
    gain had no physical reason); the march ignoring its first meters (no
    visible change); a shorter depth fade of the sheets (30 m against 60:
    no visible change in the crop); a wider edge cap on the window
    (`spreadCap` 0.12 and 0.2: no visible change); a stronger white balance
    (it moves the storm).
  - What moved with the shipped values: the up view 62% of its pixels by
    over 8 of 255 (the water: bluer and clearer; the lead must re-judge it),
    the storm 0.199% (the snow only: the storm is its own water and has no
    sun), the level crop 92%. The scenes above the water change 0 pixels
    over 8 of 255 against the lead's `plate2` shots (open, storm, shallow,
    wake; storm max 1).
  - What the round leaves: the ceiling toward the sun is a sheet of ripple
    streaks with bright window outlines in the crop's top third, not the
    reference's broad blotchy mottle; the rays are still about 2.6 times the
    reference's band contrast (5.8 against 2.2, `underwater/r4/cropstat.py`).
- **Cost.** `__OCEAN__.extras.underwater.benchPiece(frames, rounds)`
  alternates blocks of whole frames: the piece on, every part off (compute
  passes skip when no part reads them), and the old view (off, with the
  surface drawn). Round 2, at the five judged poses, with other processes
  holding the GPU at 0 to 96% through the run: the piece's own work 0.9 to
  1.8 ms, the frame 0.8 to 1.5 ms dearer than the old view, whole frames 5.2
  to 7.3 ms. Parts at under-deep: underside 0.8 ms (a second vertex pass,
  GG-295), the shaft pass about 0.6, dome 0.15, snow 0.15. No quiet reading
  has been taken (GG-285's contention). Round 3's controls, A/B in the same
  minutes with `__OCEAN__.bench(200)` on and off, six rounds each
  (`underwater/r3/costAB.mjs`): up view 2.05 against 1.89 ms (+0.16), storm
  2.05 against 2.04 (0), level pose within the run's noise (2.27 against
  2.10 to 2.34 with two outliers); a shorter run gave the level +0.11 and
  the up +0.09. The erf per step and the wide comb are the whole addition.
  Round 4: `benchPiece` times each block with the viewer's
  `__OCEAN__.bench(frames)`, which pauses the live loop. Before, it fenced
  its own blocks with the loop running (the probe trap under "Frame cost"),
  and on a loaded GPU it gave 22 to 28 ms frames and a negative piece cost.
  With the fix, at the shipped values (another agent's capture sweep on the
  GPU, about 48% load): the piece's own work 3.3 ms at `under-level-r4`,
  1.6 at `under-level-r3`, 2.1 at `under-up`, about 0 at `under-storm`
  (straddle mode, the surface drawn in both blocks). The round-4 controls,
  A/B in the same minutes with `__OCEAN__.bench(200)`, six rounds each
  (`underwater/r4/costAB4.mjs`): +0.07 ms at the r4 pose, +0.10 at the r3
  pose, +0.01 at the up view, -0.25 at the storm (noise).
  Round 5, on a quiet GPU (10% load before the run): the piece's own work
  1.04 ms at `under-level-r4`, 1.02 at `under-up`, 0.04 at `under-storm`
  (straddle); whole frames 1.6 ms. The round-5 controls, A/B with
  `__OCEAN__.bench(200)`, six rounds (`underwater/r5/costAB5.mjs`): +0.03 ms
  at the level pose, +0.01 at the up view, 0.00 at the storm.
- **Open:** the storm from below keeps a blue cast at its foot (GG-294);
  the underside is a second full vertex pass over the 512 x 512 grid
  (GG-295); the level view is judged under a 40 degree sun passed by
  `?sun=40,30`, not the shipped 60 (GG-297); at `under-level-r4` the
  ceiling toward the sun reads as ripple streaks, not the reference's
  mottle (GG-299, GG-317); the up view moved with round 5's water and needs
  a re-judge, the storm moved 0.2% with the snow; the storm's surface pattern
  lost its fine ripple detail with the soft edge (GG-300, the round-3 cap
  is in place and its storm frame moved by at most 3 of 255).

## Persistent foam

`oceanFoam.ts` (GPU) and `oceanFoamMath.ts` (the model, every constant with
its measurement, and the CPU mirrors vitest runs) give the sea foam that
lasts after a crest breaks. The surface draws it through one hook,
`surface.setFoam(reader)`: the reader's `shade({ sample, deficit, longM,
shortM })` returns the foam alpha and a brightness factor at a fragment, in
place of the fold-only ramp. With no reader the surface is unchanged.
`?extras=foam` mounts it (`oceanExtras/foam.ts`). Round 4 (2026-09-25)
rebuilt the read and gave the breakers their own headings; it WON the
eye-level view blind in both orders. Round 5 (2026-09-25) reshaped the
deposit and the trail's decay for the view from above and LOST both views.
Round 6 (2026-09-25) restored round 4 bit for bit as its base (0 of
1,440,000 pixels differ at either judged view, `foam/r6a.py`; every
round-5 value is back and every round-5 code path stays behind a control
at its neutral value), added a second field G that lays foam where the
crest folds, the head's breaking front on the fold's own line, and a grain
keyed to its size on screen; it WON the eye-level view blind in both
orders at high confidence. Round 7 (2026-09-25) keyed part of the read on
the view's pitch so that from above the fold-laid field G carried the
foam while the eye-level frame stayed round 6's to the pixel; it LOST
from above on the fill ("flat stencils with the same marble-crack fill
and hard cut edges"), and the pitch key was registered as GG-311 (foam is
a world-space thing; a camera that tilts would see it change character).
Round 8 (2026-09-25) takes GG-311's choice (a), NO pitch key: the round-7
pitch paths ship at their off values, every round-8 path holds at every
angle, keyed only on the pixel's own resolution where a texture's size on
screen decides what can be drawn, and the eye-level frame moves and is
judged again. From above the masses grade from a dense core to a sparse
edge, the fill is fibrous, the crest lines and the small breaks of every
folding crest draw, and the fringes dissolve into bubbles. It WON the
eye-level view blind in both orders and LOST from above ("the same large
cellular lace at the same scale and the same flat gray"; a "uniform
speckle stipple" at the edges; "no bright fresh whitecap against dim,
dying foam"; "near-identical ovals of one size"). Round 9 (2026-09-25),
each path behind a control whose 0 is round 8 bit for bit (0 of
1,440,000 pixels at both judged poses, `foam/finalCaptures9.sh`): THE
HAIR, the fiber generator with a floor per fiber so the count of
filaments follows the coverage, carries the fine regime's texture and
the fringe's in place of the fine wisps and the bubbles; THE AGE CLOCK,
a fifth number A beside the state, set where the breaker is and decaying
in place, grades a trail's light, coverage and lace by the foam's own
age in world space; OLD foam is torn into windrows along the wind and
given a halo of loose hairs, so old trails persist as long thin dim
streaks where round 8 dropped them at F 0.4; a fresh raft keeps a
compact outline (the eye-level near water lies under fresh trails, so
the halo there is what round 4 called "a net of lines" when every trail
had it). Both views moved (10.08% of the frame from above, 4.44% at
eye level, over 8/255) and both are judged again.

- **The store.** Two toroidal clipmap levels in world space, 512^2 at 0.5 m
  and 512^2 at 2 m, each texel (F, B, R, G): F the foam, B the active
  breaker, R the residual, G the fold-laid foam (round 6). Stepped at a
  fixed 1/30 s. F decays e^(-dt/7 s) and gains 0.9 dt max(B, stamp)
  (`FOAM_PRODUCTION_PER_S` 0.9, `FOAM_DEPOSIT_POW` 1: round 4's values;
  round 5's 1.5 and 2 thinned the near water at eye level and drew
  "teardrop blobs" from above). B is the larger of its own value one step
  upstream (it runs with the crest at 0.73 of the peak's phase speed,
  measured on the CPU reference: `crestLife.ts`) and the wind sea's fold
  gate that starts a breaker; every breaker lives 5 s
  (`FOAM_BREAKER_LIFE_VAR` 0; the spread of lives stays behind `lifeVar`).
  R takes what F loses and fades over 6 s. F and R spread by diffusion at
  0.5 m^2/s (a 5-point stencil, its weight held under 0.2 a neighbor;
  round 5's 0.15 gave "hard noise-threshold edges"). The store lives in
  the water's Lagrangian frame (the FFT grid coordinate), drifting at 3% of
  U10 the way the waves run, so foam rides the orbital motion with no
  advection. Two copy passes write each level's display textures (F, R, B,
  gain) and (G, lay) for the read. Round 7 changed nothing in the store's
  shipped step: its two step-side paths are off (below).
- **The fold-laid foam G (round 6).** The standard FFT-ocean foam is built
  from the waves: every step adds foam where a crest folds, at every wave
  scale, and old foam fades and rides with the water. Three rounds of
  tuning the lace inside each breaker patch drew ovals from above, because
  every patch was one breaker's trail (B is the wind sea's smooth gate
  blob run along one heading). So G lays foam where the summed, gained
  fold deficit crosses a SOFTER ramp than the breaker's, `FOAM_LAY_LO` 0.4
  to `FOAM_LAY_HI` 0.8 (the breaker's 0.7 to 0.9 picks the peak of a fold;
  the lay ramp takes the crest line), at `FOAM_FOLD_LAY` 1.5 of the
  breaker's rate, with its own fade `FOAM_LAY_TAU_S` 3 s and no transport,
  spread or residual (`foamLayStep`). Why its own field and fade: laid into
  F (7 s) it smeared into bands 70 m long along the wind, since the fold
  runs with its wave at 7 m/s (sweep q1); the reference's masses are about
  1.7 times longer along the wind than across (22 by 37 m, the largest in
  preset-storm.png), which a 20 m fold region reaches near 3 s. The
  instantaneous lay fold (debug 8) has the reference's mass shapes,
  irregular crackled regions 20 to 50 m across at every size, and G keeps
  them. The share: at 1 the masses stayed under the coverage ramp, at 2
  and 3 they whitened the mid-distance crests at eye level (q4, q9). Tried
  and dropped, each behind a control at 0: the breaker's deposit gated by
  the fold under it (`layTex`: the fold does not stay under the running
  breaker, which is why B exists, so the store emptied to a fifth, q3);
  the breaker seeded with the fold's crackle (`seedTex`, `seedLo`,
  `seedHi`: bilinear advection and the max erase it within a second and B
  stays a smooth blob, q5, q6); a wider gate (the amount explodes and eye
  level floods, q7; with a lower rate the same ovals, thinner, q8); a
  lower rate with G as the main body (loses the near flecks and the
  mid-distance whitecap at eye level, q9).
- **No pitch key (round 8, GG-311).** The surface's footprint axes
  (`longM`, `shortM`) are screen derivatives of the sample coordinate,
  constant over a triangle, so a per-pixel key on the view's obliqueness
  would draw the mesh's facets on the near water (round 4's finding when a
  grazing fade was tried), and a per-frame key on the camera's pitch is
  what GG-311 names. Round 8 removes the key from the shipped look: the
  round-7 controls `headAbove`, `headLine`, `dustAbove`, `bodyAbove`,
  `gCapAbove`, `gCov1Above`, `gVeilAbove` and `wisp` ship at their off
  values (1, 0, 0, 0, 0, 0, 0, 0; `uAbove` is still computed and does
  nothing at those values), and every round-8 control holds at every
  angle. The proof is a TILT SWEEP (`foam/tiltSweep.mjs`, `tilt-r8.png`):
  one camera at 40 m, the sea pinned at 42 s, eight pitches from 8 to 90
  degrees down, with the foam read on and with it bypassed (the surface's
  fold ramp) as the control for what the water is doing; the foam's
  character holds and only the resolution of its texture changes with the
  footprint. Where a control below is keyed on the pixel, it is keyed the
  way the curl grain has been since round 6: on a texture's size on
  screen (the aligned fibers' width, a bubble's radius), which any camera
  at any pitch resolves the same way for the same footprint.
- **The view from above, round 8.** Each control 0 for round 7 exactly,
  all uniform branches. G's coverage ramp is WIDE at every angle,
  smoothstep(0.25, 1.5, G) x 0.9 (`layCov1` 1.5, `layCap` 0.9; round 6's
  1.2 and 0.6, round 7's 0.8 and 0.8 from above): a narrow ramp saturated
  every mass to one coverage, the verdict's flat stencil, and the wide
  one grades each mass from a dense core where G is fresh to a sparse
  edge where it has faded, in world space. The crest line under a breaker
  (the fold on the lay ramp, round 6's `headLay`) draws at `lineCov` 0.7
  of full coverage, and every crest folding on the lay ramp with no
  breaker under it at `dust` 0.5 (the small crest breaks between the big
  patches; `magK` keeps GG-280's confetti off the water nearest the
  camera): at 0.9 and 1.0 (sweep r8b) both drew solid white chunks, since
  coverage past 0.85 is solid by design. The head's disc keeps 1 -
  `headShape` (0.6) of itself where the crest is not folding under it
  now, so a head is the fold's line with a softer disc around it. The
  light on thin foam (`tailDim`, 1 - tailDim at coverage 0.15, full at
  `tailC1` 0.9) is built and ships at 0: at 0.25 to 0.5 it cost the
  eye-level near flecks (over median+50: 1.31% to 0.77 to 0.94), and the
  coverage gradient already sparses the tails, which is what a dim tail
  is at sea (fewer bright bits, not dimmer ones). The round-7 from-above
  deltas are described next for the record.
- **The view from above is G's (round 7).** Debug captures from above
  (`foam/r7-G-lay-1x.png`) showed that G already holds irregular
  crest-shaped masses at every size from 1.5 m to 30 m over the whole
  frame, elongated along the wind with a spread of densities, and that the
  lay signal (the crest folding now, on the lay ramp) has the crackled
  bright-core outline of the reference's patches; round 6 drew G capped
  at 0.6 as a soft veil and the crackle only under a breaker, so the
  breaker trails, swept discs, still dominated from above. Round 7 keys
  the read on the VIEW'S PITCH, `uAbove`: one uniform a frame from the
  camera the step already reads, smoothstep of the downward pitch from
  0.55 to 0.8 (exactly 1 at storm-high, 72 degrees down; exactly 0 at
  storm-away, 9 degrees down), so the eye-level frame is untouched. A
  per-pixel key on the footprint's shape was rejected: the two judged
  views are only 1.37 against 1.69 apart on it, and a derivative is
  constant over a triangle, so a ramp on it draws the mesh's facets on the
  near water (round 4's finding). From above, each a delta from round 6
  whose 0 is round 6 exactly, inside uniform branches: G's cap 0.6 + 0.2
  (`gCapAbove`), its ramp top 1.2 - 0.4 (`gCov1Above`, a denser core), its
  veil share 0.65 - 0.3 (`gVeilAbove`, fibrous rather than a haze); the
  breaker trails' body at half (`bodyAbove` 0.5), so the swept discs are
  secondary; the head's disc at half its coverage (`headAbove` 0.5; at eye
  level it is the churning mass the judges praised) with the crest line
  under the breaker at 0.7 of full coverage (`headLine`; at 1 it drew solid
  white blobs on the lace); and every crest folding on the lay ramp,
  breaker or none, at 0.4 of full coverage (`dustAbove`): the crest lines
  of every fold and the single bits the reference strews over its water
  (near the camera at eye level the same fold is GG-280's confetti, so it
  stays gated there). Judged values from sweep r7e (E2): the crop from
  above has 1.67% of its pixels 70 sRGB over the water's median against
  the reference's 1.71% (round 6: 1.90%), p99 116 against 111.
- **The crest segment and the curve (round 7, built, tested, OFF).** The
  lead's named fix, a breaker as a crest SEGMENT with its own length and
  curvature: a value-noise field in the frame that rides with the breakers,
  fine across the wind (5 m, along the crest) and coarse along it (40 m,
  longer than a run), with a second octave at three times both, scales the
  gate's OUTPUT (`foamSegmentGain`: 1 over `FOAM_SEG_HI`, 1 - depth under
  `FOAM_SEG_LO`), so a crest breaks in pieces of the field's own lengths
  and strengths and one crest lays a graded bundle of streaks; because the
  field rides with the breakers, the bilinear advection cannot integrate it
  away (round 6's seed by the ripple's crackle was erased in a second). On
  the gate's ARGUMENT (the first form, r7a) the steep gate made it an on/off
  cut that thinned the population to a mean coverage of 0.13 (round 4's
  0.19) and left smaller smooth discs. And the heading takes a term read in
  LABEL space (`foamBreakerCurve`, 40 m), so a trail bends along its run.
  Measured (sweeps r7a, r7b, r7e; `FOAM_SEG_DEPTH` 0.8 with the knots at
  -0.5 and 0.5, 4 m across, the curve 0.5 rad): the population took a
  spread of densities and some trails tore into two or three streaks, but
  the outlines stayed swept discs; with G carrying the view from above the
  field added nothing visible there (r7e E2s against E2); and alone it
  moves the eye-level frame by 6.2% of its pixels. Both ship at 0
  (`segDepth`, `curve`): the kernel skips them in uniform branches and the
  store is round 6's bit for bit. Their on-state is captured beside the
  shipped frames (`ours/foamR7s-storm-high.png`, `-storm-away.png`) for
  the lead. The CPU kernel's tests cover the cut crest (a two-segment
  crest lays a bundle, the cut half nothing at 0.8, and the shipped depth
  lays what no factor lays, bit for bit) and the bent run (the path's z at
  x = 4.5 m is the integral of tan of a heading rising to 60 degrees).
- **The breaker's heading.** Each breaker runs off the mean heading by up
  to 0.6 rad, value noise on a 30 m lattice in the frame the breakers ride,
  so a breaker keeps its heading as it runs and its neighbors take others
  (a developed sea's energy lies within about 25 degrees of the mean). With
  one heading every trail from above was a parallel diagonal.
- **The source.** The summed fold deficit of the foam cascades, times the
  swell's compression gain (6 on 1 - J of the swell), a wave-group envelope
  moving at the group speed, and a breaker lottery (25 m cells, gain 0.8)
  that rides with the breakers so a crest that breaks stays breaking. The
  gain is what breaks the wind-sea patch's lattice (`measureFoam.ts`).
- **The lace.** A 1024^2 tile baked once by a compute kernel, four channels
  on lattices that wrap at their own periods: `cell1`, a Worley net 0.9 m
  across and 1.8 times that along the wind, warped by 1.4 cells on a
  lattice 0.75 of its count; `fiber`, two line segments a 0.5 m cell, 0.7
  to 1.8 m long, within 0.35 rad of the wind (round 4's, and round 6's:
  round 5's 0.5 to 1.2 m within 0.7 rad lost the eye-level direction the
  judges praised); `clump`, two octaves of value noise at 2.4 m, 2.5 times
  longer along the wind; `strand`, the same at 0.4 m and 12 times longer.
  A SECOND TILE (round 6) holds `curl`: the same fiber generator on its
  own salts, turned up to a quarter turn either way, 0.6 to 1.5 m long,
  and bent so each end sits half the half-length off the chord
  (`FOAM_LACE_CURL`, `foamTileCurl`), and since round 7 `wisp` beside it:
  the generator on a 2 m lattice, two a cell, 2 to 4.4 m long and 0.36 m
  wide (2 to 3 px at the reference's 0.15 m a pixel, where the curls are
  1 px), turned up to 0.6 rad and bent 0.35 (`FOAM_LACE_WISP`,
  `foamTileWisp`); its period is the fiber lattice's 64 m, so both share
  one tile coordinate and one fetch. THE GRAIN BY SCALE: at 0.15 m a
  pixel from above each 0.14 m aligned fiber is a one-pixel diagonal dash,
  and every patch's fill read as "the same fine diagonal hatching, like a
  brush stroke" (the round-4 verdict); at eye level the same fibers are 3
  to 7 px wide on the near water, the "crisp lacy edges" the judges
  praised, and under a pixel at mid distance. So the fiber layer is the
  aligned fibers where they are over `FOAM_CURL_PX_HI` 3 px wide, the
  curls where under `FOAM_CURL_PX_LO` 1.2 px, blended between (`curl` 1;
  0 draws round 4). The threshold texture is a weighted sum: young foam
  {net 0.3, fiber 0.4, clump 0.2, strand 0.1}, old foam {0.2, 0.3, 0.1,
  0.4}, each made uniform through its measured CDF so the drawn area
  follows the coverage; a third table is the young lace with the curls,
  read where they draw. THE WISPS (round 7): seen at 2x beside the
  reference (`foam/r7-zoom-raft.png`), a patch's edge there frays into
  curved strands 2 to 4 px wide and 10 to 40 px long streaming out of the
  mass, ours into the 1 px curls, a stipple. From above (`uAbove`), at the
  FRINGE only (where the trail's coverage is under `wispC0` 0.45 to
  `wispC1` 0.85; at full weight the wisps opened the dense core into a
  scribble, r7c), the young lace takes {0.3, 0.2, 0.2, 0.1, wisp 0.2} and
  the old lace {0.2, 0.2, 0.1, 0.2, wisp 0.3} (`FOAM_LACE_YOUNG_ABOVE`,
  `FOAM_LACE_OLD_ABOVE`, the fourth and fifth CDF tables), so the old
  tails are not combed by the strands. `wisp` 0 draws round 6 (and is the
  shipped value since round 8, the pitch key being off). THE FINE REGIME
  (round 8, `fine` 1): where the aligned fibers are under 3 px wide on
  screen (1 - the curls' `rAligned`: from above at 0.15 m a pixel, and the
  mid distance at eye level, where the wisps are under a pixel and go to
  their mean), the whole patch's threshold texture is the FINE tables,
  {net 0.1, fiber 0.15, clump 0.2, strand 0.1, fine wisp 0.45} young and
  {0.1, 0.15, 0.1, 0.2, 0.45} old (`FOAM_LACE_YOUNG_FINE`,
  `FOAM_LACE_OLD_FINE`, the seventh and eighth tables), and the lace's
  anti-aliasing half-width is sized to the wisp's 0.36 m instead of the
  0.14 m fiber: at 0.15 m a pixel the fiber's term had softened the
  threshold to a gray mean and the net's 0.9 m cells at 6 px were the one
  structure left, the "marble crack". THE HAIR (round 9, `hair` 1,
  `hairFringe` 1; 0 and 0 draw round 8's fine and fringe tables): the
  round-8 verdict read the fine wisps' 2 m lattice thresholded at mid
  coverage as "one large cellular lace at the same scale" (its loops are
  plain at 2x, `foam/r8d-zoom.png`) and the bubble-led fringe as "a
  uniform speckle stipple"; the reference raft at 2x is a felt of
  thousands of filaments one pixel wide, streaky within about 30 degrees
  of the wind, whose COUNT falls from the core to a few loose hairs at
  the edge (`foam/r7-zoom-raft.png`, `foam/r9g-zoom.png`). A threshold
  on a distance field can only thicken the same fibers as the coverage
  rises; the count follows the coverage only when each fiber carries a
  floor of its own (`fiberDepth`, `fiberFloor` on `FoamLaceShape`; 0 and
  0 leave every older channel bit for bit, the mirror check holds at
  hash 0, lace 0.00053, float16 rounding). Two channels in a THIRD tile on the fibers' 64 m period, one
  fetch, combined by min (`FOAM_LACE_HAIR`, `FOAM_LACE_HAIR_FINE`,
  `foamTileHair`, `foamTileHairFine`): the long hairs on a 1 m lattice,
  two a cell, 0.2 m wide (1.3 px from above), 1.5 to 4.5 m long, within
  0.5 rad of the wind, bent 0.3, floors 0 to 0.6; the fuzz on the curls'
  0.5 m lattice, 0.14 m wide, within 0.7 rad, bent 0.35, floors 0.3 to
  0.85, so a fringe frays into long single hairs before the fuzz fills a
  core. Their tables (`FOAM_LACE_YOUNG_HAIR` {net 0.05, clump 0.05,
  strand 0.05, hair 0.85}, `FOAM_LACE_OLD_HAIR` {0.05, 0.05, 0.2, 0.7},
  `FOAM_LACE_FRINGE_HAIR` {strand 0.05, hair 0.95}, the ninth to eleventh
  CDF tables) carry little of the other layers: a weighted sum breaks a
  filament into dashes where the others are high. Chosen on the CPU
  prototype (`foam/hairProto.ts`, the shipped generators and tables at
  0.15 m a pixel: sets a and b) and confirmed on the GPU at 2x
  (`foam/r9a-zoom-raft.png`, `r9g-zoom.png`, `r9h-zoom.png`): both
  channels at one depth 0.85 and the long hair 0.14 m wide drew a dotty
  speckle; 0.9 rad and bent 0.4 drew a scribble of threads in every
  direction; the shipped shapes draw a streaky felt. The anti-aliasing is
  sized to `hairAA` 0.6 of the long hair's width (at 1 the threads were
  hard-edged beside the reference's soft filaments), and the veil takes
  0.4 of the draw (`FOAM_VEIL_SHARE`, 0.25 through round 8) and 0.45
  where G carries the body (`layVeil`), a soft body between the threads.
  The hair is read where the aligned fibers are under 3 px wide on
  screen, the curls' key since round 6, so a tilting camera sees only
  its resolution change (`foam/tilt-r9.png`). The fine wisp (`FOAM_LACE_WISP_FINE`,
  the second tile's fourth channel, `foamTileWispFine`) is round 7's wisp
  turned up to 1.0 rad, bent 0.5 and 1.8 to 4 m long: at 0.6 rad the fill
  was a parallel comb (sweep r8b) where the reference's tendrils curl
  through a mean direction. THE BUBBLES (round 8, `foamTileDot`, the
  second tile's third channel): sparse points on a 0.25 m lattice (a cell
  holds one with probability 0.45), the value the distance to the nearest
  point over 0.7 cells, so under the threshold at low coverage the texels
  nearest the points draw first, round bits 0.1 to 0.3 m across whose
  count follows the coverage. At the FRINGE of a patch (the trail's
  coverage under `fringeC0` 0.3 to `fringeC1` 0.7) the texture blends to
  the FRINGE table {net 0.1, fiber 0.15, clump 0.1, strand 0.1, fine wisp
  0.2, dot 0.35} (the sixth table) where a bubble's radius is under
  `fringePx` 2.5 px on screen (off over 5): from above the bubbles are 1
  px and an edge dissolves into scattered bits instead of the net's last
  walls; on the near water at eye level they were 6 to 15 px and drew as
  round blobs (`r8c-near-zoom.png`), so there the lace's own fibers stay,
  as round 7 drew them. Each layer finer than the pixel goes to its mean,
  per axis. `probe.mirrorCheck` evaluates the tile (net, aligned fibers,
  curls, wisps, bubbles, fine wisps) and the hash on the CPU: 0 and 0.0005
  (float16 rounding).
- **The age clock (round 9, `ageClock` 1; 0 is round 8).** Every verdict
  from above since round 3 asked for bright fresh foam against dim dying
  foam, and the store could not clock it: a breaker lays P dt B along its
  whole 5 s run while B falls only to 0.37 of its start, F saturates at
  FOAM_MAX under the 15 to 30 m blob (a point lies under it 2 to 4 s at
  0.03 a step), so a trail is one density from birth to head and over
  the coverage ramp's top for 11 s; the residual's share clocks a tenth
  a second (round 5's finding); and round 8's `tailDim`, keyed on the
  coverage, dimmed the eye-level near flecks, which are thin FRESH foam
  (F 0.5 to 1 under a fresh trail's skirt: the freshness debug at eye
  level, `foam/shots/r9g-dbgA-away.png`). So the store carries A in a
  float buffer of its own beside the (F, B, R, G) state, read, written
  and copied only while the clock is on, in the display texture's free
  z: each step the larger of itself decayed by e^(-dt / FOAM_AGE_TAU_S)
  (4 s: 0.29 at the birth end of a 5 s run, 0.08 at 10 s) and the
  breaker's presence here on the ramp FOAM_AGE_B0 0.05 to FOAM_AGE_B1
  0.4 (`foamAgeStep`; no spread, no transport, so a trail's diffused
  skirt is unclocked and its head is 1 the step the crest passes). The
  read's freshness is smoothstep(0.05, 0.7, A) (`ageA0`, `ageA1`): the
  body's light falls to 0.65 where it is 0 (`ageLight` 0.35; the cores
  keep theirs), its coverage to 0.6 (`ageCov` 0.4), and its lace takes
  the old table (`ageTex` 1). `ageOnBody` 0: the clock acts on F's body
  before G joins it (at 1, on the whole body by the larger of A's and
  G's own density, `ageG0` 0.3 to `ageG1` 1.2; built for the sweep,
  off). The eye-level near flecks under these: over median+50, 1.35% at
  round 8, 1.31% with the clock alone (r9a), 1.21% shipped.
- **Old foam is torn into windrows, and given a halo (round 9).** With
  the clock alone the ovals stayed: the big ones in the judged crop are
  FRESH (the breaker over them now, A near 1, `foam/shots/r9a-dbgA-high.png`),
  every one a saturated body, and the head-shaping controls (`headG` 0.8,
  the disc keeping 0.2 of itself where G is low; `coreB0`; `headShape`)
  moved them little (sweep r9b). Tried and dropped, each behind a control
  at its off value: the deposit power 1.5 and 2 (the physical comet, but
  a store change that emptied the eye-level near water, over median+50
  1.35% to 0.10-0.15%, sweep r9d); the body ramp's top at 1.8 (the same
  loss, read side, r9d R1); the body and the head at half their coverage
  at every angle (`bodyScale`, `headScale`, r9e: the same capsule
  outlines, lacier, and the near flecks gone, 0.14%). What separates the
  views in WORLD space is age: the near water at eye level lies under
  fresh trails, the sea from above is mostly old ones. So (1) THE WINDROW
  TEAR: where the freshness is gone the body's coverage keeps itself on
  the streaks of value noise 3 m across and 18 m along the wind
  (`foamTearNoise`, FOAM_TEAR_ACROSS_M, FOAM_TEAR_ALONG_M) and loses 0.9
  of itself between them (`rowTear`; `tearLo` -0.3 to `tearHi` 0.3), so
  an old 15 m oval is three or four windrows and a fresh trail is whole
  (Langmuir's convergence lines; the round-8 judges at eye level found
  "no convincing windrows"); a removal-only tear, since round 5's
  mean-preserving one drew flat chunks. (2) THE HALO: F from 0.1 to 0.5
  draws at up to `halo` 0.5 coverage, the larger of it and the body's
  ramp (so F over 0.5 keeps its coverage), through the hair fringe: the
  spread's skirt round a trail and every trail older than 11 s, which
  round 8 dropped at F 0.4, persist as loose hairs, dim and torn into
  streaks by the clock. At every trail the halo flooded the eye-level
  near water with lace (over median+50 1.35% to 4.6%, sweep r9f, the
  "net of lines" round 4 met at cov0 0.1), so `haloOld` 0.75 gives a
  fresh trail a quarter of it, a few loose hairs round a compact raft,
  and the near water is unchanged (r9i W1 against V, over median+15 8.12%
  against 7.90%). From above the old trails are then long thin dim
  windrows between the solid fresh rafts, the "sparse scatter between
  big convergence masses" the verdict praised in the reference.
- **The draw.** Three kinds of foam. The body is the TRAIL, coverage from
  F, smoothstep(0.4, 1, F) x 0.85, and since round 6 the larger of that
  and G's coverage, smoothstep(0.25, 1.2, G) x 0.6 (`layCov0`, `layCov1`,
  `layCap`; the reference's masses from above are mid-gray, the 90th
  percentile of the judged crop 46 sRGB, and at a cap of 0.7 ours were
  52, at 0.6 46 to 49; round 7's deltas from above are listed above).
  Where G carries the body the veil takes 0.65 of the draw (`layVeil`;
  through the threshold lace alone G was crackle), and G's thinness is its
  age (`layAge` 1: G fades in place from the moment its crest folded, so a
  thin G is an old one, and it opens the holes and takes the old lace by
  its density). The core is the HEAD, where the store's breaker runs (B
  0.1 to 0.8, where F is 0.2 to 1), at coverage 1, and the surface's own
  fold at the pixel: on the breaker's ramp at 0.5 where B gates it, and
  since round 6 also on the LAY ramp at `headLay` 1 under the same gate,
  so the head carries a crackled crest line (0.33% of the judged pixels
  from above, q12; nothing at eye level). The core takes the clump's `mid`
  and the net's `holes` with the trail (`coreMod` 1, round 4's draw; round
  5 kept it a whole mass). OLD foam is the residual on the windrow lines
  (coverage 0.12 to 0.6, at most 0.1) and the Beaufort streaks between
  whitecaps at 0.4 of their measured coverage. The round-5 controls
  (`ageThin`, `tailOld`, `tear`, `tearDense`, `tearScale`, `headTear`,
  `foldFree`) are all off. Far out (a footprint of 1.5 to 8 m, or where
  the lace is unresolved) the strands at 8x their size tear the foam
  (0.8), its coverage is 1.2 of itself and 0.4 of that off a crest, and
  the head fades to the trail. At a GRAZING VIEW (the footprint 2.5 to 5
  times longer than wide) the veil takes 0.75 of the draw in place of the
  lace.
- **The light.** Fresh foam 1, old 0.7, the head 1.2; on a crest 1.06, in a
  trough 0.78; a face tilted off the zenith 0.8 to 1.03; the texture's
  holes 0.8 of its fibers. Under the storm deck the foam is lit by the
  deck's radiance (GG-280), computed once a step, at 2.2 times it.
- **Measured on the judged crops** (storm-high, 0 0 700 900, against
  ref/demo/preset-storm.png, `foam/lumstats.py`): pixels 70 sRGB over
  the water's median, the reference 1.71%, ours 1.90% at round 6, 1.67% at
  round 7 and 2.45% at round 8; pixels 50 over, the reference 3.33%,
  ours 4.06, 3.77, then 5.04%; the brightest 1%, the reference 111,
  ours 119, 116, then 122 (round 8 is brighter than the reference
  in its cores by choice: the verdict asked for bright crisp cores and
  called the reference "too smoky"). Eye level (storm-away, 0 340 540 900,
  against storm-away.png): pixels 70 over the median, the reference
  0.38%, ours 0.16% at rounds 6 and 7 and 0.15% at round 8; 50 over,
  the reference 4.34%, ours 1.31 then 1.35%; the brightest 1%, the
  reference 97.7, ours 90.3 then 89.7. Round 8 against round 7,
  pixels moved over 8/255: 9.99% of the frame from above,
  5.55% of the eye-level frame (the mid-distance whitecaps denser
  under G's cap, the near flecks as round 7 drew them: `r8d-near-zoom.png`),
  11.2% at plan-high. Round 7 against round 6: 9.23% from above,
  0 pixels at eye level. Round 9 from above: pixels 70 over the median
  1.65% (the reference 1.71%), 50 over 3.81% (3.33%), the brightest 1%
  117 (111). Eye level: 70 over 0.09% (0.38%), 50 over 1.17% (4.34%),
  15 over 8.44% (31.4%), the brightest 1% 88.3 (97.7). Round 9 against
  round 8, pixels moved over 8/255: 10.08% from above, 4.44% at eye
  level, 9.78% at plan-high.
- **Determinism.** A pinned clock rebuilds the store from rest 30 s before
  the pinned time, re-stepping the FFT at each step's own time in one compute
  call per step; two page loads gave pixel-identical frames at both judged
  poses (`pinnedDiff.mjs r7pd`, 0 differing pixels; round 8 `r8pd`,
  0 differing pixels). A live clock continues the store.
- **Stamps.** `setStamp(i, x, z, r, s)` lays foam down from outside the sea (a
  wake, a hull), 16 slots, into F only, at their own strength.
- **Cost** (`foam/foamAB.mjs`: the storm with the foam mounted against the
  same storm and pose without it, 400 frames a run, four rounds with the
  order alternated, vsync off, a live clock so the store steps at 30 Hz as
  in play; the bench draw delta is the one metric whose rounds agree, see
  Frame cost, probe traps). Round 6's run (`perf-fab6.json`, 2026-09-25,
  four rounds, another consumer on the GPU the whole time at 39 to 40%
  before each run; the foam-off draws 2.9 ms at storm-away and 3.0 to
  3.9 at storm-high against round 4's quiet 1.8 and about 2.5, so every
  absolute number here carries about 1.6 times contention): the READ, the
  bench draw delta, 2.25 ms at storm-away and 0.22 at storm-high with every
  round-6 fetch taken for every pixel; after the fetches went behind
  branches (`r6i.py`, `r6j.py`; the ablation `benchAblate.mjs` split the
  read into G's two display fetches 0.12, the curls 0.05 and round 4's base
  1.58 at storm-away) the read was 1.74 ms at storm-away and 0.96 at
  storm-high, quiet-GPU equivalent about 1.05 and 0.6, within the 1.3 ms
  the lead set. Round 7's run (`perf-foamR7.json`, 2026-09-25, four
  rounds, the same other consumer on the GPU at 39% before each run, the
  foam-off draws 3.0 ms at storm-high and 2.9 at storm-away, the same
  contended baseline as round 6's): the READ 1.10 ms at storm-high
  (rounds +1.10, +1.10, +1.06, +1.10) against round 6's 0.96 by the same
  measure, the difference the two further CDF table reads and the deltas'
  arithmetic from above (the wisp rides the curl fetch); and 1.74 ms at
  storm-away (rounds +1.75, +1.77, +1.71, +1.75) against round 6's 1.74:
  every round-7 branch is skipped at eye level. The step's compute delta
  is 0.00 ms at both poses. Quiet-GPU equivalent by the same ratio: about
  0.66 ms at storm-high and 1.05 at storm-away, within the 1.3 ms; a
  quiet-GPU rerun is still owed for the absolute figures. Round 8's run
  (`perf-foamR8.json`): four rounds; the other GPU consumer was quiet this time, the foam-off draws 1.88 ms at storm-high and 1.80 at storm-away, round 4's quiet levels, so these are near-absolute figures: the READ 0.73 ms at storm-high (rounds +1.06, +0.70, +0.73, +0.75) and 1.22 ms at storm-away (rounds +1.13, +1.12, +1.23, +1.13), against round 7's quiet-equivalent estimates of 0.66 and 1.05, both within the 1.3 ms the lead set; the step's compute delta 0.00 at both poses. Round 8 added to the read, at every angle, the fringe's and the fine regime's CDF reads and the deltas' arithmetic; the bubbles and the fine wisp ride the curl fetch, and the fringe's own fetch runs only where the aligned fibers are over 3 px wide and a bubble is still under 5 px, a band that neither judged view has.
  Round 9's run (`perf-foamR9.json`, four rounds; the foam-off draws
  1.89 ms at storm-high and 1.79 at storm-away): the READ 1.07 ms at
  storm-high (rounds +1.07, +1.13, +0.98 and one round with the off side under another GPU consumer, 3.12 against 2.94) and 1.31 ms at storm-away (rounds
  +1.25, +1.31, +1.24 and one round with both sides contended, 4.29 against 3.03), against round 8's 0.73 and 1.22; the step's compute delta
  0.00 and 0.01 ms. Round 9 added to the read the hair tile's fetch
  and three CDF reads in the fine regime (the round-8 fine reads are
  skipped there), the tear noise's four hashes, and the age arithmetic;
  to the step, one float read, write and copy a texel a level.
  The STEP is one compute call a step (the deck kernel and both levels'
  kernel and copy in one list, `stepNodes`; a catch-up merges the FFT
  re-steps into the same list); round 7 added nothing to it that runs
  (the segment and the curve are inside uniform branches at 0), and to the
  read, from above only, two more CDF table reads and the arithmetic of the
  deltas (the wisp rides the curl fetch; at eye level every round-7 branch
  is skipped). The render-side sea reads go through the filtered atlases;
  the step's reads keep the exact fp32 buffers. Earlier figures from the
  `gpuCost` probe are retracted: three r172 times only the first pass of a
  context.
- **Round-7 proof** (`.agent/scratch/ocean-gauntlet/foam/`, gitignored):
  patch scripts `r7a.py` to `r7f.py` (the segment on the gate's argument,
  then on its output; the wisps and the head from above; G from above; the
  shipped values); debug captures `r7-dbg-*.png`, `r7-G-lay-1x.png`; the
  sweep batches `b-r7a.json` to `b-r7e.json` and `b-r7final.json`, their
  shots `shots/r7*-*.png`, sheets `sheet-r7*.png` and zooms `r7*-zoom*.png`;
  the round-6 state of the shipped code against `ours/foamR6-*.png` (0
  pixels at both poses, `r7final-r6state-*`); final frames
  `ours/foamR7-*.png` and the segment-on alternative `ours/foamR7s-*.png`;
  the judged pairs `judge-r7-high.png` and `judge-r7-away.png`; regressions
  `ours/foamR7wp*-ref-open.png` (foam on against off on the waterpro sea:
  0.242% of pixels, round 6's pair 0.242%, and the foam-on frame is round
  6's to the pixel, that pose being 4 degrees down) and
  `ours/foamR7sp*-storm-eye.png` (spray with foam against spray alone,
  GG-281: 6.262%, round 6's pair 6.26%); determinism `pinnedDiff.mjs r7pd`
  (0 differing pixels, both poses, two loads); the mirror check on the
  shipped page (hash 0, lace 0.0005, the wisps included).
- **Round-8 proof** (`.agent/scratch/ocean-gauntlet/foam/`, gitignored):
  patch scripts `r8a.py` to `r8e.py` (the world-space controls; the fine
  regime; the fine wisp; the fringe's size key; the shipped values); the
  sweep batches `b-r8a.json` to `b-r8d.json`, their shots `shots/r8*-*.png`,
  sheets `sheet-r8*.png`, zooms `r8*-zoom*.png`, the near-water zooms
  `r8c-near-zoom.png` and `r8d-near-zoom.png`, the eye-level crops
  `r8*-away-1x.png`; the round-7 off-state of the shipped code against
  `ours/foamR7-*.png` (0 pixels at both poses, `r8final-r7state-*`); the
  tilt sweep `tilt-r8.png` (`tiltSweep.mjs`, `tiltStrip.py`, shots
  `r8tilt-p*.png` and `r8tiltOff-p*.png`); final frames `ours/foamR8-*.png`;
  the judged pairs `judge-r8-high.png` and `judge-r8-away.png`;
  regressions `ours/foamR8wp*-ref-open.png` (0.242% of pixels, round 7's
  pair 0.242%) and `ours/foamR8sp*-storm-eye.png` (6.320%, round 7's pair
  6.262%); determinism `pinnedDiff.mjs r8pd`; the mirror check on the
  shipped page with the bubbles and the fine wisps.
- **Round-9 proof** (`.agent/scratch/ocean-gauntlet/foam/`, gitignored):
  the CPU prototype `hairProto.ts` and its sheets `hairProto-a*.png`,
  `hairProto-b-zoom.png`; the sweep batches `b-r9a.json` to `b-r9i.json`,
  their shots `shots/r9*-*.png`, sheets `sheet-r9*.png`, zooms
  `r9a-zoom-raft.png`, `r9g-zoom.png`, `r9h-zoom.png`, `r9h-zoom2.png`,
  the eye-level crops `r9a-away-1x.png` and near zoom `r9a-near-zoom.png`,
  the freshness debug frames `shots/r9a-dbgA-high.png` and
  `shots/r9g-dbgA-away.png`; the round-8 off-state of the shipped code
  against `ours/foamR8-*.png` (0 pixels at both poses,
  `r9final-r8state-*`); the tilt sweep `tilt-r9.png` (`tiltSweep.mjs`,
  shots `r9tilt-p*.png` and `r9tiltOff-p*.png`); final frames
  `ours/foamR9-*.png`; the judged pairs `judge-r9-high.png` and
  `judge-r9-away.png`; regressions `ours/foamR9wp*-ref-open.png`
  (0.242% of pixels, round 8's pair 0.242%) and `ours/foamR9sp*-storm-eye.png`
  (6.181%, round 8's pair 6.320%); determinism `pinnedDiff.mjs r9pd`; the
  mirror check on the shipped page with the hair channels (hash 0, lace 0.00053, float16 rounding).
- **Open.** The fresh rafts are still capsules, the swept blob's own
  outline with a hairy fringe and a quarter halo; a deposit shaped along
  the run (the deposit power, `depositPow`, or a breaker as a crest
  segment, `segDepth`, both built and off) is the store-side answer and
  each costs the eye-level near water. The old windrows are dimmer and
  scratchier than the reference's soft scatter. The store's A does not
  spread with F, so a trail's diffused skirt is old by construction. From above the masses' cores are less dense than the
  reference's rafts; the fill's density at the core is the gap left.
  `tailDim` is built and off (it cost the eye-level near flecks). The
  crest segment and the curve (round 7) are built and off. G's fade (3 s)
  sets the masses' length along the wind and is a store value. The
  eye-level frame has moved again in round 9 and awaits its judgment.
  `coverageAt` (the spray's read) returns F alone, not G.

## Beach

`oceanBeachMath.ts` (the physics, no three import), `oceanBeachWorker.ts`
(the physics off the main thread), `oceanBeach.ts` (the look), mounted by
`?extras=beach&sea=shallow` (`oceanExtras/beach.ts`, which builds its own
sea floor: do not list `seabed` with it). Beach round 1, 2026-09-27. The
judged pose is `beach-shore` in `.agent/scratch/ocean-gauntlet/beach/
shootBeach.mjs` (the eye 7.5 m up, 45 degrees down, turned 12 degrees
seaward; the judged crop x 1079 y 633 w 501 h 252), against
`ref/video-v3/t0007.png`, Water Pro's "Dynamic foam" shore shot. A pinned
capture of the beach must wait for `__OCEAN__.extras.beach.settled()`
(`shootBeach.mjs` does); `shootOurs.mjs` does not wait.

**Where it is.** The lagoon of the caustics piece with a sand cay in it:
`LAGOON_CAY_SEABED` is `LAGOON_SEABED` plus `island: LAGOON_CAY` (an ellipse
90 x 55 m whose long side faces the `shallow` sea's swell; a 1:11 face, a
1:7 step under its toe to the lagoon flat, a berm at 0.95 m, 12 m cusps, a
tan beach sand of its own). `LAGOON_SEABED` has no island, and its map is
bit for bit the map before the island existed. The swash grid lies on the
cay's side facing the swell: 132 x 96 cells, 12.5 cm across the shore by
50 cm along it, from 0.74 m of water to 0.86 m up the face, 48 m long.

**The swash.** The 2D shallow-water equations with momentum (HLL fluxes,
the hydrostatic reconstruction of Audusse et al. 2004, Manning n 0.018
semi-implicit), a fixed 1/100 s step. The land page's solver
(`shallowWater.ts`) is not reused: it holds no momentum, and a swash climbs
above the sea's level on its own speed; the soak and its exact ledger are
the land page's idea. The sea edge is an absorbing and generating boundary
(Kobayashi et al. 1987). Its level is THE FFT SEA'S OWN HEIGHT there
(`IncidentWaves`): the swell and chop cascades' strongest modes (967; 95%
of the swell's variance, 77% of the chop's) from the same spectra and seeds
as the GPU, summed on the CPU; a test matches the full sum to the CPU FFT
reference at grid points to 1e-6 m.

**The sand.** The registry's `Material.Sand` conductivity (1e-4 m/s), its
porosity from the registry's density (1 - 1600 / 2650 = 0.396), the
Brooks-Corey fit for sand (Rawls et al. 1982) and the Green-Ampt suction.
Each cell has a skin (the top centimeter) and a deep store (30 cm) over a
water table at 0.05 m rising 1:50 landward; cells in its capillary fringe
stay saturated (the glassy band). The sheet soaks into the skin at the
Green-Ampt rate, the skin gives its water to the deep store by suction and
gravity, the deep store drains to the water table, the skin loses a little
to the air. THE LEDGER: the water in across the sea edge equals the change
of the sheet and the sand plus what drained and evaporated, to rounding.

**Foam, sand in the water, the mark.** Foam is born where the surface rises
faster than 0.15 sqrt(g h) (Kennedy et al. 2000), rides the flow, and pops
in 4 s in the surf, 7 s in a sheet under 5 cm, 25 s stranded on the sand.
Suspended sand is picked up over 0.3 m/s and settles at 0.023 m/s; it
blurs the floor's web and detail (the hook's `floorClarity`) and its fines
veil the surf's water pale and sandy. Bubbles after a bore make the water
milky in plumes. The swash mark is laid where a row's tip turns from
onshore to offshore (the top of each uprush) and lasts a minute.

**Debris.** 150 shells, 24 sticks, 36 strands of weed, each a rigid body on
the bed: gravity along the slope, buoyancy, drag at the flow speed of its
own height (the log law), Coulomb friction (a stick rolls across its axis
at a quarter of its sliding friction, so it turns broadside), added mass.

**Determinism.** The beach steps from a fixed start at t = 0 with a fixed
step; a restored checkpoint reproduces a continuous run bit for bit (a
test). The worker takes about 0.33 s of one core per second of beach, so
the first pin at 42.0 s waits 10 to 14 s.

**The look.** The floor (`createOceanSeabed`) gets the beach's
`SeabedShoreHook`: the wet albedo (Angstrom's law, 1925, as Lekner and Dorf
1988 give it) and the sand's mottle and specks, the suspended sand's
clarity, the foam, milk and veil on the sea's own surface, and the patch of
ground the beach draws itself (the floor mesh discards there). The beach's
sand mesh lights its sand with the floor's own function
(`floorRadianceAt`) and adds the wet film's gloss, the stranded foam and
the mark. The sheet is a transparent film over the sand; thicker than 5 cm
it is the floor's own see-through reader, so where the sheet and the sea
meet they draw one water. Seaward of the still-water line the sheet is
drawn up to 0.15 m low, so the sea wins where the two stand at one level;
a dry sheet vertex sinks 3 cm under the sand so the depth test drops the
dry sheet. The state reaches the GPU as three half-float textures read
through a cubic B-spline at a point moved by a small world-space wander,
and the look's noise is one baked texture (the per-pixel Perlin noise cost
6 ms of draw).

**Changes in the seabed files** (behind the hook or a map with land;
`LAGOON_SEABED` has neither): the `island` parameter and
`LAGOON_CAY_SEABED`; `SeabedShoreHook` (`owns`, `floorAlbedo`, `waterFoam`,
`floorClarity`); on land the floor's light is the sun in the air, with no
web and no ripple marks, and the island's own sand; `floorRadianceAt` on
the returned seabed. The five judged scenes: 0 pixels over 8/255 against
the seabed files before the piece (`beach/sameShots.mjs`,
`perf/quality.py beachbase beachnew`).

MEASURED (`beach/cpuMeasure.ts`, the page's own code, forcing and start):

| Quantity | Value |
|---|---|
| Wave height at the sea edge | Hs 0.52 m (4 sigma); the swell's peak 9.3 s |
| Run-up, R2% (the 1 cm sheet's edge) | 0.743 m high, 8.2 m up the 1:11 face; Stockdon et al. (2006) 0.715 m |
| Swash excursion (98% - 5%) | 0.737 m high; Stockdon's significant swash 0.772 m |
| Swash period | median 9.85 s over 836 swashes |
| Ledger | 1.1e-12 m^3 of 44 m^3 over 180 s; worst second 2.5e-12 m^3; nothing clipped |
| Wet band at 180 s | 8.25 m median from the still-water line (7.4 to 9.1 m) |
| Drying, the waves stopped | the wet edge 9.1 -> 8.3 m in 5 min, 7.1 m in 10, 5.75 m in 30; the band's top looks dry in 3 min; its middle stays damp over the water table |
| Debris path per swash | sticks 4.3 m (they float), weed 2.3 m, shells 1.7 m |
| Judged crop, foam | ours 4.4 to 5.7% of the crop, band 24 to 42 px; the reference 4.9%, 25 px |
| Sand (luma, saturation) | dry 149, 0.18 (the reference's sand 142, 0.17); wet 114, 0.17; wet / dry 0.76 |
| Cost at the judged pose | GPU draw +2.2 ms over the floor alone (5.23 against 3.05 ms, paused bench, same minutes); the worker a third of a core |

**Round 2 (beach, 2026-09-27).** Round 1 lost its blind judge (bc1-A): the
bore's foam read as "a solid, bright white smear with vertical streaks", the
sand beside it as bone-dry, the water as flat gray-green, and the debris as
pencils and dots. What the crop holds (`beach/cropState.py`, the judged
camera's rays cast onto the CPU state): at every instant from 36 to 48 s the
whole crop, 0.7 to 4.9 m up the face, is under water, a bore at its left and
a backwash film 4 to 7 mm deep carrying foam at 0.17 to 0.23 of cover; the
film's tip is at 6.3 to 7.6 m and the wet band's edge at 7 to 8 m. So the
crop sits in the lower swash zone and cannot show dry sand at this pose;
the wet band is right for these waves (the run-up matches Stockdon). The
changes:

- THE FOAM is the baked swash foam tile (`buildSwashFoamTile`: two warped
  Worley nets of 25 and 10 cm cells, 3 cm bubbles, 0.5 m patches, a ranked
  threshold) drawn with the foam piece's coverage-true `foamLaceAlpha`, so
  the drawn area is the foam the swash carries: the film's thin foam is a
  lace of bubble lines in patches with bare film between, the bore's a raft
  with holes. Thin lace is seen through (60% opaque, 90% for a raft); the
  bubbles shade it. The flow map runs at a third of the sheet's speed, at
  most 0.5 m/s, over 0.8 s phases: round 1's full-speed map sheared the
  texture across the bore's front into the streaks. One 10 cm net alone drew
  a reptile-skin crackle over the whole film (the foam piece's finding).
- THE FILM'S CAUSTIC WEB: a rippled film is a sheet of lenses that focus at
  its own depth, so the sand under 1 mm to 6 cm of film carries a moving web
  of sunlight (the tile's bubble net, its mean held at 1), faded before its
  lines go under two pixels. Capillary ripples (slope 0.08) break the film's
  sky reflection.
- THE WATER: the fines' veil at 0.2 (from 0.45), the bubble milk at 0.12
  (from 0.22).
- WET SAND: stranded foam wets the sand under it; the wet ramp is Se 0.3 to
  0.65 (a sharp wet line, as a swash leaves). Its gloss is physically faint
  from the judged camera: water's Fresnel at the crop's 27 degree incidence
  is 0.02, so the film and gloss add 2.7 luma (2.5%) there.
- THE GRAIN over the patch is two octaves of smooth noise (the hook's
  optional `grain`): the floor's 1.2 cm square cells drew a blocky knit on
  dry sand from 3 m. The look's noise is baked at 16 texels a lattice cell
  (8 drew a zigzag).
- DEBRIS: sticks in four crooked shapes of real proportion (scaled by their
  length alone; round 1 scaled their width by their diameter, which flattened
  every bend and branch into it), tapering, knotted, with a broken twig and
  pale ends, in wet bark brown or bleached gray, 22 to 70 cm; shells a ribbed
  cockle and an oval clam, 3.5 to 8.5 cm, cream to slate, with growth bands;
  weed a clump of five curling, ruffled fronds; a soft contact shadow under
  each shell and stick.

| Quantity (round 2, `beach/r2measure.py`) | Ours | The reference |
|---|---|---|
| Foam lip, landward 90-10% rise | 18 px (10% 4, 90% 29), a ramp | 20 px |
| Foam band peak luma, width | 205, 73 px | 173, 57 px |
| Sand in the crop (luma, saturation) | wet under the film: 120, 0.146 | dry: 142, 0.174 |
| Sheen of the film and gloss in the crop | 2.7 luma mean (2.5%), 17 at most | none |
| Shallowest water's texture over the sand's | 0.80 (foam off) | 0.87 |
| Debris path per swash | sticks 3.5 m, weed 2.0 m, shells 1.6 m (lighter shells 1.76, heavier 1.49) | - |
| Cost at the judged pose | draw +2.4 ms over the floor alone (6.12 against 3.75 ms; the sheet about 1.1 ms) | - |

The five judged scenes: 0 pixels over 8/255 against the seabed files
before the piece, after round 2 (the grain hook runs only with a hook).

## Frame cost

Verified: 2026-09-25, at the end of the performance pass (ten iterations,
`.agent/scratch/ocean-gauntlet/perf/`). Numbers are 1600x900, vsync off,
headless Chrome WebGPU on the RTX 2070 SUPER, with another session's
benchmark and a game on the same GPU.

**What one frame does.**

1. ONE compute call (`OceanField.step`): `pack`, `hAxis`, `vAxis`,
   `unpack`, `planeAtlas`, the normal mip chain (level 0 and 8 averages)
   and the mip atlas copy. About 0.35 to 0.6 ms of GPU.
2. The draw: the surface (its vertex shader reads `dispTex`; its fragment
   shader reads the normal mips, 3 or 4 cascades x 4 taps x 2 levels, one
   filtered fetch each), the pieces, and the sky mesh LAST.

**Rules that keep it fast. Each was measured; do not undo one blind.**

- Put compute nodes in ONE `renderer.compute(list)` call. Each call pays
  its own encoder, pass and submit, about 0.5 ms of CPU. Split a call only
  where a uniform must change between dispatches (the spray's steps).
- Render-side plane reads go through the atlases
  (`createOceanSampler(..., { filtered: true })`). Compute readers (spray,
  wake, buoyancy) keep the exact fp32 buffers, so no physics changed.
- The sky is `createOceanSkyMesh`, drawn after the opaque objects with the
  depth test, not `scene.backgroundNode`, which three draws first under
  everything. A pixel the sea or the underwater dome covers is not shaded.
- The storm deck's fractal noise runs only when `overcast > 0` (a uniform
  branch in `oceanSkyRadiance`); in fair weather it was mixed in at weight 0.
- A spark's hashes and shape run only where the spark is lit.
- SPARK NEIGHBORS (2026-09-25). A spark is one jittered point per world
  cell, stretched 3 times along the crest, so it can pass its cell. Each
  pixel reads its own cell and the 8 cells around it and draws every lit
  spark whole; before, the cell border cut a spark straight, which drew
  8-pixel glitter blocks and, near the camera, a grid of white squares.
  The halo's reach along the crest is capped at 1.2 cells so 3x3 holds
  it. Below level 0 the lit share falls with the cell's area on screen
  (`sparkNearDensity`), so the near water shows sparse soft glints.
- Three gates keep the 3x3 read cheap: a cell whose lit chance is 0.0005
  or less is skipped, a blended level whose weight is under one 8-bit
  step is skipped, and a neighbor whose point box ([0.2, 0.8] of the
  cell) is farther than 1.2 cells from the pixel is skipped before its
  hash. The prune changes no drawn spark (0% of the pixels over 8/255).
  Measured A/B against the own-cell read (`perfAB.mjs glP`, 4 rounds of
  400 frames): open 2.30 -> 2.70 ms, wake 3.60 -> 4.30 ms, storm 5.60 ->
  5.00 ms (the storm has few lit cells), overall -4.3%. The judged open
  frame changed on 1.1% of its pixels (the streak tails are now whole),
  the wake frame on 3.9%, the storm and shallow frames 0; the glitter's
  light is 1.24 times the old. Shrinking each spark to fit its cell was
  tried and failed: it halved the glitter's light, and the cores clip.
- Keep `ANISO_TAPS` fixed. Taps sized to the footprint behind per-tap
  branches made the draw 13% SLOWER: a fetch is cheaper than its branch.
- The mip atlas keeps the corner placement of a coarse level's texel. A
  true mipmap (one trilinear fetch a tap) centers it, which is correct but
  moved the mid-field glints on 2.7-3.8% of the pixels: a look change for
  blind judging (GG-302), not a speed change.

**The pass, measured A/B in the same minutes** (old path against new):

| # | Change | Overall frame, old -> new | Kept |
|---|---|---|---|
| 1 | One compute call per frame | 7.32 -> 6.10 ms (16.7%) | yes |
| 2 | Normal mips through a filtered atlas | 6.48 -> 4.32 ms (33.3%) | yes |
| 3 | FFT: one dispatch per axis, workgroup memory | 5.10 -> 4.30 ms (15.7%) | yes |
| 4 | No deck noise in fair weather | 4.04 -> 3.66 ms (9.4%) | yes |
| 5 | Render-side plane reads through atlases | 4.00 -> 3.54 ms (11.5%) | yes |
| 6 | Sky drawn last, depth tested | draw 1-12% lower; frame within noise | yes |
| 7 | GPU timestamps off in the viewer | 1.5-3% | no (three piece probes read them) |
| 8 | Taps sized to the footprint | 3.9% slower | no |
| 9 | One trilinear fetch per tap | failed the quality bar | no |
| 10 | Spark shape only where lit | 1.6% | yes |

The old figure of each row is that run's own reference: the machine's
background load moved between runs, so the rows do not chain exactly. The
pinned frames of the final build against the build before the pass: at most
0.096% of pixels moved by over 8/255, mean change at most 0.03%.

**Where the cost is now.** The frames wait on the GPU. The surface's pixel
shader is the largest part (1.2 to 2.5 ms of draw); the sea's compute is
about 0.4 ms. The spray's update is 2.4 ms per 60 Hz step (GG-301): with
vsync off it runs every fourth frame or so, so the frame-time metric sees a
quarter of it, but at a real 60 fps it is the largest single GPU cost.

**Probe traps** (foam cost split, 2026-09-25; rigs in
`.agent/scratch/ocean-gauntlet/foam/`). Two instruments give wrong numbers
here. (1) three r172's timestamp queries time only the FIRST pass of each
context: `WebGPUBackend.initTimestampQuery` attaches the `timestampWrites`
once, when it creates the query set, while `beginCompute` builds a fresh
descriptor every call and the default render descriptor is rebuilt on
resize, so `renderer.info.render.timestamp`, `info.compute.timestamp`, the
viewer's `gpuMsPerFrame` and `gpuDrawMsPerFrame`, and the foam probe
`gpuCost` all return one constant forever (41.5 ms, the cold first draw;
3.24 ms, the cold first foam pass). The tell is min equal to median to six
decimals. Iteration 7 above kept the timestamps on for the piece probes;
they read nothing, so that 1.5 to 3% is still on the table. (2) A readback
fence issued while the live loop runs waits behind about 310 frames the
loop has already queued (vsync off and no frame limit let it run that far
ahead of the GPU before Chrome's command buffer back-pressures): 0.85 to
1.15 s, scaling with frame time, not with the work in front of it. The
viewer's `bench` pauses the loop and its first fence drains that backlog, so
its numbers hold; a piece probe that fences without pausing (`benchStep`,
`stepCpu`, `gpuCost`) reports the backlog divided by its count. The same
back-pressure stalls a main-thread `renderer.compute` call for 1.6 to 3 ms
every six or seven calls when the queue is full, and inflates
`cpuSplitMs.render` on a loaded GPU (4.5 to 6.2 ms against 1.0 to 1.6
quiet): a CPU rise in an A/B under GPU load is GPU time surfacing. Measure
a piece's step by classifying live frames by whether it stepped in them, or
by the marginal cost between two step counts, never by one fenced window.

## Proof surface

- `npx vitest run src/systems/world3d/ocean` — spectral identities, the
  Hermitian and packing checks, the sign gate, the FFT against a naive DFT;
  for bodies: Archimedes at the design draft, the analytic heave period
  with and without added mass, no energy gain, righting from a tilt,
  alignment with a wave's pressure gradient, the 6 x 6 added-mass solve
  against a closed form, the parcel limit and the Smith effect in a regular
  wave, e^{-k d} decay for a one-wavelength band, Lagrangian differences
  against a known parcel, per-band slopes for the horizontal pressure, the
  mooring's slack, bit-identical replay, and the inversion's convergence on
  a Gerstner sea.
- `__OCEAN__.extras.buoys.verifySampler()` — GPU probe sampling against a
  CPU mirror of the same bilinear sum, LOD fade and inversion over the whole
  `disp` readback, the per-band kinematic samples included; max error
  1.2e-6 m over 280 probes.
- `__OCEAN__.extras.buoys.kinematicConsistency()` — each band's parcel
  acceleration regressed on -g times its slope: the regression slope is the
  band's choppiness and the correlation 0.97 (ripple) to 0.9999 (chop, sea).
- `.agent/scratch/ocean-gauntlet/buoyancy/synthFloat.ts` — the light buoy on
  a synthetic copy of a sea state with exact per-component kinematics at
  depth; it measures the per-band approximation against that oracle.
- `.agent/scratch/ocean-gauntlet/buoyancy/shootStrip.mjs` — a strip of
  frames 200 ms apart from a pinned start; it rebuilds one frame from
  scratch and requires the body state to match exactly.
- `__OCEAN__.crossCheck(t)` — GPU displacement against the CPU reference,
  cell by cell; relative RMS about 1e-5 (float32) on every state.
- `__OCEAN__.setDebug(1 | 2 | 3 | 4 | 5)` isolates Jacobian, foam, normal,
  height, specular for a capture.
- `__tests__/oceanSky.test.ts` — the billow volume is deterministic, tiles,
  and sits where the erosion thresholds assume.
- `.agent/scratch/ocean-gauntlet/shading2/sweep.mjs` — many tuning variants
  in one page load through the probe; `bandStats.py`, `glintFrac.py` and
  `glintLR.py` measure a capture's rows under the horizon against the
  reference; `pair.py` makes blind pairs for guidance critics.
- Frame time: `frameTime.mjs` (vsync off, A B A B) in the gauntlet scratch.
- `.agent/scratch/ocean-gauntlet/distance/`: `bands.py` measures a frame in
  bands of pixels above and below the horizon (mean, sd, fine band-pass),
  aligned by horizon row; `sweep.mjs` shoots tuning variants in one page
  load; `pair.py` makes the horizon (0 170 600 290) and full (0 0 540 900)
  blind pairs, and `OURS=A` or `OURS=B` pins the order (see Open: the
  horizon crop's order bias).
- `.agent/scratch/ocean-gauntlet/distance2/` (distance round 2): `serve.mjs`
  keeps one browser on the viewer and serves working copies of the surface
  files (`work/`, kept by `sync.mjs`) to that browser only, so a sweep never
  reloads another builder's page; `run.mjs` queues a batch of poses and
  tuning variants to it. `prof.py` prints the luma, sd and saturation row by
  row through the horizon; `texstats.py` the far water in bands (color,
  saturation, sd, grain, run lengths, skew, sheen share); `vacf.py` the
  vertical and horizontal autocorrelation (thin stripes against patches);
  `cmp.py` and `zoom5.py` put a frame beside the reference, whole and at 5x.
- `.agent/scratch/ocean-gauntlet/distance3/` (distance round 3): the same
  private rig (`serve.mjs`, `sync.mjs`, `run.mjs`), with the page FROZEN
  between batches (`Page.setWebLifecycleState`) so an idle viewer does not
  load the shared GPU under another builder's timing run, and the sweep
  poses `sw-h2` to `sw-h1500`, `sw-y45` to `sw-y180`, `sw-p2` to `sw-p35`.
  `final.py` is the round's patch to the three files; `pct.py` prints each
  band's mean, sheen (top fifth) and dark (bottom fifth) colors against the
  reference; `pdiff.py` the pixels over 8/255 in crops; `zoom.py` and
  `sheet.py` the zooms and the off-and-on sheets.
- `.agent/scratch/ocean-gauntlet/distance4/` (distance round 4): the same
  rig, `serve.mjs` taking a wake pose too; `final4.py` is the round's patch
  to the two files; `bands4.py` (and `bsum.py`) the measurable half: bands
  of rows under the line and the 10 over it, in four column bands, luma,
  sd, saturation, blue minus green, the share brighter than the sky row and
  the sea-sky step; `hue.py` green over red and blue over green row by row;
  `skyprof.py` the sky over the line; `freq4.py` the texture by scale;
  `five.mjs` the five judged scenes through the rig; `perfRun.mjs` and
  `perfVar.mjs` the same-minutes cost.
- `.agent/scratch/ocean-gauntlet/distance5/` (distance round 5): the same
  rig; `final5.py` is the round's patch to the two files; `sky5.py` the sky
  over the line in 10-row bands (luma, saturation, blue minus red, the luma
  change a row, the flat band); `skymodel.py` a CPU copy of the gradient
  through the ACES fit and the sRGB encode (within 0.5 luma of the frame
  where there are no clouds) and `skyfit.py` its least-squares fit to the
  reference; `seab.py` and `pct5.py` the sea in bands down the shading crop
  (mean, sheen and dark colors); `waitgpu.sh` blocks until no other GPU job
  runs.
- `.agent/scratch/ocean-gauntlet/distance6/` (distance round 6): the same
  rig; `final6.py` and `final6b.py` are the round's patch to the two files;
  `cloud6.py` the clouds' contrast and the haze's hue over the line;
  `streak6.py` the far strip's texture (sd, horizontal and vertical
  correlation, dark run lengths); `shotsFive.mjs` the five judged scenes
  under a name the shared GPU-job filter sees.
- `.agent/scratch/ocean-gauntlet/distance7/` (distance round 7): the same
  rig, its batch runner renamed `runPose.mjs` so the lead's job filter
  (`_lead/gpuwait.sh`) sees it; `final7.py` is the round's patch;
  `aspect7.py` the far sea's streak shape in 10-row bands (the gradient
  energy ratio and the correlation lengths); `scales7.py` its texture in
  three band-passes.
- `npx vitest run src/systems/world3d/ocean/__tests__/oceanSpray.test.ts` —
  the spray's fixed-step plan (restart on a camera cut, a turn or a
  footprint change; a catch-up that converges), its wind, the Beaufort
  factor, the wind profile, the drop drag, and its copy of the surface's
  footprint fade.
- `npx vitest run src/systems/world3d/ocean/__tests__/oceanUnderwater.test.ts`
  — Snell's window and the Fresnel from the water side, the refracted sun,
  red absorbed first, the path light against a numerical integral and its
  fog curves, the phase functions' normalization and mean cosine, the
  hemispherical Fresnel, the storm's exposure, the white balance, the water
  by its chlorophyll, the sheets' mean of 1 and their closed-form mean, the
  lens tiles' spread against a realized field, the calibration, and the
  tone-map twin (checked on screen with `underwater/toneCheck.mjs`).
- `__OCEAN__.extras.underwater` — `mode()`, `setTune`, `setPart`,
  `setDebugColor` (the dome in one flat color, for the tone check),
  `setDebugShare` (the shaft share each pixel reads), `benchPiece` (on, off
  and the old view, alternated).
- `__OCEAN__.extras.spray.roots()` / `seenGrid(...)` — every live strand's
  root and tip in pixels, and the spray's seen deficit on a grid of water,
  projected; the gauntlet's `spray/rootStats.py` and `spray/seenCheck.py`
  score them against the foam mask (`setDebug(2)` with the strands hidden).

## Open

- THE BEACH (round 1). The sea's own surface still has its open-sea waves
  over the grid's inner surf: they do not shoal or break, and seaward of
  the still-water line the swash sheet is drawn 0.15 m low so the sea wins
  where the two meet. A surface hook that lowered the FFT's displacement over
  the grid (a shore mask the surface reads) would let the sheet be the only
  water there. The swash grid is one 48 m patch; the rest of the cay's shore
  is the floor mesh with no swash. The forcing sums 967 modes: 77% of the
  chop's variance and 95% of the swell's. Suspended sand and bubble milk
  use one field each and no bubble plume dynamics. The debris do not touch
  one another, and weed is a chain that follows its head.
- THE BEACH'S COST: +2.2 ms of GPU draw at its judged pose (the sheet about
  1.2 ms, the sand and debris about 1.1 ms), and a third of one core in its
  worker; a pinned capture waits for the worker to reach its time from the
  fixed start. A half-resolution sheet, or a sheet that reads the sea's own
  water where it is thick instead of calling the floor's reader again, are
  the next cuts.
- THE BEACH'S LOOK against the reference (round 1, the builder's own blind
  pair): the crop's wet sand is darker and grayer than the reference's dry
  sand, and its foam line is whiter and streakier than the reference's soft
  band. Round 2 made the foam a lace and the film visible, but the approved
  crop still holds no dry sand at any instant (it sits in the lower swash
  zone); `beach-shore-up`, the pose 3.5 m up the beach, holds the film's tip
  and the wet band's edge, for the lead to weigh. The shallow water beside
  the foam is sand-colored (green under red there; the reference's is green
  over red), as 10 to 20 cm of clear water over sand is. The judged instant (42.0 s) and the pose's place along the shore
  decide how much of the crop a bore's foam fills (4% at the proposed pose,
  21% 2 m back along the shore).

- GG-279: the drawn whitecap is the instantaneous fold (about 0.5 s), so a
  spray plume cannot outlive it; a persistent, decaying foam would let the
  spray's break run the active-break duration, 1.5 to 3 s here (Rapp and
  Melville 1990).
- GG-280: storm whitecaps are drawn at a fixed foam radiance near 200 sRGB
  with single-pixel edges; most spray critics named them "confetti".
- GG-281: the spray mirrors the surface's foam mask; export it.
- GG-282: no low spindrift haze over the storm sea.
- GG-276 landed: the sea-self reflection is weighted by the facet's visible
  share. The CPU proxy's navy count was not re-run on the new shader.
- Short waves are the same everywhere: every cascade's slope is added in its
  own Lagrangian frame, so the chop and ripple do not steepen on the sea's
  compressed crests the way a real short wave does (hydrodynamic
  modulation). Dividing the shorter cascades' slopes by the longer cascades'
  Jacobian in the surface shader would give that grouping; not built. Only
  the glitter points are weighted toward the crests so far (GG-277).
- Past 100 m the judged crop has two thirds of the reference's wave-scale
  contrast (6.0 against 9.3, RMS of the 2-10 px band-pass, % of mean). A
  longer chop normal fade (to 600 and 900 m) did not raise it (6.2, 6.3)
  and added grain; it is a shading question at 5 degrees of grazing.
- GG-271: re-band `DEFAULT_CASCADES` to the `waterpro` layout and re-measure
  `storm` on it in the same change.
- GG-272: `oceanSurface.ts` keys horizon roughness on `drivesFoam`.
- Persistent foam draws only when the foam piece is mounted (`?extras=foam`);
  with no reader the surface keeps its one-frame fold ramp. The spray still
  roots its strands on its own copy of that ramp (GG-281), not on the field:
  `reader.coverageAt(grid)` is the read it should take.
- The wake's foam does not feed the foam field yet (GG-291); `setStamp` is the
  input it would use.
- The buoy's wash lives in its own 10 m foam grid, drawn on a ring mesh.
  The persistent foam field (`oceanFoam.ts`, `setStamp`) could carry it
  once the surface reads that field (`setFoam`, routed by the lead): the
  mount would stamp its breaking run-up there instead.
- The surface's contact foam (GG-274) is wired behind `?contact=1` and not
  yet judged against the ring's own wash.
- The buoy mount calls the probe's `setCenter` with the surface center
  every frame (2026-09-25); any new floating-body mount must do the same.
- The water velocity and acceleration under a body come from differencing
  readbacks, not from the spectrum; on the live path they are one frame
  old.
- The depth decay is per FFT band (the band's RMS decay), not per wave
  component: at depth a band's short end is gone, so the true motion is
  smoother than the scaled copy of the surface the step uses.
- The ocean mesh near a floating body cannot carry the ripple band (its
  vertices are a meter apart), so the mount draws a 10 m fine patch over it
  and wins the depth test with a view-ray nudge (12 cm patch, 24 cm ring). A
  locally refined ocean mesh would remove both.
- On the young `choppy` sea (round 5) the light buoy's pitch period is 2.7
  to 3.0 s and its tilt exceeds the 6 m slope under it (8.1 against 4.6
  degrees mean, `synthFloatC.ts`). The counted round-4 and round-5 judges
  both read "the whole bottom ellipse of the hull stays above the water";
  on the final round-5 strip (r7f1464, `rimZoom.py` at 4x) the water cuts
  across the hull with the wash up its side in two of the six counted
  frames (f06, f08) and the hull's whole bottom rim still shows as one
  convex curve on a collar of foam in the other four (f00, f02, f04, f10).
  The cut on a cone IS an ellipse; what the reference adds is the hull
  seen THROUGH the water below the cut (a darker, blurred continuation of
  the cone) and wash that rides up the side rather than under the rim. The
  translucent submerged hull was removed in round 4 for a dark arc it drew;
  a version cut by the sampled surface, not by a plane, is the open piece.
- `oceanConfig.ts` documents `energyScale` as the fraction of the JONSWAP
  variance a swell keeps (1 when absent); `choppy`'s chop band writes 3 (a
  current gain, see Sea states). The doc comment should say the value may
  exceed 1 and name the current-gain reason, or the gain should get its own
  field.
- The horizon crop (0 170 600 290) is not won: the critic's verdict follows
  the pair order (GG-287). Over every variant of the distance round, ours won
  7 of 48 trials as image A and 27 of 41 as image B; the shipped build won 7
  of 7 as B and 0 of 4 as A. The full crop has no such split: 17 of 17 for
  ours, 9 of 9 of them as A.
- Every distance critic names the last 15 to 20 px under the horizon: a
  smooth strip when the far field is filtered, "full-contrast ripples to the
  horizon" when it is not, and in round 1 "smooth winding stripes that do not
  shrink into fine chop". Round 2's dashes, grain and gust patches are
  statistical stand-ins too; a residual integrated from the spectrum over
  the footprint would be the real one (GG-288). They drift with the wind but
  do not evolve, and the gust patches are an eye choice, not measured.
- Round 2 split (the judge with ours as B picked ours, the judge with ours
  as A did not). Round 3 lost in both orders (d3-A and d3-B, medium): the
  last 15 to 30 px as a busy pale band, a tan stripe on the line, the teal
  to lavender jump. Round 4 split (d4-B won, d4-A lost, both medium; the
  shading re-judge on its frame split too, sh9-A lost). Round 5 is not yet
  judged. Round 5 lost both distance orders (d5-A, d5-B, medium), won
  shading in both (sh10-A, sh10-B) and waves in both (w10-A, w10-B). Round 6
  is not yet judged. Round 6 lost both distance orders (d6-A, d6-B) and the
  aligned crop (d6h-A), all medium, and won shading (sh11-A, sh11-B) and
  waves (w11-A, w11-B) in both orders. Round 7 is not yet judged. Against
  round 6 it moves `open-horizon` 3.8% of pixels over 8 grey levels (the
  aligned distance crop 11.3%; the shading crop 3.6%: its sky 0, its water
  past 60 m 5.8%, its rows 555 to 900 0), `ref-open` 2.8% (the waves crop
  4.1%, its rows 330 to 437), `sun-glitter` 2.8%, `open-low` 1.0%,
  `eye-level` 0.3%, `side-horizon` 4.0%, `high-horizon` 5.5%, `plan-high` 0,
  the wake chase view 4.8% (its rows 62 to 286), the shallows 0.5% (its rows
  201 to 218), the caustics view from high above 0 (by at most 3), the storm
  and the view from below 0. Round 6, against round 5, moved `open-horizon`
  5.2% of pixels
  over 8 grey levels (the distance crop 9.4%; the shading crop 5.5%: its sky
  10.0% by at most 29, its water 2.9%, its rows 555 to 900 0), `ref-open`
  4.7% (the waves crop 1.9%, its rows 330 to 376), `sun-glitter` 4.2%,
  `open-low` 3.3%, `eye-level` 3.0%, `side-horizon` 4.8%, `high-horizon`
  6.5%, `plan-high` 0 (by at most 6), the wake chase view 2.5% (its rows 63
  to 173), the shallows 2.2% (its rows 0 to 206), the caustics view from high
  above 0 (by at most 4), the storm and the view from below 0. Round 5 moved
  every fair-weather view that shows the sky or the far
  sea: `open-horizon` 8.4% of pixels over 8 grey levels (the distance crop
  16.1%; the shading crop 8.5%: its sky 4.8%, by at most 10, its water past
  60 m 10.7%, its rows 555 to 900 3.8%), `ref-open` 6.5% (the waves crop
  7.3%, its rows 333 to 660), `sun-glitter` 6.1%, `open-low` 3.0%,
  `eye-level` 2.1%, `plan-high` 1.4% (by at most 21), the wake chase view
  9.3% (its rows 0 to 170 22.5%), the shallows 3.9% (its rows 119 to 252,
  the sky and the far water), the view from below 0 (at most 4 grey
  levels), the storm 0. Round 4 moved the far part of
  every view that shows the horizon: `open-horizon` 1.24% of pixels over 8
  grey levels (the distance crop 0 170 600 290: 3.2%; the shading crop 0 0
  540 900: 1.05%, all in its rows 337 to 404, the sky moving by under 8,
  mean 0.35%), `ref-open` 0.79% (the waves crop 0 330 533 570: 0.97%, its
  rows 330 to 375), `sun-glitter` 0.75%, `open-low` 0.20%, `eye-level`
  0.06%, `plan-high` 0, the wake chase view 1.9% (its far water, rows 63 to
  170), the shallows 0.10% (its horizon strip), the storm and the view from
  below 0. Round 3 moved the far part of every
  view that shows the horizon: `open-horizon` 3.9% of pixels over 8 grey
  levels (the shading crop 0 0 540 900: 3.7%, all in its rows 331 to 488:
  the sky's last 3 rows over the line and the water past about 120 m; the
  rest of the sky moves by under 8), `ref-open` 2.7%
  (the waves crop 0 330 533 570: 3.1%, its top 100 rows), `sun-glitter`
  2.6%, `open-low` 0.9%, `eye-level` 0.4%, `plan-high` 0 (0.47% mean, the
  haze's height factor), the wake chase view 5.9% (its far water), the
  shallows 0.7% (the horizon strip), the storm and the view from below 0.
- The reference's far patches are navy (40-60, 70-90, 100-120 sRGB) and its
  sheen a flat pale grey. After round 3 the luma split matches (see The far
  texture) and the sky darkens into the line (to 157 luma; the reference
  153), but the sheen is bluer than the reference's cyan-grey (blue over
  green by 16 to 20 against 8; GG-321), and from a high eye the band's line
  value spans the dip under the horizontal as a flat strip (GG-320). After
  round 4 the sheen is still blue over green by 11 to 16 in the rows 6 to
  40: it reflects the sky 5 to 10 degrees up, which is bluer than the
  reference's there (GG-321). After round 5 the low sky matches the
  reference's (see One sky, two uses) and the sheen of the rows 1 to 40 is
  blue over green by 9 to 13 (the reference 7 to 9); the mid field's sheen
  reflects the sky 10 to 19 degrees up, still bluer than the reference's.
- The reference's rows 10 to 25 under the line are dark wave rows across
  the whole width (a row mean of 130 to 140 luma, sd 21), since its crests
  run across the view; at the `waterpro` heading (DIR_WATERPRO, the waves
  piece's) ours run along it, so those rows are 146.6 luma with sd 10 after
  round 4 (GG-322).
- The underside mesh (`oceanUnderwater.ts`) does not take the curvature: at
  a waterline camera its far rim sits up to 2 m over the top surface's at
  5 km (a third of a pixel). A shared vertex hook would keep the two on one surface
  (see GG-295).
- The wake (GG-291 to GG-293; GG-290, the surface hook, is resolved): round 1
  lost blind in both judged views, its foam an even, opaque white sheet with
  same-size holes and no fade with age; round 2 rebuilt the lace and its
  read (see Wake) and won the chase view, lost the quarter view; round 3
  (back-face cap, foam volume, core grain) lost both; round 4 restored
  round 2 behind look controls and keyed the quarter view's fade, wisps
  and shade on the trail's age: the chase view kept its win, the quarter
  view lost ("a smeared veil"); round 5 tore the mat into clumps at its
  edges but gated the structure on the view, which the lead ruled out
  (GG-311's class); round 5b applies it at every view, keeps only the
  lace's on-screen stretch keyed (with an orbit proof), and is captured
  in `ours/r5g-*.png`, both views to be judged again. The wake's
  foam does not feed the
  persistent foam field; the hull has no inertia and the wave field no
  breaking loss; in a turn the deposit sweeps along the chord, not the
  curved track.
- No sun glitter path at the judged pose (GG-283): the sun is 60 degrees
  up. Cloud lighting has no silver lining (GG-284). Round 4's frame time
  was measured under another process's GPU load (GG-285). The default
  sea's near field is a flat teal (GG-286).
