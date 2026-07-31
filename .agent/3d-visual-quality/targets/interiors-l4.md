# Targets — Interiors (L4)

**BG3 counterpart:** BG3 taverns, houses and temples — lighting by hour, hearths,
occupants, furnishings, window light.

**References used:** `references/bg3/interiors-l4/` — 6 verified gameplay frames, see
that folder's `SOURCES.md`. Primary daylight bar:
`tavern-blushing-mermaid-interior.png`. Primary night bar:
`cellar-blushing-mermaid-storage.png`.

**Ours judged:** `captures/critic-interiors/interior-hearth-day.png` (hour 8),
`interior-hearth-night.png` (hour 22) and `interior-villager.png` (hour 20), all
captured 2026-07-30 from the live surface via `tools/vistest/shoot.ts`. Scored in the
"Verdict, 2026-07-30" section at the bottom: **0 PASS, 7 FAIL, 3 UNVERIFIABLE.**

---

## How to judge

Each target is checkable from one captured frame (or, where stated, from a matched
pair of frames at two hours). Exit condition for this surface is every target PASS,
confirmed by screenshot from the live surface. Not "critic prefers ours".

Aralia is procedural; BG3 is hand-placed. Every fix must be something the
**generator or the renderer** can do for every house it produces. Never resolve a
target by hand-placing a prop, a light, or a room.

**What already exists, so the bar tests how it READS rather than whether it is
there.** Interiors ship a live 24-hour schedule: `litHours[24]`, `hearthHours[24]`
and per-occupant `stationsByHour[24]` are baked once at generation and re-resolved
against the live clock through `InteriorHourContext` (`window.__wfAgentClock ??
clock ?? 12`). `InteriorLights.tsx` mounts up to 4 real warm `pointLight`s at
nearest lit hearths (`#ff8a3c`, intensity 14, distance 9 m, decay 2, no shadow) plus
one neutral camera-following fill (`#fff2e0`, 1.15, distance 14) that fades in when
the camera is inside a shell. Windows are **emissive material only** — no light is
emitted into the room from a window. Ambient occlusion (N8AO) is wired into
`World3DScene`'s ground profile, which interiors render through, so contact
darkening in interior frames is new and expected.

So the questions below are not "is there a hearth light" — there is one. They are
"does the frame read like a room lit by a fire".

---

## 1. Hearth is a real light source, not a glowing box

**Target:** In a frame with a lit hearth, the hearth's light is visible **on
surfaces the hearth does not touch** — the floor in front of it, the wall beside it,
the underside of nearby furniture — brightest at the hearth and falling off with
distance. Judge by picking three points on the floor at increasing distance from the
hearth along one line: brightness must decrease monotonically and visibly at each
step. A hearth that is bright only on its own geometry, with the surrounding floor at
the same value as floor across the room, FAILS.

Reference: `tavern-blushing-mermaid-interior.png`, upper-centre room — the hearth's
warm pool washes the hearthstone, the floor in front, and the wall beside it, and is
clearly gone by the far side of the same room.

**Status: FAIL** - scored 2026-07-30, see verdict target 1.

## 2. Hearth light is warm, and warmer than everything else in frame

**Target:** The hearth's contribution is unambiguously warmer in hue than any
daylight or fill in the same frame — sample the lit floor near the hearth and the
lit floor near a window; the hearth sample must be visibly more orange/red, not just
brighter. Two warm sources of the same hue as the general room light FAIL: the room
then reads as uniformly tinted rather than as lit by a fire.

Reference: `house-elfsong-private-room.png` — the two lantern pools are orange
against floor that daylight renders cool grey-brown; the difference is obvious at a
glance.

**Status: FAIL** - scored 2026-07-30, see verdict target 2.

## 3. Hearth flicker

**Target:** Two frames captured ~0.4 s apart at the same camera and same hour show a
**measurably different** brightness on the floor immediately in front of the hearth
(and ideally a small position or radius wobble), while the rest of the room is
unchanged. Identical hearth-adjacent pixels across the pair FAILS.

This needs a two-frame capture at one hour, which is a *different* rig requirement
from the hour variants in targets 8–10. Note it separately when asking for rig work.

**Status: UNVERIFIABLE** - needs a two-frame capture, which still does not exist. See verdict target 3.

## 4. Window light enters the room as directional shafts

