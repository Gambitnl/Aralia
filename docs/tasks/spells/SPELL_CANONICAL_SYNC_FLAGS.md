# Spell Canonical Sync Flags

This file records canonical facts that are visible in the retrieved spell snapshots
but do not fit cleanly into the current spell JSON model.

These are not treated as reasons to stop syncing the rest of the spell. They are
separate modeling issues that should be reviewed on their own merits.

When one of these flags is a true model-gap, the likely follow-up implementation
surfaces are:
- `F:\Repos\Aralia\src\types\spells.ts`
- `F:\Repos\Aralia\src\systems\spells\validation\spellValidator.ts`
- `F:\Repos\Aralia\scripts\add_spell.js`
- `F:\Repos\Aralia\src\systems\spells\mechanics\ScalingEngine.ts`

That keeps the next lane honest: sometimes the right answer is to change one
spell, but sometimes the real fix is to strengthen the template so new data can
be shaped correctly from the start.

## Final Accepted Residue

The file-by-file sync lane is complete enough to move on. The live remaining
structured-vs-canonical mismatches are now treated as explicit boundary residue,
not ordinary unsynced drift.

Current state after the `2026-04-09` report refresh:
- the canonical-to-structured report is now heavily dominated by `missing-canonical-field`
  buckets because the raw canonical snapshot often stores data under `Rules Text` or
  `Available For` instead of exposing directly comparable structured fields
- the cleaner active implementation backlog is the structured-to-json report:
  - `F:\Repos\Aralia\docs\tasks\spells\SPELL_STRUCTURED_VS_JSON_REPORT.md`
  - `177` mismatches across `7` grouped buckets
- the current canonical-rules audit also reports a separate retrieval-format problem:
  - `F:\Repos\Aralia\docs\tasks\spells\SPELL_CANONICAL_RULES_AUDIT_REPORT.md`
  - `455` findings
  - current reading: this is a canonical snapshot storage/formatting problem, not a spell JSON validity problem
- higher-level scaling now has an optional dedicated structured home in the spell model:
  - `higherLevelScaling`
  - this means true higher-level model gaps should now be judged against that field as
    well as the older prose-only `higherLevels` surface

The accepted residue families are:

- `Range/Area` display round-tripping
  - Canonical source pages use compact displays like `Self (10 ft.)`, `30 ft. (20 ft.)`,
    `Touch`, or source-specific area shorthand.
  - The current structured header uses split range and area fields, so it often renders
    an equivalent but not identical display such as `Self (10-ft. Sphere)` or
    `30 ft. (20-ft. Cube)`.

- `Sub-Classes` normalization policy
  - Canonical `Available For` lists preserve subclass/domain entries even when the base
    class is already present.
  - The current JSON validator intentionally normalizes those repeated-base entries away.

- `Description` / `Higher Levels` source shape
  - The canonical snapshot stores raw prose under `Rules Text`.
  - The structured block stores normalized `Description` and `Higher Levels` fields.
  - The canonical-side parser bug that previously hid most Description prose has now
    been fixed, so `Description` should no longer be treated as a mostly source-shape
    bucket by default.
  - `Higher Levels` still remains partly source-shape sensitive because the copied
    canonical prose can keep scaling text inline instead of as a separately labeled field.
  - For higher-level behavior specifically, the repo now also has an optional structured
    `higherLevelScaling` field, so future follow-up work can distinguish:
    - prose drift
    - source-shape residue
    - true runtime scaling-model gaps

- `Canonical rules snapshot storage`
  - The current canonical-rules audit now reports `455` `missing_rules_text` findings.
  - This should not currently be treated as proof that the runtime spells are missing
    their real rules text.
  - The more likely current issue is that many canonical snapshot blocks no longer
    expose a comparable `Rules Text` section in the format the audit expects.
  - This is therefore a retrieval-storage / audit-shape problem that should be reviewed
    separately from the runtime spell-data lane.

- `Higher Levels` structured -> json residue
  - This bucket is now closed in the structured-vs-json report (`0` live
    `Higher Levels` mismatches).
  - Closed families:
    - `structured_missing_json_present`
      - examples: `bigbys-hand`, `bones-of-the-earth`, `crown-of-stars`,
        `elemental-bane`, `enervation`
      - reading: real structured-layer lag, now fixed
    - `prefix_only_residue`
      - examples: `mass-suggestion`, `wall-of-thorns`
      - reading: low-severity formatting residue around `Using a Higher-Level Spell Slot.`, now aligned in runtime JSON
    - `description_duplicate_residue`
      - examples: `banishment`, `blight`, `elemental-bane`, `enervation`
      - reading: duplicate upcast prose removed from `Description`; the dedicated
        `Higher Levels` / `higherLevels` surface now owns the text
    - `true_runtime_drift`
      - example: `create-undead`
      - reading: downgraded to formatting residue and corrected
    - cantrip runtime drift
      - examples: `chill-touch`, `shocking-grasp`
      - reading: newly structured cantrip rows exposed runtime higher-level text
        drift; JSON is now aligned with the structured/canonical cantrip wording
  - This is no longer an active runtime bucket. The remaining Higher Levels work is
    canonical source-shape review and the separate `higherLevelScaling` policy/model
    question.

