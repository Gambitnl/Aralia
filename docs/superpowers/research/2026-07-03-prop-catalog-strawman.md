# Prop-Catalog STRAWMAN — Beautification Wave

**Status: STRAWMAN for Remy to edit. Your taste overrides everything here.**
This is a rich first draft, not a decision. React to it — cut entries, rename
them, re-tag referee data, move WAVE-1 flags around. It exists so you edit a
draft instead of authoring from a blank page.

**Date:** 2026-07-03 · **Author:** Fable 5 (research pass)
**Parent spec:** `../specs/2026-07-02-world-beautification-wave.md`
**Sub-specs:** `../specs/subspecs/beautification--prop-catalogs.md`,
`../specs/subspecs/beautification--prop-schema-placement-engine.md`

---

## How to read an entry

Every prop carries the exact referee vocabulary the combat extraction and spell
corpus already consume (`BattleMapTile`: `providesCover` / `blocksLoS` /
`blocksMovement` / `material` / `thicknessInches`; material is the
`MaterialType` enum — wood, stone, dirt, metal, lead, glass, flesh, water,
fabric, paper, force).

Columns per entry:

- **Size** — footprint in 5-ft cells. S = fits in 1 cell, M = 1×2 or 2×2,
  L = spans 3+ cells / a wall-like run.
- **Cover** — `none` / `half` (+2 AC) / `three-quarters` (+5 AC) / `full`.
- **Sight** — blocks line of sight y/n.
- **Move** — blocks movement (impassable) y/n. (Half-cover-but-passable is the
  common "vault over / squeeze past" case.)
- **Material + thickness** — MaterialType + rough inches, drives spell
  penetration + object HP.
- **Placement rule** — what it clusters near and typical cluster size.
- **Fire/destruct** — flammable? destructible? (feeds later hazard + combat).
- **Gen class** — build difficulty:
  - **PC** = primitive-composable (boxes/cylinders + booleans; owned generator
    handles it day one).
  - **NC** = needs-curves (lathe/spline/organic displacement; owned generator,
    more work).
  - **HA** = hero-asset (bespoke mesh or heavy detailing; last, or placeholder
    first).

**Referee-data note (strawman assumption, flag if wrong):** "thickness" for a
hollow prop (crate, barrel) is the *wall* thickness, not the solid span — a
crate is ~1 in of wood, not 30 in. That keeps spell-penetration honest (a
crate does not block Detect Magic the way a stone wall does).

---

## WAVE-1 picks (highest scene-transforming value per effort)

~25% of the catalog. Rationale: each is a primitive-composable (PC) build,
appears in **many** contexts, and does the most to kill the "sparse and plain"
look per unit of generator effort. These are the density backbone — the objects
BG3 scatters by the hundred.

| Prop | Contexts it dresses | Why WAVE-1 |
|---|---|---|
| Crate | market, docks, smithy, warehouse, tavern, poor quarter | Universal clutter atom; stacks into cover; pure PC box |
| Barrel | docks, tavern, market, smithy, farmstead, cellar | Same universality; one lathe/cylinder recipe reused everywhere |
| Sack / grain bag | market, docks, farmstead, mill | Soft-form filler that reads "goods"; cheap, high count |
| Wooden fence / rail run | farmstead, village lane, poor quarter, pasture | Defines *ownership* of space instantly; L-run PC, huge readability win |
| Firewood / log pile | smithy, tavern, poor quarter, farmstead, village | Says "someone lives here"; PC stacked cylinders; cover too |
| Cart (two-wheel handcart) | market, village lane, farmstead, gate | Iconic "lived-in" silhouette; PC boxes + 2 wheels |
| Market stall | market square | The single object that makes a market read as a market |
| Well (stone) | village lane, market, poor quarter, farmstead | Village-center anchor; PC cylinder; strong focal point |
| Boulder (scatter) | rocky hills, forest, riverbank, defile, ruin | The wilderness cover atom; one NC recipe seeds everything |
| Fallen log | forest, riverbank, defile, ruin | Wilderness half-cover + walkable-vault; reuses log geometry |
| Bush / thicket clump | forest, riverbank, roadside, graveyard | Soft cover + sight-block; the vegetation-density workhorse |
| Hay bale / haystack | farmstead, village, market (fodder) | Big cheap mass; warms rural scenes; flammable drama |
| Wooden crate-stack / pallet | docks, market, warehouse | Pre-clustered cover geometry; multiplies crate value |
| Water trough | village lane, farmstead, smithy, gate | Small anchor that reads "animals live here"; PC box |

