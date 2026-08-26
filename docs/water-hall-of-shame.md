# Water Hall of Shame

A field guide to the water bugs this project has actually hit. Purpose: when you
SEE a symptom, find its NAME here, and say the name - the right fix starts from
the right word. If one of these comes back, point at its number and say it was
reintroduced.

Each entry: what you see, what it is called, why it happens, and where we hit it.

## 1. Puddle-deep lake

- **You see:** deep water draws the same colour as a shallow film. A lake and a
  puddle look identical, so nothing on screen tells you how deep anything is.
- **Names:** puddle-deep lake (appearance) · a drowned depth ramp (mechanism -
  the shallow-to-deep colour ramp is computed correctly and then buried).
- **Why:** water carries depth as a dark colour at the deep end. Flat ambient
  light washes a dark colour out. This page lights with a studio rig - a
  hemisphere at 5.0 plus constant fills of 2.3 and 0.5, against a single
  sun-following key at 2.6 - so 7.8 of the 10.4 units never move with the hour
  and never leave a dark surface dark.
- **We hit it:** the volume sandbox, 2026-08-25, found by Remy: 37.2 m of water
  drew the same pale cyan as a 10 cm film. Confirmed by dropping the hemisphere
  to 0.4, which brought the depth straight back. Fixed by scaling indirect light
  on the WATER only (`AMBIENT_BITE` in `waterLook.ts`), so the ground keeps the
  look nine critic rounds judged.
- **Do not:** fix this by turning the scene lights down. That is the ground's
  look, and it was judged. Make the water drink less.

## 2. Water that is running but flat

- **You see:** a water surface that should be moving looks completely still, and
  you cannot tell whether the simulation is broken or the effect is just subtle.
- **Names:** silent sim · a running-but-flat field.
- **Why:** a surface covered in specular sparkle hides a small displacement
  entirely. Judging by eye cannot separate "the wave layer is off" from "the
  wave layer is on and tiny", so a broken pipeline and a badly tuned one look
  the same.
- **We hit it:** the ripple layer, 2026-08-26. Three rounds were spent guessing.
  Settled by adding `probe()` to the wave field - it reads the render target
  back and reports the largest height actually in it. The answer was 0.41,
  rising to 1.18 after a poke, which proved the field was live and moved the
  hunt to the vertex stage.
- **Do not:** judge a simulation by eye when a number is available. Add the
  readback.

## 3. The normal that was one include too late

- **You see:** a displaced surface that moves but does not light. It reads as a
  dent in a sheet of plastic rather than a wave, with no specular of its own.
- **Names:** unlit displacement · a stale normal.
- **Why:** three.js consumes `objectNormal` in `<defaultnormal_vertex>` and
  hands the result to the varying BEFORE `<begin_vertex>` runs. Bending the
  normal next to the height - the obvious place - happens one include too late,
  so the surface lights exactly as the flat one did.
- **We hit it:** the ripple layer, 2026-08-26. The height is barely visible on
  its own; the normal is what sells a ripple.
- **Do not:** put a normal change beside the displacement. Bend it in
  `<beginnormal_vertex>` and carry the height forward in a local.

## 4. The shoreline that flickers

- **You see:** the shallow edge of spreading water fills with per-cell noise. At
  any strength the surface reads as shattered plates rather than water.
- **Names:** threshold flicker · a hard wet-dry cut.
- **Why:** a `step()` test on depth decides whether a cell carries a wave. In a
  spreading film the depth hovers around that cut and crosses it frame to frame,
  so every cell in the shallows switches on and off at frame rate.
- **We hit it:** the ripple layer, 2026-08-26. Fixed with a `smoothstep` ramp
  across a band instead of a cliff, which costs the same.
- **Do not:** threshold a quantity that is noisy near the threshold. Ramp it.

## 5. The ledger that outlived its world

- **You see:** the water readout shows thousands of cubic metres while the
  surface has visibly stopped drawing. You conclude the renderer is broken.
- **Names:** stale ledger · a one-frame lie.
- **Why:** Reset swaps the world and hands the water a fresh, empty field, but
  the last frame's statistics stay on screen until the next frame reports.
