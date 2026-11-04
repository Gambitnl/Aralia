# World3D Lighting & Sky

Verified: 2026-11-03 for night eye adaptation (code, unit tests, WebGL night captures with a perf A-B; WebGPU night not rendered); 2026-11-03 for native object-Light stow/re-equip and shield-to-mace recast; 2026-11-03 for explicit Light object/source binding and native shield cast/settled reload; 2026-11-03 for the spellbook Light status versus ground source distinction (source inspection and native Elara cast/render/reload); 2026-11-02 for house lighting, including GG-594 parts 1 to 3 and the per-chunk light lists of GG-606 (code, unit tests; parts 2 and 3 by WebGL captures, part 1 by WebGL and WebGPU captures, each with a perf A-B); 2026-11-01 for the cloud resolve edge rule (code in both cloud setups; motion captures from 2026-10-29)

## Open exterior doorways and live daylight

Verified: 2026-11-03, source/30focused checks/five scoped type paths and native Oroten inn close/reopen/fullreload.

buildInteriorDaylight accepts the building's live open door IDs. Perimeter door apertures use their real unswung leaf rectangle, full air transmission and the existing sky view-factor/wall-occlusion/reflection model. An internal doorway is not a new outdoor source. A supplied closed-door ledger keeps a windowless room dark instead of selecting outdoor materials. Windows keep their glass factor and existing source schedule. SiteBuilding's useDoorOpenSignature subscription rebuilds only its affected room; a distant leaf or a resident using an already-open leaf does not rebuild all town interiors.

This extends indirect sky admission only. InteriorLights' fixed sun-bounce lists still use static windows, not dynamic doors. No camera fill is added. Actual plot65 has one upper dormer and no ground window; its open entry is now present in the mounted bake. Native close/reopen changes and restores the real sky attributes at exact accepted feet. The inspected common room remains very dark at16x adapted exposure; neither comfortable room navigation nor a whole lighting fix is accepted. The source compact stair also blocks normal walking. See gameplay-flow/TRACKER.md, An open inn doorway admits daylight; the legacy stair still blocks arrival, for played costs, unchanged paid reservation and36-group continuity. Object-targeted Light remains its separate owner and acceptance boundary.

## Purpose

How the walkable World3D scene is lit and what the sky contains, across the
full 24-hour clock: sun/moon direction model, sky domes (gradient day, Bruneton
night), stars, moon, fog colour, and how game time drives all of it. Geometry
facades live in `streamed-3d-world.md`; game-time systems live in
`time-world-events.md`. This doc covers the render-side lighting pipeline.

## Verified Entry Points

