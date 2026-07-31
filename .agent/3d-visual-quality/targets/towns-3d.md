# Targets — Towns in 3D

**BG3 counterpart:** Baldur's Gate city and Rivington — streets, plots, buildings, docks,
walls and gates.

**References used:** 17 files in `references/bg3/towns-3d/` (see `SOURCES.md` there). Targets
are calibrated against five I opened at full size:
`lowercity-street-carms-garms-groundlevel.jpg` (street bar),
`lowercity-street-elfsong-groundlevel.jpg` (street-level façade bar),
`lowercity-grey-harbour-docks-water-contact.jpg` (dock bar),
`south-span-checkpoint-gate.jpg` and `lowercity-basilisk-gate-wall.jpg` (gate/stone bar),
`rivington-aerial-rooftops.jpg` (aerial bar).

**Ours judged — second pass, 2026-07-30, after the street-level framing landed.** All three
frames captured from the live surface (dev server :3000) via `tools/vistest/shoot.ts` into
`captures/critic-towns/`:

| Frame | Scenario | Camera | Hour |
|---|---|---|---|
| `town-street-aerial.png` | `town-street-aerial` | aerial over a street | 07:12 |
| `town-street-level.png` | `town-street-level` | street level, looking along | dusk |
| `crowd-commute.png` | `crowd-commute` | close on a walker, wall + street | dusk |

Crops I read are saved beside them (`_sl-*.png`, `_cc-*.png`, `_crop-*.png`).

**What changed since the first pass.** Terrain `map` had no uv attribute (whole world sampled
one texel); fixed, and terrain is now smooth-shaded per Remy's call. The flat triangle facets
that dominated the first aerial are **gone** — the ground now reads as a continuous surface.
AO radius went 5 → 1.8/3.2. All three frames below are post-change; nothing here reuses a
first-pass frame.

**Remaining coverage gap.** No dock and no town wall or gate appear in any of the three
frames, so #14 and #15 stay UNVERIFIABLE. Everything else is now judged from a real frame.

**Frame stability.** `town-street-level` and `crowd-commute` re-roll which walker they frame
between runs, so they are not A/B-stable. No target below depends on an identical repeat
frame — each is judged on properties present in any street-level frame. If a future target
needs a true A/B (e.g. measuring an AO radius change), it needs a fixed-walker variant.

---

## How to judge

Each target is checkable from a single captured frame. Exit condition for this surface is
every target PASS, confirmed by screenshot. Not "critic prefers ours".

Aralia is procedural; BG3 is hand-placed. Every fix must be something a **generator** can do
for every burg at every seed. Never resolve a target by hand-authoring a town.

### The surface-detail metric (used by #1 and #5)

"Reads as a material" was too soft to verify, so it is now measured. Over a flat, evenly-lit
patch of the surface, take the mean absolute horizontal neighbour difference in luminance
(`mean|dx|`) and the max. Calibrated on the references, **downscaled to our 1170 px frame
width so features occupy the same pixel count**:

| Surface | mean\|dx\| | max |
|---|---|---|
| BG3 timber + stone wall | 5.45 | 122 |
| BG3 cobble street | 5.84 | 68 |
| BG3 ashlar stone wall | 8.20 | 126 |
| **Ours — building wall** | **0.19** | **3** |
| **Ours — street surface** | **0.43** | **9** |

A 13–43x gap. **Bar: mean|dx| ≥ 3.0 with max ≥ 30** on a flat evenly-lit patch. Below ~1.0 the
surface carries no per-unit detail at all, which is where both of ours sit — our max deltas
(3 and 9) are smaller than BG3's *mean*. Any critic can re-run this on a crop; it is a few
lines of PIL over `abs(p[x,y]-p[x+1,y])`.

---

## 1. Street surface reads as material

**Target:** A street surface carries per-unit detail — individual stones, boards, or rut and
grain variation — meeting **mean|dx| ≥ 3.0, max ≥ 30**. A viewer must be able to name what the
street is made of. Two flat tints separated by a straight line is not a material.

**Status: FAIL.** Measured on `crowd-commute.png` street surface: **mean|dx| 0.43, max 9** —
against a bar of 3.0/30 and a BG3 cobble street at 5.84/68. Confirmed at the correct camera
now: in `_sl-street.png` the street at eye height is a flat tan band with a straight edge, no
stones, no boards, no ruts. The terrain uv fix did not touch this — the street is its own
ribbon mesh, not terrain, so it did not inherit the corrected texture sampling.

## 2. Street edge is geometry, not a colour band

