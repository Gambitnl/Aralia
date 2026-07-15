# Building Generator v2: Living Buildings — design spec

**Status: APPROVED by Remy 2026-07-07** (direction answers + design shape approved in-session).
Builds on the completed building blueprint pipeline (v1, 2026-07-07). This spec covers all
four approved ambitions, phased: inhabited buildings, roofscapes + regional styles,
street-aware blocks, and buildings with history.

## Summary

v1 gives every building a correct skeleton: one deterministic generator emits a
`BlueprintPlan` (rooms, doors, walls, windows, furniture, stairs, basements) that one 2D
drawer and one 3D build both read. v2 makes those buildings **alive**: each building is
designed for the named family that lives in it, the family visibly uses it through the day,
the outside gets real roofs and a regional look, streets become composed blocks instead of
scattered lots, and buildings carry visible history.

The core architectural idea is a **two-layer split**:

1. **The permanent blueprint** — walls, rooms, roof, style, backstory. Generated once,
   deterministically, from the building's seed plus four new inputs: the founding household,
   the negotiated lot, the style context, and a rolled backstory. This extends the v1
   `BlueprintPlan` contract **additively**.
2. **The living overlay** — everything that changes with the people: room claims, daily
   schedules bound to furniture, lit hearths, container contents, boarded windows.
   Recomputed when the household changes. It can never move a wall.

Structural change after generation happens only through the **history event log** — a fire,
a renovation, an added wing — recorded as save data and applied as a deterministic transform.

## Decisions made (Remy, 2026-07-07)

1. **Life changes:** walls stay, contents adapt. Structure is fixed at generation; deaths,
   marriages, and moves only update the living overlay. Structural change goes through the
   history event log as a deliberate recorded event.
2. **Vocabulary:** one shared building-type vocabulary. The generator grows to cover
   everything town generation places; the translation table dies.
3. **Lot fit:** two-way negotiation. The town offers a lot; the generator may request one
   bounded size bump; the town grants or refuses; on refusal the building grows up
   (storeys), not out. One round, deterministic.
4. **History storage:** born with a past + live event log. Each building rolls a
   deterministic backstory at generation; afterward the living-world sim appends real events
   to a small per-building log saved with the game.
5. **Phasing:** inhabited buildings (1A) and roofs/styles (1B) run as parallel phases, then
   blocks (2), then history (3).
6. **Living depth:** full daily life in this spec — schedules bound to real furniture,
   hearths lit after dusk, watchable households.
7. **Container loot:** real, takeable items with ownership. Taking is stealing; goods are
   flagged stolen even though crime consequences are a later system.
8. **Style drivers:** all four — culture (atlas), biome/climate, wealth (burg + district),
   and building age (from history).

## Foundation (what v2 extends)

- Generator: `src/systems/worldforge/interior/generateBuilding.ts` → `BlueprintPlan`
  (`blueprintTypes.ts`). Irregular footprints, purpose-assigned rooms, privacy-aware doors
  with explicit swing, walls as per-edge data + merged runs with outward normals, purpose-
  aware windows, hint-placed furniture, basements + upper floors + stairs. 368 tests.
- 2D consumer: `renderBlueprintSvg.ts`, live at `misc/design.html?step=blueprint`.
- 3D consumer: `buildBuildingMeshData` (`src/systems/world3d/buildingModels.ts`) +
  `blueprintStructureParts` (`src/systems/worldforge/bridge/interiorParts.ts`).
- Town side: `townEngine.ts` plots with `buildingType`/`residential`/`occupants`/`homeId`;
  `population.ts` (typed dwellings, realistic occupancy, ward wealth, workplaces);
  `household.ts` (lazy named families with trades, ages, ancestry); the town sim
  (`townsim/`) already generates deaths, marriages, fires, and prosperity per town.

**One `BlueprintPlan` stays the single source of truth.** v2 extends it additively. Where a
new input changes existing output (and it will — see Determinism), the v1 goldens are
re-frozen **deliberately**, called out as an explicit task in the build plan.