- `src/components/World3D/World3DLighting.tsx` - `sunFromTime` (full-24h light/sky/fog state), `trueSunVector` (unclamped astronomical direction), `GradientSky` (day dome)
- `src/components/World3D/NightSky.tsx` - mount gate for the physically-based night sky (renders nothing while the true sun is above `NIGHT_SKY_SUN_Y`)
- `src/components/World3D/sky/TakramSkySystem.tsx` - extracted Bruneton atmosphere + Stars + Moon (ex-orphaned ThreeDModal, extracted 2026-08-26)
- `src/components/World3D/World3DScene.tsx` - mounts `<NightSky timeOfDayHours>` right after the lighting block (~line 1418); owns the scene post chain (N8AO + ACES ToneMapping)
- `src/components/World3D/World3DWrapper.tsx` - passes `timeOfDayHours={scheduleClockFromGameTime(state.gameTime)}` to the scene
- `src/components/DesignPreview/steps/PreviewTown3D.tsx` - hour slider lab knob on the `town3d` design-preview step (the rendered-verification surface)
- `src/components/World3D/VolumetricClouds.tsx` - takram `<Clouds>` effect inside the scene composer (ground profile, WebGL only)
- `src/components/World3D/sky/cloudsSceneEdgeResolve.ts` - stops the clouds' temporal history at the scene/sky edge
- `src/systems/world3d/interiorDaylight.ts` - window view factors, the inside test, wall occlusion and the split-flux interreflection for one building (pure)
- `src/components/World3D/interiorDaylightMaterial.ts` - interior materials that scale their indirect light by the sky factor (WebGL and WebGPU)
- `src/components/World3D/InteriorLights.tsx` - hearth lights, lit-window area lights, sun-bounce area lights and table lamps (no fill light since GG-594 part 1)
- `src/systems/world3d/eyeAdaptation.ts` - eye adaptation: the meter code, the exposure rule and its time response (shared by both renderers)
- `src/components/World3D/eyeAdaptationEffect.ts` - the WebGL exposure step and meter, before the composer's ACES; the WebGPU meter is in `gpu/worldGpuPost.ts`
- `src/components/World3D/nightLightModel.ts` - the night light model: the street frame's log2 level for each hour, from `sunFromTime`
- `src/components/World3D/tableLamp.ts` - the table lamp mesh and its placement constants
- `src/components/World3D/liveInteriors.ts` - which buildings have their rooms mounted now
- Tests: `src/components/World3D/__tests__/World3DLighting.test.ts`, `src/components/World3D/sky/__tests__/cloudsSceneEdgeResolve.test.ts`, `src/systems/world3d/__tests__/interiorDaylight.test.ts`, `src/components/World3D/__tests__/InteriorLights.test.ts`, `src/components/World3D/__tests__/InteriorLights.test.tsx`, `src/components/World3D/__tests__/tableLamp.test.ts`, `src/systems/world3d/__tests__/eyeAdaptation.test.ts`, `src/components/World3D/__tests__/nightLightModel.test.ts`

## How the 24h cycle works NOW

**Daytime curve is pinned and byte-stable.** `sunFromTime` anchors dawn at 6h,
solar behaviour runs 6-20h; hours outside that previously clamped to the dusk
edge (the world sat at golden hour forever). The 2026-08-26 port extended the
model below the horizon without touching any daytime output value.

**Night:** `nightStrength = clamp(-s, 0, 1)` blends colours toward moonlit navy
and intensities toward floors. The scene key stays above ground (`flooredY ≥
0.12`) so a directional light never shines from beneath the terrain. The
floored near-grazing direction means flat ground receives only
`intensity x ~0.12` from the night key - raw intensity numbers mislead.

**Night floor calibration was done against RENDERED pixels**, not intuition:
hex night colours convert through sRGB->linear and land ~10x darker than they
look. Measured ladder in the town3d design preview (terrain mean luminance /
255): floors (0.22 key / 0.06 hemi) -> 0.6 pitch-black; (0.9 / 1.0) -> 2.3;
(1.5 / 6.0) -> 9.8, readable moonlight. The tests pin these neighbourhoods.
Anyone retuning must re-measure via the design-preview capture harness, not by
reading constants.

**Clock wiring:** `scheduleClockFromGameTime` returns the fractional UTC hour.
Before 2026-08-26 `World3DWrapper` NEVER passed `timeOfDayHours`, so every live
scene ran the 18.2h default forever - planmap claims of "clock-driven" lighting
were false until this landed. The design preview exposes a manual slider
instead.

**Two-sky contract:** day uses the authored `GradientSky` dome (direct-colour,
`toneMapped=false`, `renderOrder=-1`, depthWrite off). Night swaps to
TakramSkySystem with `effectComposerEnabled={false}` - LOAD-BEARING: its
internal composer exists only for volumetric Clouds + their ToneMapping, and it
would take over rendering from the scene's N8AO+ACES chain. Dome/stars/moon are
ordinary scene meshes and work without it.

**Volumetric clouds:** `VolumetricClouds.tsx` hosts the `@takram/three-clouds`
`<Clouds>` effect (depth-only ray-march) in the SCENE's composer, wrapped in
its own `<Atmosphere>` provider (pure context; LUTs URL-cached by three's
loader) and driven by the same `trueSunVector` clock. It sits after N8AO,
before ACES ToneMapping, and is ground-profile-only (the continent view has no
composer by design). The early "invisible clouds" bug was the library default
`skipRendering=true`; the component passes `skipRendering={false}`.