**Target:** The roadway/ground boundary has vertical relief — kerb, gutter, or worn shoulder —
visible as a thickness edge with its own shading, not a colour change within one flat plane.

**Status: FAIL.** Unchanged. In `_sl-bldg-base.png` and `_crop-road-seam.png` the verge is
coplanar with the roadway: no height step, no shadow line along the join, albedo only. BG3's
kerb is a raised course casting its own shadow onto the roadway.

## 3. Road segments join without a seam

**Target:** No visible notch, step, or discontinuity where road segments meet, at any camera
distance.

**Status: FAIL.** Still present in the new aerial (`town-street-aerial.png`, the ribbon notch
mid-frame), and a second step is visible at street level in `_sl-bldg-base.png` where the
ribbon edge jogs sideways. Generator/mesh-stitching defect, visible at every camera height.

## 4. Where a road crosses water there is a crossing structure

**Target:** A road meeting water terminates, fords with a visible bed and bank transition, or
carries a bridge with deck, abutments and supports. It must never simply continue across open
water.

**Status: FAIL.** Unchanged in the new aerial: the ribbon runs straight across the water
polygon, water visible beneath the verge on both sides, no bridge, abutment, pier or ford bed.

## 5. Building walls carry material and trim

**Target:** An exterior wall shows a material meeting **mean|dx| ≥ 3.0, max ≥ 30**, plus at
least one horizontal articulation — plinth, string course, storey line, or corner quoin.

**Status: FAIL.** Measured on `crowd-commute.png`, where a wall fills half the frame at close
range — the most favourable possible test: **mean|dx| 0.19, max 3.** That is a pure lighting
gradient across a large quad; there is no texture at any frequency. Against a BG3 ashlar wall
at 8.20/126. No plinth, no string course, no quoin, no timber frame in any of the three frames.

## 6. Windows and doors exist and are recessed

**Target:** Every inhabited building shows window and door openings, each recessed into the
wall depth (a visible reveal or shadow on at least one side, proving thickness) or framed by a
projecting surround.

**Status: FAIL.** Still not one window or door on any building in any of the three frames,
including the close wall in `crowd-commute.png` and the two large façades in
`town-street-level.png`. Buildings remain sealed boxes. This is the single biggest gap: BG3's
street-level bar (`lowercity-street-elfsong-groundlevel.jpg`) is *made of* arched recessed
windows with shutters.

## 7. Roofs carry material and edge detail

**Target:** A roof plane shows its covering (tile rows, thatch, plank courses) and at least one
edge feature — ridge cap, eaves overhang casting a shadow line onto its own wall, or a chimney.

**Status: FAIL, marginally improved.** Roof planes remain flat untextured quads with no
covering detail and no chimneys anywhere. **One partial credit:** `town-street-level.png` shows
small angled eave tabs projecting past the wall plane at the roofline, so a minimal overhang
does exist in the geometry — but it is too shallow to throw a readable shadow line onto the
wall below, which is the thing the target asks for.

## 8. Roof and mass form varies between plots

**Target:** From above, adjacent buildings differ in footprint, height, roof pitch and roof form
so the settlement does not read as one repeated stamp.

**Status: PASS (weak).** Holds in the new aerial: pyramidal, hipped, gabled, shed and lean-to
forms at differing pitches, footprints and heights. Weak only because with #5–#7 failing, form
is still the only thing distinguishing one building from the next.

## 9. Object–ground contact darkens

**Target:** Building, tree and prop bases visibly darken where they meet the ground; nothing
appears to hover. Verified by a vertical luminance profile outward from a wall base: a dark
trough at the contact decaying to an unoccluded plateau.

**Status: PASS — measured, and this reverses my first-pass FAIL.** Profile below a building
base in `town-street-aerial.png`, 80 px wide, stepping outward:

```
        y=270   274   278   282   286   290   294   ...   314   318
new     44.2   30.8  34.5  39.6  47.6  53.8  53.6        56.1  55.1   <- trough, then plateau
old     58.9   85.8 106.2 102.5 100.7  92.5  77.0        64.6  63.5   <- no trough at all
```

The new frame shows a clean contact trough: **30.8 at the base rising to a ~53 plateau by
16 px out — 42% darker at contact**, decaying smoothly. That is the AO signature. The old frame
had the *opposite* profile — brightest exactly at the base — confirming the first-pass FAIL was
real and that this is a genuine change, not a re-reading.

