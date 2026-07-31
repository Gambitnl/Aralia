# Targets — Combat maps, 2D and 3D

**BG3 counterpart:** turn-based encounter staging and readability.

**References used** — `references/bg3/combat-maps/`, 9 files, of which **4 are genuine mid-fight
frames with the live combat HUD**. See `SOURCES.md` in that folder for the honest tiering. The
four staging references are:
- `encounter-tunnel-movement-range-and-unreachable-enemy.jpg` — movement range, threat, reach
- `encounter-interior-fortress-trajectory-and-xray-occlusion.jpg` — interior, occlusion X-ray
- `encounter-interior-dark-friendfoe-outlines.jpg` — friend/foe in near-zero light
- `encounter-exterior-fire-surface-midfight-full-hud.jpg` — surface effect vs terrain

**Ours judged** — captured 2026-07-30 via `tools/vistest/shoot.ts` into
`captures/critic-combat/`. Every verdict below was read from a PNG with the Read tool; where
I zoomed, the crop is named.

| Capture | What it is | Usable? |
|---|---|---|
| `combat3d-party.png` | BattleMap3D, party, dusk forest, no HUD | yes, for unit/ground legibility only |
| `combat3d-enemies.png` | BattleMap3D, enemies | **MIS-FRAMED** — one unit, half off the bottom edge |
| `combat-world-hillside-3d.png` | World3D tactical projection on streamed terrain | yes |
| `combat-world-hillside.png` | 2D board, taiga slope, 24% auto-fit zoom | yes |
| `combat-world-river-elevation.png` | 2D board, bridge, 38% zoom, elevation tooltip open | yes |
| `combat-world-targetable-objects.png` | 2D board, town (Legium), 24% zoom | yes |

---

## How to judge

Readability is the whole surface. Every target below is a legibility claim answerable from a
single frame by someone who has never seen the scene. Exit condition is every target PASS,
confirmed by screenshot — not "critic prefers ours".

Aralia is procedural. Every fix must be something a **generator or a shader** can do for any
seed. Never resolve a target by hand-placing anything.

**Judging note.** N8AO was wired into `World3DScene`'s ground profile on 2026-07-30, so
`combat-world-*-3d` frames carry contact darkening the earlier baseline lacked. BattleMap3D
already had its own N8AO stack, so `combat3d-*` frames are unchanged by that work. Grounding
verdicts below account for this.

---

# Part A — 3D combat maps

## 3D-1. Unit silhouette separable from ground at combat camera distance

**Target:** With the frame at combat camera framing and no zooming, every unit's outline is
separable from the ground it stands on, in the darkest part of the map as well as the
brightest. A unit standing in tree shadow must be as findable as one in sunlight.

**Status: FAIL.** `combat3d-party.png` puts the right half of the frame in near-black tree
shadow with zero units drawn there — but the mechanism that would save a unit in that shadow
does not exist. Our units carry no rim light and no outline; they rely entirely on costume hue
against grass hue. The purple and orange bodies happen to separate from green grass by
complementary hue, which is luck of the palette, not a readability system. Compare
`encounter-interior-dark-friendfoe-outlines.jpg`: that floor is almost value-less and every
one of six units is still instantly locatable, because BG3 draws a coloured outline on each
unit that is independent of scene lighting.

**Generator-friendly fix:** a screen-space outline or rim-light pass keyed off unit hostility,
applied to every unit regardless of lighting. Not a per-scene light rig.

## 3D-2. Units are drawn through intervening geometry

**Target:** When scene geometry stands between the camera and a unit, that unit is still
located — drawn as an outline silhouette through the occluder, colour-coded by hostility.

**Status: FAIL.** In `crops/h3d-patch-4x.png` (4x of the tactical patch in
`combat-world-hillside-3d.png`) black conifer masses sit directly over the lower-left and
lower-right of the play area. Nothing is drawn through them — a unit behind one is simply
gone. Both interior references show BG3's answer twice over: in
`encounter-interior-fortress-trajectory-and-xray-occlusion.jpg` the occluded target reads as a
red X-ray silhouette and the occluded ally as a white one, through solid stone.

This is the highest-consequence 3D failure, because procedural placement will keep putting
trees and buildings in front of the camera and no amount of camera tuning fixes it.

## 3D-3. Unit occupies enough of the frame to be identified

**Target:** At the framing the surface actually presents, a unit is tall enough that its body
plan and equipment silhouette are identifiable, not just its ground marker.

**Status: FAIL.** In `combat-world-hillside-3d.png` (628x535) the entire eight-figure
engagement occupies roughly a 60x60 px region — individual units are 15–20 px tall. You can
see that something is there because of the ground discs; you cannot tell a swordsman from a
caster. Every BG3 staging reference puts the acting unit at 150–400 px tall in a 1440p frame.