- `Higher Levels` canonical-side subbucket split
  - The canonical-side residue should no longer be talked about as one vague
    `missing-canonical-field` family.
  - Current intended subbuckets are:
    - `canonical_inline_only`
      - the higher-level text is present only inside canonical `Rules Text`
    - `prefix_only_residue`
      - the canonical side adds a standard heading only
    - `statblock_tail_residue`
      - the canonical side keeps extra summon/stat-block prose in the same block
    - `true_canonical_drift`
      - real disagreement after normalization
  - This is still mostly source-shape residue rather than broad content drift.

- `Higher Levels` runtime scaling-model gap
  - The repo now has optional `higherLevelScaling`, but the corpus is not yet
    treating it as universally required.
  - Some spells can be runtime-correct with prose-only `higherLevels`.
  - Other spells may eventually need explicit structured scaling because the prose
    encodes:
    - multi-stat scaling
    - slot-specific tables
    - target-count changes
    - summon/stat-block payload changes
  - This is a model-gap/policy question, not a reason to overwrite the existing
    readable `higherLevels` prose field.

- `Description` runtime subbucketing gap
  - The structured-to-json report currently groups `34` Description mismatches together
    as `value-mismatch`, but the live residue is mixed.
  - This bucket still needs an explicit split between:
    - real runtime drift
    - formatting / encoding residue
    - blocked comparison cases when structured Description is missing
  - Representative examples:
    - likely real runtime drift: `cure-wounds`, `disguise-self`, `sleep`
    - likely formatting / encoding residue: `command`

- `Description` runtime freshness gap in the gate checker
  - The glossary gate checker now has a dedicated `Description Runtime Review` block.
  - That block correctly separates the structured -> json lane from the canonical ->
    structured lane.
  - However, the field-level mismatch row still depends on the generated
    `spell-structured-vs-json-report.json` artifact rather than a dedicated fresh
    per-field recompute from the selected-spell live refresh.
  - This is a diagnostic implementation gap, not a spell-data truth disagreement.

- `Casting Time` ritual display
  - Canonical pages often expose ritual status inline in the casting-time string.
  - The structured model stores ritual separately, so the display does not round-trip
    identically.
  - On `2026-04-28`, the canonical audit was updated to treat this as accepted
    normalization when the structured block already has `Ritual: true`.
  - This flag remains as a boundary note, not as an active Casting Time drift family.

- `Casting Time` trigger-footnote display
  - Canonical pages often use compact footnote or shorthand trigger markers such as
    `1 Reaction *` or `1 Bonus Action *`.
  - The structured layer and runtime JSON normalize the base timing fact instead of
    preserving the raw marker.
  - This is source-display residue unless a spell later proves to have lost trigger
    meaning in runtime behavior.
  - On `2026-04-28`, this was normalized out of both the canonical and runtime
    Casting Time audit lanes because trigger meaning is a separate spell fact.

- `Casting Time` Plant Growth special timing model gap
  - `plant-growth` was the one true canonical Casting Time data correction found
    after display residue was stripped away.
  - Structured markdown and runtime JSON now use `Casting Time Unit: special`
    / JSON `unit: "special"`.
  - The action combat mode remains in `Combat Cost: action`; the 8-hour enrichment
    mode is recorded in JSON `explorationCost` and matching markdown labels.
  - The markdown parity tooling does not yet compare `Exploration Cost Value` or
    `Exploration Cost Unit`, so this is a model/tooling gap rather than an active
    Casting Time mismatch.

- `Casting Time` structured -> json model/display boundary
  - The glossary now has a dedicated `Structured -> JSON` subsection for `Casting Time`.
  - That lane exists because the glossary renders runtime spell JSON, not the
    structured markdown header.
  - On `2026-04-28`, the old `7` runtime mismatches were closed as audit-shape
    residue, not spell JSON drift.
  - The current generated structured -> JSON report has no Casting Time mismatch
    group.

- `Duration` display/model boundaries
  - Remaining examples are phrases like `Until Dispelled`, `Until Dispelled or Triggered`,
    or concentration phrasing that the current structured duration surface normalizes
    differently than the copied source rendering.

- `Duration` structured -> json runtime residue
  - The glossary now has a dedicated runtime duration review lane under
    `Duration Review -> Structured -> JSON`.
  - That lane now separates five families that should not be collapsed into one bucket:
    - flattened concentration wording residue
      - examples: `hold-monster`, `infernal-calling`, `maelstrom`,
        `conjure-elemental`, `conjure-celestial`
      - current reading: the runtime spell JSON already carries the same
        concentration flag and timed duration facts, but the structured display
        still compresses them into one string like `Concentration 1 Minute`
    - plain wording / pluralization residue
      - examples: `contagion`, `dream-of-the-blue-veil`, `mirage-arcane`,
        `mordenkainens-magnificent-mansion`, `sequester`, `simulacrum`
      - current reading: the runtime spell JSON often already carries the same
        duration facts, but the displayed text still differs in pluralization,
        capitalization, or other wording-only residue
    - accepted special-bucket normalization
      - examples: `hallow`, `leomunds-secret-chest`, `transmute-rock`
      - current reading: the structured layer is more specific, but the runtime JSON
        still stores a generic `special` duration bucket
    - trigger-ended persistence boundary
      - examples: `symbol`
      - canonical-side anchor: `glyph-of-warding`
      - current reading: the source expresses a trigger-ended persistence clause
        that the current runtime duration model does not house explicitly
    - resolved real runtime drift pilot
      - examples: `pyrotechnics`, `transport-via-plants`, `chill-touch`
      - current reading: these were confirmed as runtime JSON drift and corrected;
        they should no longer appear in the structured -> JSON Duration mismatch set
  - `glyph-of-warding` remains the stronger canonical-side model-gap example because
    the copied source says `Until Dispelled or Triggered`, but the current runtime
    duration report does not yet expose it as a grouped structured -> json mismatch.
  - This remains an active audit bucket, not a resolved canonical-sync family.

