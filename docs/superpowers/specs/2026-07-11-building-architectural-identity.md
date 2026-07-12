# Building Architectural Identity

**Status:** Three production slices implemented 2026-07-11: layered building
variation, durable spatial town districts with 2D/3D identity parity, and
culture-aware building-role motifs. This extends Building Generator v2 Phase
1B; it does not replace the approved Living Buildings spec.

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
district signature, building variant, and facade pattern. This is the durable
handoff between normalized town generation and streamed 3D construction,
including civic buildings that have no population record. Affine town transforms
preserve ward wealth, architecture district, and building identity.

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

## Expansion Path

This is the identity foundation, not the endpoint of building variety.

1. **Done:** replace wealth-class identity with durable spatial district keys,
   carry them through the artifact contract, and render them in the 2D town
   view. Future street-aware blocks may replace sector labels with authored
   neighborhood identities without changing the resolver contract.
2. **Done:** add building-type motif programs inside each family, carry their
   evidence into the 2D town inspector, render them as additive production 3D
   parts, and isolate them from tactical collision.
3. Let Phase 3 history alter the dialect honestly: extensions, replaced roof
   materials, patched walls, fire scars, sealed doors, and age-driven sag.
4. Expand material families beyond color: masonry unit scale, timber thickness,
   roof covering, foundation treatment, glazing, shutters, and ornament kits.
5. **Done:** surface district signatures and facade grammar in the 2D town view
   and the live Towns design preview, with architecture count separated from
   social wealth statistics.