**Note:** this is a camera-framing target, and the framing of `combat-world-*-3d` is owned by
`framing-capture` via the scenario file. If the scenario framing is wrong rather than the
surface's real camera, this target should be re-judged from a corrected capture before any
code changes.

## 3D-4. Friend and foe distinguishable at a glance, without hover

**Target:** Hostility is readable from a static frame in one look, from a channel that
survives at unit scale.

**Status: PASS, weak.** `crops/h3d-patch-4x.png` gives enemies red-orange ground discs plus
red chevrons and the party green discs, with the acting unit in a yellow ring. The hue split
is correct and it does survive at this scale — this is the one thing the 3D surface gets
right. It is weak because the signal lives entirely on the ground plane, so it is lost the
moment the disc is occluded (see 3D-2) or the unit is on a steep slope where the disc
foreshortens to a line. BG3 puts the same signal on the unit's own outline, which cannot be
occluded or foreshortened away.

`combat3d-party.png` does not show the split at all — every marker there is the same yellow —
so this PASS rests on the World3D projection frame alone.

## 3D-5. Elevation reads instantly from the frame

**Target:** Without hovering anything, the viewer can say which units are higher than which,
and roughly by how much.

**Status: PASS on terrain, FAIL on the tactical layer.** In `combat-world-hillside-3d.png` the
hillside's ridges, valley and sun-cast slope shading make the macro relief unmistakable — this
part genuinely works and is better than a flat board could ever be. But the tactical patch
laid over it is a **planar mint-green quad**: within the patch, where the fight actually
happens, every cell reads at one height. In `crops/h3d-patch-4x.png` the enemy group sits
visibly upslope of the party, yet the patch surface under both is the same flat plane, so the
advantage is invisible in the layer the player is reading.

BG3 states the modifier in words rather than leaving it to inference —
`ui-highground-modifier-chip-tooltip.png` shows a green "+ High Ground" chip in the target
header. We have neither the geometric cue inside the patch nor the named chip.

## 3D-6. Surface effects distinguishable from the terrain under them

**Target:** A hazard surface (fire, ice, grease, water) reads as a distinct layer sitting ON
the ground, with the ground's own material still visible through or around it, and two
different surfaces differ by more than tint.

**Status: NOT JUDGEABLE — no scenario.** None of the six captures contains a hazard surface.
Reference standard is set by `encounter-exterior-fire-surface-midfight-full-hud.jpg`, where
cobble texture stays visible at the flame's edge, and by the
`surface-ice-*` / `surface-water-*` A/B pair, where paving joints read through both and the
two differ in specular response, not only hue.

**Blocking:** a combat scenario with at least two overlapping hazard surfaces on a textured
ground is needed before this can be scored. Scenario file is owned by `framing-capture`.

## 3D-7. Every unit is visibly seated on the ground

**Target:** No unit appears to hover. Contact between foot and ground darkens, and the
darkening tracks the unit, not a decal.

**Status: FAIL.** In `crops/party-units-3x.png` (3x of `combat3d-party.png`) the only grounding
is the yellow marker ring. There is no contact darkening under either figure, and the purple
unit's forward foot reads as floating above the rock it is standing on. BattleMap3D has its
own N8AO stack, so this is not a missing-AO problem — the AO radius is not resolving at this
camera, exactly the failure mode recorded for World3D ground target #6 (1.8 m was invisible at
exploration distance; 7 was correct). The number needs re-measuring for this camera.
`staging-grymforge-elevation-ledge-no-hud.jpg` shows the bar: four units on dark rock, each
with a distinct contact shadow AND a rim light.

## 3D-8. Unit heads read as heads at the combat camera

**Target:** At the near-overhead angles this camera reaches, the top of a unit — the largest
thing on screen for that unit — reads as a head, not as a primitive.

**Status: FAIL.** `crops/enemies-unit-3x.png` is a near-top-down read of a single unit, and its
head is an **untextured flat-shaded pale-green sphere**. At this camera the head is the unit's
dominant pixel area, and it reads as a ball on a ring. This is the most damaging single detail
in the 3D set, because the closer the camera gets the worse it looks.

The same green spheres appear twice more in `crops/party-units-3x.png`, each sitting on its own
yellow ring with no body under it — at combat distance those are indistinguishable from real
units and read as placeholder markers or as a spawn bug.

## 3D-9. The tactical overlay does not degrade the units it contains

**Target:** The move/patch overlay raises legibility of the play area without lowering the
contrast of the units standing in it.

**Status: FAIL.** In `crops/h3d-patch-4x.png` the mint-green patch tint desaturates everything
on it, and the result is inverted from what it should be: the party standing **on** the patch
has *less* contrast against its background than the enemies standing **off** it on plain darker
grass. The overlay is fighting the thing it exists to clarify. BG3 keeps its ground overlays as
edges and rings rather than a filled translucent wash, precisely so the fill cannot eat unit
contrast.