The cloud layer is premultiplied (rgb, alpha) and composites as
`scene * (1 - a) + cloud`. Over open sky the takram haze gives alpha about
0.97, and that haze color is the dusk sky the player sees. The brighter
`GradientSky` dome sits under it. Over scene geometry the march stops at the
surface, so the layer there is thin haze only (alpha about 0.05).

**Cloud resolve edge rule (2026-10-29).** The resolve pass blends 90%
reprojected history (`temporalAlpha` 0.1) inside a 3x3 variance box. At a
crown silhouette that box holds both leaf and sky, so in motion it let leaf
alpha into the sky rim (0.97 fell to 0.66), and the bright `GradientSky`
showed through as a white rim on tree tops. `cloudsSceneEdgeResolve.ts` patches
the resolve shader through the `<Clouds>` ref: a pixel uses history only if
its whole 3x3 neighborhood is open sky, by the march's own depth test and
uniforms. Measured on the town demo (`?phase=world3d&ground=1&gx=16&gy=4&wfseed=42`,
frames stepped by hand, motion frame against a settled frame at the same
pose): glow pixels (>40 levels brighter) went from 4,993 to 0 on a slow turn
and from 7,121 to 0 on a fast turn with forward walk. Sky pixels keep the
temporal filter, which the cloud ray-march noise needs. The rule covers the
full-resolution TAA path only (`temporalUpscale={false}`); the helper logs an
error and does nothing on the upscale path. The unit test fails if a takram
upgrade moves the shader text the rule hooks into.

Every `<Clouds>` carries the rule: it passes `ref={cloudsSceneEdgeRef}` and
`temporalUpscale={false}`. There are two setups. `VolumetricClouds` is the
one the game uses. `TakramSkySystem` has its own composer, which mounts only
with `effectComposerEnabled`; no World3D caller sets it today. TakramSkySystem
got the rule on 2026-11-01, so it left the library's quarter-resolution
upscale path. That setup has no rendered check, because no screen mounts it.
The unit test reads every `<Clouds>` element in `src/` and fails if one of
them drops the ref or the TAA path.

The WebGPU world has no clouds yet (ADR 0009 step 7). Any cloud port there
must keep the same rule: no temporal history on or next to scene geometry.

## House lighting: daylight in, lamplight out (2026-11-02)

Remy asked for light in the houses: "windows should allow light through".
Only live interiors (the walk-up buildings near the player) have rooms, so
the rules below apply to them. Distant shells keep their exterior look.

**What existed before.** Window panes are boxes tagged `lightRole: 'window'`
that glow (emissive) during the building's `litHours`. Hearths glow during
`hearthHours`, and the nearest 4 lit hearths get warm point lights. A neutral
fill light follows the camera inside a building. Nothing let light in through
a window, for these reasons:
- Interior walls, floors and ceilings did not cast sun shadows.
- The roof went invisible while the camera was inside, which also took it
  out of the shadow map, so the sun lit the whole interior.
- At walking height, 35% of the sun was a second light with no shadow
  (`FAR_SHADOW_INTENSITY_SHARE`). It lit every room through its walls.
- The hemisphere sky light reached every interior surface at full strength.

**Sun in.** The merged structure of a live interior casts sun shadows; the
glass looks do not. A roof hidden from the camera moves to
`SHADOW_ONLY_LAYER` (layer 5), which only the sun's shadow cameras draw, so it
still shades the rooms. When the far light casts no shadow (walking height,
and always under WebGPU), the near light carries the whole sun. Past the near
map's 220 m edge three treats a point as lit, so far views keep their full
brightness. This also makes outdoor shadows at walking height as dark as they
already were in aerial view: a shadow now holds sky light only.

