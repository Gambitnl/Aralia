# Spell Range/Area Bucket Tracker

Last Updated: 2026-04-10

## Bucket Purpose

This tracker exists for the `Range/Area` spell-truth bucket.

The bucket has to cover two separate comparison phases:

- canonical -> structured
- structured -> json

That split matters because the glossary spell card renders from runtime spell JSON,
not from the structured markdown block. A spell is not fully covered just because
the structured `Range/Area` header was compared against the copied canonical snapshot.

## Current Status

- canonical -> structured:
  - source: `F:\Repos\Aralia\docs\tasks\spells\SPELL_STRUCTURED_VS_CANONICAL_REPORT.md`
  - live count: `172`
  - grouped kind: `value-mismatch`
  - practical reading: mostly accepted normalization and source-display residue
- structured -> json:
  - source: `F:\Repos\Aralia\docs\tasks\spells\SPELL_STRUCTURED_VS_JSON_REPORT.md`
  - live count: `61`
  - grouped kind: `value-mismatch`
  - practical reading: active runtime implementation follow-up lane
- glossary gate checker:
  - canonical -> structured `Range/Area Bucket`: implemented
  - structured -> json `Range/Area Runtime Review`: implemented
  - selected-spell refresh now also returns fresh structured -> json mismatch rows for this bucket in dev mode
- explicit runtime unit backfill inventory:
  - the earlier `2026-04-07` zero-backlog note was wrong; a fresh audit on
    `2026-04-08` found `291` spells with `602` missing explicit geometry unit fields
  - the follow-up corpus backfill on `2026-04-08` then updated `289` spell JSON files
    and added `598` explicit unit fields
  - post-backfill validation is green and the live corpus audit now finds `0` positive
    numeric runtime geometry fields without explicit unit fields
  - the explicit-unit backfill lane is therefore now genuinely complete
  - the older `429` safe / `28` risky split should be read as historical execution
    scaffolding rather than live backlog

## Bucket Interpretation

### Canonical -> Structured

This side is mostly a display/model comparison rather than a broad factual failure.

Common canonical displays:

- `Self (10 ft.)`
- `Self (30 ft.)`
- `30 ft. (20 ft.)`
- `Touch`

Common structured forms:

- `Self (10-ft. Emanation)`
- `Self (30-ft. Emanation)`
- `30 ft. (20-ft. Cube)`
- split range and area fields that render a richer geometry summary than the source page

Current dominant categories:

- accepted normalization
- source-shape residue
- model/display boundary

This lane should not be read as `172` spells with wrong geometry facts.

Current working terms:

- `boundary`
  - structured and canonical preserve the same practical geometry, but not in the
    same display form
  - example:
    - `alarm`
    - structured: `30 ft. (20-ft. Cube)`
    - canonical: `30 ft. (20 ft.)`
- `source-shape residue`
  - the canonical `Range/Area` header is thinner than the spell rules text, so the
    structured layer preserves geometry the copied header does not spell out
  - example:
    - `mighty-fortress`
    - structured: `1 mile (120-ft. Square)`
    - canonical header: `1 mile`
- `real drift`
  - the structured value likely is actually behind or wrong against the canonical
    source
  - examples:
    - `goodberry`
    - `clairvoyance`
    - `dream`
    - `word-of-recall`

Policy answer now locked in for this bucket:

- the structured `.md` layer should not be compacted to mimic the terse canonical
  `Range/Area` header
- structured spell data should stay explicit and granular enough to preserve usable
  geometry rather than only source display wording
- icon-shape capture-loss cases belong to canonical-source repair work, not to the
  structured-drift pile
- canonical-side hyphen formatting like `20-ft.` vs `20 ft.` is not a runtime
  mechanics concern under the current JSON model
- the long-term direction should be more granular structured geometry, not better
  compact strings
- the working example `20 ft. Cube` should be read as at least three separate
  facts:
  - measured size: `20`
  - measured unit: `feet`
  - shape: `Cube`
- follow-up implication:
  - structured `.md` and runtime JSON should prefer storing those facts separately
    rather than treating the combined display string as the authoritative payload
- execution order now confirmed:
  - define the canonical `Range/Area` fact schema for the structured `.md` layer
    first
  - then use that structured fact model to guide any follow-up JSON reshaping

Current provisional canonical-side subbuckets:

- `compact canonical area size vs explicit structured shape` (`36`)
  - examples:
    - `alarm`
    - `entangle`
    - `fireball`
    - `zone-of-truth`
  - current reading:
    - mostly boundary

- `canonical header thinner than structured geometry` (`37`)
  - examples:
    - `mighty-fortress`
    - `wall-of-fire`
    - `wall-of-water`
    - `storm-of-vengeance`
  - current reading:
    - mostly source-shape residue

