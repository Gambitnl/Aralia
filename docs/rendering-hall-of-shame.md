# Rendering Hall of Shame

A field guide to the rendering bugs this project has actually hit. Purpose:
when you SEE a symptom, find its NAME here, and say the name — the right fix
starts from the right word. Each entry: what you see, what it is called, why
it happens, and where we hit it.

## 1. Inside-out mesh

- **You see:** the interior of a model renders; the outside is missing.
  Surfaces look hollow, or you look "into" a shell through invisible walls.
- **Names:** flipped normals (shading level) · inverted / reversed winding
  order (data level) · inside-out mesh (appearance) · backface culling is the
  mechanism that hides the wrongly-wound faces.
- **Synonym note:** in engines that derive facing from vertex order, all the
  names point at one bug. In modeling tools, normals can flip independently
  of winding.
- **Why:** a triangle's vertices are listed in the wrong rotational order, so
  the renderer thinks its back is its front.
- **We hit it:** the hero code-sculpt (2026-07, Remy caught it) and the fused
  hand's surface-nets stitch (2026-08-21, flip parity derived and fixed in
  `src/components/DesignPreview/steps/handFusion.ts`).

## 2. Ink-swallowed model (value crush)

- **You see:** a creature renders as a black silhouette with no interior
  detail — "an ink hole with legs".
- **Names:** value crush · black crush · (ours) ink-swallowed.
- **Why:** a near-black albedo under a toon ramp's shadow band leaves no
  value steps; the black ink outline and the body merge.
- **We hit it:** the basalt beetle (2026-08-19). Fix: compile-time lightness
  floor + accent separation in `textPlan/compilePlan.ts`.

## 3. Z-fighting

- **You see:** two surfaces flicker and stripe against each other as the
  camera moves.
- **Names:** z-fighting · depth fighting.
- **Why:** two faces occupy the same depth; the depth buffer cannot decide.
  Our worst cause: emitting the same face twice with both windings.
- **We hit it:** wall and gate chips (see memory: doubleside-both-windings).
  Rule: never emit both windings; use a DoubleSide MATERIAL if two-sided is
  needed.

## 4. Hollow / open shell

- **You see:** a model looks fine from one side; from another, faces vanish
  and you see through it.
- **Names:** open mesh · non-watertight · single-sided shell.
- **Why:** the geometry never closed (missing caps, open rims), and culling
  hides the shell's far side.
- **We hit it:** the shell-assumption failure class across 3D surfaces —
  gated since by `entities3d/__tests__/shellAssumptions.test.ts`. The fused
  hand's wrist cut is a DELIBERATE open rim (specimen only).

## 5. T-pose / rest-pose leak

- **You see:** a character stands with arms straight out or a limb frozen in
  a default position while everything else animates.
- **Names:** T-pose (or A-pose) leak · bind-pose leak.
- **Why:** a driver or animation never posed that limb, so the bind/default
  transform shows through.
- **We hit it:** plan-gait arms (gnoll, centaur, wisp — "starfish" seed
  poses), fixed for upright walkers 2026-08-19 in `three/gaits.ts`.

## 6. Detached sticker (floating part)

- **You see:** a hat, hair plate, or weapon floats near — not on — the body,
  or drifts when the body animates.
- **Names:** floating part · detached attachment · (anyCreature) "a detached
  sticker".
- **Why:** the part's anchor never reaches the host surface, or points the
  wrong way in the host's frame.
- **We hit it:** the eval centaur's hair plate (compiler even warned "faces
  back"); the anyCreature `part_attachment` gate exists for exactly this.

## 7. Clipping shapes (non-fused junction)

- **You see:** body parts read as separate primitives shoved into each other
  — "a bunch of shapes partially clipping into each other" (Remy,
  2026-08-21, the tube hand).
- **Names:** interpenetrating primitives · unfused junction.
- **Why:** pieces are separate meshes with no shared surface, weld, or blend
  at the joint.
- **Fix ladder we walked:** root embedding (hides seams) → SDF fusion (one
  surface, but soap) → AUTHORED TOPOLOGY (the real answer — hands round 4).

## 8. Isosurface soap

- **You see:** a fused/metaball model is one surface but reads as melted —
  no edges, no planes, no crisp features.
- **Names:** blob look · metaball soap · (ours) isosurface soap.
- **Why:** implicit-surface blends round everything; crisp features need
  authored edge loops or sharp-feature extraction.
- **We hit it:** the fused hand prototype vs the Sketchfab low-poly hand
  (2026-08-21). Verdict: reference looks require authored topology.

## 9. NaN-poisoned geometry

- **You see:** a mesh silently renders NOTHING — no error, no object.
- **Names:** NaN poisoning · NaN geometry.
- **Why:** one NaN in a math chain (for us: `smin(Infinity, x)` =
  `Infinity × 0` = NaN) spreads through every sample or vertex; comparisons
  against NaN are false, so builders emit zero output.
- **We hit it:** the fused hand's first field bake (2026-08-21). Rule: seed
  accumulators FINITE.

## 10. Environment ghosts (not your model's fault)

- **You see:** phantom runtime errors naming code that no longer exists, or
  a canvas that renders solid black after a pane resize.
- **Names:** stale prebundle / stale chunk (Vite `.vite/deps`) · WebGL
  context loss.
- **Why:** the dev server serves outdated dependency chunks after big import
  changes; or the browser drops the GL context when a pane hides/resizes.
- **We hit it:** both on 2026-08-21. Fixes: delete `node_modules/.vite/deps`
  and restart; reload the page for context loss.

---

Add new entries the day a bug is named — one entry per DISTINCT cause, with
the local incident and fix location. The name is the tool: it turns "this
looks wrong" into a one-line work order.