- `Material Component` / `Components` footnote forms
  - Canonical pages often use raw component strings with footnote markers and consumed-
    material notes.
  - The structured model stores booleans, material text, cost, and consumed state as
    split fields, so the exact source string does not round-trip cleanly.

- `Material Component` canonical source-shape residue
  - Resolved on 2026-04-29.
  - The audit now compares material facts instead of raw source-wrapper text:
    - ingredient text
    - cost
    - consumed state
  - Footnote wrappers and parentheses should not reappear as live material drift
    unless the underlying material facts differ.

- `Material Component` structured -> json runtime residue
  - Resolved on 2026-04-29.
  - Runtime JSON material notes now match the reviewed structured material facts for
    the prior live set.
  - `legend-lore` remains an explicit model-convention note:
    - `Material Cost GP` currently follows the validator's written-price convention
    - this means `incense worth 250 GP and four ivory strips worth 50 GP each` is
      stored as `300`, not quantity-expanded to `450`
  - Reopen this bucket only if a future audit finds new material-note drift.

- `Components` runtime storage-shape boundary
  - The glossary spell card renders runtime spell JSON, not the structured markdown
    header.
  - The structured `Components` line stores one compact `V/S/M` header, while runtime
    JSON stores decomposed facts:
    - `verbal`
    - `somatic`
    - `material`
    - `materialDescription`
    - material cost / consumed state
  - A spell can therefore be runtime-correct even when the exact structured component
    line does not round-trip literally through JSON.
  - This should be treated as:
    - model/display boundary when the V/S/M letters and material facts still agree
    - real runtime drift only when the structured V/S/M requirement and runtime JSON
      facts actually disagree
  - Representative examples:
    - `feather-fall`: footnote/source-shape residue on the canonical side, with
      runtime review needed only to confirm whether the JSON still carries the same
      `V, M` fact
    - `soul-cage`: similar footnote-marker residue with richer material-note context
    - `arcane-sword`: alternate-source raw component-string shape rather than a clean
      D&D Beyond-style component line
  - Current working runtime-side subbucket vocabulary:
    - `model_display_boundary`
    - `missing_runtime_components`
    - `missing_structured_components`
    - `real_runtime_drift`
  - Current working canonical-side subbucket vocabulary:
    - `footnote_marker_residue`
    - `alternate_source_shape`
    - `true_components_drift`

- `Classes` source-shape residue
  - The canonical snapshot exposes class access through `Available For`, not a dedicated
    `Classes` field.
  - The live canonical-side report now shows `17` `Classes` mismatches after the stale
    inflated report was refreshed on `2026-04-05`.
  - The old `408` count should no longer be used for planning. The current bucket is a
    small active residue set, not proof of broad base-class drift.
  - The current residue exists because the structured block exposes normalized
    base classes directly, while the copied canonical snapshot usually keeps the same
    access surface under raw `Available For` lines.
  - Current subbucket split:
    - `12` missing-derived-classes cases
      - reviewed directly on `2026-04-29`
      - closed as source-shape residue because these copied canonical snapshots have
        empty `Available For:` payloads followed by capture metadata / legacy markers
      - structured markdown and runtime JSON already agree on their normalized base-class
        lists, so no spell data mutation was made
    - `5` metadata-leak parser cases
  - This should be treated as parser/source-shape residue unless a spell shows a true
    narrowed or widened base-class surface.

- `Classes` parser contamination residue
  - A smaller subset of the canonical-side `Classes` bucket is not really
    "missing classes."
  - In those files, comparison metadata such as `Capture Method: http` leaked into
    the canonical-side comparable class value.
  - Representative examples:
    - `aura-of-purity`
    - `bigbys-hand`
    - `mass-cure-wounds`
    - `planar-binding`
    - `scrying`
  - This should be treated as a canonical-side parser bug, not as real spell data
    drift.

- `Classes` runtime lane currently has no grouped backlog
  - The live structured-vs-json report does not currently expose a grouped `Classes`
    bucket.
  - That means the glossary-facing runtime JSON is not currently showing a broad
    corpus-scale lag behind structured `Classes` data.
  - This is important because even the refreshed canonical-side `17` count could be
    misread as a runtime class-data crisis when the runtime lane is currently clean at
    grouped-report scale.

- `Classes` still needs room for true drift
  - This bucket has produced real corrections before and should not be flattened into
    "always residue."
  - Representative example:
    - `disguise-self`
      - prior runtime JSON carried non-caster base classes
      - canonical review showed the base-class surface was narrower
      - that required a real data correction instead of only a parser/source-shape
        explanation

