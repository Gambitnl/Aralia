# Build brief 3 — Weathering and age material

## Goal
Make every building look aged and slightly different, so a town reads as lived-in rather than freshly built. Perfect, uniform surfaces read as fake. Wear and variance read as true.

## What to build
A self-contained browser prototype. Stack: three.js (r170 or newer), WebGPU renderer, TSL (or GLSL) for the material. One small Vite project or single HTML file. No external art assets — all effects procedural. Orbit camera. A control panel.

Build one material (applied to wall and roof meshes) driven by two inputs: an `age` value from 0 (new) to 1 (ancient), and a per-building `seed`. The material layers these effects:
1. **Palette variance** — each building's roof gets a slightly different shade, chosen from the seed, so no two roofs match.
2. **Soot** — darkening near chimneys and roof tops.
3. **Moss and grime** — procedural noise masks that collect in crevices, on north-facing walls, and in roof valleys.
4. **Fade** — gentle desaturation and lightening as age rises.
5. **Patchiness** — occasional mismatched patches, like a wing re-tiled in different stock.

Each effect's strength must be adjustable, and it must all scale sensibly with `age`.

## Two demo layouts
- A row of the **same** building at ages new → aged → old → ancient, so the aging is obvious.
- A cluster of the **same** building type with different seeds, so you can confirm no two roofs match.

## Expose these controls
Age, per-building seed, and a strength slider for each of the five effects.

## Aesthetic target
"Perfection reads fake; wear reads true." Look at how a real medieval town varies: slate ran from grey to red depending on its source, timber greyed as it aged, and no roof was uniform.

## References
- Manor Lords art direction and material variance: https://hoodedhorse.com/wiki/Manor_Lords/Manor_Lords
- Manor Lords buildings reference: https://wiki.hoodedhorse.com/Manor_Lords/Buildings

## Done when
The same-building age row visibly ages from new to ancient. The same-type cluster shows clear roof-shade variance with no two alike. All five effects are live and scale with age. The material works on any tagged mesh, not just the demo geometry.

## Note for integration (context only)
Our buildings will each carry a stable per-building seed and, later, an age value from their history. Keep the material driven purely by `age` + `seed` uniforms so it drops in when those are wired.
