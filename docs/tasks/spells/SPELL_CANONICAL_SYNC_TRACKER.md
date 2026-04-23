# Spell Canonical Sync Tracker

This tracker exists for the manual file-by-file sync lane.

The active job in this lane is narrower than the broader spell-truth tracker:
- compare each spell's structured markdown block against its copied canonical snapshot
- update the structured markdown block and the matching spell JSON individually
- record any canonical facts that do not fit the current JSON model cleanly

## Model And Scaffold Surfaces

When a residue bucket turns out to be a true model-gap rather than just a sync
issue, the likely ownership surfaces are:
- `F:\Repos\Aralia\src\types\spells.ts`
- `F:\Repos\Aralia\src\systems\spells\validation\spellValidator.ts`
- `F:\Repos\Aralia\scripts\add_spell.js`
- `F:\Repos\Aralia\src\systems\spells\mechanics\ScalingEngine.ts`

That matters because some remaining spell-truth issues are no longer "fix this
one file" problems. They are template/scaffold problems that would keep
reproducing if those files stay behind the live spell corpus.

## Status Key

- `pending`: this spell has not been manually synced in this lane yet
- `synced`: the structured markdown block and the matching JSON were manually updated from the canonical snapshot
- `flagged`: the spell was manually reviewed, but one or more canonical facts need separate model review

## Final Status

- `459 / 459` spell JSON files now pass `npm run validate:spells`.
- Canonical retrieval is complete for the supported corpus; every supported spell now has a stored canonical snapshot in its spell reference markdown file.
- The refreshed structured-vs-canonical audit on `2026-04-09` now reports `418` mismatches across `409` compared spell files.
- That higher number should not be read as the manual sync lane being undone. The refreshed report is now dominated by `missing-canonical-field` buckets where the raw canonical snapshot exists, but the current audit does not derive a directly comparable structured field from it.
- The active implementation follow-up lane is therefore the structured-vs-json report:
  - `F:\Repos\Aralia\docs\tasks\spells\SPELL_STRUCTURED_VS_JSON_REPORT.md`
  - `177` mismatches across `7` grouped buckets on `2026-04-09`
- A separate retrieval-format regression is now also visible in:
  - `F:\Repos\Aralia\docs\tasks\spells\SPELL_CANONICAL_RULES_AUDIT_REPORT.md`
  - `455` findings on `2026-04-09`
  - this should currently be treated as a canonical snapshot storage/review issue, not as proof that runtime spell JSON regressed

## Remaining Residue Buckets

- `Range/Area` (`172`): the current split structured range/area model still does not round-trip compact canonical displays identically, and the newer size/shape metadata work has not removed the review need yet.
- `Sub-Classes` (`71`): the canonical snapshot preserves raw `Available For` subclass lines, including repeated-base entries that the current JSON validator intentionally normalizes away.
- `Casting Time` (`52`): these are mostly ritual/source-display forms such as `1 Minute Ritual` versus the current split structured casting-time fields.
- `Description` (`51`): this is now an active prose-review lane rather than the older inflated missing-field artifact. The bucket is currently better explained by `SPELL_DESCRIPTION_SUBBUCKET_REPORT.md`.
- `Higher Levels` (`24`): this is now a smaller active prose/source-shape lane rather than the older inflated missing-field artifact.
- `Classes` (`17`): the canonical-side bucket is now a small active residue set. Most remaining cases still come from canonical class access living under `Available For` instead of a directly comparable `Classes` field.
- `Duration` (`17`): the remaining cases are source-display or model-shape differences such as `Until Dispelled`, `Until Dispelled or Triggered`, and concentration phrasing that do not round-trip identically through the current structured duration surface.
- `Material Component` (`11`): the remaining cases are the smaller true residue set after the parser fix, not the older inflated count.
- `Components` (`3`): the remaining cases use raw canonical component strings with footnote markers that do not map cleanly onto the current split structured component fields.

## Runtime Follow-Up Buckets

The current live runtime follow-up lane is the structured-vs-json report. Its `2026-04-09`
bucket counts are:

- `Range/Area` (`61`)
- `Sub-Classes` (`45`)
- `Description` (`34`)
- `Duration` (`17`)
- `Higher Levels` (`8`)
- `Casting Time` (`7`)
- `Material Component` (`5`)

This is the cleaner surface for answering "what is still wrong in runtime JSON?"
after the canonical sync and retrieval work.