**Sky in.** `interiorDaylight.ts` gives each interior surface point a sky
factor, 0 to 1, from the building's own window openings:
- Lambert's polygon formula gives the view factor from the point to each
  pane, clipped to the half-space in front of the surface.
- Clear glass passes 85% (`GLASS_TRANSMITTANCE`).
- A wall between the point and the pane center blocks that pane.
- The BRE split-flux formula adds one interreflected component per
  building, from window area, surface area and surface reflectances.
- A point outside the floor footprint (the outer face of a perimeter wall)
  keeps factor 1, so the street view does not change.

The merged structure carries the factor as a per-vertex `skyView` attribute,
baked once per building on boxes split into 0.75 m cells. Each furnishing gets
one factor at its top center. The material multiplies the indirect light by
the factor (WebGL: after `aomap_fragment`; WebGPU: `aoNode`). For a 6 m by 4 m
room with one 1.2 m pane the factor runs from about 6% beside the window to
1% at the back wall, the normal daylight-factor range of a real room.

**Glass.** Live-interior panes are see-through glass (opacity 0.35 by day,
0.9 while lit), so the street shows from inside and the lamplit room shows
from outside.

**Lamplight out.** A lit window is modeled as a rectangular area light the
size of its pane, facing out of the house, with the radiance the pane shows
(`WINDOW_GLOW_HEX` at its emissive intensity). The nearest 8 lit panes within
40 m get one. While the windows of a household are lit, an oil lamp of 8 cd
(about 100 lm) burns on each table, desk, counter and workbench; the nearest
4 within 30 m are point lights. The window and lamp lights keep a fixed count
and go dark by intensity 0: a change in the light count rebuilds the programs
of every lit material.

**Rendered check (2026-11-02, WebGL, town demo
`?phase=world3d&ground=1&gx=16&gy=4&wfseed=42&sunhour=H`).** `&sunhour=` sets
the sun and the interior clock to one hour; without it the demo is unchanged.
The rig holds the camera inside the nearest live house and compares the new
rules with the old rules emulated at run time (rig in
`.agent/scratch/houselight/`, gitignored).
- 13 h, inside: the panes are see-through, and the street and the window bars
  show through them. The wall and floor near the camera look the same as
  before, because the camera-inside fill lights them at any hour.
- 21 h, street: the ground below a lit window gained warm light (red channel
  31.6 to 48.5, +53%; farther ground +30%). The pane shows the lamplit room.
- Frame cost, perf toolkit, A-B-A-B on a loaded machine (10 to 20 fps):
  day GPU 56.1 and 54.0 ms old, 54.3 and 52.5 ms new; night GPU 39.4 and
  41.9 ms old, 40.6 and 39.6 ms new. GPU time did not change past the noise.
  Night frame time read higher in the new runs (60 and 73 ms against 51 and
  55 ms); the second new run holds a 283 ms frame from the shader rebuild
  that the rig's own light switch causes.
- Without the camera-inside fill, a room at noon renders nearly black: a
  daylight factor of 1 to 6% is physically right, but the renderer has no
  eye adaptation. A 12x exposure test through `toneMappingExposure` changed
  nothing in the WebGL composer, so adaptation needs its own exposure step
  before the ACES pass. (That step now exists, and the fill is gone: see
  "Eye adaptation, no fill light" below.)

**Sun bounce (GG-594 part 2).** three.js has no global illumination, so the
sunlit patch on a floor lit nothing else. `sunFloorPatch` (interiorDaylight.ts)
now finds the patch that each window throws onto the floor of its storey:
- Each pane point projects along the sun ray to the floor. The rectangle
  keeps the true parallelogram's width, depth and center, so it carries the
  same flux.
- The reveal counts. The pane sits in the center of its wall, and the sill
  and head boxes give the hole's depth T (`revealM`). A ray must clear the
  hole on both wall faces, so the lit part of the pane is
  (h - T s.y / (s . n)) by (w - T |s . t| / (s . n)). The live town has
  0.46 m walls, and at a high sun the reveal shades most of a pane.
