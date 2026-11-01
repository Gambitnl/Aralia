# World3D Lighting & Sky

Verified: 2026-11-01 (cloud resolve edge rule checked against code in both cloud setups; motion captures from 2026-10-29)

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
- Tests: `src/components/World3D/__tests__/World3DLighting.test.ts`, `src/components/World3D/sky/__tests__/cloudsSceneEdgeResolve.test.ts`

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
