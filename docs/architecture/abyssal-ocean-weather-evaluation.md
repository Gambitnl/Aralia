# ABYSSAL ocean and extreme-weather adoption evaluation

Verified: 2026-09-09

## Verdict up front

**Selective component lifts only, and only two of them are worth the port cost
today: the Bruneton/Hillaire atmospheric-scattering LUTs and the raymarched
volumetric clouds with weather-map cloud shadows.** Everything else in ABYSSAL
either duplicates work Aralia has already shipped better-integrated, or solves
a problem (a scripted cinematic demo) that is the opposite of what Aralia
needs (a deterministic, persistent, gameplay-queryable simulation). Whole-project
integration and an isolated ABYSSAL-derived scene mode are both **no-go** - see
the three-option comparison below for why. No code has been vendored or
implemented; this is the evaluation only, as instructed.

## What this evaluation covers, and what it could not run

Inspected via GitHub API (`gh api`) and one live-demo visit in the sandboxed
Browser pane, source-code only - no clone, no local build. Cloning and running
an external, untrusted repository's build/dev-server would cross the
"downloading or executing files from untrusted sources" line, and it is also a
heavy command by this task's own rule, so it was not done. This is a
methodology limit, stated plainly rather than guessed around:

- **No local build or `npm run dev`/`test`/`smoke` was run against ABYSSAL.**
  Its `package.json` declares `three: ^0.169.0`, a Vite 8 dev server, and a
  Puppeteer-based `tools/smoke.mjs` / `tools/quality-sim.mjs` pair - all
  inspected as text, none executed.
- **The live demo was loaded once** in the Browser pane
  (`https://token-gremlin.github.io/natural-disasters/?preset=medium&profile=1`)
  to confirm it is real, currently-deployed, GLSL3-compiling WebGL2 content
  and not vaporware. It rendered (screenshot: ocean + cloud deck, Beaufort 4
  HUD, wind 5.3 m/s at 34°) and the console showed genuine
  `THREE.WebGLProgram` shader compiles with real driver warnings
  (`X3595: gradient instruction used in a loop with varying iteration`),
  which only a real shader compile against a real driver emits.
- **The on-screen perf counter read "1 fps · 1000.0 ms."** That is the
  sandboxed/virtualized GPU in this environment, not a measurement of ABYSSAL
  on real hardware - it is reported here so nobody mistakes it for a
  performance verdict. No representative GPU-backed performance number can be
  taken from this environment; any performance claim below is read from the
  README's own stated targets and the code's quality-preset tiers, not
  independently measured.
- No proof screenshots were written to disk (nothing under `.agent/scratch/`
  from this task), so there is nothing to `git check-ignore`.

## Source and provenance

- Repo: `github.com/Token-Gremlin/natural-disasters` ("ABYSSAL"), public,
  258 stars, 35 forks, created 2026-08-23, last push 2026-09-01.
- **License: MIT**, copyright "Davi (Token-Gremlin) 2026," confirmed via
  `gh api repos/.../license` (SPDX `mit`) and the repo's `LICENSE` file
  content, not just the badge.
- Commit inspected: `d2bae38301ff43bc1d43bfdfd9477a552ca5420b`
  ("docs: add $ABYSSAL community token information," 2026-09-01) - the
  `HEAD` of `main` at evaluation time.
- Stack: Three.js **r169**, `THREE.WebGLRenderer` (WebGL2 required, throws if
  `EXT_color_buffer_float` is missing), hand-written **GLSL3** via
  `RawShaderMaterial`-style shader strings (`gfx/ShadingGLSL.js`,
  `sky/AtmosphereGLSL.js`, `ocean/OceanSampleGLSL.js`). **No WebGPU, no TSL,
  no node-material anywhere in the tree.** `caps.webgpu` is probed only to
  report it in a debug object, never used.
- 24 source files under `src/`: `camera/CinematicCamera.js`, `core/{App,
  GpuProfiler, Quality, SharedUniforms}.js`, `gfx/{FullScreenPass, NoiseGLSL,
  ProceduralTextures, ShadingGLSL}.js`, `ocean/{OceanFFT, OceanMesh,
  OceanSampleGLSL}.js`, `post/PostFX.js`, `sky/{Atmosphere, AtmosphereGLSL,
  Clouds, SkyRenderer}.js`, `ui/{Overlay, Sandbox}.js`,
  `weather/{Director, Lightning, Precipitation, Waterspout, Weather}.js`,
  plus `main.js`. ~400 KB total, no external asset files (README's own
  claim, and the file tree confirms it - no `.png`/`.hdr`/`.glb` under `src/`).