- The patch stops at the far edge of the floor (abutting slabs at the same
  level continue it) and at the first wall across the beam.

InteriorLights puts an upward `RectAreaLight` on each patch near the camera
(within 25 m), but only in live rooms: SiteBuilding registers a building
while its rooms are mounted (`liveInteriors.ts`). A closed shell keeps the
sun out, so a patch there would light nothing the player sees and would leak
through the shell. Table-lamp lights follow the same rule. Its radiance is the patch as drawn: the floor receives
`sunIntensity * s.y` (glass casts no shadow, so the drawn patch has no glass
loss either), and a matte floor sends `rho * E / pi`. The light color is the
sun color times the floor color. The area light's form factor gives the
first bounce at every surface above the patch. The bounce lights use the
window-light slots that no lit window holds, so they add no light to the
shader.

**Table lamps and fixed light counts (GG-594 part 3).** A household with a
lit schedule keeps a brass standing oil lamp on each table, desk, counter
and workbench of a live interior (`tableLamp.ts`, drawn by SiteBuilding). The
flame shows while the windows are lit, and its widest point is at
`LAMP_FLAME_ABOVE_M`, where InteriorLights puts the lamp's point light. The
lamp is outside the raycast, so a click still picks the table. The hearth
lights now go dark by intensity 0, and every light pool (4 hearths, 8 window
or bounce slots, 4 lamps) mounts at full size while any interior building
is loaded. The light count changes only when the town streams in or out.

**Light lists per chunk (GG-606, 2026-11-02).** InteriorLights keeps the
light sources of each loaded chunk (`InteriorLightingCache`). When a chunk
arrives, only that chunk is collected (`collectChunkInteriorLighting`, which
runs `buildInteriorDaylight` on its sites). The other chunks reuse their lists,
and the merged list keeps the same order. A chunk that leaves is dropped; a
new bundle or a new scene origin collects the chunk again. Before, each arrival
collected every loaded site again, often twice. Headless profile of the
World3D demo (669 buildings, a 20 s window while the last chunks load; rig
`.agent/scratch/gg606/profile.mjs`): lighting time 2,234 ms before, 43 ms
after. Per arrival task: 10 to 205 ms before, about 1 ms after. One first
build of a chunk with many houses took 40 ms. Tasks of 250 ms or more: 20
before, 13 after (the chunk mount and the door sampler remain).

**Rendered check for parts 2 and 3 (2026-11-02, WebGL, same demo).** The rig
(`.agent/scratch/houselight/rig2.mjs`) holds the camera in a live house and
compares the new code with parts 2 and 3 switched off at run time (bounce
slots at 0, lamp meshes hidden). Proof sheet:
`.agent/scratch/houselight/gg594_proof.png`.
- 21 h: the brass lamp and its flame stand on the table, in the pool of the
  lamp light that was there before.
- 08 h: the live rooms near the player hold 8 bounce patches (0.48 m by
  1.07 m, radiance 0.30). A ray test toward the sun found furniture (a hearth)
  over 4 of them; the best patch was 40% open. The game frame changed by at
  most 1 level of 255, with the fill on or off. That matches the physics: a
  0.5 m^2 patch of radiance 0.1 adds about 0.002 to a wall 2 m away, under
  one display level without eye adaptation. A rig-only view with the bounce
  at 50x shows the light where it belongs, on the wall above the patch.
- 13 h: the 0.46 m reveal lets only a 0.04 m strip of sun onto the floor.
  18 h: lit windows hold all 8 shared slots, so no bounce shows.
- Frame cost, A-B-A-B: GPU 25.6 and 25.1 ms old, 24.4 and 24.3 ms new (08 h);
  24.3 and 24.8 ms old, 23.6 and 27.8 ms new (13 h); 32.9 and 31.7 ms old,
  33.2 and 30.3 ms new (16 h). No change past the noise. The lamps add 6 to
  16 draw calls. The bounce adds no light to the shader, so this A-B cannot
  see a shader cost; the town already filled every light pool before.

