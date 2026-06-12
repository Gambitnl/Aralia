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

Originally assessed 2026-05-24. **Refreshed 2026-06-10** against tracker evidence
(TRACKER tasks 14–60, captures in `.agent/3d-visual-quality/captures/`) — rows
updated only where dated proof exists; unverified rows keep their old status.
See GAPS #8/#26: stale rows in this table repeatedly misdirected agents into
re-investigating already-fixed work.

### Character Readability

| # | Criterion | Status | Problem |
|---|-----------|--------|---------|
| 1 | Team color distinction | **OK** (2026-06-07) | Gold vs crimson armor + bright always-on team ground rings + team ground glow (tasks 44/45/46). teams-forest.png / rings-desert.png: friend/foe at a glance. |
| 2 | Class silhouette at tactical zoom | **OK** (2026-06-10) | Task 58 exaggerated cues: tall wizard hat + above-head glowing staff orb, fighter pauldrons/crest/big shield, rogue cape. silh2-after-mid-desert.png (13u: all three identifiable), silh2-after-tac-desert.png (18u: caster unmistakable). Residual: fighter-vs-rogue leans on color/bulk at 18u+ (acceptable; gap #15 note). |
| 3 | Character scale vs terrain | **OK** (2026-06-07) | Model scale 3.7× (task 47). scale2-desert.png: characters are the focal point, well-proportioned to terrain. |
| 4 | Weapon/equipment visibility | **PARTIAL** (2026-06-10) | Staff+orb and shield now read at tactical zoom (task 58); sword reads at mid zoom; daggers still close-up only. |
| 5 | Shield/armor distinction | **OK** (2026-06-10) | Plate+pauldrons+shield (fighter) vs robe+cape (caster) vs slim leather+back cape (rogue) — distinct shapes in the task 58 captures. |
| 6 | Character skin tone variation | **OK** (2026-06-09) | `getRaceVisual` per-race skin tone + build (task 51). lineup-after-clear-desert.png: dwarf/elf/orc/tiefling visibly distinct. Race reads subtly under team armor at far zoom (gap #24, intentional tradeoff). |
| 7 | Character outline or rim light | **OK** (2026-06-11) | Task 73: fresnel rim injected into model materials via onBeforeCompile (useFresnelRim.ts) — cool backlight on silhouette edges, indicators unpatched. Tuned 0.38→0.75 after a 1.4 diagnostic (rim-diag-desert.png proved the mechanism; 1.4 washed armor). A/B particles-after-desert.png → rim-final-desert.png (edges defined, gold preserved); rim-cave-team-cave.png: BG3-style readability in the dark. |
| 8 | Idle pose variety | **OK** (2026-06-10) | Seeded per-character stance (lean + arm-angle offsets) and desynchronized sway/breathe/flap/wobble phase across all body plans (task 61). stance-before-desert.png (identical clones) → stance-after-desert.png (each fighter holds itself differently). |
| 9 | Facing direction readability | **OK** (2026-06-10) | Task 69: BG3-style facing wedge — a bright team-colored triangle on the ground ring rotating with the unit's facing (toward nearest enemy in combat). facing-before-desert.png → facing-after-desert.png / facing-after4-crop.png (wedge clearly readable). Hidden on corpses. |
| 10 | Character grounding | **OK** (2026-06-10) | Task 71: actors take Y from the same `makeTerrainHeightSampler` that builds the terrain mesh — grounding matches the rendered surface by construction (slopes, micro-noise, carved banks). ground-before/after-swamp.png: no regression. Closes gap #27. |

### Character Indicators

| # | Criterion | Status | Problem |
|---|-----------|--------|---------|
| 11 | Active turn indicator | **OK** (2026-06-07) | TurnIndicator is now a 5-unit pulsing golden beam + bobbing chevron + wide ground ring. rings-desert.png: unmissable beacon at tactical zoom. |
| 12 | Selection ring visibility | **OK** (2026-06-07) | Task 46: always-on team rings thickened (0.42–0.60) and brightened (emissive 1.0); every unit shows a readable team circle, selected/turn units brighter. |
| 13 | HP pip/bar at distance | **OK** (2026-06-07) | 0.18-radius emissive HP sphere + 0.20–0.36 team ring at y≈3.05 above the 3.7× model (tasks 30/47). Health color (green/yellow/red) reads in all tactical captures. |
| 14 | Targeting indicators | **OK** (2026-06-11) | Tasks gap-#29 + 78: `TargetingDecals` paints valid-target tiles as bright pulsing terrain-conforming red tile frames + teleport destinations as sky fills the moment an ability is selected (2D color parity). target29d2-before-crop.png → target29d-after-crop.png (glowing frame around the targeted goblin at 16u). Caster range ring = optional polish. |
| 15 | AoE preview readability | **OK** (2026-06-11) | Task 81: premise was optimistic — the template never rendered in 3D at all (no hover path called previewAoE; the receiving flat-plane AoEPreview was unreachable + the buried-on-hills class). Wired TerrainMesh tile-hover (targeting-gated) → previewAoE, and aoeSet now renders as a terrain-conforming red fill in TargetingDecals (2D bg-red-500/60 parity). aoe81-before/after-desert.png: unmissable 7×7 blast template at 16u. |
| 16 | Damage number visibility | **PARTIAL** | Floating damage numbers exist but may be too small or fast to catch at distance. |
| 17 | Movement range highlight | **OK** (2026-06-11) | Bright at tactical zoom (gap #12 confusion proves it). Task 80 hardened it: the overlay now conforms to the heightfield, so move/path highlights read on hills and carved banks too (they were silently buried on elevated tiles before — grid30-after-crop.png). |
| 18 | Nameplate readability | **OK** (2026-06-07) | BG3-style: full nameplate on hover/selection/turn only, always-on HP pip otherwise (task 15). Verified no text-walling with both teams up (task 45, teams-forest.png). |
| 19 | Status effect indicators | **OK** (2026-06-11) | Task 76: ConditionBadgeRow — 2-letter colored chips for all 18 ConditionNames + neutral fallback for custom strings, deduped, source in tooltip, below the HP pip (mirrors DefenseBadgeRow). Verified: 3 unit tests + cond76-crop.png (Afflicted Cultist lineup dummy shows the chip strip in 3D). |
| 20 | Death/unconscious visual | **OK** (2026-06-10) | Captured (task 67, death3-desert.png): the model topples −90° and persists as a corpse lying flat, still identifiable via team ring + red HP pip. Not vanish/stand. Polish residuals (fade/decal; dimming indicators on corpses) are optional follow-ups. |

### Terrain

| # | Criterion | Status | Problem |
|---|-----------|--------|---------|
| 21 | Ground texture natural feel | **OK** (2026-06-10) | The shader was always rich (multi-scale FBM, voronoi, per-type palettes — gap #8); the flat look was atmospheric murk, fixed by the fog/ambient passes (tasks 33/34). grassaudit-forest.png: floor reads as forest ground, not math. |
| 22 | Elevation readability | **PARTIAL** | Hills exist (elevation 0-3) but gentle. Hard to tell where high ground advantage exists without grid overlay. |
| 23 | Terrain type transitions | **PARTIAL** | Edge blending exists in shader but transitions between grass/rock/dirt are smooth gradients. Natural terrain has sharper edges — rock doesn't gradient into grass over 3 tiles. |
| 24 | Ground scatter integration | **OK** (2026-06-11) | Task 79: scatter Y now sampled from `makeTerrainHeightSampler` per instance (was flat tile elevation — up to ~0.45u off beside elevation steps), grounded by the same formula the mesh renders. Same-seed layouts unchanged. scatter24-before2-crop.png → scatter24-after2-crop.png; flat-area behavior already verified (grassaudit-forest.png). |
| 25 | Terrain shadow reception | **OK** | ContactShadows provides ground darkening under objects. Directional shadow map covers the map. |
| 26 | Texture tiling/repetition | **PARTIAL** (2026-06-10) | The uniform-speckle complaint is resolved at tactical zoom (macro patches now visible post-atmosphere); close-up detail still reads procedural. |
| 27 | Macro-scale color variation | **OK** (2026-06-10) | grassaudit-forest.png (task 35): dirt path, pond, light/dark grass patches, and scatter all read at tactical zoom. The "uniform green-brown floor" premise is stale. |
| 28 | Cliff/slope visual clarity | **PARTIAL** (2026-06-10) | Task 65: slope-driven rock exposure (>~20°, erosion streaking) in the terrain shader — desert dune slopes now break into rock (cliff-before-desert.png → cliff-after-desert.png). Limiter is the generator: smoothed 0–3 elevations rarely make ground steep enough to trigger it (gap #28). Shader ready; needs steeper terrain features to shine. |
| 29 | Walkable vs blocked readability | **PARTIAL** | Wall/rock tiles exist and block movement, but visually they don't always read as "you can't walk here" vs "you can." |
| 30 | Terrain material variety | **PARTIAL** (2026-06-10) | Desert rock outcrops read clearly as rocky areas (gap #10 verification); forest grass/dirt patches read (grassaudit). Not yet a "wow, distinct materials" moment at every zoom. |

### Vegetation

| # | Criterion | Status | Problem |
|---|-----------|--------|---------|
| 31 | Tree trunk quality | **OK** (2026-06-08) | Forest trees render via `EzTreeLayer` (ez-tree generated: tapered branched trunks, not dowels). Other biomes intentionally use non-tree props (stalagmites/pillars/cacti/mangroves). Verified across eyetest/overview captures. |
| 32 | Tree canopy shape | **OK** (2026-06-08) | Ez-tree canopies are irregular leaf-cluster volumes; overview2-forest.png / eyetest-forest.png confirm organic silhouettes and per-instance variety (task 16 weighted species). |
| 33 | Tree canopy density/opacity | **OK** (2026-06-08) | Leaf-card canopies with gaps + the camera-proximity foliage fade (gap #16 fix) — light filters through, near canopy reveals characters. fade-far/fade-near.png. |
| 34 | Conifer vs deciduous distinction | **OK** (2026-06-10) | Re-judged post-ez-tree at tactical distance: treejudge-forest.png (24u, SEED 424242) shows pointed/tiered conifer spires clearly distinct from broad rounded deciduous crowns in the same skyline. Capture-only audit, no code change. |
| 35 | Dead tree quality | **OK** (2026-06-11) | Task 77: premise was doubly stale — the stick-figure dead tree was UNMOUNTED dead code (TREE_VARIANTS unused since EzTreeLayer). Rebuilt as gnarled recursive-branch geometry and mounted: ~28% of swamp mangrove tiles render dead trees (stream-preserving index partition — zero layout churn). deadtree77-before/after-swamp.png: bare gothic silhouettes among canopies. Desert dead/dry stays leafy ez-tree by design. |
| 36 | Bush/shrub quality | **OK** (2026-06-10) | Premise was partially stale (already 4-lobe clusters). Task 63: hash-noise vertex displacement + flat shading + dark-base→lit-tip vertex gradient — bushes read as faceted leafy clumps. Same-seed A/B: bush-before-forest.png → bush-after-forest.png. Honest note: at far tactical zoom they're still small dark shapes (modest win); clear at mid zoom. |
| 37 | Grass appearance at distance | **OK** (2026-06-10) | grassaudit-forest.png (task 35): tint variation, height patches, and bare spots read as ground cover with character, and macro terrain shows through. |
| 38 | Grass-terrain color matching | **OK** | Grass tint roughly matches terrain green. No jarring color mismatch. |
| 39 | Vegetation density variation | **PARTIAL** | Bare spots near rocks/walls implemented. But the forest feels uniformly forested — no clearings, no dense thickets, no natural variation in tree density. |
| 40 | Stump/log integration | **PARTIAL** | Scale reduced to reasonable proportions. But they sit on the surface rather than looking like they grew/fell there. No moss, no decay detail. |

### Water

| # | Criterion | Status | Problem |
|---|-----------|--------|---------|
| 41 | Water transparency | **OK** (2026-06-10) | `WaterSystem.tsx` renders transparent (α 0.42 shallow → 0.88 deep, depth-driven since task 59). Basin carve (TerrainMesh `WATER_BASIN_DEPTH`) gives the transparency a real silt bed to reveal. |
| 42 | Water surface animation | **OK** (2026-06-10) | Three-wave vertex displacement + scrolling FBM caustics + animated ripple normal perturbation were already in `WaterSystem.tsx` (the original FAIL was stale — see GAPS #26). |
| 43 | Shoreline/edge transition | **OK** (2026-06-10) | Both sides treated: water-side foam band at the depth-tested waterline (task 59) + land-side wet-earth darkening within ~0.42u of water tiles (task 64). water-carve-close-swamp.png → wetbank-close-swamp.png. |
| 44 | Water color per biome | **OK** (2026-06-10) | Per-biome shallow/deep/caustic palettes (swamp murk-green, cave cyan-dark, desert oasis-teal, forest blue) verified in swamp captures. |
| 45 | Depth gradient | **OK** (2026-06-10) | True per-vertex depth (`aWaterDepth` baked from the carved heightfield) drives shallow→deep color + opacity; no longer noise-faked. |

### Decorations & Props

| # | Criterion | Status | Problem |
|---|-----------|--------|---------|
| 46 | Boulder natural shape | **PARTIAL** | "Organic boulders" implemented with dodecahedron + vertex noise. Better than cubes, but still reads as lumpy rock primitives, not natural stone formations. |
| 47 | Decoration scale vs characters | **OK** (2026-06-07) | 3.7× character scale (task 47) rebalanced the ratio; scale2-desert.png shows the party as the focal point, props proportionate. |
| 48 | Dungeon pillar proportions | **OK** (2026-06-07) | Measured ~2.4–3.7× character height — within the 3–4× target (task 43). The "towering" look was camera framing (gap #13). |
| 49 | Prop variety within biome | **OK** (2026-06-11) | Task 75: per-instance width/height multipliers, settle-tilt for ground clutter (boulders/stumps/logs/stalagmites), and brightness/warmth instance tints (wired the dead buildColorVariations path) — drawn from a separate RNG stream so layouts are unchanged at the same seed. props75-before/after-crop.png + props75-close-desert.png (16u): varied bulk/stature/shade per instance. Residual: instances still share one base geometry per type; multi-variant geometry is optional polish. |
| 50 | Biome decoration accuracy | **OK** (2026-06-07) | Generator config verified biome-correct: forest=trees/bushes/logs, cave=stalagmites, dungeon=pillars, desert=cacti, swamp=mangroves (gap #17). The cacti-in-swamp premise is stale. |

### Lighting & Shadows

| # | Criterion | Status | Problem |
|---|-----------|--------|---------|
| 51 | Key light drama | **PARTIAL** (2026-06-07) | Atmosphere passes (tasks 33/34/41) made the lighting readable per biome, but broad landscape light/shadow interplay (dappled sun, long dramatic shadows) is still mild. |
| 52 | Shadow sharpness/quality | **OK** (2026-06-10) | Task 70: shadow map 2048→4096, bias −0.001→−0.0005 + normalBias 0.02, desert sun lowered ([16,11,8]). shadow-after-desert.png: long hard directional shadows off every cactus/rock/dune ridge; shadow-after-forest.png regression-clean (soft forest sun intentional). This row was stale vs the task-70 log entry — refreshed in the 2026-06-11 truth-pass. |
| 53 | Ambient occlusion | **PARTIAL** | ContactShadows provides AO substitute. SSAO still broken on three 0.170 + @react-three/postprocessing 3.x (NormalPass errors — gap #1; subject of the pending rendering-stack research). |
| 54 | Per-biome lighting mood | **OK** (2026-06-07) | The "all biomes feel the same" root cause was the biome-detection bug (task 40 — everything rendered as forest). Post-fix + per-biome tuning (tasks 41/42): dark crystal cave, torchlit dungeon, murky swamp, bright desert, hazy forest — all visually distinct (biomefix/lit/pools captures). |
| 55 | Ground-level light variation | **OK** (2026-06-10) | All three biome light characters in: cave crystal pools + dungeon torch pools (task 42); forest/swamp canopy dapple (task 66, dapple-before/after-forest.png); desert harsh low sun + long hard shadows (task 70, shadow-after-desert.png). True god-rays remain optional polish (research area 5). Row was stale vs the task-70 log — caught by the hook's doc-drift detector, refreshed 2026-06-11. |

### Atmosphere & Environment

| # | Criterion | Status | Problem |
|---|-----------|--------|---------|
| 56 | Fog quality | **OK** (2026-06-10) | Per-biome distance fog (tasks 33/34/41) + seamless horizon blend (38/49) + **ground-hugging animated mist layers** (task 68, `GroundMist`): swamp thick churning banks, forest faint haze, cave/dungeon floor vapor, desert none. mist-after-swamp.png. Honest note: layered depth-tested planes, not true volumetrics — sufficient for the per-biome fog character this row asks for. |
| 57 | Particle visibility at tactical zoom | **PARTIAL** (2026-06-10) | Task 72: soft-sprite texture + hero-mote layer (12% count, 5× size) + 3× weather sizes. Dark biomes now read at 18u (cave spores, dungeon dust/embers, swamp motes — particles-after-*.png). Residual: forest/desert daylight motes faint — additive blending washes out on bright ground; needs bloom (postprocessing research, gap #1). |
| 58 | Firefly/ambient effect quality | **OK** (2026-06-10) | Task 72: glow core r0.06→0.13 + additive halo sprite. Swamp/cave/dungeon show multiple readable glows at tactical zoom (particles-after-swamp-crop.png: 5-6 green fireflies at depth vs 2 faint dots before). The "living world" survives play distance in the biomes that have fireflies. |
| 59 | Sky dome quality | **OK** (2026-06-09) | Recentered/enlarged dome (r140, object-space gradient, horizon = fog color) + distant-terrain ridge band: no void at edges, no seam, a real skyline behind the battlefield (horizon-after-*.png). |
| 60 | Postprocessing impact | **PARTIAL** | Bloom, vignette, SSAO (broken) present. Bloom visible on bright surfaces. Vignette adds frame. But the overall image doesn't have a "cinematic" feel — it looks like raw 3D, not composited game output. |

### Spawn & Layout

| # | Criterion | Status | Problem |
|---|-----------|--------|---------|
| 61 | Player spawn spread | **OK** (2026-06-08) | `getSpawnTiles.spreadTiles` enforces MIN_SEP=2 (Chebyshev) — verified spaced formations in eyetest-desert.png (gap #18). Role-based formation (fighters front, casters back) not implemented — refinement, not clustering. |
| 62 | Enemy spawn spread | **OK** (2026-06-11) | Task 74's tactical scoring applies to both teams (getSpawnTiles scores player AND enemy tiles): cover + high-ground seeking with spread. Flanking logic remains an optional refinement. |
| 63 | Team separation distance | **OK** (2026-06-08) | Teams spawn on opposite sides with terrain between them (overview-desert.png, eyetest-desert.png). |
| 64 | Spawn-terrain interaction | **OK** (2026-06-11) | Task 74: tactical spawn scoring in getSpawnTiles (elevation×2 + cover-adjacency tiers, wedged-pocket penalty) — seeded shuffle stays the tiebreak so determinism holds. spawn74b-before/after-desert.png (same seed+pose): open-sand spawns → units tucked beside boulders/rises. 4/4 tests incl. spawn-mean > zone-mean and 5-seed team-centroid separation. Chokepoint logic + role formations remain optional refinements. |
| 65 | Map utilization | **PARTIAL** (2026-06-08) | Teams now spread across opposite sides with separation, so the engagement crosses the map. Much of the 40×30 field remains scenic backdrop between/around the zones. |

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
