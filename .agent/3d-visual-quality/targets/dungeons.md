# Targets — Dungeons

**BG3 counterpart:** the Underdark, Moonrise Towers, Grymforge, the Gauntlet of Shar, the
Shadowfell.

**Two deliverables, two different bars.** This surface ships a 3D walkthrough AND a 2D
hand-inked module sheet. They are NOT judged against the same reference. Section A is judged
against BG3. Section B is NOT — see the attribution correction below.

**Captures judged**, all taken 2026-07-30 from the live surface and all read with the Read
tool before scoring:

```
npx tsx tools/vistest/shoot.ts --fresh-module src/App.tsx \
  --base http://localhost:3000/Aralia/ \
  --out .agent/3d-visual-quality/captures/critic-dungeons \
  --only dungeon-3d-entrance-room,dungeon-parchment-sheet,dungeon-parchment-linework
```

| Capture | Size | Used for |
|---|---|---|
| `captures/critic-dungeons/dungeon-3d-entrance-room.png` | 1438×608 | Section A |
| `captures/critic-dungeons/dungeon-parchment-sheet.png` | 1600×1000 | Section B |
| `captures/critic-dungeons/CROP-linework-4x.png` | 4× crop of the sheet | B2–B4, B8 |
| `captures/critic-dungeons/CROP-3d-litzone-brightened.png` | 3× crop, +90% exposure | A2, A3, A5 |

**Rig gap found:** `dungeon-parchment-linework.png` is **byte-identical** to
`dungeon-parchment-sheet.png` (both md5 `f67fdddd…`). The linework scenario's zoom step did
not take effect, so there is currently no genuine critique-distance 2D capture. I worked
around it by cropping the full plate myself (the two `CROP-*` files above, generated with
`sharp`), which is enough to score B2–B4 and B8 but should be fixed in the scenario.

---

## Reference board

### BG3 3D — `references/bg3/dungeons/` (24 files, gameplay only, gitignored)

All from bg3.wiki (`https://bg3.wiki/w/images/…`), in-game screenshots. Files credited to a
named artist (Edward Vanderghote, Gert-jan van de Put, Tim Coddens, Konstantin Melnik, Elise
Rochefort, Stimona Milanova) were deliberately **excluded** — that is concept art, and the
program bans marketing art as a bar.

The four load-bearing ones, each read with the Read tool:

| File | Source | What it proves |
|---|---|---|
| `underdark-wide-bioluminescence.jpg` | `c/c5/Underdark.jpg` | Underdark wide with bioluminescence |
| `moonrise-prison-stone-corridor.jpg` | `4/4c/Moonrise_Towers_Prison.jpg` | Moonrise stone corridor, torch sconces |
| `shar-path-of-gold-torchlit.png` | `2/2d/Path_of_gold.png` | Torch falloff against a huge blue fog volume |
| `defiled-temple-stone-hall.png` | `d/db/DefiledTemple.png` | Torch-lit room, falloff on wet stone |

Also on disk: `grymforge-main-hall.jpg`, `shadowfell-justiciars.jpg`,
`shadowfell-balthazar.jpg`, `shadowfell-descent.png`, `shadowfell-shadow-crossing.png`,
`whispering-depths-spider-lair.jpg`, `underdark-ebonlake-grotto-overview.jpg`,
`underdark-ebonlake-grotto-shore.jpg`, `underdark-mushroom-minefield-glow.png`,
`underdark-omeluum-study-lit-room.png`, `underdark-phalar-aluve-glow.jpg`,
`moonrise-sanguine-laboratory.jpg`, `moonrise-ketherics-room.jpg`,
`moonrise-isobels-room.jpg`, `shar-gauntlet-lobby.jpg`, `shar-lower-east-corridor.png`,
`shar-statue-puzzle-room.png`, `shar-faith-step-trial.png`, `shar-pedestal-reckoning.png`,
`defiled-temple-moon-puzzle-room.png`.