---

## Architecture: the two layers

### Layer 1 — the permanent blueprint (extended `BlueprintPlan`)

Generated once per building, memoized, pure data, deterministic. New inputs:

```
GenerateBuildingInput (v2, additive):
  buildingId, type, seedPath, storeys?, basement?     // v1, unchanged
  lot?: LotEnvelope          // negotiated lot: width/depth caps, street edge, party-wall edges
  household?: HouseholdBrief // the founding family (see Ambition 1)
  style?: StyleContext       // culture family, climate class, wealth tier, built-age band
  backstory?: BuildingBackstory // rolled by the caller from the building's seed (see Ambition 4)
```

Every field is optional; a bare v1 call still works (used by the design preview and tests).
The production town path always passes all four.

New output blocks on `BlueprintPlan` (all additive):

- `roof: RoofPlan` — the solved roof geometry (Ambition 2).
- `style: StyleResolved` — the resolved material/ornament choices, so 2D and 3D dress
  identically without re-deriving.
- `frontage: FrontageInfo` — which footprint edge faces the street, where the entry and
  shopfront glazing sit (Ambition 3).
- `age: BackstoryResolved` — the applied backstory: wing built-phases, wear level, sealed
  openings (Ambition 4).
- Room-level: `BlueprintRoom.forMember?` — the household member slot a room was programmed
  for (e.g. bedroom 2 = "the two younger children"), so the overlay can bind claims without
  guessing.

### Layer 2 — the living overlay (`BuildingOccupancy`, new module)

A separate pure data shape computed from `(BlueprintPlan, current Household, game clock)` —
**never stored in the plan, never memoized with it**. Recomputed on household change.
Contains:

- **Room claims** — member → room bindings (who sleeps where, whose workroom).
- **Schedule bindings** — per member, a day of timed stations, each a real furniture
  placement in the plan: bed at night, workbench/counter in work hours, table at meals,
  hearth-side in the evening. Derived from the member's occupation + age band, aligned with
  the existing agent-sim schedule vocabulary so town-street commuting and in-house life are
  one continuous day.
- **State flags** — hearth lit (after dusk, when someone is home), shutters/candles at
  night, boarded windows and cold hearth when abandoned.
- **Container manifests** — per container furnishing, a deterministic item list (see
  Ambition 1), with `ownerHomeId` for theft flagging.

The overlay is what the agent-sim and the 3D scene read to place people and light hearths.
It is cheap to compute and safe to throw away; only the history event log (Ambition 4) is
save data.

---

## Ambition 1 — Inhabited buildings (flagship)

### The household brief

A new pure adapter (town side) builds a `HouseholdBrief` from what the town already knows:

```
HouseholdBrief:
  homeId
  memberSlots: { role: head|spouse|child|elder|kin|lodger, ageBand, count }[]
  trade: string            // head's occupation ("blacksmith", "innkeeper", "farmer")
  worksAtHome: boolean     // proprietor of THIS building (smithy, shop, inn, tavern)
  wealth: 'poor'|'common'|'wealthy'   // from ward wealth/district
  servants: number         // wealthy homes only
```

The brief is intentionally **coarser than the named household**: it carries slots and
counts, not names. Names stay lazy (the existing `generateHousehold`). This keeps the
blueprint deterministic per (seed, brief) without eagerly naming 15,000 families, and means
a same-shape family swap does not re-plan the house.

### Household → room program

The room program (which rooms exist, how big, which floor) is computed **from the brief**,
replacing the fixed per-type recipes:

- **Sleeping:** head+spouse get the best chamber; children share by count (2 per room,
  same-ageband grouped); elders/kin get small chambers; lodgers get the attic/back rooms;
  servants sleep in service rooms (wealthy) or the kitchen (common). Family size drives
  bedroom count, which drives storey count via lot negotiation.
