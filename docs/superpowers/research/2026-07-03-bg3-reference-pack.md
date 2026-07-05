# BG3 Visual-Reference Pack (Proxy) — Beautification Wave

**Date:** 2026-07-03 · **For:** World Beautification Wave
(`docs/superpowers/specs/2026-07-02-world-beautification-wave.md`, decision 6:
"Baldur's Gate 3 density + mood — dense, readable clutter where every object is
plausibly owned by someone").

## What this is (read first)

The owner can't screenshot BG3 right now, so this is a **proxy pack built from
published material** — official press, the community wiki, and environment-artist
breakdowns. Use it to calibrate density and mood eyeballs today. It is meant to be
**replaced** by the owner's own captures later (see the Shot List at the end).

**Nothing is downloaded into the repo.** All imagery is linked out. The art stays
Larian's / the artists'; we only reference it. Where an image host blocks hotlinking
or hides direct file URLs, that is flagged per source.

**One-line calibration takeaway:** BG3 exteriors are *never bare* — every walkable
surface carries ground texture and small scatter, props cluster by ownership (a
stall owns its crates, a smithy owns its woodpile), and warm point-lights sit every
few meters at night. Our current streamed world is the opposite: flat ground, uniform
scatter, no ownership. That gap is the whole wave.

---

## Source stability notes

- **bg3.wiki** (`https://bg3.wiki/...`) — STABLE, hotlink-friendly. Location pages
  carry in-game screenshots. Full-size files live at
  `https://bg3.wiki/w/images/<a>/<ab>/<File>.jpg`; thumbnails at
  `https://bg3.wiki/w/images/thumb/<a>/<ab>/<File>.jpg/<N>px-<File>.jpg`. Prefer the
  full-size path (drop `/thumb/` and the trailing `/<N>px-...` segment). These are the
  most reliable links in this pack.
- **Fextralife** (`baldursgate3.wiki.fextralife.com`) — screenshots present but the
  CDN (`https://cdn.fextralife.com/...`) sometimes rejects hotlinks; open the page and
  read the image there.
- **ArtStation** (`artstation.com/artwork/...`) — the RICHEST density references
  (environment artists' own captures), but the site returns **HTTP 403 to automated
  fetchers and blocks direct CDN hotlinking**. Links are given for the owner to open in
  a browser; do not expect them to render inline or via tooling.
- **Larian press** (`https://larian.com/press`) — official downloadable screenshots/
  B-roll; stable but gated behind a press-asset UI rather than direct file URLs.

---

## Per-context references + density/mood analysis

Counts marked *(est.)* are eyeballed from the referenced imagery and general BG3
familiarity, not exact game-file audits. They exist to give the placement engine a
target order-of-magnitude, not a spec.

### 1. Town street (Lower City, Baldur's Gate — Act 3)

**Reference links**
- Wiki location page (in-game vistas): https://bg3.wiki/wiki/Lower_City
- Lower City panorama (full-size):
  `https://bg3.wiki/w/images/e/e2/Lower_City.jpg`
- Artist breakdown — Rick van den Berg, "Lower City" (layout, street decoration,
  exterior lighting): https://www.artstation.com/artwork/8bzYZE *(ArtStation, open in
  browser)*
- Artist breakdown — Stimona Milanova, "Lower City":
  https://www.artstation.com/artwork/EvJRl2 *(ArtStation)*
- Artist breakdown — "City Houses": https://www.artstation.com/artwork/qeBo2y
- Artist breakdown — "City Props": https://www.artstation.com/artwork/49z08W

**Density + mood**
- **Prop instances visible in a typical street framing:** ~25–45 *(est.)* discrete
  objects. Prop TYPES seen: cobblestone paving with worn ruts, wall-mounted iron
  lanterns, hanging shop/tavern signs, market awnings, wooden shutters/window boxes,
  barrels and crates stacked against walls, sacks, a cart or two, laundry/cloth
  strung between upper floors, chimney smoke, potted plants, refuse/cobble debris,
  street-level clutter around doorways.
- **Ground cover:** never bare. Cobblestone with color/wear variation, puddles, dirt
  fills between stones, scattered debris and dropped leaves in gutters.
- **Light sources:** wall lanterns roughly every ~8–12 m of façade plus interior
  window glow spilling to the street; hero lanterns at junctions. Multi-story
  buildings frame the sky to a strip, so ambient reads as directional slot light.
- **Palette:** warm sandstone/ochre walls, weathered brown timber, cool grey-blue
  stone paving, muted terracotta roofs; saturation kept moderate, contrast from lit
  windows against shadowed stone.

### 2. Market / vendor area (Rivington traders row + Circus of the Last Days)

**Reference links**
- Circus of the Last Days (traders + performers row):
  https://bg3.wiki/wiki/Circus_of_the_Last_Days
- Fextralife circus page (screenshots):
  https://baldursgate3.wiki.fextralife.com/Circus+of+The+Last+Days
- Rivington overview: https://www.pcgamer.com/why-rivington-is-my-favourite-area-in-baldurs-gate-3/
- Act-3 Rivington map/screens:
  https://www.gamerguides.com/baldurs-gate-3/guide/walkthrough/wyrms-crossing-and-rivington/baldurs-gate-3-act-3-map-lower-city-sewers-and-rivington

**Density + mood**
- **Layout observed:** a rough U/row — traders and performers line one side, cages/
  stage on the other, ringmaster's tent at the far end. Stalls and tents sit
  shoulder-to-shoulder, not spaced out.
- **Per-stall clutter:** ~6–12 *(est.)* loose props per stall — displayed wares
  (produce, bottles, cloth bolts, trinkets, hanging goods), the counter itself, a
  crate/barrel understock, an awning or tent canopy, a lantern or hanging light,
  stools/table, sacks on the ground.
- **Prop TYPES:** market stalls with striped/canvas awnings, tents, wagons/carts
  (some as fixed set-dressing), cages, banners and bunting, hanging lanterns, crates
  and barrels as understock, produce baskets, cloth bolts, bottles.
- **Ground cover:** trodden dirt/mud with straw scatter, cart ruts, dropped produce,
  spilled goods — busiest ground-cover of any context.
- **Light sources:** hanging lanterns and torch stands strung along the row, ~2–3 per
  10 m *(est.)*, plus warm glow from tent interiors.
- **Palette:** warmest of all contexts — canvas cream, red/gold banners, lantern
  amber, produce greens/oranges against brown mud.

### 3. Docks / harbor (Grey Harbour Docks — Act 3)

**Reference links**
- Wiki location page: https://bg3.wiki/wiki/Grey_Harbour_Docks
- Grey Harbour vista (full-size):
  `https://bg3.wiki/w/images/8/89/GreyHarbourVistaLodge.png`
- Lustrous Lass (quarantined ship, deck clutter):
  `https://bg3.wiki/w/images/d/dc/Lustrous_Lass.jpg`
- Fextralife docks page: https://baldursgate3.wiki.fextralife.com/Grey+Harbour+Docks
- Artist breakdown — Tim Wilmsen, "Dock Warehouse Basement":
  https://www.artstation.com/artwork/qeByQ2 *(ArtStation)*

**Density + mood**
- **Prop TYPES seen:** wooden piers/gangplanks, moored ships, dock cranes with
  suspended cargo, metal and wooden crates, barrels (incl. smokepowder barrels),
  fishing drying racks and nets, ropes/rigging, coiled hawsers, bollards, lanterns,
  "secure area" signage, stacked cargo pallets, stone-paved embankment.
- **Density:** cargo clusters at loading points — a crane will have 4–8 crates/barrels
  pooled under it *(est.)*; piers carry ropes, nets, and a barrel or two per few
  meters. Open water breaks up the density, so it reads less dense than a market but
  the *worked* zones are packed.
- **Ground cover:** stone embankment with wet sheen and puddles up top; weathered
  planking with gaps, rope coils, and net piles on the piers. Not bare.
- **Light sources:** dock lanterns on posts and building corners; cooler overall than
  town because of water and (often) overcast/dusk mood.
- **Palette:** weathered grey-brown timber, wet stone grey, rope tan, water blue-green
  reflections, iron dark; low saturation, industrial.

### 4. Tavern / inn exterior (Blushing Mermaid, Elfsong Tavern)

**Reference links**
- The Blushing Mermaid (ship-hulk tavern, harbor-side terrace):
  https://bg3.wiki/wiki/The_Blushing_Mermaid
- Elfsong Tavern (two-story, large terraces, accessible roof):
  https://bg3.wiki/wiki/Elfsong_Tavern
- Fextralife Blushing Mermaid: https://baldursgate3.wiki.fextralife.com/Blushing+Mermaid

**Density + mood**
- **Prop TYPES:** outdoor terraces with tables, benches, stools; barrels (ale) stacked
  by the door; a hanging carved sign (the Mermaid's painted-tail statue, the Elfsong
  board); lanterns flanking the entrance; crates of delivery stock; a cart; string
  lights or lanterns over the terrace; the Blushing Mermaid's hull-as-building gives
  ship timbers, rigging, and a foredeck-turned-terrace.
- **Density:** the entrance/terrace is a dense focal cluster — ~10–20 props *(est.)*
  packed at the doorway and seating, thinning quickly a few meters out. This "hotspot
  around the door" pattern is the key ownership read: the tavern owns the barrels and
  tables in front of it.
- **Ground cover:** paving/planking with spilled straw, the odd dropped tankard, wear
  paths to the door.
- **Light sources:** the brightest warm hotspot in a night street — flanking entrance
  lanterns plus every window glowing amber; a lit tavern is a beacon.
- **Palette:** deep warm interior amber leaking out, dark weathered timber frame, brass
  lantern glints.

### 5. Village / farm (Blighted Village, and rural set-dressing)

**Reference links**
- Blighted Village (ruined rural village, windmill, smithy, well):
  https://bg3.wiki/wiki/Blighted_Village
- Blighted Village overview (full-size):
  `https://bg3.wiki/w/images/0/01/Blighted_Village.jpg`
- Blacksmith's Forge (forge clutter, blue sussur flame):
  `https://bg3.wiki/w/images/5/59/Blacksmiths_Forge.jpg`

**Density + mood**
- **Prop TYPES:** central stone well (landmark), windmill, abandoned carts/wagons,
  wooden crates and barrels scattered, fences and gates, woodpiles, a smithy with
  anvil/forge/tools/cookware, apothecary and schoolhouse dressing, wooden platforms
  and mezzanines, debris across streets.
- **Density:** lower than urban but still clustered by function — the smithy owns its
  woodpile, anvil, and tool rack; a house owns its cart and barrels. Even "abandoned"
  it is not empty: debris fills the streets. For a *living* village, read this as the
  same clustering with tidier, in-use props.
- **Ground cover:** dirt/mud tracks, grass tufts creeping between buildings, scattered
  debris and dropped tools, straw near the smithy. Never bare.
- **Light sources:** sparse — the forge glow (here an eerie blue) is the anchor; a
  living village would add a lantern per doorway and a hearth glow per occupied house.
- **Palette:** muted grey-brown weathered wood, faded thatch, mud; here desaturated by
  abandonment — a living version lifts saturation with painted doors and green kitchen
  gardens.

### 6. Forest path / grove (Emerald Grove wilds, ranger-camp concepts)

**Reference links**
- Emerald Grove (druid grove + refugee camp): https://bg3.wiki/wiki/Emerald_Grove
- Grove vista (full-size): `https://bg3.wiki/w/images/f/f2/Emerald_Grove.jpg`
- Secluded Cove (rocky rivershore): `https://bg3.wiki/w/images/1/10/Secluded_Cove.jpg`
- Ranger-camp concept — Dan Iorgulescu (via wiki upload):
  `https://bg3.wiki/w/images/9/99/Dan-iorgulescu-ranger-camp-dan-iorgulescu.jpg`
- Ranger-camp alt: `https://bg3.wiki/w/images/3/36/Dan-iorgulescu-baldur-s-gate-3-ranger-camp-alt-1-dan-iorgulescu.jpg`

**Density + mood**
- **Wilderness cover TYPES (this is our wilderness catalog target):** rock outcrops and
  boulders, scree, fallen logs, thickets/bushes, ferns and undergrowth, tall grass,
  tree roots and stumps, moss, rivershore pebbles, overgrown ruins and vine-covered
  stonework, a portcullis/rampart of rough timber.
- **Density:** BG3 wilderness is dense with *readable cover* — you can always find a
  boulder or log to break line-of-sight. Undergrowth clusters (a thicket is many
  overlapping bushes, not one), roots and rocks pool at tree bases and slope changes.
  Estimate ~8–15 cover objects per 10 m of path edge in a "characterful" stretch
  *(est.)*, thinning on the trodden path itself.
- **Ground cover:** the richest — layered grass, fallen leaves, ferns, exposed roots,
  dirt path worn through the green, pebbles at the water's edge. Zero bare ground.
- **Light sources:** natural — dappled canopy light, god-rays through trees; at the
  grove, cave-mouth fires and torches. Mood is green-gold and enclosed.
- **Palette:** saturated forest greens, warm bark browns, mossy stone grey, gold
  dappled highlights; much more saturated than the towns.

### 7. Roadside camp / ambush spot (party camp, refugee/goblin camps, ranger camp)

**Reference links**
- Ranger-camp concept art (bedrolls, tents, campfire layout):
  `https://bg3.wiki/w/images/9/99/Dan-iorgulescu-ranger-camp-dan-iorgulescu.jpg`
- Emerald Grove refugee camp (tents, traders, makeshift defenses):
  https://bg3.wiki/wiki/Emerald_Grove
- Tiefling Hideout (subterranean camp): https://bg3.wiki/wiki/Tiefling_Hideout

**Density + mood**
- **Prop TYPES:** tents (canvas, patched), bedrolls, campfire with cook-pot/spit,
  crates and barrels of supplies, sacks, weapon racks, a cart or wagon, makeshift
  fences/barricades, hanging lanterns, drying laundry, stacked firewood, propped
  spears/shields (for an ambush-ready spot: overturned cart as cover, barricade line,
  arrow-nocked figures on ramparts).
- **Density:** tight functional cluster around the fire — ~15–25 props *(est.)* pooled
  within a few meters of the campfire, radiating out to a sparse perimeter. The fire is
  the organizing center; everything is owned by the camp.
- **Ground cover:** trampled dirt/grass ring around the fire, scattered supplies,
  dropped bones/refuse, path worn to the fire.
- **Light sources:** the campfire is the dominant warm anchor; a lantern or two on
  tent poles. Strong single-source firelight with long shadows — ideal ambush mood.
- **Palette:** firelight amber against night blue, canvas tan, dark timber; high
  contrast between the lit ring and dark surround.

### 8. Night / torch-lit street

**Reference links**
- Lower City at night (open the location page and its night vistas):
  https://bg3.wiki/wiki/Lower_City
- Lighting-environment breakdown — Joannie Leblanc, "BG3 Lighting Environments"
  (exterior night lighting reference): https://www.artstation.com/artwork/OGdnnw
  *(ArtStation, open in browser)*
- Elfsong / tavern exterior at night (warm-window reference):
  https://bg3.wiki/wiki/Elfsong_Tavern

**Density + mood**
- **Prop instances:** same object set as the day town street (#1), but the READ is
  driven by light, not count. What's visible is whatever the pooled lights touch —
  the lit doorway cluster, the lantern-lit stall, the glowing window sill.
- **Light sources — the calibration point:** warm point-lights every few meters —
  wall lanterns ~every 8–12 m, tavern/shop windows as larger warm washes, an
  occasional torch/brazier at a junction. Each light casts a soft pooled circle;
  between pools the street falls to cool blue near-dark. Estimate ~2–3 discrete warm
  light sources per 10 m of street *(est.)*.
- **Ground cover:** wet cobbles catching lantern reflections (the reflective ground
  sells the night mood more than any prop); puddles as mirrors.
- **Palette:** cool blue-black base (moonlight/skylight) punched by warm amber pools;
  the strongest color-temperature contrast of any context. This warm-pool-in-cool-dark
  contrast IS the BG3 night look.

---

## Density calibration cheat sheet

Targets for the seeded placement engine. **All values estimates** derived from the
imagery above — tune against the owner's real captures when they land. Distances in
meters of street/path edge unless noted.

| Context | Stalls / structures | Loose props | Ground cover | Light sources |
|---|---|---|---|---|
| **Town street** | — | ~25–45 objects per street framing; wall-clutter clusters every ~5–8 m | never bare: cobble + wear + debris + puddles | wall lanterns ~1 per 8–12 m + window glow |
| **Market / vendor** | ~1 stall per ~4 m of row edge, shoulder-to-shoulder | 6–12 loose props **per stall** | trodden dirt + straw + dropped goods | 2–3 per 10 m (hanging lanterns + tent glow) |
| **Docks / harbor** | cargo clusters at each crane/loading point | 4–8 crates/barrels pooled per crane; ropes/nets every few m on piers | stone + wet sheen up top, planking + rope/net piles on piers | dock-post lanterns, cooler, sparser than town |
| **Tavern exterior** | 1 focal building | 10–20 props packed at door/terrace, thinning fast outward | paving + spilled straw + wear path to door | brightest warm hotspot: flanking lanterns + every window |
| **Village / farm** | 1 well landmark + function buildings (smithy, windmill) | function clusters: smithy owns woodpile+anvil+tools; house owns cart+barrels | dirt tracks + grass tufts + scattered tools | sparse: forge/hearth glow + 1 lantern per doorway |
| **Forest path / grove** | — | ~8–15 cover objects per 10 m of path edge; undergrowth in overlapping clusters | richest: grass+leaves+ferns+roots+worn path | natural dappled canopy; fires at camps |
| **Roadside camp** | 1 fire = organizing center | 15–25 props within a few m of fire, sparse perimeter | trampled ring + scattered supplies + worn path | campfire dominant + 1–2 tent-pole lanterns |
| **Night street** | (as town street) | (as town street; visibility gated by light) | wet reflective cobbles (sells the mood) | 2–3 warm point-lights per 10 m, cool-dark between |

**Cross-context rules (the ownership doctrine):**
1. **Never bare ground.** Every walkable surface gets base texture + micro-scatter
   (leaves, debris, straw, pebbles) before any prop is placed.
2. **Props cluster by owner, never uniform scatter.** A stall owns its understock, a
   smithy its woodpile, a tavern its door-barrels, a camp its fire-ring. Placement is
   rule-driven off town-plan roles / building types / biome — matching spec decision 9.
3. **Density hotspots + thinning.** Each cluster is dense at its center and thins with
   distance. Streets read busy at doorways/junctions and calmer mid-block.
4. **Light defines the night read.** At night, warm pooled point-lights every few
   meters over a cool-dark base, on reflective wet ground. Count matters less than the
   warm-in-cool contrast.
5. **Wilderness = readable cover.** Always a boulder/log/thicket within reach to break
   line-of-sight — this is also the combat-referee payload (cover/blocksLoS).

---

## Owner shot list — capture these next time you play

Replace this proxy with your own pack. For each: pick the context, frame it at the
suggested **angle** and **time of day**, and grab a still. Aim for the framing a
player actually sees (tactical-ish 3/4 down-angle), not photo-mode hero shots — we're
calibrating what the streamed world should look like at play distance.

**Towns & settlement (Act 3 Lower City / Rivington):**
1. **Town street, day** — 3/4 down-angle along a Lower City street, mid-block, to catch
   wall clutter + paving wear.
2. **Town street, night** — same street after dark; capture the warm lantern pools on
   wet cobbles. (Highest-value shot for the lighting migration.)
3. **Market row, day** — Rivington traders / Circus row, angled down the row so you see
   stall spacing and per-stall clutter together.
4. **Single stall, close** — one vendor stall framed tight; count the loose props.
5. **Tavern exterior, night** — Elfsong or Blushing Mermaid entrance; capture the
   door/terrace hotspot and glowing windows.
6. **Docks, day** — Grey Harbour, angled to include a crane + its cargo cluster + pier
   ropes/nets.
7. **Docks, dusk/overcast** — same area in cooler light for the industrial-mood palette.

**Wilderness & rural (Act 1):**
8. **Forest path** — a trodden path through dense undergrowth; capture ground layering
   (path worn through green) and cover density at the edges.
9. **Grove / rivershore** — Emerald Grove wilds or Secluded Cove; boulders + logs +
   ferns for the wilderness cover catalog.
10. **Rural village, day** — a lived-in village street (or the well/smithy area) for
    function-clustering and dirt-track ground cover.
11. **Roadside/party camp, night** — the fire-ring cluster; capture firelight falloff
    and prop pooling around the fire.
12. **Ambush-ready spot** — any barricade/overturned-cart cover setup; note what reads
    as usable cover from the player camera.

**Lighting & mood specials:**
13. **Night street with a single brazier/torch** — isolate one warm source over dark to
    study falloff.
14. **Interior spill to exterior** — a lit doorway/window casting onto the street.
15. **Overcast wilderness** — flat-light forest, to see how cover reads without dappled
    sun.

**Combat-camera behavior (capture + WRITE NOTES — feeds the open questions in
`docs/superpowers/specs/subspecs/fip--combat-camera.md`):**
16. **Initiative pull-up** — start a fight and note how far the camera pulls up / out and
    where it centers.
17. **Orbit limits** — rotate (Q/E or middle-mouse) and zoom (scroll) during combat;
    record min/max pitch and how far it lets you rotate. *(Open Q: orbit constraints.)*
18. **Tight-interior combat** — a fight indoors or in a narrow alley; note whether the
    camera clips buildings/roofs or auto-adjusts. *(Open Q: collision in tight streets.)*
19. **Enemy-turn focus** — on an enemy's turn, note whether the camera snaps to / follows
    the active enemy or stays put (and whether "Dynamic Combat Camera" is on).
    *(Open Q: focus-snap behavior on enemy turns.)*
20. **Free-camera break** — press the free-look key mid-combat; note how it breaks from
    orbit and returns, and whether the clock/turn stays frozen.

Camera-control reference while you play (dotesports / PCGamesN guides): Q/E or
middle-mouse rotate; scroll or PageUp/Down zoom; **O** = tactical top-down; Home
recenters; "Dynamic Combat Camera" auto-switches to the active character.

---

## Sources

- Larian official press assets: https://larian.com/press
- bg3.wiki (in-game location screenshots): https://bg3.wiki/wiki/Lower_City ·
  https://bg3.wiki/wiki/Grey_Harbour_Docks · https://bg3.wiki/wiki/Emerald_Grove ·
  https://bg3.wiki/wiki/Blighted_Village · https://bg3.wiki/wiki/Circus_of_the_Last_Days ·
  https://bg3.wiki/wiki/The_Blushing_Mermaid · https://bg3.wiki/wiki/Elfsong_Tavern ·
  https://bg3.wiki/wiki/Tiefling_Hideout
- ArtStation environment-artist breakdowns (open in browser; block automated fetch):
  Rick van den Berg https://www.artstation.com/artwork/8bzYZE ·
  Stimona Milanova https://www.artstation.com/artwork/EvJRl2 ·
  Joannie Leblanc lighting https://www.artstation.com/artwork/OGdnnw ·
  City Houses https://www.artstation.com/artwork/qeBo2y ·
  City Props https://www.artstation.com/artwork/49z08W ·
  Tim Wilmsen dock warehouse https://www.artstation.com/artwork/qeByQ2
- Camera controls: https://dotesports.com/baldurs-gate/news/baldurs-gate-3-camera-controls-guide-all-camera-controls-in-bg3-explained ·
  https://www.pcgamesn.com/baldurs-gate-3/camera-controls
- Rivington context: https://www.pcgamer.com/why-rivington-is-my-favourite-area-in-baldurs-gate-3/