**I withdraw my first-pass hypothesis.** I proposed towns need a *larger* AO radius than
world3d-ground because their occluders are 10–30 m building masses. That is **refuted by
observation**: at the shipped 1.8/3.2 the town building bases seat correctly. I was reasoning
from occluder size and did not test it; the measurement says radius does not need to scale with
occluder size here. Towns need no town-specific value, and the world3d critic's finding that
larger radii dim unoccluded ground stands unchallenged by anything on this surface.

**One thing I cannot isolate, stated rather than glossed:** the unoccluded plateau also moved
(old ~63, new ~53). Three changes landed in the same interval — AO radius, the terrain uv fix,
and smooth shading — so I cannot attribute that shift to AO from this A/B. It is not evidence
of AO dimming open ground, and it is not evidence against it. Isolating it needs a single-
variable capture, which these scenarios cannot currently give (see frame-stability note above).

## 10. Ground scatter is masked against non-soil surfaces

**Target:** Zero grass tufts on open water. Zero tufts standing on a paved roadway. Growth in
paving joints at the edges is correct and wanted; growth on the road centreline or on a water
plane is not.

**Status: FAIL — hard defect, unchanged.** The new aerial still shows grass tufts standing
upright on top of the open water polygon, well inside it, and tufts on the street verge. The
scatter pass is running against the terrain heightfield with no awareness of the water and
street masks the same generator already produces.

## 11. Water beside a town reads as water

**Target:** Depth-tinted transparency, a shoreline transition rather than a hard polygon edge,
and surface normal motion.

**Status: FAIL, with one real improvement.** `town-street-level.png` now shows a **specular
sun streak** across the water from the low dusk sun, so the surface does respond to light
directionally. But it is still a uniform opaque blue polygon with a hard straight edge against
the ground, no depth tint, no shoreline. Same root cause as `world3d-ground` #4 — **not a
separate work item**, it resolves with that one. Kept here because water is in frame in two of
three town scenarios and because #4 above is a town-specific consequence.

## 12. Props and clutter break silhouettes at street level

**Target:** Free-standing clutter — barrels, crates, carts, stalls, fences, signage, lamps,
planters — against building faces and along street edges, in enough quantity that no building's
ground-floor silhouette is an uninterrupted straight line.

**Status: FAIL — but I must correct my first-pass claim.** I wrote "zero props of any kind" from
the aerial. That was wrong. `_cc-prop.png` resolves a genuine street prop: a dark post with a
crossbar head and a small pale sign board, standing with its base on the street surface. Props
exist in the generator.

The target still fails on **density**: across three frames at three cameras I can identify
**one** prop. Every building's ground-floor silhouette in all three frames is still an
uninterrupted straight line from corner to corner. BG3's street bar puts barrels, crates,
potted plants, a chalkboard sign and an awning against a *single* shopfront.

## 13. Street legibility at the captured hour

**Target:** At a lit hour, building faces, street surface and props are all legible in one
frame. No large in-frame mass collapses to near-black with no readable form. Measured: less
than ~8% of frame pixels below luminance 12.

**Status: FAIL, and worse at street level.** Measured fraction of frame below luminance 12:
**aerial 7.2%** (borderline pass), **street level 27.1%** (below luminance 8: 21.3%). In
`town-street-level.png` the two central and right façades are pure black masses filling roughly
a third of the frame with no discernible form, edge or material. BG3's dusk and shadow-side
surfaces stay readable because they still receive bounce; ours receive almost none.

## 14. Docks meet water cleanly

**Target:** Decking sits above the waterline with a visible gap, on piles that enter the water.
Each pile darkens at the waterline. The volume under the deck is occluded. No dock floats above
nothing and none intersects the water plane.

**Status: UNVERIFIABLE.** No dock in any of the three frames. **Framing needed:** a waterfront
burg posed low enough to see the deck-to-water junction and the piles below deck — the geometry
the BG3 dock bar is built on is entirely below deck level.

## 15. Walls and gates read as stone courses with thickness at the opening

**Target:** A town wall shows coursed masonry (mean|dx| ≥ 3.0). The gate opening reads as a
passage with depth: wall thickness visible in the reveal, passage interior darker than the lit
face.

**Status: UNVERIFIABLE.** No wall and no gate in any of the three frames. **Framing needed:** a
walled burg posed square-on to a gate at roughly lintel height, close enough that the reveal is
more than a few pixels deep.

## 16. A street reads at eye height

**Target:** From street level the frame resolves: street material underfoot, at least two
building façades with openings, props at the frame edges, and a sky or skyline gap between the
roofs.