- **Architecturally, this is a demoscene cinematic piece, not a simulation
  engine.** `weather/Director.js` is a fixed sequence of hand-authored "acts"
  (`DEAD CALM` -> `SUNRISE` -> `FRESH GALE` -> `SQUALL LINE` -> `VIOLENT STORM`
  -> ...), each a literal object literal of target weather parameters, camera
  shot list, and timed one-shot events (`d.lightningBurst(4)`). Sandbox mode
  lets a user fly a free camera and spawn events where they look, but nothing
  in the code persists, saves, or replays a world state - `Weather.state`
  damps continuously toward `Weather.target` every frame
  (`damp(a,b,l,dt) = a + (b-a)*(1-exp(-l*dt))`) with no save/restore path and
  no fixed-timestep determinism guarantee across frame-rate variation.

## Candidate subsystem inventory, scored

Scored 1 (poor) to 5 (excellent) on four axes that matter for Aralia
specifically: **Aralia fit** (does Aralia already need/have this, or is it
solving a problem Aralia doesn't have), **port cost** (WebGL2/GLSL3 ->
WebGPU/TSL migration cost, 5 = cheap), **coupling** (how entangled with
ABYSSAL's own scripted-cinematic assumptions, 5 = loosely coupled / drop-in),
and **gameplay value** (usable by combat/travel/persistence systems, not just
looks-good-in-a-flythrough).

| Subsystem | File(s) | Aralia fit | Port cost | Coupling | Gameplay value | Verdict |
|---|---|:-:|:-:|:-:|:-:|---|
| Multi-cascade FFT ocean + projected grid | `ocean/OceanFFT.js`, `OceanMesh.js` | 1 | 2 | 3 | 2 | **Skip - Aralia's own `ocean-surface` topic already ships a done, tested multi-cascade JONSWAP FFT ocean natively on WebGPU/TSL** (3 cascades, 60 tests, GPU-vs-CPU max abs error 1.29-2.96 µm; see below). Lifting ABYSSAL's GLSL2/WebGL2 IFFT would be a straight regression in stack fit and a duplicate of shipped work. |
| Water shading + persistent foam | `OceanSampleGLSL.js`, `ShadingGLSL.js` | 3 | 2 | 3 | 3 | **Selective idea-lift only, not code.** The Jacobian/steepness-driven foam accumulation-and-decay model and the anisotropic grazing-angle roughness are good *techniques* worth re-deriving directly in TSL against Aralia's own ocean cascades; the GLSL text itself is not portable without a rewrite (RawShaderMaterial GLSL3 has no TSL equivalent import path). |
| Atmospheric scattering (Bruneton/Hillaire LUTs) | `sky/Atmosphere.js`, `AtmosphereGLSL.js` | 5 | 2 | 4 | 4 | **Best candidate for a real lift.** Aralia's WebGPU probe currently bakes a flat hemisphere+sun Lambert term because scene lights don't drive the WebGPU `LightsNode` (three #30044 / r3f #2853) - precomputed transmittance/multi-scatter/sky-view LUTs are exactly the kind of self-contained, uniform-driven texture bake that survives a GLSL->TSL port reasonably well (it's mostly compute-into-texture, not vertex/fragment pipeline binding). Still a real port, not a copy-paste. |
| Volumetric clouds + cloud shadows | `sky/Clouds.js` | 4 | 2 | 4 | 3 | **Second-best candidate.** Raymarched Perlin-Worley clouds shaped by a synoptic "weather map" texture, with cloud shadows sampled at the sun-beam/cloud-base intersection onto the water. Aralia has no clouds system at all today (no planmap topic for one). Worth a scoped port once the atmosphere LUTs land, since clouds consume the same transmittance table. |
| Weather state + Beaufort mapping | `weather/Weather.js`, `Director.js` | 2 | 4 | 2 | 2 | **Reference only.** The `BEAUFORT` table (wind-speed thresholds -> Beaufort 0-12 labels) is 12 lines of public, non-copyrightable domain data worth re-typing from the WMO scale directly rather than importing. The surrounding `Weather`/`Director` machinery is a scripted-cinematic damped-target system with no persistence, no save/replay, and no relation to a game's deterministic tick - not reusable as-is for a hydrology/gameplay weather system. |
| Rain, spray, lightning | `weather/Precipitation.js`, `Lightning.js` | 2 | 3 | 3 | 2 | Pure visual particle/geometry effects, decorative only. Low priority; nothing in Aralia's roadmap currently calls for branching volumetric lightning. |
| Waterspouts, whirlpools, hurricanes, rogue waves, tsunamis | `weather/Waterspout.js`, plus analytic terms inside `Director.js`/shading | 1 | 2 | 1 | 1 | **Skip.** These are camera-triggered one-shot VFX events layered on the FFT displacement field (an analytic "disaster field" the raymarcher bisects against) - not simulations with mass, momentum, or a queryable state a hydrology/combat system could read. Aralia's own hydrology (`shallowWater.ts`, `waterBudget.ts`) already owns conservative, testable flood/breach/drain behavior; a decorative tsunami wall would be a second, disagreeing opinion about water, the exact class of bug GG-129 already tracks. |
| Procedural texture/noise baking | `gfx/NoiseGLSL.js`, `ProceduralTextures.js` | 2 | 3 | 3 | 2 | Standard Perlin/Worley/curl-noise bakes. Aralia likely has equivalents already in its own noise utilities; worth a quick dedupe check before any lift, not a priority on its own. |
| Post-processing (TAA, bloom, DOF, motion blur, AgX/ACES, CAS, grain, vignette) | `post/PostFX.js` | 2 | 3 | 4 | 2 | Aralia's `webgpu-migration` topic already lists postprocessing as backlog on the WebGPU path. A full post stack is generic and better sourced from three.js's own postprocessing examples (which get native TSL support) than ported from ABYSSAL's WebGL2 passes. |
| Adaptive quality + GPU profiling | `core/Quality.js`, `GpuProfiler.js` | 3 | 4 | 5 | 3 | Clean, small, dependency-free frame-budget/downgrade logic (windowed frame-time sampling, tiered preset downgrade, panic threshold). Cheapest lift in the whole repo if the pattern is ever wanted - but it is a *pattern* to imitate (Aralia may already have or want its own), not a subsystem to import wholesale. |
| Cinematic camera + sandbox controls | `camera/CinematicCamera.js`, `ui/Sandbox.js` | 1 | 3 | 2 | 1 | Purpose-built for ABYSSAL's own scripted acts and free-fly demo controls. No fit against Aralia's existing camera/combat control schemes. |

## Mapping against Aralia's actual state

- **`ocean-surface` (planmap, status active, verified 2026-09-09) already
  ships a done multi-cascade JONSWAP FFT ocean on WebGPU/TSL** - 3 cascades,
  60 tests, GPU-vs-CPU max abs error 1.29-2.96 µm, third cascade added
  2026-08-13 with measured energy conservation (Hs 11.96 vs 11.99 ft). This is
  the single biggest reason whole-project or scene-mode adoption is a
  non-starter: Aralia is not missing an ocean, it is missing *consumers* of
  the one it built (ship-height query, LOD, `setCenter` wiring - parked, not
  blocked by ABYSSAL).
- **`webgpu-migration` (active)** is mid-flight: WebGPU probe, material parity
  and full-stack parity are done; battle-map GPU path is active behind
  `?gpu=1`. ABYSSAL is r169 `WebGLRenderer` + hand GLSL3 with **zero** TSL -
  adopting any of it means porting shader logic across a rendering API
  boundary Aralia itself is still crossing, not reusing working code.
- **`docs/adr/0002-volume-ground-and-gpu-fluid.md`** (revised 2026-08-07) is
  the load-bearing constraint: Aralia's near-field water is a CPU-authoritative,
  exactly-conservative 2D virtual-pipe solver (`shallowWater.ts`), chosen
  specifically *because* WGSL float non-determinism across hardware makes
  GPU state unsafe to save or replay. ABYSSAL's ocean and disaster fields are
  the opposite design point on purpose: GPU-resident, frame-damped, replay-free,
  built for a camera flythrough. The two are not reconcilable by wiring; a
  tsunami or whirlpool from ABYSSAL cannot be asked "how much water is here"
  by `waterBudget.ts` or the combat referee without becoming a second,
  disagreeing water opinion (the exact fault GG-129 already records).
- **`src/systems/worldforge/hydrology/`** (new today, read-only per the task):
  `waterBudget.ts` is the far-water notebook (lakes/rivers/sea as bookkeeping,
  sky-bucket mass closure); `shallowWaterSolver.ts` is the seam that opens a
  live conservative window into the notebook around the player, reusing
  `shallowWater.ts` rather than writing a second solver - its own header cites
  GG-129 by name for exactly the reason above. `index.ts` re-exports both.
  Nothing here has, needs, or should gain a dependency on ABYSSAL.
- **`land-substance-water-bench` (active)** already covers look/preset/fluid
  switching (pond, flood, sea; water vs mud vs lava vs oil) on Aralia's own
  physics sheet, including an open, in-progress "Full FFT-look merge... flow-bent
  ripple, physics foam from discharge" feature - i.e. Aralia is already doing
  the FFT-foam-look-onto-real-physics integration ABYSSAL's foam model
  illustrates, just against its own conservative solver instead of a decorative
  one.
- **No weather-system planmap topic exists** (searched all 188 topic ids and
  titles for `weather|storm|rain|cloud|atmosph`; only combat-terrain topics
  matched). Extreme weather and clouds are open territory for Aralia, which is
  exactly why the atmosphere/cloud lift above is the one candidate worth
  pursuing - it fills a real gap instead of duplicating a done topic.

## Three-option comparison

| | A. Selective component lifts | B. Isolated ABYSSAL-derived scene/renderer mode | C. Whole-project integration |
|---|---|---|---|
| **What it means** | Re-derive 1-2 techniques (atmosphere LUTs, clouds) directly in TSL against Aralia's own ocean/renderer | A separate `?phase=abyssalocean`-style mode running ABYSSAL's own WebGL2 pipeline alongside the main WebGPU game | Merge ABYSSAL's renderer, ocean, and weather as Aralia's primary ocean/weather system |
| **WebGL2/GLSL3 vs WebGPU/TSL** | N/A - never imports ABYSSAL's shader text, only its math/technique | Runs two renderer stacks in one app: WebGPU for the game, WebGL2 for this one mode. Three.js supports only one renderer context per canvas cleanly; a second canvas/context is possible but doubles GPU memory pressure and driver context switches | Forces the whole game onto WebGL2/GLSL3, directly reversing the in-flight `webgpu-migration` topic |
| **Coupling / port cost** | Low-medium: rewriting two self-contained texture-bake passes in TSL, no ABYSSAL runtime dependency | Medium-high: needs a second app/canvas lifecycle, its own quality/profiler/input handling duplicated or bridged, and permanent GLSL3 shader maintenance in a WebGPU-first codebase | Very high: the whole hydrology stack (ADR 0002, `shallowWater.ts`, `waterBudget.ts`, `shallowWaterSolver.ts`, GG-129's water-opinion fix) would need to be reconciled with or replaced by ABYSSAL's disaster-field model, against Aralia's own explicit determinism/persistence requirements |
| **Browser/device support incl. mobile** | Matches whatever Aralia's WebGPU path already supports/falls back to | Adds a second capability gate (`WebGL2` + `EXT_color_buffer_float` required, per `App.js`'s own throw) on top of the existing WebGPU gate - worse mobile/older-GPU coverage than either stack alone | Drops WebGPU entirely; simpler gate, but abandons work already banked in `webgpu-migration` |
| **Perf budget / fallback** | Inherits Aralia's existing adaptive-quality and fallback story | ABYSSAL ships its own tiered quality presets (`potato`->`ultra`, FFT size 128-256, ocean grid up to 480x300) and adaptive downgrade - reusable *as a pattern*, but a second budget system to keep in sync with the game's | Would need ABYSSAL's `Quality`/`GpuProfiler` promoted to be the game's only frame-budget system, replacing whatever exists there today (out of scope to verify further here) |
| **Testability** | Fits Aralia's existing vitest + conservation-test culture (write new tests against the TSL port, same as `shallowWater.ts`'s 11 tests) | ABYSSAL's own test story is a Puppeteer smoke script and a `quality-sim.mjs` - neither inspected further (not run); a second, foreign test harness to maintain | Would require ABYSSAL's own test tooling to become part of Aralia's CI, alongside Aralia's existing suite |
| **Visual fit / gameplay value** | High for atmosphere/clouds (fills a real gap); zero risk to shipped ocean work | Cinematically striking in isolation, but disconnected from combat/travel/persistence by construction - a "look at the ocean" mode, not a played system | Would need every hydrology/weather consumer (combat referee, `waterBudget`, save/load) rebuilt against a system designed to have none of those |
| **Maintenance / fork risk** | Low: Aralia owns the TSL code outright once ported, no upstream dependency | Medium: a permanently-forked, never-upgraded snapshot of a solo-maintained (`Davi`/Token-Gremlin, CI badge present but single-author repo, created 2026-08-23) demoscene project sitting inside a WebGPU-first codebase | High: same fork risk, but now load-bearing for the primary ocean/weather system instead of an optional mode |
| **MIT attribution** | Attribution owed for the *techniques/derivation*, not verbatim code - see below | Attribution owed in the mode's own credits/about screen, MIT notice preserved per any copied file | Attribution owed project-wide; MIT permits it, but a whole-project rewrite this large functionally becomes new code carrying an old license notice for form's sake |
| **Verdict** | **Go**, staged (see below) | **No-go** - cost of a second renderer stack and a second quality/test system is not justified by "a nicer flythrough" when the game has no consumer for it yet | **No-go** - directly contradicts ADR 0002's determinism requirement and the in-flight WebGPU migration; would discard, not build on, `ocean-surface`'s shipped work |

## License and attribution obligations

MIT is permissive: copying, modifying, and redistributing is allowed provided
the copyright notice and permission text are preserved in copies or
substantial portions of the software. Concretely, if Option A proceeds:

- **No ABYSSAL source file should be copied verbatim into Aralia.** The
  recommended lift (atmosphere LUTs, clouds) is a from-scratch TSL
  re-derivation of a published rendering technique (Bruneton/Hillaire
  precomputed atmospheric scattering; Perlin-Worley volumetric clouds - both
  documented in the public graphics literature, not ABYSSAL-original), which
  needs no MIT notice because no ABYSSAL code ships.
- If any snippet of ABYSSAL GLSL is ever transcribed rather than re-derived
  (e.g. as a starting point before TSL conversion), the MIT notice and
  `Copyright (c) 2026 Davi (Token-Gremlin)` line must be carried in a comment
  at the point of use, and the derivation should be noted in Aralia's own
  attribution/credits surface if one exists (not verified as part of this
  evaluation - worth a quick check before any actual port work starts).
- The `BEAUFORT` table is public meteorological data (WMO Beaufort scale) -
  no attribution obligation either way, but re-typing it from the primary
  source rather than ABYSSAL's array keeps provenance clean.

## Staged recommendation and go/no-go gates

1. **Smallest useful POC (go/no-go gate 1):** re-derive the atmospheric
   scattering transmittance LUT alone, in TSL, as a standalone bake feeding
   Aralia's existing WebGPU probe scene - no ocean, no clouds, no weather
   state. Compare against the current baked-Lambert hemisphere+sun approach on
   the same probe pose. **Go** if it fixes the documented `LightsNode`
   workaround's flatness without a measurable frame-time regression on the
   probe's existing perf budget; **no-go** if the LUT bake cost or texture
   memory budget conflicts with the 64 m/25 cm fluid-bubble memory budget ADR
   0002 already spends (320 MB) on the same GPU.
2. **Gate 2, only after gate 1 lands:** add the raymarched cloud volume,
   sampling the same transmittance table, as an opt-in overlay behind a query
   flag on the WebGPU probe (mirroring the existing `?gpu=1` battle-map
   pattern) - not wired into gameplay yet. **Go** if it holds frame budget at
   `medium`-equivalent settings on the probe's real-GPU eyeball pass (RTX
   2070S, per the `webgpu-migration` topic's own existing verification
   hardware); **no-go** if cloud-shadow sampling can't be made cheap enough
   without ABYSSAL's own tiered tricks (weather-map-driven cell clustering)
   also being ported, which would grow the scope past "component lift."
3. **No gate 3 is proposed for ocean, foam, weather-state, or any disaster
   subsystem** - those are scored skip/reference-only above and should not
   proceed past this evaluation without a new task that first answers why
   Aralia's own shipped/active ocean and hydrology work is insufficient.

## Cross-file follow-ups (not edited by this task)

- `docs/projects/GLOBAL_GAPS.md` or the owning water/hydrology project's
  `GAPS.md` is the right home for a row noting: "no weather-system planmap
  topic exists; ABYSSAL evaluation (this doc) identifies atmospheric
  scattering + volumetric clouds as the one gap worth filling - needs a
  topic once someone picks up the staged POC." Left as a pointer here rather
  than added directly, per this task's scope boundary (durable findings go in
  this doc; new gap rows are a separate edit this task should not make
  unprompted).
- Whether Aralia already has a credits/attribution surface to extend for any
  future MIT-derived work was not verified - worth a quick check before the
  gate-1 POC starts, not before this evaluation.