- `structured phantom none-area suffix` (`26`)
  - examples:
    - `arcane-gate`
    - `chain-lightning`
    - `magic-jar`
    - `true-seeing`
  - current reading:
    - likely structured-side residue

- `self compact radius vs explicit structured shape` (`23`)
  - examples:
    - `arms-of-hadar`
    - `burning-hands`
    - `detect-magic`
    - `spirit-guardians`
  - current reading:
    - mostly boundary

- `canonical footnote area vs normalized structured shape` (`20`)
  - examples:
    - `ice-knife`
    - `meteor-swarm`
    - `magic-circle`
    - `whirlwind`
  - current reading:
    - mostly source-display residue

- `structured missing self radius` (`4`)
  - examples:
    - `aura-of-life`
    - `aura-of-purity`
    - `circle-of-power`
    - `draconic-transformation`
  - current reading:
    - likely real structured drift

- `structured parser scalar artifact` (`5`)
  - examples:
    - `dawn`
    - `delayed-blast-fireball`
    - `storm-sphere`
  - current reading:
    - likely structured-side residue

- `clear structured range drift` (`4`)
  - examples:
    - `clairvoyance`
    - `goodberry`
    - `dream`
    - `word-of-recall`
  - current reading:
    - likely real structured drift

- `canonical header drops secondary effect area` (`4`)
  - examples:
    - `gust-of-wind`
    - `hail-of-thorns`
    - `investiture-of-ice`
    - `investiture-of-wind`
  - current reading:
    - mixed

- `shape-semantics boundary` (`2`)
  - examples:
    - `earthquake`
    - `leomunds-tiny-hut`
  - current reading:
    - mixed boundary / shape-vocabulary issue

- `special-range display boundary` (`2`)
  - examples:
    - `mirage-arcane`
    - `project-image`
  - current reading:
    - display/model boundary

- `large-footprint or ward-area gap` (`2`)
  - examples:
    - `forbiddance`
    - `guards-and-wards`
  - current reading:
    - model gap

- `range-origin or targeting drift` (`2`)
  - examples:
    - `cordon-of-arrows`
    - `heroes-feast`
  - current reading:
    - likely real structured drift or modeling issue

- `alternate-source range drift` (`1`)
  - example:
    - `arcane-sword`

- `structured missing Range/Area header` (`1`)
  - example:
    - `skywrite`

- `clear area-size drift` (`1`)
  - example:
    - `call-lightning`

- `touch vs touch-area header` (`1`)
  - example:
    - `dragons-breath`

- `canonical header malformed or empty area` (`1`)
  - example:
    - `fabricate`

### Structured -> JSON

This is the active implementation lane for the bucket.

The structured markdown block is the interpreted layer.
The spell JSON is the runtime/app layer.
The glossary renders the runtime JSON.

So when structured `Range/Area` and runtime JSON geometry disagree, that is runtime
implementation drift unless the difference is only a known model/display boundary.

Current dominant categories:

- real runtime drift
- model/display boundary

Secondary category:

- source-display residue that still leaks through because the structured header is
  richer than the current runtime geometry formatter

## Key Mismatch Families

### Canonical -> Structured

#### 1. Compact canonical display vs richer structured geometry

Examples:

- `alarm`
- `burning-hands`
- `detect-magic`
- `thunderwave`

Meaning:
- the canonical page uses a compact combined `Range/Area` string
- the structured layer splits cast range from effect geometry and often names the shape explicitly

Current reading:
- mostly accepted normalization / display boundary

#### 2. Self-centered area normalization

Examples:

- `arms-of-hadar`
- `detect-evil-and-good`
- `detect-magic`

Meaning:
- canonical source often compresses self-centered effects to `Self (X ft.)`
- the structured layer needs to decide whether that is better modeled as:
  - `Sphere`
  - `Emanation`
  - or another explicit area form

Current reading:
- mostly model/display boundary
- sometimes also a mechanics-discovery hint when the spell wording implies a moving or anchored area

#### 3. Point-at-range area placement

Examples:

- `alarm`
- `faerie-fire`
- `wall-of-water`

Meaning:
- canonical source compresses cast range and resulting area into one display
- the structured layer has to keep:
  - cast placement distance
  - resulting area geometry
separate

Current reading:
- accepted normalization where the same facts are preserved

### Structured -> JSON

#### 1. Self-centered emanation normalization drift (`7`)

Spells:

- `antilife-shell`
- `aura-of-vitality`
- `conjure-animals`
- `conjure-minor-elementals`
- `conjure-woodland-beings`
- `crusaders-mantle`
- `pass-without-trace`

Meaning:
- the structured layer already uses explicit self-centered `Emanation`
- runtime JSON still uses `Sphere`

Current reading:
- likely real runtime drift under the current normalization direction

#### 2. Structured phantom `0-ft. None` area residue (`31`)

Representative spells:

- `arcane-gate`
- `chain-lightning`
- `conjure-fey`
- `contingency`
- `flesh-to-stone`
- `magic-jar`
- `negative-energy-flood`
- `raise-dead`
- `true-seeing`
- `wind-walk`

Meaning:
- the structured header still carries synthetic no-area suffixes such as:
  - `(0-ft. None)`
  - `(0)`
- runtime JSON usually carries the cleaner plain range value only

Current reading:
- mostly structured-side display residue rather than true runtime drift

#### 3. Distance-unit and special-range encoding split (`9`)

Spells:

- `control-weather`
- `meteor-swarm`
- `mighty-fortress`
- `mirage-arcane`
- `project-image`
- `sending`
- `storm-of-vengeance`
- `telepathy`
- `tsunami`

Meaning:
- the bucket mixes:
  - unit display differences such as `1 mile` vs `5280 ft.`
  - special-range semantics such as `Unlimited`, `Sight`, and `Special`

Current reading:
- mixed bucket
- partly model/display boundary
- partly model-gap
- may still contain narrower real runtime drift

#### 4. Wall and constructed-shape alias drift (`10`, historical first pass)

Spells:

- `blade-barrier`
- `forcecage`
- `prismatic-wall`
- `temple-of-the-gods`
- `wall-of-fire`
- `wall-of-ice`
- `wall-of-sand`
- `wall-of-thorns`
- `wall-of-water`
- `wind-wall`

Meaning:
- runtime JSON often uses `Line` or no area at all where the structured layer uses
  `Wall`, `Cube`, or another more explicit constructed shape

Current reading:
- mixed bucket
- some likely true runtime drift
- some shape-vocabulary boundary
- note:
  - this was the pre-`2026-04-06` first-pass classification
  - direct risky-spell widening has since cleared the `Range/Area` runtime mismatch on:
    - `mighty-fortress`
    - `wall-of-force`
    - `wall-of-ice`
    - `wall-of-light`
    - `wall-of-stone`
    - `wall-of-water`

#### 5. Structured scalar-area formatting residue (`5`)

Spells:

- `delayed-blast-fireball`
- `fire-storm`
- `reverse-gravity`
- `storm-sphere`
- `synaptic-static`

Meaning:
- the structured header keeps an incomplete area scalar such as `(20)` or `(50)`
  without a stable shape label
- runtime JSON already has a clearer shape-bearing value

Current reading:
- mostly structured-side formatting / parser residue

#### 6. Runtime JSON missing area geometry (`4`)

Spells:

- `bones-of-the-earth`
- `conjure-celestial`
- `ice-storm`
- `whirlwind`

Meaning:
- the structured layer already carries explicit area geometry
- runtime JSON still falls back to plain range only

Current reading:
- likely real runtime drift

#### 7. Shape-semantics boundary set (`5`)

Spells:

- `commune-with-nature`
- `dawn`
- `earthquake`
- `leomunds-tiny-hut`
- `prismatic-spray`

Meaning:
- these are the residue cases where the disagreement is not just a number
- the bucket is really about shape semantics, source wording, or a likely parser artifact

Current reading:
- mixed bucket
- needs direct spell-by-spell review

#### 8. Structured missing `Range/Area` while runtime still has one (`1`)

Spell:

- `skywrite`

Meaning:
- this is not a subtle boundary case
- the structured header is simply missing the value while runtime JSON still has one

Current reading:
- likely structured-side omission

#### 9. Explicit runtime unit backfill split

Current first-pass queue:

- safe first-pass queue (`429`)
  - examples:
    - `acid-splash`
    - `booming-blade`
    - `elementalism`
    - `mage-hand`
    - `minor-illusion`
- risky/model-gap queue (`28`)
  - risky families:
    - `inch_detail` (`12`)
    - `diameter_detail` (`14`)
    - `constructed_shape_spell` (`14`)
    - `alternate_area_mode` (`5`)
    - `panel_construction` (`4`)
  - representative risky spells:
    - `prismatic-wall`
    - `wall-of-force`
    - `wall-of-stone`
    - `forcecage`
    - `mighty-fortress`
    - `gate`
    - `temple-of-the-gods`

Meaning:
- the runtime schema can now house explicit units, but the corpus should not be
  backfilled as one blind sweep
- the safe queue already stores ordinary numeric geometry that can take explicit
  unit fields without widening the geometry model
- the risky queue contains spells where the text or geometry likely needs wider
  decisions around:
  - inches
  - diameter language
  - alternate shape modes
  - constructed wall / panel payloads

Current reading:
- safe queue:
  - active implementation follow-up
- risky queue:
  - model-gap / policy review first

## Per-Phase Plan

### Phase 1: Canonical -> Structured

Goal:
- keep the bucket documented as mostly normalization and source-display residue rather
  than treating the raw `172` count as broad factual error