**WAVE-1 count: 14 of ~58 entries (~24%).** All PC except boulder / fallen log /
bush (NC), which are the irreducible wilderness trio — the world is *mostly*
wilderness, so they earn WAVE-1 despite the curve cost.

---

# TOWN CONTEXTS

## 1. Market square

Placement anchors: building `role: 'market'` plots, the open plaza between them,
road spurs into the square.

| Prop | Size | Cover | Sight | Move | Material + thick | Placement rule | Fire/destruct | Gen |
|---|---|---|---|---|---|---|---|---|
| Market stall (WAVE-1) | M | half | n | n (open front) | wood 1.5in + fabric awning | plaza edges, rows of 4–8 facing aisles | flammable; destructible | PC |
| Crate (WAVE-1) | S | half | y (if stacked) | y | wood 1in wall | stall bases + plaza corners, clusters 2–5 | flammable; destructible | PC |
| Barrel (WAVE-1) | S | half | y | y | wood 1in wall | beside stalls, groups 1–4 | flammable; destructible | PC |
| Sack / grain bag (WAVE-1) | S | none | n | n | fabric 0.5in | slumped against stalls/crates, piles of 3–6 | flammable; destructible | PC |
| Cart / handcart (WAVE-1) | M | half | n | partial (bed blocks) | wood 2in | parked at plaza edge, 1–3 | flammable; destructible | PC |
| Produce basket | S | none | n | n | organic/wood 0.3in | atop stalls + ground, scatter | flammable; destructible | NC (weave) |
| Awning / canopy pole | S | none | n | y (pole only) | wood 3in + fabric | over stalls; poles at cell corners | flammable | PC |
| Public notice board | S | half | y | y | wood 2in | one per square, near main road spur | flammable; destructible | PC |
| Fountain / market cross | L | half | partial | y | stone 8in | plaza center, single focal | inert; hard-destruct | HA |
| Trestle table + benches | M | half | n | partial | wood 2in | near tavern-adjacent stalls, 1–2 | flammable; destructible | PC |

## 2. Docks / harbor

Anchors: `GroundDeck` kind `'dock'`, water edges (`waterBodies`), warehouse
(`role: 'workshop'`/storage) doors near water.

| Prop | Size | Cover | Sight | Move | Material + thick | Placement rule | Fire/destruct | Gen |
|---|---|---|---|---|---|---|---|---|
| Crate (WAVE-1) | S | half | y | y | wood 1in | dock edge + warehouse doors, clusters 2–5 | flammable; destructible | PC |
| Crate-stack / pallet (WAVE-1) | M | three-quarters | y | y | wood 1in | dock spine, pre-stacked walls of goods | flammable; destructible | PC |
| Barrel (WAVE-1) | S | half | y | y | wood 1in | rolled to dock edge, rows + clusters | flammable; destructible | PC |
| Mooring post / bollard | S | half | n | y | wood 6in | deck edge, evenly spaced every 2–3 cells | inert; hard | PC |
| Coiled rope | S | none | n | n | organic 2in | at bollards + deck, scatter | flammable | NC (torus/spiral) |
| Fishing net (draped) | M | none | n | n (snags) | fabric 0.2in | hung on racks / draped over crates | flammable | NC (drape) |
| Net-drying rack | L | none | y | y (frame) | wood 3in | dock landward edge, 1–2 runs | flammable; destructible | PC |
| Fish barrel / crate (open) | S | half | n | y | wood 1in | near stalls, brine smell zone | flammable | PC |
| Crane / hoist (dock) | L | half | partial | y | wood 8in + rope | one per major quay | flammable; destructible | HA |
| Rowboat / skiff (beached) | L | half | n | partial (hull) | wood 1.5in | shoreline + deck edge, 1–2 | flammable; destructible | NC (hull curve) |
| Anchor (iron) | S | half | n | y | metal 2in | deck clutter, scatter 1–2 | inert; hard | NC |
| Gangplank | M | none | n | n | wood 2in | deck-to-boat, single | flammable | PC |

## 3. Smithy street

Anchors: `role: 'smithy'` plots (also generic `workshop`). The memory notes
smithy→woodpile/anvil as a canonical placement rule.

