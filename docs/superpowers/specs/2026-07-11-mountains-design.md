# Mountains: named ranges, real passes, high country that matters

**Date:** 2026-07-11
**Status:** Design approved by Remy (full vision; trip events = one roll per committed trip); spec pending Remy review
**Goal (Remy's words):** "now do mountains" — third campaign in the roads → forests pattern: mountains become places, elevation becomes mechanics, high country becomes visible in 2D and real in 3D.

## Front-loaded summary

Mountains today are a height number nobody consumes: four of five mountain gameplay biomes are unreachable, the map draws no mountain symbol (the SVG map shows no elevation at all), no range or pass exists as a concept, glaciers render as brown rock in 3D, and a "mountain" window is flat rolling hills. Five slices:

1. **Named ranges + peaks** — contiguous highland becomes a named range; local maxima become named peaks (absorbing the existing "Mount X" volcano/sacred-mountain names out of their tooltip notes).
2. **Passes** — where a route crosses a range, its highest cell is the pass: detected, named, glyphed, and named in the travel readout.
3. **Elevation mechanics** — height-aware biome escalation revives alpine/crag/plateau/vale; an edge-level climb cost makes ascents slow and passes precious; off-trail high country is harder to navigate; the dead biome travel-event service is revived (one roll per committed trip).
4. **2D relief language** — mountain glyphs (peak carets, hill chevrons) in BOTH renderers on the forests-glyph template, range labels, pass marks.
5. **3D high country** — elevation curve un-compressed + window-scale ridge synthesis (real peaks), snow caps + white glacier material, the dead slope→rock blend re-enabled, the relief-shading unit bug fixed, biome-keyed tree line.

## What exists today (exploration findings)

**Heights.** `pack.cells.h` is 0–100 (land ≥ 20). No per-cell mountain flag exists anywhere. De-facto thresholds already in the port: h ≥ 40 canvas grey-lift, ≥ 50 hills (hill-monsters, hot springs), > 60 "Highland" burg type, **≥ 70 de-facto mountain** (volcanoes, sacred mountains, highland zones, military terrain).

**Dead content (the three-for-three pattern):**
- `mountain_alpine`, `mountain_crag`, `highland_plateau`, `highland_vale` + the whole `mountain` preset (speedMultiplier 0.75, `requiresClimb`, falling-rock/avalanche hazards) are authored in `src/data/biomes.ts:232-238` and unreachable — `wfBiomeToLegacy.ts` maps by biome index only (Glacier → `mountain_glacier` is the sole mountain mapping) and never consults height.
- The `mountain` travel-event pool (rockslide/high-winds/falling-rocks/ore veins, `travelEvents.ts:206-249`) is authored — and the ENTIRE `travelEventService.generateTravelEvent` has **no production caller** (its documented caller `handleMovement.ts` no longer exists). The forests campaign's haunted/fey pools are equally dormant. One rewiring lights every biome pool.
- No FMG ReliefIcons module was ported; the ported icon vocabulary is vegetation-only. Canvas shows elevation via grey-lift (h ≥ 40, `atlasDraw.ts:525-534`) + NW hillshade (±6%); **the SVG renderer shows zero elevation**.
- Volcano 🌋 (h ≥ 70) and sacred-mountain 🗻 (isolated peak h ≥ 70) markers are LIVE with names ("Mount X") — but the names live in legend notes, never on the map. No range names, no pass concept anywhere (FMG's "pass" is a route-name suffix).

**Travel.** Route generation's height cost is a weak nudge (flat ×2.0 below h 50, ramping to ×4.0 at h 100 — the floor quirk is byte-inherited from Azgaar); the real block is habitability 0 (barren/glacier = Infinity). Live travel reads height ONLY for land/water passability: no climb cost, no elevation navigation effect (a high grassland saddle is nav DC 5), no elevation encounter/forage hooks. The seam for climb: `TravelGraph` gains an optional edge hook `climbFactor?(from, to)` multiplied into `minutesOf`'s non-edgeMinutes branch (`routePlanning.ts:151-158`); both land graphs close over `cells.h` already.

**Pass detection.** Route cellIds × `cells.h` are both accessible. Since A* already threads the lowest viable crossing, a route's height-profile local maximum inside a range IS its pass — O(route length), no new world-gen field.

**3D (the flat-mountain verdict).** `elevationFt = n × 2000` compresses ALL continental relief into ≤ 610 m; atlas cells (~20 km) dwarf windows (0.9 km), so the atlas gradient is a DC offset the adapter's `minElev` rebase subtracts; ground mode cancels the continent's 12× exaggeration. Net: mountain windows show 45–110 m of procedural rolling relief; the vertical domain (1,800 m) is > 90% unused, so the fixes land without touching the streamer/LOD. Also: NO snow anywhere (glacier windows render brown-rock, tundra brown-dirt); the slope→rock color blend is fully written but bypassed in ground mode (`biomeColors` precompute) and a unit bug (`height/100` at `groundChunkLoader.ts:1693`) collapses relief shading from ~17% to ~1.7%; NO tree line (trees climb every local summit; the accidental stop is the rock-material line at n ≈ 0.65); no slope/walkability constraint (out of scope, recorded).

## Design

### 1. Named ranges + peaks (first-class world data)

Atlas-time pass extending the forests pattern (`forestsPass` is the structural template; own seeded stream `'mountains'`, purely additive — world-preservation doctrine binding):

- **Ranges:** flood-fill contiguous cells with `h >= RANGE_MIN_H` (50) into clusters; clusters below `RANGE_MIN_CELLS` (5) stay anonymous hills. `PackRange { i, name, cells, coreCells (h>=70), pole, kind }`.
- **Kind:** `'range' | 'highlands' | 'volcanic'` — volcanic when the cluster contains a volcano marker cell; highlands when NO cell reaches 70 (rolling plateau country); else range.
- **Peaks:** within each range, local maxima with `h >= PEAK_MIN_H` (70) (strictly higher than all neighbors; cap `PEAKS_PER_RANGE_MAX` 4, keep the highest). `PackPeak { i, rangeI, cellId, h, name }`. Naming: if the cell (or a direct neighbor) carries a volcano/sacred-mountain marker, ADOPT that marker's existing name (read from its note title — pure string reuse, no RNG); else culture adjective + peak bank (Mount X form or X Peak/Horn/Tor/Fang).
- **Range naming:** culture adjective + range word bank (Spine, Reach, Range, Heights, Teeth, Crags, Wall for ranges; Downs, Highlands, Moors for highlands kind; volcanic bias to Furnace, Anvil, Ash- compounds). Geographic-suffix dedup exactly as forests do (lowest-id keeps bare; twins gain " of the <Compass>").
- Artifacts: `AtlasRange[]` + `AtlasPeak[]` on the atlas artifact; labels via the existing pipeline — `'range'` label kind (spaced small-caps styling, area-scaled like forest labels now are; declutter priority 3, with FOREST labels moving from 3 to 4 — ranges outrank woods, both stay below towns), `'peak'` label kind (tiny, high zoom only, `▲ Name`, priority 5).

### 2. Passes

Post-pass in the same module (RNG-free, like spur retargeting):

- For each land route (`highways | roads | trails`) crossing a range: walk its cellIds' height profile; each maximal contiguous run of range cells contributes its highest cell as a **pass candidate**; dedup candidates shared by multiple routes (same cell = one pass, remember all crossing routes).
- `PackPass { i, cellId, rangeI, name, routeIds }` — name = culture adjective or nearest-peak stem + Pass/Gap/Col/Saddle bank. Store on `pack.passes`; artifact `AtlasPass[]`.
- 2D: pass glyph (paired chevron marks flanking the route) + label at high zoom. Readout: a land route whose cells include a pass cell appends `· via <Name>` (reuses the forests `formatRouteSummary` opts pattern; when both forest and pass apply, pass wins — one clause max, tunable priority).
- Passes join the discovery bridge as markers? NO new markers (they sit ON routes — always visible); recorded as a future hook for pass-keeps/toll posts.

### 3. Elevation mechanics

- **Height-aware biome escalation** in `biomeForCell` (exactly the forests escalation slot, evaluated AFTER forest kinds — order: forest haunted/fey > elevation > plain):
  - `h >= 70`: peak cells (local maxima) → `mountain_crag`; other high cells → `mountain_alpine`. Glacier-biome cells keep `mountain_glacier` (existing mapping preserved — escalation never touches index 11).
  - `50 <= h < 70` inside a named range: `highland_plateau`; enclosed low pockets (cell h < 50 fully surrounded by range cells) → `highland_vale`.
  - Below 50 or outside ranges: today's mapping byte-identical.
- **Climb cost:** `TravelGraph.climbFactor?(from, to)` optional edge hook; `minutesOf` multiplies it into the factor branch. Implementation shared in `routeTerrain.ts`: `climbFactor = 1 / (1 + CLIMB_ASCENT_PER_H × max(0, Δh) + CLIMB_DESCENT_PER_H × max(0, −Δh))` with ascent 0.05/h-point, descent 0.015/h-point (an h+10 climb ≈ ×0.67 speed off-road). On maintained tiers (highway/road) the Δh penalty is halved (engineered grades); trails 75%; paths full. Both land graphs wire it; multimodal's `edgeMinutes` folds the same helper (sea legs exempt).
- **Navigation:** off-route cells with `h >= 70` count as `difficult` for nav DC (15) regardless of biome; `50–70` off-route adds `HIGHLAND_NAV_DC_BUMP` (+3) to open terrain (DC 8). On-route tiers keep their ladder (that is what passes are FOR).
- **Trip events (the revival — Remy: one roll per committed trip):** new `rollTripEvent(route, biomeIdOf, partySkillCheck, rng)` in the travel system: picks the governing cell = most "dramatic" legacy biome crossed (priority table: mountain/haunted/fey/variant pools > plain; tunable), calls `generateTravelEvent(biomeId, TRIP_EVENT_CHANCE)` (0.25 tunable), resolves any skillCheck against the party's best modifier for that skill (existing `partySurvivalModifier` pattern generalized), maps the outcome to `{ extraSeconds, message }` threaded through the EXISTING travelMeta seam (navDrift precedent: seeded rng from (worldSeed, destCell), applied in App's commit). Sea trips exempt. This makes the mountain pool, forests' haunted/fey pools, and every other biome pool live in real play.

### 4. 2D relief language

- `mountainGlyphs.ts` (forestGlyphs is the drop-in template — deterministic hash placement, shared canvas Path2D + SVG, zoom ramp): **peak carets** (two-stroke ink ▲ with a snow-gap tip above h 80) on cells h ≥ 70, **hill chevrons** (single soft stroke) on h 50–70, density 1–2 per cell, glyph size scaled by h. Placed for ALL qualifying cells (ranges give names; glyphs are height-truth) — this closes the SVG-has-no-relief gap with one layer.
- Layer coexistence: mountain glyphs render UNDER forest glyphs (a forested hill shows trees over the chevron); on rock-dominant high cells forest glyphs are absent anyway (biome fills differ).
- Range labels + peak labels + pass marks per slices 1–2. Canvas keeps its grey-lift/hillshade unchanged underneath.

### 5. 3D high country

- **Elevation curve:** replace `elevationFt = n × 2000` with a piecewise curve: identity-ish below n 0.5 (lowlands/towns effectively unchanged: ≤ ~1,000 ft), then accelerating to `MOUNTAIN_MAX_ELEV_FT` (7,000) at n 1.0. Window relief for high-n windows rises from ~50 m to real hundreds of meters within the existing 1,800 m domain.
- **Window-scale ridge synthesis:** extend the existing macro-noise (`reliefScale`) with a domain-warped RIDGED component whose amplitude ramps with the window's base n above `RIDGE_START_N` (0.55) — peaks exist INSIDE windows, aligned across window borders by world-space noise coords (grassField world-lattice precedent).
- **Snow:** `snow` palette entry; `biomeColor` blends toward snow above a height threshold that falls with latitude band (simple 3-band table); glacier biome gets a white `ice` material (killing brown glaciers); tundra gets its authored grey back (`MATERIAL_BIOME` emits it).
- **Fix the shading unit bug** (`height/100` at the `sampleGroundChunk` biomeColor call) and **re-enable the slope→rock blend** in ground mode by computing per-vertex slope there — steep faces read as rock again (both are restorations of written-but-dead code).
- **Tree line:** tree placement gains a `keep` rejecting trees where window-normalized elevation exceeds `TREELINE_N` per biome temperature class (taiga lower than temperate; jungle none) — beside the forests clearing gate.
- 3D changes are presentation-layer (accepted-by-design relayout class, like forest thickets); towns sit in low-n cells the curve barely moves. Local-golden shifts traced per task. Player slope constraint stays OUT (recorded).

## Tunables

One `mountainTunables.ts` (pattern of the last two campaigns): every threshold above (RANGE_MIN_H/CELLS, PEAK/PASS banks and caps, climb rates + tier softening, nav bumps, TRIP_EVENT_CHANCE + drama priority, glyph bands/sizes, curve knots, ridge params, snow bands, treeline table).

## Out of scope (recorded)

- Player movement slope constraints / climbing gameplay in 3D.
- Weather/exposure conditions (cold/altitude sickness) — the event pool carries the flavor for now; a real exposure system is its own campaign.
- Pass-keeps, toll posts, tunnels; cave/dungeon entrances keyed to ranges (hook noted for the dungeon campaign).
- Full SVG hillshade parity (glyphs carry the relief language there).
- Azgaar's height-cost floor quirk in route generation (byte-inherited; fixing changes every route — owner decision if ever).

## Slices (build order)

1. Ranges + peaks pass + artifacts + labels (foundation; forests-pattern).
2. Passes + readout naming.
3. Mechanics: biome escalation, climbFactor, nav bumps, trip-event revival.
4. 2D mountain glyphs (both renderers) + pass marks.
5. 3D: curve + ridges + snow/ice + shading/slope fixes + tree line.

1 → 2 → 3 in order; 4 needs 1–2; 5 independent except snow-line naming flavor.

## Test strategy

Doctrine tests as before (own-stream proof, fmgWorld goldens byte-identical, determinism signatures extended to ranges/peaks/passes). Climb: unit tests on the factor math + both-graphs agreement + a route-preference test (planner picks the pass over the scramble). Escalation: reachability tests per new biome id + byte-identity outside highland. Trip events: seeded roll tests + skill resolution + sea exemption. Glyphs: determinism + band coverage + both-renderer parity. 3D: curve monotonicity + lowland-invariance tests, golden shifts traced; snow/slope/treeline pure-helper tests; the look itself goes to the eyeball with screenshots per the proof cadence.

## Open

- All numbers are starting values pending the eyeball.
- Whether ranges should feed the chronicle/history hooks now or wait for the history campaign.
- Pass POI-ification (keeps, tolls) once settlements-near-passes matter.
- The Azgaar height-cost floor quirk (owner decision).
- 3D look gates: curve/ridge drama level, snow-line height, glyph density — Remy's screenshots call.
