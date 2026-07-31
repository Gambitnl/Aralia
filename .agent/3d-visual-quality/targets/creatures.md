# Targets — Creatures and characters (entity generator)

**BG3 counterpart:** BG3 character and monster art — silhouette, materials, skin and cloth,
rigs, idle motion.

**References used:** `references/bg3/creatures/` (8 files, all personally viewed, see
`SOURCES.md` in that folder). Primary bar for materials is
`character-portrait-halsin-leather-cloth-metal.jpg`; primary bar for silhouette-against-
background is `silhouette-phase-spider-vs-cave-wall-combat-ui.png`; primary bar for
full-body and grounding is `monsters-gnoll-hyenas-gameplay-camera-fullbody.jpg`.

**Ours judged:** `captures/critic-creatures/` — `forge-dwarf-wizard.png`,
`forge-dragon-huge.png`, `forge-lineup.png`, `entitydebug-anchors.png`, and (second pass,
after `framing-capture` landed critique distance) `entitydebug-portrait.png` and
`entitydebug-silhouette.png`. All captured 2026-07-30 from the live surface on port 3000 via
`tools/vistest/shoot.ts`. Every one was opened and read.

**Capture-surface limits, stated so nobody re-litigates them.** `forge-lineup` could not be
brought to critique distance: the lineup walks a wide circle and `AutoFrame` centres the
orbit target on that circle's middle at ground level, so dollying drives the bodies off the
top edge and a pan overshoots. The forge exposes no camera-pose hook. Fixing it needs a
source change — a pose hook, or a row layout instead of a circle — which nobody in this
program owns. Its confirmed "all figures face away from camera" defect therefore stands and
`forge-lineup` is **not** a review surface for anything at critique distance. Creature
critique distance comes from `entitydebug-portrait` and `entitydebug-silhouette` only.

---

## How to judge

Each target below is checkable from a captured frame. Exit condition for this surface is
every target PASS, confirmed by screenshot. Not "critic prefers ours".

Aralia is procedural; BG3 is hand-sculpted. Every fix must be something a **generator** can
do — a material model, a shader, a proportion rule, a pose solver, a texture synthesized in
code. Never resolve a target by hand-authoring an asset. Where a fix names the hero
code-sculpt route, that route is itself generator-shaped (agent-authored factory code), and
it is the established answer for hero creatures per `hero-code-sculpt-route`.

**Do not contradict decisions already made.** Three are binding:

1. **Body v3 is a real `Skeleton`/`SkinnedMesh` and REPLACES the segment renderer**
   (`entity-skeleton-pivot`, Remy 2026-07-17). Slice 1 shipped 2026-07-18 with rigid
   weights and `bodyTech` still defaulting to `'segments'`. Do not deepen the segment
   renderer to satisfy target 5 or 6 — those are the skinned pivot's job. Metaballs already
   died this way; segments are next.
2. **The shipped default look is wireframe** (`ENTITY_RENDER_MODE` in
   `systems/entities3d/three/toon.ts`). Wireframe is `EdgesGeometry` `LineSegments`, which
   cannot deform, so it is in open conflict with the skinned pivot and **Remy owns that
   call**. All targets below are written against **solid** mode, because that is the only
   mode in which skin, cloth and metal can differ at all. Do not read a wireframe capture
   as evidence for or against targets 2, 3, or 4.
3. **Hero creatures come from code-sculpt, not a GPU image-to-3D service.** TRELLIS was
   dropped by Remy 2026-07-23. Do not propose it as the fix for surface detail.

---

## THE TWO ROOT CAUSES

Read both before touching any target. **Neither is a tuning problem.** A builder who reads
these as "the values need adjusting" will waste the pass.

### Root cause A — material differentiation is INEXPRESSIBLE, not mis-tuned

`toonMaterial()` in `systems/entities3d/three/toon.ts` builds **every part of every entity**
as a `MeshToonMaterial` with a 3-band `gradientMap` and `flatShading = true`. That material
class exposes **no roughness, no metalness, no specular term, no normal map and no texture
map**. The only thing that differs between a ranger's skin, her hood, her bowstave and a
knight's steel is the `color` argument.

