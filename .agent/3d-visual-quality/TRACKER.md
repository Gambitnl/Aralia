# 3D Visual Quality — Task Tracker

> Single source of truth for all visual quality tasks.
> Read `.agent/GOAL-3d-visual-quality.md` for full context and process rules.

## Status Key
- [ ] Not started
- [~] In progress
- [x] Complete
- [!] Blocked

## Baseline

**Date:** 2026-05-22
**Screenshot:** Forest biome, 1920x1080, 3D mode via BattleMapDemo
**Assessment:** Monochrome vertex-colored heightmap. Characters invisible (only nameplates visible). No grass visible. Trees are sub-pixel cone primitives. No shadows visible. Grid lines too prominent. No atmosphere/fog. SSAO broken. Camera too far.

## Phase 2 Assessment

**Date:** 2026-05-22
**Screenshot:** Forest biome, BattleMapDemo 3D mode after Phase 1 fixes
**Assessment:** Trees recognizable. Grass visible. Characters visible. Shadows working. Fog at edges. But: terrain is flat-colored (no texture grain), nameplates overlap illegibly, every tree identical, no ground scatter, no skybox, grass uniform, lighting flat, no particles visible, SSAO still broken.

---

## Phase 2.5 — Atmosphere Re-pass (2026-06-07, Claude)

**Verification pipeline (NEW — read this first):** `preview_screenshot` / the MCP
preview tools **cannot screenshot this 3D scene** — the preview tab runs
backgrounded (`document.hidden === true`), so the browser pauses
`requestAnimationFrame`; R3F never paints and both the screenshot tool and the
tool's internal "wait for a frame" hang (30s timeout). Logged as a gap.
Workaround built: **`.agent/3d-visual-quality/captures/shoot.mjs`** — a headless
Playwright script that boots the app, Dev Menu → Quick Start (auto party, needs
Ollama up, ~60-90s), jumps to the Battle Map Demo, toggles 3D, and writes a
clipped PNG per biome to `captures/`. Run: `node .agent/3d-visual-quality/captures/shoot.mjs <label> forest,cave,...`.
Use this for all before/after shots until the preview screenshot path is fixed.