**Status: FAIL — now verifiable, and it fails on three of four clauses.** `town-street-level.png`
gives a genuine street-level pose. It resolves: street material **no** (flat tan ribbon, #1);
two façades with openings **no** (two façades, zero openings, and both near-black, #6/#13);
props at frame edges **no** (none in this frame, #12); sky gap between roofs **yes** — there is
a clear lavender skyline strip above the rooflines, and the roofline silhouette against it is
the most legible thing in the frame.

This target's value was diagnostic and it paid off: the street-level camera did not reveal new
failures so much as show that the aerial was *flattering* us. A wall filling half of
`crowd-commute.png` at close range measures mean|dx| 0.19 — the untextured read is worse up
close, not better.

## 17. Townsfolk populate the street

**Target:** Walking figures present, standing on street surfaces rather than clipping through
buildings or standing on adjacent ground.

**Status: FAIL on placement, after the rig fix.** Presence is real — the scenario now produces
walkers, and my first-pass "no walkers" blocker was a rig bug I correctly refused to score as an
art failure. But in both street-level frames the framed walker stands on the **grass beside** the
street, not on it: in `_sl-street.png` the figure is in front of the street band on the verge,
and in `crowd-commute.png` it stands on the grass strip hard against a building wall. Two of two
framed walkers are off the street surface. For a scenario named `crowd-commute` on a street
surface, that is a placement failure worth measuring.

**Caveat:** these scenarios frame whichever walker is farthest from a building, which may bias
toward walkers at street edges. Two samples is thin. A frame showing the whole crowd at once
would settle whether the crowd as a body walks on streets.

## 18. Townsfolk read as people at conversation distance

**Target:** At the distance `crowd-commute` frames, a figure shows separable materials (skin vs
cloth vs leather), some silhouette variety between individuals, and terminated limbs — feet, not
cut tubes.

**Status: FAIL.** `_cc-feet.png` and `_sl-walker.png`: the figure is a single flat untextured
orange material over the entire body — no skin/cloth distinction, no face, no hair, no
equipment, no per-individual variation. **The legs terminate in blunt cut cylinders with no foot
geometry at all.** It reads as a debug capsule, not a townsperson. BG3's equivalent distance
shows fabric weave, leather, hair and skin responding differently to the same light.

*Honest limit:* the feet sit inside the building's cast shadow, so I cannot separate "no contact
darkening" from "already dark" at that spot. The missing foot geometry is unambiguous; the
grounding is not judgeable from this frame.

---

## Honest scoring, second pass

**2 of 18 PASS. 14 FAIL. 2 UNVERIFIABLE.** (First pass: 1 of 17 PASS, 12 FAIL, 4 UNVERIFIABLE.)

Net movement: **#9 ambient occlusion FAIL → PASS**, measured. #17 and #16 converted from
UNVERIFIABLE to judged FAIL. #18 is new, split out of #17 because "are there people" and "do
they look like people" are different questions with different owners. #7 and #11 gained partial
credit without passing.

Three corrections to my own first pass, recorded rather than quietly dropped:

- **My AO hypothesis was wrong.** I argued towns would need a larger radius for building-scale
  occluders. Measurement at the shipped 1.8/3.2 shows bases seat correctly. Retracted.
- **"Zero props" was wrong.** There is a real signpost prop in `crowd-commute.png`. The failure
  is density, not existence.
- **The aerial was flattering us.** Every material target reads *worse* at street level, not
  better.

Still split from the fidelity work, and still the two cheapest wins:

- **#10 scatter masking** — grass on open water and on the roadway. Masks already exist and are
  not being consulted.
- **#4 / #3 road-water crossing and segment seams** — a road ribbon floating across water, and
  visible joins. Geometry correctness, visible at every camera height.

Highest visual return per unit of work, judged from the three frames:

1. **#10 scatter masking** — smallest change, removes what a viewer reads as "broken".
2. **#4 / #3 road geometry** — pays off in every future frame at every camera height.
3. **#6 window and door openings** — buildings have *none*. Openings alone move the read from
   "boxes" to "buildings" further than any texture, and are pure generator work.
4. **#13 dusk legibility** — 27% of the street-level frame is unreadable black. Cheap
   (ambient/bounce term) and it currently hides whatever else gets fixed.
5. **#1 street material** and **#5 wall material** — the biggest jobs; both need a texturing
   route this surface does not have. Now measurable: bar is mean|dx| ≥ 3.0, max ≥ 30.
6. **#18 walker material and feet** — the figure is a flat capsule; feet are missing entirely.
7. **#12 prop density** and **#17 walker placement on streets**.

Blocked on framing: **#15** (walled-burg gate pose), **#14** (waterfront dock pose). Both need a
burg with the feature present, not just a new camera angle.