- **Trade rooms:** a trade-room table maps occupation → required rooms with adjacency and
  frontage demands: blacksmith → forge (street-facing, own entry, hearth mandatory);
  shopkeeper → shopfront (street glazing) + stockroom behind; innkeeper → common room +
  kitchen + guest rooms above; scribe/official → study; brewer → brewhouse + cellar
  (below kitchen). `worksAtHome` decides whether the trade rooms exist here or the home is
  purely residential.
- **Wealth:** poor → fewer, multi-use rooms (hall = kitchen = workroom); common → the v1
  baseline; wealthy → adds solar, counting room, servant quarters, larger hall, deeper
  pantry chain.
- The v1 machinery (partition, adjacency-aware purposes, privacy doors, purpose windows,
  placement-hint furniture) is kept; the brief changes **what the program asks for**, not
  how geometry is solved.

### One shared vocabulary

`BuildingType` grows to cover every role town generation emits. Target set:

`cottage, townhouse, tenement, farmstead, shop, smithy, workshop, inn, tavern, storehouse,
manor, temple, keep, civic`

- Each type gets a real room program (temple: nave/sanctuary/vestry — the purposes already
  exist in the vocabulary; keep: hall/guard-room/armory/solar; tenement: stacked one-room
  dwellings per household, the one type whose brief carries multiple households).
- The town-side classification (`classifyBuilding`) and the generator then speak the same
  words; the `plot.role → BuildingType` translation layer and the legacy `temple→?` gap are
  deleted, not mapped.
- Unmapped or unknown role input **throws** (no-fallback).

### Occupants using the rooms (full daily life)

- Every member slot's schedule resolves to real furniture in the plan. The schedule
  vocabulary extends the existing agent-sim occupant schedule (`roster/occupantSchedule`),
  so a villager's day is one continuous timeline: home stations → street commute (already
  built) → workplace stations → home.
- 3D: when the player is inside or looking in, occupants stand/sit/lie at their stations
  (the blobfolk gait/pose work is the render vehicle; this spec owns only the **data**:
  member-at-furniture-at-hour). Hearth-lit and window-light states feed the beautification
  wave's lighting.
- 2D: the design preview gets an "occupancy" toggle — claims labeled on rooms, stations
  dotted at the chosen hour — so the whole layer is eyeballable without the 3D scene.

### Containers with real, owned loot

- Container furnishings (chest, shelf, barrel, crate, cupboard) get a deterministic
  manifest: seeded from the building path + container index, table-driven by
  `(room purpose × owner trade × wealth)`. A smith's workshop chest holds tools and iron
  stock; a wealthy merchant's counting-room strongbox holds coin and ledgers; a pantry
  barrel holds provisions.
- Items are real inventory items (existing item registry; the loot tables map to registry
  keys, with a small set of new mundane entries where the registry lacks them).
- Every manifest item carries the owner (`homeId`). Taking one marks it stolen. Crime
  consequences (witnesses, bounty) are explicitly a later system; this spec only guarantees
  the data is there so theft **can** matter.

### Life changes (walls stay, contents adapt)

On a household change event from the town sim (death, marriage, birth, move, abandonment):

- The blueprint is untouched.
- The overlay recomputes: claims reshuffle (widow moves to the small chamber, eldest child
  claims the freed room), manifests age (a dead smith's tools remain until inherited or
  sold — inheritance already exists in the sim), an emptied house gets the abandoned state
  (cold hearth, boarded windows, dusty manifests).
- A **new household moving in** keeps the same walls (they bought the house, they didn't
  rebuild it) — only claims/manifests/flags recompute. If the new family shape grossly
  misfits (a family of 9 in a one-bed cottage), the misfit is *visible* (crowded claims,
  beds in the hall) rather than hidden — that is the honest, no-fallback answer.
- Renovation/extension is a **history event** (Ambition 4), not an overlay change.

---

## Ambition 2 — Roofscapes + regional styles

### Roof solver