- `arcane-sword` alternate-source shape
  - The approved alternate-source snapshot fused level and school into one visible source
    line, so the structured `Level` field cannot match it literally without degrading the
    normalized data model.

## Range/Area Normalization Direction

The `Range/Area` review split into two separate lanes:

- `plain range / area normalization`
  - This lane is about storing cast placement distance and resulting geometry
    consistently in spell JSON.
  - The current normalization direction is:
    - `range` = how far from the caster the spell can be initiated or placed
    - `targeting.areaOfEffect` = the resulting geometry of the spell effect
    - self-centered effects should not misuse `range.distance` to store the area radius
    - if the spell is a true self-centered aura or burst, the radius belongs in
      `targeting.areaOfEffect.size`
    - when the spell schema can express the canonical geometry more precisely
      (for example `Emanation`), prefer that over older approximations like `Sphere`

- `spell casting mechanics discovery`
  - This is now treated as a separate follow-up lane.
  - It covers questions such as:
    - whether a spell targets a point, object, or creature first and then creates an area
    - whether the area follows the caster
    - whether the spell's area is a rider, trigger zone, trap, wall, or placement rule
    - whether the canonical rules imply mechanic distinctions that the current JSON does
      not yet house cleanly
  - These mechanics discoveries should be reviewed separately instead of being folded
    back into plain `Range/Area` normalization as if they were only formatting issues.

This split matters because the project currently needs the spell JSONs to be usage-ready
with uniform geometry, while still preserving room for future mechanic-model expansion.

## Range/Area Two-Phase Residue

The `Range/Area` bucket now has two separate review lanes in the glossary gate checker:

- canonical -> structured `Range/Area Bucket`
- structured -> json `Range/Area Runtime Review`

That split is required because the glossary renders runtime spell JSON rather than the
structured markdown block.

Bucket policy answer now confirmed:

- the structured `.md` layer should remain explicit and granular
- it should not be rewritten into the terse compact source-display form just to make
  canonical headers round-trip more literally
- icon-shape capture-loss belongs to canonical-source repair work rather than being
  counted as structured-data drift
- hyphen formatting differences like `20-ft.` vs `20 ft.` are display-level only
  under the current runtime model
- the better long-term normalization target is separate geometry facts, not more
  literal compact strings
- the next required design step is to define the structured `.md` fact schema for
  `Range/Area` before expanding the runtime JSON further
- that fact schema is now split into:
  - core required facts
  - common extension facts
  - specialized mechanics-linked facts
- a concrete structured `.md` field template now exists for the bucket, so future
  migration work can compare spell files against one explicit target shape rather
  than inventing per-spell formatting
- combined `Range/Area` display strings should now be treated as derived display
  surfaces, not as the authoritative structured payload
- `range.distance` is a required numeric field in spell JSON, and `0` is the
  explicit sentinel when a spell has no measured distance to store
- the working spell inventory and queue breakdown now live in:
  - `F:\Repos\Aralia\docs\tasks\spells\range-area\SPELL_RANGE_AREA_INVENTORY.md`

Current bucket reading:

- canonical -> structured:
  - mostly accepted normalization, source-display residue, and model/display boundary
  - but not fully closed:
    - the canonical-side `172` mismatch set now has a real subbucket map
    - part of that map is still likely true structured drift rather than harmless boundary
  - the confirmed self-centered icon-shape capture-loss mini-queue is now cleared:
    - `antilife-shell`
    - `investiture-of-ice`
    - `investiture-of-wind`
    - `prismatic-spray`
    - `thunderwave`
  - the remaining self-centered canonical-side residue is now `24` spells, but those
    no longer belong in the missing-icon-shape bucket
- structured -> json:
  - still an active implementation-follow-up lane
  - the live `61`-spell runtime set should not be treated as one class of problem
  - it still needs to be split into:
    - real runtime drift
    - model/display boundary
    - source-display residue

Current representative runtime sample spells:

- `aura-of-vitality`
- `conjure-animals`
- `crusaders-mantle`
- `leomunds-tiny-hut`
- `pass-without-trace`
- `sending`
- `skywrite`
- `wall-of-sand`
- `wall-of-water`
- `wind-wall`

Canonical-side working terms:

- `boundary`
  - structured and canonical preserve the same practical geometry in different
    display forms
  - example:
    - `alarm`
    - structured `30 ft. (20-ft. Cube)`
    - canonical `30 ft. (20 ft.)`

- `source-shape residue`
  - the copied canonical `Range/Area` header is thinner than the rules text, so the
    structured layer preserves geometry that the raw header does not spell out
  - example:
    - `mighty-fortress`
    - structured `1 mile (120-ft. Square)`
    - canonical header `1 mile`

- `real drift`
  - the structured value likely is actually behind or wrong against the canonical source
  - examples:
    - `goodberry`
    - `clairvoyance`
    - `dream`
    - `word-of-recall`

Current provisional canonical-side subbuckets:

