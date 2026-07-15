# Building Architectural Identity

**Status:** Eight production slices implemented through 2026-07-14: layered
building variation, durable spatial town districts with 2D/3D identity parity,
culture-aware building-role motifs, deterministic born-with-a-past building
history, district-coherent physical construction kits, and chronological live
building-event replay with exact town-fire targets, repairs, district-aware
structural growth, and demographic vacancy/reuse/neglect. This extends Building
Generator v2 Phase 1B and advances its Phase 3 history path; it does not replace
the approved Living Buildings spec.

## Objective

Generated buildings should be recognizably different from one another without
making a settlement look like a random architecture catalogue. A town needs a
broad cultural identity, a district needs a stronger local dialect, and each
building needs enough bounded variation to have its own silhouette and facade.

## The Three Scopes

1. **Settlement family**
   - Culture chooses the architecture family.
   - Climate can force practical features such as snow-shedding roofs, shallow
     arid eaves, or raised marsh plinths.
   - Every district and building stays inside that family's palettes, roof
     forms, and facade grammars.
2. **District dialect**
   - Town wards are grouped into deterministic angular sectors around the built
     core. Uniform scale and translation do not change membership, so the
     normalized 2D plan and transformed feet-space 3D plan share exact keys.
   - District count grows from one in tiny settlements to at most eight in
     capitals. A seed-derived rotation prevents every town from repeating the
     same north/south boundaries; civic anchors provide readable names such as
     Market District, Harbor District, Citadel District, and Temple Close.
   - Wealth is a finish input, not district identity. Poor and wealthy buildings
     in one spatial district share roof/facade grammar while using appropriate
     material slices.
   - A district chooses one dominant wall finish, roof finish, roof form, and
     facade pattern plus at most one related alternative for each trait.
   - Roughly 70-80% of buildings repeat each dominant choice.
3. **Individual building variant**
   - The town engine assigns a durable building key after canonical geometry
     filtering but before population and feet-space adapter filtering.
   - A minority of buildings use one district-approved alternative.
   - Every building receives a narrow pitch and eave adjustment, giving nearby
     roofs distinct profiles without leaving the district grammar.

The resolver stores both `districtSignature` and `buildingVariant` on the
resolved style. These are evidence and future save/debug handles, not labels the
player sees.

## Visible Facade Grammars

Culture families offer subsets of five structural patterns:

- `plain`
- `belt-course`
- `vertical-bays`
- `half-timber`
- `log-bands`

The 3D bridge projects these as shallow trim outside the canonical outer wall
runs. Dressing is tagged separately from structure, never fills a door or
window, and never changes room geometry. The 2D town view renders the same
grammar as a small SVG material pattern and uses resolved roof color on the
building outline. Styled blueprint walls use the resolved regional wall color;
the former generic house/market color remains only as the fallback for unstyled
legacy plans.

## Visible Construction Materials

Each of the five architecture families now owns three complete construction
kits, for 15 closed family-approved kits overall. A kit resolves physical
building facts rather than another color swatch:

- wall material and masonry/course scale
- timber thickness
- roof covering
- foundation treatment
- glazing quality
- shutter treatment
- ornament kit

A district chooses one dominant kit and one related secondary kit; about 78% of
its buildings repeat the dominant answer. Shutters are coordinated separately
at about 80% loyalty so compatible kits cannot accidentally create an
uncontrolled street-wide mixture. Wealth improves glazing and ornament inside
the selected kit, but it cannot swap the structural wall, roof, or foundation
for a different culture family's vocabulary. Every result stores a
`constructionSignature` for exact district-recipe evidence.

The 2D town map uses the same receipt to layer masonry courses, boards, brick,
logs, or timber-and-daub rhythm under the existing facade grammar. Plot data and
the inspector expose the exact kit, wall, roof, foundation, glazing, shutters,
ornament, and signature carried by the artifact.