**What the BG3 references actually establish** (observed in the images, not assumed):

- Torch sconces throw a **tight** warm pool, roughly 2–3 m of usable reach. Beyond it the
  wall is dim but never featureless. You can count the light sources by counting the pools.
- **Darkness is chromatic and still holds content.** Moonrise prison gloom is green-black,
  Path of Gold a deep saturated blue, the Shadowfell blue-violet. Crucially you can still
  read cell bars, arches and rubble inside the gloom — it hides *detail*, not *structure*.
- **Fog is a volume that occludes.** In Path of Gold a blue fog body fills the pit and
  progressively swallows the far architecture. It is not a distance tint on geometry.
- **Stone is wet.** Defiled Temple and Moonrise prison floors both show vertical specular
  streaks that are clearly reflections of the fire source.
- Warm and cool sources **coexist as different temperatures in one frame** — torch orange
  against fog blue is the signature of the whole surface.
- Grymforge shows **emissive terrain as an area light**: lava fills the cavern with warm
  bounce and throws ember particles.
- The Underdark reads **depth from fog banks catching mushroom glow**, near stalactites in
  silhouette and the far cavern *lighter* — inverted from daylight aerial perspective.

### 2D module sheets — the bar is NOT BG3, and NOT Gozzy either

**ATTRIBUTION CORRECTION — read before using either reference.**

My tasking said the 2D module sheets are judged against "Gozzy's hand-inked battlemap look".
I re-downloaded the Remy-approved Gozzy dungeon map and looked at it. **Gozzy's dungeon
battlemaps are not hand-inked.** They are digitally rendered grey checkered stone tiles on a
pure black void, with a soft bevel/glow on wall edges and doors as small white gap-with-bar
glyphs. No hatching, no paper, no pen line, no line-weight hierarchy.

Re-downloaded to `references/gozzy/dungeons/` — the `.agent/scratch/` copy named in memory no
longer exists on disk:

| File | Source |
|---|---|
| `gozzys-remy-approved-detail.jpg` | `gozzys.com/battlemap/dungeon/image?s=1713707696&c=1&t=2&g=2&z=1&v=1&a=2&dl=1` |
| `gozzys-remy-approved-1713707696.webp` | same seed, `z=3` (4200×2800) |
| `gozzys-sprawl-alt-seed-detail.jpg` | `s=1827833502&c=0&t=0&g=0&z=1&v=1&a=2&b=70&dl=1` |

Licence on the image: **CC BY 4.0**. Gotcha: the URL pattern in memory includes `&b=<px>`;
passing `b=0` returns an **empty body** — omit it or use a real bleed value.

Per memory `reference-gozzys-dungeon-battlemap`, the Gozzy look is the reference for the
**3D / tactical tile layer** (checkered stone floors, solid grid, door gap-bars, black void),
not for the parchment sheet.

The real bar for the 2D module sheet is the established in-project spec from
`dungeon-map-aesthetics-wave` (the 8-workstream overhaul, 2026-07-07): an **aged hand-inked
module sheet** with a Dyson-Logos-style drop-shadow signature, aged-vellum substrate, a value
ladder, per-theme palette triads, Chaikin-smoothed organic ink curves, ink-disc number plates
with an on-sheet KEY, and a canted compass rose. Section B targets that, and leaves Gozzy
where memory puts it.

---

## How to judge

Every target is checkable from a single captured frame. Exit condition is **every target
PASS, confirmed by screenshot** — not "critic prefers ours".

Aralia is procedural; BG3 is hand-placed. Every fix must be something a **generator** can do.
Never resolve a target by hand-authoring a dungeon.

---

# Section A — 3D dungeon walkthrough

Measured on `dungeon-3d-entrance-room.png`. Quantitative samples taken with `sharp` over
218,576 pixels (every 2nd pixel in both axes).

Frame-wide statistics, because they decide A6:

