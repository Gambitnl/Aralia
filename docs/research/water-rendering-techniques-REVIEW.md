# Adversarial review: water-rendering-techniques.md

Reviewed 2026-08-28. Target: `docs/research/water-rendering-techniques.md`.

**Verdict: 41 claims checked. 8 failed. 7 are true but materially incomplete.
Two failures break a build. One failure inverts the Topic 3 recommendation. One
failure means Topic 1 recommends work the repo already shipped.**

---

# Findings

## F1 (severe). The Topic 1 recommendation is already built in this repo

**The doc claims** (line 45):

> "The repo has no `DepthTexture` usage anywhere in `src/` today. Current world
> water is a `MeshStandardMaterial` with a procedural sine ripple normal map"

and then recommends (line 581):

> "build the underwater pass as a `postprocessing` `Effect` with
> `EffectAttribute.DEPTH`"

**What is true.** That effect exists and is mounted.
`F:\Repos\Aralia\src\components\DesignPreview\steps\land\UnderwaterEffect.tsx`
is a `postprocessing` `Effect` subclass. Line 92 sets
`attributes: EffectAttribute.DEPTH`. Its fragment shader calls `getViewZ(depth)`
and applies per-channel Beer-Lambert extinction with
`const EXTINCTION = new THREE.Vector3(0.36, 0.11, 0.055)` (line 52). That is U2,
already written.
`F:\Repos\Aralia\src\components\DesignPreview\steps\land\UnderwaterLayer.tsx`
mounts it in an `EffectComposer` (line 94). It is live on the land step through
`F:\Repos\Aralia\src\components\DesignPreview\steps\PreviewVolumeGround.tsx:3539`.

The existing file also states the exact gap the doc calls new. Lines 24-34 of
`UnderwaterEffect.tsx` say:

> "The correct way, and what Crest does, is to render the water mesh into a mask
> and branch on whether the fragment sees a front or a back face. ... THIS IS
> NOT THAT."