| Prop | Size | Cover | Sight | Move | Material + thick | Placement rule | Fire/destruct | Gen |
|---|---|---|---|---|---|---|---|---|
| Firewood / log pile (WAVE-1) | M | half | y | y | wood (stacked) | against smithy wall, 1–2 piles | flammable; destructible | PC |
| Anvil + stump | S | half | n | y | metal 4in / wood | at forge mouth, 1 | inert; hard | NC (horn curve) |
| Forge / furnace | M | three-quarters | y | y | stone 10in | smithy exterior wall, 1 | inert (holds fire); hard | HA |
| Grindstone (foot-treadle) | S | half | n | y | stone 4in | forge yard, 1 | inert; hard | NC (wheel) |
| Water trough (WAVE-1) | S | half | n | y | wood 2in / water | quench station at forge, 1 | destructible (spills) | PC |
| Coal / ore heap | S | none | n | partial | stone/dirt (loose) | beside forge, 1–2 | inert; difficult terrain | NC (heap) |
| Barrel (WAVE-1) | S | half | y | y | wood 1in | tool/water storage, 1–3 | flammable | PC |
| Tool rack (tongs/hammers) | S | none | y | y | wood 2in + metal | forge wall, 1 | flammable | PC |
| Metal-bar stack / billets | S | half | n | y | metal 1in | ground by forge, 1 pile | inert; hard | PC |
| Cart (WAVE-1) | M | half | n | partial | wood 2in | delivery, parked, 1 | flammable | PC |

## 4. Tavern surroundings

Anchors: `role: 'market'` business type `'tavern'` plots; adjacent street.

| Prop | Size | Cover | Sight | Move | Material + thick | Placement rule | Fire/destruct | Gen |
|---|---|---|---|---|---|---|---|---|
| Barrel (WAVE-1) | S | half | y | y | wood 1in | ale delivery at door, clusters 2–5 | flammable | PC |
| Trestle table + benches | M | half | n | partial | wood 2in | out front, 1–3 sets | flammable; destructible | PC |
| Firewood / log pile (WAVE-1) | M | half | y | y | wood | side wall, 1 | flammable | PC |
| Hanging tavern sign | S | none | n | y (post) | wood 2in + metal bracket | over door, 1 | flammable | PC |
| Lantern post | S | none | n | y | wood 4in + glass | door + street corners | glass breaks | PC |
| Slop bucket / washtub | S | none | n | n | wood 1in / water | back alley, scatter | flammable | PC |
| Overturned barrel (table) | S | half | n | y | wood 1in | improvised seating, 1–2 | flammable | PC |
| Crate (WAVE-1) | S | half | y | y | wood 1in | delivery clutter, 2–4 | flammable | PC |
| Stable rail + trough (WAVE-1) | L | half | n | y (rail) | wood 3in | inn-yard side, 1 run | flammable | PC |

## 5. Poor quarter

Anchors: dense small `role: 'house'` plots, narrow lanes, no plaza. Read:
patched, crowded, improvised.

| Prop | Size | Cover | Sight | Move | Material + thick | Placement rule | Fire/destruct | Gen |
|---|---|---|---|---|---|---|---|---|
| Firewood / log pile (WAVE-1) | M | half | y | y | wood | every 2–3 doors, small | flammable | PC |
| Broken fence / lean-to rail (WAVE-1) | L | half | n | y (partial gaps) | wood 2in | between shacks, irregular runs | flammable; destructible | PC |
| Rubbish / refuse heap | S | none | n | partial | organic/dirt | alley corners, scatter | flammable; difficult | NC (heap) |
| Washing line + laundry | L | none | n (cloth sways) | y (posts) | fabric 0.2in | strung between houses overhead | flammable | PC |
| Cracked water butt / barrel (WAVE-1) | S | half | y | y | wood 1in | under eaves catching rain, 1 per few doors | flammable | PC |
| Chicken coop / hutch | S | half | y | y | wood 1in | tucked by doors, scatter | flammable; destructible | PC |
| Sack / grain bag (WAVE-1) | S | none | n | n | fabric | doorsteps, piles 2–4 | flammable | PC |
| Handcart (broken) (WAVE-1) | M | half | n | partial | wood 2in | abandoned in lane, 1 | flammable | PC |
| Chamber-pot / crockery scatter | S | none | n | n | glass/organic | ground scatter | breaks | PC |

## 6. Wealthy quarter