- `compact canonical area size vs explicit structured shape` (`36`)
  - current reading:
    - mostly boundary
    - but the live D&D Beyond page often carries the actual shape in an icon class
      such as `i-aoe-cube`, `i-aoe-sphere`, or `i-aoe-square`, so part of this set
      is really canonical capture loss rather than a true structured mismatch
    - the first repair batch already restored missing shape words on confirmed
      examples like `alarm`, `grease`, `sleep`, and `lightning-bolt`, but the raw
      bucket still stays active because exact display formatting and shape-semantics
      differences remain afterward

- `canonical header thinner than structured geometry` (`37`)
  - current reading:
    - mostly source-shape residue

- `structured phantom 0-ft. None area suffix` (`26`)
  - current reading:
    - likely structured-side residue

- `self compact radius vs explicit structured shape` (`23`)
  - current reading:
    - mostly boundary
    - with a smaller icon-shape capture-loss slice where the live page is carrying
      the geometry through an icon-bearing compact header rather than plain text

- `canonical footnote area vs normalized structured shape` (`20`)
  - current reading:
    - mostly source-display residue

- `structured missing self radius` (`4`)
  - current reading:
    - likely real structured drift
  - examples:
    - `aura-of-life`
    - `aura-of-purity`
    - `circle-of-power`
    - `draconic-transformation`

- `structured parser scalar artifact` (`5`)
  - current reading:
    - likely structured-side residue

- `clear structured range drift` (`4`)
  - current reading:
    - likely real structured drift
  - examples:
    - `clairvoyance`
    - `goodberry`
    - `dream`
    - `word-of-recall`

- `canonical header drops secondary effect area` (`4`)
  - current reading:
    - mixed

- `shape-semantics boundary` (`2`)
  - current reading:
    - mixed boundary / shape-vocabulary issue

- `special-range display boundary` (`2`)
  - current reading:
    - display/model boundary

- `large-footprint or ward-area gap` (`2`)
  - current reading:
    - model gap

- `range-origin or targeting drift` (`2`)
  - current reading:
    - likely real structured drift or modeling issue

- one-off canonical-side flags:
  - `alternate-source range drift`
    - `arcane-sword`
  - `structured missing Range/Area` header
    - `skywrite`
  - `clear area-size drift`
    - `call-lightning`
  - `touch vs touch-area header`
    - `dragons-breath`
  - `canonical header malformed or empty area`
    - `fabricate`

Current provisional runtime subbuckets:

- `self-centered emanation normalization drift` (`7`)
  - examples:
    - `antilife-shell`
    - `aura-of-vitality`
    - `pass-without-trace`
  - current reading:
    - likely real runtime drift
  - why:
    - the structured layer already uses explicit self-centered `Emanation`
    - runtime JSON still stores `Sphere`

- `structured phantom 0-ft. None area residue` (`31`)
  - examples:
    - `arcane-gate`
    - `chain-lightning`
    - `raise-dead`
    - `true-seeing`
  - current reading:
    - mostly structured-side display residue
  - why:
    - the structured layer keeps synthetic no-area suffixes such as `(0-ft. None)`
    - runtime JSON usually has the cleaner plain range value already

- `distance-unit and special-range encoding split` (`9`)
  - examples:
    - `meteor-swarm`
    - `mighty-fortress`
    - `sending`
    - `telepathy`
  - current reading:
    - mixed bucket
  - why:
    - this set mixes:
      - unit display boundary such as `1 mile` vs `5280 ft.`
      - special-range semantics such as `Unlimited`, `Sight`, and `Special`

- `wall and constructed-shape alias drift` (`10`)
  - examples:
    - `blade-barrier`
    - `forcecage`
    - `prismatic-wall`
    - `wall-of-water`
  - current reading:
    - mixed bucket
  - why:
    - some spells likely still have real runtime geometry drift
    - others are shape-vocabulary/model-display boundary cases such as `Wall` vs `Line`

- `structured scalar-area formatting residue` (`5`)
  - examples:
    - `delayed-blast-fireball`
    - `reverse-gravity`
    - `storm-sphere`
  - current reading:
    - mostly structured-side formatting residue
  - why:
    - the structured header preserves raw scalar area values without a stable shape label

- `runtime JSON missing area geometry` (`4`)
  - examples:
    - `bones-of-the-earth`
    - `conjure-celestial`
    - `ice-storm`
    - `whirlwind`
  - current reading:
    - likely real runtime drift
  - why:
    - the structured layer already carries explicit area geometry while runtime JSON still falls back to plain range only

- `shape-semantics boundary set` (`5`)
  - examples:
    - `commune-with-nature`
    - `earthquake`
    - `leomunds-tiny-hut`
    - `prismatic-spray`
  - current reading:
    - mixed bucket
  - why:
    - these are the cases where the disagreement is really about shape semantics,
      source wording, or a likely parser artifact rather than just a number

- `structured missing Range/Area` (`1`)
  - example:
    - `skywrite`
  - current reading:
    - likely structured-side omission
  - why:
    - runtime JSON still has a value while the structured header does not

Bucket-specific boundary categories:

- `compact canonical display vs richer normalized geometry`
  - example: `alarm`
  - canonical `30 ft. (20 ft.)`
  - structured/runtime normalized display may preserve the same facts as
    `30 ft. (20-ft. Cube)`