```
mean luma      9.4 / 255
p1  0.0   p5  0.2   p50  2.0   p95  46.9   p99  138.8
pure #000000 pixels: 10,213 = 4.67%
```

## A1. Torch light with real falloff

**Target:** Each torch or brazier in frame produces its own visible pool of light whose
brightness decreases with distance from the source. Counting bright pools yields the number
of sources. No area is lit uniformly by a flat ambient term.

**Verify from image:** sample two points on the same wall, one adjacent to a torch and one
~3× further along. The near point must be measurably brighter.

**Status: PASS.** Measured on the same wall run: adjacent to the sconce `(770,150)` =
`189,112,35`; three times further along `(600,150)` = `44,17,2`. That is a ~4.3× luminance
drop across one wall — real distance falloff, warm-tinted, and the pool is a smooth radial
gradient in the brightened crop. Multiple independent pools are countable (sconce upper left,
the archway, a second arch behind it, discrete points at the right edge). This is the one
lighting target the surface already meets.

## A2. Moving shadow from the torch

**Target:** Geometry between a torch and a wall casts a shadow anchored to that torch's
direction, and it moves as the flame flickers. Two torches on different walls produce
shadows in different directions in the same frame.

**Verify from image:** trace each shadow along its long axis; it must converge on a visible
source. Absent or uniformly-directed shadows fail.

**Status: FAIL.** There are **no cast shadows at all**. In the brightened crop the archway,
the two pillars and the sarcophagus box all sit inside a strong nearby light and none of them
throws a shadow onto the floor or the wall behind. Shadow casting is simply off for this
surface's lights.

## A3. Wet or mineral stone material response

**Target:** Floor and wall stone show a specular response — wet sheen (elongated highlights
pointing back at the source) or mineral glitter. Stone must not read as uniform matte fill.
Wall and floor must respond *differently*.

**Verify from image:** find a floor highlight whose long axis points at a light; confirm wall
and floor differ.

**Status: FAIL.** Every surface is flat matte, untextured, and purely diffuse. There is not
one specular highlight in the frame. Walls are bare planes whose only detail is dark
geometry seam lines; the floor is a flat plane with faint dashed tile seams. Nothing in frame
reads as stone — it reads as untextured primitives. Wall and floor share one material
response.

Two additional material defects visible in the same crop:
- The arch shows **banded flat shading** across its curve — low-poly with no smoothing or
  normal detail.
- The grey cylinders on the right sample `33,24,32` — desaturated violet-grey while every
  lit surface is orange. They read as a different, unlit material dropped into a warm scene.
  This is an albedo/material inconsistency, not a lighting effect.

## A4. Depth fog as a volume

**Target:** A fog body fills the space and progressively occludes distance, so a far wall or
corridor mouth is visibly hazier and lower-contrast than a near one. Fog is tinted (cool
blue/green/violet), not grey.

**Verify from image:** compare near-wall and far-wall contrast; a receding corridor must fade.

**Status: FAIL.** There is no fog. Distance does not haze — it goes to black. `p50 = 2.0`
means half the frame has already fallen to near-zero luminance, so depth is conveyed by
falling off a cliff into black rather than by an occluding medium. Compare
`shar-path-of-gold-torchlit.png`, where the blue fog body is the single largest element in
frame and is what makes the space read as deep.

## A5. Readable floor-to-wall contact

**Target:** The seam where a wall meets the floor is darker than either surface — an ambient
occlusion gradient a few inches wide. No wall or prop appears to float, and the room
footprint is legible from the contact line alone.

**Verify from image:** follow the base of any wall. A visible darkening band along the run
passes; a hard identical-value join fails.