**Target:** In a daylight frame, each window that is lit throws a **bounded, shaped
patch of light onto interior geometry** — floor, wall, or a piece of furniture —
offset from the window in the direction the sun is coming from, with an edge you can
trace. The patch must be brighter than adjacent unlit floor and must land on
something other than the window plane itself. A bright window pane with no
corresponding bright patch inside the room FAILS this target outright, however
bright the pane is.

References: `tavern-blushing-mermaid-bar-counter.png` and
`house-elfsong-private-room.png` both show the lattice pattern projected as a sharp
parallelogram on floor and counter.

**Prediction from source, NOT a verdict:** windows are emissive material only
(`InteriorHourContext` sets `emissive: #ffb066, emissiveIntensity: 1.1` on lit
window parts); no window mounts a light, so nothing can be cast into the room. If
the frame confirms that, the fix is renderer-side and generator-safe: derive a
per-window directional or spot contribution from the window part's position, normal
and the existing sun direction. Do not resolve it by raising `emissiveIntensity` —
that brightens the pane and changes nothing inside the room.

**Status: FAIL** - scored 2026-07-30, see verdict target 4.

## 5. Distinct materials per surface

**Target:** In one frame, plaster wall, timber (floor plank or beam), stone, cloth
and metal are each identifiable as that material **by their response to light**, not
only by their base colour. Concretely, checkable from the frame: at least three
distinct specular behaviours are visible — a broad soft sheen on one surface (timber
or tile), a tight bright highlight on another (metal), and a matte surface with no
highlight at all (plaster or cloth). Five surfaces that all shade as flat matte
boxes in five different tints FAIL, even if the tints are well chosen.

Reference: `tavern-elfsong-kitchen-interior.png` — in one frame: matte plaster,
patterned tile, wet-specular floor tile, satin timber rail, hard-highlight copper.

**Prediction from source, NOT a verdict:** interior parts carry `colorHex` only
(`FLOOR_COLOR`, `INTERIOR_WALL_COLOR`, `DOOR_LEAF_COLOR`, `STAIR_COLOR`,
`PERIMETER_WALL_COLORS`); no per-part roughness or metalness appears in
`interiorParts.ts`. If the frame shows uniform matte shading, the generator-friendly
fix is a small `materialDetailKind` → (roughness, metalness) table applied at the
renderer, keyed off the tag the part already carries.

**Status: FAIL** - scored 2026-07-30, see verdict target 5.

## 6. Occupants are lit by the room

**Target:** An occupant standing near a lit hearth is **brighter on the side facing
the hearth than on the side facing away**, and warmer in hue on that side. Two
occupants at different distances from the hearth must not be equally lit. A figure
with even brightness across its whole body, or two figures identically lit at
different distances, FAILS — that is flat ambient wearing a costume.

Reference: no single reference frame in this folder isolates a figure; judge against
target 1's falloff behaviour applied to a body.

**Prediction from source, NOT a verdict:** `InteriorLights` mounts a neutral
camera-following fill (`#fff2e0`, intensity 1.15, distance 14) that fades in
whenever the camera is inside a shell. Because it sits *at the camera*, it lights
every visible surface head-on with no directionality — it is structurally the flat
ambient this target rejects, and it will fight targets 1, 2, 6, 8 and 9 wherever the
camera is indoors. The generator-safe direction is to shrink the fill until it only
rescues legibility in a genuinely unlit room and let the hearth and window
contributions carry the modelling, rather than removing legibility outright.

**Status: UNVERIFIABLE** - no occupant appears in any captured frame, including the
one named `interior-villager`. See verdict target 6. The prediction above was
measured and is partly WRONG; see "Correcting my own prediction about the camera
fill" in the verdict.

## 7. Furnishing density and silhouette variety

**Target:** From a frame that shows a whole room, count the distinct furnishing
silhouettes — a "silhouette" being an object whose outline is separable from its
neighbours. A living room must show **at least 6**, and **at least 4 distinct
shapes** among them (i.e. not six boxes). At least one object must break the wall
line by standing away from a wall, and at least one must overlap another in the
frame so the room reads as occupied depth rather than as a floor plan with props
around the edge.

References: `house-elfsong-private-room.png` (bed, two chairs, couch, two tables,
dresser, screen, crib, lanterns, rug — overlapping, several off-wall) and
`tavern-blushing-mermaid-bar-counter.png` (bar, three stools, barrel, shelving,
stove, cauldron, hanging net).

