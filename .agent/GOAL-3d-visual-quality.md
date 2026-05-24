# GOAL: 3D Combat Map — Visual Quality

## The Standard

The 3D combat map must look like a game someone would choose to play in 3D over 2D. Not "impressive for procedural geometry." Not "good for a side project." The bar is: a player sees the 3D view for the first time and says "oh wow" — then never switches back to 2D.

If it looks like a tech demo, it's not done. If you have to zoom in to appreciate it, it's not done. If you can't tell who's who at tactical zoom, it's not done.

**Reference standard:** Baldur's Gate 3's tactical combat camera. We won't match Larian's art budget, but we must match the *readability* — you should be able to glance at the battlefield and instantly know: where's my party, who's the enemy, what's the terrain, where's the cover.

## The Test

Every change gets evaluated at **tactical zoom** (the default camera distance where you'd actually play the game — roughly 15-20 units out). Not close-up beauty shots. Not debug camera angles. The real play distance.

A change that looks good at close range but invisible at play distance is **not progress**.

### Pass/Fail Criteria

Take a screenshot at default tactical zoom. All of the following must be true simultaneously:

- [ ] **Team identification in under 1 second.** A first-time viewer can point to "the player team" and "the enemy team" without any UI — purely from the 3D scene. Warm team colors vs hostile team colors, not identical blue-gray shapes.
- [ ] **Class silhouette recognition.** You can tell the fighter from the caster from the rogue by body shape alone at tactical zoom. If they all look like pawns, fail.
- [ ] **Active character is obvious.** The character whose turn it is has a visible, unmissable indicator — not a subtle ring that vanishes at distance.
- [ ] **HP status readable without hovering.** You can assess "that character is hurt" vs "that character is healthy" from the tactical view.
- [ ] **Terrain reads as environment, not noise.** The ground looks like grass/dirt/stone — not procedural smear. A non-technical person would say "that's a forest floor," not "that's a green texture."
- [ ] **Trees look like trees.** Not sphere-on-cylinder placeholders. Organic silhouettes with visible foliage detail. They don't all need to be different, but they can't look like geometric primitives.
- [ ] **Each biome is visually distinct and thematically correct.** A swamp looks like a swamp (murky water, dead trees, hanging moss) — not a desert with different fog. A cave looks underground, not like a flat plain with rocks.
- [ ] **Water has depth.** Transparency, movement, or reflections — something that reads as liquid, not painted floor.
- [ ] **Characters use the full battlefield.** Spawn positions spread across the map. The 40×30 map should feel like a real battlefield, not a crowd in a corner.
- [ ] **The scene has atmosphere.** At tactical zoom you can feel mood — light filtering through trees, torchlight in dungeons, heat haze in deserts. Not uniform flat illumination.

**Fail any one of these = not done.** Don't ship a "mostly done" state. The quality bar is the whole list.

## Current State (Honest Assessment)

As of 2026-05-24. Evaluated at tactical zoom (default camera distance).

### Character Readability

| # | Criterion | Status | Problem |
|---|-----------|--------|---------|
| 1 | Team color distinction | **FAIL** | Both teams identical blue-gray. No warm/cold split. A new player cannot tell friend from foe. |
| 2 | Class silhouette at tactical zoom | **FAIL** | All characters look like same-size pawns at play distance. Fighter/caster/rogue distinction invisible. |
| 3 | Character scale vs terrain | **FAIL** | Characters are dwarfed by trees and terrain. They should be the focal point but they're visual afterthoughts. |
| 4 | Weapon/equipment visibility | **FAIL** | Swords, staffs, daggers not visible at tactical zoom. Only matter if you zoom to close-up. |
| 5 | Shield/armor distinction | **FAIL** | Fighter armor vs rogue leather vs caster robes — all read as the same shape at distance. |
| 6 | Character skin tone variation | **FAIL** | Every character has the same gray-blue skin. No racial/skin diversity. |
| 7 | Character outline or rim light | **FAIL** | No edge highlighting. Characters blend into terrain. BG3 has subtle rim lighting on characters to pop them out. |
| 8 | Idle pose variety | **FAIL** | Every character stands in identical T-pose-adjacent stance. No personality in how they hold themselves. |
| 9 | Facing direction readability | **PARTIAL** | Characters face nearest enemy (implemented) but you can't tell which direction they face at tactical zoom because they're too small and all look the same from every angle. |
| 10 | Character grounding | **PARTIAL** | Characters sit at tile elevation, but feet may clip into grass or float above uneven terrain edges. |

### Character Indicators

| # | Criterion | Status | Problem |
|---|-----------|--------|---------|
| 11 | Active turn indicator | **FAIL** | Golden ring exists but invisible at tactical zoom. Needs to be a beacon, not a subtle decal. |
| 12 | Selection ring visibility | **FAIL** | Selection ring scaled to 0.42-0.48 — only visible when zoomed in close. |
| 13 | HP pip/bar at distance | **FAIL** | HP sphere is 0.12 radius. Invisible at 15+ units. No health information readable at play distance. |
| 14 | Targeting indicators | **PARTIAL** | Valid target set exists but red rings on enemies are same-invisible-at-distance problem. |
| 15 | AoE preview readability | **PARTIAL** | AoE preview tiles exist but untested at tactical zoom. Likely too subtle. |
| 16 | Damage number visibility | **PARTIAL** | Floating damage numbers exist but may be too small or fast to catch at distance. |
| 17 | Movement range highlight | **PARTIAL** | Grid overlay appears in move mode. Visibility untested at tactical zoom — may be too subtle against terrain. |
| 18 | Nameplate readability | **PARTIAL** | Hover-only nameplates work close-up. At tactical zoom, you'd need to hover tiny invisible shapes. |
| 19 | Status effect indicators | **FAIL** | No visual indicators for buffs, debuffs, conditions, or status effects on character models. |
| 20 | Death/unconscious visual | **FAIL** | No visual death state. Dead characters presumably just vanish or stand there. No ragdoll, no fade, no X marker. |

### Terrain

| # | Criterion | Status | Problem |
|---|-----------|--------|---------|
| 21 | Ground texture natural feel | **PARTIAL** | Procedural GLSL noise gives variation but reads as "math" not "nature." No visible grass tufts, dirt patches, or stone outcrops at macro scale. |
| 22 | Elevation readability | **PARTIAL** | Hills exist (elevation 0-3) but gentle. Hard to tell where high ground advantage exists without grid overlay. |
| 23 | Terrain type transitions | **PARTIAL** | Edge blending exists in shader but transitions between grass/rock/dirt are smooth gradients. Natural terrain has sharper edges — rock doesn't gradient into grass over 3 tiles. |
| 24 | Ground scatter integration | **PARTIAL** | Pebbles/leaves/twigs exist but may float above or sink into terrain on elevation changes. |
| 25 | Terrain shadow reception | **OK** | ContactShadows provides ground darkening under objects. Directional shadow map covers the map. |
| 26 | Texture tiling/repetition | **PARTIAL** | Procedural noise avoids exact tiling but the noise frequency creates uniform "speckle" that's its own kind of repetition — everything looks the same at every point. |
| 27 | Macro-scale color variation | **FAIL** | No large-scale patches of different ground cover. The entire forest floor is the same green-brown. Real forests have dirt paths, mossy patches, bare earth under trees, leaf litter piles. |
| 28 | Cliff/slope visual clarity | **FAIL** | Elevation changes happen but slopes look the same as flat ground — no exposed rock faces, no erosion lines, no visual cue that this is a hill. |
| 29 | Walkable vs blocked readability | **PARTIAL** | Wall/rock tiles exist and block movement, but visually they don't always read as "you can't walk here" vs "you can." |
| 30 | Terrain material variety | **FAIL** | 7 terrain types defined in shader but at tactical zoom they blur into one uniform surface. No moment where you think "that's clearly a rocky area" vs "that's grassland." |

### Vegetation

| # | Criterion | Status | Problem |
|---|-----------|--------|---------|
| 31 | Tree trunk quality | **FAIL** | Plain brown cylinder. No bark texture, no taper, no root flare at base. Looks like a wooden dowel stuck in the ground. |
| 32 | Tree canopy shape | **FAIL** | Perfect spheres (oak), perfect cones (pine), perfect flat discs (wide tree). No organic irregularity. Nature doesn't make perfect geometric shapes. |
| 33 | Tree canopy density/opacity | **FAIL** | Solid opaque meshStandardMaterial spheres. Real tree canopies have gaps, leaf clusters, light filtering through. These are green billiard balls. |
| 34 | Conifer vs deciduous distinction | **PARTIAL** | Pine trees are cone-shaped, deciduous are sphere-shaped. The silhouette difference exists but both are equally geometric and primitive. |
| 35 | Dead tree quality | **PARTIAL** | Dead trees exist (bare branches) but are thin cylinder-on-cylinder stick figures. |
| 36 | Bush/shrub quality | **FAIL** | Bushes are small green spheres. Indistinguishable from tree canopies at a different scale. No leaf detail, no shape variety. |
| 37 | Grass appearance at distance | **PARTIAL** | Grass is visible as a green carpet at tactical zoom. Individual blades invisible. The color variation (warm/cool tint) and bare spots help, but it reads as "fuzzy ground" not "meadow grass." |
| 38 | Grass-terrain color matching | **OK** | Grass tint roughly matches terrain green. No jarring color mismatch. |
| 39 | Vegetation density variation | **PARTIAL** | Bare spots near rocks/walls implemented. But the forest feels uniformly forested — no clearings, no dense thickets, no natural variation in tree density. |
| 40 | Stump/log integration | **PARTIAL** | Scale reduced to reasonable proportions. But they sit on the surface rather than looking like they grew/fell there. No moss, no decay detail. |

### Water

| # | Criterion | Status | Problem |
|---|-----------|--------|---------|
| 41 | Water transparency | **FAIL** | Fully opaque. Cannot see terrain beneath water tiles. Reads as painted floor, not liquid. |
| 42 | Water surface animation | **FAIL** | No ripples, no wave motion, no scrolling normals. Completely static flat plane. |
| 43 | Shoreline/edge transition | **FAIL** | Hard edge between water tile and land tile. No foam, no wet sand, no gradient. Water starts and stops like a CSS border. |
| 44 | Water color per biome | **PARTIAL** | Different tint per biome exists in the shader. But with no transparency or animation, it just looks like different colored paint. |
| 45 | Depth gradient | **FAIL** | No shallow-to-deep color change. Uniform color across all water tiles regardless of position. |

### Decorations & Props

| # | Criterion | Status | Problem |
|---|-----------|--------|---------|
| 46 | Boulder natural shape | **PARTIAL** | "Organic boulders" implemented with dodecahedron + vertex noise. Better than cubes, but still reads as lumpy rock primitives, not natural stone formations. |
| 47 | Decoration scale vs characters | **PARTIAL** | Stumps/logs scaled down. But trees are still much larger than characters, making the party feel like ants in a model train set. |
| 48 | Dungeon pillar proportions | **FAIL** | Pillars are 10x character height. Should be 3-4x. They look like factory smokestacks, not dungeon columns. |
| 49 | Prop variety within biome | **PARTIAL** | Forest has 6-7 prop types (4 tree species, boulders, stumps, logs, bushes). Decent count, but every instance of each type is identical geometry — no per-instance variation. |
| 50 | Biome decoration accuracy | **FAIL** | Swamp biome renders with saguaro cacti (desert assets). Biome→decoration mapping is wrong. Each biome needs its own curated set. |

### Lighting & Shadows

| # | Criterion | Status | Problem |
|---|-----------|--------|---------|
| 51 | Key light drama | **PARTIAL** | Sun at 2.2 intensity with warm tone, cool fill from opposite side. The dual-temperature setup is good theory but at tactical zoom the terrain looks flatly lit — no visible light/shadow interplay across the landscape. |
| 52 | Shadow sharpness/quality | **PARTIAL** | PCFSoftShadowMap with 2048 resolution. Shadows exist but are soft blobs. No crisp tree shadows on the ground. Shadow bias may be hiding detail. |
| 53 | Ambient occlusion | **PARTIAL** | ContactShadows provides AO substitute. SSAO technically present but broken (NormalPass errors). Ground darkening exists but subtle. |
| 54 | Per-biome lighting mood | **PARTIAL** | Each biome has distinct sun/ambient/fog colors. But at tactical zoom they all feel similarly lit — cave should feel dramatically darker than forest. The preset differences are too subtle. |
| 55 | Ground-level light variation | **FAIL** | No dappled light under trees, no pooled torchlight in dungeons, no harsh shadow lines in desert. Uniform ambient everywhere. The terrain looks like it's lit by a photographer's diffuser, not a sun in a sky. |

### Atmosphere & Environment

| # | Criterion | Status | Problem |
|---|-----------|--------|---------|
| 56 | Fog quality | **PARTIAL** | Distance fog exists per biome. But it's uniform linear fade — no ground-hugging mist, no volumetric layers, no per-biome fog character (swamp should have thick low fog, forest should have light haze). |
| 57 | Particle visibility at tactical zoom | **FAIL** | Particles were enlarged 3-4x but at tactical zoom they're still subpixel. Fireflies, dust motes, embers — all invisible at play distance. |
| 58 | Firefly/ambient effect quality | **PARTIAL** | Fireflies have glow spheres and point lights. Visible at close range. But at tactical zoom they vanish — the "living world" only lives when you're close. |
| 59 | Sky dome quality | **OK** | Gradient shader per biome. Prevents void-at-edges. Does its job — you don't notice it, which is correct. |
| 60 | Postprocessing impact | **PARTIAL** | Bloom, vignette, SSAO (broken) present. Bloom visible on bright surfaces. Vignette adds frame. But the overall image doesn't have a "cinematic" feel — it looks like raw 3D, not composited game output. |

### Spawn & Layout

| # | Criterion | Status | Problem |
|---|-----------|--------|---------|
| 61 | Player spawn spread | **FAIL** | Entire player party spawns in a tight cluster. Should spread across a formation area (front-line fighters forward, casters behind). |
| 62 | Enemy spawn spread | **FAIL** | Enemies also clustered. Should be placed strategically — behind cover, on high ground, flanking positions. |
| 63 | Team separation distance | **FAIL** | Both teams spawn near the same area. Should start on opposite sides of the map with terrain between them, creating an approach phase. |
| 64 | Spawn-terrain interaction | **FAIL** | Characters placed without regard to terrain features. Spawns should use cover, elevation, and chokepoints — not random open ground. |
| 65 | Map utilization | **FAIL** | 40×30 = 1200 tiles. Combat uses ~25. The map is 98% empty scenic backdrop. Either the map is too big or spawns need to fill it. |

## Priority Order

Work in this order. Each tier must pass its criteria before moving to the next.

### Tier 1 — Readability (you can't play without this)

These are the "can you actually use the 3D view to play the game" issues. If these aren't solved, the 3D mode is a screensaver, not a game view.

1. **Team color distinction.** Player characters get warm tones (gold/bronze armor, warm skin). Enemies get cold/hostile tones (dark armor, red accents). The color split must be visible at tactical zoom — not subtle shading differences, but unmistakable team identity.
2. **Character scale and visibility.** Characters must be large enough to read at tactical zoom. If the current 2.5x scale makes them invisible at distance, they need to be bigger, or they need screen-space outlines, or they need billboarded name/HP bars that scale with distance.
3. **Active turn indicator.** The "whose turn is it" indicator must be visible at tactical distance. A glowing ground circle, a pulsing column of light, an overhead arrow — something that screams "THIS CHARACTER" from 20 units away.
4. **Spawn spread.** Characters must be placed across the map, not clustered. Player team on one side, enemies on the other, with meaningful terrain between them. A battle should feel like an engagement across terrain, not a rugby scrum.

### Tier 2 — Environment Quality (makes it worth looking at)

5. **Biome decoration correctness.** Fix the swamp-has-cacti bug. Each biome must use its own decoration set: swamp (dead trees, mangrove roots, lily pads, murky pools), cave (stalactites/stalagmites, glowing crystals, rubble), dungeon (proportional pillars, torch sconces, flagstone debris), desert (rock formations, sand dunes, dried shrubs), forest (current set is okay).
6. **Tree quality.** Trees need organic silhouettes — irregular canopy shapes, visible leaf clusters or branch patterns. Not perfect spheres on cylinders. Consider: multi-layered canopy (overlapping flattened spheres at different offsets), cone-clusters for conifers, or flat billboard leaf cards.
7. **Water quality.** Transparency so you can see the terrain underneath. Some form of surface animation (vertex displacement ripples, scrolling normal map, or animated opacity). Even subtle helps.
8. **Terrain texture clarity.** The procedural textures need to read as material at tactical zoom. Consider: larger-scale pattern variation (patches of dirt amid grass, visible stone outcrops), reduced noise frequency so the texture isn't a uniform speckle.

### Tier 3 — Atmosphere (makes it feel alive)

9. **Ground-level lighting mood.** Per-biome atmosphere: forest gets dappled light / god rays, cave gets point-light pools with darkness between, dungeon gets warm torch glow vs cold stone, desert gets harsh high-contrast shadows, swamp gets murky green-tinted ambient.
10. **Dungeon/cave architecture scale.** Pillars, walls, and architectural elements must be proportional to characters. Current dungeon columns are comically tall — they should be 3-4x character height, not 10x.

## Process Rules

1. **Every screenshot is at tactical zoom.** The default camera position after the map loads. No zooming in to flatter your changes.
2. **A/B before/after for every change.** State what was wrong, what you changed, and what improved — with screenshots proving it.
3. **Update TRACKER.md after every task.** Status must reflect reality.
4. **Test all 5 biomes.** A fix for forest that breaks cave is not a fix. Biome-switch after every significant change.
5. **Performance gate.** 60fps on mid-range hardware. Check after adding geometry or shader complexity.
6. **If it doesn't pass the eye test, keep going.** Don't rationalize. Don't say "good enough for now." The criteria above are the bar. Meet them or keep working.

## Read These

- **`.agent/PROJECT-3d-combat-map.md`** — North-star project document. Start here for orientation.
- **`.agent/3d-visual-quality/TRACKER.md`** — Living task list. Check status before starting work.
- **`.agent/3d-visual-quality/GAPS.md`** — Out-of-scope issues. Don't fix these during quality work.
- **`docs/superpowers/specs/2026-05-21-3d-combat-map-design.md`** — Architecture spec.