A new pure module computes `RoofPlan` from the footprint cells + style context:

- **Massing decomposition:** the irregular footprint decomposes into rectangular masses
  (main block, wings, tower) — the same wings the footprint generator rolled, so the
  decomposition is exact, not inferred.
- Each mass gets a pitched form per style: gable or hip (hip preferred on the main block,
  gables on wing ends); **valleys** where wing roofs meet the main roof; **tower caps**
  (pyramidal/conical) on towers; shed roofs on small annexes.
- **Chimneys are placed from the plan's hearth data** — every hearth (v1 guarantees
  exterior-wall hearths) projects a stack through the roof at its wall; shared stacks when
  hearths align vertically across floors.
- **Dormers** on habitable upper floors: one per upper bedroom lacking a gable-end window,
  placed over that room's cells.
- Output is pure data: ridge lines, slope planes (as quads/triangles in feet), eave
  overhang, chimney/dormer placements. The 3D build extrudes it; the 2D drawer draws the
  roof plan (ridges + slopes) as an optional overlay.
- Pitch, overhang, and material come from the style grammar below.

### Style grammar

A pure `resolveStyle(styleContext, buildingType, seed) → StyleResolved` keyed on all four
approved drivers:

- **Culture** (atlas culture of the burg) picks the **style family**: e.g. timber-frame,
  whitewashed stone, gray-stone-and-slate, mudbrick. The mapping table culture→family is
  data, editable per world.
- **Biome/climate** adjusts physics: steep snow-shedding pitches in cold biomes, flat/low
  pitch + pale walls in deserts, stilt/raised sills in marsh.
- **Wealth** picks the finish tier: thatch→shingle→slate/tile roofs; wattle→timber→stone
  walls; glazing quality; ornament (carved bargeboards, corner quoins) on wealthy tiers.
- **Age** (from Ambition 4) shifts the style back in time per built-phase: an old core in an
  earlier family/finish than its newer wing — the single strongest "history is visible" cue.

`StyleResolved` names concrete materials/palette/trim per surface (wall, roof, plinth,
frame) so 2D and 3D read one answer. Same floor plan, different dress — a golden test
renders one plan under three styles and asserts geometry identity.

Coordination: the beautification wave (WebGPU/TSL, props, lighting) is the render engine
for these materials; this spec owns the **data grammar** and the mesh-level geometry (roof
forms, chimneys, dormers). Texture/shader polish rides the wave.

---

## Ambition 3 — Street-aware blocks

### Frontage (the deferred Wave C decision, now settled)

- Every lot handed to the generator carries a **street edge** (the town plan knows plot
  orientation today; it becomes an explicit input instead of a discard).
- The generator orients the plan to it: entry door on the frontage, shopfront glazing on the
  frontage, service rooms and rear doors to the back, trade entries (forge, stable)
  per the trade-room table. The v1 "entry on a random outer edge" dies.
- `FrontageInfo` in the plan records the front edge so consumers (door arrows in 2D, camera
  framing, agent door-to-door routing) never re-derive it.

### Lot negotiation (one round, two-way)

```
town offers   LotEnvelope { maxWidthFt, maxDepthFt, streetEdge, partyWalls[] }
generator     fits, OR returns one RequestBump { +5ft or +10ft on one axis, reason }
town          grants (neighbors/street allow) or refuses
on refusal    the generator adds a storey instead of footprint (needs push UP, not out)
```

Deterministic: the request and the grant are both pure functions, so the same world always
negotiates identically. Today's `clampFootprint` hard-cap becomes the last-resort invariant
(a granted envelope is still never exceeded), not the design mechanism.

### Party walls, rows, and ensembles

- Dense wards compose **row-houses**: adjacent lots share party walls (single thick wall on
  the shared line, no gap, no windows on it), continuous eave lines, stepped rooflines on
  slopes.
- **Courtyard blocks**: rear yards of a block ring a shared court (wells, privies, workshop
  yards — feeds the prop system).
