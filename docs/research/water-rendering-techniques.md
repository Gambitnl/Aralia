# Water rendering techniques for three.js r172 (WebGL, React Three Fiber)

> **REVIEWED, AND IT DID NOT ALL SURVIVE.** A second agent attacked every claim
> in this file against the installed libraries and the real repo. Verdict: 41
> claims checked, 8 failed, 7 more are true but materially incomplete. Read
> [the review](water-rendering-techniques-REVIEW.md) BEFORE you build from any
> section here. The three that would cost you the most:
>
> 1. **Topic 1 is already built.** This file says the repo has no depth-texture
>    work and recommends building an underwater pass. That pass exists, with the
>    exact shape recommended, at `src/components/DesignPreview/steps/land/UnderwaterEffect.tsx`.
> 2. **`LUTEffect` does not exist** in postprocessing 6.39 and would fail to
>    build. The real classes are `LUT3DEffect` and `LUT1DEffect`.
> 3. **The Crest attribution is inverted.** Crest averages its two caustic
>    samples; it does not take `min()` of them. The recommendation is still
>    defensible, but not for the reason given.
>
> Nothing below has been edited. A research file that is quietly corrected stops
> being evidence of what was actually claimed.

Research note. Written 2026-08-28. Target: `three@^0.172.0` on a WebGL2 canvas
driven by `@react-three/fiber@^9`. WebGPU-only techniques are named only to say
why they are out.

## What the constraint set actually gives you

Verified by reading `node_modules/three` at r172 in this repo, not from memory.

- `WebGLRenderer` requests a `webgl2` context only (`src/renderers/WebGLRenderer.js:251`).
  There is no WebGL1 path. So GLSL ES 3.00, `dFdx`/`dFdy`, `textureLod`,
  integer math, and depth textures are all core. No `OES_standard_derivatives`
  or `WEBGL_depth_texture` guard is needed.
- Float and half-float colour render targets still need `EXT_color_buffer_float`
  or `EXT_color_buffer_half_float`. three.js probes for both
  (`src/renderers/webgl/WebGLExtensions.js:56`) and validates the combination in
  `WebGLCapabilities.js:41`. This is near-universal on desktop, not guaranteed on
  older mobile GPUs.
- `THREE.DepthTexture` exists and attaches to a `WebGLRenderTarget`. The shipped
  example is `webgl_depth_texture.html` (r172), which builds
  `target.depthTexture = new THREE.DepthTexture()` and feeds `tDepth` to a
  post material.
- `MeshPhysicalMaterial` already implements screen-space refraction plus
  Beer-Lambert volume absorption: `transmission`, `thickness`, `ior`,
  `attenuationColor`, `attenuationDistance`. The renderer allocates a
  `transmissionRenderTarget` per camera and re-renders the opaque scene into it
  at `renderer.transmissionResolutionScale`
  (`src/renderers/WebGLRenderer.js:1475-1535`). The absorption is literally
  Beer's law in `ShaderChunk/transmission_pars_fragment.glsl.js:152-165`.
- `SpotLight.map` is a real projected-texture cookie in the WebGL path
  (`src/lights/SpotLight.js:25`, sampled in
  `ShaderChunk/lights_fragment_begin.glsl.js:110-112`). That is a free caustic
  projector.
- Example objects shipped: `Water.js` (planar mirror ocean, used by
  `webgl_shaders_ocean.html`), `Water2.js` / `Water2Mesh.js` (Reflector +
  Refractor flow water, used by `webgl_water.html` and
  `webgl_water_flowmap.html`), `Reflector.js`, `Refractor.js`, `SSRPass.js`.
- This repo already depends on `@react-three/drei@^10.7.7` (ships `Caustics`,
  `MeshTransmissionMaterial`, `useDepthBuffer`), `@react-three/postprocessing@^3`
  and `postprocessing@^6.39.0`. `postprocessing`'s `EffectComposer` supports a
  `depthTexture`, and an `Effect` that declares `EffectAttribute.DEPTH` is handed
  `readDepth(uv)`, `getViewZ(depth)` and `getViewPosition(...)` in its
  `mainImage`. That is the cheapest available route to everything in Topic 1.
- The repo has no `DepthTexture` usage anywhere in `src/` today. Current world
  water is a `MeshStandardMaterial` with a procedural sine ripple normal map
  (`src/components/World3D/water/waterSurfaceMaterial.ts`).

Out of scope, and why: `webgpu_backdrop_water.html`, `webgpu_ocean.html`,
`webgpu_compute_water.html` and `webgpu_refraction.html` all sit on TSL nodes
(`viewportSharedTexture()`, `backdrop`, compute shaders) that only exist on
`WebGPURenderer`. They cannot be imported into a `WebGLRenderer` canvas. Any
photon-map or FFT-on-compute caustics scheme is the same story.

---

# Topic 1: Underwater camera