---

# Part B — 2D combat board

Two implementations exist and are scored separately where they differ: the **live 2D combat
view** (what `combat-world-*` captures show, inside the World Battle Lab harness) and the
**Pixi prototype** at `?pixiboard=1`. Everything below is the live 2D view — the Pixi board was
not captured in this run and is scored NOT JUDGEABLE with a named gap at the end.

## 2D-1. The board is readable at the zoom it opens at

**Target:** At the zoom the board presents on entering a fight, a viewer can count the units
on each side and tell them apart.

**Status: FAIL, badly.** `combat-world-hillside.png` opens at **24%** and
`combat-world-targetable-objects.png` at **24%**. In `crops/board-hillside-2x.png` (a 2x
upscale, so an effective 48% view) the party is three overlapping ~7 px native circles and the
enemies are four or five more, merged into one blob. You cannot count either side. At the
board's own default zoom the units are dots.

This is not a zoom-control complaint — the board *has* zoom controls and a Fit/Auto pair. The
failure is that Auto fits the whole generated tactical patch into the pane, and the generated
patch is far larger than the engagement. Fit-to-**engagement** rather than fit-to-patch is a
generator-side fix and would resolve most of this target on its own.

## 2D-2. Friend and foe distinguishable at a glance

**Target:** Hostility readable in one look at play zoom.

**Status: PASS, weak.** `crops/board-hillside-2x.png` gives allies cyan rings and enemies
pink/magenta rings — the code exists and the hue split is correct.

Two real weaknesses. First, saturation is too low for the ring size: on the darker hillshaded
slopes the pink rings sit close in value to the dark tree blobs. Second, the code is not
consistent across captures — `crops/board-river-2x.png` shows green, yellow and red rings on
letter glyphs (R, F, C) rather than the cyan/pink pair, so a player learning one board relearns
on the next.

## 2D-3. Individual units separable when adjacent

**Target:** Units standing next to each other remain countable and individually clickable-
looking; a group does not merge into one shape.

**Status: FAIL.** In `crops/board-hillside-2x.png` both the party cluster and the enemy cluster
are single merged blobs of overlapping rings. The rings have no gap, no outline, and no
z-ordering cue. `crops/board-river-2x.png` is better only because the units there happen to be
spread out.

## 2D-4. Unit glyphs are identifiable, not just present

**Target:** The glyph inside a unit marker identifies what the unit is at play zoom.

**Status: FAIL.** `crops/board-river-2x.png` shows single letters — R, F, C — inside ~10 px
native circles. Even at 2x the letters are at the edge of legibility, and a letter is a weak
identifier regardless of size. BG3's board equivalent is the initiative portrait strip: an
actual face per combatant, at a size you can read.

## 2D-5. Movement range legible without hunting

**Target:** The reachable area is visible as a distinct region the moment it is computed, at
play zoom.

**Status: PASS.** The teal stepped move-range outline reads clearly in both
`crops/board-hillside-2x.png` and `crops/board-river-2x.png`, and the legend under the board
names the vocabulary explicitly — Move Range (green), Destination (teal), Attack Range (pink),
Area Effect (red), Line of Sight. This is the strongest single thing in the 2D set: the
overlays are named, colour-separated, and drawn as edges rather than fills, so they do not eat
unit contrast the way the 3D patch does (3D-9).

## 2D-6. Elevation reads instantly from the board

**Target:** Relative height readable from the board itself, without hovering tile by tile.

**Status: SPLIT — PASS on hover, FAIL on glance.**

On hover it is genuinely excellent, and better than the BG3 reference on this axis. The
elevation panel in `crops/board-river-2x.png` reads: `This tile 70 ft / Dev Player 62 ft / Map
floor 0 ft`, then states the relationship in words — "This tile is 8 ft higher than Dev
Player." — and explains the contour interval. BG3 offers only a binary "+ High Ground" chip.

On glance it fails. In the same crop, the bridge deck at 70 ft and the water and banks around
it carry no height cue whatsoever; without the tooltip the deck reads as flat with everything
else. The hillside board does better — it has hillshading and dashed contours with a "90 ft"
label — but the contours are too faint to give a height *reading*, only a sense of slope.

Second, separate problem: **the elevation panel occludes about 35% of the board pane**, sitting
over the play area rather than in a gutter. Solving 2D-6 by hover alone therefore costs a third
of the board.

## 2D-7. The encounter separates from map clutter

**Target:** In a frame containing generated world detail, the combatants are the most salient
thing on the board.