So "skin, cloth and metal respond differently to light" cannot be achieved by passing better
values. **There are no values to pass.** Confirmed at critique distance in
`entitydebug-portrait.png`: bare skin, dark-green cloth and a wooden bowstave sit side by
side, each rendered as one flat fill plus at most one darker toon band, with zero specular
anywhere in frame including on the bowstring.

The fix's real shape is a **material model**, in two parts, both generator-shaped:

1. **Per-part material class selection** driven by the part registry's own semantics. The
   registry already knows whether a part is cloth, hide, or gear — that knowledge is
   currently discarded at render time. Route it into a choice of material and channel values.
2. **Procedurally generated maps.** Already proven in this project: `emberwingTextures.ts` on
   the code-sculpt route paints canvas albedo, roughness and stroke-derived normal maps in
   code. Ordinary entities need that capability, not just heroes.

### Root cause B — the forge scene has no shadow, no environment, no post pass

`EntityForgeScene.tsx` lights the scene with exactly one `hemisphereLight` and one
`directionalLight`, and **the directional light does not `castShadow`**. There is no shadow
map, no environment map, and no post-processing pass.

Consequences a builder must not miss:

- Every dark ellipse under a figure in these captures is the entity's own painted
  blob-shadow decal, **not a rendered shadow**. It is axis-aligned and pose-independent.
- With no environment map, no material can produce a reflection even after root cause A is
  fixed. Metal needs something to reflect. Fixing A without B gets a highlight but no metal.
- The N8AO pass that landed in `World3DScene` on the ground profile 2026-07-30 does **not**
  reach this surface — the forge is a Design Preview scene with its own light rig. It earns
  no AO credit here.
- Per the world3d-ground finding, `aoRadius` does not port between cameras. The forge camera
  sits a few meters from a 2 m figure; a radius measured at 100 m exploration distance is
  meaningless here and must be re-measured.

### On `flatShading` — I agree it is now a target, with one ordering caveat

Remy chose "go smooth — BG3 is the bar" for terrain faceting, and `flatShading` was removed
from the streamed terrain. **I agree that decision points the same way here, and that
`flatShading` in `toonMaterial()` is now a defensible target rather than an untouchable style
choice.** The evidence from `entitydebug-portrait.png` supports it directly: on the torso and
upper arms the facets read as untessellated low-poly geometry, not as sculpted planes. The
original rationale recorded in the code comment — the Dragon Forge trick, "low-poly facets
read as sculpted" — does not survive critique distance. None of the eight BG3 references
shows a faceted surface anywhere.

**The caveat is ordering, and it matters.** The facet bands are currently the *only* shading
variation on most parts. Remove `flatShading` before root cause A lands and every figure gets
*flatter*, not better — a smooth-shaded untextured fill under a 3-band ramp is a silhouette
with nothing inside it. Land the material channels first, then go smooth. Doing it in the
other order will look like a regression and may get the smooth change reverted for the wrong
reason.

---

## 1. Silhouette reads at full-body distance

**Target:** At the gameplay/tactical camera, a creature's outline alone identifies what it is
— species class, weapon, and whether it is biped or quadruped — against a background of
similar value. Limbs stay individually separable; no limb fuses into the torso or into
another limb.

**Status: FAIL.**

Evidence, `forge-lineup.png`: the four humanoids are separable from the green plane, so the
easy half passes. The hard half does not. The third figure from the left has both arms fused
into a single grey-white cloud mass at the chest with no readable torso behind it, and the
body is bent backwards in an arc no stance explains. Its outline does not identify a
humanoid at all. Figure two's head is a purple sphere with a **separate green blob floating
above it**, which reads as a second head. Figure four presents three arms.