**Status: UNVERIFIABLE** - framing shows a corner, not a room. See verdict target 7.

## 8. The 8am read

**Target:** A frame at hour 8 reads as **daylight-driven**: window openings are the
brightest thing in frame, at least one window shaft lands inside the room (target
4), and hearth/lamp sources are either off or clearly subordinate to the daylight.
The room is legible without any camera-attached fill. A frame at 8am that is
indistinguishable from the same room at 10pm FAILS.

**Status: FAIL** - scored 2026-07-30, see verdict target 8.

## 9. The 10pm read

**Target:** A frame at hour 22 reads as **fire/lamp-driven**: no window is a bright
source, the hearth or lamps are the brightest things in frame, the room shows a
strong brightness gradient from the source outward, and parts of the room are dark
enough to lose surface detail while objects there remain readable by silhouette. A
uniformly dim room with no bright source, and a uniformly readable room with no dark
corner, both FAIL.

Reference: `cellar-blushing-mermaid-storage.png` — one warm source, hard gradient,
half the room in near-black with barrels still readable.

**Status: FAIL** - scored 2026-07-30, see verdict target 9.

## 10. Hour variants differ, and differ in the right direction

**Target:** Judged from a matched **pair** of frames at hour 8 and hour 22, same
camera, same seed, same building. Three things must all change: (a) mean frame
brightness drops from 8 to 22; (b) the brightest region moves from the window
openings to the hearth/lamps; (c) the mean hue of lit floor shifts warmer at 22.
A pair where only overall exposure changed FAILS — that is a global tint, not
lighting by hour.

The 24-hour schedule data is known to move (recorded proof: lit windows 0 at noon →
26 at dusk → 0; hearths 0 → 9 → 0; occupants ~892 midday ↔ ~1581 night, same bake,
clock scrubbed). This target tests whether that data change is visible **in the
frame**, which the scene-graph count cannot tell us.

**Status: FAIL** - scored 2026-07-30, see verdict target 10.

---

## Verdict, 2026-07-30 — 0 PASS / 7 FAIL / 3 UNVERIFIABLE

**Frames judged** (captured 2026-07-30 from the live surface, all three personally
opened and read, then measured in Pillow):

- `captures/critic-interiors/interior-hearth-day.png` (hour 8)
- `captures/critic-interiors/interior-hearth-night.png` (hour 22)
- `captures/critic-interiors/interior-villager.png` (hour 20)

All three show the **same room and the same camera pose** — same window on the left
wall, same box in the corner, same two grass tufts at the same pixel positions.

Frame-wide numbers, 1170×654:

| | mean lum | p5 | p95 | max | mean RGB |
|---|---|---|---|---|---|
| hour 8 | 47.99 | 4.6 | 116.8 | 121.7 | (74, 43, 22) |
| hour 22 | 59.66 | — | — | 202.3 | (87, 54, 30) |
| hour 20 (villager) | 111.29 | 33.2 | 192.9 | 207.5 | (175, 99, 47) |

---

### 1. Hearth is a real light source — **FAIL**

Four floor patches sampled along one line running away from the hearth base:

| patch | day lum | night lum |
|---|---|---|
| A, hard against the hearth base | **44.07** | 43.94 |
| B | 54.76 | 54.72 |
| C | 57.90 | 57.89 |
| D, far left floor | 52.70 | 52.70 |

The target requires monotonic decrease with distance. The measured sequence is
44 → 55 → 58 → 53: **the floor nearest the hearth is the darkest floor in the
frame**, and the gradient that does exist is ambient occlusion darkening the base,
not light leaving the fire. The hearth contributes no measurable illumination to any
surface it does not itself occupy.

It is also identical at hour 8 and hour 22 (44.07 vs 43.94, a 0.13 delta on a 0–255
scale), so no hearth is switching on at either hour in this building.

### 2. Hearth light is warm, and warmest in frame — **FAIL**

Floor beside the hearth is rgb(63, 40, 25), R−B = **38**. Floor at the far side of
the room is rgb(75, 48, 31), R−B = **44**. The floor **furthest** from the hearth is
the warmer one. The target's test is inverted by the measurement.