### Description Bucket Progress Note

- canonical -> structured:
  - `51` mismatches
  - current status: primary active canonical copying lane
  - the canonical-side parser bug was fixed on `2026-04-04`, so this is now a much
    cleaner count of real prose drift rather than inflated audit residue
  - current subbucket focus:
    - `30` `real-prose-drift`
    - `13` `canonical-extra-rules-detail`
    - `8` `higher-level-text-still-inline-or-missing`
- structured -> json:
  - `34` mismatches
  - current status: secondary runtime follow-up lane
  - runtime JSON is still lagging behind structured data for this bucket
  - remaining spells include a mix of:
    - real runtime description drift
    - likely formatting / encoding residue
- glossary gate checker:
  - `Description Review` now covers canonical -> structured
  - `Description Runtime Review` now covers structured -> json
  - current split report:
    - canonical -> structured: `30` real prose drift, `13` extra-rules-detail cases,
      `8` Description-vs-Higher-Levels split cases
    - structured -> json: `18` wording-shift cases, `16` real runtime drift cases

### Casting Time Bucket Progress Note

- canonical -> structured:
  - `52` mismatches
  - current status: active in the report, but mostly source-display residue rather
    than ordinary timing drift
  - why: canonical spell pages often fold ritual or trigger markers into one compact
    casting-time string
- structured -> json:
  - `7` mismatches
  - current status: active runtime follow-up lane
  - runtime JSON may still lag behind structured data for part of this bucket, but
    the residue is small and likely mixed
  - remaining sample spells:
    - `counterspell`
    - `dream-of-the-blue-veil`
    - `feather-fall`
    - `hellish-rebuke`
    - `legend-lore`
    - `mirage-arcane`
    - `shield`
- glossary gate checker:
  - `Casting Time Review` now covers canonical -> structured
  - `Structured -> JSON` subsection now covers the runtime comparison separately
- bucket state:
  - not fully resolved yet
  - canonical side is mostly boundary/source residue
  - runtime side still needs direct spell-by-spell audit before it can be called
    boundary-only

### Higher Levels Bucket Progress Note

- canonical -> structured:
  - `126` mismatches
  - current status: active in the report, but mostly source-shape residue rather
    than broad higher-level drift
  - why: canonical snapshots usually store higher-level behavior inline under raw
    `Rules Text` instead of exposing a separate comparable `Higher Levels` field
- structured -> json:
  - `8` mismatches
  - current status: small active runtime follow-up lane
  - runtime JSON is not the only lagging layer here; most of the live set is
    actually structured-header lag where JSON already has the value
  - remaining runtime sample spells:
    - `bigbys-hand`
    - `bones-of-the-earth`
    - `create-undead`
    - `crown-of-stars`
    - `elemental-bane`
    - `enervation`
    - `mass-suggestion`
    - `wall-of-thorns`
- glossary gate checker:
  - canonical -> structured `Higher Levels Review`: implemented
  - structured -> json `Higher Levels Runtime Review`: implemented
- bucket state:
  - not fully resolved yet
  - canonical side is mostly source-shape residue
  - runtime side is now a small direct audit lane rather than a broad corpus
    blocker
  - this bucket also has a forward-looking model-gap question around
    `higherLevelScaling`
  - active subbuckets now in use:
    - `canonical_inline_only`
    - `prefix_only_residue`
    - `statblock_tail_residue`
    - `structured_missing_json_present`
    - `runtime_missing_structured_present`
    - `punctuation_or_formatting_residue`
    - `true_runtime_drift`

### Duration Bucket Progress Note

- canonical -> structured:
  - `17` mismatches
  - current status: active in the report, but mostly source-display residue plus a
    smaller model-gap core
  - why:
    - canonical snapshots flatten concentration into the duration line
    - the structured layer splits concentration from timed duration
    - `Until Dispelled` and `Until Dispelled or Triggered` do not round-trip cleanly
      through the current duration model
- structured -> json:
  - `17` mismatches
  - current status: active runtime follow-up lane
  - runtime JSON may still lag behind structured data for part of this bucket, but
    the residue is mixed rather than uniformly broken
  - remaining sample spells:
    - `conjure-elemental`
    - `hold-monster`
    - `hallow`
    - `leomunds-secret-chest`
    - `pyrotechnics`
    - `symbol`
    - `transport-via-plants`