**Status: FAIL.** No ambient occlusion anywhere. In the brightened crop the wall/floor join
is a hard seam at identical value, and the sarcophagus box in the foreground has no contact
shadow — it visually floats on the floor plane. This is the same AO gap that World3D ground
closed with N8AO (target #6 there); note the finding recorded in `world3d-ground.md` that
`aoRadius` does **not** port between cameras and must be re-measured for this camera.

## A6. Darkness that hides without being flat black

**Target:** Unlit regions retain a chromatic tint and residual structure — you can tell a
dark corner from a dark doorway. The darkest large region must not be pure black and must
carry a hue.

**Verify from image:** sample the darkest 5% of pixels. They must be non-zero in at least one
channel, carry a colour cast, and the region must still contain discernible edges.

**Status: FAIL, and this is the headline failure.** Measured, not estimated:

- `p50 = 2.0` — **half the frame** sits at luminance ≤ 2/255.
- `p5 = 0.2`, `p1 = 0.0`.
- **4.67% of sampled pixels are exactly `#000000`.** The darkest sample is literally `0,0,0`.
- Points sampled in the gloom: `(60,250)` = `1,0,0`; `(150,500)` = `9,4,4`;
  `(1350,560)` = `9,4,4`.

So roughly half the image is dead, and a twentieth of it is mathematically pure black with
zero recoverable information. The residual tint that does exist is warm (`9,4,4`), which is
at least consistent with torchlight, but the target's second clause fails outright: nothing
is hidden-but-readable, it is simply gone. Every BG3 reference on the board keeps structure
alive in its darks — Moonrise prison's gloom still shows cell bars and arches.

## A7. Warm/cool temperature split in one frame

**Target:** A single frame contains both a warm source-lit region and a cool ambient/fog
region, and they read as different colour temperatures. This is the signature of every BG3
dungeon reference on the board.

**Verify from image:** sample a lit region and a shadowed region. Hues must differ warm vs
cool, not be the same hue at two brightnesses.

**Status: FAIL.** The lit side is strongly warm (`189,112,35`), but the shadow side is
warm-dark (`9,4,4`) — the same hue, darker. There is no cool ambient and no cool fog, so the
frame is monochromatically orange-on-black. The only cool pixels belong to the grey cylinder
props (A3) and to a UI overlay (A9), neither of which is atmosphere.

## A8. Emissive props read as light sources, not stickers

**Target:** Where the generator places an emissive element (torch flame, coals, fungus, lava,
crystal), it both glows *and* deposits light on nearby surfaces. An emissive that brightens
its own pixels while leaving neighbouring stone unchanged fails.

**Verify from image:** for each bright element, check the surface within roughly one element
width — it must be brighter there than further away.

**Status: PASS, with a colour defect.** The sconce flame does deposit a warm pool on the wall
behind it, and the archway is genuinely lit rather than self-bright. So the coupling is real.

The defect: the flame geometry itself renders as a **pure white** teardrop cone, not a warm
flame colour, and the point-light gizmo shows as a white sphere. In every BG3 reference the
fire source is the warmest, most saturated thing in frame. A white flame on top of a correct
warm pool reads as a placeholder.

## A9. Frame free of debug and UI overlay

**Target (added by this critic).** A capture used for visual judgement contains only rendered
scene content. No selection ring, party marker, gizmo, or debug helper occludes the subject.

**Verify from image:** look for saturated flat-shaded UI geometry that does not belong to the
scene.

**Status: FAIL.** A large saturated cyan marker — a cone plus a curved arc — sits dead centre
of frame, directly on top of the focal sarcophagus prop, and a white point-light gizmo sphere
is visible on the wall. These are roughly 5% of frame area at the exact point of interest.
This is a scenario-framing fix (hide markers and light helpers before the shot), not a
renderer fix, and it belongs to whoever owns the dungeon scenarios.

---

# Section B — 2D hand-inked module sheet

Judged against the `dungeon-map-aesthetics-wave` spec, NOT BG3. Measured on
`dungeon-parchment-sheet.png` (full plate) and `CROP-linework-4x.png` (4× crop of the map
body). Theme captured: `crypt`, seed `20260730`. Sheet title renders as "The Veyne Crypt"
with the flavor line "The dead woke two centuries ago. A bloom has been spreading in the dark
ever since."

## B1. Paper substrate reads as aged material

**Target:** An aged-vellum substrate with visible fibre, foxing blotches and a deckle edge —
not a flat cream fill. Tone varies across the plate.

**Verify from image:** sample background at four corners and centre; values must differ, and
grain must be visible at 100%.

**Status: PASS.** The plate is a warm cream vellum carrying clearly visible foxing — soft
irregular tonal blotches at upper right, lower left, lower centre and mid right — plus a
double-ruled border inset from a darker deckle edge. Tone is not uniform. This target is met
and looks good.

## B2. Line weight hierarchy

**Target:** At least three distinguishable ink weights: heaviest on the dungeon outer
envelope, medium on internal wall divisions, lightest on grid and hatch. Weight conveys
structural rank.

**Verify from image:** measure stroke width at an outer wall, an internal wall, and a grid
line. Three separable values pass; one uniform width fails.

**Status: PASS.** The 4× crop shows three clearly separate weights: a heavy near-black
envelope stroke around every room, a medium dashed interior line for furniture and
subdivisions, and a very light cross-hatched floor grid inside the room fill. Rank reads
correctly — the envelope dominates, the grid recedes.

## B3. Directional exterior hatching

**Target:** Hatching outside the dungeon envelope reads as hand-drawn parallel pen strokes
with consistent direction per edge, sitting outside the wall line. Not a uniform grey band,
not a gradient blur.

**Verify from image:** zoom the envelope edge — individual strokes must be countable.

**Status: FAIL.** What surrounds the envelope is a **stipple/spray**, not hatching. At 4× it
resolves into scattered dots and specks of varying density, with no linear direction anywhere
and no countable strokes. It is an effective rubble/soot texture and it does give the
envelope a halo, but the target as written — directional parallel pen strokes — is not met.

Worth a Remy call rather than a silent fix: the stipple may be the preferred look. If so,
rewrite this target to describe stipple density and halo falloff, and drop the word hatching.
Do not "fix" a look Remy approved just to satisfy my wording.

## B4. Dyson drop-shadow signature

**Target:** The envelope carries an offset drop shadow into the surrounding paper,
consistently offset in one direction across the whole plate, giving the cut-into-rock read.

**Verify from image:** check shadow offset direction at four separate envelope edges. It must
be the same vector at all four.

**Status: FAIL (partial effect present).** There is a dark halo around the envelope and it
does produce some cut-into-rock read, but it is **not a directional offset** — at 4× the
halo surrounds rooms on all sides at roughly even weight. Sampling four edges does not yield
a consistent offset vector, which is exactly the test this target specifies. The Dyson
signature is the offset; an omnidirectional halo is a different (softer) effect.

## B5. Room and corridor legibility at sheet scale

**Target:** At full-plate view every room reads as a distinct enclosed space and every
corridor as a connector. Corridor hierarchy is visible — an arterial spine distinguishable
from a spur. Doors are unambiguous glyphs at plate scale.

**Verify from image:** at full-plate view, count rooms and trace entrance to furthest room
without zooming.

**Status: FAIL, on composition rather than draughtsmanship.** Two separate problems:

1. **The map occupies roughly a third of the plate.** On a 1600×1000 capture the drawn map
   body spans about x 520–930, y 350–710. Everything above the compass block and the whole
   lower half of the sheet is empty vellum. The result is that rooms render small enough that
   room outlines and door glyphs are at the edge of legibility at plate scale, purely because
   the art is not using the page. Memory records "compact maps leave a lower-margin gap" as
   an open residual of the aesthetics wave; this capture shows it is worse than a gap — the
   plate is mostly empty. A fit-to-frame / page-fill pass on the generator would raise B5,
   B7 and B8 at once, and it is the single highest-value 2D fix.
2. **Doors are not legible at plate scale.** At 4× they resolve as small orange-brown ticks
   at wall breaks. At plate scale they effectively vanish. Contrast the Gozzy reference,
   where doors are unambiguous white gap-with-bar glyphs readable at any zoom.

What does pass inside this target: rooms are genuinely distinct enclosed forms, the octagonal
and diamond focal rooms read as focal, and the arterial spine is clearly visible as a long
double-ruled diagonal corridor with spurs branching off it. The drawing is good; the
page composition is not.

## B6. Theme palette triad

**Target:** A per-theme triad (paper / floor / wall-ink + accent) that makes the theme
identifiable from a thumbnail. Crypt honey, cavern ochre, frost cold-blue ink on warm paper,
sewer olive, fungal violet. Two themes side by side must not look like a recolour.

**Verify from image:** capture two themes at the same seed and compare at thumbnail size.

**Status: NOT SCORED — needs a second capture.** Only `dtheme=crypt` exists as a scenario.
The crypt plate does read as honey-toned with black ink and a violet accent (the bloom-field
rooms) plus a red accent on the objective room, which is promising, but a single-theme capture
cannot test the "not a recolour" clause. **Ask:** add `dungeon-parchment-sheet-frost` and
`dungeon-parchment-sheet-fungal` at the same seed.

## B7. Keyed numbering and on-sheet key

**Target:** Numbered rooms carry ink-disc number plates legible at plate scale, and the sheet
includes a KEY panel, scale bar and compass rose. Every number on the map has a matching key
entry.

**Verify from image:** read the numbers at full-plate view and check each appears in the key.

**Status: PASS on furniture, FAIL on content.** All the apparatus is present and correct: a
boxed KEY panel listing entries 1–11, a canted compass rose, a scale bar reading 0/100/200 ft,
a footer legend ("entrance / objective / S secret door / trap / red brick = walled up"), ink-disc
number plates on the map, and the objective room ringed in red so it stands out. Numbering and
key are consistent.

The content defect: **9 of the 11 key entries read "burial gallery"**. Only entries 1
(treasury), 2 (ossuary) and 9 (objective) carry information. A key whose majority is one
repeated string is decoration, not a key — and at plate scale the number discs are also at
the edge of legibility because of B5's page-fill problem. This is a generator room-naming
issue, not a drawer issue.

## B8. Furniture silhouettes at true scale

**Target:** Furniture reads as distinct recognizable silhouettes at plate scale — an altar is
not confusable with a table. Multi-cell items (coffins, long tables) read as one object, not
chained segments.

**Verify from image:** find a coffin or long table and check it reads as a single form.

**Status: FAIL, and worse than memory recorded.** Memory logged the residual as coffins
reading as "chained segments". The 4× crop shows a broader problem: **nearly every room is
filled with the same motif** — two or three short horizontal dashed bars. Room after room
repeats it. I cannot distinguish an altar from a table from a coffin from a bench anywhere on
the plate; the vocabulary has collapsed to "dashes". The exceptions are the one room with a
concentric rounded dais near the bottom, which does read as a distinct object, and the
violet bloom-field fill, which reads as a material rather than furniture.

This confirms memory's diagnosis that the fix belongs to the **generator** (furniture scale
and spacing), not to the drawer: at true cell scale the drawer's distinct silhouettes are
being emitted too small and too uniform to differentiate.