Evidence, `forge-dragon-huge.png`: this is the clearest failure in the set. A Huge Dragon
reads as a red ostrich. The neck is a straight vertical tube of uniform diameter, the head is
a near-perfect sphere with no snout projecting forward, the wings are flat unfolded planar
quads held straight out sideways, no tail is visible in frame, and all four legs are straight
sticks standing in a single row so the quadruped stance does not read. The reference
`monster-phase-spider-fullbody-chitin.jpg` and `monster-bulette-fullbody-carapace-grounded.jpg`
both identify their species from outline alone.

**Second-pass evidence, `entitydebug-silhouette.png`:** this is the best silhouette in the set
and it still does not pass. The figure does read as "humanoid carrying a bow", which the
lineup figures did not — credit where due. But the legs are two plain tapered tubes with no
calf or thigh differentiation, the feet are small wedge blocks, the torso is a featureless
slab with no waist taper or shoulder mass, and the head is a dome. And the bowstave's lower
limb **terminates in mid-air** clear of the body outline: it is a partial arc, not a strung
bow, so the most distinctive thing in the silhouette is broken. See target 9.

**Generator-shaped fix direction:** the silhouette failures here are pose and proportion
rules, not sculpting. A dragon silhouette needs a forward-thrust snout, an S-curve neck, a
deep chest volume, a gathered folded wing at rest, and a counterbalancing tail — all of which
are parameters the creature language already has (`spine.bulge`, tail `arc`, snout `droop`,
auto-S-necks). They are not being applied to the built-in `type: Dragon` recipe path, only to
`planned` recipes. Closing the gap means routing canonical creature types through the same
plan compiler that already produces those curves.

## 2. Silhouette reads at portrait distance

**Target:** At dialogue/portrait distance the head reads as a face with structure — brow,
nose or muzzle projection, jaw line, and a mouth — not as a sphere with features painted on.
The head's outline distinguishes race.

**Status: FAIL** (re-scored 2026-07-30 from `entitydebug-portrait.png`; was UNVERIFIABLE).

The new portrait framing is good — the head occupies roughly 250 px of an 800 px frame, which
is critique distance and comparable to the reference crops. The target fails outright.

**There is no face.** The head is a smooth dark-green dome with two flat purple discs for
eyes and two small tan spikes for ears. No nose, no mouth, no brow ridge, no jaw line, no
chin. The lower face is an unmodulated tan-olive shape with no features cut into it at all.
The eyes are flat circles with no pupil, no highlight, and no eyelid — they read as painted
dots, not as eyes in a socket.

Against `character-portrait-astarion-skin-hair-closeup.png`, where at the same relative crop
you can read individual pores, moles, lip wetness, an eyelid crease and the brow's shadow —
and against `character-portrait-laezel-githyanki-scaled-skin.png`, where a *non-human* head
still carries cartilage ear plates, a nose bridge, teeth and a defined jaw. Our head at
critique distance carries less structure than either reference's ear.

The head outline also does not distinguish race: it is a dome, and a dome is a dome.

**Generator-shaped fix direction:** head form is already a solved seam in this project for
*planned* creatures — `three/headForms.ts` builds serpent/beast/blunt/skull heads with posed
jaw, teeth and sockets, and the driver skips the plain ball when a form is present. Ordinary
humanoid recipes are not using it; they get the ball. Extending head forms to humanoids, with
per-race brow/nose/jaw parameters, is the same table-driven move the creature language
already makes.

## 3. Material response: skin, cloth, hair, leather, metal

**Target:** In one frame under one light, five surfaces read as five different materials.
Specifically: metal shows a tight bright specular highlight that moves with view angle; skin
shows soft wide falloff with warmth in thin areas; leather shows a broad low-gloss sheen
following its grain; woven cloth shows a matte, near-Lambertian response; hair shows an
anisotropic band along the strand direction. Hue differences alone do not count.

**Status: FAIL.**