**Eye adaptation, no fill light (GG-594 part 1).** Remy ruled on
2026-11-02: "Drop it, add eye adaptation". The camera-inside fill light (24 cd
over the player) is gone. It lit every room at any hour and flattened the
window falloff. A room now shows only the light it receives, and the frame
sets its own exposure from the light it measures:
- A meter pass draws the linear frame (before tone mapping) into a 64 by 32
  RGBA8 grid of log2 luminance codes, four taps a cell. An async readback
  brings the grid to the CPU every 4 frames, one read at a time, so the GPU
  never waits.
- The frame's log2 average (a geometric mean) sets the target exposure,
  2^(key - average), clamped to 1 .. 16. The key is -5. The exposure never
  drops below 1, so a bright street keeps today's look.
- The exposure moves toward the target in log space: time constant 1.2 s to
  brighten, 0.4 s to darken.
- WebGL: an effect just before the composer's ACES multiplies the color by
  the exposure (`eyeAdaptationEffect.ts`). `toneMappingExposure` does not
  reach that ACES. WebGPU: `renderer.toneMappingExposure` is the base 1.05
  times the exposure, and `renderOutput` applies it; its meter reads
  `sceneColor` in `gpu/worldGpuPost.ts`.
- Night adapts a little (Remy, 2026-11-02: "Adapt a little at night"; see
  "Night adaptation" below). The upper clamp fades from 16 by day to 4 at
  night over dusk (`daylightWeight`, from the same sun angle as
  `sunFromTime`), and at night the key follows the night light model.
- `window.__wf3dEye` is the live controller: `measuredLog2`, `exposure`,
  `target`, and `hold` (a fixed exposure for an A-B; it also stops the meter).

**Rendered check for part 1 (2026-11-02, town demo at 13 h).** Rig:
`.agent/scratch/houselight/rig3.mjs`. Proof sheet:
`.agent/scratch/houselight/gg594_part1_proof.png`. The camera stands at one side
of a live room with a sunlit window and looks across it. Luma is the mean
sRGB value (0 to 255) of a 15 px box at a projected probe point.
- Calibration: the outdoor start view measures log2 -3.6 (WebGL) and -3.6
  (WebGPU); the room measures -10.4 (WebGL) and -9.5 (WebGPU). A first key of
  -2.6 lifted the street 2x and washed the square white, so the key is -5.
- WebGL: at exposure 1 the sunlit floor is 7 and the back floor 0. Adapted
  (x15.9), the sunlit floor is 105, the sunlit wall beside the window reads
  bright, and the back floor is 12. The street stays at exposure 1.
- WebGPU: the sunlit floor goes from 6 to 100, and the back floor stays 0.
- The exposure reaches 50% of the step (in stops) in about 1 s and 99% in
  about 4 s.
- The wall under the window stays 0: it gets no sun and little sky.
- Frame cost, A-B-A-B, held (meter off) against adapting, on a loaded machine:
  WebGL GPU 37.6 and 34.2 ms against 36.8 and 35.0 ms; WebGPU GPU 10.7 and
  13.5 ms against 13.7 and 11.1 ms. No change past the noise.

**Night adaptation (2026-11-03).** Remy ruled "Adapt a little at night". The
sun model does not make the night dark through light intensity:
`sunFromTime` keeps the key light at 1.5 and raises the hemisphere light to
6.0. The dark look comes from color (a moonlit key, a navy sky light) and from
the dark sky dome and fog. So a frame-only rule cannot tell the night street
from a dark room by day, and with the day key it would lift the night street.
- The night light model (`nightLightModel.ts`) gives the street frame's log2
  level for each hour: weighted direct key on the ground, sky light and sky
  dome, all from `sunFromTime`. The weights were fitted to the meter at the
  demo's start view at 13, 19, 20, 21, 23 and 2 h (WebGL, at exposure 1:
  -3.6, -4.9, -6.2, -5.8, -5.7, -5.8). It fits within 0.17 stop rms. A
  ground-light term alone misses by 0.62 stop. Twilight (20 h) is the darkest
  hour of the model and of the meter.
