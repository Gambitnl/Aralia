# GOAL: 3D Combat Map Visual Quality — Phase 2

## Where We Are

Phase 1 fixed the fundamentals: grass renders, trees are recognizable, characters are visible, shadows exist, fog works, grid is subtle. The scene went from "completely broken debug view" to "recognizable forest battlefield." But that's not the bar.

## Where We Need To Be

The bar is: a non-developer looks at this and says "that's a pretty good-looking game." Right now they'd say "that looks like a student project." The gap is in **richness, variety, and polish** — the thousand small details that separate a tech demo from a game scene.

## Read These First

- **`.agent/3d-visual-quality/TRACKER.md`** — Living task list. Check status before starting any work.
- **`.agent/3d-visual-quality/GAPS.md`** — Out-of-scope issues. Don't re-discover logged gaps.
- **`docs/superpowers/specs/2026-05-21-3d-combat-map-design.md`** — Original architecture spec.

## Critical Issues (from brutal visual assessment)

These are ordered by how much they'd improve the scene if fixed. Attack them in this order.

### Tier 1 — "This looks like a prototype" killers

**1. Terrain has zero texture detail.**
The ground is a smooth, flat-colored surface. No visible dirt, no pebbles, no roots, no micro-detail. This is the single biggest visual gap. BG3's ground has rich PBR textures with normal maps creating visible grain even at tactical zoom. You need tiling textures (even procedurally generated via Canvas2D) applied to the terrain mesh — grass, dirt, rock, at minimum. The terrain splat-map shader was "implemented" in Phase 1 but it's actually just `meshStandardMaterial vertexColors`. Replace it.

**2. Character nameplates are an unreadable overlapping mess.**
When multiple characters cluster (which is always, because maps are small), their HTML nameplates pile on top of each other creating an illegible wall of text. BG3 shows nameplates on hover only, not permanently. Fix: (a) hide nameplates by default, show on hover/selection, or (b) implement occlusion/stacking logic so they never overlap, or (c) make them much smaller with just an HP pip, and show full info on hover.

**3. Every tree is identical.**
Same shape, same color, same structure with only minor random scale variation. A real forest has 2-3 tree species (different canopy shapes), dead/bare trees, saplings, different heights. Add at least 2-3 tree variants that get randomly selected per instance. Even just "sphere canopy" vs "tall oval canopy" vs "wide flat canopy" would break the monotony.

### Tier 2 — "This is missing things I'd expect"

**4. Zero ground scatter.**
Between the grass blades, there's nothing. No fallen leaves, no twigs, no small rocks, no mushrooms. BG3 maps are dense with micro-detail. Add instanced scatter objects: flat-quad fallen leaves (brown/orange), small rock clusters, twig bundles. 5-10 per open tile. This is cheap (instanced) and high-impact.

**5. No skybox or background.**
The map fades into colored void at the edges. There's no sense of a world beyond the battlefield. Add a simple gradient skybox or hemisphere — pale blue sky with distant treeline silhouette. Even a solid color dome would be better than fog-to-nothing.

**6. Grass is too uniform.**
Same height, same color, evenly distributed. Real grass has patches of different heights, bare spots near rocks/roots, and subtle color variation (some blades lighter, some darker). Add per-instance color tinting and height variation clusters.

### Tier 3 — "This would make it feel alive"

**7. Lighting lacks drama.**
The scene is evenly lit with no contrast. BG3 has warm sunlight with cool fill, dappled shadows through canopy, visible light direction. Increase directional light intensity contrast, add slight color temperature shift between sun and fill, make shadows crisper.

**8. No visible ambient particles.**
The LivingWorld component exists with dust motes and fireflies, but they're not visible at tactical zoom. Make particles larger, brighter, or more numerous. Even 20-30 floating dust motes catching the light would add atmosphere.

**9. SSAO still broken.**
Contact shadows at object bases are missing. Everything looks like it's floating. If the postprocessing SSAO can't be fixed (version incompatibility), implement a simple ground-contact darkening — a dark circle/gradient at the base of every tree and character.

**10. Decoration variety.**
Only trees and boulders. Add: fallen logs, tree stumps, bushes, rock formations. BG3 maps tell environmental stories through placed objects. Even 2-3 new decoration types would add richness.

### Tier 4 — Polish

**11. CombatView 3D mode is broken.**
The 3D view only works through BattleMapDemo, not through the actual CombatView combat flow. The R3F Canvas silently fails to mount in CombatView's ErrorBoundary. This needs debugging — likely a context or mounting order issue.

**12. Character model scale vs interaction radius.**
Selection decal ring (0.36-0.39) is larger than the character body. Characters should be proportional to their selection indicator.

## Process Rules (unchanged from Phase 1)

- **Screenshot after every meaningful change.** Code that compiles but doesn't visually improve anything isn't progress.
- **Compare before/after.** Explicitly state what improved.
- **Update TRACKER.md after every task.** New tasks get added as discovered.
- **Log gaps in GAPS.md.** Don't fix out-of-scope issues during visual work.
- **Performance gate.** 60fps on mid-range hardware. Check after major additions.
- **Test multiple biomes** when changes affect terrain/lighting.

## Definition of Done

A screenshot of the 3D forest combat map where:
- [ ] Terrain has visible texture grain — you can see individual dirt/grass detail, not flat color
- [ ] Character nameplates are readable and don't overlap
- [ ] At least 2-3 visually distinct tree types are present
- [ ] Ground has scatter objects (leaves, rocks, twigs) visible between grass
- [ ] Scene has a background/sky — doesn't fade to void
- [ ] Grass has visible variation in height and color
- [ ] Lighting has directional contrast — you can tell where the sun is
- [ ] At least one type of ambient particle is visible (dust motes, fireflies)
- [ ] Object bases have contact darkening (SSAO or fake AO)
- [ ] A non-developer would say "that looks like a 3D game" not "that's a prototype"
- [ ] TRACKER.md reflects the true status of every task
- [ ] GAPS.md contains all out-of-scope issues found during work

Take that final screenshot. If it doesn't pass the eye test, keep going.