Actions:
- keep the glossary gate checker classification visible for canonical -> structured
- preserve mechanics-discovery findings as a separate follow-up lane instead of
  pretending they are only formatting issues
- work from the canonical-side subbucket map instead of treating the `172`-spell set
  as one flat residue count
- review the likely real-drift canonical subbuckets first:
  - structured missing self radius (`4`)
  - clear structured range drift (`4`)
  - range-origin or targeting drift (`2`)
  - clear area-size drift (`1`)
  - structured missing `Range/Area` header (`1`)

### Phase 2: Structured -> JSON

Goal:
- treat the `60` runtime mismatches as the active implementation-follow-up surface

Actions:
- use the dedicated `Range/Area Runtime Review` block in the glossary gate checker
- work from the provisional runtime subbucket map instead of treating the bucket as
  one undifferentiated `60`-spell lane
- resolve the likely real-drift buckets first:
  - self-centered emanation normalization drift (`7`)
  - runtime JSON missing area geometry (`4`)
  - explicit structured omission (`skywrite`)
- split the explicit-unit backfill work into two lanes instead of touching the
  whole corpus at once:
  - safe first-pass queue (`429`)
  - risky/model-gap queue (`28`)
- keep the safe pass structural:
  - only backfill onto existing numeric runtime geometry fields
  - do not infer unit fields from arbitrary prose mentions
- keep the clearly lower-value residue buckets out of the same fix queue:
  - structured phantom `0-ft. None` area residue (`31`)
  - structured scalar-area formatting residue (`5`)

### Phase 3: Mechanics follow-up separation

Goal:
- keep spell-casting mechanics discovery separate from plain range/area normalization

Actions:
- flag cases where geometry questions are really mechanic-model questions:
  - moving self-centered fields
  - placed wards or zones
  - touch-delivered later areas
  - wall/path/line semantics that exceed the current simple display surface

### Phase 4: Structured Fact Schema Definition

Goal:
- define the canonical fact schema for `Range/Area` in the structured `.md` layer
  before widening or reshaping the runtime JSON further

Actions:
- enumerate the minimum separate geometry facts the structured layer should carry
- distinguish compact display text from authoritative structured facts
- identify which facts are already present in the current spell JSON model
- identify which missing facts are true JSON/model gaps versus only markdown-shape
  gaps

## Structured Range/Area Fact Taxonomy

This taxonomy is the current target shape for the structured `.md` layer.

Why it exists:
- the canonical source often compresses multiple geometry facts into one
  `Range/Area` string
- the runtime JSON already carries part of the geometry as separate fields
- the next normalization step needs one shared fact model instead of continuing to
  compare or store compact strings as if they were the real payload

### 1. Core required facts

These are the minimum facts the structured layer should try to surface whenever a
spell has meaningful range or area geometry.

- `rangeOriginType`
  - what kind of cast origin the spell uses
  - examples:
    - `self`
    - `touch`
    - `point-at-range`
    - `sight`
    - `special`
- `rangeDistance`
  - numeric cast-placement distance when the spell has one
- `rangeUnit`
  - unit for the cast-placement distance
  - examples:
    - `feet`
    - `miles`
- `areaShape`
  - primary resulting shape of the effect
  - examples:
    - `Cone`
    - `Cube`
    - `Sphere`
    - `Line`
    - `Cylinder`
    - `Square`
    - `Emanation`
    - `Wall`
    - `Hemisphere`
    - `Ring`
- `areaSize`
  - primary scalar attached to that shape
- `areaSizeUnit`
  - unit for the primary scalar
- `areaSizeType`
  - what that scalar means
  - examples:
    - `radius`
    - `diameter`
    - `length`
    - `edge`
    - `side`

### 2. Common extension facts

These are common enough that they should be treated as first-class geometry facts
rather than spell-specific oddities when they occur.

- `areaHeight`
- `areaHeightUnit`
- `areaWidth`
- `areaWidthUnit`
- `areaThickness`
- `areaThicknessUnit`
- `followsCaster`
  - whether the area remains centered on or moves with the caster
- `shapeVariant`
  - when the spell offers multiple shape modes under one spell
- `targetingOriginMode`
  - how the effect is anchored
  - examples:
    - `self-centered`
    - `point-in-range`
    - `touched-target`
    - `anchored-object`

### 3. Specialized mechanics-linked facts

These should stay explicit, but they should not all be forced into the baseline
geometry shape when the spell is really exposing broader mechanic behavior.

- `secondaryArea`
  - for spells whose main cast range is separate from a rider area
- `triggerZone`
  - for effects that care about crossing or touching a boundary
- `wallSegments`
  - for spells that create piecewise wall construction
- `shapeSemantics`
  - for cases like:
    - `Hemisphere` vs `Sphere`
    - `Emanation` vs `Sphere`
    - one-sided barriers
