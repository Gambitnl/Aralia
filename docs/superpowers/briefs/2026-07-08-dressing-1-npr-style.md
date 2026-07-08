# Build brief 1 — Stylized (NPR) render pass for a low-poly town

## Goal
Make simple low-poly buildings look like intentional stylized art — an ink-drawn, storybook look — instead of unfinished realism. This is the single highest-leverage change: it makes plain geometry read as deliberate.

## What to build
A self-contained browser prototype. Stack: three.js (r170 or newer), the WebGPU renderer, and TSL for shaders where it helps. One small Vite project or a single HTML file. No external art assets — generate geometry in code and use vertex colors / procedural materials only. Orbit camera. A control panel (lil-gui or dat.gui) for the key parameters.

Put ~6–10 simple low-poly buildings in the scene: boxes with pitched roofs, a couple of L-shaped footprints, mixed heights (1–3 storeys). Flat green ground. That is enough to judge the look.

Apply a non-photorealistic style layer with three parts:
1. **Outlines** — crisp dark lines on silhouettes and sharp creases. Use edge detection (depth + normal discontinuity) as a post-process, or a geometry outline pass — whichever reads cleaner. Line thickness and color must be adjustable.
2. **Flat toon shading** — 2–3 hard light bands, not a smooth gradient. Band count adjustable.
3. **Paper/ink texture** — a subtle paper-grain or canvas overlay, plus a gentle warm-light / cool-shadow split so it reads hand-colored. Grain strength adjustable.

Add a single toggle that flips between "off" (plain flat-shaded, today's look) and "on" (full style), so the difference is obvious.

## Expose these controls
Outline thickness, outline color, toon band count, grain strength, light angle, and the off/on toggle.

## Aesthetic target
Ink-drawn storybook. Look at Sable and Dorfromantik for how simple shapes plus a committed style read as beautiful. The important idea: commit to a look rather than drift toward realism.

## References
- Ghost of Tsushima, "Real-Time Samurai Cinema" (SIGGRAPH 2021): https://advances.realtimerendering.com/s2021/jpatry_advances2021/index.html
- Stylized Depiction / NPR link library: https://www.red3d.com/cwr/npr/
- Field Guide to TSL and WebGPU (outlines via compute + storage texture): https://blog.maximeheckel.com/posts/field-guide-to-tsl-and-webgpu/
- three.js TSL docs (has a toon-outline pass node): https://threejs.org/docs/pages/TSL.html
- MeshToonMaterial docs: https://threejs.org/docs/pages/MeshToonMaterial.html
- Dorfromantik style influence: https://en.wikipedia.org/wiki/Dorfromantik

## Done when
A single scene shows the same building cluster with the style off and on. With it on, the cluster reads as intentional art, not a rough draft. Every parameter above is live in the panel. The technique is written cleanly enough to lift into another three.js/WebGPU project.

## Note for integration (context only — you do not need our code)
Our real buildings arrive as plain meshes with per-part material tags (wall, roof, trim). Keep your style layer as a render pass or a material that works on any mesh, so it drops onto tagged meshes later. Do not hard-code it to your demo geometry.