The production 3D bridge projects foundation courses or piers, wall courses,
paired shutter panels and slats, covering-specific eave profiles, ornament, and
glazing color onto the canonical building. Wall bands subtract real window
openings, shutters target real windows, and every material part has a semantic
`building-material` tag. Tactical collision and line-of-sight extraction ignore
those parts, so visible construction detail cannot invalidate an interior. The
solved roof remains canonical; covering-specific eaves are readable evidence
until true sloped covering surfaces or textures are introduced.

## Building-Role Motifs

Facade grammar explains how a district builds. Motifs explain what an individual
building is for. Every generated building type has a deterministic motif program
made from three bounded scopes:

- **Core role cue:** cannot disappear through variation. Examples include a
  hanging sign for a shop, vent stack for a smithy, loading hoist for a
  workshop, side shed for a farmstead, bell-cote for a temple, and battlements
  for a keep.
- **District treatment:** same-type buildings share one dominant option, with a
  minority using one related alternative. A market street can therefore repeat
  shop awnings without making every shop an exact clone.
- **Culture accent:** selected roles receive a family-specific cue such as
  Highland buttresses, coastal galleries, river-town jetties, rough-log
  porches, or temperate bay windows.

The complete additive vocabulary currently includes canopies, awnings, display
and bay windows, jettied bays, hanging signs, vent stacks, loading hoists, side
sheds, covered galleries, porticos, bell-cotes, roof finials, battlements,
corner turrets, buttresses, and log porches.

`motifSignature` identifies the district/type recipe, while `motifVariant`
changes proportions and side placement from 0-2. Motif parts use only the
resolved wall, roof, and trim palette. They are tagged separately from structure
and explicitly excluded from tactical collision and line-of-sight checks, so a
turret overlapping a shell corner cannot make a valid interior tile impassable.
The town map's building plots expose the same motif set/signature/variant and
list the cues in the building inspector.

## Visible Building History

Town geometry now assigns every plot one durable construction-age band: `new`,
`aged`, `old`, or `ancient`. The resolver measures a building centroid against
the settlement core, then applies a small named-hash jitter. This produces
legible growth rings without making every district boundary perfectly circular.
Uniform scale and translation do not change a result, so normalized 2D plots
and transformed 3D artifacts carry the same age.

After canonical footprint, wall, and roof geometry exists, the building
generator resolves a permanent `BuildingBackstory`. Secondary footprint masses
can be recorded as later construction phases. Age then sets an exact wear
budget: zero events for a new building, one for aged, two for old, and three for
ancient. The current bounded event vocabulary is:

- sealed former doorway
- replacement roof patch
- visibly dipped ridge cap
- patched wall
- fire scars

Every event stores an exact mass, outer wall run, roof plane, or ridge target;
renderers never reroll placement. Exterior door gaps already split wall runs,
and window spans are subtracted before wall damage is placed. Repair and
addition finishes remain inside the building family's wealth-appropriate wall,
roof, and trim palettes. Named hashes isolate phase, event, target, dimensions,
and material choices so future history vocabulary does not shift existing
facts.

The production 3D bridge renders phase seams, sealed openings, repairs, scars,
replacement roof strips, and dipped ridge caps as semantically tagged history
parts. Tactical collision and line-of-sight extraction ignore those tags, so
visible age never invalidates a generated interior. The 2D town map exposes the
same age in plot data and the building inspector; old and ancient plots receive
a restrained dashed roof outline.

Permanent backstory and live chronological history now coexist. A typed event
log supports fire damage, renovation, extension, abandonment, reoccupation, and
ruin; `applyHistory(...)` validates and replays it as a pure ordered transform.
The town simulation writes deterministic fires against the exact home plots of
its victims, and the sparse log reaches canonical generation, blueprints, the
worker boundary, and streamed 3D parts. The blueprint preview exposes current,
fire-damaged, restored, and ruined scenarios using that same production path.
Prosperous years now repair an occupied fire-damaged home first, then may consume
one stored extension candidate for an occupied home. Registration derives those
candidates from the exact production blueprint, lot envelope, and resolved roof
grammar. Buildings vary placement and orientation, but a district retains its
roof form and extension proportions; zero-setback plots use connected infill
rather than crossing the lot boundary. Named hashes keep this lane from shifting
the town simulation's existing random outcomes.
Homes now follow their households. Death or relocation boards a residence once
its last living occupant leaves; a new marriage prefers a sound abandoned home
and brings dependent children; eight to twenty deterministic vacant years turn
unreclaimed homes into non-fire neglect ruins. Old burg saves gain only their
missing canonical growth briefs when re-registered, preserving all people and
history already stored in the save.