**Status: FAIL, worst frame in the set.** `crops/board-legium-2x.png` — the town board — is a
camo field of purple-brown building blocks over green, carrying several dozen small yellow and
orange diamond prop markers plus blue tree blobs. The prop markers outnumber the combatants
roughly 30 to 1 and are of similar size and higher saturation. The party and enemy clusters at
centre are effectively lost. Nothing dims, desaturates, or de-emphasises non-combat clutter
once a fight starts.

This is the clearest case where procedural generation actively hurts readability, and where
the fix must be procedural too: a combat-mode pass that pushes non-combatant detail down in
saturation and contrast, and lifts combatants up.

## 2D-8. Terrain types distinguishable from each other

**Target:** Water, road, deck, grass and building read as different materials at play zoom.

**Status: PASS.** `crops/board-river-2x.png` is good work — blue ripple-hatched water, olive
land, a tan plank-hatched bridge deck, and a named `BRIDGE CROSSING` chip on the feature. The
three surfaces are unmistakable and the hatch patterns carry the distinction at low zoom where
tint alone would not. `crops/board-legium-2x.png` distinguishes building from ground the same
way. This target is met; the problem in 2D-7 is clutter salience, not material ambiguity.

## 2D-9. Cover state visible

**Target:** If a unit is in cover, the frame says so.

**Status: FAIL — nothing rendered.** No cover indicator appears in any 2D capture, despite the
Legium scenario describing itself as stressing "placed cover props" and the provenance panel
counting 45 tactical target props. The props are placed and counted; their cover state is not
drawn.

BG3 has no cover system, so there is no matching reference frame. This target is written
against the principle BG3 does demonstrate throughout — a modifier that changes the maths is
**named in the HUD**, not left to geometric inference (see
`ui-highground-modifier-chip-tooltip.png`). Cover should appear as a per-unit state badge and
as a named chip in the target header, not as something inferred from where a barrel sits.

---

## Scoring

**3D: 1 PASS (weak), 6 FAIL, 1 not judgeable, 1 split.**

| | |
|---|---|
| 3D-1 unit vs ground in shadow | FAIL |
| 3D-2 drawn through occluders | FAIL |
| 3D-3 unit frame coverage | FAIL (verify framing first) |
| 3D-4 friend/foe at a glance | PASS, weak |
| 3D-5 elevation instant | PASS terrain / FAIL tactical layer |
| 3D-6 surfaces vs terrain | NOT JUDGEABLE — no scenario |
| 3D-7 grounded contact | FAIL |
| 3D-8 heads read as heads | FAIL |
| 3D-9 overlay does not degrade units | FAIL |

**2D: 3 PASS, 5 FAIL, 1 split.**

| | |
|---|---|
| 2D-1 readable at opening zoom | FAIL |
| 2D-2 friend/foe at a glance | PASS, weak |
| 2D-3 adjacent units separable | FAIL |
| 2D-4 glyphs identifiable | FAIL |
| 2D-5 movement range legible | PASS |
| 2D-6 elevation instant | PASS hover / FAIL glance |
| 2D-7 encounter vs clutter | FAIL |
| 2D-8 terrain types distinguishable | PASS |
| 2D-9 cover state visible | FAIL |

## Highest readability return per unit of work

Judged from the frames, not from guesswork about effort.

1. **3D-2, unit outline through occluders.** One screen-space pass. Fixes the only failure that
   can make a unit completely invisible, and half-fixes 3D-1 and 3D-4 at the same time.
2. **2D-1, fit-to-engagement instead of fit-to-patch.** Changes one framing rule and lifts
   2D-1, 2D-3 and 2D-4 together — those three are largely one problem wearing three hats.
3. **2D-7, combat-mode clutter suppression.** Desaturate non-combat props while a fight is
   live. Cheap, and it is the difference between a readable board and camouflage on the town
   map.
4. **3D-8, real heads.** The head is the dominant pixel area at this camera; a green sphere
   there undoes every other improvement.
5. **3D-9 then 3D-7.** Stop the patch wash from eating unit contrast, then re-measure the
   BattleMap3D AO radius for the combat camera the way World3D's was re-measured.

## Scenario and capture gaps blocking full scoring

Owned by `framing-capture` (sole owner of `src/devtools/vistest/scenarios.ts`) — I did not
touch that file.

1. `combat3d-enemies` is mis-framed: one unit, clipped by the bottom edge. Cannot judge an
   enemy group from it.
2. No scenario places hazard surfaces on textured ground, so 3D-6 is unscoreable.
3. No scenario captures the 3D board **with the combat HUD composited**, so HP bars, initiative
   order, threat arcs and hit-chance chips are unscoreable in 3D.
4. No `?pixiboard=1` scenario, so the Pixi 2D prototype is entirely unscored. Targets 2D-1
   through 2D-9 apply to it unchanged once a capture exists.
5. No frame with a large vertical gap and the range overlays on, which is what 3D-5 really
   wants.