## U1. Per-pixel water mask from `gl_FrontFacing`

**How it works.** Render the water surface geometry a second time into a small
mask target with a shader that writes one value for front faces and another for
back faces. A fullscreen pass then reads the mask per pixel: back face visible
means the water surface is between the camera and that pixel from below, so that
pixel is underwater. This is the answer to "per pixel rather than per camera" -
you never test the camera position at all, you test which side of the surface
each pixel's view ray crossed.

**Where.** Crest Ocean System (Unity, MIT). Read directly:
`crest/Assets/Crest/Crest/Shaders/Underwater/UnderwaterMaskShared.hlsl`, whose
fragment stage is
`Frag(const Varyings input, const bool i_isFrontFace : SV_IsFrontFace)` and
returns `_MaskBelowSurface` or `CREST_MASK_ABOVE_SURFACE`. `SV_IsFrontFace` is
the HLSL spelling of `gl_FrontFacing`. Docs:
https://crest.readthedocs.io/en/stable/user/underwater.html
Source: https://github.com/wave-harmonic/crest

**Fits.** Yes. `gl_FrontFacing` is core GLSL ES 3.00. You need one extra
`WebGLRenderTarget` (a single 8-bit channel is enough, but keep its depth buffer -
Crest reads `_CrestOceanMaskDepthTexture` to know how far away the surface was)
and one extra draw of the water mesh only, not the scene. In R3F you do this in a
`useFrame` with a negative `renderPriority`, swapping `scene.overrideMaterial` or
by keeping a dedicated mask mesh on a hidden layer.

**Cost.** One extra draw of the water geometry at whatever mask resolution you
pick, plus one texture fetch in the fullscreen pass. Negligible fill cost if you
render the mask at half resolution. What it complicates: the mask must be
rendered from the same camera with the same wave displacement as the real
surface, or the waterline will disagree with the visible waves. Crest carries a
comment about `SV_IsFrontFace` flipping where adjacent ocean tiles overlap, and
scales tile size by a small epsilon to close gaps without creating overlaps.
Expect the same class of bug on any tiled or LOD'd water grid.

## U2. Exponential extinction fog, applied per channel

**How it works.** Blend the scene colour toward a water colour by
`1 - exp(-density * distance)`, with `density` a `vec3` so red dies first and
blue survives. Distance is the distance the view ray travelled through water,
which underwater is just the scene depth at that pixel.