- `measuredSpatialDetails`
  - for relevant non-primary measurements such as:
    - inch-thickness
    - gallon volumes
    - alternate height/length notes that do not belong to the primary area scalar

### 4. Display-only derivatives

These should not be treated as the authoritative payload.

- `canonicalRangeAreaDisplay`
  - the copied source-facing display string
- `structuredRangeAreaDisplay`
  - the human-facing combined string rendered from structured facts

These are useful for:
- audits
- glossary display
- human comparison

But they should be derived from the geometry facts above whenever possible.

### 5. Mapping to current runtime JSON

Already housed reasonably well in the current JSON:
- `rangeOriginType` -> `range.type`
- `rangeDistance` -> `range.distance`
- `rangeUnit` -> `range.distanceUnit`
- `areaShape` -> `targeting.areaOfEffect.shape`
- `areaSize` -> `targeting.areaOfEffect.size`
- `areaSizeUnit` -> `targeting.areaOfEffect.sizeUnit`
- `areaSizeType` -> `targeting.areaOfEffect.sizeType`
- `areaHeight` / `areaHeightUnit`
- `areaWidth` / `areaWidthUnit`
- `areaThickness` / `areaThicknessUnit`
- `followsCaster`
- `shapeVariant`
- parts of `triggerZone`
- parts of `measuredSpatialDetails`

Still partly missing or mixed in the current model:
- `targetingOriginMode` as an explicit first-class fact
- `secondaryArea` as a stable reusable structure
- richer `wallSegments` and constructed-shape payloads
- `shapeSemantics` when the canonical/source distinction matters beyond a plain
  shape label

### 6. Working normalization rule

The structured `.md` layer should store the separate geometry facts as the
authoritative payload.

The combined `Range/Area` display string should be treated as a rendered summary,
not the source of truth.

## Structured `.md` Range/Area Field Template

This is the migration target for the validator-facing structured spell block.

The goal is:
- keep the spell-facing structured block readable to humans
- make the authoritative geometry facts explicit
- let the combined `Range/Area` line become a derived summary instead of the
  main payload

### Minimal template

Use this when the spell only needs the core geometry facts.

```md
- **Range Origin Type**: self | touch | point-at-range | sight | special
- **Range Distance**: 30
- **Range Unit**: feet
- **Area Shape**: Cube
- **Area Size**: 20
- **Area Size Unit**: feet
- **Area Size Type**: edge
```

### Extended template

Add these fields only when the spell actually needs them.

```md
- **Area Height**: 40
- **Area Height Unit**: feet
- **Area Width**: 10
- **Area Width Unit**: feet
- **Area Thickness**: 1
- **Area Thickness Unit**: inches
- **Follows Caster**: true
- **Shape Variant**: wall | globe
- **Targeting Origin Mode**: self-centered | point-in-range | touched-target | anchored-object
- **Secondary Area**: 5-foot explosion around struck target
- **Trigger Zone**: one-sided crossing trigger
- **Wall Segments**: 10 panels
- **Shape Semantics**: hemisphere rather than full sphere
- **Measured Spatial Details**: blocks line of effect through 1 inch of metal
```

### Display summary rule

If the spell keeps a human-facing `Range/Area` line in the structured block, it
should be treated as a rendered summary of the explicit facts above.

Examples:
- `30 ft. (20 ft. Cube)`
- `Self (15 ft. Cone)`
- `Self (30 ft. Emanation)`

Those display strings are useful, but they should not be the authoritative
structured payload once the explicit facts are present.

### Example mappings

`Alarm`

```md
- **Range Origin Type**: point-at-range
- **Range Distance**: 30
- **Range Unit**: feet
- **Area Shape**: Cube
- **Area Size**: 20
- **Area Size Unit**: feet
- **Area Size Type**: edge
```

`Detect Magic`

```md
- **Range Origin Type**: self
- **Area Shape**: Emanation
- **Area Size**: 30
- **Area Size Unit**: feet
- **Area Size Type**: radius
- **Follows Caster**: true
- **Targeting Origin Mode**: self-centered
```

`Lightning Bolt`

```md
- **Range Origin Type**: self
- **Area Shape**: Line
- **Area Size**: 100
- **Area Size Unit**: feet
- **Area Size Type**: length
- **Area Width**: 5
- **Area Width Unit**: feet
- **Targeting Origin Mode**: self-centered
```

## Progress Log

### 2026-04-04

- confirmed the bucket is two-phase rather than canonical-only
- confirmed the canonical-side live count is `168`
- confirmed the runtime-side live count was `72` before the risky-spell follow-through
- confirmed the glossary gate checker already had a strong canonical -> structured
  `Range/Area` block
- confirmed the missing part was a separate bucket-specific structured -> json review block
- implemented `Range/Area Runtime Review` in the spell gate checker
- implemented live selected-spell refresh support so the runtime bucket can use fresh
  structured -> json mismatch rows instead of only stale artifact wording