---

# Verdict — 2026-07-30

**Rig is UNBLOCKED.** `framing-capture` landed three dungeon scenarios
(`dungeon-3d-entrance-room`, `dungeon-parchment-sheet`, `dungeon-parchment-linework`) while
this file was being written, so this surface has a real verdict rather than a blocked one.
One residual rig defect: the two 2D captures are byte-identical (see Rig gap above).

## Section A — 3D walkthrough: **FAIL, 2 of 9**

| # | Target | Status |
|---|---|---|
| A1 | Torch light with real falloff | **PASS** |
| A2 | Moving shadow from the torch | FAIL |
| A3 | Wet or mineral stone material | FAIL |
| A4 | Depth fog as a volume | FAIL |
| A5 | Floor-to-wall contact | FAIL |
| A6 | Darkness that hides without flat black | FAIL |
| A7 | Warm/cool split in one frame | FAIL |
| A8 | Emissive props deposit light | **PASS** (white-flame defect) |
| A9 | Frame free of debug/UI overlay | FAIL |

The honest read: the 3D dungeon has **correct lighting topology and nothing else**. Point
lights are in the right places with real inverse falloff and they genuinely illuminate
neighbouring geometry — that is the hard part of a dark interior and it works. Everything
that turns lit geometry into a *place* is missing: no shadows, no textures, no specular, no
fog, no ambient occlusion. The scene is untextured primitives lit by working lights, and
because half the frame falls to pure black the working lights are all you can see.