**Honest finding — terrain is NOT untextured.** The Phase 2 assessment ("terrain
flat-colored, no texture grain") no longer matches the code. `TerrainMesh.tsx`
has a full procedural PBR shader (multi-scale FBM, voronoi cracks, per-type
palettes for grass/rock/dirt/sand/wall/floor, edge blending, normal
perturbation). The *perceived* flatness at tactical zoom was **atmospheric**:
heavy fog + dim ambient drowned the grain. Do not "add terrain textures" — they
exist. Tune fog/light/exposure and grass-vs-terrain coverage instead.

**Change made (forest biome):** `BIOME_LIGHTING.forest` in `BattleMap3D.tsx` —
`fogNear 12→22`, `fogFar 32→60`, `fogColor 0x6a7a5a→0x8fa07a`,
`ambientColor 0x203018→0x2c3a24`, `ambientIntensity 0.30→0.45`.
**Before/after:** `captures/baseline-forest.png` → `captures/after-atmo-forest.png`.
Result: battlefield reads clearly with depth; tree forms, hills, and grass/dirt
macro variation are now visible instead of a grey murk. Clear eye-test step up.

**Scope note:** forest only. Cave/dungeon are *intentionally* dark (atmosphere) —
do NOT blanket-brighten them. Desert (outdoor, bright) likely benefits from the
same fog push; swamp wants thick low fog by design. Evaluate per biome with the
capture script before changing each.

| # | Task | Priority | Status | Notes |
|---|------|----------|--------|-------|
| 33 | Forest atmosphere re-pass (fog back, ambient up) | P1 | [x] | Verified via baseline-forest.png → after-atmo-forest.png. |
| 34 | Desert atmosphere pass | P1 | [x] | Unblocked by the ground apron (task 37). Fog pushed back (near 14→24, far 35→70). baseline-desert.png → apron-desert.png: hard cliff into void gone, sand now extends to a soft horizon and the field reads clearly. |
| 37 | Ground apron for open biomes (fix edge-into-void) | P0 | [x] | Added a 260×260 biome-fog-colored plane at y=-0.15 around the map in `BattleMap3D.tsx`. Open biomes (desert) no longer end at a cliff over sky void; ground fades into fog. Forest regression-checked (apron-forest.png) — masked by trees, no harm. Closes gap #9. |
| 35 | Grass-vs-terrain coverage audit at tactical zoom | P2 | [ ] | Confirm grass layer isn't hiding the (already rich) terrain shader; tune blade density/height if so. |
| 36 | Per-biome capture sweep (cave/dungeon/swamp) | P1 | [x] | Swept all 5. Revealed the biome-detection bug (task 40). Post-fix: dungeon = moody columns, swamp = murky green, cave = dark+readable. Captures: biomefix-*.png, lit-cave.png, lit-swamp.png. |
| 40 | **Biome detection bug — all biomes rendered as forest** | P0 | [x] | ROOT CAUSE of "biomes all feel the same." `BattleMap3D` read `mapData.biome` (nonexistent) → always fell back to 'forest', so every biome used forest lighting/fog/sky/apron. Generator sets `mapData.theme`. Fixed to read `theme`. Now each biome uses its own preset. Single highest-impact change. baseline sweep-cave.png (green sky) → biomefix-cave.png (dark cave). Closes gap #5. |
| 41 | Cave + swamp readability tuning | P1 | [x] | Their presets were never exercised (always rendered as forest), so post-fix cave was unreadably dark. Cave: ambient 0.2→0.6, sun 0.3→0.5, fog 6/20→10/30. Swamp: ambient 0.25→0.42, sun 0.7→0.9, fog 8/22→12/34. lit-cave.png / lit-swamp.png: dark/murky mood kept, battlefield now readable. |
| 42 | Lighting drama — cave/dungeon point-light pools | P1 | [x] | Added 4 biome accent point-lights in SceneLighting: cyan crystal pools (cave), warm torch pools (dungeon), decay 2, ~y2.6 around map center. pools-cave.png / pools-dungeon.png: pooled light + darkness between + column shadows = underground drama (GOAL #54/#170). Closes gap #14. |
| 43 | Dungeon column scale (GOAL #48) | P2 | [x] | Investigated — already correct. ~7-unit pillars × 0.8-1.2 = ~2.4-3.7× character height = within the 3-4× target. gap #13's "towering" was camera framing. No change. |
| 44 | Unblock Tier-1 character assessment (test enemies in demo) | P0 | [x] | BattleMapDemo spawned no enemies (party-only), so team colors/spawn/nameplates couldn't be judged. Added dev-only `makeTestEnemies` (4 opponents, team='enemy', via createQuickCombatCharacter) when no real enemies + canUseDevTools. teams-forest.png now shows both teams. |
| 45 | Tier-1 readability findings | P1 | [x] | From teams-forest.png: **Team colors WORK** (enemies=red rings, players=green — clear friend/foe, GOAL #1). **Nameplates do NOT wall** (hover/active-only; the hook's #2 premise is already mitigated by task 15's BG3-style design, GOAL #18). Characters visible at tactical zoom. Remaining: class silhouettes read blobby (gap #15); spawn-spread needs an overview camera to verify (gap #16). |
| 46 | Boost always-on team ground rings | P1 | [x] | SelectionDecal idle ring was faint (opacity 0.40, thin). Thickened (0.42→0.60 inner/outer) + brightened (opacity 0.62, emissive 1.0) so EVERY unit shows a clear team circle, not just the selected one. rings-desert.png: bright amber/red team rings + golden turn beacon read cleanly in the open. GOAL #1 (team ID) / #9 (grounding). |
| 47 | Character scale → focal point (GOAL #3) | P1 | [x] | Model scale 3.2→3.7×; raised overhead HP pip (2.65→3.05) and nameplate (3.0→3.5) to clear the taller model. scale2-desert.png: characters now read as prominent humanoid figures (focal point) vs dwarfed blobs, well-proportioned to terrain. Fine class-silhouette distinction still residual (gap #15). |
| 48 | Overview-capture mode (shoot.mjs OVERVIEW=1) | P1 | [x] | Wheel-zoom-out drives OrbitControls to a wide tactical view (R3F camera not externally poseable). overview2-forest.png is the best eye-test shot so far (full atmospheric forest battlefield). Unblocked spawn-spread assessment → gap #18 (intra-team clumping). Resolved the overview half of gap #16. |
| 38 | Sky/horizon seam | P2 | [x] | Set SkyDome `horizon` = fog color for all biomes (forest #8fa07a, cave #0a0a1a, dungeon #1a1520, swamp #2a3020; desert already matched) so the fogged ground apron blends into the sky with no seam. Verified across the biome sweep. Closes gap #11. |
| 39 | Capture pipeline: offline save injection | P0 | [x] | Quick Start AI party-gen is structurally slow (installed Ollama models are 8-26b → 90s timeouts). Switched shoot.mjs to inject the real autosave via storageState (save-bridge.mjs posts the preview tab's localStorage to disk → Playwright loads it → "Continue Journey"). Captures now ~30s, fully offline. |
| 49 | **World context — distant-terrain ridge band (kill "floating slab")** | P1 | [x] | The map read as a detailed slab floating in fog: nothing sat between the battlefield edge and the horizon (flat apron → fog → sky). Added `terrain/DistantTerrain.tsx` — a procedurally-displaced ridge band (annulus, layered value-noise, vertex-colored, fogged, no shadows, ~8k tris) ringing the map: rolling hills (forest), dunes/mesas (desert), low murky ridges (swamp), tall dark cavern-wall ring (cave/dungeon). Also recentered+enlarged SkyDome (r45→140, object-space gradient) and pushed camera far 100→220 so the band/dome aren't clipped. **A/B at a new deterministic horizon pose:** forest = strong win (`horizon-before-forest.png` trees→empty sky vs `horizon-after-forest.png` forested hills to the horizon); desert = real win (`horizon-before-desert.png` tan void vs `horizon-after-desert.png` dune relief). Swamp/cave/dungeon mood preserved (`horizon-after-{swamp,cave,dungeon}.png`). Desert mesas still subtle → gap #23. |
| 50 | Verification: deterministic camera-pose hook | P1 | [x] | The capture rig could only dolly (wheel) — never tilt — so it could never frame the horizon, which is *why* silhouette/world-context work was unverifiable (gap #15 parking note). Added a dev-only `window.__bm3dCam.pose(distance, polarDeg, azimuthDeg)` hook in `CameraController.tsx` (no-op in prod) + `POSE="d,p,a"` support in `shoot.mjs`. Now any tactical/horizon framing is reproducible. Unblocks the deterministic-rig prerequisite for future creature/silhouette work. |
| 51 | **Race-driven character visuals (GOAL #6 — "no racial diversity")** | P1 | [x] | Every character was the same box-humanoid w/ fixed skin `0xd4a57b`, differentiated only by class archetype + team color. Now `createPlayerCombatCharacter` carries race via `creatureTypes:['Humanoid', race.name]`, and `CharacterActor.getRaceVisual()` maps race → skin tone + height/build proportions + a cheap silhouette cue (dwarf beard, tiefling horns). Team color still owns the armor/ring (friend/foe preserved); race only touches exposed skin + build. **Before/after:** lineup-before-forest.png (6 identical gold figures) → lineup-after-forest.png + lineup-after-clear-desert.png (short stocky dwarf vs tall slim elf vs broad orc, varied skin). Closes GOAL #6. Residual: armor still dominates the torso so race reads subtly at far tactical zoom → gap #24. Enemy *creature* identity (goblin/skeleton/ogre models) is the next slice → gap #25. |
| 52 | Verification: dev race-lineup harness + team-framing pose | P1 | [x] | Built the "deterministic creature rig" gap #15 said was missing: `BattleMapDemo.makeRaceLineup` (dev-only, `window.__BM3D_RACE_LINEUP`, one fighter per curated race) + `window.__bm3dCam.poseTeam(team,…)` to frame a team's centroid + `LINEUP=`/`POSETEAM=` in `shoot.mjs`. Lets race/creature model work be judged side by side deterministically. |
| 53 | **Enemy creature visuals — size + creature forms** | P1 | [x] | Third focus of the directive ("aesthetics of enemies"). `CharacterActor` now: (a) scales the whole model by `stats.size` (Large 1.55× / Huge 2.15× / Gargantuan 2.9×) so big creatures physically tower; (b) `getRaceVisual` reads the **whole** `creatureTypes` array + name and adds non-humanoid forms — Undead (bone-pale, gaunt build 0.72), Beast (low 0.66 / broad 1.22, furred brown), plus ogre/troll under the giant branch. **Before/after:** creatures-before-desert.png (identical uniform-size red humanoids) → creatures-after-desert.png (Ogre towers; gaunt skeleton, low beast, small green goblin). `tsc` clean. Strongest readable win = size; form skin/build is subtler under the red armor at far zoom (gap #24). True non-humanoid body plans (quadruped/dragon/ooze) not yet modeled → gap #25 narrowed. |
| 54 | Verification: dev creature-lineup harness | P1 | [x] | `BattleMapDemo.makeCreatureLineup` (dev-only, `window.__BM3D_CREATURE_LINEUP`) fabricates goblin/skeleton/dire-wolf/orc/ogre enemies by overriding `creatureTypes`/`size`/name on humanoid bases + `CREATURELINEUP=` in `shoot.mjs`. Verifies creature-form + size visuals deterministically; pairs with `poseTeam("enemy",…)`. |
| 55 | Beast quadruped body plan | P1 | [x] | First true non-humanoid body plan (gap #25): added `RaceVisual.form` and a `BeastModel` quadruped (body/haunches/head/snout/ears/4 legs/tail). Beasts now render four-legged instead of low humanoids. Body keeps team color (friend/foe intact); head/legs/tail use fur tone. **Before/after:** creatures-after-desert.png (beast = low humanoid) → creatures-quad-desert.png (low horizontal quadruped beside upright humanoids + towering ogre). `tsc` clean. Remaining body plans (dragon/ooze) still open in gap #25. |
| 56 | Winged-dragon body plan | P1 | [x] | Added `form: 'dragon'` + a `DragonModel` (body, angled neck, horned head + snout, idle-flapping team-colored wings, 4 legs, long tapering tail); dragon detection guards against the `dragonborn` humanoid race. Pair with `size:'Huge'` to loom. Added a `Red Dragon` to the creature lineup. **Proof:** creatures-dragon-desert.png — a large red winged dragon distinct from the upright humanoids, quadruped wolf, and ogre. `tsc` clean. Gap #25 now only ooze/aberration. |

---

## Phase 1 Tasks (Complete)

| # | Task | Priority | Status | Notes |
|---|------|----------|--------|-------|
| 1 | Terrain textures (PBR tiling) | P0 | [ ] | **Carried forward to Phase 2 Tier 1.** TerrainMesh.tsx uses `meshStandardMaterial vertexColors` — zero textures. |
| 2 | Character visibility | P0 | [x] | Scaled to 2.5x. Emissive added. Visible humanoid shapes. |
| 3 | Grass layer debug | P0 | [x] | useMemo→useEffect ref timing fix. 40 blades/tile, natural green. |
| 4 | Tree/decoration quality | P0 | [x] | Multi-sphere canopy trees, organic boulders, saguaro cacti, mangrove roots. Also fixed useMemo→useEffect in InstancedPropMesh. |
| 5 | Shadow system | P1 | [x] | Shadow camera centered on map, directional light target via useEffect, shadow-bias. |
| 6 | SSAO fix | P1 | [!] | **Carried forward to Phase 2 Tier 3.** enableNormalPass present but errors persist. Version incompatibility suspected. |
| 7 | Camera closer | P1 | [x] | Offset (+5,7,+5), minDistance=5, maxDistance=20. |
| 8 | Fog/atmosphere | P1 | [x] | Tightened fog distances all biomes. Visible at edges. |
| 9 | Grid refinement | P2 | [x] | Line width 0.02, base opacity 0.12, mode-gated visibility. |
| 10 | Ground scatter | P2 | [ ] | **Carried forward to Phase 2 Tier 2.** |
| 11 | Decoration variety | P2 | [ ] | **Carried forward to Phase 2 Tier 3.** |
| 12 | Grass blade color contrast | P0 | [x] | Fixed with Task #3. Dark-to-medium green gradient. |
| 13 | Character model scale consistency | P0 | [ ] | **Carried forward to Phase 2 Tier 4.** |

---

## Phase 2 Tasks

### Tier 1 — Prototype killers

| # | Task | Priority | Status | Detail File | Notes |
|---|------|----------|--------|-------------|-------|
| 14 | Terrain PBR textures | P0 | [x] | | Replaced vertexColors with onBeforeCompile GLSL procedural texturing. 7 terrain types (grass/rock/dirt/sand/water/wall/floor) with FBM noise, voronoi cracks, edge blending, normal perturbation. |
| 15 | Nameplate overlap fix | P0 | [x] | | BG3-style: full nameplate on hover/selection/turn only. Minimal 3D HP pip (colored sphere) shown by default. Eliminates text wall. |
| 16 | Tree variety (2-3 species) | P0 | [x] | | 4 tree variants: oak (40%), pine/conifer (25%), wide/flat (25%), dead/bare (10%). Weighted random selection per instance via separate seed. |

### Tier 2 — Expected but missing

| # | Task | Priority | Status | Detail File | Notes |
|---|------|----------|--------|-------------|-------|
| 17 | Ground scatter objects | P1 | [x] | | GroundScatter.tsx: instanced pebbles, leaves, twigs, mushrooms. 4-8 per open grass tile, weighted random. ~3000-5000 instances in 4 draw calls. |
| 18 | Skybox / background | P1 | [x] | | SkyDome component: gradient shader (top→horizon→bottom) per biome. BackSide sphere, renderOrder -1. |
| 19 | Grass height/color variation | P1 | [x] | | Per-instance tint via instanceTint attribute. Cluster noise for height patches. Bare spots (40% blades) near rock/wall/water tiles. Warm-cool green tint variation. |

### Tier 3 — Makes it feel alive

| # | Task | Priority | Status | Detail File | Notes |
|---|------|----------|--------|-------------|-------|
| 20 | Lighting drama | P1 | [x] | | Sun 1.6→2.2, ambient 0.4→0.3. Warm sun (0xffe0a0) + cool fill (0x6080c0) for temperature split. |
| 21 | Visible ambient particles | P1 | [x] | | All biomes: particle size 3-4x larger, counts increased, opacity boosted. Firefly glow sphere 0.02→0.06, point light distance 2.5→4, intensity flicker range doubled. Dungeon now has torch ember fireflies. |
| 22 | Contact AO (SSAO or fake) | P1 | [x] | | drei ContactShadows component: opacity 0.4, blur 2, resolution 512. Soft ground darkening under all objects. |
| 23 | Decoration variety | P2 | [x] | | 3 new types: fallen logs, tree stumps, bushes. Added to BattleMapDecoration type + map generator. Bushes/stumps provide cover without blocking movement. |

### Tier 4 — Polish

| # | Task | Priority | Status | Detail File | Notes |
|---|------|----------|--------|-------------|-------|
| 24 | CombatView 3D mode broken | P1 | [!] | | R3F Canvas silently fails in CombatView ErrorBoundary. Only works via BattleMapDemo. Spawned as separate task for debugging. |
| 25 | Character/decal scale ratio | P2 | [x] | | Selection ring 0.28-0.35→0.42-0.48, turn ring 0.36-0.44→0.50-0.60. Rings now properly encompass 2.5x-scaled character body. |

---

## Phase 3 Tasks

### Tier 1 — P0 (Breaks the illusion)

| # | Task | Priority | Status | Notes |
|---|------|----------|--------|-------|
| 26 | Class-based character models | P0 | [x] | 3 archetypes: fighter (armor+sword+shield), caster (robes+staff+wizard hat), rogue (leather+hood+dual daggers). getArchetype() maps class name to visual loadout. |
| 27 | Reduce grass height | P0 | [x] | BLADE_HEIGHT_MAX 0.50→0.25, MIN 0.15→0.08. Ankle-to-shin height. GrassLayer.tsx. |

### Tier 2 — P1 (Hurts polish)

| # | Task | Priority | Status | Notes |
|---|------|----------|--------|-------|
| 28 | Character facing direction | P1 | [x] | atan2 toward nearest living enemy. Seeded hash fallback for no-enemy case. Rotation applied to character model group. |
| 29 | Reduce stump/log scale | P1 | [x] | Fallen log: radius 0.12→0.07, length 1.0→0.6. Stump: radius 0.14→0.08, height 0.25→0.15. ~40% size reduction. |
| 30 | Enlarge HP pip spheres | P1 | [x] | Sphere 0.06→0.12 radius. Added team-colored ring (0.14-0.18 radius) around pip. Visible at tactical zoom. |

### Tier 3 — P2 (Nice to have)

| # | Task | Priority | Status | Notes |
|---|------|----------|--------|-------|
| 31 | Debug terrain elevation | P2 | [x] | Generator noise scale x/15→x/8, elevation formula `round(rawElev*2.5+1.0)` for range 0-3. Characters now use `tileElevation * ELEVATION_SCALE` for Y position. |
| 32 | Reduce character emissive | P2 | [x] | All 3 archetype torsos: emissiveIntensity 0.15→0.05. Skin has zero emissive (was already 0). |

---

## Progress Log

| Date | Task # | Action | Result |
|------|--------|--------|--------|
| 2026-05-22 | — | Initial audit + baseline screenshot | Tracker created. 13 tasks identified. |
| 2026-05-22 | 2, 7 | Camera closer + character scale up | Camera offset (+5,7,+5). Characters 2.5x, emissive. |
| 2026-05-22 | 3, 12 | Grass layer fix + color tuning | useMemo→useEffect. Green palette. Grass visible. |
| 2026-05-22 | 4 | Tree/decoration overhaul | Multi-sphere canopy, organic boulders, saguaro cacti. useMemo→useEffect fix in InstancedPropMesh. |
| 2026-05-22 | 5 | Shadow system fix | Light positioned relative to map center, target via useEffect, shadow-bias. |
| 2026-05-22 | 8 | Fog tightening | All biome fog distances reduced. Visible at map edges. |
| 2026-05-22 | 9 | Grid refinement | Width/opacity reduced, mode-gated. |
| 2026-05-22 | — | Phase 2 critical assessment | 12 new tasks identified. Terrain textures, nameplate overlap, tree variety are top priority. |
| 2026-05-22 | 14 | Procedural terrain texturing | Replaced flat vertexColors with GLSL procedural noise (FBM, voronoi). 7 terrain types with distinct patterns. Edge blending + normal perturbation. |
| 2026-05-22 | 16 | Tree variety | 4 species: oak, pine, wide/flat, dead/bare. Weighted random per instance. Visually distinct silhouettes. |
| 2026-05-22 | 15 | Nameplate overlap fix | Hover-only full nameplates. Minimal HP pip spheres for non-selected chars. Scene much cleaner. |
| 2026-05-22 | 18,20,22 | Skybox, lighting, contact AO | SkyDome gradient shader. Sun 2.2 warm + cool fill. drei ContactShadows for ground AO. |
| 2026-05-22 | 21 | Ambient particle visibility | All biomes: larger particles (3-4x), more count, brighter. Firefly glow spheres enlarged, point lights stronger + wider range. Dungeon gets torch ember fireflies. |
| 2026-05-22 | 19 | Grass height/color variation | Per-instance tint attribute (warm→cool green). Cluster noise height patches. Bare spots near rocks/walls. Height range widened (0.15-0.50). |
| 2026-05-22 | 17,23 | Ground scatter + decoration variety | GroundScatter.tsx: pebbles, leaves, twigs, mushrooms on open tiles. DecorationProps: fallen logs, stumps, bushes. Map generator updated for forest/swamp biomes. |
| 2026-05-22 | 25 | Character/decal scale fix | Selection ring 0.42-0.48, turn ring 0.50-0.60. Arrows orbit at 0.58. Proportions match 2.5x character body. |
| 2026-05-22 | — | Phase 3 critical review | 7 issues identified. Goal updated. Phase 3 tasks added. |
| 2026-05-22 | 26,27 | Class-based chars + grass height | 3 archetypes (fighter/caster/rogue) with distinct silhouettes. Grass MAX 0.50→0.25. |
| 2026-05-22 | 28,30 | Facing + HP pip | Characters face nearest enemy via atan2. HP pip 0.06→0.12 + team ring. |
| 2026-05-22 | 29 | Stump/log scale | ~40% size reduction for fallen logs and stumps. |
| 2026-05-22 | 31,32 | Elevation + emissive | Generator elevation range 0-3, chars sit at tile elevation. emissiveIntensity 0.15→0.05. |
| 2026-06-07 | — | Built headless capture pipeline | preview_screenshot hangs (backgrounded tab pauses rAF). Wrote captures/shoot.mjs (Playwright) for deterministic per-biome PNGs. Logged tooling gap #6. |
| 2026-06-07 | 33 | Forest atmosphere re-pass | Fog pushed back (near 12→22, far 32→60), ambient lifted (0.30→0.45). baseline-forest.png → after-atmo-forest.png: murk gone, terrain/tree depth readable. Found terrain shader already rich — flatness was atmospheric, not missing textures. |
| 2026-06-07 | 34 | Desert: rejected fog push | baseline-desert.png shows hard map-edge → blue void; current fog partly hides it. Pushing fog back would regress. Logged gap #9 (edge concealment). Per-biome verification prevented a regression. Also spotted stray flagstone/floor-type patch on open sand → gap #10. |
| 2026-06-07 | 37,34 | Ground apron + desert fog | Added biome-colored ground apron (260×260 @ y=-0.15). apron-desert.png: cliff-into-void gone, sand extends to horizon; desert fog then pushed back (far 35→70). apron-forest.png: no regression. Closed gap #9; opened gap #11 (sky/horizon seam). |
| 2026-06-07 | 39 | Offline capture pipeline | Ollama models too large (90s timeouts) → Quick Start unreliable. Built save-bridge.mjs to ferry the preview tab's autosave into Playwright storageState; shoot.mjs now clicks "Continue Journey". Captures ~30s, offline, deterministic. Added screenshot retry (intermittent page.screenshot hang on heavy WebGL frame). |
| 2026-06-07 | 38 | Forest sky-horizon blend | SkyDome forest horizon set to fog color (#8fa07a). sky-forest.png: apron→horizon→sky seam gone, warm-haze horizon, trees silhouetted — genuine atmosphere. Dark biomes deferred to per-biome sweep. |
| 2026-06-07 | 40 | **Biome detection fix (big one)** | BattleMap3D read `mapData.biome` (undefined) → every biome rendered as forest. Switched to `mapData.theme`. Now all 5 biomes use their own lighting/fog/sky/apron. sweep-cave.png (green sky) → biomefix-cave.png (dark cave), biomefix-dungeon.png (columns), biomefix-swamp.png (murky green). Closed gap #5. |
| 2026-06-07 | 38,41 | Dark-biome sky + readability | SkyDome horizon=fog for cave/dungeon/swamp (seamless apron). Cave/swamp ambient+sun+fog lifted (presets never exercised pre-fix). lit-cave.png / lit-swamp.png: dark mood kept, battlefield readable. All 5 biomes now visually distinct + thematically correct. |
| 2026-06-07 | 42,43 | Cave/dungeon light pools | Added cyan crystal (cave) + warm torch (dungeon) accent point-lights → pooled drama. pools-cave.png / pools-dungeon.png. Verified dungeon columns already at 3-4× target (gap #13 was framing, no change). |
| 2026-06-07 | 44,45 | Tier-1 unblocked (test enemies) | Added dev-only test enemies to BattleMapDemo so both teams render. teams-forest.png: team colors work (red enemy/green player), nameplates are hover-only (no text wall — hook #2 already handled). Opened gap #15 (blobby silhouettes), #16 (verify spawn spread w/ overview cam). |
| 2026-06-07 | 46 | Team ground-ring boost | Brightened/thickened the always-on SelectionDecal idle ring so every unit has a readable team circle. rings-desert.png (open, both shown): clear amber/red rings + golden turn beacon. Forest shot occluded by canopy (camera snap-to-active under trees) — noted under gap #16. |
| 2026-06-07 | 47 | Character scale up (focal point) | Model 3.2→3.7×, overhead pip/nameplate raised to match. scale2-desert.png: characters now prominent humanoid figures, well-proportioned. (One capture missed framing — camera seed-random; gap #16 overview-cam would make character verification deterministic.) |
| 2026-06-07 | gaps | Verify-before-fix: terrain-gen "bugs" debunked | Code-checked suspected gaps: #10 (desert flagstone) = `rock` outcrops, legit. #12 (cave/dungeon grass) = the green valid-move GridOverlay, not grass (GrassLayer/GroundScatter exclude wall/floor). GOAL #50 (cacti-in-swamp) already fixed (swamp=mangroves). Corrected gaps; made no code changes to correct code. |
| 2026-06-07 | 48 | Overview-capture mode | shoot.mjs `OVERVIEW=1` dispatches wheel-zoom-out to pull OrbitControls back to a wide tactical view. overview2-forest.png = strong eye-test shot (whole atmospheric forest battlefield; tree variety confirmed). overview-desert.png used to assess spawn: teams split sides but members clump (opened gap #18). `__r3f` not externally accessible (camera can't be force-posed); wheel events work. maxDistance is 35. |
| 2026-06-08 | eye-test re-baseline | Fresh tactical-overview captures (`eyetest-forest.png`, `eyetest-desert.png`) | Current state passes the basic eye test — both biomes read as a credible 3D game (atmosphere, fog→horizon blend, tree variety, terrain grain, characters w/ team rings + gold turn beacon). The GOAL/reminder premise ("flat terrain, no grain, identical trees") is stale — those P0s (tasks 14/15/16) are done. New residual detractor logged: open-biome map edge still shows a hard vertical step into the apron when perimeter tiles are elevated (gap #19). Remaining polish gaps: #15 silhouettes, #16 foliage occlusion, #18 spawn spread, #19 edge cliff. No code changed (per "record, don't impulsively fix"). |
| 2026-06-08 | 16 — Foliage occlusion fade (DONE) | `EzTreeLayer.tsx` leaf material `onBeforeCompile` | Implemented a BG3-style camera-proximity canopy fade: leaf `diffuseColor.a *= smoothstep(2.5, 7.0, -mvPosition.z)`, so foliage near the camera fades and stops walling off characters at the snap-to-active angle; distant forest stays opaque. GPU-only, instancing-safe. **Before:** occl-before-forest.png (characters buried in dark canopy). **Proof:** deterministic same-seed fade-far.png (foliage opaque at distance) vs fade-near.png (near canopy gone, character fully readable). Verification harness: `captures/fade-check.mjs`. Closed gap #16. Spotted + logged gap #20 (EzTreeLayer biome detection bug) while in the file — not fixed (out of scope). |
| 2026-06-08 | Gap reconciliation (#18, #20) | `useBattleMapGeneration.ts`, `EzTreeLayer.tsx`, `battleMapGenerator.ts` | Verified-before-acting (code ahead of gap docs, recurring pattern): **#18 spawn clumping is already RESOLVED** — `getSpawnTiles.spreadTiles` enforces `MIN_SEP=2`; eyetest-desert.png confirms a spaced formation. **#20 EzTreeLayer biome bug is INERT** — `placeObstacles` only emits `decoration==='tree'` for forest, so EzTreeLayer never runs in other biomes (their props come from DecorationProps); the non-forest BIOME_TREES configs are dead code. No code changed for either. Genuinely-open visual gaps now: **#15 (class silhouettes), #19 (open-biome edge cliff)** — both non-trivial. |
| 2026-06-08 | 19 — Biome-tinted terrain skirt (DONE) | `TerrainMesh.tsx` skirtMaterial | Root-caused #19: terrain already has a solid perimeter skirt (`buildSkirtGeometry`, panels to y=-1.0 + cap) — it's a solid mesa, not a floating sheet (my earlier read was wrong). Real residual = uniform near-black skirt color looked like a void band under desert sand. Fixed by tinting the skirt per biome (desert sandstone, cave/dungeon stone-grey, forest/swamp loam/peat). Before/after: edge-before-desert.png → edge-after-desert.png. Low-risk (material color only); no regression. Closed gap #19. |
| 2026-06-08 | Final eye-test sweep (5 biomes) | captures eyetest-forest/desert, finaleye-cave/dungeon/swamp | **Verdict: passes** at the gameplay framing. Forest/desert/swamp read as credible 3D scenes at overview; cave/dungeon read fine at the close combat camera (per prior lit-cave/pools-dungeon) but go near-black at overview max-zoom → logged gap #21 (dark-biome overview readability, low priority). Cave/dungeon close re-captures were **blocked** by a concurrent World3DScene.tsx breakage crashing the capture entry path (transient, not a battle-map issue). Only code change this session: #16 foliage fade. |
| 2026-06-09 | 50 — Deterministic camera-pose hook | `CameraController.tsx`, `captures/shoot.mjs` | Root insight while verifying world-context: OVERVIEW is too top-down to read a horizon, and snap-to-active is too close/occluded — the rig had no way to tilt the camera. Added dev-only `window.__bm3dCam.pose(dist,polarDeg,azimuthDeg)` (no-op in prod) + `POSE=` in shoot.mjs. `POSE="33,74,35"` gives a low (~14° above horizon) tactical shot. This is the deterministic-framing tool gaps #15/#16 said was missing. |
| 2026-06-09 | 49 — Distant-terrain ridge band | `terrain/DistantTerrain.tsx` (new), `BattleMap3D.tsx`, `terrain/index.ts` | Added a procedural ridge band ringing the map + recentered/enlarged SkyDome + camera far 100→220. Clean A/B isolated via `git stash` of the world-context edits (pose hook kept) so before/after share the identical pose. **Forest:** before = trees end at a hard edge into empty sky; after = forested hills recede into fog to the horizon (strong win). **Desert:** before = tan void; after = dune relief to the horizon (win; mesas subtle → gap #23). Swamp/cave/dungeon: terrain extends back, dark/murky/enclosed mood preserved (horizon-after-{swamp,cave,dungeon}.png). Added geometry is trivial (~8k+2.3k tris); no observed render regression. Intermittent React "max update depth" warning seen on slow-mount runs only → gap #22 (non-blocking, rendering unaffected). |
| 2026-06-09 | 49b — Desert mesa refinement (closes gap #23) | `terrain/DistantTerrain.tsx` desert profile | Desert-only follow-up: added a `mesa` flag (amp 10→15, freq 0.05→0.034, rise 0.28→0.24, inner 34→36) + flat-top shaping so distant landforms read as buttes/mesas, not gentle dunes. **Before/after:** horizon-after-desert.png → horizon-mesa-desert.png (distinct flat-topped mesas on the horizon). Other biomes untouched (they use the unchanged rolling-hill branch). Closed gap #23. |
| 2026-06-09 | 52 — Race-lineup verification rig | `BattleMapDemo.tsx`, `CameraController.tsx`, `captures/shoot.mjs` | Second focus of the directive ("different choosable races") needed a deterministic way to compare race models — the rig gap #15 flagged as missing. Added dev-only race lineup (`LINEUP=1` → one fighter per curated race) + `poseTeam` centroid framing (`POSETEAM="player,d,p,a"`). lineup-before-forest.png confirmed the baseline (6 identical figures). |
| 2026-06-09 | 51 — Race-driven character visuals (closes GOAL #6) | `combatUtils.ts`, `CharacterActor.tsx` | Threaded race onto the combat character (`creatureTypes:['Humanoid', race.name]`) and added `getRaceVisual()` → per-race skin tone + height/build scale + beard(dwarf)/horns(tiefling) cues, applied to the model group scale + `HumanoidModel`. **Before/after:** lineup-before-forest.png (identical) → lineup-after-forest.png / lineup-after-clear-desert.png (clear short-stocky-dwarf vs tall-slim-elf vs broad-orc + skin variation). Team color unchanged (friend/foe intact). `tsc` clean on all touched files. Residual logged: gap #24 (armor dominates torso → race subtle at far zoom), gap #25 (enemy creature models = next slice). |
| 2026-06-09 | 53/54 — Enemy creature visuals + creature-lineup rig | `CharacterActor.tsx`, `BattleMapDemo.tsx`, `captures/shoot.mjs` | Final directive focus ("aesthetics of enemies"). Added `stats.size` → model scale (Large/Huge/Gargantuan tower) and Undead/Beast forms (+ogre/troll) in `getRaceVisual` (now reads the whole creatureTypes array). Built a dev creature lineup (`CREATURELINEUP=1`) to verify. **Before/after:** creatures-before-desert.png (uniform red humanoids) → creatures-after-desert.png (towering ogre + gaunt skeleton + low beast + small goblin). `tsc` clean. Narrowed gap #25 (true non-humanoid body plans still a follow-up). |
| 2026-06-09 | Test fix — terrain mock | `BattleMap3D.parity.test.tsx`, `BattleMap3D.visibility.test.tsx` | Running the suites after the changes caught a regression: both tests `vi.mock('../terrain', …)` and the mock lacked the new `DistantTerrain` export → "No DistantTerrain export is defined on the mock". Added `DistantTerrain: () => null` to both mocks. Re-ran: both files green (2/2), and combatUtils tests unaffected (10/10). Confirms the `creatureTypes` addition to `createPlayerCombatCharacter` didn't break combat tests. |