- `self-centered area normalization`
  - examples: `arms-of-hadar`, `detect-magic`
  - canonical `Self (X ft.)`
  - normalized geometry may need explicit `Emanation` or another explicit area shape
- `point-at-range placement vs resulting area`
  - examples: `alarm`, `faerie-fire`, `wall-of-water`
  - the repo needs to preserve cast range and resulting area separately even when
    the source compresses them into one display string

Current model-gap / follow-up rule:

- spell-casting mechanics discovery stays separate from plain `Range/Area`
  normalization
- if a residue case is really about:
  - moving fields
  - placed wards
  - trap zones
  - touch-cast later areas
  - wall/path behavior
  it should be flagged as mechanics follow-up instead of being forced into a false
  geometry-only fit

## Current Flags

### `level-1/alarm`

- The canonical spell targets a `door`, `window`, or `area`, but the actual trigger
  watches for a `creature` touching or entering the warded space.
- The current targeting model does not cleanly represent "chosen warded object/area"
  plus "creature intrusion trigger" in the same structured surface.
- The canonical `Damage/Effect` surface reads as `Detection`, but the current effect
  taxonomy does not have a dedicated detection effect lane. The repo currently houses
  this under utility/sensory behavior instead.

### `level-1/arms-of-hadar`

- The canonical rules explicitly use the term `Emanation`.
- The spell schema now supports `Emanation`, so this is no longer treated as a hard
  model limitation.
- The remaining review question for this spell belongs to the separate mechanics lane:
  whether other self-centered ongoing or triggered effects should also normalize to
  `Emanation` when the canonical wording implies the same geometry.

### `level-1/bane`

- The canonical `Available For` list includes subclass entries whose base class is
  already present in the spell's base `classes` list.
- The current spell validator rejects those as redundant subclass entries, so the
  raw canonical access surface cannot currently be housed in JSON without either:
  - relaxing the validator rule, or
  - intentionally normalizing those entries away
- This is now a model-policy issue rather than a simple content-sync issue.

### `level-1/bless`

- The canonical `Available For` list adds only subclass/domain entries whose base
  class is already present in the spell's base `classes` list.
- The current spell validator rejects those as redundant subclass entries, so the
  canonical subclass surface cannot currently be stored in JSON without a schema-
  policy decision.

### `level-1/burning-hands`

- The canonical rules explicitly say that unattended flammable objects in the Cone
  start burning.
- The current top-level structured markdown block and JSON shape do not have a
  dedicated place for this secondary environmental rider outside the damage effect
  description.

### `level-1/chromatic-orb`

- The canonical `Available For` list adds `Sorcerer - Draconic Sorcery`, but the
  current validator rejects subclass entries that repeat an already-listed base class.
- The canonical spell also includes the orb-leap rider and per-slot leap scaling,
  which are only partially expressed in the current JSON damage model.
- This spell therefore has both an access-model flag and a mechanic-model flag.

### `level-1/command`

- The canonical `Available For` list contains several subclass/domain entries whose
  base classes are already present in the spell's `classes` list.
- The structured markdown can preserve those entries as canonical evidence, but the
  current validator prevents the JSON from housing them all at once.

### `level-1/color-spray`

- The canonical spell presents a direct save-based blinded effect.
- The current JSON still carries legacy color-spray mechanics about an HP pool and
  unconscious-creature ordering inside its utility effect description.
- This needs separate mechanic review beyond top-level text sync.

### `level-1/command`

- The canonical `Available For` list includes subclass entries that repeat the
  already-listed base classes `Bard`, `Cleric`, and `Paladin`.
- The current validator rejects those as redundant subclass entries, so the raw
  canonical access surface cannot be copied into JSON without a policy decision.
- The spell also contains more detailed command-option text in the canonical body
  than the older structured description exposed.

### `level-1/compelled-duel`

- The canonical `Available For` list includes `Paladin - Oath of the Crown (SCAG)`,
  which repeats the already-listed base class `Paladin`.
- The current validator rejects that as redundant subclass data.
- The rest of the spell can be synced cleanly, but this subclass line needs a separate
  policy decision if it is meant to be stored in JSON.

### `level-1/expeditious-retreat`

- The canonical `Available For` list includes `Paladin - Oath of the Open Sea (TCSR)`,
  while the base `classes` list already includes the main access classes.
- This is a model-policy case rather than a plain content sync, because the current
  JSON validator still needs a clear rule for whether that subclass line belongs in
  `subClasses` or should remain only as canonical evidence.

### `level-1/hex`

- The canonical snapshot keeps the higher-level concentration scaling in a more
  explicit rule form than the current structured markdown block.
- The same spell also has a referenced-rule trail in the canonical snapshot that the
  structured block does not expose directly.
- The spell itself can be synced cleanly, but the referenced-rule trail is best kept
  as separate glossary-enrichment evidence rather than forced into the core spell JSON.

### `level-2/alter-self`

- The canonical access surface includes `Sorcerer - Draconic Sorcery`, but that repeats
  the already-listed base class `Sorcerer`.
- The current validator rejects that entry, so the JSON can only retain the non-redundant
  subclass lines unless the validation rule changes later.

### `level-1/disguise-self`

