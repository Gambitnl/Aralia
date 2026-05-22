# GOAL: 3D Combat Map Visual Quality — Phase 3

## Where We Are

Phase 2 brought the scene from "student project" to "recognizable game." Terrain has procedural PBR textures. 4 tree species. Ground scatter. Skybox. Contact shadows. Ambient particles. Grass variation. Nameplates are BG3-style hover-only. The fundamentals are solid.

But a critical review at close range exposed **7 remaining issues** — mostly about character readability and proportion. These are the last things standing between "looks like a game" and "looks like a polished game."

## Where We Need To Be

A non-developer zooms in on a character and says "that's a little warrior with a sword." Right now they'd say "what are those identical glowing blocks?" Characters need visual identity. Props need proportion. Terrain needs depth.

## Read These First

- **`.agent/3d-visual-quality/TRACKER.md`** — Living task list. Check status before starting any work.
- **`docs/superpowers/specs/2026-05-21-3d-combat-map-design.md`** — Original architecture spec.

## Phase 3 Issues — Critical Review Findings

### Tier 1 — P0 (Must fix — breaks the illusion)

**1. All characters look identical.**
Every character has the same body shape, same armor, same shield, same sword. A party with a mage, rogue, and fighter should look visually distinct. Fix: class-based model variation in `HumanoidModel`. Mages get robes + staff (no shield). Rogues get a hood + dual daggers (no shield). Fighters keep current loadout. Remove universal shield — only fighters have shields.

**2. Grass is taller than the characters' knees.**
`BLADE_HEIGHT_MAX` is 0.50, which at 2.5x character scale means grass blades reach mid-thigh. Grass should be ankle-to-shin height — a meadow, not a wheat field. Reduce `BLADE_HEIGHT_MAX` to ~0.25, `BLADE_HEIGHT_MIN` to ~0.08.

### Tier 2 — P1 (Noticeable — hurts polish)

**3. All characters face the same direction.**
Every character faces +Z regardless of tactical context. At minimum, player characters should face toward the nearest enemy (or center of enemy group). Enemies face toward nearest player. Fallback: random Y rotation per instance for visual variety.

**4. Stumps and fallen logs are oversized.**
They look like ancient redwood remnants, not forest floor debris. Scale them down ~40% in `DecorationProps.tsx` geometry constructors so they read as incidental detail rather than major obstacles.

**5. HP pip spheres are invisible at tactical zoom.**
The minimal HP pip (0.06 radius sphere) is too small to see. Increase to ~0.12 radius and add a faint team-colored emissive ring around it so players can assess health status at a glance without hovering every character.

### Tier 3 — P2 (Nice to have)

**6. Terrain is flat — no elevation visible.**
The terrain mesh supports elevation but all visible tiles sit at y=0. `ELEVATION_SCALE` is 0.3 but actual tile elevation data may be zeroed. Debug the pipeline: check if `BattleMapGenerator` produces non-zero elevations, check if `TerrainMesh` applies them, check if characters sit at the right height. Even gentle rolling hills would add depth.

**7. Character emissive glow is too strong.**
`emissiveIntensity: 0.15` on armor makes characters glow like they're radioactive. This was needed for visibility at far zoom, but now that the camera is closer and contact shadows are working, reduce to ~0.05 for natural appearance. Skin should have zero emissive.

## Process Rules

- **Screenshot after every meaningful change.** Code that compiles but doesn't visually improve anything isn't progress.
- **Compare before/after.** Explicitly state what improved.
- **Update TRACKER.md after every task.** New tasks get added as discovered.
- **Performance gate.** 60fps on mid-range hardware. Check after major additions.
- **Work in priority order.** P0 first, then P1, then P2.

## Definition of Done

A screenshot of the 3D forest combat map where:
- [ ] Fighter, mage, and rogue are visually distinguishable by silhouette
- [ ] Grass is ankle-to-shin height, not waist-high
- [ ] Characters face tactically relevant directions (toward enemies)
- [ ] Stumps/logs are proportional to characters (incidental detail, not monuments)
- [ ] HP status is readable at tactical zoom without hovering
- [ ] Terrain has subtle elevation changes — not perfectly flat
- [ ] Characters look naturally lit, not glowing
- [ ] TRACKER.md reflects the true status of every task

Take that final screenshot. If it doesn't pass the eye test, keep going.
