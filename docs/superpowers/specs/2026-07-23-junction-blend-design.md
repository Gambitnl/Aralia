# Junction blend: a softness dial for creature bodies

**Date:** 2026-07-23
**Status:** approved design (Remy, this session; approved through to implementation of slice 1)
**Builds on:** text-to-creature language (`2026-07-15-text-to-creature-design.md`), smooth-body swept tubes, hero code-sculpt lessons (`img2threejs` creature_field_lessons: intersection seams read as snapped-together parts).

## Purpose (plain language)

Creatures are built from separate parts pushed into each other, so every limb
meets the body at a hard seam, like a plastic toy. Real bodies flow: muscle
grows out of mass. This feature adds one number, 0 to 1, that says how much a
creature's parts melt together where they touch.

- **0** — sharp and mechanical. A bone golem. Seams read as armor joints.
- **1** — fully melted. A slime. One dripping mass with no seams.
- **Between** — natural flesh. A dragon near 0.4 gets a smooth curve of
  muscle where each leg leaves the body.

Because creatures come from text descriptions, the words carry the number:
"a gelatinous horror" comes out melty, "a chitinous stalker" comes out sharp.

## Slices

**Slice 1 — smoothing collars (this spec implements it).** The bodies cannot
truly melt yet, but the seams can be hidden: everywhere a limb meets the
body, the renderer adds a smoothing ring — like the bead of sealant around a
bathtub edge — sized by the blend number. Works in the current renderer with
the current walk animation.

**Slice 2 — one continuous skin (specced here, gated).** The real melt: all
parts merge into a single continuous surface (signed-distance-field union,
smooth-min joins, surface extraction at rest pose) which is then bound to the
bone chain and deforms as the creature walks. Gated on the body-v3 skeleton
pivot; the language does not change between slices. Collars retire when this
lands.

**Later:** the hero code-sculpt route reads the same values for its fusion
pass, so one vocabulary covers both pipelines.

## Language (schema v1.3)

`CreaturePlan` gains:

```ts
// creature-level default softness; optional
skin?: { blend: number };          // 0–1
// per-appendage override; optional
interface PlanAppendage { …; blend?: number }  // 0–1
```

Validation: both range-checked 0–1 (`PLAN_LIMITS.blend = [0, 1]`);
unknown-key rules unchanged; `skin` allows only the `blend` key.

Resolution order per appendage: appendage `blend` → creature `skin.blend` →
per-kind default: tentacle 0.5, neck 0.5, tail 0.4, leg 0.35, arm 0.35,
wing 0.15. Garnish parts stay crisp in v1 (no field; recorded as a later
extension).

## Compile

`compilePlan` resolves the number to meters so the renderer never re-derives
it: each `PlanSpec` chain gains `blendM` — the collar reach at the chain
root.

```
blendM = blend × min(rootLinkRadiusM, hullRadiusAtAttachM) × 2
```

(× 2 because a blend of 1 should read as a full melt; the collar saturates
at the junction's smaller radius.) `hullRadiusAtAttachM` is the spine tube
radius at the chain's attach fraction — the compiler already knows both.
Torso chains (tauric seam) resolve against their parent chain's root radius
instead. `PlanSpec` also keeps the creature-level value as `skinBlend?`
for slice 2.

Pure and deterministic: same plan in, same numbers out.

## Slice 1 rendering: collars

A collar is a short flared ring bridging the limb root into the hull
surface: an arc sweep from the limb wall (at ~0.6 × blendM up the root
link) down to the hull wall (at blendM along the hull), radially symmetric
around the root axis, 8–10 radial segments × 3 rings. Triangle cost per
collar ≈ 60–100; a 12-appendage creature adds well under 1.5k triangles —
inside the existing 30k plan budget.

Emission follows the swept-tube pattern (`SegmentSink`):

```ts
/** Junction smoothing skirt at a chain root. Frame-updated like tube(). */
collar?(id: string, rootX: number, rootY: number, rootZ: number,
        axX: number, axY: number, axZ: number,
        limbR: number, reach: number): void;
```

`PlanDriver.buildBody` emits one `collar()` per chain with `blendM > 0.02`,
using the live root joint position and axis each frame (the driver already
owns both). Sinks without `collar` (crowd bake, collectors) simply skip it —
collars are cosmetic geometry, never collision or anchor data. The segment
renderer implements it with a pre-allocated geometry updated per frame,
exactly like the swept tube: build once, recompute vertices, never allocate
in the frame loop. Material: body toon material with the hull tint at the
hull edge (the existing per-segment tint machinery colors it like adjacent
hide).

Blend 0 (or below the 0.02 m threshold) emits nothing — a golem stays
exactly as sharp as today.

## Text-to-creature prompt

The CLI prompt (creaturePlanRoutes) documents the field with semantic
anchors: "skin.blend: 0 bony/chitinous/mechanical … 0.35 lean muscle …
0.5 fleshy … 1 amorphous/gelatinous; per-appendage blend overrides for
mixed bodies (for example a slime with one skeletal arm)." One retry rule
unchanged.

## Error handling

No fallback: out-of-range or wrongly-typed blend values fail validation
with named errors (`skin.blend 1.4 outside 0–1`, `appendages[2].blend
outside 0–1`, `unknown field skin.wobble`). The renderer trusts compiled
`blendM` blindly.

## Testing

- Schema: accepts both fields, rejects out-of-range and unknown keys
  (named-error assertions).
- Compile: resolution order (override beats default beats per-kind), the
  meters math against hand-computed values, torso-parent case, determinism.
- Collar geometry: unit test on the segment renderer — vertices lie between
  limb and hull surfaces, reach scales linearly with blendM, blend 0 emits
  no geometry, per-frame update moves with the root joint.
- `perfBudget.test.ts` stays green with collars on every fixture.
- Visual gate (Remy's eyes): contact sheets of three fixtures — tentacled
  ooze at `skin.blend 1`, dragon at per-kind defaults, three-headed serpent
  forced to 0 — plus a walking shoulder close-up in the debugger on :3000.

## Out of scope (recorded)

- Garnish blend fields.
- Slice 2 fused skin (gated on the skeleton pivot) and hero-route reuse.
- Collar LOD tiers for crowd rendering (collars simply absent in baked
  crowd meshes v1).