- The key is the darker of the day key (-5) and the model street level plus
  0.5 stop (`keyAt`). By day the street is far above -5, so nothing changes.
  At night the street gets 2^0.5 = 1.4x. A hearth room as bright as the street
  gets about the same or none, so the fire still stands out. Only a frame
  darker than the night street is lifted more, up to the night cap of 4x.
- Both owners set `eye.streetLog2` from the model when the hour changes.

**Rendered check for night adaptation (2026-11-03, WebGL, town demo).** Rig:
`.agent/scratch/houselight/rig4.mjs`. Proof sheet:
`.agent/scratch/houselight/gg594_night_proof.png`.
- 23 h street: exposure 1.38 (target 1.38). Frame mean luma 43 to 54. The
  ground, roofs and stalls show their shapes; lit windows still stand out.
- 23 h, a room lit by its hearth: it measures -4.2, brighter than the night
  street, so the exposure stays 1. The fire's glow on the wall and floor
  stands out, and the far corner stays dark.
- 13 h street: exposure 1, the day look is unchanged.
- Frame cost at 23 h, A-B-A-B, held (meter off) against adapting: GPU 30.5
  and 30.5 ms against 30.3 and 31.6 ms. No change past the noise.
- Not covered: WebGPU at night (same controller and model, not rendered), and
  a dark unlit room at night (the unit tests cover its 4x cap).

**Open items.**
- The meter weighs every part of the frame the same. A bright window that
  fills much of the view holds the exposure down; center weighting is a
  later cut if play shows it.
- The WebGL meter reads the frame after the AO pass, the WebGPU meter before
  it. The averages agree within one stop in the room check.
- The night light model is fitted to one view of one town. A view with
  much more sky, or a retuned sun model, needs a new fit (the unit test pins
  the calibration hours).
- The sun bounce has no shadows: a wall between the patch and a point does
  not stop it. Furniture on the patch and outdoor shade on the window (a
  neighbor, a tree) do not cut the patch's flux. The bounce is one bounce
  from the patch only; the split-flux term covers the sky's later bounces,
  not the sun's.
- Lit windows take the shared slots first, so at dusk the bounce gets none.
- Newer three.js could do more (research 2026-11-02; the game is on r172):
  `ClusteredLighting` (r185) lifts the lamp caps for point and spot lights,
  and `LightProbeGrid` (r186, faster bake r187) adds the sun's bounce, but it
  leaks through walls without one grid per house. With a probe grid the
  window factor must stop acting as AO, or occlusion counts twice. On r172,
  `TiledLighting` (WebGPU backend only) could lift the lamp cap under
  `?gpu=1`. An upgrade is Remy's decision.

## Asset integrity gotcha (bit us 2026-08-26)

TakramSkySystem loads pre-baked LUTs from `public/data/takram-atmosphere/`.
The loader requests exactly: `transmittance.exr`, `scattering.exr`,
`irradiance.exr`, `single_mie_scattering.exr`, `higher_order_scattering.exr`
(plus stars/cloud assets). `single_mie_scattering.exr` WAS MISSING - the dev
server answered with SPA-fallback HTML (HTTP 200!), the Atmosphere texture load
never completed, and **zero sky objects mounted with no console error**: the
night sky was a flat gray fill for the whole first verification pass. If the
night sky renders flat, check asset presence AND content-type
(`image/aces`, not `text/html`) before debugging shaders.

## Verification harness

Design preview step `town3d` (`/Aralia/misc/design.html?step=town3d`) mounts
two live World3DScene panes plus an inert minimap control. Drive the hour
slider (aria-label "Time of day (hours)"), screenshot per canvas bounding box
(NOT element screenshots - they wait for frame stability and hang), hide only
`button, input` overlays before capture (blanket `.absolute` CSS hides the pane
containers themselves). Pixel census scripts distinguish starfield (sparse px
>60 on dark mean) from overlay contamination (identical bright coordinates
day/night).