This one I can score at the framing I have, because the failure is total rather than subtle.
In `forge-dwarf-wizard.png` the skin, the wooden staff shaft, the navy robe, the navy hat and
the gold hat band are five flat unmodulated color fills. The staff's metal ball and the gold
trim carry **zero** specular highlight. In `forge-lineup.png` figure four's sword blade is a
flat light-grey quad and the shield boss is a flat yellow circle — under a light strong enough
to key the whole scene, neither returns a highlight. Nothing in any of the four frames
distinguishes cloth from steel except hue.

Against `character-portrait-halsin-leather-cloth-metal.jpg`, which holds six distinguishable
materials in a single frame under a single daylight key, and
`character-portrait-karlach-leather-gold-scale.png`, where gold studs blow out to specular
white while the matte red cloth two centimeters away stays flat — this is the largest gap on
the surface. See the root-cause section: the material class in use cannot express it.

## 4. Surface detail at portrait distance

**Target:** At portrait distance, surfaces carry detail below the silhouette — pores or
scale pattern on skin, weave or wear on cloth, grain on leather, scratches or bevels on metal.
No surface is a solid untextured fill.

**Status: FAIL** — now confirmed at critique distance, no longer inferred.

`entitydebug-portrait.png` fills the lower half of the frame with bare skin across a torso
and two arms, plus a cloth garment and a wooden bowstave. Across all of it there is **not one
pixel of surface detail**. The skin is a single unmodulated tan from shoulder to wrist. The
cloth is a single dark green. The bowstave carries two flat tones — a lighter upper edge and
a darker underside — which is the 3-band toon ramp, not wood grain.

The only sub-silhouette lines visible anywhere are the thin darker seams where one segment
cylinder butts into the next, at the shoulder, the elbow and across the abdomen. Those are
**construction seams, not surface detail** — they advertise how the body was assembled, which
is the opposite of what this target wants.

`entitydebug-anchors.png` reports **1,984 triangles and 16 segments** for a full humanoid,
which independently rules out form detail carried in geometry.

Against `character-portrait-halsin-leather-cloth-metal.jpg`, where at this crop the leather
shows quilt stitching and grain, the webbing shows a herringbone weave, and the skin shows
pores and scar tissue.

**Generator-shaped fix direction:** procedural maps generated in code, which the project has
already proven works — `emberwingTextures.ts` on the code-sculpt route paints canvas albedo,
roughness and stroke-derived normal maps and reached a 28,952-triangle hero body. The
generator needs the same generated-map capability on ordinary entities, not just heroes.

## 5. Rig deforms without collapsing at shoulders and hips

**Target:** In a mid-stride and a mid-swing pose, the shoulder and hip joints hold volume.
No crease that pinches the limb to a point, no gap between limb and torso, no interpenetration
spike.

**Status: FAIL** (re-scored 2026-07-30; was UNVERIFIABLE). Both joints are now visible.

**Shoulders — `entitydebug-portrait.png`.** The upper-arm cylinder butts into the torso slab
with a visible seam line and **no deltoid volume whatsoever**. The join is a hard edge, not a
transition. The elbow is worse: two tapered cylinders meet at an angle and the outline carries
a visible **notch** at the crease on both arms, so the silhouette itself breaks at the joint.
The hand is a plain sphere stuck on the forearm end.

**Hips — `entitydebug-silhouette.png`.** The garment is short enough here to expose the
pelvis. Both thigh cylinders emerge from the torso block across a flat horizontal seam with no
gluteal or hip mass, and at the figure's right hip there is a visible gap in the silhouette
where thigh and body fail to meet.

Against `monsters-gnoll-hyenas-gameplay-camera-fullbody.jpg`, where at a *further* camera
distance every hyena shoulder still carries a shoulder blade sliding under skin.

**But score this against the right tech.** The stats line reads **16 segments**, so
`bodyTech` is still `'segments'` — these are rigid tapered cylinders butt-jointed with sphere
caps, and there is no skin here to deform. What I am recording is that the segment renderer
fails the target at critique distance, which is expected and is exactly the evidence the
skinned pivot was decided on. **Per binding decision (1), the fix is body v3, not segment
polish.** Do not spend a pass adding collar geometry to segments to close this — that is the
mistake the metaball-to-segment history already warns about.