The hearth's own faces confirm it is not emitting: front face rgb(129, 27, 10) but
side face rgb(23, 2, 0). An emissive surface does not go to near-black on a face
turned away from the camera — that is plain Lambert shading on a flat red box, which
matches the framing agent's finding 4.

### 3. Hearth flicker — **UNVERIFIABLE**

Still no two-frame-at-one-hour capture. This is the one rig ask that was not met, and
I am not scoring it.

Adjacent evidence worth recording: the hearth front face reads 47.35 at hour 8 and
47.34 at hour 22 — identical to two decimal places across a 14-hour gap. Whatever
flicker will eventually be judged, nothing about this hearth currently varies at all.

### 4. Window light enters as directional shafts — **FAIL, conclusively**

This is the cleanest measurement on the surface. At hour 22 the window pane reads
**198.05** lum — the brightest thing in frame by a wide margin. The wall patch ~130 px
to its left, on the same wall plane, reads:

- hour 8: **12.72**, rgb(20, 11, 6)
- hour 22: **12.72**, rgb(20, 11, 6)

Identical. A source at 198 lum contributes **exactly zero** to the wall beside it. No
patch of light lands anywhere on floor, wall or furniture in either frame. The pane
is an emissive rectangle facing the camera and nothing more, which confirms the
source read (`InteriorHourContext` sets `emissive #ffb066` on lit window parts; no
window mounts a light).

**Do not fix this by raising `emissiveIntensity`.** It would brighten a rectangle that
already reads at 198 and change nothing inside the room. The generator-safe fix is a
per-window light contribution derived from the window part's position, normal and the
existing sun direction.

### 5. Distinct materials per surface — **FAIL**

The target needs three distinct specular behaviours in one frame. There are zero.
Nothing in any of the three frames carries a highlight: the hour-8 frame's maximum
luminance anywhere is 121.7, and it sits on a broad diffuse wall, not on a small
bright spot. Every surface — wall, floor, hearth, door panel — shades as matte
Lambert on a flat base colour.

What variation exists is texture, not material response: the right wall carries
low-frequency mottled noise and the floor carries faint plank seams. That is
`colorHex` plus a detail map, exactly as `interiorParts.ts` implies. Plaster, timber,
stone, cloth and metal are not separable by their response to light because they have
no differing response to light.

### 6. Occupants are lit by the room — **UNVERIFIABLE**

**There is no occupant in any of the three frames, including the one named
`interior-villager` at hour 20.** I looked at all three and there is no humanoid body
anywhere in them.

This is not a lighting verdict — there is no body to light. It independently
corroborates the framing agent's finding 1 (residents ignoring their hourly stations),
observed from the frame rather than from the data: the scenario stages the camera from
occupant data and still frames an empty corner.

### 7. Furnishing density and silhouette variety — **UNVERIFIABLE (framing)**

The target is written against "a frame that shows a whole room". None of the three
frames does — all show a corner spanning roughly 3–4 m of floor. I am not scoring a
whole-room test on a corner crop.

Recorded observables, which the eventual scorer should keep: exactly **one**
furnishing object is visible in the entire frame (the hearth box). The only other
non-architectural silhouettes present are **two grass tufts standing on the interior
floor** — exterior ground cover rendering through the floor slab, confirming the
framing agent's finding 3. Green-pixel sampling puts them at y 554–652, i.e. sitting
on the visible floor, in all three frames.

### 8. The 8am read — **FAIL**

The target requires window openings to be the brightest thing in frame. At hour 8 the
window pane reads **23.47** lum. The floor reads 52.32 and the right wall reads
102.09. **The window is the darkest large feature in the frame** — darker than the
floor by more than 2×. There is no shaft (see target 4). The frame is not
daylight-driven in any measurable sense; it is lit by an off-frame warm source that
does not come through the window.

### 9. The 10pm read — **FAIL**

At hour 22 there is a bright source — but it is the **window**, at 198 lum, and it
lights nothing. The hearth, which the target requires to be the brightest thing, sits
at 47. There is no brightness gradient running outward from any source: the floor
sequence 44 → 55 → 58 → 53 is occlusion, not falloff.

The room does hold deep shadow (p5 = 4.6 at hour 8, and the left wall at 12.7), so the
"dark enough to lose detail" half of the target is met. The half that matters — a
dominant fire/lamp source with a gradient — is not.

