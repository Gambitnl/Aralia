# Takram Sky Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix three issues with the Takram sky mode in the 3D Test page: (1) time slider must move the sun, (2) celestial bodies (moon + stars) must be visible at night, (3) volumetric clouds must render visibly.

**Architecture:** The Takram sky (`TakramSkySystem.tsx`) wraps `@takram/three-atmosphere` (Bruneton scattering) + `@takram/three-clouds` (volumetric ray-marching) + `@react-three/postprocessing` (EffectComposer with ACES tone mapping). The sun direction flows from the time slider in `PreviewThreeDTest.tsx` → `gameTime` Date → `getLightingForTime()` in `lighting.ts` → `Scene3D.tsx` sunDirection prop → `TakramSkySystem.tsx` which transforms it to ECEF space each frame. The Sky Lab panel in `PreviewThreeDTest.tsx` provides debug controls.

**Tech Stack:** React, Three.js, @react-three/fiber, @takram/three-atmosphere, @takram/three-clouds, @react-three/postprocessing, postprocessing

---

## Findings & Root Causes

### Issue 1: Time slider does nothing
**Root cause (confirmed):** `PreviewThreeDTest.tsx:217` sets `lightingOverridesEnabled = true` by default. When enabled, the `lightingOverrides` object includes `sunAzimuth: 140` and `sunElevation: 35`, which are static values. In `Scene3D.tsx:207-226`, the `sunDirection` useMemo checks for these overrides and replaces the time-based direction with the static one. Result: moving the time slider updates `gameTime` and recomputes `lighting.sunDirection`, but the override immediately replaces it.

**Fix (applied, needs cleanup):**
- `Scene3D.tsx`: Skip azimuth/elevation overrides when `skyMode === 'takram'`
- `PreviewThreeDTest.tsx`: In Takram mode, `lightingOverrides` only forwards intensity/fog (not sun position)
- `lighting.ts`: Added `trueSunDirection` — unclamped astronomical direction (see Issue 2)

### Issue 2: No celestial bodies (stars, moon)
**Root cause (confirmed):** Two sub-issues:

**2a. Sun never goes below horizon.** `lighting.ts:82` clamps: `Math.max(0.15, sunHeight + 0.25)`. At midnight, `sunHeight = -1.0` but the clamped direction Y becomes `max(0.15, -0.75) = 0.15`. The Takram atmosphere always sees the sun above the horizon → perpetual daylight → stars never visible.

**Fix (applied):** Added `trueSunDirection` in `lighting.ts` with unclamped `sunHeight`. `Scene3D.tsx` uses this for `TakramSkySystem` while keeping the clamped direction for the directional light.

**2b. Exposure too high at night.** `gl.toneMappingExposure = 6.0` amplifies residual atmospheric scattering at night, keeping the sky too bright for stars to show. **Additionally**, `gl.toneMappingExposure` has no effect when the `EffectComposer`'s `<ToneMapping>` pass is active — the postprocessing ToneMapping overrides the renderer's built-in tone mapping.

**Fix (partially applied, needs verification):**
- Added `exposure` prop to `TakramSkySystem`, forwarded to `<ToneMapping exposure={exposure} />`
- `Scene3D.tsx` computes `takramEffectiveExposure` that ramps from `takramExposure` (day) down to `1.5` (night) based on `takramSunDirection.y`
- Passed to `TakramSkySystem` as `exposure={takramEffectiveExposure}`

**2c. No moon component.** `@takram/three-atmosphere` has no Moon component.

**Fix (applied):** Added procedural `Moon` component in `TakramSkySystem.tsx`:
- `SphereGeometry(600, 32, 32)` with custom `ShaderMaterial` (Lambertian lit by sun direction)
- Positioned opposite the sun with 30deg Y-axis orbital offset
- Opacity fades to 0 when sun is above horizon via smoothstep
- Uses `AdditiveBlending` so it composites naturally with the sky

### Issue 3: No visible clouds
**Root cause (investigation in progress):** The `<Clouds>` component IS rendered inside the EffectComposer. Default cloud layers from `@takram/three-clouds` sit at altitude 750-2200m (ECEF meters). All required textures exist in `public/data/takram-atmosphere/` and load without errors. No console errors related to clouds.