- visually verified the gate checker section on representative spells:
  - `alarm`
  - `detect-magic`
- pulled the full first-pass runtime mismatch set and split it into a stable
  first-pass subbucket map instead of leaving the runtime lane as one flat residue list
- pulled the full `168`-spell canonical mismatch set and split it into a canonical-side
  subbucket map so `boundary`, `source-shape residue`, and `real drift` are now tied
  to concrete mismatch families instead of being used as vague shorthand

### 2026-04-06

- added explicit range/area unit support to the runtime spell type layer in:
  - `F:\Repos\Aralia\src\types\spells.ts`
  - `F:\Repos\Aralia\src\systems\spells\validation\spellValidator.ts`
- taught the glossary spell card and the `Range/Area Runtime Review` gate block to
  honor explicit unit-bearing runtime geometry instead of hard-coding feet
- taught the structured-vs-json audit formatter to read explicit unit fields so
  future range/area backfills do not get misreported as drift
- backfilled pilot runtime JSON on:
  - `alarm`
  - `detect-magic`
- verification:
  - `npm run validate:spells` stayed green (`459 / 459`)
  - `alarm` now shows `0` structured-vs-json mismatches on a focused audit pass
  - `detect-magic` shows no `Range/Area` runtime mismatch on a focused audit pass;
    its remaining focused mismatch is currently only `Sub-Classes`
- completed the first structural explicit-unit backfill inventory:
  - `457` runtime spells still have numeric geometry without explicit unit fields
  - `429` are safe first-pass backfill candidates
  - `28` were split into a risky/model-gap queue for manual follow-up
  - the risky queue is dominated by:
    - inch detail
    - diameter detail
    - constructed wall/panel geometry
    - alternate area modes
  - `prismatic-wall` is the clearest example of why the risky queue must stay out
    of a blanket pass: its current runtime geometry is numeric, but the spell text
    also carries inch-thickness and alternate-globe details that do not yet fit
    cleanly into a simple first-pass backfill
- fixed the structured-vs-json range formatter so explicit unit backfills no longer
  create fake drift like `feets`
- widened the reviewed risky spells so their spatial forms and measured details are
  explicitly pulled apart in both structured markdown and runtime JSON:
  - `arcane-eye`
  - `bones-of-the-earth`
  - `create-or-destroy-water`
  - `flaming-sphere`
  - `tensers-floating-disk`
  - `otilukes-freezing-sphere`
  - `glyph-of-warding`
  - `mighty-fortress`
  - `wall-of-force`
  - `wall-of-ice`
  - `wall-of-light`
  - `wall-of-stone`
  - `wall-of-water`
- regenerated the full structured-vs-json audit:
  - runtime `Range/Area` mismatches dropped from `72` to `60`
  - overall structured-vs-json mismatches dropped from `188` to `176`
- focused audit results for the widened risky sample:
  - `Range/Area` now clean on:
    - `flaming-sphere`
    - `create-or-destroy-water`
    - `tensers-floating-disk`
    - `arcane-eye`
    - `otilukes-freezing-sphere`
    - `glyph-of-warding`
    - `mighty-fortress`
    - `wall-of-force`
    - `wall-of-ice`
    - `wall-of-light`
    - `wall-of-stone`
    - `wall-of-water`
  - remaining focused mismatches in that sample are outside this bucket:
    - `bones-of-the-earth` (`Description`, `Higher Levels`)
    - `wall-of-ice` (`Material Component`)

### 2026-04-08

- reran the live runtime geometry-unit audit after discovering that the tracker's
  earlier `2026-04-07` zero-backlog claim did not match the current corpus state
- actual live starting point:
  - `291` spells with missing explicit geometry-unit fields
  - `602` field omissions across:
    - `range.distanceUnit`
    - `targeting.rangeUnit`
    - `areaOfEffect.sizeUnit`
    - `areaOfEffect.heightUnit`
- added a repeatable backfill script:
  - `F:\Repos\Aralia\scripts\backfillSpellRangeAreaUnits.ts`
- ran the corpus backfill:
  - `289` spell JSON files changed
  - `598` explicit unit fields added
- verification after the backfill:
  - `npm run validate:spells` -> `459 / 459 valid`
  - live runtime geometry-unit audit -> `0` remaining positive numeric geometry
    fields without explicit unit fields
- regenerated the structured-vs-json report after the backfill:
  - `F:\Repos\Aralia\docs\tasks\spells\SPELL_STRUCTURED_VS_JSON_REPORT.md`
  - total mismatches: `177`
  - `Range/Area` runtime mismatches: `61`
- practical reading:
  - the explicit-unit sub-lane is complete
  - the broader `Range/Area` runtime lane is still not complete because unit clarity
    exposed, rather than resolved, some remaining geometry-shape drift