- **We hit it:** the volume sandbox, 2026-08-26. Measured across a Reset: the
  panel read 48,859 m³ while the drawn surface had already collapsed from 51,264
  indices to 792. Fixed by stamping the statistics with the world that produced
  them, so the panel says "rebuilding" rather than something false.
- **Do not:** let a readout survive the thing it describes.

## 6. The pane that never mounts

- **You see:** a graphics-card water pane sits on "Loading..." forever. Every
  module is already fetched and nothing is pending on the network.
- **Names:** scheduler starvation · a frame-loop lock-out.
- **Why:** another pane's per-frame solver owns the main thread through the
  animation-frame loop, so React never gets the slice it needs to COMMIT the
  resolved lazy boundary. The chunk arrived; the render never happened.
- **We hit it:** the water page, measured at 60 s and often never. Fixed by
  making the solver yield while any scene is waiting to appear: 1,033 ms in the
  same failing case.
- **Do not:** treat this as a slow download. Check whether something else is
  holding the frame loop.

## 7. Water the scene does not contain

- **You see:** a capture of a water surface that shows no water, and a catalog
  card that looks complete but proves nothing.
- **Names:** the dry subject.
- **Why:** the scene chosen genuinely had no water in it. The town step picked
  its burgs on population alone, so all five were dry in a world with 215
  rivers. The dungeon's default theme generates no liquid cells.
- **We hit it:** the water-mode catalog, 2026-08-26. Fixed by choosing the
  subject deliberately - a water gate on the town step, the sewer theme in the
  dungeon - and by a capture rig that REJECTS a shot with no water rather than
  saving it.
- **Do not:** photograph a feature without checking the scene contains it.

## 8. The composer that ate the tone mapping

- **You see:** a scene that looks slightly wrong after a post-processing pass is
  added, with nothing announcing a change. Sunlit faces drift pale.
- **Names:** composer tone-map reset · a silent highlight lift.
- **Why:** while an `EffectComposer` is mounted, `postprocessing` sets
  `gl.toneMapping = NoToneMapping`. Putting `ToneMapping` back in the stack looks
  like it restores the page's own curve. It does not restore it exactly.
- **We hit it:** the underwater view, 2026-08-28. Measured with a fixed camera
  and the water off, so two runs of the same build were byte-identical (mean 0,
  max 0). Mounting the composer moved the frame by mean 3.443 and max 106, with
  14 percent of channels off by more than 8. The MEDIAN pixel ratio was exactly
  1.000 while the 90th percentile was 1.095 - so it was not exposure, which
  would move every pixel together. It was the highlights lifting nine percent,
  on the same sunlit faces the look critic spent two rounds pulling back from
  chalk. Fixed by mounting the composer ONLY while the camera is submerged, which
  restored a byte-identical frame above the waterline.
- **Do not:** trust that a composer is neutral because the right effect is in
  the stack. Capture a fixed frame before and after and difference it. Measure
  the run-to-run noise first, or the comparison proves nothing.

## 9. The proof that measured the wrong thing

- **You see:** a measurement says a change did not work. You go back and rewrite
  code that was already correct.
- **Names:** the contaminated comparison · a false negative proof.
- **Why:** two separate faults, both of which make a working change look dead.
  FIRST, a whole-frame statistic is dominated by the pixels that did NOT change.
  Water covers a minority of a landscape shot; the ground is identical between
  runs, and a strict "got brighter" test files every identical pixel on the
  "not brighter" side. SECOND, a running simulation is not the same subject twice.
  A spring left pouring between two captures changes the water itself, so part of
  every difference is more water rather than the thing under test.
- **We hit it:** the Depth slider, 2026-08-28. The first run reported "1.00 is
  paler than the default: NO" on a control that works. Counting only the pixels
  that actually moved turned 46.5 percent into 95.6 percent of the changed region,
  from the same three images. The pool had also grown from 35,244 to 37,340 cubic
  meters across the three shots, so the spring is now stopped and the field
  settled before anything is captured.
- **Do not:** average over a region the change cannot reach, and do not photograph
  a simulation that is still running. Freeze the subject, then measure only what
  moved.

## 10. The water that drained out of sight

- **You see:** the ledger reads tens of thousands of cubic meters and thousands
  of wet cells, and the picture is dry ground. You start hunting a rendering
  fault that is not there.