**Framing still wanted, for the pivot's own proof rather than for this score:** a solid-mode
capture at `bodyTech: 'skinned'`, `cam:3/4`, figure at ≥70% frame height, `freeze` on,
`anchors` **off**, at mid-stride and at `melee` extension. That is the A/B that will show
whether skinning actually holds volume under load, which a rest pose cannot.

## 6. Idle motion has weight and no visible loop seam

**Target:** Across a short capture sequence, an idle figure shows weight — the chest and hips
counter-move, the head lags the torso, and there is no frame where the whole body translates
rigidly. The loop does not snap: no single frame where a limb jumps position.

**Status: UNVERIFIABLE — still, after the framing pass.**

Both new scenarios are single stills, so nothing changed for this target. `entitydebug-
portrait` and `entitydebug-silhouette` are one frame each. A loop seam is by definition a
relationship between two frames, and weight is a relationship across many. **This is the one
target the framing pass did not touch, and I am not scoring it from a still.**

One observation that is *not* a score: `entitydebug-silhouette.png` catches the figure with
its legs offset, one forward and one back, which is a mid-stride sample rather than an idle.
That tells me the capture can land on an arbitrary phase, which is useful for the strip
described below, but it says nothing about whether the cycle has weight or seams.

**Framing I need:** either a multi-frame capture (the project already has a 360 GIF rig,
`.agent/scratch/shoot-hero-360.mjs`, which proves the harness can emit frame sequences), or —
cheaper and enough for the seam half — a contact-sheet-style strip of the *same* idle at 6
evenly spaced phases via the debugger's `phase` slider plus `freeze`, so a limb that jumps
between phase 0.83 and phase 0.0 is visible as a discontinuity across two adjacent panels.
`window.__entitydebug.contactSheet()` already auto-frames from the live `Box3`; a phase-strip
variant of it is the smallest thing that makes this target checkable.

## 7. Proportion and stance read as deliberate

**Target:** A figure's proportions communicate its race or species — a dwarf's head-to-body
ratio differs visibly from a tall race's at full-body distance. Stance shows weight on one
side (asymmetric hips, shoulders not level); no figure stands in a symmetric default pose.

**Status: FAIL.**

Evidence, `forge-lineup.png`: all four heads are spheres of near-identical size, so race does
not read from proportion. Two of the four stand hands-on-hips and the poses are symmetric —
level shoulders, level hips, weight evenly split. Nothing in the frame reads as chosen.

Evidence, `forge-dwarf-wizard.png`: hands-on-hips again, perfectly symmetric, and the head is
*small* relative to the body — the opposite of the dwarf proportion the recipe asked for. The
robe is a plain truncated cone that swallows the legs entirely, so the lower body contributes
no proportion information at all.

Evidence, `forge-dragon-huge.png`: the head is roughly as wide as the entire body and the neck
is about 40% of total height. That reads as a default chain length rather than a dragon.

Against `monsters-gnoll-hyenas-gameplay-camera-fullbody.jpg`, where the gnoll's crouch and the
two hyenas' lowered heads and offset legs all read as weight-bearing poses at the same camera
distance.

**Second-pass evidence, `entitydebug-silhouette.png` — partial improvement, still FAIL.** This
figure's legs *are* offset, one forward and one back, which is more than any lineup figure
managed. But that is a mid-stride sample of a walk cycle, not a chosen stance: the shoulders
are dead level, there is no hip drop, both feet are flat, and the arms are akimbo again. Weight
is not on either leg. A stride sample and a weight-shifted idle look different, and the target
wants the second.

**Generator-shaped fix direction:** per-race frame ratios already exist in the feet-canon
`Frame` and in `ageBand` (child 0.62 height / 1.3 head is exactly this idea, applied to age
but not to race). Extending that to per-race head-to-height ratios is a table, not sculpting.
For stance: a single procedural weight-shift offset — pick a support side from the seed, drop
the opposite hip, counter-rotate the shoulders — removes the default read across every figure
at once.

