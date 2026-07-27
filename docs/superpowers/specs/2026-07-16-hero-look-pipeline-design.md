# Hero-look pipeline: staged sculpt quality for library creatures

**Date:** 2026-07-16
**Status:** approved design (Remy, this session)
**Builds on:** creature library (`2026-07-15-text-to-creature-design.md`), smooth-body upgrade, staged-pipeline discussion (image → 3D → optimization, one best-fit tool per stage).

## Purpose

Procedural segment bodies top out at "excellent stylized." The reference bar (ZBrush-class sculpts) needs continuous sculpted surfaces. This pipeline gives *approved library creatures* a sculpted **hero look** through separate stages — reference image, image-to-3D conversion, optimization — each using the best available tool, each leaving a durable artifact, each re-runnable alone. Procedural bodies remain the animated long tail; heroes get the premium mesh.

## Non-goals (slice 1)

- No skinned animation of hero meshes (slice 2: auto-skin to the segment skeleton so heroes walk).
- No in-game rendering beyond groundwork (`heroGlb` field); game surfaces keep procedural bodies.
- No Meshy (decision: TRELLIS hosted Space, free and already proven; Meshy stays a later option if TRELLIS quality caps out).
- No automated batch runs — one creature at a time, review-gated, like plan generation.

## Stages and artifacts

Storage: `src/data/creatures3d/hero/<entryId>/` per library entry:

| Stage | Tool | Input | Artifact |
|---|---|---|---|
| 1a prompt | pure `heroImagePrompt(plan)` | stored CreaturePlan | prompt string (recorded in hero.json) |
| 1b image | Gemini Images in Remy's logged-in Chrome (driven via the Chrome extension) | prompt | `reference.png` |
| 2 convert | hosted TRELLIS Space via gradio client | reference.png | `master.glb` (raw textured mesh) |
| 3 optimize | gltf-transform (weld, prune, dedupe, simplify, textures ≤1024) | master.glb | `hero.glb` + before/after triangle counts |
| 4 display | forge/debugger hero toggle | hero.glb | contact sheets, review |

`hero.json` records: prompt, stage timestamps, TRELLIS run parameters, triangle counts, optimization settings, `status: 'generated' | 'approved'`. Every stage boundary is a checkpoint — re-run stage 3 with new budgets without re-rolling stage 1's randomness.

## Stage rules

**1a — prompt builder** (`src/systems/entities3d/textPlan/heroImagePrompt.ts`, pure, tested): full-body, neutral standing pose, solid neutral gray background, clean silhouette boundary, single creature, no pedestal; palette hexes translated to color names; proportions from the plan (height, length, stance, appendage summary, head form); stylized-game-sculpt render language. The multi-view caveat from the design discussion is noted for slice 2 (front/side/back sheet when a converter supports it).

**1b — image capture:** Claude drives `gemini.google.com/images` in Remy's real Chrome (proven-quality path; account already signed in). `tools/creatureHero/collect-reference.mjs <entryId>` moves the newest `Gemini_Generated_Image_*.png` from Downloads into the hero folder and stamps hero.json. Chrome/extension unavailable → stage fails loudly. No fallback image source (repo CDP driver stays retired for this flow).

**2 — conversion:** `tools/creatureHero/convert.mjs <entryId>` drives `trellis-community/TRELLIS` (free ZeroGPU; proven 2026-07-08, ~30s per asset) through `@gradio/client`: upload, generate, extract GLB, download to `master.glb`. Space down, queue timeout, or failed generation → loud error, no artifact. Known scope: output is a static fused mesh; that is exactly what slice 1 wants.

**3 — optimization:** `tools/creatureHero/optimize.mjs <entryId>` runs gltf-transform functions (weld → dedupe → prune → simplify with error tolerance stepped until under budget → texture resize 1024). Budget = the existing 30k-triangle fixture budget (single source: export the constant from `perfBudget` support code). Still over budget at max tolerance → stage FAILS (no silent ship). Records counts in hero.json.

**4 — display:** library entries gain `heroGlb?: string`. Forge Library rows show a **Hero** chip; forge + debugger get a `hero` toggle (`?planId=<id>&hero=1`) that mounts the GLB (three GLTFLoader) on the same yard/lighting instead of the procedural body, turntable and the contact-sheet hook working unchanged (the sheet frames by live bounding box). Approve flow: the same approve action covers the hero (hero.json status).

## Error handling

No-fallback throughout: every stage either produces its artifact or fails with a named error; downstream stages refuse to run on missing upstream artifacts (`stage 2 needs reference.png — run stage 1 first`).

## Testing

- `heroImagePrompt` unit tests (palette naming, stance/appendage summaries, required phrases).
- hero.json read/write + stage-gating logic unit tests.
- Optimize budget gate tested with a checked-in oversized fixture GLB (fails loudly) and a small one (passes, counts recorded).
- Conversion/collection scripts are manual-run tools verified by logs + artifacts (no CI dependency on external services).
- Visual gate: contact sheets of hero dragon vs procedural dragon; the Behance dragon is the bar. First target: **Emberwing Dragon** (fixture entry).

## Accepted-entities runtime source (added by Remy at plan time)

Approved library entries become a first-class, never-regenerated game source:

- `src/systems/entities3d/library/acceptedEntities.ts` — bundled at build time via `import.meta.glob` over `src/data/creatures3d/plans/*.json`; exposes only `status === 'approved'` entries: `approvedEntries()`, `acceptedById(id)`, `acceptedByName(name)` (case-insensitive, trimmed), `recipeForAccepted(entry)` → `{ kind: 'planned', plan, seed: entry.id }`. Pure data module — no fetch, no dev-server dependency, safe in every game surface.
- **Combat wiring:** `recipeFromCombatant` consults `acceptedByName(combatant name)` FIRST; a hit returns the accepted planned recipe (the creature Remy approved, exactly). No hit → the existing creature-profile path. This is selection by priority, not a fallback: known monsters use their accepted bodies, unknown monsters use the procedural profile that has always served them.
- Hero meshes ride the same entries (`heroGlb`), so slice 2's drape needs no new source.
- The forge Library's Approve button is therefore the single gate between "generated" and "in the game."

## Later slices

1. **Skinned drape:** auto-weight hero mesh vertices to the segment skeleton (nearest-bone) → SkinnedMesh; heroes walk with our IK. The reason heroes stay library-side until then.
2. Multi-view reference sheets when using converters that accept them.
3. Meshy as an alternative converter (API, retopo, auto-rig) if TRELLIS quality caps out.
4. In-game hero rendering (combat close-ups, dialogue portraits-in-3D) once draped.