Anchors: larger `role: 'house'` plots, styled architecture (chimney flag),
wider clean streets. Read: ordered, ornamental, few loose goods.

| Prop | Size | Cover | Sight | Move | Material + thick | Placement rule | Fire/destruct | Gen |
|---|---|---|---|---|---|---|---|---|
| Ornamental hedge run | L | half | y | y | organic | property borders, trimmed runs | flammable (dry); difficult | NC |
| Wrought-iron fence + gate | L | half | n | y | metal 1in | front boundary, clean runs | inert; hard | HA |
| Stone planter / urn | S | half | n | y | stone 4in | flanking doors, pairs | inert; hard | NC (lathe) |
| Statue / plinth | M | three-quarters | y | y | stone 12in | courtyard / square focal, 1 | inert; hard | HA |
| Stone bench | M | half | n | y | stone 6in | garden edges, 1–2 | inert; hard | PC |
| Ornamental well / fountain | L | half | partial | y | stone 8in | courtyard center | inert; hard | HA |
| Carriage (four-wheel) | L | three-quarters | y | y | wood 2in | before grand doors, 1 | flammable; destructible | HA |
| Lantern post (wrought) | S | none | n | y | metal 3in + glass | street-lining, evenly spaced | glass breaks | NC |
| Topiary / potted tree | S | half | y | y | organic | door flanks, pairs | flammable | NC |

## 7. Farmstead

Anchors: `role: 'farm'` plots, rural edge of town extent, pasture between
buildings. Memory: rural farmsteads + realistic occupancy are canon.

| Prop | Size | Cover | Sight | Move | Material + thick | Placement rule | Fire/destruct | Gen |
|---|---|---|---|---|---|---|---|---|
| Wooden fence / rail run (WAVE-1) | L | half | n | y | wood 3in | pasture + yard boundaries, long runs | flammable; destructible | PC |
| Haystack / hay bale (WAVE-1) | M | half | y | y | organic (dry) | field + barn side, 1–4 | very flammable; destructible | NC (mass) |
| Well (WAVE-1) | S | half | partial | y | stone 8in | yard center, 1 | inert; hard | PC |
| Water trough (WAVE-1) | S | half | n | y | wood 2in / water | by fence gate + barn, 1–2 | destructible | PC |
| Cart / wagon (WAVE-1) | M | half | n | partial | wood 2in | yard + field edge, 1–2 | flammable | PC |
| Plough / harrow | M | half | n | partial | wood 3in + metal | leaned by barn, 1 | flammable | NC |
| Firewood / log pile (WAVE-1) | M | half | y | y | wood | farmhouse wall, 1–2 | flammable | PC |
| Sack / grain bag (WAVE-1) | S | none | n | n | fabric | barn door, piles 3–8 | flammable | PC |
| Chicken coop | S | half | y | y | wood 1in | yard, 1–2 | flammable | PC |
| Pigpen / livestock hurdle | L | half | n | y | wood 2in | yard corner enclosure | flammable | PC |
| Scarecrow | S | none | n | y (post) | wood 2in + fabric | field center, scatter | flammable | PC |
| Grindstone / millstone (spare) | S | half | n | y | stone 4in | leaned by wall, 1 | inert; hard | NC |
| Beehive skep | S | none | n | y | organic | orchard edge, 1–3 | flammable | NC |

## 8. Village lane

Anchors: road centerlines (`roads`) through low-density plots, no market.
The generic "between places" town street.

| Prop | Size | Cover | Sight | Move | Material + thick | Placement rule | Fire/destruct | Gen |
|---|---|---|---|---|---|---|---|---|
| Well (WAVE-1) | S | half | partial | y | stone 8in | lane widening / junction, 1 | inert; hard | PC |
| Wooden fence run (WAVE-1) | L | half | n | y | wood 3in | garden fronts along lane | flammable | PC |
| Water trough (WAVE-1) | S | half | n | y | wood 2in | at well + junctions | destructible | PC |
| Cart (WAVE-1) | M | half | n | partial | wood 2in | parked roadside, 1–2 | flammable | PC |
| Firewood pile (WAVE-1) | M | half | y | y | wood | house walls, scatter | flammable | PC |
| Milestone / waymarker | S | half | n | y | stone 6in | lane forks, 1 | inert; hard | PC |
| Wayside shrine | S | half | y | y | stone 8in | lane edge, rare 1 | inert; hard | NC |
| Bench (rough wood) | M | half | n | y | wood 2in | by well / wall, 1 | flammable | PC |
| Dung / muck heap | S | none | n | partial | organic | lane edge, scatter | flammable; difficult | NC (heap) |