- The prior JSON carried non-caster classes in its base `classes` list.
- The canonical base-class surface is much narrower, so this file needed a true data
  correction instead of only a markdown description sync.

### `level-1/dissonant-whispers`

- The prose was brought back to canonical wording, but the spell still carries
  broader access-surface and effect-structure residue that should be handled as a
  separate model pass.

### `level-1/protection-from-evil-and-good`

- The prose was brought back to canonical wording, but the spell still carries
  broader access-surface residue that should be handled as a separate model pass.

### `level-1/detect-magic`

- The canonical spell includes repeat-access subclass lines for the same base
  classes already listed in `classes`.
- The structured markdown can preserve that evidence, but the JSON validator still
  treats those repeated base-class subclass entries as a separate policy problem.
- The ritual marker also keeps the casting-time display from round-tripping cleanly
  through the current split structured fields.

### `level-1/purify-food-and-drink`

- The canonical spell includes repeated-base subclass access lines for Cleric and
  Paladin that the current JSON validator does not want to house.
- The current structured range/area split still does not render the canonical
  `10 ft. (5 ft.)` display exactly, so that remains a separate display-model issue.

### `level-1/tashas-hideous-laughter`

- The canonical spell includes repeated-base subclass access lines for Warlock that
  are canonical evidence but not clean JSON payloads under the current validator.
- The current file can keep those entries in the markdown snapshot, but JSON remains
  normalized until the subclass policy is revisited.

### `level-1/thunderwave`

- The canonical spell includes repeated-base subclass access lines for Cleric, Druid,
  and Warlock, which the current JSON validator rejects as redundant access entries.
- The current range/area split still preserves the spell shape differently than the
  canonical `Self (15 ft.)` display, so that remains a separate model-boundary item.

### `level-1/sleep`

- The canonical spell still does not round-trip cleanly through the current
  `Range/Area` and `Material Component` surfaces even after the top-level text sync.
- The raw canonical snapshot remains the source of truth for the missing material
  and area phrasing, so this should stay visible as a display-model gap rather than
  being forced into a false fit.

### `level-8/level-9 range-area boundary`

- Several high-level spells still expose canonical `Range/Area` display text that the
  current split structured model cannot render identically without inventing a new
  shape vocabulary or changing the report formatter.
- The remaining examples are things like `Abi-Dalzim's Horrid Wilting`, `Antimagic
  Field`, `Demiplane`, `Earthquake`, `Holy Aura`, `Incendiary Cloud`, `Maddening
  Darkness`, `Mighty Fortress`, `Meteor Swarm`, `Prismatic Wall`, `Storm of Vengeance`,
  `Sunburst`, `Tsunami`, and `Weird`.
- `Control Weather` was cleared after the audit formatter learned to respect the
  structured `Range Unit` and standalone area-size display.
- These are not considered content errors. They are structural model-boundary cases
  that should be reviewed separately if the range/area schema is ever widened.

### `level-5` canonical/model boundaries

- `hallow`, `creation`, `cloudkill`, and `insect-plague` still expose canonical
  `Range/Area` displays that do not round-trip cleanly through the current split
  structured fields. The raw canonical snapshot is correct, but the structured header
  remains a model-boundary approximation.
- `planar-binding`, `scrying`, `mislead`, `animate-objects`, and `greater-restoration`
  still need the canonical access surface to be preserved in markdown while JSON stays
  normalized wherever the validator still rejects redundant subclass access.
- `bigbys-hand` and `banishing-smite` needed direct canonical body-text and component
  repairs, but their remaining differences are mostly legacy naming and schema-fit
  issues rather than missing spell content.
- `commune-with-nature` still uses a self-targeting knowledge area that is easier to
  describe canonically than to house in the current structured targeting surface.

### `level-4/5 sync residue after the latest manual pass`

- `geas` still carries canonical subclass evidence that cannot be stored cleanly in
  the current JSON validator/model without a policy change.
- `mass-cure-wounds` still needs a model decision for the canonical subclass access
  surface and retains a range/area display mismatch in the structured header.
- `confusion` still exposes canonical subclass access and area/range display details
  that do not round-trip identically through the current split fields.
- `vitriolic-sphere` now has the canonical body text and damage framing in the
  structured files, but its range/area display remains model-boundary shaped.
- `greater-restoration` still needs the canonical access surface to be decided against
  the current class/subclass validator rules, even though the main body text is synced.

### `level-4/5 follow-up residue after the latest sync pass`

- `dream` now has the canonical body text and duration model in sync, but its
  special-range display and access-surface shape still do not round-trip identically
  through the current structured fields.
- `cloudkill` and `insect-plague` now carry the canonical prose in sync, but their
  range/area display still remains a model-boundary approximation rather than a
  literal round-trip of the source rendering.
- `scrying` now has the canonical prose mostly aligned, but its range/area, material
  component, and duration display are still normalized differently than the raw
  canonical snapshot.
- `mass-cure-wounds` still exposes canonical subclass evidence and range/area
  behavior that the current structured split cannot house without leaving a visible
  policy gap.
- `greater-restoration` still carries redundant subclass evidence that should stay
  visible for now because the current JSON policy does not want to treat those
  repeated access entries as canonical payload.

## Bucket-Level Sub-Classes Residue