- glossary gate checker:
  - canonical -> structured `Duration Review`: implemented
  - structured -> json `Structured -> JSON` subsection inside `Duration Review`:
    implemented
  - selected-spell dev refresh now returns fresh structured -> json mismatch rows
    for this bucket
- bucket state:
  - not fully resolved yet
  - canonical side is mostly boundary/source residue
  - runtime side now has a clearer subbucket map:
    - flattened concentration wording residue
    - plain wording / pluralization residue
    - accepted special-bucket normalization
    - trigger-ended persistence boundary
    - true runtime drift
  - runtime side still needs direct spell-by-spell audit before it can be called
    boundary-only or true-drift-only

### Material Component Bucket Progress Note

- canonical -> structured:
  - `11` mismatches
  - current status: small active copying/review lane
  - current reading:
    - canonical consumed-state drift
    - missing structured material note
    - narrower cost/description drift
    - wording boundary
    - alternate-source material-note shape
  - representative spells:
    - `stoneskin`
    - `raise-dead`
    - `reincarnate`
    - `summon-greater-demon`
    - `conjure-volley`
    - `swift-quiver`
- structured -> json:
  - `5` mismatches
  - current status: follow-through runtime lane after structured fixes
  - runtime JSON is still lagging behind structured data for part of this bucket
  - remaining spells:
    - `magic-mouth`
    - `melfs-acid-arrow`
    - `true-seeing`
    - `vitriolic-sphere`
    - `wall-of-ice`
  - current reading:
    - likely real runtime drift on:
      - `magic-mouth`
      - `vitriolic-sphere`
    - likely wording/model-boundary residue on:
      - `true-seeing`
      - `wall-of-ice`
    - still needs direct spell review:
      - `melfs-acid-arrow`
- glossary gate checker:
  - canonical -> structured `Material Component Review`: implemented
  - structured -> json `Material Component Runtime Review`: implemented
- bucket state:
  - not fully resolved yet
  - canonical side is now the primary execution surface for this bucket
  - runtime side is a small named implementation-review lane rather than a broad
    corpus-scale backlog

### Components Bucket Progress Note

- canonical -> structured:
  - `3` mismatches
  - current status: mostly resolved, with only a tiny residue set left
  - remaining spells:
    - `feather-fall`
    - `soul-cage`
    - `arcane-sword`
  - current reading:
    - footnote-marker residue
    - alternate-source raw component-string shape
  - working canonical-side subbuckets:
    - `footnote_marker_residue`
    - `alternate_source_shape`
    - `true_components_drift`
- structured -> json:
  - no grouped `Components` bucket currently appears in the live
    `SPELL_STRUCTURED_VS_JSON_REPORT.md`
  - current status: runtime review support exists, but this is not currently a
    broad shared-report backlog bucket
  - runtime JSON may still lag behind structured data for an individual spell, but
    that is now expected to be surfaced through the selected-spell gate checker
    rather than assumed corpus-wide
  - working runtime-side subbuckets:
    - `aligned`
    - `model_display_boundary`
    - `missing_runtime_components`
    - `missing_structured_components`
    - `real_runtime_drift`
- glossary gate checker:
  - canonical -> structured `Components Review`: implemented
  - structured -> json `Components Runtime Review`: implemented
- bucket state:
  - canonical side: boundary/source residue
  - runtime side: partial implementation lane with targeted review support, not a
    large active grouped runtime bucket

### Range/Area Bucket Progress Note