Highest visual return per unit of work, judged from the two frames:

1. **A6 darkness floor + A4 fog** — one change addresses both. A tinted fog/ambient floor
   that lifts the darks off zero would recover the ~50% of frame that is currently dead, and
   a cool tint on it would deliver A7's temperature split for free. Three targets, one fix,
   and it is the cheapest thing on this list.
2. **A5 ambient occlusion** — the port already exists (N8AO, per `world3d-ground.md`).
   Re-measure `aoRadius` for this camera; do not copy the ground value.
3. **A9 overlay** — pure scenario hygiene, minutes of work, and it stops contaminating every
   future capture of this surface.
4. **A2 shadows** — enable shadow casting on the torch lights. High impact in a scene whose
   whole read is light-versus-dark.
5. **A3 stone material** — the largest job, and the one that finally removes the "untextured
   prototype" read.
6. **A8 flame colour** — trivial, and it fixes the most conspicuously wrong single pixel
   cluster in frame.

## Section B — 2D module sheet: **FAIL, 3 of 8** (1 unscored)

| # | Target | Status |
|---|---|---|
| B1 | Aged paper substrate | **PASS** |
| B2 | Line weight hierarchy | **PASS** |
| B3 | Directional exterior hatching | FAIL (stipple, not hatch — may be a Remy call) |
| B4 | Dyson drop-shadow offset | FAIL (halo present, not offset) |
| B5 | Legibility at sheet scale | FAIL (map fills ~⅓ of plate) |
| B6 | Theme palette triad | not scored — needs a 2nd theme capture |
| B7 | Keyed numbering and on-sheet key | **PASS** apparatus / FAIL content (9/11 "burial gallery") |
| B8 | Furniture silhouettes | FAIL (collapsed to repeated dashes) |