## 9. Town gate / walls

Anchors: `walls` polylines + `gatehouses` array (already carries gap + form).

| Prop | Size | Cover | Sight | Move | Material + thick | Placement rule | Fire/destruct | Gen |
|---|---|---|---|---|---|---|---|---|
| Wall merlon / crenellation | L | three-quarters | y | y | stone 24in | atop wall runs, repeating | inert; hard | PC |
| Wooden gate (double-leaf) | L | full | y | y | wood 4in + metal | in gatehouse gap, 1 | flammable; destructible | PC |
| Portcullis | L | three-quarters | partial | y | metal 2in | gate arch, 1 | inert; hard | NC |
| Guard brazier | S | none | n | y | metal 2in | flanking gate, pairs | holds fire | NC (bowl) |
| Weapon rack (spears) | S | half | y | y | wood 2in + metal | guard post wall, 1 | flammable | PC |
| Sandbag / earth rampart | L | three-quarters | y | y | fabric/dirt | inside wall base, runs | flammable (bags) | PC |
| Barrier / checkpoint bar | M | half | n | y | wood 4in | across gate road, 1 | flammable | PC |
| Wall ladder | S | none | n | y | wood 2in | inside wall, scatter | flammable | PC |
| Barrel (pitch/water) (WAVE-1) | S | half | y | y | wood 1in | wall-walk + gate, 2–4 | flammable | PC |
| Cart (blocking, wartime) (WAVE-1) | M | half | n | partial | wood 2in | inside gate, 1 | flammable | PC |

## 10. Graveyard / temple yard

Anchors: `role: 'temple'` plots + adjacent consecrated yard; also hidden-site
kinds may map here.

| Prop | Size | Cover | Sight | Move | Material + thick | Placement rule | Fire/destruct | Gen |
|---|---|---|---|---|---|---|---|---|
| Gravestone / headstone | S | half | y | y | stone 4in | rows in yard, many, seeded grid+jitter | inert; hard | PC |
| Tomb / sarcophagus | M | three-quarters | y | y | stone 10in | yard prominent spots, few | inert; hard | NC |
| Stone cross / monument | M | three-quarters | y | y | stone 8in | yard center / gate, 1 | inert; hard | HA |
| Lych-gate | L | half | y | y | wood 4in | yard entrance, 1 | flammable | NC |
| Low boundary wall | L | half | n | y | stone 12in | yard perimeter, runs | inert; hard | PC |
| Iron fence rail | L | half | n | y | metal 1in | plot borders | inert; hard | NC |
| Statue (saint/mourner) | M | three-quarters | y | y | stone 10in | yard focal, few | inert; hard | HA |
| Offering brazier / candle stand | S | none | n | y | metal 2in | temple door, pairs | holds fire | NC |
| Fresh-dug grave mound | S | none | n | partial | dirt | yard edge, 1–2 | difficult terrain | NC (mound) |
| Bush / thicket (WAVE-1) | S | half | y | y | organic | yard borders, scatter | flammable | NC |

---

# WILDERNESS CONTEXTS

Anchors: biome ids (`biomeIds`), heightfield slope, `rivers` polylines, `roads`,
`hiddenSites` (kind `'ruin'` etc.). Placement is seeded cover-scatter with
clustering, NOT uniform.

## 11. Forest

| Prop | Size | Cover | Sight | Move | Material + thick | Placement rule | Fire/destruct | Gen |
|---|---|---|---|---|---|---|---|---|
| Boulder (WAVE-1) | S–M | half–three-quarters | y | y | stone (solid) | slope + clearings, clusters 2–6 | inert; hard | NC |
| Fallen log (WAVE-1) | L | half | n | partial (vault) | wood (solid) | forest floor, scatter + across trails | flammable; destructible | NC |
| Bush / thicket (WAVE-1) | S | half | y | y | organic | understory, dense clusters | flammable; difficult | NC |
| Tree stump | S | half | n | y | wood (solid) | near fallen logs + clearings | flammable | NC |
| Deadfall / branch tangle | M | half | y | partial | wood | around stumps, scatter | very flammable; difficult | NC |
| Mossy rock cluster | M | half | y | y | stone | damp hollows, 2–4 | inert; hard | NC |
| Bramble patch | M | half | y | y (difficult) | organic | edges + clearings | flammable; difficult | NC |
| Mushroom ring / fungal shelf | S | none | n | n | organic | log + stump bases, scatter | flammable | NC |
| Fern / undergrowth clump | S | none | n | n | organic | ground cover fill, dense | flammable | NC |