## 8. Grounding: feet contact the floor with a contact shadow

**Target:** Feet visibly meet the ground. The contact darkens, and the darkening is shaped by
the pose and the light rather than being a fixed ellipse. No figure appears to hover, and no
foot sinks below the surface.

**Status: FAIL, with partial credit.**

Every figure in `forge-lineup.png`, `forge-dwarf-wizard.png` and `forge-dragon-huge.png` has
a soft dark ellipse beneath it, so the "does not obviously hover" half is satisfied and this
is not a zero. But the ellipse is a painted blob decal, not a shadow: it is axis-aligned and
pose-independent, it does not change shape when the figure's arms are out, and the feet
themselves show no darkening where they meet it.

Two specific failures. In `forge-dragon-huge.png` the blob sits **between** the legs rather
than under the feet, and the feet meet the green plane with no occlusion at all — at the toe
tips the creature reads as a decal on the grass. In `forge-lineup.png` the third figure's feet
sit visibly above its own blob's center.

**Second-pass evidence, `entitydebug-silhouette.png`.** At critique distance the decal's nature
is unmistakable. The figure stands mid-stride with its feet clearly apart — and produces **one**
soft ellipse. Two separated feet bearing weight must produce two contact darkenings; a single
pose-independent blob is the tell that nothing is being rendered. The forward foot also sits at
the ellipse's edge rather than over it, so the one blob is not even tracking the pose centroid.

Root cause is **root cause B**: `EntityForgeScene.tsx`'s `directionalLight` does not
`castShadow`, so there is no shadow map to produce a real contact, and the N8AO work on
`World3DScene` does not reach this scene. See that section for the `aoRadius` warning before
anyone measures a number here.

## 9. Part anchoring integrity (critic-added)

**Target:** Every part is attached where it belongs. No part floats free of its socket, no
part is duplicated, no held item passes through the hand or the body.

I added this target because the defects below are not stylistic — they are the first thing a
viewer sees, and they will read as bugs no matter how well targets 1-8 land.

**Status: FAIL.**

Evidence, `forge-lineup.png`, three distinct defects in one frame:

- Figure one (orange): the polearm floats free behind and to the left of the body with no
  hand contact.
- Figure two (purple robe): a green blob hovers detached above the purple head sphere — a hat
  or hair part that has come off its socket — and the staff shaft passes straight through it.
- Figure four (grey and gold): three arms are visible, plus a fourth limb stub.

**Second-pass evidence — the same class of defect on the new critique-distance subject, so this
is not confined to the lineup.** In `entitydebug-portrait.png` the bowstave arcs across the
figure's chest with **no hand gripping it**: the hand sphere sits well clear of the stave, and
the right hand sphere instead intersects and clips through the stave's limb. The two white
bowstring lines run diagonally down from the hand area and do **not** connect the stave's tips,
so the string is attached to nothing at either end. In `entitydebug-silhouette.png` the same
stave's lower limb ends in mid-air away from the body, and a separate black bar floats detached
alongside the figure's left side.

Also, all four figures in the lineup face away from camera. That defect was independently
confirmed by `framing-capture` and it **remains** — `forge-lineup` cannot be re-aimed without a
source change nobody owns, so it stays off the review path.

Separately, `forge-dragon-huge.png` shows a **hole in the ground plane** at the left edge
(roughly x=25, y=510 in the 1600×1000 capture) where the green surface does not reach. That is
a scene defect on the capture surface rather than an entity defect, but it will contaminate
every future capture from this scenario.

---

## Honest scoring, second pass (2026-07-30, after critique-distance framing landed)

**0 of 9 PASS.** 8 FAIL (one with partial credit), 1 UNVERIFIABLE.