**Possible causes (not yet confirmed):**
1. The `<ToneMapping>` `exposure` prop may not work the same as `gl.toneMappingExposure` — clouds may be too dim to see after ACES at the default exposure
2. The `enableNormalPass` on EffectComposer may not be providing correct depth for the cloud ray marcher, causing clouds to be clipped
3. Cloud coverage at 0.5 with the default local_weather.png texture may produce very sparse cloud coverage
4. The fog (`fogExp2`) may be obscuring the clouds at the horizon
5. The Clouds effect may be rendering but compositing behind the Sky pass

**Remaining investigation steps:**
- Test with fog disabled (set fog density to 0)
- Test with cloud coverage at 1.0 (maximum)
- Test with EffectComposer disabled (raw Sky output) vs enabled to isolate whether Clouds is compositing at all
- Check if `correctAltitude` on the CloudsEffect needs to match the Atmosphere's `correctAltitude`
- Inspect the `<Clouds>` component for `correctAltitude` prop support

---

## Files Changed (so far)

| File | Change |
|------|--------|
| `src/components/ThreeDModal/lighting.ts:80-95` | Added `trueSunDirection` (unclamped) alongside existing clamped `sunDirection` |
| `src/components/ThreeDModal/Scene3D.tsx:207-256` | Skip sun overrides in Takram mode; compute `takramSunDirection` from `trueSunDirection`; adaptive exposure ramp; pass `exposure` to TakramSkySystem |
| `src/components/ThreeDModal/Scene3D.tsx:457-466` | Use `takramSunDirection` + `exposure` props for TakramSkySystem |
| `src/components/ThreeDModal/TakramSkySystem.tsx` | Added `Moon` component, `moonEnabled`/`exposure` props, forward exposure to `<ToneMapping>` |
| `src/components/DesignPreview/steps/PreviewThreeDTest.tsx:255-276` | Takram mode always forwards intensity/fog overrides; legacy mode unchanged |
| `src/components/DesignPreview/steps/PreviewThreeDTest.tsx:861-903` | Added Scene Lighting section (sun/ambient intensity, fog density sliders) to Sky Lab panel |

## Files with known cleanup needed

| File | Issue |
|------|-------|
| `TakramSkySystem.tsx:30` | Unused import: `BackSide` |
| `Scene3D.tsx:254-256` | `gl.toneMappingExposure` useEffect may be redundant now that exposure goes through `<ToneMapping exposure={}>`; needs verification |

---

## Remaining Tasks

### Task 1: Clean up unused imports

**Files:**
- Modify: `src/components/ThreeDModal/TakramSkySystem.tsx:30`

- [ ] **Step 1: Remove unused `BackSide` import**

```typescript
// Change this:
import {
  AdditiveBlending,
  BackSide,
  Color,
  Matrix4,
  ShaderMaterial,
  SphereGeometry,
  Vector3 as ThreeVector3,
} from 'three';

// To this:
import {
  AdditiveBlending,
  Color,
  Matrix4,
  ShaderMaterial,
  SphereGeometry,
  Vector3 as ThreeVector3,
} from 'three';
```

- [ ] **Step 2: Verify no TypeScript errors**