- **Market squares**: plots ringing the market get arcaded fronts (recessed ground-floor
  frontage bays under the upper floor) and unified frontage discipline.
- A new block-level composer (town side) groups plots into blocks, decides row/detached/
  courtyard treatment from ward density + wealth, and stamps each lot's envelope with its
  party-wall edges **before** buildings generate — so the building generator stays
  per-building and pure; ensemble knowledge arrives through the lot.

---

## Ambition 4 — Buildings with history

### Born with a past (deterministic backstory)

At generation, each building rolls `BuildingBackstory` from its own seed path:

- **Built-age band** (new / a generation / old / ancient), biased by ward: town-core wards
  skew old, edge sprawl new — so the town's growth rings are visible.
- **Build phases:** an old building's wings/tower are assigned later built-phases than its
  core (the wing the footprint generator rolled becomes "the extension of 40 years ago"),
  each phase rendering in its period style (Ambition 2's age driver).
- **Wear events:** a small rolled set — a bricked-up door (a sealed opening where a door
  once was), a re-roofed wing (mismatched roof material), a sagging ridge (bounded ridge
  deflection on old roofs), a patched wall.
- Backstory is **input** to the generator (rolled by the town caller from the building's
  seed), so the plan bakes it: the sealed door is a wall feature, not a decal.

### The live event log

- Per-building, save-side: `BuildingEventLog: { day, kind, payload }[]` — `fire-damage`,
  `renovation`, `extension`, `abandonment`, `reoccupation`, `ruin`.
- **Written by the living-world sim**: the town sim's existing fires/prosperity/inheritance
  events gain building targets (the fire that killed Dara scorches Dara's house).
- **Applied as a deterministic transform**: `applyHistory(plan, log) → plan'` — pure,
  ordered, replayable. A fire event marks rooms scorched/roof-holed; a renovation clears
  wear and may re-style; an extension adds a wing (the one sanctioned structural change:
  it re-runs the generator with the extension recorded as a new build phase — deliberate,
  logged, deterministic). Same log + same plan → same result, always.
- Rendering: 2D shows sealed openings, phase hatching, and ruin state; 3D shows the wear set
  (boarded windows, roof holes, scorch, sagging ridge) and per-phase materials.

### Implemented event-history slice (2026-07-14)

- `BuildingEvent` is now a typed chronological union for fire damage, renovation,
  extension, abandonment, reoccupation, and ruin. `applyHistory(plan, log)` validates
  order, replays without mutation, stores a stable history signature, and keeps an empty
  log as a strict legacy no-op.
- The town simulation's deterministic fire incident now appends damage to the exact home
  plots of its victims. The sparse per-plot map crosses the worker and production-interior
  bridge, so the generated plan, blueprint, and streamed 3D building consume the same log.
- Live evidence is target-specific: scorched rooms, roof breaches, boarded windows,
  extension phase seams, and ruined ridges point to existing plan facts. Fire-caused ruins
  can scorch rooms; collapse, neglect, and war ruins do not borrow fire evidence.
- The 2D blueprint and 3D scene both expose current, fire-damaged, restored, and ruined
  states. Renovation clears live damage while retaining deliberate extension-phase facts.
- Production writing now covers exact fire damage plus prosperous-year repairs and
  extensions. Repairs take precedence when an occupied home still carries fire damage;
  otherwise the simulation consumes one unused, pre-approved structural addition.
- Demographic changes now write the remaining lifecycle contracts. A home with no living
  residents is boarded as abandoned; a newly married household prefers a sound abandoned
  home and brings dependent children; each source home is retained long enough to record
  any resulting vacancy. Abandoned buildings have stable, per-building neglect lifespans
  of eight to twenty years before a non-fire ruin event records their decay. These choices
  use named hashes and do not consume the established life-event random stream.
- Re-registering a burg from an old save now hydrates only its missing canonical evolution
  briefs. Saved villagers, prosperity, chronicle, and existing building logs retain their
  original references and content.
- Structural extensions now store an explicit wing/tower rectangle in the original
  footprint frame. The replay pre-pass validates connectivity, added cells, and lot bounds,
  then enlarges the canonical footprint before rooms, walls, stairs, and the roof generate.
  A stable site origin prevents a one-sided addition from moving the old core on its plot.
  Legacy logs that activate an existing secondary mass remain supported.
- Canonical burg registration now stores up to two deterministic future additions per
  eligible plot. Each candidate keeps the district's resolved roof form and proportion
  vocabulary, while the building id varies its orientation and placement. Candidate
  planning validates the cumulative result against the real 5 ft-snapped lot; zero-setback
  plots fill connected notches inside their existing envelope instead of overhanging a
  street. Named hashes rank candidates without consuming town-simulation random draws.
- The blueprint workbench exposes this as an Extended scenario in both 2D and 3D. Focused
  proof covers canonical cell growth, every-floor room coverage, roof regeneration, stable
  district signature/roof form, production coordinate projection, and occupant placement.
- Roof breaches and sagging ridges now deform the shared canonical triangle mesh consumed
  by both the preview and production bridge. Only damaged planes are deterministically
  subdivided: breach fragments are omitted to expose a real opening, while permanent and
  live ridge targets lower the solved surface with the deepest deflection winning. Charred
  rim parts retain semantic history metadata without filling the opening. Undamaged roofs
  retain their historical fan-triangulated bytes.
- Per-building history is now storage-bounded by a version 1 journal. Legacy arrays remain
  valid; every complete 24-event block folds into exact renderer/use/style state while a
  short chronological tail remains. Absolute structural ordinals, same-day fire identity,
  and a composable event digest preserve the same replay result and signature.

---

## Determinism and seed identity

- All new randomness uses the frozen seed-path discipline (`rngFromPath(streamPath(...))`),
  new concerns get new stream names — existing streams are not perturbed **within a
  module**; but:
- **The household brief changes room programs, so v2 output ≠ v1 output for the same seed.**
  This is deliberate and unavoidable — it is the feature. The build plan must contain an
  explicit "re-freeze goldens" task per phase, and the existing-save story is: town interiors
  re-plan once when v2 lands (acceptable — interiors are not yet player-persistent state;
  container/overlay data is derived, and the event log starts empty).
- The overlay is derived data — never saved, always recomputable. Save data added by v2 is
  versioned per-building history + stolen-item flags. History stays sparse, and deterministic
  block compaction bounds each chronological tail without discarding structural outcomes.
- Draw-order stability: each new module (roof solver, style resolver, brief builder,
  negotiation, backstory, manifests) gets its own stream and its own pinned-draw golden,
  per the v1 lesson.

## Constraints (standing directives, baked in)

- Feet-canon 5 ft grid; all geometry pure data, zero `three` imports in generators.
- Deterministic seed paths; never `Math.random()`.
- No fallback / graceful degradation — unknown types throw; misfit households show honestly.
- US spelling; GOV.UK plain writing in docs; coined terms → `tools/agora/GLOSSARY.md`.
- No time estimates. Work only in master; never branch; never commit (2am auto-snapshot).
- **Visual-inspection rule:** every phase in the build plan ends with a render-and-eyeball
  step — 2D preview and in-3D — not just green tests.
- Plan-map: node `building-generator-v2` flips `parked → specced` with this spec (done in
  the same turn), and features flip `specced → active → done` as the plan executes.

## Phasing (priority order; no estimates)

**Phase 1A — Inhabited buildings** (flagship). Household brief + brief-driven room programs;
shared vocabulary (all 14 types with real programs); frontage input honored for entry/
shopfront (the minimal slice of Ambition 3 that Phase 1A needs); living overlay: claims,
schedules, state flags, container manifests with ownership; town-path wiring (plots pass
brief + lot + style stub); occupancy toggle in the 2D preview; occupants-at-stations data
consumed by the 3D scene. Eyeball: one family's full day watched in a real town interior;
one misfit household; one abandoned house.

**Phase 1B — Roofscapes + regional styles** (parallel with 1A — different layers).
Roof solver (masses, hips/gables/valleys, chimneys from hearths, dormers, tower caps);
style grammar with culture/biome/wealth drivers (age driver stubs until Phase 3);
`StyleResolved` consumed by 2D + 3D. Eyeball: one town skyline overview + close-ups across
two cultures and three wealth tiers; same-plan-three-styles golden.

**Phase 2 — Street-aware blocks.** Block composer (rows/courtyards/market arcades);
party-wall envelopes; full lot negotiation; town-role vocabulary cutover complete (legacy
translation deleted). Eyeball: a dense ward as row-houses, a market square with arcades,
from street level and overview.

Current Phase 2 position: the town-side ensemble foundation is implemented. Dense frontage
packing now creates exact shared lot boundaries; every plot receives a deterministic
detached, row, courtyard, or market-arcade receipt with one block signature and eave target.
The adapter preserves true party-wall boundaries and shared storey heights, generated
buildings suppress windows on shared sides without removing structural walls, and the 2D
map plus production 3D bridge expose tagged eave/arcade evidence outside tactical collision.
Full two-way lot bump negotiation, single-wall mesh ownership, courtyard wells/privies/yards,
stepped slope rooflines, and the legacy town-role vocabulary cutover remain Phase 2 work.

**Phase 3 — Buildings with history.** Backstory roll (age bands, build phases, wear set);
event log + `applyHistory` transform; sim wiring (fires/abandonment/extension write events);
age driver into the style grammar; 2D + 3D wear rendering. Eyeball: an old-core town showing
growth rings; a burned house before/after; an extension appearing over sim decades.

Current Phase 3 position: permanent backstory, chronological replay, exact fire-to-home
writes, prosperous-year repair and extension writers, district-aware canonical extension
planning, stable site anchoring, and live 2D/3D evidence are implemented. Abandonment,
reoccupation, neglect-ruin writers, and old-save evolution-brief migration are also
implemented. Canonical roof deformation and replay-preserving event-log compaction are also
implemented; sloped repair-covering geometry remains an additive rendering expansion.

Cross-phase rule: the history **storage shape** (backstory input + event log) is designed
now (this spec) and its fields are reserved from Phase 1A, so phases 1–2 never have to be
reopened for Phase 3.

## Testing

- Every new module: per-seed looped tests (≥50 seeds), independent oracles (v1 critique
  lesson — never assert the implementation against its own helpers).
- Brief→program: family of N always sleeps N (beds ≥ members, correct sharing rules);
  trade rooms present + adjacency/frontage demands met; wealth tiers change room sets.
- Overlay: every member has a station at every hour; every station is real furniture in the
  member's claimed or shared rooms; abandoned flags flip correctly on sim events.
- Manifests: deterministic per building; owner flags always present; registry keys resolve.
- Roof: solver covers every footprint cell (no unroofed cells, no orphan planes); every
  hearth has a stack; valleys only where masses meet. Fuzz over the v1 footprint space.
- Negotiation: pure/deterministic; granted envelope never exceeded; refusal adds storeys.
- History: `applyHistory` is order-stable and replayable; golden for a fixed log.
- Style: same plan under different styles has identical geometry (dress never moves walls).
- Goldens re-frozen per phase, deliberately, as named plan tasks.

## Out of scope

- Crime consequences for theft (witnesses, bounty, fencing) — the data (ownership, stolen
  flags) lands here; the system is separate future work.
- Texture/shader-level material polish — owned by the beautification wave; this spec ships
  geometry + the style data it needs.
- Interior NPC dialogue/interaction changes — existing systems keep working; occupants at
  stations are bodies-in-place, not new conversation logic.
- Player home ownership/furnishing — nothing here blocks it later.