- The current canonical-side `Sub-Classes` bucket (`156` live report cases) is
  the primary review surface for this bucket, but it is still a mixed lane rather
  than a trustworthy count of broad broken structured subclass data.
- Many canonical snapshots preserve subclass/domain access inside raw
  `Available For` capture, but the current canonical-vs-structured audit does not
  always derive a directly comparable normalized `Sub-Classes` field from that
  source surface.
- The canonical-side work should therefore stay split into explicit subbuckets:
  - `missing_structured_subclasses`
  - `incomplete_structured_subclasses`
  - `repeated_base_canonical_entries`
  - `legacy_or_unsupported_canonical_entries`
  - `canonical_label_variant_residue`
  - `malformed_structured_subclass_field`
  - `canonical_source_shape_gap`
- Repeated-base subclass/domain entries remain a live policy/model-boundary issue:
  - canonical evidence may show `Cleric - X` while `Cleric` is already present in
    base `classes`
  - current JSON/validator policy still treats those entries as redundant and
    normalizes them away
- Legacy or unsupported canonical subclass/domain lines should stay visible as
  evidence until a later policy pass decides whether they ever belong in normalized
  structured or runtime storage.

## Bucket-Level Range/Area Model Note

- `2026-04-24` update:
  - structured -> JSON `Range/Area` residue is now down to `7` spells
  - the remaining set should not be treated as a bulk data-entry queue
  - true leftovers needing separate treatment:
    - `skywrite`: the structured markdown has no usable `Range/Area` header while
      runtime JSON still stores `0 ft.`
    - `sending` and `telepathy`: structured uses `Unlimited`, runtime JSON uses
      `Special`; this needs one project-wide policy answer
    - `commune-with-nature`: runtime JSON appears to carry a fake `3-ft. Sphere`
      around a self spell
    - `mirage-arcane`: `Sight (1 mile Square)` does not fit cleanly into the
      current runtime special-range model
    - `control-weather`: `Self (5 miles)` is a no-shape radius around the caster,
      which the current runtime area model can only approximate by inventing a
      shape
    - `earthquake`: the structured layer preserves a ground `Circle`, while
      runtime JSON currently approximates it as a `Sphere`
  - the pass intentionally did not edit the glossary spell gate checker because
    that code is undergoing modularization

- `2026-04-29` update:
  - structured -> JSON `Range/Area` residue is now `0` in the regenerated report
  - the `7` tracked spells plus newly resurfaced `snare` were handled directly
  - true model/boundary findings preserved from the pass:
    - `Circle` is now a first-class primary runtime area shape because `snare`
      and `earthquake` need flat ground footprints
    - `commune-with-nature` should not use a fake primary `3-ft. Sphere`; its
      outdoor and underground knowledge radii belong in `spatialDetails`
    - `control-weather` is currently represented as a 5-mile-radius `Sphere`
      approximation, but it remains the best example for a future
      radius-without-shape option if the Range/Area model widens again
    - `sight` and `unlimited` are valid runtime range types and should be used
      directly instead of hiding those spells under `special`
  - no glossary spell gate checker edits were made in this pass

- The runtime spell schema no longer treats range and area units as purely
  implicit comments:
  - `distanceUnit`
  - `rangeUnit`
  - `sizeUnit`
  - `heightUnit`
  - `widthUnit`
  - `thicknessUnit`
  are now accepted by the live spell validator and honored by the glossary
  formatter plus the structured-vs-json range audit.
- This resolves the narrow "area size unit is only implicit" model gap for the
  runtime `Range/Area` lane.
- The earlier `2026-04-07` zero-backlog note turned out to be stale when the live
  corpus was audited again.
- Actual live starting point on `2026-04-08` was:
  - `291` spells with `602` missing explicit geometry-unit fields
- The follow-up corpus backfill then updated `289` spell JSON files and added `598`
  explicit unit fields.
- Live corpus audit on `2026-04-08` now finds `0` positive numeric runtime geometry
  fields without explicit unit fields.
- That means the explicit-unit backfill sub-lane is now genuinely complete.
- What remains is no longer unit omission or runtime JSON catch-up. It is:
  - canonical-side icon-shape capture loss and other source-shape residue
  - geometry semantics
  - shape vocabulary
  - mechanics-model follow-up
- The older safe/risky queue split is now historical context for how the rollout was
  executed.
- The first risky-spell follow-through had already widened the reviewed sample so
  these spells are no longer carrying focused `Range/Area` runtime drift:
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
- The remaining review question for the formerly risky family is no longer "what unit
  is this?" It is "what shape/semantic/runtime home should this spell use?"

## Bucket-Level Sub-Classes Runtime Note

- Structured -> JSON `Sub-Classes` residue (`45` live report cases) should be
  treated as a secondary runtime implementation lane, not as resolved residue.
- The runtime lane still needs spell-by-spell review to separate:
  - real missing runtime subclass payload
  - verification-state lag
  - repeated-base normalization
  - malformed structured-value cases
- The glossary now has a dedicated `Sub-Classes Runtime Review` block so these
  findings can be reviewed per spell without collapsing back into generic issue
  text.
- This runtime lane should be worked after the canonical-side transfer pass has
  cleaned up the structured `.md` layer for the same spells.