- **Names:** the buried pool · water below the rim.
- **Why:** water finds the lowest place it can reach, and on a voxel world that
  is often a shaft. The volume is real, the surface is drawn, and every bit of
  it is under the terrain. No camera angle recovers it: at a low angle you
  photograph the rim, and a camera placed relative to the WATER is inside the
  hillside, which renders as a convincing landscape rather than as an error.
  What is left on the surface is a thin film that carries almost no depth, so
  the one thing a depth control changes is barely present in shot.
- **We hit it:** the Depth slider proof, 2026-08-28, five capture runs. The
  scene held 24,239 m3 across 4,487 wet cells with the deepest column at 28 m,
  and a water-only control moved 0.02 percent of the frame - which is to say no
  water was visible at all. Settled by asking the page instead of the lens:
  `__waterDebug().deepProbe` reported the ground top at -8.7 m with the water
  surface 30 m above its bed, inside a shaft. The Frame water button now says
  "sunk N m below the land" rather than returning a confident view of a wall.
- **Do not:** conclude the water is not being drawn because you cannot see it.
  Read the bed, the water surface and the ground top at the same column first.
  If the water is below the rim, change the SUBJECT, not the camera.

## 11. The source that resonated

- **You see:** a disturbance tuned to a sensible physical number arrives on
  screen ten or a hundred times too strong. A raindrop makes a swell. A spell
  makes a tsunami. Halving the number barely helps.
- **Names:** source resonance · the integrating field.
- **Why:** a wave field INTEGRATES. It damps by a fixed fraction each step, so a
  source that keeps firing settles at roughly its strength times its RATE times
  the field gain - not at its strength. Worse, repeated pushes at ONE cell
  resonate: the field is still ringing from the last push when the next lands,
  so the response grows faster than the input. A scattered source never does
  this, because no two of its pushes share a cell. So two sources with the same
  per-push number can differ by two orders of magnitude on screen.
- **We hit it:** the ripple causes, 2026-08-28, twice in one afternoon. Rain at
  a 3 cm push, twenty a second, settled at 2.73 m - four times the waterfall,
  and a hundred and forty times its own per-drop number. A spell firing nine
  0.9 m pushes into one cell in half a second reached 10.92 m, while a single
  0.45 m push from a thrown stone reached 0.06 m: ten times the input, a hundred
  and eighty times the response. Fixed by cutting the RATE rather than the
  amplitude - three pushes instead of nine - and by giving rain a physical 1 mm
  drop at a slower cadence.
- **Do not:** tune a continuous source by its per-push strength alone. It has
  two knobs on its loudness and they multiply. Measure the field, and measure it
  after the previous source has actually gone quiet - a loud one still ringing
  will be read as the next one.

## 12. The shader that skipped the last two lines

- **You see:** a custom shader draws ordinary colors as near-black, usually with
  a bright rim wherever a highlight fires. The geometry is right, the coverage is
  right, and the color is ink.
- **Names:** unencoded output · linear on the screen.
- **Why:** three works in LINEAR color and converts on the way out. A plain
  `ShaderMaterial` gets the definitions in its fragment prefix - `toneMapping()`
  and `linearToOutputTexel()` - but NOT the calls. Built-in materials get the
  calls through their own chunks; a hand-written one does not, and nothing warns
  you. So a linear value goes straight to an sRGB framebuffer. `#16414f` is a
  perfectly ordinary dark teal, and as linear it is `(0.008, 0.056, 0.085)`,
  which is very nearly black. The rim survives because a specular term is
  already near one.
- **We hit it:** the droplet liquid skin, 2026-08-29. Every droplet cluster drew
  as a black lump with a white edge over a bright lake. THE AUTOMATED CHECK SAW
  NOTHING: it measured water coverage and edge density, and both were nearly
  unchanged - 43.00 against 44.47 percent covered, 14.7 against 14.8 percent
  edge. One look at the picture settled it in a second. Fixed by adding
  `#include <tonemapping_fragment>` and `#include <colorspace_fragment>` as the
  last two lines of `main()`, in that order.
- **Do not:** assume a `ShaderMaterial` takes part in the renderer's output
  conversion. And do not trust a number that was never designed to see the
  fault you have: a coverage metric cannot report a color.