## Known open items

- The `glBlitFramebuffer GL_INVALID_OPERATION` WebGL warning observed during
  captures is unclassified - present in both day and night, suspected
  pre-existing N8AO/post-chain behaviour, not yet bisected against the night
  port.


## Spellbook Light and ground illumination

### Bound Light at the world clock boundary

Verified: 2026-11-03, nineteen focused clock/binding checks, two scoped type
paths and Fianna's native cast, movement, save and full reload.

ADVANCE_TIME passes the already advanced gameTime into
UnderdarkMechanics.processTime. A bound object's duration now comes once from
its absolute expiry at that clock, including while packed. It does not also
lose the tick's elapsed seconds. Ordinary torch fuel and historical unbound
spells keep their existing elapsed-consumption rule. Expired object bindings
remain inactive with the same source identity; they are not converted into a
new cast or removed as burned fuel. Their final second is retained correctly.

Actual Fianna play found a one-second early counter on her held Sickle.
After repair, its 16:21:07 expiry and native 15:25:18 clock give exactly
55.81666666666667 remaining minutes. Save/full reload preserve the item marker,
caster, bearer, color and absolute expiry, plus one drawn handR light. The
native light makes nearby Tankard floor, wall and residents visible and supports
ordinary movement around a child. Full photometric range, opaque-wall
occlusion, broad room readability and NPC appearance fidelity remain open.
The full played costs and source/private-room boundary live in the gameplay-flow
Tracker section, A stair-aware lodging choice reaches the Tankard with real
object light.

Light now uses an explicit own-object spellbook path through ObjectLightControls, objectLightCasting and the existing CAST_SPELL reducer. The available targets are the caster's own equipped main-hand/off-hand objects. A reviewed object reference prevents stale selection; an item lightSpellId persists the actual target through normal equipment movement and save/reload. Unpositioned room decorations and another person's carried possessions are not inferred as eligible targets. The spell's prose permits the caster's own carried object; the generic object-registry worn/carried exclusion still needs an ownership-aware adapter before broader targeting.

The existing underdark.activeLightSources list stores the bound object's caster, hand, color and absolute one-hour expiry. Recasting replaces only that caster's bound source. Derived exposure resolves the marked item on a real party hand; stored objects and departed bearers do not illuminate the current party. Underdark world ticks expire the source and exclude inactive sources from bright-light calculation. Historical unbound Light character statuses are not converted into object sources.

GroundCarriedTorch retains the burning-torch path and additionally projects an enchanted held object at its actual model hand anchor. It adds no spare hand or torch flame and stays outside measured collision anatomy. Actual Elara play casts on her shield, stows it (no actor light), re-equips that same object (same source/expiry), then recasts on her mace (one replacement source and handR light). Her slots remain2/2. Full reload retains binding, caster/color/absolute expiry and all other source fields while the countdown advances. The character's light is visible, but useful room illumination, photometric range, opaque-wall occlusion and wider cover/dismissal interaction remain unqualified. Cross-bearer binding retains fixture proof only. The actual Rusty Fox common-room view remains dark while Elara is still blocked outside; it does not establish useful carried light inside the room. Details and open work live in gameplay-flow Tracker/GF-G32.


### Played nearby illumination with Elara

Verified: 2026-11-03 through normal inn entry, equipment controls and directly inspected desktop renders.

Elara follows her saved walking trail into the Rusty Fox common room. Packing her lit mace removes its one handR PointLight; re-equipping that exact item restores the same source and absolute expiry. At unchanged party feet and camera, the packed view leaves nearby floor and wall nearly black, while the held view reveals the doorway, floor and bench. This proves useful nearby exploration illumination. It does not qualify complete spell range, opaque-wall occlusion or general room readability. No ambient fill, resource grant, new cast or follower admission change was used. The companion Tracker milestone retains the actual play and continuity boundaries.
