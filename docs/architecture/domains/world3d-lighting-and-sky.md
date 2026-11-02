# World3D Lighting & Sky

Verified: 2026-11-02 for house lighting (code, unit tests, and WebGL day and night captures with a perf A-B; WebGPU not rendered); 2026-11-01 for the cloud resolve edge rule (code in both cloud setups; motion captures from 2026-10-29)

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
- `src/components/World3D/InteriorLights.tsx` - hearth lights, camera-inside fill, lit-window area lights and table lamps
- Tests: `src/components/World3D/__tests__/World3DLighting.test.ts`, `src/components/World3D/sky/__tests__/cloudsSceneEdgeResolve.test.ts`, `src/systems/world3d/__tests__/interiorDaylight.test.ts`, `src/components/World3D/__tests__/InteriorLights.test.ts`

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
  before the ACES pass.

**Open items.**
- The camera-inside fill (24 cd, 2.7 m over the player) is a readability
  light. It brightens the room around the player at any hour and hides part
  of the window falloff there. Whether it stays is Remy's call.
- Sunlight that lands on a floor does not bounce into the room; only the
  sky's interreflection (split flux) is counted.
- No lamp mesh is drawn: the lamp is a light only.
- Newer three.js could do more (research 2026-11-02; the game is on r172):
  `ClusteredLighting` (r185) lifts the lamp caps for point and spot lights,
  and `LightProbeGrid` (r186, faster bake r187) adds the sun's bounce, but it
  leaks through walls without one grid per house. With a probe grid the
  window factor must stop acting as AO, or occlusion counts twice. On r172,
  `TiledLighting` (WebGPU backend only) could lift the lamp cap under
  `?gpu=1`. An upgrade is Remy's decision.
- The existing hearth lights still go dark by `visible`, which changes the
  light count when a hearth enters or leaves range.

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
