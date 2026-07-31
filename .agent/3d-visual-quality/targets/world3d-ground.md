# Targets — World3D ground mode

**BG3 counterpart:** overworld exteriors — wilderness, roads, rivers, forests, cliffs,
mountains, distant vistas.

**Owner:** `critic-world3d-ground`. Rewritten 2026-07-30 from the orchestrator's first pass.
The orchestrator wrote that pass so builders had *some* bar while the critic fleet was halted;
it is superseded by this file. Its measured diagnoses survive and are folded in below.
`FINDINGS-world3d-ground.md` stays the orchestrator's file — where the two disagree, **this
file wins**, and the two live disagreements are called out explicitly (targets #1 and #6).

**Reference board:** `references/bg3/world3d-ground/` — audited 2026-07-30, **27 files → 17
kept**, provenance reconstructed by SHA-1 against the bg3.wiki API. Read that folder's
`SOURCES.md` before citing a reference: ten of the original files were cave interiors, night
scenes or city architecture wearing wilderness filenames, and five surviving files were renamed
because their names described content not in the frame.

**Primary references:** `wilderness-open-campsite-clearing.png` (best all-round),
`cliff-singing-canyon-trail.png` (our exact camera), `shoreline-secluded-cove.jpg` (water),
`vista-rosymorn-arch-mountains.jpg` (distance).

**Ours judged:** `captures/critic-world3d/{wilds-ancient-forest, wilds-mountain-summit,
wilds-road-bridge, wilds-ford-causeway}.png`, captured 2026-07-30 14:15–14:17 from the live
surface at `localhost:3000` via `tools/vistest/shoot.ts`.

---

## How to judge

Aralia is procedural; BG3 is hand-placed. **Judge the rendered frame, never the method.** Every
fix below must be something a generator can do. A target is never resolved by hand-authoring a
scene, and never by the critic preferring ours.

Four rules this file adds to the program, because the first pass was gameable without them:

1. **A target states a floor AND a ceiling.** "Contacts darken" with no ceiling can be passed by
   an effect that also destroys the ground cover — and was. Every target below names what must
   *not* regress.
2. **A claimed PASS must name the source values it was measured at, and those values must match
   the tree.** Target #6 was claimed at `aoRadius 7 / intensity 5`; the tree holds `5 / 4`.
3. **Two captures that differ by less than 1.0 mean luma are the same render.** State the
   measurement, not the impression. `_tools/diff.mjs` and `_tools/probe.mjs` in
   `captures/critic-world3d/` do this; use them rather than eyeballing an A/B.
4. **A target is judged across all four scenarios, not just `wilds-ancient-forest`.** Two of the
   four are water crossings, and they fail differently from the forest.

**Scoring: 0 of 11 PASS.** Was claimed 1 of 8. See #6.

---

## Established facts — do not re-derive, do not "fix"

**The renderer is under-wired, not under-equipped.** `n8ao`,
`@react-three/postprocessing`, `@takram/three-atmosphere` and `@takram/three-clouds` are
already in `package.json` and largely unused in the streamed world. Targets #7 and #8 are
**wiring jobs against libraries we already ship.** No builder should propose a new dependency
for them. `BattleMap3D.tsx` already runs a full N8AO + Bloom + ToneMapping + Vignette chain —
copy that pattern, and keep its two recorded lessons: use **N8AO** not `SSAOEffect` (SSAO needs
`enableNormalPass`, which fires `GL_INVALID_OPERATION: Read and write depth stencil attachments
cannot be the same image` every frame under three r172 + `@react-three/postprocessing` 3.x),
and **keep `ToneMapping` in the chain** (a mounted `EffectComposer` sets
`gl.toneMapping = NoToneMapping`, silently killing the Canvas's ACESFilmic setting).

**Water's `emissive` term is a MEASURED fix. Do not delete it to flatten-fix #4.** It reads as
wrong, but without it a lit-only water surface went grey at low sun. Changing it requires
re-measuring at dusk as well as midday.

**Fog cannot serve both the near field and the far shells.** `GROUND_FOG_NEAR = 600`,
`GROUND_FOG_FAR = 15000`, while the streamed world is `CHUNK_WORLD_SIZE 128 × LOAD_RADIUS 4`
≈ 1,150 m across — the farthest visible streamed terrain sits ~500–600 m out, so fog begins at
or past the edge of what the player can see. But `HORIZON_HALF_M = 20000` and `fogFar: 15000`
is what dissolves the far shells, which is the "world edge is gone" work. See #7 for what this
forbids.

**`flatShading` on the terrain is deliberate.** See #1 — it is split into a bug and a direction
question, because conflating them cost the first pass a target.

---

## 1a. Terrain material — the ground texture is wired but structurally inert

**Target:** ground and slopes carry visible surface material — grain, mottling, or triplanar
detail that differs between two points 5 m apart on the same facet. Near-field ground (within
15 m of camera) must carry strictly more detail than ground at 300 m.

**Status: FAIL — and this is a plain bug, not an art-direction question.**

`World3DScene.tsx:255` sets `map={tex || null}` on the terrain material, and `tex` resolves from
`useForgeTexture(getSemanticAssetKey({ surface: 'ground' }))`. **But the terrain geometry has no
UV attribute.** `useDisposableGeometry` (`World3DScene.tsx:179-186`) sets `position`, `normal`,
`color` and the index — and nothing else. `WaterPiece` says so out loud at line 281: *"that
needs UVs the geometry never carried"*, and synthesises its own UVs from world X/Z. Terrain
never does.

A `map` with no UVs samples one texel for every fragment. The ground texture is therefore
multiplying the whole world by a single flat colour. **This answers the orchestrator's open
question in `FINDINGS` §5: no, a ground texture does not resolve in the captured scenarios — it
resolves and then cannot express itself.**

Observed: in all four captures every terrain facet is one uniform colour edge to edge. In
`wilds-ford-causeway.png` the bottom third of frame — terrain within ~15 m of the camera — is a
single unbroken grey mass with no variation at any scale. The reference
(`wilderness-open-campsite-clearing.png`) shows bare dirt, gravel, moss patches and worn track
inside the same 15 m.

**Generator-friendly fix:** derive world-space UVs the way `WaterPiece` already does (world X/Z
over a metres-per-tile constant keeps the pattern continuous across chunk seams — chunk-local
UVs would restart at every boundary), or go triplanar so cliff faces are not stretched. This is
independent of #1b and unblocks it.

**Ceiling:** must not reintroduce a visible tiling period. If the texture repeats visibly at
walking distance the target is not met.

## 1b. Faceted silhouette — DIRECTION QUESTION FOR REMY, not scored

`World3DScene` sets `flatShading` explicitly on the terrain, the trees and the rocks. The
countable triangles in our frames are **intentional low-poly styling**, not an oversight.

Matching BG3 here means reversing a deliberate art direction for the whole game. **That is
Remy's call, and no builder should silently "fix" it.** Raised 2026-07-30; undecided.

This target is deliberately **not scored** and does not count toward the 11. If Remy chooses to
keep the low-poly read, #1a still stands on its own: a faceted world can carry material.

**Note the interaction:** at the current facet scale a single terrain triangle spans tens of
metres, which is what lets ambient occlusion in #6 self-shadow open ground. Keeping the facets
means #6 needs a smaller AO radius, not a larger one.

## 2. Ground cover — layered, and moving

**Target:** at least three distinct height bands in frame — ground surface, low scatter
(pebbles, roots, detritus, flat weeds), and taller growth — with silhouettes that **overlap** so
the ground plane is broken rather than dotted. The tall band must show wind motion: two captures
30 frames apart must differ in the tall band and not in the rock band.

**Status: FAIL.**

Ours has exactly **one** band: a single instanced tuft, evenly scattered, on bare ground. In
`wilds-ancient-forest.png` the tufts are spaced so no two silhouettes touch anywhere in frame —
they read as sparse punctuation on a bare plane, not as cover. The tufts do animate (they are
the only thing that differs between successive captures — measured: the `ao-r5` → `ao-final`
diff is 0.425 mean luma and *all* of it lands on tuft edges), so wind exists on the one band
that is present.

`wilderness-open-campsite-clearing.png` shows four bands inside 20 m — bare packed dirt, low
creeping weed, clumped grass, then shrubs and deadfall — with overlapping silhouettes
everywhere. `cliff-singing-canyon-trail.png` shows the same with the whole tall band bent by
wind in one direction.

**Ceiling:** density must not be bought by shrinking each tuft until the layer reads as noise.
The mid band must be readable as individual plants at 20 m.

## 3. Trees and foliage

**Target:** bark reads as bark and canopy reads as leaves at 30 m. Canopy silhouettes break up
against the sky — a straight edge longer than about 10% of the canopy's width fails. No LOD pop
between two captures taken 10 m apart along the camera's view axis.

**Status: FAIL.**

Ours are untextured flat-shaded cones and spheres in two greens. In
`captures/critic-world3d/wilds-ancient-forest.png` the large foreground conifer is a **single
unbroken triangle** against the sky — one straight edge running the full width of the canopy.
Trunks are plain cylinders with no bark and, after the AO pass, render as solid black posts (see
#6): measured `treetrunk-base` luma 12.8 against 20.5 before AO.

`scenic-forest-stream-bark.jpg` (Tier B, material bar only) shows ridged bark with moss and fern
growing out of it, and canopy edges that dissolve into individual leaf clusters.

**Ceiling:** breaking up the silhouette must not cost the tree its readable species shape at
100 m — the conifer/broadleaf distinction is currently the only long-range biome signal we have.

## 4. Water surface material

**Target:** water shows (a) reflection of sky or surroundings, (b) depth-tinted transparency so
shallow reads different from deep within the same body, (c) a shoreline transition band rather
than a hard polygon edge, and (d) surface normal motion with **no visible tiling period**.

**Status: FAIL on all four sub-conditions.**

The material is not missing. `water/waterSurfaceMaterial.ts` already sets a scrolling ripple
normal map, `roughness` 0.12, `metalness` 0.25, `opacity` 0.92, and `WaterPiece` synthesises
world-space UVs so the ripple survives chunk seams. Three specific reasons it still reads as
paint:

1. **`metalness: 0.25` with no environment map.** A metallic surface reflects its surroundings
   and this scene provides none, so metalness only darkens. The scene *does* have a sky dome —
   PMREM that into an environment and the sky becomes the reflector, which is physically the
   right answer for open water.
2. **No depth information.** Depth tint and a soft shoreline both need the scene depth buffer.
   A constant-opacity quad can express neither, which is why the land edge is a hard straight
   line in every capture.
3. **The ripple tiling period is visible.** New this pass: in
   `wilds-mountain-summit.png` both lakes show the normal map as a **regular chequerboard grid**
   across the whole surface. `RIPPLE_METERS_PER_TILE` is too small relative to a lake read at
   several hundred metres. Fixing (1) and (2) without this makes it worse, because reflection
   will modulate the same grid.

Also observed: `WaterPiece` passes neither `castShadow` nor `receiveShadow`, so **water receives
no shadows at all** — a bridge cannot darken the water it crosses. That is part of #5.

**Ceiling:** do not delete the `emissive` term. See "Established facts".

## 5. Water body placement — a distinct defect from #4

**Target:** one contiguous body of water presents one continuous surface. No two water planes
meet at differing heights or angles inside a single channel, and no water plane visibly
intersects the terrain it sits in.

**Status: FAIL. New target — the first pass missed this entirely because it only judged
`wilds-ancient-forest`.**

`wilds-ford-causeway.png`: the river channel carries **at least three disagreeing surfaces** —
a broad pale grey-blue sheet, and two saturated cyan quads sitting at different elevations and
different tilts, one of which cuts a hard diagonal straight through the grey sheet mid-channel.
The result is not a river; it is overlapping panes of glass.

`wilds-mountain-summit.png`: the lower lake quad is a flat plane driven into a slope, so its
straight polygon edge crosses contour lines at an angle no water body can hold.

`wilds-road-bridge.png`: the river reads as **pale cracked ice**, not water — the near half is
light grey-blue faceted terrain-coloured geometry, the far half dark navy, with a hard boundary
between them and no material continuity.

This one matters more than #4's material work: a correct water *material* applied to
disagreeing water *planes* will make the disagreement more obvious, not less. **Fix #5 before
#4.**

## 6. Ambient occlusion / contact — PASS CLAIM OVERRULED

**Target (rewritten — the first version was gameable and was gamed):**

- **Floor:** the ground immediately around an object's base is measurably darker than open
  ground of the same material and slope at the same distance. Trees, rocks and bushes read as
  seated.
- **Ceiling A:** open ground with no occluder within its own AO radius must not darken by more
  than 3% against the no-AO frame. AO that dims unoccluded ground is not contact, it is a
  global multiply.
- **Ceiling B:** an object's own body must not lose more than 15% of its albedo luminance.
  Ground cover crushed toward black is a regression, not a seating.
- **Held at every distance in frame,** not only the near field.

**Status: FAIL. The orchestrator's PASS of 2026-07-30 is overruled.** Four independent reasons,
each sufficient on its own.

**(i) The claimed configuration was never shipped.** The board and `FINDINGS` §2 both claim
`aoRadius 7 / intensity 5` as chosen. `World3DScene.tsx:1161-1167` holds `aoRadius={5}`,
`intensity={4}`. The source comment at line 1154 then contradicts the `FINDINGS` table
directly — it says *"5 seats trunks, rocks and grass without flattening the midtones"*, while
the table says 5 was *"too faint to seat anything"*.

**(ii) The measurement that justified the choice does not exist.** `captures/ao-r5/` and
`captures/ao-final/` are **the same render**. Measured with `_tools/diff.mjs`: mean absolute
luma difference **0.425**, mean signed **−0.002**, and the difference heatmap contains no AO
structure at all — only sub-pixel speckle on animated grass edges, while the `1.8 → 5` heatmap
shows large soft halos around every trunk and boulder. Point probes agree to the decimal:
open ground 85.3 / 85.3, rock base 30.5 / 30.6, trunk base 12.8 / 12.8, sky 176.2 / 176.2. So
the ladder that reads as four rungs (1.8, 5, 7, 8) is really **three renders** — 1.8, ~5, and 8 —
with the middle one captured twice. "5 too faint, 7 correct" is a distinction between a frame
and itself.

**(iii) The stated mechanism is wrong twice over.** The finding claims 1.8 m is invisible because
"at half-res that radius lands inside a pixel". Arithmetically: at this FOV over a 648 px frame,
the half-res AO buffer is ~324 px tall, so 1.8 m subtends roughly **7 AO pixels at 100 m and
~20 at 30 m** — nowhere near sub-pixel. Empirically, from the orchestrator's own captures, 1.8
produced *substantial and correctly localised* darkening: rock base 60.7 → 29.9 (−51%), grass
tuft 81.7 → 45.3 (−45%), while open ground held at 94.2 → 94.0 and ground away from the rock
held at 92.0 → 90.8. That is textbook contact AO. What made 1.8 look like "no effect" is that
`ToneMapping` landed in the same change and lifted the sky from 86.9 to 176.2 — the frame got
brighter overall, so the eye read the AO as absent. **The A/B had no AO-off / tonemap-on
control, so it could not separate the two.**

The real reason 1.8 seats less than 5 is scale, not resolution: a 1.8 m hemisphere on terrain
whose facets span tens of metres finds almost nothing to occlude except right at the contact
line, so it draws a thin dark seam instead of a readable seat.

**(iv) The shipped value fails both new ceilings, and fails the floor in the mid field.**
Measured `1.8 → 5`: open ground with no occluder near it drops **94.0 → 85.3, a 9% dim** —
that is Ceiling A broken, and it is AO bleeding off the terrain's own huge facets. Grass tufts
drop **45.3 → 25.6**, i.e. 3.2× darker than the no-AO frame — Ceiling B broken badly. In the
near-field crop the small tufts that were light yellow-green now read as **black scorch marks on
bare ground**. The AO is not seating the ground cover; it is erasing it. Trunk bases go
19.6 → 12.8 and the trunks read as solid black posts.

And the floor itself fails away from the near field: in the mid-field crop of
`wilds-ancient-forest.png` the large central trunk meets the ground with **no darkening on the
ground at all** — it ends in a flat cut against uniformly lit terrain, which is precisely the
hovering read this target exists to catch.

**What a real PASS looks like.** AO radius has to be near the scale of the *contact*, not the
scale of the *camera* — the near-correct value is closer to 1.8–2.5 than to 5, and the
orchestrator's own 1.8 capture is the best-behaved frame in the ladder on both ceilings. The
missing ingredient is not radius but that AO is being asked to do a job it cannot do while the
ground cover is untextured single-colour cones with no self-shading: with `distanceFalloff`
holding it local, seat the objects and let #2 and #1a supply the texture AO needs to bite into.

**Also required before this can pass:** capture the missing control. An AO-off / tonemap-on
frame is the only way to attribute a change to AO rather than to the tone curve, and this
surface still does not have one.

## 7. Distance and aerial perspective

**Target:** ground luminance and saturation change **monotonically** with distance from camera.
Concretely, on `wilds-ancient-forest` at the standard framing: ground at ~500 m must be at least
20% closer to the sky's horizon colour than ground at ~15 m, with the mid distance in between.
No hard seam anywhere between the nearest terrain and the horizon.

**Status: FAIL, and quantitatively so.** Measured on `wilds-ancient-forest.png`: ground
luminance is **91.3 at ~15 m, 98.0 at ~250 m, 93.2 at ~500 m** — a 7% spread that is not even
monotonic. There is no distance cue in the frame at all; the scene reads as one flat plane with
things standing on it. `vista-rosymorn-arch-mountains.jpg` shows five distinguishable haze bands
between foreground and horizon.

**THE TRAP — this target explicitly forbids the obvious fix.** Do **not** pull `GROUND_FOG_FAR`
in to get near-field haze. `fogFar: 15000` is what dissolves the 5–20 km far shells, and that is
the work that removed the visible world edge. Nor can a single `FogExp2` serve both: tuned to
give visible haze by 500 m (density ≈ 0.0008) it reaches full opacity by about 5 km and erases
the mountain silhouettes; linear fog over a 15 km range gives ~2% at 500 m, which is invisible.
**One fog curve cannot do both, and a builder who "fixes" this by shrinking fogFar has broken
the far-distance work and will be reverted.**

**Route:** leave `scene.fog` to the shells and get near-field aerial perspective from a
depth-aware pass. `@takram/three-atmosphere` implements real aerial perspective, is already
installed, and there is now an `EffectComposer` in `World3DScene` to hang it on. Failing that, a
custom two-term fog in the terrain material — near term over 20–600 m, far term left alone.

**Ceiling:** the far shells must still dissolve. Re-capture `wilds-mountain-summit` and confirm
the 5–20 km silhouettes survive before claiming this.

## 8. Horizon and far-shell continuity

**Target:** the far shells and the streamed terrain read as one continuous world. No detectable
hue or luminance step at the join, and no straight horizontal boundary across the frame.

**Status: FAIL. New target — separate from #7 because it fails for a different reason and has a
different fix.**

`wilds-mountain-summit.png`: behind the streamed ridges sits a **flat salmon-pink band**
spanning the frame, in a hue with no relation to the cool grey-white of the near mountains, and
it terminates in a hard horizontal line. It reads as a painted backdrop hung behind the set, not
as distant land. `wilds-ancient-forest.png` and `wilds-ford-causeway.png` show the same band as
a mauve strip above the treeline.

This is the failure mode that survives even if #7 lands: aerial perspective applied only to
streamed chunks will match the near field to the sky and leave the shell band *more* obviously
foreign. The shells and the near field need the same atmosphere model.

## 9. Shadows

**Target:** soft shadows with a penumbra that visibly widens with distance from the contact
point. Foliage casts dappled, broken light rather than a solid patch. Shadow direction
consistent with the sun across the whole frame. **Water receives shadows.**

**Status: FAIL.**

`WORLD3D_CONFIG.STREAMED_WORLD_SHADOWS` is `true` and a shadow pass runs, so this is a quality
target, not a wiring one. Observed: shadows are flat dark patches with uniform hard edges and no
penumbra gradient at any distance — the tree shadow at mid-left of `wilds-ancient-forest.png`
has the same edge hardness at its tip as at the trunk. Canopy shadows are solid silhouettes with
no gaps; there is no dapple anywhere in any of the four frames.

Two concrete gaps behind it: `shadow-bias={-0.0004}` with no `shadow-radius` or soft-shadow
filter set on the directional light, and `WaterPiece` passes neither `castShadow` nor
`receiveShadow`, so `wilds-road-bridge`'s span cannot shade the river beneath it.

`dirt-road-risen-road.jpg` is the dapple bar; `beach-camp-sand-ground.jpg` is the
penumbra-widening bar.

## 10. Sky, sun and time of day

**Target:** a sun or moon disc is visible when above the horizon, a cloud layer with parallax is
present, and captures at three different in-game hours produce three visibly different skies —
different sun position, different sky gradient, different ground key direction.

**Status: FAIL.**

Ours is a two-stop vertical gradient. `World3DLighting.tsx:163` `GradientSky` deliberately
replaced drei's Preetham `Sky` because Preetham *"blew out to a flat white band under this
exposure"* — so the flat gradient is a known compromise, not an oversight, and the fix is to
solve the exposure rather than to restore Preetham unchanged. No sun disc, no clouds, and no
detectable hour response: all four captures show the same dusky mauve gradient with a hard
horizon band.

`@takram/three-atmosphere` and `@takram/three-clouds` are already installed and unwired. This
is the same wiring job as #7 and should land with it — one atmosphere model serving #7, #8 and
#10 is the correct shape, and doing them separately will produce three that disagree.

**Ceiling:** whatever replaces `GradientSky` must not reintroduce the blown-out white horizon
band that caused it. Capture at dawn, midday and dusk before claiming.

## 11. Constructed crossings — bridges, causeways, fords

**Target:** a bridge or causeway reads as a built structure at gameplay camera distance: visible
deck thickness, edge or railing, and supports that meet what is below them. Its contact with
both banks is resolved — no floating end, no interpenetration.

**Status: FAIL. New target — two of our four capture scenarios are water crossings and the first
pass had no target covering them.**

`wilds-road-bridge.png`: the span is a **flat tan ribbon of zero apparent thickness** with no
railing, no parapet, no piers, and no visible deck material — it reads as a strip of paper laid
across the gorge. Its far end terminates in a dense black vertical cluster of unresolved
geometry where it meets the bank.

`wilds-ford-causeway.png`: the causeway is a row of separate flat slabs on thin posts with
visible gaps between them, and the slabs do not align with each other in height or heading. The
posts do not reach the riverbed.

`cliff-mountain-pass-1.jpg` and `cliff-mountain-pass-2.jpg` show the bar: a stone arch with a
readable span thickness, a timber deck with individual planks and end caps, and both abutments
seated into rock. `DeckPiece` already vertex-tints quays and bridge spans differently, so the
generator has the hook — the geometry is what is missing.

---

## Priority order

Judged by visual return per unit of work on the four captured frames, and by dependency.

1. **#1a terrain UVs.** A one-attribute bug gating the whole "untextured prototype" read, and a
   precondition for #6 ever passing. Cheapest large win on the board.
2. **#5 water body placement.** Overlapping disagreeing planes. Must precede #4 — a good
   material on bad planes looks worse, not better.
3. **#7 + #8 + #10 as ONE atmosphere job.** All three want `@takram/three-atmosphere` and
   `@takram/three-clouds`, both already installed, both hanging on the `EffectComposer` that now
   exists. Splitting them produces three models that disagree at the horizon.
4. **#6 AO, re-measured.** Capture the missing AO-off / tonemap-on control first, then walk the
   radius **down** from 5 against the two new ceilings.
5. **#4 water material.** Sky PMREM for reflection, depth buffer for tint and shoreline, and fix
   the visible ripple tiling period.
6. **#9 shadows.** Soft filter and `receiveShadow` on water.
7. **#11 crossings.** Deck thickness, railings, seated abutments.
8. **#2 ground cover** and **#3 foliage material.** The biggest jobs and the most
   transformative; they also make #6 read properly for the first time.

**#1b (faceted silhouette) is blocked on Remy** and is not in this order.