### 10. Hour variants differ in the right direction — **FAIL on all three clauses**

Measured across the matched pair:

- **(a) mean brightness must drop from 8 to 22.** It **rises**: 47.99 → 59.66. Wrong
  direction. The room is objectively brighter at 10pm than at 8am, confirming the
  framing agent's finding 2 with numbers.
- **(b) the brightest region must move from windows to hearth/lamps.** It moves the
  other way — **to** the window. Frame max goes 121.7 → 202.3, and that maximum is
  the window pane.
- **(c) lit floor must shift warmer at 22.** The floor is unchanged: floor-centre
  reads 52.32 at hour 8 and 50.93 at hour 22.

The decisive number: **only 8.07 % of pixels differ at all** between the two hours
(61,776 of 765,180 above a threshold of 8). A 6×4 grid of mean absolute difference
puts all of that change inside the two grid columns containing the window; the
remaining 20 cells read 0.00–3.64, most of them 0.00. **Nothing in the room responds
to the hour except the window pane's own emissive value.**

The 24-hour schedule data does move — that was proven previously by scene-graph
counting. This capture shows that movement is not reaching the rendered image beyond
one rectangle.

---

## Unlisted PASS worth recording: ambient occlusion

AO is genuinely working and is the only lighting cue currently doing real work in
these frames. Scanning down the right wall into the floor junction at x = 1000, hour
8: 79.3 → 74.1 → 70.0 → 65.7 → 62.1 → 57.8 → 51.4 → **13.9** at the corner, then
recovering 16.0 → 21.1 → 24.7 → 34.2 out across the floor. That is a real, tight
contact darkening. The hearth base shows the same signature (20.7 at the base rising
to 49.2 out across the floor).

Nothing is floating. Given how little else is contributing, AO is carrying the entire
sense of three-dimensionality in the frame.

## Correcting my own prediction about the camera fill

I predicted the camera-following fill would flatten the frame and fight targets 1, 2,
6, 8 and 9. Measured, that is **half right, and I was overstating it.**

`interior-villager` (hour 20) and `interior-hearth-day` (hour 8) are the same room at
the same pose, and the villager frame is 2.3× brighter overall (111.29 vs 47.99). But
strong directionality survives in both:

| | left wall | right wall | ratio |
|---|---|---|---|
| hearth-day | 12.7 | 102.1 | **8.0 : 1** |
| villager | 45.0 | 148.6 | **3.3 : 1** |

So the fill measurably compresses directional contrast — 8:1 down to 3.3:1 — but it
does not wash the image flat, and a strong warm gradient from off-frame right
dominates both frames. My "structurally the flat ambient this target rejects" wording
was too strong. The frame is directionally lit; it is just not lit by anything inside
the room.

I cannot tell from a frame which emitter that off-frame warm source is. The
load-bearing fact is not its identity but its **invariance**: it is pixel-identical at
hour 8 and hour 22.

---

## Scoring and priority

**0 of 10 PASS. 7 FAIL (1, 2, 4, 5, 8, 9, 10). 3 UNVERIFIABLE (3, 6, 7).**

Highest visual return per unit of work, judged from these three frames:

1. **Windows must emit light (#4).** It cascades into 8, 9 and 10 — three more targets
   fail purely because the only hour-varying element in the room lights nothing. One
   fix, four targets.
2. **The hearth must emit light (#1, #2).** The pointLight machinery already exists in
   `InteriorLights.tsx`; the frame shows no hearth lit at either hour in this
   building, so the question is whether `hearthHours` is ever true here and whether
   the light's 9 m distance / intensity 14 survives at this camera. Measure before
   changing numbers.
3. **Occupants must actually be at their stations (#6).** No body appeared in the
   frame named for one. Nothing about occupant lighting can be judged until one does.
4. **Grass through the floor (#7 observable).** Cheap, and it is the single most
   obviously broken thing in the frame.
5. **Per-material roughness/metalness (#5).** The largest job; leave it until the room
   has light worth responding to.

## Still needed from the rig

Only one ask remains open: **a two-frame capture ~0.4 s apart at one hour, same
camera**, for target 3. No single-frame scenario can ever test flicker.

A second, softer ask: a scenario framing a **whole room** rather than a corner, so
target 7 (furnishing density and silhouette variety) becomes scorable at all.