Current structural evidence separates covering repairs from structural damage.
Replacement strips remain shallow tagged covering evidence, but live breaches
now remove subdivided fragments from the canonical roof and permanent or ruin
sags lower the shared solved surface. The preview and production bridge consume
the same deformation contract, with undamaged roofs retaining their historical
mesh bytes. A live extension can add explicit connected footprint cells before
all floors, walls, stairs, and roof geometry regenerate; a stable site origin
keeps the original mass fixed on its lot. True sloped repair-covering meshes and
their material treatment remain Phase 3 rendering work. Event history now
compacts at deterministic 24-event boundaries into a versioned folded prefix
plus a short replay tail without changing structural ordinals or signatures.

## Identity And Determinism

An optional `ArchitectureIdentity` contains:

- `settlementKey`
- `districtKey`
- `buildingKey`

Old preview and fixture calls may omit this block. They preserve the original
three style-stream draws and their prior wall, roof, and form results. Production
town buildings provide all three keys.

Each trait uses a named hash. Adding a future trait cannot shift existing roof,
wall, facade, pitch, or eave choices. The building memo key includes all three
identity scopes, preventing one building from inheriting another building's
resolved dress.

Production interiors now use `canonicalTownSeedPath(worldSeed, burgId)` rather
than the enclosing region seed. Plot ids restart in every burg, so this prevents
same-number plots in neighboring towns from sharing identical generated bones.

The artifact plot records district key/label, building key, wealth tier,
district signature, building variant, facade pattern, and the complete
construction receipt. This is the durable handoff between normalized town
generation and streamed 3D construction, including civic buildings that have no
population record. Affine town transforms preserve ward wealth, architecture
district, and building identity.

## Acceptance Evidence

- Same identity resolves byte-identically.
- A 120-building district sample has one district signature, 120 individual
  variant tokens, and at most two values per coordinated visual trait.
- More than 60% of the sample repeats the dominant value for each trait.
- Two districts in one family can differ visibly while remaining inside the
  same family vocabulary.
- Two towns of one culture choose different district recipes.
- District/building style changes never move floors, footprints, walls, or
  stairs.
- 3D outer walls use `StyleResolved.wallColor`.
- Non-plain facade patterns produce separately tagged trim geometry.
- Spatial district assignment is deterministic, scale/translation invariant,
  and grows from one to at most eight districts with settlement complexity.
- The 2D town map and 3D artifact resolve identical wall, roof, facade,
  signature, and building-variant values from the same keys.
- A rendered walled-town proof shows 193 buildings across six spatial district
  signatures and four facade grammars; 129 buildings use visible SVG patterns.
- Production ground tests prove artifact wall colors and non-plain facade tags
  reach actual streamed building parts, including civic buildings.
- Every generated building type has a motif program, and major-role tests pin
  the shop sign, smithy vent, workshop hoist, farm shed, temple bell-cote, and
  keep battlements as non-optional recognition cues.
- A 120-building same-district/type sample has one motif signature, exactly two
  related motif sets, all three geometry variants, and more than 65% loyalty to
  the district-dominant set.
- Production 3D parts carry exact semantic motif tags and use only their
  resolved district-family palette. Removing roof, facade, and motif dressing
  leaves permanent wall/floor/stair geometry byte-identical.
- Tactical extraction ignores motif dressing: an oversized turret placed over
  a valid floor tile leaves both movement and line of sight unchanged.
- The live Towns preview exposes motif evidence for 193 styled buildings across
  six spatial districts and 32 district/type motif recipes.