The 2D sheet is in **much** better shape than the 3D walkthrough and is closer to its bar
than any raw score suggests. The substrate, the ink hierarchy, the cartouche, the compass,
the scale bar, the key panel and the objective ring are all present and all read correctly.
It already looks like a module sheet.

Its failures are concentrated in two generator-side problems, not in the drawer:

1. **Page fill.** The map uses about a third of the plate. Fixing that single thing lifts
   B5, B7 and B8 simultaneously, because all three failures are partly "too small to read".
   This is the highest-value 2D fix by a wide margin.
2. **Vocabulary collapse.** Room names are 9/11 identical and furniture glyphs are ~90%
   identical dashes. The drawer has distinct silhouettes; the generator is not asking for
   them at a scale where they can be drawn.

B3 should go to Remy before anyone touches it — the stipple may be the approved look, in
which case the target wording is wrong, not the art.

## What I need next

- **Fix the linework scenario** so `dungeon-parchment-linework` actually zooms; right now it
  duplicates the full plate byte-for-byte.
- **Add a second and third 2D theme** at the same seed (`frost`, `fungal`) so B6 is scorable.
- **Add a corridor-depth 3D scenario** — a shot down a long corridor toward a lit mouth. A4
  (fog) and A6 (darkness) are much better measured along depth than across a room.
- **Hide the party marker and light gizmos** in the 3D dungeon scenarios (A9).
