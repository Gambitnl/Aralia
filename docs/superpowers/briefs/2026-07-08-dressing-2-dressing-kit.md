# Build brief 2 — Building dressing kit + context placer

## Goal
Give plain building boxes real character by adding small detail pieces, chosen by what the building *is*. A smithy, a manor, and a tenement should look clearly different without changing their base shape. The character comes from the dressing, driven by the building's data.

## What to build
A self-contained browser prototype. Stack: three.js (r170 or newer), WebGPU renderer. One small Vite project or a single HTML file. No external art assets — build all pieces from code (low-poly, vertex colors). Orbit camera. A control panel with preset buttons.

Two parts:

### Part A — the kit
A library of low-poly, parametric dressing meshes. Each takes size/count arguments and returns geometry. Build at least these:
- **Chimney** (brick stack, sits on a roof at a given point)
- **Dormer** (small gabled window box set into a roof slope)
- **Jetty** — an upper floor that overhangs the floor below (the classic medieval look; see reference). Parametric overhang depth.
- **Bargeboard / eave trim** (decorative edge along a gable)
- **Hanging shop sign** (a bracket + board over a door)
- **Window shutters** (paired panels beside a window)
- **Weathervane** (a spike + shape on a ridge or tower)
- **External stair** (steps up an outside wall to an upper door)
- **Ridge cresting** (a decorative line along the roof ridge)

### Part B — the placer
A deterministic function. Input: a building descriptor —
```
{
  footprint: Rect[],        // one or more rectangles making an L/T/box plan
  storeys: 1 | 2 | 3,
  type: 'cottage' | 'smithy' | 'shop' | 'inn' | 'manor' | 'temple' | 'tenement' | 'keep',
  wealth: 'poor' | 'common' | 'wealthy',
  trade?: string,           // e.g. 'blacksmith', 'merchant'
  seed: number
}
```
Output: a list of kit pieces with positions/rotations, placed by rules:
- Chimney over a hearth wall (pick a plausible outer wall).
- Jetty on the upper storeys of townhouses/tenements over the street side.
- Shop sign over the door for shop/smithy/inn.
- Wealthy: add bargeboards, ridge cresting, a weathervane, shutters.
- Temple: add a spire or bell over the main mass.
- Tenement: patched, mismatched, plainer — fewer ornaments, maybe an external stair.
- Everything deterministic from `seed`, so the same building always dresses the same way.

Add a dropdown or preset buttons to switch descriptor and watch the same box re-dress by type and wealth.

## Aesthetic target
Medieval timber-frame town where you can read a building's role and its owner's wealth from the outside. Jettying is the most characterful single move — lean on it.

## References
- Jettying (upper-floor overhang technique): https://en.wikipedia.org/wiki/Jettying
- Timber-framed house history and proportions: https://ruralhistoria.com/2023/12/13/timber-framed-houses/
- Manor Lords building visual differentiation: https://steamcommunity.com/app/1363080/discussions/3/603028051930929175/
- Manor Lords buildings reference: https://wiki.hoodedhorse.com/Manor_Lords/Buildings

## Done when
Six or more preset buildings each look clearly different by type and wealth, using the same base boxes plus dressing. The dressing is deterministic per seed. The kit pieces are reusable functions, not one-offs.

## Note for integration (context only)
Our real building data already carries this exact descriptor: footprint rectangles, storeys, a building type, a wealth tier, and the resident's trade. Match the descriptor shape above and the placer ports almost directly.