| # | Target | First pass | Now |
|---|---|---|---|
| 1 | Silhouette, full-body | FAIL | FAIL |
| 2 | Silhouette, portrait | UNVERIFIABLE | **FAIL** — no face at all: dome, two flat discs, no nose/mouth/brow/jaw |
| 3 | Material response | FAIL | FAIL — now confirmed at critique distance, not inferred |
| 4 | Surface detail | FAIL (portrait half unverifiable) | **FAIL** — fully confirmed; zero texture, only construction seams |
| 5 | Rig deformation | UNVERIFIABLE | **FAIL** — shoulders and hips both visible, both butt joints, notched outline |
| 6 | Idle weight / loop seam | UNVERIFIABLE | **UNVERIFIABLE** — unchanged; both new scenarios are stills |
| 7 | Proportion and stance | FAIL | FAIL — legs now offset, but shoulders level and no weight shift |
| 8 | Grounding | FAIL, partial | FAIL, partial — one blob under two separated feet |
| 9 | Part anchoring | FAIL | FAIL — and now reproduced on the critique-distance subject too |

The framing pass did its job: three of four unverifiable targets converted, all to FAIL, and
none of them needed softening to get there. Nothing regressed, and nothing turned out to be
better than the distant shots suggested.

The sheet is harsher than world3d-ground's 1-of-8 for a narrow reason: one material class with
no PBR channels sits upstream of targets 2, 3 and 4, so they fail together and will pass
together.

## Still blocked on framing — one target

Requests 1 and 2 from the first pass were delivered by `framing-capture` as
`entitydebug-portrait` and `entitydebug-silhouette`, and targets 2, 4 and 5 are scored above
on them. Two items remain, and only the first blocks a score:

1. **Blocking target 6 — a phase strip.** The same idle at 6 evenly spaced phases in one
   sheet, so a limb that jumps between the last phase and the first shows as a discontinuity
   between adjacent panels. `window.__entitydebug.contactSheet()` already auto-frames from the
   live `Box3` and the debugger already has `freeze` plus a `phase` slider, so this is a
   phase-swept variant of an existing tool rather than new capture machinery. Alternatively a
   multi-frame sequence — the project's `.agent/scratch/shoot-hero-360.mjs` proves the harness
   can emit frame sequences. **Until one of these exists, target 6 is unscoreable and I will
   leave it that way.**

2. **Not blocking a score, but wanted for the pivot's proof:** skinned-mode `cam:3/4` at ≥70%
   frame height, `freeze` on, `anchors` off, at mid-stride and at melee extension. Target 5 is
   already scored FAIL on the segment renderer; this capture is what will show whether body v3
   actually holds volume under load.

I did not soften any target to fit the shots available, and I am not softening target 6 now.

## Where a builder should start

Unchanged by the second pass, and now better evidenced:

1. **Part anchoring (#9)** — cheapest, most conspicuous, and now confirmed on two separate
   subjects. A bow gripped by nothing with a string attached to nothing is the first thing any
   viewer sees.
2. **Material channels (root cause A → #3, #4, and the surface half of #2)** — the single
   highest-leverage change. Three targets are unreachable by construction until it lands.
3. **Forge light rig (root cause B → #8)** — one `castShadow` plus a shadow map, and an
   environment map so that metal has something to reflect once A lands. Also the change that
   makes every future capture on this surface worth judging.
4. **Humanoid head forms (#2's structural half)** — `three/headForms.ts` already builds jawed,
   toothed, socketed heads for planned creatures; humanoids just are not routed through it.
5. **Stance weight-shift and per-race proportion ratios (#7)** — a seed-driven hip drop and a
   ratio table. Lifts every figure on every surface at once.
6. **Routing canonical creature types through the plan compiler (#1)** — the dragon's curves
   already exist in the language; the built-in type path is not using them.
7. **The skinned pivot (#5, #6)** — the biggest job and the already-decided direction. Do not
   open it by polishing segments.

Then, and only then, remove `flatShading` — see the ordering caveat in the root-cause section.