- canonical -> structured:
  - `172` mismatches
  - current status: active in the report, but mostly accepted normalization and
    source-display residue rather than broad factual geometry failure
  - policy answer: keep the structured `.md` layer explicit and granular; do not
    flatten it to match terse canonical display strings
  - follow-up direction: move toward separate geometry facts in the structured
    layer and JSON instead of treating compact `Range/Area` strings as the main
    payload
  - immediate next step: define the structured `.md` fact schema first, then
    review which of those facts the runtime JSON already houses cleanly
  - structured fact taxonomy now exists in the bucket tracker and splits the
    lane into:
    - core required facts
    - common extension facts
    - specialized mechanics-linked facts
  - a concrete structured `.md` field template now also exists in the bucket
    tracker, with minimal and extended forms plus example mappings for:
    - `Alarm`
    - `Detect Magic`
    - `Lightning Bolt`
  - the current execution queue is now spelled out in:
    - `F:\Repos\Aralia\docs\tasks\spells\range-area\SPELL_RANGE_AREA_INVENTORY.md`
  - current active work order starts with canonical snapshot repair before
    structured or runtime reshaping
  - current normalization rule: combined `Range/Area` strings are display
    derivatives, not the authoritative structured payload
  - `range.distance` is a required numeric field in spell JSON, and `0` is the
    explicit sentinel when a spell has no measured distance to store
  - latest canonical repair result:
    - the remaining confirmed self-centered icon-loss mini-queue was completed on:
      - `antilife-shell`
      - `investiture-of-ice`
      - `investiture-of-wind`
      - `prismatic-spray`
      - `thunderwave`
    - total canonical mismatches dropped from `414` to `411`
    - the self-centered canonical-side residue set dropped from `29` to `24`
    - the remaining self-centered set is no longer a missing-icon-shape queue
  - why: canonical spell pages use compact combined displays like `Self (10 ft.)`
    and `30 ft. (20 ft.)`, while the structured layer keeps cast range and effect
    geometry split out more explicitly
  - current provisional subbuckets:
    - compact canonical area size vs explicit structured shape (`36`)
    - canonical header thinner than structured geometry (`37`)
    - structured phantom `0-ft. None` area suffix (`26`)
    - self compact radius vs explicit structured shape (`23`)
    - canonical footnote area vs normalized structured shape (`20`)
    - structured missing self radius (`4`)
    - structured parser scalar artifact (`5`)
    - clear structured range drift (`4`)
    - canonical header drops secondary effect area (`4`)
    - shape-semantics boundary (`2`)
    - special-range display boundary (`2`)
    - large-footprint or ward-area gap (`2`)
    - range-origin or targeting drift (`2`)
    - plus four one-off buckets:
      - alternate-source range drift
      - structured missing `Range/Area` header
      - clear area-size drift
      - touch vs touch-area header
- structured -> json:
  - `61` mismatches
  - current status: active runtime follow-up lane
  - runtime JSON is still lagging behind structured data for this bucket on part of
    the residue set
  - remaining spells include a mix of:
    - real runtime geometry drift
    - model/display boundary
    - lower-value source-display residue
- representative runtime sample spells:
  - `aura-of-vitality`
  - `conjure-animals`
  - `crusaders-mantle`
  - `leomunds-tiny-hut`
  - `pass-without-trace`
  - `sending`
  - `skywrite`
  - `wall-of-sand`
  - `wind-wall`
- targeted risky-spell follow-through now cleared `Range/Area` runtime mismatches on:
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
- focused residuals from that reviewed sample are now outside this bucket:
  - `bones-of-the-earth` still has `Description` and `Higher Levels` drift
  - `wall-of-ice` still has `Material Component` wording drift
- current provisional runtime subbuckets:
  - self-centered emanation normalization drift (`7`)
  - structured phantom `0-ft. None` area residue (`31`)
  - distance-unit and special-range encoding split (`9`)
  - wall and constructed-shape alias drift (`10`)
  - structured scalar-area formatting residue (`5`)
  - runtime JSON missing area geometry (`4`)
  - shape-semantics boundary set (`5`)
  - structured missing `Range/Area` (`1`)
- glossary gate checker:
  - canonical -> structured `Range/Area Bucket`: implemented
  - structured -> json `Range/Area Runtime Review`: implemented
  - selected-spell dev refresh now returns fresh structured -> json mismatch rows
    for this bucket
- runtime schema groundwork:
  - explicit geometry unit fields are now supported in:
    - `src/types/spells.ts`
    - `src/systems/spells/validation/spellValidator.ts`
  - the glossary spell card and the runtime gate block now honor those unit
    fields when present instead of assuming feet
  - pilot runtime JSON backfills now exist on:
    - `alarm`
    - `detect-magic`
  - first structural backfill inventory:
    - the earlier `2026-04-07` zero-backlog note turned out to be stale
    - a fresh live audit on `2026-04-08` found `291` spells with `602` missing
      explicit geometry-unit fields
    - the follow-up corpus backfill then updated `289` spell JSON files and added
      `598` explicit unit fields
    - post-backfill validation stayed green at `459 / 459`
    - the live runtime geometry-unit audit now finds `0` positive numeric runtime
      geometry fields without explicit unit fields
