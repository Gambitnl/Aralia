# Capture framing — BG3 parity

Framing is part of the capture rig. The rig ran before this pass, but its scenarios were
written to prove features EXIST, not to let anyone judge how they look. `forge-lineup` put
eight characters at about forty pixels each on a flat green plane; `world-cast-diorama`
pointed the camera into a roof and showed no cast at all. A critic handed those frames can
decide nothing.

Every scenario below was run against the live surface and its PNG opened and looked at.
Captures live in `captures/framing/`.

**Capture command** (`--only` takes a comma-separated list, not repeated flags):

```
npx tsx tools/vistest/shoot.ts --fresh-module src/App.tsx \
  --base http://localhost:3000/Aralia/ \
  --out .agent/3d-visual-quality/captures/framing --only id1,id2
```

---

## Scenario per surface

| Surface | Scenario | Added / changed | Frame |
|---|---|---|---|
| World3D ground | `wilds-eye-level-vista` | added | Looking out over a valley to a hazy horizon: aerial perspective, sky, water, canopy against sky |
| World3D ground | `wilds-ground-contact` | added | Close on the floor: terrain facets, ground-cover layers, AO seating, water edge |
| World3D ground | `wilds-ancient-forest`, `wilds-mountain-summit`, `wilds-road-bridge`, `wilds-ford-causeway` | unchanged | existing feature-proof shots, left alone |
| Towns in 3D | `town-street-level` | added | Standing in the street looking along it — the Rivington frame |
| Towns in 3D | `town-street-aerial` | unchanged | kept as the context/layout shot |
| Towns in 3D | `crowd-commute` | changed (was failing) | Commuter close enough to read stride and body |
| Interiors | `interior-villager` | changed (was failing) | Inside the room at ~1.6 m, hearth lit, 20:00 |
| Interiors | `interior-hearth-day` | added | Same room, 10:00 |
| Interiors | `interior-hearth-night` | added | Same room, 23:00 |
| Combat maps | `combat3d-play-camera` | added | The distance a player actually fights from, both teams and ground in frame |
| Combat maps | `combat3d-party`, `combat3d-enemies` | unchanged | kept as the close unit-inspection shots |
| Creatures | `entitydebug-portrait` | added | Portrait distance, solid materials — face and shoulders fill the frame |
| Creatures | `entitydebug-silhouette` | added | Full body in profile, same subject |
| Creatures | `world-cast-diorama` | changed (was framing a roof) | All three staged cast members at conversation distance |
| Dungeons | `dungeon-3d-entrance-room` | added (surface had ZERO coverage) | Torch-lit entrance chamber at expedition distance |
| Dungeons | `dungeon-parchment-sheet` | added | The hand-inked module sheet as a clean full page |
| Dungeons | `dungeon-parchment-linework` | added | The same sheet zoomed onto the plan so the ink is judgeable |

A `dungeons` scenario group was added alongside the existing five. No existing scenario id
or output filename changed, so nothing that consumed the old captures broke.

---

## The two failing scenarios were RIG bugs, not product gaps

Both were measured, not assumed.

**`crowd-commute` — "no walkers" while 46 walkers were on screen.** The recipe treated any
`groundAgentsCrowd` child whose index was a multiple of nine as a non-walker. The crowd is
108 children in twelve groups of nine, and the instance-bearing mesh is FIRST in each
group — so every index carrying instances was a multiple of nine, and the filter excluded
the entire crowd. Replaced with a straight sweep of live instance matrices.

**`interior-villager` — "no occupants" while 886 residents existed.** Interior bodies mount
only within 18 m of the camera (`BODY_RADIUS_M` in `InteriorOccupants.tsx`, re-evaluated at
2 Hz), and the dev entry's opening camera is hundreds of metres up. A scene-graph search
run first can only ever find zero. The recipe now reads the household from
`__wfGroundWorld.occupants`, flies in, waits out the body budget, and then frames.

---

## Framing decisions worth knowing before editing these recipes

**Ground-mode MapControls clamp the polar angle to 0.48π** and `minDistance` to 2 m. A
"looking straight out" pose gets clamped up to roughly a 3 m camera. That is still the
exploration camera family, and the recipes are written to be honest about it rather than to
fake a 1.7 m eye the controls will not hold.

**Camera azimuth is chosen, not fixed.** A constant +x/+z diagonal repeatedly parked the
lens against a house wall and filled half the frame with plaster. Twelve azimuths are
sampled and the one whose camera point is farthest from any building centre wins.