Run: `npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: No new errors related to TakramSkySystem

### Task 2: Verify exposure is correctly applied via `<ToneMapping exposure={}>` and remove redundant `gl.toneMappingExposure`

**Files:**
- Modify: `src/components/ThreeDModal/Scene3D.tsx:238-256`

The `gl.toneMappingExposure` useEffect was the original mechanism, but now that exposure flows through the `<ToneMapping exposure={}>` prop on the EffectComposer pass, the renderer-level setting is redundant (and may conflict). However, when `effectComposerEnabled=false`, the `<ToneMapping>` pass doesn't exist, so `gl.toneMappingExposure` is the only exposure control.

- [ ] **Step 1: Test with EffectComposer ON — change time to midnight, verify sky goes dark**

Open preview, enable Takram mode, set time to 0:00. The sky should be noticeably darker than at 14:00. If the sky is still bright, the `<ToneMapping exposure>` prop may not be taking effect.

- [ ] **Step 2: Test with EffectComposer OFF — verify gl.toneMappingExposure still works as fallback**

In Sky Lab, toggle EffectComposer OFF. The sky should still respond to time changes (though without clouds or ACES tone mapping).

- [ ] **Step 3: If ToneMapping exposure prop works, keep both paths**

Keep `gl.toneMappingExposure` as fallback for when EffectComposer is disabled. The two paths don't conflict because the EffectComposer's ToneMapping overrides the renderer's built-in tone mapping when active.

### Task 3: Debug and fix cloud visibility

**Files:**
- Possibly modify: `src/components/ThreeDModal/TakramSkySystem.tsx`

- [ ] **Step 1: Test with maximum cloud coverage**

In Sky Lab, drag cloud coverage slider to 100%. If clouds appear, the default 50% coverage with the local_weather.png texture may just produce very sparse clouds.

- [ ] **Step 2: Test with fog disabled**

In Sky Lab, drag Fog Density slider to 0. If clouds suddenly appear behind the fog, the `fogExp2` is obscuring them.

- [ ] **Step 3: Check if `correctAltitude` is needed on the Clouds effect**

The `@takram/three-clouds` `CloudsEffect` has a `correctAltitude` property (seen in types). If the Atmosphere has `correctAltitude={true}` but the Clouds effect doesn't, the cloud layer altitudes may be misaligned with the camera position.

```typescript
// In TakramSkySystem.tsx, try adding correctAltitude to Clouds:
<Clouds
  coverage={cloudCoverage}
  qualityPreset={qualityPreset}
  correctAltitude={correctAltitude}  // <-- add this
  localWeatherTexture={CLOUD_LOCAL_WEATHER_URL}
  ...
/>
```

- [ ] **Step 4: Test with a debug CloudLayer at lower altitude**

If default layers (750-2200m) are invisible, try a custom layer at a much lower altitude:

```typescript
import { CloudLayer } from '@takram/three-clouds/r3f';

<Clouds coverage={cloudCoverage} qualityPreset={qualityPreset} disableDefaultLayers {...textures}>
  <CloudLayer
    channel="r"
    altitude={200}
    height={400}
    densityScale={0.5}
    shapeAmount={1}
    shapeDetailAmount={1}
    weatherExponent={1}
    shapeAlteringBias={0.35}
    coverageFilterWidth={0.6}
    shadow
  />
</Clouds>
```

- [ ] **Step 5: Check the takram examples for correct EffectComposer setup**

Compare our setup against the `@takram/three-atmosphere` examples in node_modules to see if we're missing any required EffectComposer configuration (e.g., `multisampling`, `frameBufferType`, or specific render order).

```bash
# Check the example storybook files
find node_modules/@takram/three-atmosphere -name "*.tsx" -path "*/stories/*" | head -10
find node_modules/@takram/three-clouds -name "*.tsx" -path "*/stories/*" | head -10
```

- [ ] **Step 6: Apply fix and verify clouds are visible**

Based on findings from steps 1-5, apply the necessary fix. Take a screenshot showing visible volumetric clouds.

### Task 4: Add Moon toggle to Sky Lab panel

**Files:**
- Modify: `src/components/ThreeDModal/Scene3D.tsx` (add `takramMoon` prop)
- Modify: `src/components/DesignPreview/steps/PreviewThreeDTest.tsx` (add toggle)

- [ ] **Step 1: Add `takramMoon` prop to Scene3D**

In `Scene3DProps` interface, add:
```typescript
takramMoon?: boolean;
```

In `SceneContents` destructuring, add:
```typescript
takramMoon = true,
```

Pass to TakramSkySystem:
```typescript
<TakramSkySystem
  ...
  moonEnabled={takramMoon}
/>
```

- [ ] **Step 2: Add state and toggle in PreviewThreeDTest.tsx**

Add state near the other takram states (~line 237):
```typescript
const [takramMoon, setTakramMoon] = useState(true);
```

Add toggle in Sky Lab panel after the Stars toggle:
```tsx
<label className="flex items-center justify-between gap-2 cursor-pointer">
  <span className="text-xs text-gray-300">Moon</span>
  <span className="text-[10px] text-gray-500">Procedural moon (opposite sun)</span>
  <button
    type="button"
    className={`px-2 py-0.5 text-xs rounded ${takramMoon ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-gray-300'}`}
    onClick={() => setTakramMoon((v) => !v)}
  >
    {takramMoon ? 'ON' : 'OFF'}
  </button>