**Consequence.** A reader builds U2 a second time. The real open work is U1, U3
and U5 only, on top of the existing effect. The doc never names the file, so it
also never names the two constraints that file records: the composer must carry
`ToneMapping ACES_FILMIC`, and the composer must not mount above water. That
second constraint is measured, not assumed
(`UnderwaterLayer.tsx:38-51`: "composer mounted ... mean 3.443, max 106, 14% of
channels >8").

## F2 (severe, build break). `LUTEffect` does not exist in postprocessing 6.39

**The doc claims** (line 155):

> "`postprocessing@6.39` exports `LUTEffect`"

and repeats it at line 158: "`LUTEffect` with a 3D texture".

**What is true.** The installed package exports `LUT3DEffect` and `LUT1DEffect`.
Evidence, `F:\Repos\Aralia\node_modules\postprocessing\build\types\index.d.ts`:

- line 6906: `export class LUT1DEffect extends Effect`
- line 6940: `export class LUT3DEffect extends Effect`

A grep of the whole `.d.ts` for the token `LUTEffect` returns no class. The
React wrapper is a component named `LUT`, at
`F:\Repos\Aralia\node_modules\@react-three\postprocessing\dist\effects\LUT.d.ts`,
which imports `LUT3DEffect`.

**Consequence.** `import { LUTEffect } from 'postprocessing'` fails at build.

## F3 (severe). Crest does not combine caustics with `min()`, so the Topic 3 recommendation misquotes its own strongest source

**The doc claims** (line 433 and line 622):

> "Combine with `min(a, b)`, not with an average or an add. `min` keeps the
> bright filaments thin and moving, where averaging turns them into grey mush."

> "It is what Crest actually ships after having the option to do anything"

**What is true.** Crest averages the two samples. From
`crest/Assets/Crest/Crest/Shaders/OceanEmission.hlsl` on `master`:

```hlsl
io_sceneColour.xyz *= 1.0 + causticsStrength * (0.5 * i_causticsTexture.SampleLevel(cuv1.xy, cuv1.z).xyz + 0.5 * i_causticsTexture.SampleLevel(cuv2.xy, cuv2.z).xyz - _CausticsTextureAverage);
```

`min(` appears three times in that file, at lines 69, 122 and 148. None of them
combine the two caustic samples. Line 148 is the refraction guard the doc quotes
correctly elsewhere.

The Alan Zucconi half of the claim holds. The article does say "When you have
two caustics samples available, they can be blended using the `min` operator"
and "Simply averaging them will not yield a good result."

**Consequence.** The doc names one source that teaches `min()` and one source
that does the opposite, then presents them as agreement. A reader who trusts
"what Crest actually ships" builds the average, which the doc's own C1 section
calls grey mush. The `min()` advice may still be right. The evidence given for
it is half wrong.

## F4 (high). A DEPTH effect does not get `getViewPosition`

**The doc claims** (line 42, repeated at line 587):

> "an `Effect` that declares `EffectAttribute.DEPTH` is handed `readDepth(uv)`,
> `getViewZ(depth)` and `getViewPosition(...)` in its `mainImage`"

**What is true.** Two of the three exist. The shared effect fragment template in
`F:\Repos\Aralia\node_modules\postprocessing\build\index.js` (lines 14640-14665)
defines `float readDepth(const in vec2 uv)` and `float getViewZ(const in float
depth)`. It does not define `getViewPosition`. A grep of lines 14600-14700 for
`getViewPosition` returns 0 hits.

`getViewPosition` exists only inside two private materials in that build: the
circle-of-confusion material (line 4955) and the SSAO material (line 11302).
Neither is reachable from a custom `Effect`.

**Consequence.** C2 depends on this. The doc says at line 477: "If caustics are
applied in the underwater post pass you reconstruct world position from depth."
The helper for that is not supplied. The author must write the inverse
projection by hand, and must add the `projectionMatrixInverse` uniform, which
the effect template also does not declare.

## F5 (high). drei `useDepthBuffer` is not a depth-only prepass

**The doc claims** (line 303, in S3):

> "`useDepthBuffer` in drei does exactly this allocation for you."

The surrounding cost claim is:

> "One extra depth-only render of the opaque scene if you prepass, plus one
> fetch. Depth-only passes are cheap; they are fill-rate bound and skip all
> shading."

**What is true.** Read
`F:\Repos\Aralia\node_modules\@react-three\drei\core\useDepthBuffer.js` in full.
The hook does this every frame:

```js
state.gl.setRenderTarget(depthFBO);
state.gl.render(state.scene, state.camera);
state.gl.setRenderTarget(null);
```

There is no `overrideMaterial` and no depth-only material. It is a full shaded
render of the whole scene. It skips no shading at all.

Three further facts the doc does not state:

- The depth texture is `UnsignedShortType`, that is 16-bit, not the 24-bit the
  doc assumes in S4 (line 330).
- The default size is 256 by 256 pixels, not the canvas size.
- The render includes the water, because the water is in `state.scene`. The
  world water material sets `transparent: true` and leaves `depthWrite` at its
  default of true
  (`F:\Repos\Aralia\src\components\World3D\water\waterSurfaceMaterial.ts:126-153`).
  So the depth texture holds the water surface, not the bed.

**Consequence.** S3's `depthDifference` computes to about zero everywhere the
water is drawn. The shoreline band in S4 then does nothing. The cost is also
double what the doc states: one full shaded scene render, not a depth prepass.

## F6 (medium). The Crest `OceanEmission.hlsl` line numbers are wrong

**The doc claims** three line citations:

- line 101: "`OceanEmission.hlsl:254`" for the depth fog alpha
- line 442: "Verified in `OceanEmission.hlsl:93-131`" for `cuv1` and `cuv2`
- line 461: "Crest, `OceanEmission.hlsl:86-91`, verified" for `mipLod` and
  `lightProjection`

**What is true** on `wave-harmonic/crest` `master`: the `mipLod` and
`lightProjection` pair is at about lines 66-70. The `cuv1`/`cuv2` build is at
about lines 85-99, and their combination at about line 117. The depth fog alpha
is at about line 175, not 254. The `min(` positions returned as 69, 122 and 148
agree with that layout.

**Consequence.** The quoted GLSL is correct. The line numbers are not. A reader
who opens the file at 254 finds nothing. Note the caveat: Crest has more than
one branch and release line, and the doc does not name which one it read. It
should have.

## F7 (medium). The repo already ships a caustic implementation, and the doc does not mention it

**The doc implies** caustics are new work. The context section (lines 45-47)
surveys the repo in two sentences and names only `waterSurfaceMaterial.ts`.

**What is true.** `F:\Repos\Aralia\src\components\BattleMap\terrain\WaterSystem.tsx`
already does C1's dual-scroll idea. Line 16 of its header:

> "Caustic brightening using dual scrolling FBM layers"

Line 184 carries the comment "Caustic overlay - two FBM layers scrolling in
opposite directions", and line 189 applies
`_wCol += uWaterCaustic * _cau * (1.0 - _dF * 0.55);`. Per-biome tints live at
lines 64-84.

**Consequence.** The Topic 3 recommendation restates something the battle map
already has, on a different surface, with no note of which one wins or whether
the two should share code. It also uses FBM, not a tileable texture, so the
`min()` versus average question is already answered one way in shipped code.

## F8 (medium). `scene.overrideMaterial` does not restrict the draw list, so U1's cost claim does not follow from U1's method

**The doc claims** (lines 79-83 and 88):

> "one extra draw of the water mesh only, not the scene. In R3F you do this in a
> `useFrame` with a negative `renderPriority`, swapping `scene.overrideMaterial`"

> "**Cost.** One extra draw of the water geometry"

**What is true.** `scene.overrideMaterial` replaces the material on every object
that renders. It does not remove any object from the render list. If you take
the `overrideMaterial` route named first, you draw the whole scene into the mask
target, not the water. Only the second route the doc names, a dedicated mesh on
a hidden layer, gives the stated cost.

The R3F half of the sentence holds. A negative priority does not take over the
render loop. Evidence, `F:\Repos\Aralia\node_modules\@react-three\fiber\dist\events-5a94e5eb.esm.js`
offset 1077: `priority = internal.priority + (priority > 0 ? 1 : 0)`. Only a
positive priority disables the automatic render.

**Consequence.** The stated cost is right for one of the two routes and wrong
for the other. The doc presents them as equivalent.

## F9 (medium). The three.js `.html` examples are not in `node_modules`, so "verified by reading `node_modules/three`" over-claims

**The doc claims** (line 9): "Verified by reading `node_modules/three` at r172 in
this repo, not from memory." Inside that same section, line 21 says: "The
shipped example is `webgl_depth_texture.html` (r172), which builds
`target.depthTexture = new THREE.DepthTexture()`".

**What is true.** `F:\Repos\Aralia\node_modules\three\examples\` contains exactly
two entries: `fonts` and `jsm`. There are no `.html` files. Every
`webgl_*.html` name in the document (there are nine) came from somewhere else.
The Sources block does list the GitHub examples tree "for example inventory",
so the sourcing is not invented. The word "shipped", under a heading that claims
local verification, is still wrong.

**Consequence.** Low build risk. It weakens the document's central promise, that
its API facts were read locally. The `jsm` claims were read locally and all hold.

## F10 (low). The current world water already carries a depth channel, which the doc's S4 treats as missing

**The doc claims** (line 46): "Current world water is a `MeshStandardMaterial`
with a procedural sine ripple normal map".

**What is true, and left out.** The material also has `vertexColors: true` and an
`onBeforeCompile` hook that reads a packed per-vertex depth encoding
(`waterSurfaceMaterial.ts:155-187`). It already drives opacity and color from
depth:

```js
diffuseColor.rgb = mix( uShallowColor, uDeepColor, wColorRamp );
diffuseColor.a = mix( 0.120, 0.900, wOpacityRamp );
```

`F:\Repos\Aralia\src\systems\world3d\waterGeometry.ts:64-71` explains why depth
comes from the CPU:

> "Depth is a CPU-side fact - it needs the carved bed heightfield, which the
> fragment shader has no access to"

**Consequence.** S4's shoreline fade partly exists by a different route. The
doc's S3/S4 pair would replace a working CPU depth channel with a GPU one, and
the doc never frames that as a replacement or says why the swap is worth it.

## F11 (low). U1's half-resolution cost saving fights U5's three-pixel meniscus

**The doc claims** at line 88: "Negligible fill cost if you render the mask at
half resolution." It then claims at line 174 that U5 samples the mask "for
offsets 1, 2 and 3" pixels, and calls U5 "the strongest single recommendation in
this document" (line 182).

**What is true.** The two are not independent. A half-resolution mask makes each
mask texel two screen pixels wide. A 1, 2, 3 texel offset then spans 6 screen
pixels, and the meniscus band quantizes to even pixel widths. The doc asserts
the saving and the precision separately, and never reconciles them.

**Consequence.** A reader takes the half-resolution saving and then cannot tune
the meniscus width below about 2 pixels.

## F12 (low). C3's "effectively free" ignores a shader recompile

**The doc claims** (line 505): "**Cost.** Effectively free - it is one fetch
inside an already-running light loop."

**What is true.** The fetch is cheap. The cost the doc omits is the program
cache key. `F:\Repos\Aralia\node_modules\three\src\renderers\webgl\WebGLLights.js`
counts `numSpotMaps` (line 226, incremented at 310) and puts it in the state
hash at lines 433 and 464. A new spot light with a map changes that hash, so
three.js recompiles every material in the scene once. Every lit fragment also
gains the spot attenuation branch.

The rest of C3 holds. `light.map` alone is enough; a shadow is not required.
`DirectionalLight` has no `map` property, so the doc's caveat is correct.

## F13 (low). `WebGLCapabilities.js:41` checks readback, not render-target format support

**The doc claims** (line 17): three.js "validates the combination in
`WebGLCapabilities.js:41`".

**What is true.** Line 41 is inside `function textureTypeReadable( textureType )`.
It governs `readRenderTargetPixels`, not whether a float color attachment can be
created. The substantive claim, that float and half-float color targets need
`EXT_color_buffer_float` or `EXT_color_buffer_half_float`, is correct. The
extension probe at `WebGLExtensions.js:56` is cited correctly.

## F14 (low). SSRPass runs two extra passes, not always three

**The doc claims** (line 366): "So it is **three** passes, not zero", and at
line 373 "Two extra full-scene passes".

**What is true.** The normal pass at `SSRPass.js:363` is unconditional. The
metalness pass at line 369 sits inside `if ( this.selective )`. So the count is
two by default and three in selective mode. The doc's two cost sentences already
disagree with each other by one pass.

## F15 (low). Two quotation slips

- Line 265 introduces the Beer's law function as "verbatim". The real chunk
  wraps the second half in an `else` block and carries two comments the doc
  drops. The math is identical.
- Line 386 reads: "Evan Wallace's WebGL Water uses a static skybox cube for the
  surface: the water fragment shader in `martinRenou/threejs-caustics` reads
  `textureCube(skybox, reflected)`." Those are two different projects in one
  sentence. The quoted line is martinRenou's. It does exist there, verified as
  `vec3 reflectedColor = textureCube(skybox, reflected).xyz;`.

---

# Checked and holds

- S1 guards: all four Catlike Coding quotes verified against the live article
  (GrabPass, the `_CameraDepthTexture_TexelSize` aspect fix,
  `uvOffset *= saturate(depthDifference)`, the negative-difference guard,
  `LinearEyeDepth`). Checked, holds.
- S1 Crest quote `refractOffset *= min(1.0, 0.5 * (i_sceneZ - i_pixelZ)) / i_sceneZ;`
  found at `OceanEmission.hlsl:148`. Checked, holds.
- S2: `transmissionRenderTarget` per camera at `WebGLRenderer.js:1475-1535`;
  `transmissionResolutionScale` at line 197. One extra scene render per camera.
  Checked, holds.
- S2 Beer's law chunk at `transmission_pars_fragment.glsl.js:152-165`. Checked,
  holds (see F15 on "verbatim").
- S5: `Reflector.js:157` is one `renderer.render( scene, virtualCamera )`.
  `Refractor.js:133-156` builds the oblique clip plane and applies `clipBias` at
  line 156. Checked, holds.
- S7: `CubeCamera` costs six renders. The cited range 140-155 covers five; the
  sixth is at line 161. Checked, holds.
- S8: the three-channel refraction quote is exact in
  `martinRenou/threejs-caustics/shaders/water/fragment.glsl`. Checked, holds.
- C2: the `mipLod` and `lightProjection` GLSL is exact. Only the line number is
  wrong (F6). Checked, holds.
- C3: `SpotLight.js:25` declares `this.map = null`.
  `lights_fragment_begin.glsl.js:110-112` samples it. `light.map` alone
  increments `numSpotMaps` at `WebGLLights.js:310`, so no shadow is needed.
  `DirectionalLight` has no `map`. Checked, holds.
- C4: the Jacobian quote, the `GL.Texture(1024, 1024)` size and the
  `#extension GL_OES_standard_derivatives` line are all real in
  `evanw/webgl-water/renderer.js`. Checked, holds.
- C4 drei: `Caustics.js:178` is `caustic += intensity * (lightPosArea / finalArea);`.
  Two FBOs at lines 220-221. `THREE.FloatType` at line 191, so the float
  render-target caveat is correct. Checked, holds.
- U1 Crest mask: `Frag(const Varyings input, const bool i_isFrontFace : SV_IsFrontFace)`,
  `_MaskBelowSurface` and `CREST_MASK_ABOVE_SURFACE` all present. Checked, holds.
- U5 Crest meniscus: `MeniscusSampleOceanMask`, `ComputeMeniscusWeight`, the
  `weight *= ...` line and `float2 offset = (float2)-mask * horizonNormal;` all
  present. Checked, holds.
- Renderer constraint: `WebGLRenderer.js:251` requests `webgl2` and nothing
  else. Checked, holds.
- Extension probe: `WebGLExtensions.js:56` gets `EXT_color_buffer_float`, line 59
  gets `EXT_color_buffer_half_float`. Checked, holds.
- `THREE.DepthTexture` ships at `src/textures/DepthTexture.js`. Checked, holds.
- `copyFramebufferToTexture` at `WebGLRenderer.js:2558` with signature
  `( texture, position = null, level = 0 )`. The deprecation note names r165, so
  the doc's "r16x signature change" is right. Checked, holds.
- Example inventory in `examples/jsm/objects/`: `Water.js`, `Water2.js`,
  `Water2Mesh.js`, `Reflector.js`, `Refractor.js` all present. `WaterMesh.js` is
  also present and unlisted. `SSRPass.js`, `LUTPass.js` and `LUTCubeLoader.js`
  present. Checked, holds.
- Dependency versions: `three` 0.172.0, `postprocessing` 6.39.0,
  `@react-three/postprocessing` 3.0.4, `@react-three/drei` 10.7.7,
  `@react-three/fiber` 9.5.0. Checked, holds.
- drei barrel exports `useDepthBuffer` (index.js:65), `MeshTransmissionMaterial`
  (line 84) and `Caustics` (line 101). Checked, holds.
- "No `DepthTexture` usage in `src/`": grep returns 0 hits. Literally true. See
  F1 for why it misleads - `postprocessing` allocates one implicitly for the
  mounted `UnderwaterEffect`.
- WebGPU scope: the repo has WebGPU only on opt-in surfaces
  (`BattleMap3DGpuScene.tsx`, `FluidScene3D.tsx`, `FlipScene3D.tsx`,
  `SideBySideOcean.tsx`, `WebGPUProbeScene.tsx`). None is the world or land
  surface. The doc's exclusion of TSL techniques holds.
- `logarithmicDepthBuffer`: 0 hits in `src/`. The S4 warning is a valid caveat,
  not a live risk. Note that `postprocessing`'s own `readDepth` already handles
  both logarithmic and reversed depth buffers
  (`build/index.js`, effect template).

---

# The doc's own "could not verify" section

Every item it lists is genuinely hard to reach, and I did not re-test the
paywalled or 403 sources. The section is honest about what it names.

**It should also have named these.** Each was asserted as fact and each is
wrong or unchecked:

1. `LUTEffect` (F2). One grep of the installed `.d.ts` settles it.
2. `getViewPosition` for DEPTH effects (F4). Same, one grep.
3. What drei's `useDepthBuffer` actually renders (F5). The file is 36 lines.
4. Whether Crest combines caustics with `min()` (F3). The doc read the file for
   `cuv1`/`cuv2` and did not read the next expression.
5. Which Crest branch or release the line numbers came from (F6).
6. Whether the repo already implements any of the three topics (F1, F7). The doc
   surveys the repo in one bullet and asserts a negative.
7. That `node_modules/three` ships no `.html` examples (F9).

---

# Not checkable here

- Crest's license. The doc says "(Unity, MIT)". I did not open the license file.
- The Crest comment about `SV_IsFrontFace` flipping on overlapped ocean tiles,
  and the tile-size epsilon. The doc leans on it twice, including in the Topic 1
  risk callout. I did not find the comment. It may be in a different file.
- The deprecation status of Crest's `UnderwaterCurtain.shader`.
- Inigo Quilez's fog article, GPU Gems 1 chapter 2, the Valve `Refract` and
  `Moving_water_(Source)` pages, and the three.js discourse thread 35978. Not
  fetched.
- The 363-star count for `martinRenou/threejs-caustics`. A count like that ages
  within days and should not be in a research note.
- Shadertoy `MdlXz8`. The doc already reports it as unread, correctly.
- Whether any of the recommended techniques look right. This is a source and API
  review only. No frame was rendered.
