# Forests: named places, readable maps, deep woods

**Date:** 2026-07-11
**Status:** BUILT 2026-07-11 — all five slices landed (11 build tasks + final review + fix waves; 229 files / 2031 targeted tests green, tsc baseline unchanged, fmgWorld goldens byte-identical through every task). Remaining gates in Open.
**Goal (Remy's words):** "now do forests" — following the road-systems pattern: forests become real mechanically, visually, and as places.

## Front-loaded summary

Forests today are flat green fill on the map, evenly-spread cones in 3D, and anonymous in play. Like roads, much of the fix is lighting up finished-but-unplugged work. Five slices:

1. **Named forests** — contiguous forest cells become one named identity (the Darkwood), labeled on the map, stored as first-class world data.
2. **Readable forests (2D)** — light up the dead FMG tree-symbol + density data: textured tree fills instead of flat color.
3. **Forest characters** — per-forest type: ordinary, ancient (biggest/oldest), and rare haunted/fey rolls that switch on dormant encounter/magic tables.
4. **Paths lead somewhere** — new forest POI markers (hunter camp, hermit hollow, shrine, den) join the existing sacred groves; village forest-spur paths terminate on them; discovery reuses the proven hidden-grove reveal.
5. **Deep forest feels deep (3D)** — trees cluster into thickets and clearings, undergrowth fills the floor, and dense canopy locally dims light and closes fog, consuming the unused `canopyShade`/`fog` flags.

## What exists today (exploration findings)

**Dead or unwired content (the goldmine):**
- FMG per-biome tree `icons` + `iconsDensity` (`fmg/biomes.ts:66-83`, parsed at `:112-120`, returned in `BiomesData`) — zero consumers. The 2D tree-stamp capability is authored but never drawn.
- `forest_haunted` / `forest_fey` gameplay biomes (`src/data/biomes.ts:194-195`) with their own `encounterWeights` (undead/fey) and `magic` tables — unreachable in the worldforge lane. `wfBiomeToLegacy.ts:14-28` maps atlas forest indices only to `forest_temperate` (6), `forest_ancient` (8), `forest_boreal` (9). (The legacy grid lane could roll them, but it is retirement-targeted.)
- `canopyShade` + `visibilityModifiers.fog` flags on gameplay biomes (`src/types/world.ts:260-266`) — typed metadata, no renderer or system consumes them.
- Trees place by blue-noise with min separation (`generateLocal.ts:279-311`) — density varies by biome but spatial layout is uniformly even. Grass already has two-octave noise for clearings/thickets (`grassField.ts:48-74`); trees do not.
- Walking into dense forest changes nothing: scene fog is global (`World3DLighting.tsx:209-215`), no interior darkening.

**Working machinery to reuse:**
- Contiguous-region flood-fill idiom: `features.ts markupPack` (islands/lakes) and every zones-generator `addX` — exactly the pattern to cluster forest cells.
- Zone-style naming: `getAdjective(culture short name) + rw({...})` — culture-aware names for arbitrary regions.
- Label pipeline: `buildLabels`/`declutterLabels` (`atlasSvg.ts:462,528`) with `getPolesOfInaccessibility` anchors (used by states/provinces) — a `'forest'` label kind slots in.
- Sacred groves ALREADY flow end-to-end: `sacred-forests/pineries/palm-groves` markers → `RegionMarker` → `MARKER_KIND_MAP → 'grove'` → `markerDerivedHiddenSites` → 3D proximity reveal as "Hidden Grove" (`groundChunkLoader.ts:349-419`). This is the template for all forest POIs.
- Forest-spur paths (road-systems campaign) currently end at a BFS-chosen forest cell; markers live in the same region-feet space, so spurs can terminate on marker coordinates.

**Boundary with the beautification wave (shipped; do not re-author):** tree meshes/species/instancing (`treeMeshGenerator.ts`, `VegetationTrees.tsx`, `treeInstancePartition.ts`), grass blades + wind, global lighting/sky/fog (`World3DLighting.tsx`), per-biome tree density. This campaign adds on top: 2D symbols, spatial clustering, undergrowth, forest-local atmosphere, forest-as-place.

## Design

### 1. Named forests (first-class world data)

A new atlas-time pass, after biomes are assigned (biome classification is untouched):

- Flood-fill contiguous cells whose biome ∈ {5 tropical seasonal, 6 temperate deciduous, 7 tropical rainforest, 8 temperate rainforest, 9 taiga} into clusters. Clusters below a minimum cell count (tunable, ~4) stay anonymous (copses, not forests).
- Each cluster becomes `Forest { id, cellIds, name, kind, poleXY }`:
  - `name` via the zones-generator naming pattern — culture adjective + a forest word bank (Forest, Woods, Wood, Wildwood, Weald, Timberland; taiga clusters bias to Pinewood/Firwood; rainforest to Jungle/Tangle). Names must feel like the state/province names around them (same culture source).
  - `poleXY` via `getPolesOfInaccessibility` for the label anchor.
- Stored as `pack.forests` and mirrored to a canonical `AtlasForest` on the atlas artifact (id, cellIds, name, kind) — same pattern as `AtlasRoute`.
- **World-preservation doctrine (from the roads campaign, binding):** the pass runs AFTER all existing world-gen stages consume RNG, uses its own seeded stream (`streamPath(seed, 'forests')`), and only ADDS data (`pack.forests`, labels). Every existing golden stays byte-identical.
- Map label: new `'forest'` label kind — italic, sized by cluster area, lower declutter priority than states/burgs so forest names never crowd civilization. Toggleable with the existing label layer.
- Travel readout hook: a route crossing a named forest can name it ("through the Thainwood") — small, high-flavor.

### 2. Readable forests (2D tree fills)

Light up the dead icon data in BOTH renderers (shared helper, mirroring how `routeMapStyle` unified route strokes):

- Per forest cell, stamp small tree glyphs (deciduous/conifer/palm/swamp shapes per the biome's `icons` table) at a density scaled from `iconsDensity`, deterministic per cell (seeded by cell id, no RNG stream contention), zoom-aware (glyphs fade/thin when zoomed far out so the map stays clean; full stamps appear as you zoom in).
- Canvas (`atlasDraw.ts`) draws glyphs into the terrain-texture pass; SVG (`atlasSvg.ts`/`AtlasLayers.tsx`) emits a symbol layer with `<use>` references to keep the DOM light.
- Forest-kind tinting is subtle: ancient slightly deeper hue, haunted desaturated + cooler, fey slightly luminous — readable side by side but never garish. Exact values in the tunables module.
- The flat biome fill stays underneath (fallback intact when the symbol layer is toggled off).

### 3. Forest characters (variants live)

Per-forest `kind: 'ordinary' | 'ancient' | 'haunted' | 'fey'`, assigned at cluster time from the forests RNG stream:

- **ancient**: the largest cluster per landmass above an area threshold, preferring clusters rich in temperate-rainforest cells (index 8 already plays as `forest_ancient` today). Deterministic, no roll.
- **haunted / fey**: rare seeded rolls (tunable, ~6% / ~4% of qualifying clusters), weighted up by isolation (far from burgs) for haunted and by proximity to water/meadow boundaries for fey. Mutually exclusive with ancient.
- Gameplay wiring — **escalate-only rule:** `biomeForCell` consults forest membership. A haunted or fey forest overrides its cells to `forest_haunted`/`forest_fey`; every other cell keeps today's plain mapping untouched (including temperate rainforest → `forest_ancient`, which already works). Kind never downgrades a cell — existing worlds play exactly as before except inside the rare haunted/fey woods. This is the switch that makes the dormant encounter/magic tables reachable. Travel events gain variant-keyed pools (`forest_haunted` → its own small event set; partial-match fallback to `forest` keeps working).
- Naming reflects kind: haunted forests draw from a darker word bank (Hagmire, Gloomwood pattern: adjective bank swap), fey from a brighter one. The 2D tint (slice 2) and the readout wording pick up the kind.
- Navigation: haunted/fey forests raise the getting-lost DC ladder by +2 (they actively mislead) — one tunable, threaded through the existing `navDC` path.

### 4. Paths lead somewhere (forest POIs)

- New marker types in `markers-generator`: `hunter-camp`, `hermit-hollow`, `forest-shrine`, `beast-den` — placed inside named forests (density tunable, roughly one POI per N forest cells, biased toward larger forests), named via the existing culture-aware marker naming. Additive pass at the end of marker generation, own RNG stream (`streamPath(seed, 'forests:poi')`), goldens untouched.
- `MARKER_KIND_MAP` gains their `HiddenPlaceKind` mappings (camp, hermit, shrine, den — den routes to hostiles like brigands do when the forest is haunted).
- **Forest-spur retargeting:** when a village's spur path (roads campaign) has a forest POI within its search radius, the spur terminates at the POI's cell instead of an arbitrary forest cell. Paths now go from villages to hunter camps and shrines — the world explains itself.
- Discovery: walking near one in 3D reveals it via the existing `markerDerivedHiddenSites` bridge; rumor/tavern hooks are recorded as a follow-up (ties into the dungeon rumor system), not built here.

### 5. Deep forest feels deep (3D)

- **Thickets and clearings:** the tree placement pass gains the same two-octave noise gate grass already uses — one shared noise so clearings in the trees and gaps in the grass line up. Blue-noise separation stays (the wave owns density; this adds spatial grouping). Clearings become natural POI/discovery sites.
- **Undergrowth:** scrub-species instances (existing mesh, no new art) scatter under canopy in dense-forest cells at a tunable density — the floor stops being bare.
- **Canopy atmosphere:** a forest-interior modulation layer that consumes the dead flags — when the player's cell is dense forest (`canopyShade: true`), ambient light dips and fog draws in (biome `fog: light|medium|heavy` scales it), lerping over a few seconds on entry/exit. Implemented as a modifier feeding the existing lighting rig's values — `World3DLighting` internals stay owned by the beautification wave; this adjusts its inputs, not its structure. Haunted forests push the fog one step heavier; fey forests tint it faintly.

## Tunables

One module (pattern from `roadTunables.ts`): minimum forest cell count, ancient area thresholds, haunted/fey percentages and weights, POI density, label size/priority curve, 2D glyph density/zoom ramps, kind tints, undergrowth density, canopy light/fog deltas, nav DC bump. All starting values, expected to be tuned after eyeball.

## Out of scope (recorded, not built)

- Rumor/tavern surfacing of forest POIs (ties into dungeon rumor system).
- Forest history in the chronicle (reverse-generational hooks — forests now HAVE stable ids for it later).
- Seasonal foliage, weather interaction.
- New tree species or mesh work (beautification wave owns meshes).
- Legacy grid lane (retirement-targeted; untouched).
- Sub-cell forest boundaries (forest edge follows Voronoi cells, as biomes do).

## Slices (build order)

1. Named forests (cluster + name + label + artifact + readout naming).
2. 2D tree fills (shared glyph helper, both renderers, zoom-aware, kind tints).
3. Forest characters (kind assignment + biome translation override + variant events + nav DC bump + kind naming banks).
4. Forest POIs + spur retargeting (markers, kind map, discovery, path endpoints).
5. 3D deep forest (shared clearing noise, undergrowth, canopy atmosphere).

Slice 1 is the foundation; 2–5 each depend on it; 3 before 4 (dens behave by kind); 5's base (clustering, undergrowth, canopy) is independent of 2–4, but its haunted/fey atmosphere touches depend on 3.

## Test strategy

- TDD throughout; every generation pass deterministic (same seed → same forests/names/kinds/POIs) with signature tests.
- Golden protection: full FMG world test must stay byte-identical for all pre-existing fields (the roads campaign's harness already pins this).
- Cluster invariants: every forest cell in exactly one forest; no forest below minimum size; ancient uniqueness per landmass.
- Render smoke tests for the glyph layer + mandatory visual eyeball per standing rule (2D both renderers, 3D interior before/after).
- Variant reachability test: a seeded world with a haunted forest produces `forest_haunted` from `biomeForCell` inside it and plain `forest_temperate` outside.

## Open

- Word banks for names (drafts in the plan; Remy may want a pass on flavor).
- ~~Duplicate names~~ RESOLVED 2026-07-11 (Remy ruling): geographic suffix — lowest-id keeps the bare name, twins gain " of the <Compass>", triples fall back to the Greater/the Lesser. RNG-free pass, zero pinned shifts.
- Grass gaps and tree clearings share the noise PRIMITIVE but not salts/frequencies, so they do not visually align yet — aligning means retuning the shipped grass field (visual decision, after the 3D eyeball).
- **3D live eyeball (the gate to done):** canopy dim + fog by grade (haunted heavier), thickets/clearings, undergrowth floor — needs an in-game playthrough; joins the standing live-look queue.
- Eyeball-gated tuning calls: glyph density at low zoom (Remy ruled leave-as-is pending in-game look), retargeted-path smoothing. (Label sizing RESOLVED 2026-07-11: area-scaled 9→16px live per Remy ruling.)
- Forest name labels are SVG-side only (in-game view has them; the canvas dev harness draws glyphs but no forest names) — parity is a dev-tool nicety.
- Undergrowth roughly doubles dense-window Stage-A placement work (off-thread; profile at the eyeball, squared-distance min-sep is the cheap win if slow).
- Whether forest POIs should later anchor dungeon entrances (dungeon placement work).
- Canopy atmosphere numbers need the in-3D eyeball to tune (light/fog deltas are guesses until seen).
- Whether the travel readout names every forest crossed or only the largest on the route.