</label>
```

Pass to Scene3D:
```tsx
takramMoon={takramMoon}
```

- [ ] **Step 3: Update Reset to Defaults to include moon**

In the reset button handler:
```typescript
setTakramMoon(true);
```

### Task 5: Visual verification — full day/night cycle

- [ ] **Step 1: Test sunrise (6:00)**

Set time to 6:00. Verify: warm orange/pink sky at horizon, sun near horizon, moon fading out, no stars.

- [ ] **Step 2: Test midday (12:00)**

Set time to 12:00. Verify: bright blue sky, sun high, no moon visible, clouds (if fixed) visible against blue sky.

- [ ] **Step 3: Test sunset (18:00-19:00)**

Set time to 18:30. Verify: orange/red sky at horizon transitioning to dark blue above, sun low.

- [ ] **Step 4: Test midnight (0:00)**

Set time to 0:00. Verify: dark sky, stars visible (small dots), moon visible and lit by sun from below, scene dimly lit by ambient + clamped directional light.

- [ ] **Step 5: Test Sky Lab sliders**

Move Sun Intensity, Ambient Intensity, and Fog Density sliders. Verify each affects the scene in real-time.

- [ ] **Step 6: Commit all changes**

```bash
git add src/components/ThreeDModal/TakramSkySystem.tsx \
       src/components/ThreeDModal/Scene3D.tsx \
       src/components/ThreeDModal/lighting.ts \
       src/components/DesignPreview/steps/PreviewThreeDTest.tsx
git commit -m "fix(3d): Takram sky time slider, moon, stars, exposure, and Sky Lab controls

- Sun direction now follows time slider in Takram mode (bypasses legacy overrides)
- Added unclamped trueSunDirection for physically-correct day/night cycle
- Added procedural Moon mesh (Lambertian shader, positioned opposite sun)
- Adaptive exposure ramp: full exposure during day, reduced at night for star visibility
- Added Sun Intensity, Ambient Intensity, Fog Density sliders to Sky Lab panel
- Fixed exposure pipeline: flows through <ToneMapping exposure={}> instead of gl.toneMappingExposure

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Dependencies / Package Versions

| Package | Version | Used for |
|---------|---------|----------|
| `@takram/three-atmosphere` | ^0.17.1 | Bruneton scattering sky, Stars component |
| `@takram/three-clouds` | ^0.7.3 | Volumetric ray-marched clouds |
| `@takram/three-geospatial` | ^0.7.1 | ECEF coordinate transforms (Geodetic, Ellipsoid) |
| `@react-three/postprocessing` | ^3.0.4 | EffectComposer, ToneMapping wrapper |
| `postprocessing` | (peer dep) | ToneMappingMode enum, ToneMappingEffect class |

## Pre-baked Texture Assets

All in `public/data/takram-atmosphere/`:

| File | Source | Purpose |
|------|--------|---------|
| `scattering.exr` | `@takram/three-atmosphere/assets/` | Bruneton scattering LUT |
| `transmittance.exr` | `@takram/three-atmosphere/assets/` | Bruneton transmittance LUT |
| `higher_order_scattering.exr` | `@takram/three-atmosphere/assets/` | Higher-order scattering LUT |
| `irradiance.exr` | `@takram/three-atmosphere/assets/` | Precomputed sky irradiance |
| `stars.bin` | `@takram/three-atmosphere/assets/` | Star catalog (23KB binary) |
| `local_weather.png` | `@takram/three-clouds/assets/` | Cloud coverage map |
| `shape.bin` | `@takram/three-clouds/assets/` | 3D noise for cloud shape |
| `shape_detail.bin` | `@takram/three-clouds/assets/` | 3D noise for cloud detail |
| `turbulence.png` | `@takram/three-clouds/assets/` | High-frequency detail noise |
| `stbn.bin` | GitHub CDN (cached locally) | Spatio-Temporal Blue Noise (64^3) |