**Where.** Crest again, one line, `OceanEmission.hlsl:254`:
`alpha = 1.0 - exp(-_DepthFogDensity.xyz * depthFogDistance);`. The same form is
in Inigo Quilez's fog article as `fogAmount = 1.0 - exp(-t*b)` with
`finalColor = mix(pixelColor, fogColor, fogAmount)`:
https://iquilezles.org/articles/fog/ . Catlike Coding uses the Unity spelling
`exp2(-_WaterFogDensity * depthDifference)`:
https://catlikecoding.com/unity/tutorials/flow/looking-through-water/
The Naughty Dog GDC 2012 talk "Water Technology of Uncharted" lists underwater
fog as a named feature (https://gdcvault.com/play/1015309/Water-Technology-of) -
I did not watch it, so treat that as a name-drop, not a technique citation.

**Fits.** Yes, trivially. It is arithmetic on a depth sample. Needs a depth
texture, which `postprocessing`'s `EffectComposer` gives an `EffectAttribute.DEPTH`
effect for free.

**Cost.** A few ALU per pixel. What it complicates: `THREE.Fog` and `FogExp2` are
per-material forward fog applied at shading time, so if you also run this in post
you will fog twice. Pick one. Also, tone mapping runs after, so a fog colour
authored in sRGB will not look like what you picked.

**Refinement worth knowing.** IQ's height-density variant integrates
`d(y) = a * exp(-b*y)` analytically to
`fogAmount = (a/b) * exp(-ro.y*b) * (1 - exp(-t*rd.y*b)) / rd.y`. That gives you
"murkier the deeper you are" for the price of one divide. Same article.

## U3. Screen-space distortion warp

**How it works.** Offset the sampled screen UV by a slowly animated 2D pattern
before reading the input buffer. Two summed sines, or a scrolling normal map,
both read as "looking through moving water".

**Where.** Source engine ships this as a stock effect: the `Refract` pixel
shader distorts what is behind it and is documented as "similar to Water, but
does not have real-time reflections and so is not restricted to flat surfaces"
(https://developer.valvesoftware.com/wiki/Refract). Half-Life 2's underwater
overlay is the `water_warp` screen effect built on it. Crest calls its
equivalent "animated distortion" and applies it inside the underwater fullscreen
pass.

**Fits.** Yes. A `postprocessing` `Effect` subclass with a two-line `mainImage`.
No extra render target: `inputBuffer` is already the composed scene.

**Cost.** One dependent texture fetch per pixel, which is the whole cost of any
post effect. What it complicates: the warp reads outside the frame at the screen
edges. Clamp the UV or you get smeared edge pixels. Do not run it above water or
the waterline transition will pop.

## U4. Colour grading via LUT

**How it works.** Push the whole frame through a 3D lookup texture that crushes
reds, lifts blue-green, and drops contrast. This is the "everything looks like
this down here" half of the underwater look, separate from distance fog.

**Where.** Standard in every engine. In this stack it is already available:
`postprocessing@6.39` exports `LUTEffect`, and three.js core examples ship
`LUTPass.js` and `LUTCubeLoader`.

**Fits.** Yes. `LUTEffect` with a 3D texture, blended by an underwater weight
uniform so you can cross-fade it at the waterline.

**Cost.** One 3D texture fetch per pixel. Cheap. What it complicates: a LUT is
authored against a specific tone-mapping and colour-space setup. Change
`renderer.toneMapping` later and the grade is wrong.

## U5. Waterline / meniscus by mask-edge detection

**How it works.** Do not try to draw a line. Detect it. In the fullscreen pass,
sample the U1 mask three times along the screen-space horizon normal. If any
sample disagrees with the centre sample, you are within a few pixels of the
above/below boundary, so darken and thicken there. That gives the wet lens
meniscus that stops the transition being a hard cut.

**Where.** Crest, exactly this, verified in source:
`UnderwaterEffectShared.hlsl`, functions `MeniscusSampleOceanMask` and
`ComputeMeniscusWeight`, which do
`weight *= (MeniscusSampleOceanMask(mask, positionSS, offset, 1.0, scale) != mask) ? multiplier : 1.0;`
for offsets 1, 2 and 3, and scale the offset with distance because one pixel far
away covers much more world space. The older Crest approach was a physical
`UnderWaterMeniscus` prefab mesh at the near plane; the docs describe it as
deprecated in favour of the screen-space version.

**Fits.** Yes, and it is the strongest single recommendation in this document,
because it directly solves "avoids a hard cut" without any near-plane geometry
hack. Requires U1's mask.

**Cost.** Three extra mask fetches per pixel, and only near the boundary if you
branch. What it complicates: the horizon normal has to be computed on the CPU
from the camera's roll, and the offset direction flips sign with the mask value.
Crest does `float2 offset = (float2)-mask * horizonNormal;` for that reason.

## U6. The near-plane skirt (the older, worse waterline)

**How it works.** Put a small piece of geometry right at the camera near plane,
positioned so the water plane cuts it, and shade the lower half as underwater.
Crest calls it the "underwater curtain".

**Where.** Crest's deprecated `UnderwaterCurtain.shader`, still in the repo.
Source engine effectively does the per-leaf equivalent: the water shader has an
`$abovewater` flag and BSP visleaves are split across the water surface, which is
why Source cannot have moving water with the real Water shader
(https://developer.valvesoftware.com/wiki/Moving_water_(Source)).

**Fits.** Yes but do not. It fights the near plane, it needs its own depth
handling, and it breaks the moment the camera rolls or the waves are tall enough
to cross the near plane twice.

**Cost.** Trivial GPU cost, high bug cost. Listed so it is not reinvented.

---

# Topic 2: See-through water

## S1. Grab-pass refraction with UV offset scaled by depth

**How it works.** Copy the already-rendered opaque scene into a texture. In the
water surface shader, sample that texture at the pixel's own screen UV plus an
offset driven by the surface normal's xy. Then multiply the offset by
`saturate(waterDepth)` so it fades to zero at the shoreline.

**Where.** Catlike Coding, "Looking Through Water", is the clearest written
source and gives the exact fixes:
- grab the background with `GrabPass { "_WaterBackground" }`
- `depthDifference = backgroundDepth - surfaceDepth` from `_CameraDepthTexture`
  via `LinearEyeDepth`
- `uvOffset = tangentSpaceNormal.xy * _RefractionStrength`
- correct for aspect: `uvOffset.y *= _CameraDepthTexture_TexelSize.z * abs(_CameraDepthTexture_TexelSize.y)`
- **the important one**: `uvOffset *= saturate(depthDifference)`
- **the other important one**: if `depthDifference < 0` the refracted sample hit
  something in front of the water, so reset to the unrefracted UV and resample
  both depth and colour.
https://catlikecoding.com/unity/tutorials/flow/looking-through-water/

Crest does the identical two things in `OceanEmission.hlsl`:
`refractOffset *= min(1.0, 0.5 * (i_sceneZ - i_pixelZ)) / i_sceneZ;` and then an
explicit `else` branch commented "We have refracted onto a surface in front of
the water. Cancel the refraction offset."

Source engine's production version is `$refracttexture _rt_WaterRefraction` plus
`$refractamount` on the Water shader
(https://developer.valvesoftware.com/wiki/Refract).

**Fits.** Yes, with work. WebGL2 has no grab pass. You need either
`renderer.copyFramebufferToTexture(texture, position, level)` (present at
`WebGLRenderer.js:2558`, note the r16x signature change) after the opaque pass, or
a two-target setup where you render opaque to target A, then render water to the
screen sampling A. In R3F that is a `useFrame` with explicit
`gl.setRenderTarget` calls and `priority` set so it runs instead of the default
render loop.

**Cost.** One full-screen colour copy per frame plus one dependent fetch per
water pixel. What it complicates: ordering. Water must not be in the target-A
pass, and anything transparent drawn before the copy will be double-counted.
This is the technique with the most ways to get the render graph subtly wrong.

## S2. `MeshPhysicalMaterial` transmission plus volume attenuation

**How it works.** Set `transmission > 0`, `thickness`, `ior = 1.333`,
`attenuationColor` and `attenuationDistance`. three.js re-renders the opaque
scene into a `transmissionRenderTarget`, computes a refraction ray through the
volume, projects its exit point back to screen space, samples the target there,
and multiplies by Beer's law.

**Where.** three.js core. Example `webgl_materials_physical_transmission.html`
(r172). The Beer's law function, verbatim from
`ShaderChunk/transmission_pars_fragment.glsl.js:152-165`:

```glsl
vec3 volumeAttenuation( const in float transmissionDistance, const in vec3 attenuationColor, const in float attenuationDistance ) {
    if ( isinf( attenuationDistance ) ) { return vec3( 1.0 ); }
    vec3 attenuationCoefficient = -log( attenuationColor ) / attenuationDistance;
    vec3 transmittance = exp( - attenuationCoefficient * transmissionDistance ); // Beer's law
    return transmittance;
}
```

This is the glTF `KHR_materials_volume` model. drei wraps a tuned variant as
`MeshTransmissionMaterial`, already in this repo's `node_modules`.

**Fits.** Yes, and it is the least code by a wide margin. Beer-Lambert absorption
by thickness is the exact ask and it is already implemented, tested and
tone-mapped correctly.

**Cost.** One extra full scene render per camera per frame, scaled by
`renderer.transmissionResolutionScale`. That is the expensive part and it is not
optional. What it complicates: **transmissive materials do not appear in the
transmission target**, so water cannot refract other water, and thickness is a
material scalar or a `thicknessMap`, not real geometric depth. For a lake seen
from above, "thickness" wants to be the distance from surface to bed, which this
model has no way to know. That mismatch is why S3 exists.

## S3. Beer-Lambert absorption driven by the depth buffer, not by `thickness`

**How it works.** Sample the scene depth texture at the water pixel, linearise
it, subtract the water surface's own eye depth, and use that difference as the
optical path length in `exp(-density * d)`. Now thickness is real geometry:
shallow water at the shore is genuinely thinner than the middle of the lake.

**Where.** Catlike Coding's `depthDifference` above. Crest's `depthFogDistance`
computed as `sceneZ - i_pixelZ`, then `alpha = 1.0 - exp(-_DepthFogDensity.xyz * depthFogDistance)`.

**Fits.** Yes. Needs a depth texture the water shader can read while the water is
being drawn, which means an explicit depth prepass or an opaque pass into a
target that has `depthTexture` attached. `useDepthBuffer` in drei does exactly
this allocation for you.

**Cost.** One extra depth-only render of the opaque scene if you prepass, plus
one fetch. Depth-only passes are cheap; they are fill-rate bound and skip all
shading. What it complicates: you now maintain two depth notions - the target's
and the canvas's - and they must match in resolution and camera or the shoreline
band will shimmer.

## S4. The depth-texture shoreline trick

**How it works.** The same `depthDifference` from S3 drives three things at once:
opacity (`1 - exp(-k*d)`), refraction strength (`uvOffset *= saturate(d)`), and a
foam band (`1 - smoothstep(0, foamWidth, d)`). Where the terrain pokes through,
`d` goes to zero and the water fades out instead of terminating in a hard
polygon edge.

**Where.** This is the intersection-fade idea from NVIDIA's soft-particles
technique reapplied to a water plane. Catlike Coding's article is the canonical
written form. The three.js forum thread "Toon water shader with depth based fog
and intersection foam" is the community version:
https://discourse.threejs.org/t/toon-water-shader-with-depth-based-fog-and-intersection-foam/35978

**Fits.** Yes, and it is the highest visual return per line of shader in this
whole document. Same depth texture as S3, no additional pass.

**Cost.** Free once S3 exists. What it complicates: precision. At a large camera
`far`, a 24-bit depth buffer resolves nothing near the shoreline and the foam band
will crawl. If the project uses `logarithmicDepthBuffer`, the linearisation maths
is different and the usual `perspectiveDepthToViewZ` will silently give garbage.

## S5. Planar reflector (mirror camera + oblique near-plane clip)

**How it works.** Mirror the camera through the water plane, render the scene
again into a target, and build a texture matrix so the water shader can look up
the reflection at its own screen position. The projection matrix's third row is
rewritten so the near plane sits on the water plane, which clips away everything
below the surface.

**Where.** three.js `examples/jsm/objects/Reflector.js` (one
`renderer.render(scene, virtualCamera)` into one target, line 157) and
`Water.js`, used by `webgl_shaders_ocean.html`. Refractor.js does the same trick
for the transmitted side, verified at `Refractor.js:133-156` where it copies the
clip plane into the projection matrix with a `clipBias`. Source engine's
"expensive water" is the same idea with `$reflecttexture _rt_WaterReflection`.

**Fits.** Yes. This is the shipped, supported path.

**Cost.** One full extra scene render per reflective plane per frame. Two water
planes at different heights means two extra renders. What it complicates: it only
works for one flat plane. A displaced wave surface reflects as if it were flat,
which reads fine on small ripples and wrong on large swells. Also `Reflector`
renders the whole scene, so shadow maps, transmission and post all interact.

## S6. Screen-space reflections

**How it works.** March the reflected view ray through the depth buffer looking
for an intersection, and use the colour there. No second scene render.

**Where.** three.js `examples/jsm/postprocessing/SSRPass.js`, example
`webgl_postprocessing_ssr.html`. Reading the source: it needs a normal render
target filled by a `renderOverride(renderer, this.normalMaterial, this.normalRenderTarget, ...)`
pass (line 363), a metalness target, and depth. So it is **three** passes, not
zero.

**Fits.** Technically yes, practically no for open water. It cannot reflect
anything off screen, which for a horizontal water plane under a sky is almost
everything you want to see. Sky, sun, distant hills: all off screen. SSR on water
gives you reflections of the things standing in the water and nothing else.

**Cost.** Two extra full-scene passes plus a march loop per pixel. Meaningfully
more than a planar reflector for a worse result on this geometry. What it
complicates: it needs a fallback for every ray that leaves the screen, and the
usual fallback is S7.

## S7. Cubemap / environment-map reflection

**How it works.** Reflect the view vector about the surface normal and sample a
cube texture. For water, most of what you want to reflect is sky, and sky is
exactly what a cubemap represents perfectly.

**Where.** three.js `webgl_materials_cubemap_refraction.html` and
`webgl_materials_cubemap_dynamic.html` (the latter drives a `CubeCamera`).
Evan Wallace's WebGL Water uses a static skybox cube for the surface: the water
fragment shader in `martinRenou/threejs-caustics` reads
`textureCube(skybox, reflected)` and lerps against the refracted colour by a
Fresnel factor. Source:
https://github.com/martinRenou/threejs-caustics/blob/master/shaders/water/fragment.glsl

**Fits.** Yes, best cost/benefit of the three reflection options for open water.
A static cubemap or a PMREM environment costs nothing per frame. `CubeCamera`
costs six scene renders per update (`src/cameras/CubeCamera.js:140-155`), so
update it rarely, not every frame.

**Cost.** One cube fetch per pixel for a static map. What it complicates: nothing
nearby reflects, so a boat sitting on the water has no reflection. The usual
production answer is cubemap for sky plus a planar reflector or SSR only for
near objects.

## S8. Chromatic aberration on the refracted sample

**How it works.** Sample the background texture three times, at three slightly
different refraction offsets, and take R from the first, G from the second, B
from the third. Water disperses, and this is nearly free once you already have
the grab texture.

**Where.** Verified in source in `martinRenou/threejs-caustics`,
`shaders/water/fragment.glsl`:

```glsl
refractedColor.r = texture2D(envMap, refractedPosition[0] * 0.5 + 0.5).r;
refractedColor.g = texture2D(envMap, refractedPosition[1] * 0.5 + 0.5).g;
refractedColor.b = texture2D(envMap, refractedPosition[2] * 0.5 + 0.5).b;
```

**Fits.** Yes. Purely additive to S1.

**Cost.** Two extra texture fetches per water pixel. What it complicates: it
triples the chance of one of the three samples landing on a foreground object,
so the S1 "cancel the offset when `depthDifference < 0`" guard has to run per
channel or you get coloured fringes on anything standing in the water.

---

# Topic 3: Caustics on the bed

## C1. Two panning caustic textures blended with `min()`

**How it works.** Take one tileable greyscale caustic texture. Sample it twice at
different scales and different scroll velocities. Combine with `min(a, b)`, not
with an average or an add. `min` keeps the bright filaments thin and moving,
where averaging turns them into grey mush.

**Where.** Alan Zucconi, "Believable Caustics Reflections", which states plainly
that averaging "will not yield a good result":
https://www.alanzucconi.com/2019/09/13/believable-caustics-reflections/
Crest ships the production version of the same idea. Verified in
`OceanEmission.hlsl:93-131`: two UV sets `cuv1` and `cuv2` with different scroll
speeds (`0.044 * _CrestTime`, `-0.169 * _CrestTime` versus `0.248`, `0.117`), both
additionally warped by a shared distortion normal map at `1.30` and `1.77`
strength.

**Fits.** Yes. Perfect fit. No render target, no extra pass, no extension. It is
two texture fetches in whatever material shades the lake bed, or in a
`postprocessing` effect if you are already doing the underwater pass.

**Cost.** Two to four texture fetches per lit-bed pixel. What it complicates:
almost nothing, which is why it is the recommendation. The one real trap is that
this pattern is in **world XZ**, so if the bed is steep the caustics stretch. Fade
by `dot(normal, up)`.

## C2. Projecting the caustic along the light direction, with depth focus

**How it works.** C1 alone slides with the camera and looks pasted on. To
attach it to the water, offset the caustic UV along the light's horizontal
direction proportional to how deep the receiving surface is, and blur the sample
with depth so caustics are sharp at one depth and soft elsewhere.

**Where.** Crest, `OceanEmission.hlsl:86-91`, verified:

```hlsl
float mipLod = log2(max(i_sceneZ, 1.0)) + abs(sceneDepth - _CausticsFocalDepth) / _CausticsDepthOfField;
float2 lightProjection = i_lightDir.xz * sceneDepth / (4.0 * i_lightDir.y);
```

The `4.0` is a deliberate fudge, and the source comment explains why: real
caustics arrive from many directions and do not show that much directionality;
removing the fudge makes caustics stretch badly on angled surfaces. GPU Gems 1
chapter 2, "Rendering Water Caustics" (Guardado and Sanchez-Crespo), builds the
same projection more formally, assuming a flat receiver plane, a single
refraction at the surface, and an overhead sun:
https://developer.nvidia.com/gpugems/gpugems/part-i-natural-effects/chapter-2-rendering-water-caustics

**Fits.** Yes. Needs the surface world-space position of the receiving pixel and
the water height there. If caustics are applied in the underwater post pass you
reconstruct world position from depth; if applied in the bed material you already
have it.

**Cost.** A few ALU plus an explicit `textureLod` instead of an automatic mip.
What it complicates: the manual mip is not optional. Crest's comment says
automatic mip selection "produces ugly patches where samples are
stretched/dilated" because the UV derivatives explode across the projection.

## C3. Caustic light cookie on a `SpotLight`

**How it works.** Put the animated caustic texture in `SpotLight.map` and aim the
light at the bed. three.js multiplies the light colour by the cookie inside
`lights_fragment_begin`, so every lit surface under that spot gets the pattern
with correct falloff and shadowing, for free.

**Where.** three.js core, verified: `src/lights/SpotLight.js:25` declares
`this.map = null`, and
`ShaderChunk/lights_fragment_begin.glsl.js:110-112` does
`spotColor = texture2D( spotLightMap[ SPOT_LIGHT_MAP_INDEX ], spotLightCoord.xy ); directLight.color = inSpotLightMap ? directLight.color * spotColor.rgb : directLight.color;`.
This is the three.js equivalent of a Unity light cookie or an Unreal light
function, which is how a lot of shipped games project caustics.

**Fits.** Yes, with a caveat: three.js has no cookie on `DirectionalLight`, only
`SpotLight`. For a sun over a lake you would need a very wide spot standing in
for the sun, which changes falloff. Good for a cave pool or a dungeon room, not
for an ocean.

**Cost.** Effectively free - it is one fetch inside an already-running light
loop. What it complicates: you must animate the texture, which means either a
flipbook of frames or writing the C1 pattern into a small `DataTexture` /
render target each frame.

## C4. Light-mesh splatting with the Jacobian area ratio (the real thing)

**How it works.** Take a grid mesh matching the water surface. In the vertex
shader, refract the light through the surface normal at each vertex, find where
that ray lands on the bed, and move the vertex there. In the fragment shader,
compare the screen-space area of the triangle before and after with `dFdx`/`dFdy`.
Where the refracted triangle shrank, light concentrated, so it is bright. Render
that additively into a caustic texture, then project the texture onto the bed.

**Where.** Evan Wallace's WebGL Water, 2011, http://madebyevan.com/webgl-water/ .
Source verified in `evanw/webgl-water/renderer.js`:

```glsl
/* if the triangle gets smaller, it gets brighter, and vice versa */
float oldArea = length(dFdx(oldPos)) * length(dFdy(oldPos));
float newArea = length(dFdx(newPos)) * length(dFdy(newPos));
gl_FragColor = vec4(oldArea / newArea * 0.2, 1.0, 0.0, 0.0);
```

with the caustic map built into a `GL.Texture(1024, 1024)` in
`Renderer.prototype.updateCaustics`, and consumed on the bed with
`texture2D(causticTex, 0.75 * (point.xz - point.y * refractedLight.xz / refractedLight.y) * 0.5 + 0.5)`.
That consumption line is C2's light-direction projection, done exactly.

The three.js port is `martinRenou/threejs-caustics`
(https://github.com/martinRenou/threejs-caustics, 363 stars). It generalises the
receiver from a flat pool floor to arbitrary geometry by first rendering an
"environment map" of world position plus depth
(`shaders/environment_mapping/fragment.glsl` writes
`gl_FragColor = vec4(worldPosition.xyz, depth);`) and then ray-marching against it
in the caustics vertex shader with `MAX_ITERATIONS = 50`. drei's `<Caustics>`
component is the same Jacobian idea applied to refracting solids rather than a
heightfield: it renders front and back normals into two FBOs from the light's
camera, then splats `intensity * (lightPosArea / finalArea)`.

**Fits.** Yes on r172, and the WebGL1 caveats in the original code are gone.
`dFdx`/`dFdy` are core in GLSL ES 3.00 so the `hasDerivatives` branch and
`#extension GL_OES_standard_derivatives` line in Evan Wallace's source are
obsolete. You need: one float or half-float render target for the caustic map
(so `EXT_color_buffer_float`), one extra draw of a dense grid mesh per frame,
additive blending, and a water height/normal texture the vertex shader can read.

**Cost.** The expensive option. One draw of a grid at least as dense as your wave
detail, into a 1024-square target, every frame the water moves. Plus the water
surface has to exist as a heightfield texture, which it does not today in this
repo. What it complicates: everything. The projection assumes a known receiver.
Evan Wallace hardcodes a pool cube; martinRenou needs a whole extra world-position
prepass to escape that. On a streamed open world with a moving camera, deciding
what region the caustic map covers is a real problem with no clean answer.

## C5. Procedural caustics in the shader (no texture at all)

**How it works.** Compute the pattern analytically from summed sinusoids or an
animated Voronoi/Worley field, in the bed shader.

**Where.** The widely reused one is "Tileable Water Caustic" by Dave Hoskins,
https://www.shadertoy.com/view/MdlXz8 . It is ported into many three.js and Godot
projects. **I could not read its source** - Shadertoy returned 403 to my fetch -
so I am reporting the identification and its reuse, not the algorithm.

**Fits.** Yes, mechanically. It is pure ALU with no dependencies.

**Cost.** Higher ALU than C1's two texture fetches, and on a fill-heavy 3D scene
that is usually the wrong trade. What it complicates: nothing structurally, but
it is the option most likely to look like a screensaver rather than water, and
it cannot be art-directed without editing GLSL.

---

# Recommendation, one per topic

## Topic 1: build the underwater pass as a `postprocessing` `Effect` with `EffectAttribute.DEPTH`, fed by a `gl_FrontFacing` mask target

Concretely: U1 (mask) + U2 (per-channel exponential extinction) + U3 (warp) +
U5 (mask-edge meniscus), all inside one custom effect. U4's LUT is optional
polish. This is one extra water-only draw and one extra fullscreen pass on a
stack the repo already ships (`@react-three/postprocessing@^3`,
`postprocessing@^6.39.0`, which supplies `readDepth`, `getViewZ` and
`getViewPosition` to a DEPTH effect for free).

**Most likely to go wrong: the mask disagreeing with the surface.** The mask
draw must use identical wave displacement, identical LOD/tile snapping, and the
identical camera as the real water surface. Crest's own source carries a comment
that `SV_IsFrontFace` gets flipped where adjacent ocean tiles overlap, and it
scales tiles by a distance-dependent epsilon to fight it. If the mask is
generated from a simpler proxy mesh "for speed", the waterline will crawl one to
three pixels away from the visible waves and every reviewer will see it
immediately.

## Topic 2: depth-driven Beer-Lambert plus a grab-pass refraction, with a static cubemap for reflection

Concretely: S3 (depth-driven absorption) + S1 (grab-pass refraction with the two
Catlike Coding guards) + S4 (shoreline fade, free once S3 exists) + S7 (cubemap
sky reflection). Skip S2 unless the water body is small and closed - it costs a
full extra scene render and its `thickness` cannot represent a real lake bed.
Skip S5 unless a specific shot needs a mirrored coastline. Skip S6 entirely: SSR
cannot see the sky, and sky is what water reflects.

**Most likely to go wrong: the render-graph ordering around the grab.** WebGL2
has no grab pass, so this needs an explicit opaque-into-target pass, then the
water drawn while sampling that target, with `renderer.copyFramebufferToTexture`
or a second target. In R3F that means taking over the frame loop with a
`useFrame` priority and manual `gl.setRenderTarget` calls. Get the ordering wrong
and water either samples itself (feedback smear) or samples a frame-old buffer
(a one-frame lag that shows as swimming refraction under camera motion). The
second-order trap is depth precision: a large `far` plane turns S4's shoreline
band into a crawling shimmer, and `logarithmicDepthBuffer` silently invalidates
the standard `perspectiveDepthToViewZ` linearisation.

## Topic 3: two panning caustic textures with `min()`, projected along the light with a manual mip

Concretely: C1 + C2. Two texture fetches and about eight lines of maths. It is
what Crest actually ships after having the option to do anything, and it is what
Alan Zucconi's article teaches. Add C3's `SpotLight.map` cookie only for enclosed
water (a cave pool, a dungeon cistern) where a spotlight is physically sensible.
Do not build C4 unless the water already exists as a simulated heightfield
texture and the receiver is a known, bounded region - it is a whole subsystem, it
needs a float render target, and its projection assumptions do not survive a
streamed open world.

**Most likely to go wrong: caustics that slide with the camera instead of sitting
on the bed.** This happens when the pattern is sampled in screen space or in the
receiver's own UV instead of world XZ, and it is the single most common failure.
The second failure is the mip: Crest's source explicitly warns that letting the
GPU pick the mip level "produces ugly patches where samples are
stretched/dilated", because the light-direction projection makes UV derivatives
explode. Sample with an explicit `textureLod` computed as
`log2(max(sceneZ, 1.0)) + abs(depth - focalDepth) / depthOfField`.

---

# What I could not verify

Being explicit so none of this is mistaken for a read source.

- **"The Technical Art of Sea of Thieves"**, SIGGRAPH 2018 Talks, Ang / Catling /
  Ciardi / Kozin (https://dl.acm.org/doi/10.1145/3214745.3214820). Paywalled. It
  is widely cited for FFT ocean plus stylisation. I did not read it and no claim
  above rests on it. There is no GDC talk on Sea of Thieves water specifically;
  the GDC 2018 session "Visual Adventures on Sea of Thieves" is art direction,
  not rendering.
- **"Water Technology of Uncharted"**, GDC 2012, Carlos Gonzalez-Ochoa
  (https://gdcvault.com/play/1015309/Water-Technology-of). Session description
  lists underwater fog among the topics. I did not watch it.
- **Shadertoy "Tileable Water Caustic" by Dave Hoskins** (`MdlXz8`). Shadertoy
  returns 403 to automated fetches. Identification confirmed by search results
  only; the algorithm is not reported above.
- **Evan Wallace's caustics write-up on Medium**
  (https://medium.com/@evanwallace/rendering-realtime-caustics-in-webgl-2a99a29a0b2c)
  and **Martin Renou's** (https://medium.com/@martinRenou/real-time-rendering-of-water-caustics-59cda1d74aa)
  both 403'd. Everything I say about those two techniques comes from reading the
  actual GLSL in `evanw/webgl-water` and `martinRenou/threejs-caustics`, which is
  a better source anyway.
- **Valve Developer Community `Water_(shader)` page** 403'd. The Source claims
  above come from the `Refract` and `Moving_water_(Source)` pages, which did
  load.
- **"Three.js Water Pro"** (threejswaterpro.com) came up repeatedly in searches
  and its marketing describes exactly the feature set in Topic 1. It is a
  commercial closed-source asset built on TSL, i.e. WebGPU. I did not evaluate
  it and it is not a source for anything above.

# Sources

Primary, read directly:
- three.js r172 source in this repo's `node_modules/three` (renderer, shader
  chunks, `examples/jsm/objects/{Water,Water2,Reflector,Refractor}.js`,
  `examples/jsm/postprocessing/SSRPass.js`, `cameras/CubeCamera.js`,
  `lights/SpotLight.js`, `textures/DepthTexture.js`)
- https://github.com/mrdoob/three.js/tree/r172/examples (example inventory)
- https://github.com/evanw/webgl-water (`renderer.js`, `water.js`, `main.js`)
- https://github.com/martinRenou/threejs-caustics (`shaders/**`)
- https://github.com/wave-harmonic/crest (`Shaders/Underwater/*.hlsl`,
  `Shaders/OceanEmission.hlsl`)
- `node_modules/@react-three/drei/core/Caustics.js`,
  `node_modules/postprocessing/build/index.js`

Articles and docs:
- https://catlikecoding.com/unity/tutorials/flow/looking-through-water/
- https://iquilezles.org/articles/fog/
- https://www.alanzucconi.com/2019/09/13/believable-caustics-reflections/
- https://developer.nvidia.com/gpugems/gpugems/part-i-natural-effects/chapter-2-rendering-water-caustics
- https://crest.readthedocs.io/en/stable/user/underwater.html
- https://threejs.org/examples/webgl_shaders_ocean.html
- https://threejs.org/examples/webgl_materials_physical_transmission.html
- https://threejs.org/examples/webgl_postprocessing_ssr.html
- https://developer.valvesoftware.com/wiki/Refract
- https://developer.valvesoftware.com/wiki/Moving_water_(Source)
- https://discourse.threejs.org/t/toon-water-shader-with-depth-based-fog-and-intersection-foam/35978