### 2026-04-09

- refreshed the canonical-side `Range/Area` subbucket map against the current
  `2026-04-09` structured-vs-canonical report
- confirmed the canonical-side live count is now `172`
- confirmed `alarm`, `plant-growth`, and `grease` are still canonical-capture-loss
  examples where the live D&D Beyond page carries the area shape in an icon class
  while the copied canonical snapshot only retained the scalar text
- moved `detect-evil-and-good` and `detect-poison-and-disease` out of the old
  `structured missing self radius` set because the structured header now preserves
  `Self (30-ft. Emanation)` while the copied canonical snapshot still shows the
  thinner `Self (30 ft.)` form
- kept `draconic-transformation` in `structured missing self radius` because the
  structured header still shows only `Self` against canonical `Self (60 ft.)`
- moved `wall-of-ice` into `canonical header thinner than structured geometry`
  because the canonical header still only shows `120 ft.` while the structured
  layer preserves the wall footprint
- recorded the bucket policy answer that the structured `.md` layer should remain
  explicit and granular rather than being flattened toward compact canonical
  display strings
- recorded that icon-shape capture-loss cases should be repaired in the copied
  canonical snapshot instead of being treated as structured-data mismatches
- recorded the new follow-up direction that `Range/Area` should be modeled as
  individual geometry facts rather than as a compact combined string, with
  hyphen differences treated as display-only unless a future audit still needs
  literal source identity
- repaired the first confirmed canonical icon-shape capture-loss batch in the
  copied snapshots on:
  - `alarm`
  - `calm-emotions`
  - `create-or-destroy-water`
  - `entangle`
  - `faerie-fire`
  - `fog-cloud`
  - `grease`
  - `purify-food-and-drink`
  - `sleep`
  - `lightning-bolt`
  - `leomunds-tiny-hut`
- confirmed from live D&D Beyond markup that this repair batch covered icon-bearing
  shapes like:
  - `i-aoe-cube`
  - `i-aoe-sphere`
  - `i-aoe-square`
  - `i-aoe-line`
- reran the structured-vs-canonical audit after the repair batch
- practical result:
  - the raw `Range/Area` count did not drop because the remaining mismatch is now
    mostly exact display formatting or shape-semantics residue rather than missing
    shape words
  - examples:
    - `alarm`: `30 ft. (20-ft. Cube)` vs `30 ft. (20 ft. Cube)`
    - `lightning-bolt`: `Self (100-ft. Line)` vs `Self (100 ft. Line)`
    - `leomunds-tiny-hut`: `Self (10-ft. Hemisphere)` vs `Self (10 ft. Sphere)`

### 2026-04-10

- continued the canonical snapshot repair queue first, in line with the new
  `SPELL_RANGE_AREA_INVENTORY.md` work order
- repaired a second confirmed icon-shape batch on:
  - `burning-hands`
  - `color-spray`
  - `cone-of-cold`
  - `fear`
  - `sunbeam`
  - `detect-magic`
  - `detect-evil-and-good`
  - `detect-poison-and-disease`
  - `antimagic-field`
- confirmed from live D&D Beyond markup:
  - `burning-hands`, `color-spray`, `cone-of-cold`, and `fear` use
    `i-aoe-cone`
  - `sunbeam` uses `i-aoe-line`
  - `detect-magic`, `detect-evil-and-good`, and `detect-poison-and-disease`
    use `i-aoe-sphere`
  - `antimagic-field` uses `i-aoe-emanation`
- reran the canonical audit after the repair batch
- practical result:
  - the raw `Range/Area` count is still `172`
  - the repaired spells now separate more clearly into:
    - formatting-only residue:
      - `burning-hands`
      - `color-spray`
      - `cone-of-cold`
      - `fear`
      - `sunbeam`
    - shape-semantics boundary:
      - `detect-magic`
      - `detect-evil-and-good`
      - `detect-poison-and-disease`
      - `antimagic-field`
- repaired a third confirmed self-centered icon-shape batch on:
  - `conjure-minor-elementals`
  - `conjure-woodland-beings`
  - `globe-of-invulnerability`
  - `holy-aura`
  - `pass-without-trace`
  - `spirit-guardians`
- confirmed from live D&D Beyond markup:
  - `conjure-minor-elementals`, `conjure-woodland-beings`, `holy-aura`,
    `pass-without-trace`, and `spirit-guardians` use `i-aoe-emanation`
  - `globe-of-invulnerability` also exposes `i-aoe-emanation`, which makes its
    remaining `Sphere` vs `Emanation` mismatch a clearer shape-semantics issue
    than a missing-shape-word issue