- A rendered production proof shows six major roles, one shared district
  signature, six distinct role recipes, and 52 tagged motif parts. Desktop and
  constrained 390x720 portrait captures are nonblank, correctly framed, and
  free of browser warnings.
- Every architecture family exposes exactly three complete and unique
  construction kits. Across a 160-building district sample, each coordinated
  material trait uses at most two values and more than 65% of buildings repeat
  its dominant value; cross-family leakage remains zero across 2,000 sampled
  resolutions.
- Wealth changes glazing or ornament quality without changing a building's
  structural kit. Separate district keys can choose different recipes while
  every result remains inside the settlement family's closed vocabulary.
- The 2D town plot, artifact, blueprint style, and streamed 3D building carry
  byte-identical construction values and signatures. Production parts always
  include a foundation and covering-specific roof edge; shutters are paired or
  absent, and every wall course clears its canonical window opening.
- Sixty production-building fuzz samples produce finite, positive,
  deterministic material geometry under a 500-part ceiling. Bare legacy
  blueprints remain a no-op, and oversized material dressing does not affect
  tactical movement or line of sight.
- A live 193-building town proof resolves all three temperate kits, wall
  materials, roof coverings, foundations, glazing qualities, and shutter
  treatments while each of six districts uses exactly two kits.
- A same-seed five-family 3D proof preserves the 55x45-foot footprint and wall
  runs while resolving five distinct kits, four wall materials, four roof
  coverings, and 791 tagged material parts. Desktop and 390x720 captures are
  nonblank, OrbitControls changes the camera, and the browser reports no
  warnings or errors.
- Spatial construction age is deterministic, affine-invariant, and trends from
  ancient core buildings toward new outer growth while retaining bounded local
  irregularity.
- Artifact and live 2D plot tests resolve identical age bands from the same
  settlement, district, building, core, and plot geometry.
- Production backstories are byte-deterministic, use exact age wear budgets,
  reach the complete five-event vocabulary across a 120-building sample, and
  do not change footprints, floors, stairs, masses, or solved roofs.
- Every history feature points to an existing mass, outer wall run, roof plane,
  or ridge and stays inside the permitted family finish vocabulary.
- Production ground tests prove tagged history reaches streamed 3D parts, while
  oversized history dressing remains excluded from tactical movement and line
  of sight.
- The live Towns proof contains 193 buildings across all four ages: 10 ancient,
  51 old, 84 aged, and 48 new. Sixty-one old or ancient plots carry the age
  outline, and inspector evidence identifies the selected building's band.
- A same-seed new/ancient 3D comparison preserves structural inputs while the
  ancient plan produces five stored facts and 18 tagged history parts. The
  1440x900 and 390x720 canvas captures are nonblank and correctly framed, an
  OrbitControls drag changes the rendered frame, and the browser reports no
  warnings or errors.
- A fixed chronological live log replays byte-deterministically with a stable
  signature; an empty log is a strict no-op, out-of-order events fail loudly,
  and collapse-caused ruins do not invent fire scorch marks.
- Long-run town simulation proves every produced fire log targets a known home
  plot and records each fire incident at most once per building. Old saves may
  omit the sparse event map without changing existing town behavior.
- Production bridge tests prove live history reaches tagged SiteParts while
  tactical extraction still ignores all history dressing. Renovation removes
  transient damage, and reoccupation removes boards without rerolling targets.
- The live blueprint proof at 1366x1272 and 390x844 shows one ruined plan in 2D
  and 3D without layout overflow or console errors. Desktop/mobile canvas crops
  contain 93/73 quantized colors, confirming both Three.js frames are nonblank.
- Structural extension replay rejects disconnected, empty, duplicate, and
  lot-overhanging masses, then regenerates canonical floors and roof from the
  enlarged footprint. The resolved district signature and roof form remain
  stable, while the optional site origin preserves the old core, material/history
  dressing, and occupant stations in production coordinates.
- The Extended blueprint proof at 1366x900 and 390x844 shows the same east wing
  in 2D and 3D. The mobile canvas contains 256 boxes and nonzero RGB variance;
  the only console error is the unrelated missing local favicon.