## 12. Rocky hills

| Prop | Size | Cover | Sight | Move | Material + thick | Placement rule | Fire/destruct | Gen |
|---|---|---|---|---|---|---|---|---|
| Boulder (WAVE-1) | M–L | three-quarters | y | y | stone (solid) | high-slope cells, clusters | inert; hard | NC |
| Rock outcrop / crag | L | full | y | y | stone (solid) | ridgelines, spanning runs | inert; hard | HA |
| Scree / loose-rock field | L | none | n | y (difficult) | stone (loose) | below crags, patches | difficult terrain | NC (scatter) |
| Standing stone / menhir | M | three-quarters | y | y | stone 18in | hilltop, rare 1–3 | inert; hard | NC |
| Cave mouth / overhang | L | full | y | y | stone | cliff base, 1 | inert; hard | HA |
| Dry stone wall (ruined) | L | half | n | y | stone 18in | old field boundaries, runs | inert; hard | PC |
| Gorse / hardy shrub | S | half | y | y | organic | between rocks, scatter | flammable | NC |
| Small cairn | S | half | n | y | stone | trail markers on ridge | inert; hard | PC |

## 13. Riverbank

| Prop | Size | Cover | Sight | Move | Material + thick | Placement rule | Fire/destruct | Gen |
|---|---|---|---|---|---|---|---|---|
| Fallen log (WAVE-1) | L | half | n | partial | wood | half-in-water at bends, scatter | flammable | NC |
| Boulder (wet) (WAVE-1) | S–M | half | y | y | stone | in + beside channel, clusters | inert; hard | NC |
| Reed / rush bed | M | half | y | y (difficult) | organic | shallows + bank, dense runs | flammable (dry); difficult | NC |
| Bush / willow clump (WAVE-1) | S | half | y | y | organic | bank line, scatter | flammable | NC |
| Driftwood pile | M | half | n | partial | wood | inside river bends, 1–2 | flammable | NC |
| Gravel / shingle bar | L | none | n | n | stone (loose) | inner bends, flat | difficult terrain | NC |
| Stepping stones | S×n | none | n | n | stone | narrow crossings, lines | inert; hard | PC |
| Muddy flat | L | none | n | y (difficult) | dirt/mud | bank low spots | difficult terrain | PC |
| Old jetty post (rotted) | S | half | n | y | wood 6in | abandoned crossing, 1–2 | flammable | PC |

## 14. Road / trailside

Anchors: `roads` polylines through wilderness biomes.

| Prop | Size | Cover | Sight | Move | Material + thick | Placement rule | Fire/destruct | Gen |
|---|---|---|---|---|---|---|---|---|
| Milestone / waymarker | S | half | n | y | stone 6in | road forks + intervals | inert; hard | PC |
| Wayside shrine | S | half | y | y | stone 8in | road edge, rare | inert; hard | NC |
| Roadside boulder (WAVE-1) | S–M | half | y | y | stone | verge scatter, clusters | inert; hard | NC |
| Bush / hedgerow (WAVE-1) | S–L | half | y | y | organic | flanking road, runs | flammable | NC |
| Broken cart (abandoned) (WAVE-1) | M | half | n | partial | wood 2in | verge, rare 1 | flammable | PC |
| Fingerpost / signpost | S | none | n | y | wood 3in | junctions, 1 | flammable | PC |
| Log bridge / plank crossing | M | none | n | n | wood 2in | over ditches/streams | flammable | PC |
| Ditch / bank | L | half | n | y (difficult) | dirt | alongside road, runs | difficult terrain | PC |
| Rest-stop firepit | S | none | n | y | stone | verge clearing, rare | holds fire | PC |

## 15. Ruin site

Anchors: `hiddenSites` kind `'ruin'`; scatter through any biome.