## 13. The filter that was sized in the wrong units

- **You see:** a smoothing pass runs, costs what it should, and changes almost
  nothing. Adding a second pass changes almost nothing again. The thing you were
  smoothing keeps its shape.
- **Names:** the pixel-sized filter · a kernel that never reached.
- **Why:** the filter width was written in PIXELS and the subject is measured in
  METRES. Those two only agree at one distance. A droplet on this page is 2 m
  across, which the simulation sets and nobody chose for the look; framed at 37 m
  it projects to about 58 pixels. The kernel was clamped to at most 12. A
  12-pixel kernel cannot flatten a 58-pixel dome, so every droplet kept its own
  bump, its own normal, and its own highlight - which is the ball look arriving
  by a different door.
- **We hit it:** the droplet liquid skin, 2026-08-29. Two filter passes moved the
  bright-speck count from 93 to 73, against 64 for the sprites it was supposed to
  beat. Fixed by computing the width per pixel from the depth that pixel already
  carries, so it is a filter the size of a droplet at any distance. The tap count
  stays fixed and the taps spread, so a close-up costs the same as a wide shot.
- **Do not:** answer "it did not smooth enough" with another pass. Ask what the
  kernel is measured in, and what the subject is measured in, and check they are
  the same thing at the distance you are looking from.


## 14. The metric that could not see the fault

- **You see:** an automated check passes, or reports a small regression, on a
  change that is plainly right or plainly broken when you look at it. You trust
  the number and go the wrong way.
- **Names:** the blind metric · a number that answers a different question.
- **Why:** a measurement only sees what it was built to see, and the fault you
  have is rarely the fault you designed for. Three in a row on one question:
  edge density across the whole frame measured the LAKE behind the subject and
  came back identical to three significant figures; a local-maxima count
  measured any speckle, so a one-pixel dither on a clean surface scored 568
  against 50 and called a big improvement a big regression; and neither could
  see a COLOUR fault at all, so a shader rendering every cluster as a black lump
  passed both.
- **We hit it:** the droplet liquid skin, 2026-08-29. Settled by asking the
  question the feature actually claims - droplets that overlap become ONE body -
  and counting connected islands of water, which no amount of texture on the
  surface can change.
- **Do not:** iterate against a metric you have not checked can detect the class
  of fault you are hunting. Write the picture BEFORE the verdict, every run: an
  edit to this project's own capture script silently deleted that step, and two
  rounds of judgment were then made against a stale image with nothing in the
  output to say so.


## 15. The water that absorbed everything

- **You see:** see-through water that shows nothing through it. A flat pale
  sheet, like frosted glass, sitting where a lake should be. Every part of the
  refraction path checks out when you inspect it.
- **Names:** the opaque transparency · absorption over the wrong distance.
- **Why:** Beer's law needs a distance over which light becomes the water's own
  color, and that distance has to be sized to the water you actually have. Set
  it to three metres on a lake whose visible middle is five metres and more, and
  the refracted scene arrives BLACK. What is left on screen is the specular
  reflection of the scene lights off a smooth surface - which is pale, uniform,
  and looks exactly like a material that is not transmitting at all. The failure
  and the absence of the feature are visually identical.
- **We hit it:** the see-through water look, 2026-08-29. Settled by asking the
  page rather than the picture: a debug read confirmed a `MeshPhysicalMaterial`,
  transmission at 0.92, the refractive index of water, the transmission chunk
  hand-expanded, and its thickness correctly repointed at the per-vertex depth.
  All of it right, so the fault had to be a number. Fourteen metres is what "you
  can see the bottom of a pond, and not the bottom of a quarry" means.
- **Do not:** debug a transmissive material by looking at it. A pale flat surface
  means either "not transmitting" or "transmitting through water too murky to
  see through", and no amount of staring separates those. Read the material's
  properties, then read the numbers against the depths in the scene.

---

## How to add an entry

Keep the four fields. Name the symptom the way it LOOKS, not the way the code
is wrong - the reader has the symptom and is hunting for the name. Say where we
hit it and what fixed it, with a number if one was measured. Add a **Do not:**
line when there is an attractive wrong fix, because the wrong fix is what the
next person will reach for.