- reran the canonical audit after the third batch
- practical result:
  - total structured-vs-canonical mismatches dropped from `418` to `414`
  - raw `Range/Area` count still stayed at `172`
  - the canonical repair queue is still paying off because more spells are now
    clearly in one of these narrower states:
    - formatting-only residue:
      - `pass-without-trace`
      - `spirit-guardians`
      - `conjure-minor-elementals`
    - formatting-plus-footnote residue:
      - `conjure-woodland-beings`
    - shape-semantics boundary:
      - `globe-of-invulnerability`
      - `holy-aura`
- repaired a fourth confirmed self-centered icon-shape batch on:
  - `antilife-shell`
  - `investiture-of-ice`
  - `investiture-of-wind`
  - `prismatic-spray`
  - `thunderwave`
- confirmed from live D&D Beyond markup:
  - `antilife-shell` uses `i-aoe-emanation`
  - `investiture-of-ice` uses `i-aoe-cone`
  - `investiture-of-wind` uses `i-aoe-cube`
  - `prismatic-spray` uses `i-aoe-cone`
  - `thunderwave` uses `i-aoe-cube`
- reran the canonical audit after the fourth batch
- practical result:
  - total structured-vs-canonical mismatches dropped from `414` to `411`
  - raw `Range/Area` count still stayed at `172`
  - the self-centered canonical-side residue set dropped from `29` to `24`
  - those remaining `24` self-centered cases are no longer a missing-icon-shape
    queue; they now read as a mix of:
    - explicit structured drift
    - phantom `0-ft. None` structured residue
    - canonical headers that truly just say `Self`
    - non-icon compact radius displays that still need separate review

## Remaining Work

- no further blanket explicit-unit backfill is needed
- keep the older safe/risky queue split only as historical context for how the unit
  rollout was executed
- audit the `61` structured -> json mismatches directly
- work the runtime buckets in this order:
  - self-centered emanation normalization drift (`7`)
  - runtime JSON missing area geometry (`4`)
  - structured missing `Range/Area` (`1`)
  - wall and constructed-shape alias drift (`10`)
  - distance-unit and special-range encoding split (`9`)
  - shape-semantics boundary set (`5`)
- defer lower-value structured residue buckets until after the real runtime drift is gone:
  - structured phantom `0-ft. None` area residue (`31`)
  - structured scalar-area formatting residue (`5`)
- confirm the canonical-side likely real-drift subbuckets spell by spell:
  - structured missing self radius (`4`)
  - clear structured range drift (`4`)
  - range-origin or targeting drift (`2`)
  - clear area-size drift (`1`)
  - structured missing `Range/Area` header (`1`)
- use pilot spells first where the normalization rule is already clear:
  - `detect-magic`
  - `alarm`
- keep the already-cleared risky spells out of the active runtime follow-up lane
  unless a later retrospective pass learns a better spatial formulation:
  - `flaming-sphere`
  - `create-or-destroy-water`
  - `tensers-floating-disk`
  - `arcane-eye`
  - `otilukes-freezing-sphere`
  - `glyph-of-warding`
  - `mighty-fortress`
  - `wall-of-force`
  - `wall-of-ice`
  - `wall-of-light`
  - `wall-of-stone`
  - `wall-of-water`
- keep feeding mechanics-shaped cases into the separate spell-casting mechanics lane
  instead of forcing them into plain geometry normalization prematurely

## Open Questions / Model Gaps

1. Should runtime spell JSON ever store a raw canonical `Range/Area` display string,
   or should the repo continue treating that as source evidence only?

2. Should the runtime lane distinguish more explicitly between:
   - self-centered emanation normalization
   - point-at-range placement
   - touch-cast later-area behavior
   - wall/line/path geometry

3. When a spell is semantically aligned but displayed differently, should the
   structured -> json audit eventually learn to treat that as `aligned` rather than
   leaving it in `value-mismatch`?

4. Should `Wall`, `Hemisphere`, and `Circle` become first-class runtime display
   shapes, or should the runtime lane keep using approximate shapes like `Line`
   and `Sphere` when the underlying behavior is close enough?

5. This tracker now closes the specific "area size unit is only implicit" gap for
   the runtime schema, but other spell-only geometry-like numbers still remain
   implicit elsewhere in the corpus and should be reviewed separately instead of
   being silently treated as solved by this bucket work.

## Current Bucket Verdict

- canonical -> structured: mostly accepted normalization / source-shape residue
- structured -> json: active implementation-follow-up lane
- policy review only: no
- implementation work still needed: yes
- audit work still needed: yes
- runtime gate-checker coverage: implemented
  - the bucket now has a separate structured -> json review block rather than relying
    only on canonical-side diagnostics
- runtime subbucket map: implemented
  - the bucket now has a stable first-pass classification of the runtime mismatch
    families instead of treating them as one flat residue list
- explicit-unit sub-lane: complete
  - the live runtime spell corpus now genuinely finds `0` positive numeric geometry
    fields without explicit unit fields after the `2026-04-08` corpus backfill
