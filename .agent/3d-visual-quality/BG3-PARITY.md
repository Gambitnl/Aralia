# BG3 parity program

**Goal:** match Baldur's Gate 3 on every visual surface. Not "inspired by" — match it.

**Bar:** BG3 is the reference. Where we differ on purpose, we differ on METHOD (Aralia is
procedural, BG3 is hand-placed). The critic judges the rendered frame, never the method,
and never asks for hand-authored content as the fix.

**Loop exit (Remy, 2026-07-30):** per-surface measurable targets, not "critic prefers ours".
An item is done when every target below is met AND its critic confirms by screenshot from
the live surface. No item is done on an unverified claim.

---

## Capture rig — WORKING

`npx tsx tools/vistest/shoot.ts --fresh-module src/App.tsx --only <id> --base http://localhost:3000/Aralia/ --out <dir>`

Fixed 2026-07-30: `npx playwright install` cannot write its cache on this machine
(`%LOCALAPPDATA%\ms-playwright` is a junction whose target is a junction to itself →
ELOOP), so the rig now falls back to installed Chrome. It uses a rAF framebuffer
readback rather than a compositor screenshot, because the compositor starves under a
busy R3F loop.

**The in-app Browser pane is NOT a capture path for 3D.** It stops compositing and every
screenshot times out. Use this rig.

### Scenario coverage per surface

| Surface | Scenarios | Status |
|---|---|---|
| World3D ground | `wilds-ancient-forest`, `wilds-mountain-summit`, `wilds-road-bridge`, `wilds-ford-causeway` | covered |
| Towns in 3D | `town-street-aerial`, `crowd-commute` | covered |
| Interiors (L4) | `interior-villager` | thin — one scenario, needs hour variants |
| Dungeons | `dungeon-3d-entrance-room`, `dungeon-3d-corridor-depth`, `dungeon-parchment-sheet`, `dungeon-parchment-linework`, `dungeon-3d-entrance-room-frost`, `dungeon-parchment-sheet-frost` | **covered** (was none; +3 added 2026-08-03) — see `FINDINGS-dungeons.md` |
| Combat maps | `combat3d-party`, `combat3d-enemies`, `combat-world-*` (18) | covered |
| Creatures | `forge-lineup`, `forge-dwarf-wizard`, `forge-dragon-huge`, `entitydebug-anchors`, `world-cast-diorama` | covered |

---

## Reference board

BG3 gameplay screenshots live in `references/bg3/<surface>/`. That folder is
**gitignored** — local study material, not repo assets.

Wanted shots: gameplay only, never marketing key art. Match OUR camera and time of day,
or the comparison is worthless.

| Surface | Shot list |
|---|---|
| `world3d-ground` | Wilderness at ~3rd-person height looking out; a dirt road with verge; a river bank; dense woodland floor; a cliff face; a distant vista with haze |
| `towns-3d` | Rivington street at ground level; Lower City street; a dock with water contact; a city wall and gate; rooftops from above |
| `interiors-l4` | Tavern interior lit by hearth and windows at day; the same at night; a plain house room; a temple interior |
| `dungeons` | Underdark wide with bioluminescence; Moonrise Towers stone corridor; Shadowfell; a torch-lit room showing light falloff |
| `combat-maps` | Turn-based encounter mid-fight showing the movement grid, highlights, and unit readability at combat camera |
| `creatures` | Character at portrait distance (skin, cloth, hair); a monster full body; an idle pose showing silhouette |

Existing references stay in force and are NOT replaced by BG3:
- **Gozzy's battlemaps** — the hand-inked look for 2D dungeon module sheets
- **three.js Dungeon Forge** (MIT) — technique only: textures, instancing, lights
- **Caeora packs** — tokens (forest pack already wired via `forestSprites.ts`)

---

## Honest baseline, 2026-07-30

First real capture of `wilds-ancient-forest` against BG3's overworld bar:

- Terrain is flat-shaded with visible triangle facets and no texture at any distance
- Trees are untextured flat-shaded cones and blobs; no bark, no leaf detail, no wind
- Grass is sparse tiny cones, not layered — reads as scattered spikes, not ground cover
- Water is one opaque blue polygon: no reflection, refraction, normal detail, or shoreline
- No ambient occlusion anywhere; contact between objects and ground is unreadable
- Sky is a flat vertical gradient; no clouds, no sun disc, no aerial perspective
- Almost no shadowing; a few flat dark patches with no penumbra

Every item below starts from this kind of honest read, per surface.

---

## Per-surface targets

Targets are measurable and judged on the captured frame. Filled in per item by its
builder/critic pair as the reference board lands; each must be checkable from a
screenshot or a scene query, never from opinion.

### 1. World3D ground
- Terrain: no visible flat facets at walking distance; normal or height detail on slopes
- Ground cover: at least three depth layers (ground texture, low scatter, tall grass) with wind motion
- Trees: textured bark and canopy; LOD that does not pop; canopy breakup against sky
- Water: reflection, depth-tinted transparency, shoreline transition, surface normal motion
- Lighting: soft shadows with penumbra, ambient occlusion at every ground contact
- Distance: aerial perspective / haze so far terrain recedes rather than sitting flat
- Sky: sun disc, cloud layer, time-of-day response

### 2. Towns in 3D
- Street surfaces read as material (cobble, dirt, plank), not tinted ribbons
- Buildings carry wall material, trim, window recesses, and roof detail
- Docks meet water with contact shadow and no floating or intersection
- Walls and gates read as stone courses with thickness at the opening
- Props and clutter break silhouettes at street level

### 3. Interiors (L4)
- Hearth is a real light source with warm falloff and flicker
- Window light throws directional shafts that track the hour
- Materials differ by surface: plaster, timber, stone, cloth, metal
- Occupants are lit by the room, not by a flat ambient

### 4. Dungeons
- **Prerequisite: a capture scenario must exist.**
- 3D: torch light with falloff and moving shadow; wet or mineral stone material; depth fog
- 2D module sheets: hold the Gozzy hand-inked look — hatch, texture, line weight

### 5. Combat maps
- Unit silhouettes readable against ground at combat camera distance
- Movement range, cover, and threat are legible without hunting
- Elevation reads instantly

### 6. Creatures
- Silhouette reads at portrait distance and full body
- Skin, cloth, hair, and metal each respond to light differently
- Rig deforms without collapsing; idle motion has weight and does not loop visibly