| Prop | Size | Cover | Sight | Move | Material + thick | Placement rule | Fire/destruct | Gen |
|---|---|---|---|---|---|---|---|---|
| Broken wall segment | L | three-quarters | y | y | stone 18in | footprint perimeter, runs w/ gaps | inert; hard | PC |
| Toppled column | L | half | n | partial (vault) | stone (solid) | fallen across site, scatter | inert; hard | NC |
| Standing column (partial) | M | three-quarters | y | y | stone 14in | on old wall lines, few | inert; hard | NC |
| Rubble pile (WAVE-1 uses boulder) | M | half | n | y (difficult) | stone (loose) | inside footprint, patches | difficult terrain | NC (heap) |
| Collapsed archway | L | half | y | y | stone | old doorway, 1–2 | inert; hard | HA |
| Overgrown statue (broken) | M | half | y | y | stone 10in | site focal, 1 | inert; hard | HA |
| Ivy / creeper mass | L | half | y | y | organic | over walls, draped runs | flammable | NC |
| Sunken flagstone floor | L | none | n | n | stone | site interior, flat patch | inert; hard | PC |
| Fallen roof beam (charred) | L | half | n | partial | wood (solid) | across floor, scatter | flammable | NC |
| Bramble-choked doorway | M | half | y | y (difficult) | organic | wall gaps, scatter | flammable; difficult | NC |

## 16. Ambush-worthy defile

A narrow pass with strong flanking cover — the placement engine should tag
these where a road threads high-slope terrain. Not a new prop family so much as
a *dense, one-sided arrangement* of hill + forest props for tactical drama.

| Prop | Size | Cover | Sight | Move | Material + thick | Placement rule | Fire/destruct | Gen |
|---|---|---|---|---|---|---|---|---|
| Overhang boulder (WAVE-1) | L | three-quarters | y | y | stone (solid) | above trail on slopes, clusters | inert; hard | NC |
| Fallen log (barricade) (WAVE-1) | L | half | n | y (blocks pass) | wood (solid) | across the choke, 1–2 | flammable | NC |
| Rockfall / rubble choke | L | half | n | y (difficult) | stone (loose) | narrowest point, patch | difficult terrain | NC |
| Dense thicket (flank) (WAVE-1) | M | three-quarters | y | y | organic | trail-side high ground, runs | flammable; difficult | NC |
| Dead snag / lean tree | M | half | y | y | wood | choke edges, scatter | flammable | NC |
| Sniper ledge / rock shelf | M | three-quarters | y | y | stone | above trail, flat perches | inert; hard | NC |
| Concealing crag (full cover) | L | full | y | y | stone (solid) | ambush origin, 1–2 | inert; hard | HA |

---

## Summary counts

| Context | Entries | WAVE-1 in context* |
|---|---|---|
| Market square | 10 | 5 |
| Docks / harbor | 12 | 3 |
| Smithy street | 10 | 3 |
| Tavern surroundings | 9 | 4 |
| Poor quarter | 9 | 4 |
| Wealthy quarter | 9 | 0 |
| Farmstead | 13 | 7 |
| Village lane | 9 | 5 |
| Town gate / walls | 10 | 2 |
| Graveyard / temple yard | 10 | 1 |
| Forest | 9 | 3 |
| Rocky hills | 8 | 1 |
| Riverbank | 9 | 3 |
| Road / trailside | 9 | 3 |
| Ruin site | 10 | ~1 |
| Ambush defile | 7 | 3 |

\*WAVE-1 in-context counts the *appearances* of a WAVE-1 prop; the 14 WAVE-1
props are shared across contexts (that reuse is exactly why they're WAVE-1).

- **Distinct catalog entries: ~58** across 10 town + 6 wilderness contexts.
- **WAVE-1 distinct props: 14 (~24%).**
- **Gen-class mix (rough):** ~40% PC, ~48% NC, ~12% HA. The heavy NC share is
  the wilderness cost (organic + rock forms dominate the outdoors).

## Open questions for Remy (from the sub-specs, surfaced here)

1. **Thickness convention** — confirm hollow props use wall thickness, not
   solid span (my strawman assumption; drives spell penetration).
2. **`props` array vs extend `features`** — schema sub-spec leaves this open;
   I'd lean new `props` array on `GroundWorld` so referee data stays clean.
3. **Density targets** — every "clusters 2–5" number here is a guess to be
   calibrated against BG3 anchor shots at eyeball time.
4. **Placeholder policy** — HA entries (fountain, forge, crane, carriage,
   crag) likely ship as PC-blockout placeholders in the wave, detailed later.
5. **Defile as arrangement, not family** — agree it's a placement *pattern*
   over hill+forest props rather than new meshes? (Section 16 assumes yes.)