- bucket state:
  - not fully resolved yet
  - canonical side is mostly boundary/source residue
  - runtime side now has a usable subbucket map
  - runtime side still needs direct spell-by-spell audit before it can be called
    boundary-only
  - explicit-unit backfill sub-lane is now genuinely complete
  - runtime JSON is therefore still lagging behind structured data for part of this
  bucket even after the pilot `alarm` / `detect-magic` fixes and the first risky-spell
  widening pass

### Sub-Classes Bucket Progress Note

- canonical -> structured:
  - `156` mismatches
  - current status: primary active execution surface for this bucket
  - current reading: mixed lane that still needs sorting into:
    - `missing_structured_subclasses`
    - `incomplete_structured_subclasses`
    - `repeated_base_canonical_entries`
    - `legacy_or_unsupported_canonical_entries`
    - `canonical_label_variant_residue`
    - `malformed_structured_subclass_field`
    - `canonical_source_shape_gap`
  - why: canonical snapshots often keep subclass/domain access in raw
    `Available For` capture, so the audit count still mixes real structured drift
    with parser/source-shape residue
- structured -> json:
  - `45` mismatches
  - current status: secondary runtime follow-through lane
  - runtime JSON is still lagging behind structured data for this bucket on a real
    named set of spells, but this lane should be worked after the canonical-side
    transfer pass reduces the noise
  - representative remaining spells:
    - `aid`
    - `alter-self`
    - `bless`
    - `chromatic-orb`
    - `compelled-duel`
    - `detect-magic`
    - `fog-cloud`
    - `purify-food-and-drink`
    - `tashas-hideous-laughter`
    - `thunderwave`
- glossary gate checker:
  - canonical -> structured `Sub-Classes Review`: implemented
  - structured -> json `Sub-Classes Runtime Review`: implemented
  - selected-spell dev refresh now has a bucket-specific runtime block for this
    lane instead of relying only on generic issue summaries
- bucket state:
  - active
  - not boundary-only yet
  - canonical side is the current priority and still needs direct subbucket sorting
    plus spell-by-spell transfer work
  - runtime side still needs direct spell-by-spell audit to separate:
    - real implementation drift
    - verification lag
    - repeated-base normalization
    - malformed structured-value cases
  - bucket-local tracker and handoff:
    - `F:\Repos\Aralia\docs\tasks\spells\sub-classes\SPELL_SUB_CLASSES_BUCKET_TRACKER.md`
    - `F:\Repos\Aralia\docs\tasks\spells\sub-classes\SPELL_SUB_CLASSES_GEMINI_HANDOVER.md`

### Classes Bucket Progress Note

- canonical -> structured:
  - `17` mismatches
  - current status: small active residue set
  - why: the live residue now splits into:
    - `12` cases where base-class access still lives only under raw
      `Available For`
    - `5` cases where `Capture Method: http` leaked into the canonical-side
      comparable class value
- structured -> json:
  - no grouped `Classes` bucket currently appears in the live
    `SPELL_STRUCTURED_VS_JSON_REPORT.md`
  - current status: mostly resolved at grouped runtime scale
  - runtime JSON is not currently lagging behind structured base-class data as a
    shared corpus bucket
- remaining spells in the canonical-side bucket are therefore:
  - a small named set rather than a broad corpus-wide class-data backlog
  - mostly `Available For` source-shape residue plus a smaller parser bug subset
  - but now small enough that direct spell-by-spell review is practical
- glossary gate checker:
  - `Classes Review`: implemented
  - current review block already states:
    - whether the structured class line matches the live spell JSON
    - whether canonical access is only stored under raw `Available For`
    - whether a real base-class correction is indicated
- bucket state:
  - canonical side: small active residue bucket
  - runtime side: mostly resolved / no grouped backlog
  - current next work is:
    - direct review of the remaining `17` spells if further closure is needed
    - canonical-side parser cleanup for the `Capture Method: http` leakage cases
    - audit clarity and policy review
    - not a broad runtime implementation pass

## Current Batch Log