**Interiors anchor on the hearth POINT LIGHT, not on a resident** (see finding 2 below —
residents are not a trustworthy position). The eye then retreats toward the host building's
centre, capped at 3.2 m, so it stays inside a 20 × 25 ft room whichever way the plot is
rotated. A first attempt that posed purely from plot-corner geometry was worse and was
reverted: it put the lens flat against a wall.

**Interior hour variants hop the live clock to find the room, then hand it back.** Hearths
follow a per-site baked 24-hour schedule and `InteriorLights` skips a hearth its schedule
marks dark, so at 10:00 and 23:00 there is no lit fire to anchor on. Each variant loads at
its own real hour (the URL `&hour=` drives the world sun, sky and occupant placement), sets
the live interior clock to 20:00 just long enough to locate a hearth, poses, then restores
the hour under test. All three variants therefore stand in the same room.

**`polarDeg` in `__bm3dCam.poseTeam` is measured FROM +Y**, so a smaller number is MORE
overhead. Reading it as an elevation angle produced a top-down canopy shot with no units in
it. 66 degrees is 24 degrees above the horizon.

**The two crowd-anchored town shots do not pick the same walker every run.**
`crowd-commute` and `town-street-level` frame whichever live crowd instance is farthest
from any building, and the crowd's instance set differs between loads. Every run produces a
street-level frame with a walker in it, but not the same street. Re-run before concluding
that something changed; compare like for like on the surface, not on the exact composition.

**`readback` needs a WebGL canvas.** The parchment module sheet is a 2D canvas, so its
recipes use `screenshot` and first lift the live canvas into a fixed full-viewport backdrop.
Without that the capture would be two-thirds slider panel — UI chrome instead of the
surface.

---

## Product findings turned up while framing

These are product bugs, not rig bugs. Recorded here for the surface critics; not fixed by
this pass, which owns only `scenarios.ts`.

1. **Parchment wheel-zoom is dead after switching 3D → Parchment.** The sheet's
   zoom-to-cursor wheel listener is bound in an effect keyed on `error`, and the parchment
   canvas is only created when the presentation toggle leaves the default 3D view. A real
   user who opens the dungeon workbench and clicks Parchment gets a canvas with no wheel
   listener, so scroll silently does nothing (and, because the canvas sits in an
   `overflow-auto` pane, scrolls the pane instead). `PreviewDungeon.tsx` is gitignored.
   The recipes drive the button cluster and the React pointer handlers instead.

2. **Interior residents are not placed at their hourly stations.** Measured at seed 42,
   `gx=16&gy=4`, hour 20: all seven members of household `14:b109` report the identical
   world position, and so do all three of `14:b245`. Two of the b109 members have a
   `stationsByHour` entry of `level: 1` (`sleeping`, upstairs) at that hour and are still at
   ground level. The positions also sit several metres from any hearth light in the same
   town, i.e. outside the room they belong to. `InteriorOccupants.tsx` /
   `applyInteriorResidentFrame` is where to look. Consequence for the rig: a resident is
   not a usable "inside a room" anchor.

3. **Windows admit no daylight.** In `interior-hearth-day` (10:00) the window pane is dark
   and the room is close to black; in `interior-hearth-night` (23:00) the same pane glows
   warm. The interior is brighter at 23:00 than at 10:00. The interiors target asks for
   window light that throws a directional shaft and tracks the hour; at present the window
   appears to be a scheduled emissive quad with no daylight term at all.

4. **Ground grass tufts render through interior floors.** Green cone tufts stand inside the
   room in all three interior frames.

5. **The hearth is an untextured flat-red emissive box.** Visible in all three interior
   frames; it reads as red plastic rather than as fire, stone or ember.

---

## Not made capturable

**`forge-lineup` at critique distance.** Attempted as `forge-lineup-closeup` and dropped.
The lineup walks a wide circle and the forge's `AutoFrame` centres the orbit target on that
circle's middle at ground level. Dollying in keeps that centre in frame and drives the
bodies off the top edge (four fifths empty green); adding an OrbitControls pan overshot and
left subjects at the left and right edges. The surface offers no camera-pose hook, only
`__entityforge.{scene,camera,renderer}` with `OrbitControls` re-asserting the target every
frame. A close lineup would need either a pose hook on the forge scene or a lineup layout
that is a row rather than a circle — both are source changes outside this pass's ownership.
Creature material and silhouette critique is covered instead by `entitydebug-portrait` and
`entitydebug-silhouette`, which drive the entity debugger's own `cam:face` / `cam:side`
presets with `wire=0` so the materials are solid.