- Canonical registration tests prove real burg plots receive one or two bounded
  candidates whose roof form matches their district grammar. A fixed prosperous
  simulation window consumes an exact stored candidate, prioritizes fire repair,
  and leaves villagers, prosperity, disasters, and non-building chronicle events
  byte-identical when the evolution brief is omitted.
- A 100-year canonical burg run produces all three demographic lifecycle states:
  61 abandonments, 55 reoccupations, and 6 neglect ruins across 44 home plots.
  Focused tests prove dependent children move with the new household, vacated
  source homes remain discoverable, and lifecycle writers consume no RNG draws.
- Reducer migration tests prove an old registered burg gains nonempty canonical
  growth briefs while retaining the same villager, chronicle, and building-log
  objects.
- Row and market-arcade members resolve roof form, pitch scale, and eave offset
  from their durable block key, while detached and courtyard buildings retain
  their individual roof variation. Production generation, artifact, and map
  tests prove that the same rhythm reaches every consumer.
- In a rendered 158-building town, all 90 dense blocks and all 31
  multi-building dense blocks have zero roof-form, pitch, or eave-offset
  violations. Every multi-building block still gives every member a distinct
  building variant, preserving bounded facade, material, motif, and history
  exceptions beneath the shared street silhouette.
- Dense-town collision resolution preserves exact same-edge frontage contact
  without exempting real area overlaps. A default walled-town production probe
  contains 111 shared boundaries across 86 blocks, split between 45 earlier-
  member and 41 later-member visible-wall recipes.
- Both neighbors retain complete structural wall parts for independent tactical
  extraction, but the non-owner copy is marked `tactical-only`. WebGL and
  WebGPU omit 268 duplicate structural boxes while movement and line of sight
  still treat those walls as authoritative; old receipts remain unchanged.
- The same ownership predicate now gates every run-driven exterior projector.
  In the default 219-plot walled town, 111 shared boundaries suppress 2,050
  duplicate material parts, 400 facade parts, 4 weathering parts, and 40
  permanent-history parts. Weathering placement changes on 66 buildings even
  when its bounded part count remains equal; stored style and chronology are
  preserved for both neighbors.
- Attached roof skin now occupies disjoint lot half-spaces. The default town's
  222 live party sides terminate exactly at their canonical boundary with zero
  crossings, whereas all 222 ownerless legacy sides retain their former
  overhang. All 157 attached buildings keep street/back eaves, all 62 detached
  roofs keep side eaves, and canonical damage tessellation cannot reopen a
  solved seam.
- Viable dense lots now negotiate on the same 5 ft grid consumed by interiors.
  Rows and arcades choose 15/20 ft block depths plus full-envelope, rear-court,
  left-return, or right-return profiles before per-building generation. In the
  default production town, 82 buildings consume their artifact envelopes
  exactly, 64 remain non-rectangular, and every attached side retains complete
  wall coverage. Legacy, miniature, and detached receipts retain their former
  generator path.
- Large blocks now compose one to three indexed courtyard clusters along their
  long axis. The split is transactional: every new court must seat at least
  three buildings or the block replays the established single-court stream.
  Packing, ensemble identity, and shared-space resolution use one center
  contract, while each viable court receives its own block key, signature,
  radius, and district-bounded amenity. A 240x160 ft proof block produces three
  unblocked six-building courts, and legacy one-court IDs remain stable.
- Detached lots now carry explicit lane-front, garden-front, or handed side-yard
  placement receipts instead of inheriting one anonymous adapter inset. A
  district chooses the dominant frontage pattern for three quarters of its
  lots, preserving neighborhood rhythm while allowing bounded yard exceptions.
  Retained envelopes at least 15x15 ft negotiate one of the same four exact
  cell-grid mass profiles used by dense lots; smaller cottages keep their former
  generator. In a population-50 probe, all 26 detached buildings carry parcel
  evidence, 10 exact compounds use all four profiles, and 8 are non-rectangular.