- `synced + flagged`: `level-1/alarm`
- `synced`: `level-1/animal-friendship`
- `synced`: `level-1/armor-of-agathys`
- `synced + flagged`: `level-1/arms-of-hadar`
- `synced + flagged`: `level-1/bane`
- `synced + flagged`: `level-1/bless`
- `synced + flagged`: `level-1/burning-hands`
- `synced`: `level-1/charm-person`
- `synced + flagged`: `level-1/color-spray`
- `synced + flagged`: `level-1/command`
- `synced + flagged`: `level-1/chromatic-orb`
- `synced + flagged`: `level-1/command`
- `synced`: `level-1/compelled-duel`
- `synced`: `level-1/divine-favor`
- `synced + flagged`: `level-1/expeditious-retreat`
- `synced + flagged`: `level-1/disguise-self`
- `synced`: `level-1/cure-wounds`
- `synced`: `level-1/false-life`
- `synced + flagged`: `level-1/entangle`
- `synced`: `level-1/find-familiar`
- `synced`: `level-1/fog-cloud`
- `synced`: `level-1/illusory-script`
- `synced`: `level-1/heroism`
- `synced`: `level-1/healing-word`
- `synced + flagged`: `level-1/dissonant-whispers`
- `synced + flagged`: `level-1/protection-from-evil-and-good`
- `synced`: `level-1/hex`
- `synced`: `level-1/hunters-mark`
- `synced`: `level-1/inflict-wounds`
- `synced + flagged`: `level-5/rarys-telepathic-bond`
- `synced + flagged`: `level-5/hallow`
- `synced + flagged`: `level-5/insect-plague`
- `synced + flagged`: `level-5/creation`
- `synced + flagged`: `level-5/cloudkill`
- `synced + flagged`: `level-5/planar-binding`
- `synced + flagged`: `level-5/scrying`
- `synced + flagged`: `level-5/bigbys-hand`
- `synced + flagged`: `level-5/banishing-smite`
- `synced + flagged`: `level-5/commune-with-nature`
- `synced + flagged`: `level-5/mislead`
- `synced + flagged`: `level-5/animate-objects`
- `synced + flagged`: `level-5/greater-restoration`
- `synced + flagged`: `level-1/sleep`
- `synced + flagged`: `level-1/detect-evil-and-good`
- `synced + flagged`: `level-1/detect-magic`
- `synced + flagged`: `level-1/ensnaring-strike`
- `synced + flagged`: `level-1/hail-of-thorns`
- `synced + flagged`: `level-1/identify`
- `synced + flagged`: `level-1/purify-food-and-drink`
- `synced + flagged`: `level-1/tashas-hideous-laughter`
- `synced + flagged`: `level-1/thunderous-smite`
- `synced + flagged`: `level-1/thunderwave`
- `synced + flagged`: `level-1/wrathful-smite`
- `synced + flagged`: `level-1/witch-bolt`

## Level 8-9 Residue Pass

- `synced`: `level-8/illusory-dragon`
- `synced`: `level-8/mighty-fortress`
- `synced`: `level-8/mind-blank`
- `synced`: `level-9/astral-projection`
- `synced`: `level-9/foresight`
- `synced`: `level-9/imprisonment`

These files were brought back into alignment where the current structured model could house the canonical data cleanly. The remaining level-8/9 residue is now a range/area display-model issue rather than a spelling, description, or duration drift.

## Level 4-5 Residue Pass

- `synced`: `level-4/shadow-of-moil`
- `synced`: `level-5/awaken`
- `synced + flagged`: `level-5/geas`
- `synced + flagged`: `level-5/mass-cure-wounds`
- `synced + flagged`: `level-4/confusion`
- `synced + flagged`: `level-4/vitriolic-sphere`
- `synced + flagged`: `level-5/greater-restoration`

These files were advanced where the canonical snapshot could be mirrored directly in the structured markdown and JSON. The flagged items still have canonical access or display details that the current model does not house cleanly yet, so they remain visible for a separate policy pass.

## Level 4-5 Follow-Up Sync Pass

- `synced + flagged`: `level-5/dream`
- `synced + flagged`: `level-5/cloudkill`
- `synced + flagged`: `level-5/insect-plague`
- `synced + flagged`: `level-4/confusion`
- `synced + flagged`: `level-5/scrying`
- `synced + flagged`: `level-5/greater-restoration`
- `synced + flagged`: `level-5/mass-cure-wounds`

These files had their ordinary text drift reduced in the structured markdown and JSON, but they still carry display or access-policy gaps that are intentionally left visible instead of being forced into JSON as if the model already supported them.

## Verified Bands

- `level-7`: the structured-vs-canonical audit currently reports zero remaining mismatches in this band, so no additional level-7 file edits were required in this pass.