- On real production relief, rows and market arcades now negotiate their terrain
  pads through the same durable block key used by walls and roofs. Viable groups
  preserve the first frontage datum, step later members in exact 3 m storey
  increments, and limit neighbors to one step. A raw jump above two storeys
  rejects the block transaction; detached, courtyard, singleton, steep, and
  legacy buildings retain their exact centroid pads. A sloped fixture terraces
  73 buildings across 30 blocks with no neighbor jump above one storey.

## Expansion Path

This is the identity foundation, not the endpoint of building variety.

1. **Done:** replace wealth-class identity with durable spatial district keys,
   carry them through the artifact contract, and render them in the 2D town
   view. Future street-aware blocks may replace sector labels with authored
   neighborhood identities without changing the resolver contract.
2. **Done:** add building-type motif programs inside each family, carry their
   evidence into the 2D town inspector, render them as additive production 3D
   parts, and isolate them from tactical collision.
3. **Partially implemented:** generated buildings are born with durable later
   phases, replacement roof evidence, patched walls, fire scars, sealed doors,
   and an age-driven dipped ridge cap. Chronological event replay, exact
   simulation-fire targeting, and live 2D/3D damage evidence are also complete.
   Explicit extension events now regenerate canonical geometry while retaining
   district style and stable lot anchoring. Prosperous years write repairs and
   consume district-aware additions without shifting simulation randomness.
   Demographic vacancy, household reuse, neglect ruins, and old-save brief
   migration are complete. Canonical roof breaches and ridge sag now deform the
   shared preview/production mesh. Versioned event-log snapshot/compaction is
   complete; sloped repair coverings remain a later rendering expansion.
4. **Done:** expand material families beyond color with masonry/course scale,
   timber thickness, roof covering, foundation treatment, glazing, shutters,
   ornament kits, exact 2D/artifact/3D parity, and tactical isolation. Age- and
   exposure-led weathering now adds district-coherent wall/roof patina receipts,
   bounded lot-level coverage and placement variation, 2D inspector/map traces,
   production 3D wall/roof-edge evidence, legacy no-op behavior, and tactical
   isolation. True slope-following covering and patina surfaces remain a later
   roof-rendering expansion over the same receipts.
5. **Done:** surface district signatures and facade grammar in the 2D town view
   and the live Towns design preview, with architecture count separated from
   social wealth statistics.
6. **Done for the current ensemble scope:** compose buildings into district-compatible street
   ensembles before per-building generation. Dense towns now form true row lots,
   plaza-adjacent wards receive market-arcade fronts, interior infill carries a
   courtyard-block identity, and small settlements stay detached. Block receipts
   preserve shared eaves and party walls through artifact, blueprint, 2D map, and
   production 3D paths without changing district architecture or tactical
   collision. Interior wards now reserve real shared courts and populate them
   with wealth-bounded amenities. Rows and arcades also coordinate roof form,
   pitch, and overhang by block while retaining individual facade, material,
   motif, history, and building-variant exceptions. Exact frontage contacts now
   survive collision resolution, and one deterministic neighbor visibly owns
   each structural party wall while both retain independent tactical walls.
   That same owner now governs foundations, courses, roof edges, ornaments,
   facade trim, weathering, and permanent wall-history projection at the seam.
   Canonical gable, hip, and steep roof meshes also stop at attached lot lines,
   eliminating overlapping side eaves without changing detached or legacy
   roof behavior. Dense rows and arcades now negotiate cell-aligned block depth,
   exact envelope occupancy, and four bounded footprint profiles rather than
   cropping unrelated random footprints. Genuinely large blocks now split into
   as many as three viable indexed courts without abandoning district amenity
   vocabulary or legacy single-court identities. Detached parcels now negotiate
   district-dominant setbacks and fit-aware compound masses without forcing
   undersized cottages onto the grid. Production rows and arcades also negotiate
   bounded 3 m terrain terraces, yielding coherent world-space eave steps while
   detached/courtyard buildings and overly steep blocks preserve their previous
   terrain behavior. True slope-following roof-covering and patina surfaces are
   separate rendering expansions over the existing roof receipts.
