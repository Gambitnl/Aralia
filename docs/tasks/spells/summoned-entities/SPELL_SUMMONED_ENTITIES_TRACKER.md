# Spell Summoned Entities Bucket Tracker

Last Updated: 2026-04-28

## Bucket Purpose

This tracker exists for spells that create, summon, animate, or externalize a
persisted entity-like thing that should be tracked as its own game object rather
than only as prose inside the spell description.

This bucket is not just "summon spells" in the narrow creature sense. It has to
cover:

- summoned creatures with stat blocks
- commandable objects or manifestations with their own mechanics
- spell-created entities that do not yet have a proper entity file shape

The bucket is separate from the existing Description / Range / Conditions work.
It is about whether the spell creates a durable actor or object in the world that
the codebase should model explicitly.

## Current Status

- Inventory stage: first human-pruned seed pass drafted
- Atlas deep link:
  `/Aralia/misc/spell_pipeline_atlas.html?bucket=Summoned%20Entities`
- Atlas v3 status:
  - bucket kind: `inventory`
  - `category_a_creature_statblock`: `16` seed spells
    - `3` already carry structured `SUMMONING` data
    - `4` have summon prose trapped in `UTILITY` effects
    - `9` have no structured summon effect yet
  - `category_b_object_manifestation`: `15` seed spells
  - edge-case rosters are authored as chip-only entries until file segments and
    source-of-truth comparisons are located
  - `heroes-feast` remains a `policy` edge case; Atlas v3 now treats chip-only
    policy rosters as neutral instead of as missing-segment defects
- Existing implementation seams already present:
  - `F:\Repos\Aralia\src\types\spells.ts`
    - `SummoningEffect`
    - `SummonedEntityStatBlock`
  - `F:\Repos\Aralia\src\commands\effects\SummoningCommand.ts`
  - `F:\Repos\Aralia\src\data\summonTemplates.ts`
  - `F:\Repos\Aralia\src\systems\creatures\CreatureTaxonomy.ts`
- Current reading:
  - creature summons with stat blocks already have a partial runtime model
  - object-like manifestations without stat blocks are the bigger model gap
  - only five seed spells currently use `SUMMONING` effect objects in JSON
  - the repo does not yet have a settled, file-backed entity folder tree for future
    creature / object / manifestation records

## Working Interpretation

### Category A: Creature entity with a stat block

These are spells where the summoned thing is meant to behave like a creature and
can be represented by a real stat block or summon template.

Seed examples:

- `find familiar`
- `find steed`
- `find greater steed`
- `summon beast`
- `summon lesser demons`
- `summon greater demon`
- `conjure animals`
- `conjure elemental`
- `conjure celestial`
- `conjure fey`
- `conjure woodland beings`
- `conjure minor elementals`
- `giant insect`
- `animate dead`
- `create undead`
- `infernal calling`

### Category B: Object / manifestation entity without a creature stat block

These are spell-created things that persist, move, can be commanded, or can be
interacted with, but are not clearly creature stat blocks.

Seed examples:

- `arcane eye`
- `animate objects`
- `bigby's hand`
- `flaming sphere`
- `watery sphere`
- `storm sphere`
- `spiritual weapon`
- `crown of stars`
- `blade of disaster`
- `mordenkainen's faithful hound`
- `unseen servant`
- `tiny servant`
- `tenser's floating disk`
- `arcane sword`
- `heroes' feast` as a likely adjacent model-gap case, not yet a confirmed entity

### Category C: Probably not part of this bucket

These are spells that merely alter an existing creature, place a transient area,
or otherwise do not create a durable external entity.

Examples to keep out of the bucket:

- pure damage spells
- plain area-control spells without a persistent created actor/object
- creature-targeting control spells
- transformation spells that change an existing creature but do not create a new
  entity record

## Current Inventory Notes

- The raw keyword scan across the spell corpus is intentionally broad.
- It surfaced many false positives such as normal area spells, buffs, and
  transformations that mention "create", "summon", or "object" in prose but do not
  really deserve an entity record.
- This bucket therefore needs a human-pruned inventory rather than a blind regex
  list.
- 2026-04-28 seed-file check found all 31 seed spells below in
  `public/data/spells`; no seed ID was missing from the spell JSON corpus.
- Current runtime modeling is uneven:
  - `find-familiar`, `find-steed`, `conjure-animals`, `tenser's floating disk`,
    and `unseen servant` already use `SUMMONING` effects.
  - most other confirmed seed spells are stored as `UTILITY`, `DAMAGE`,
    `HEALING`, or `STATUS_CONDITION` effects even when they create an entity-like
    actor or object.
  - this is inventory evidence only; it is not yet a decision that every listed
    spell should be migrated to `SUMMONING`.

## Human-Pruned Seed Inventory v0

This inventory is deliberately seed-scoped. It confirms the current tracker
examples against the live spell JSON, classifies their entity shape, and records
whether the existing effect model already exposes them through `SUMMONING`.

### Confirmed creature / actor entities

| Spell | Level | Current JSON effects | Current inventory reading |
| --- | ---: | --- | --- |
| `find-familiar` | 1 | `SUMMONING` | Confirmed creature entity; existing familiar templates cover part of the form list. |
| `find-steed` | 2 | `SUMMONING` | Confirmed creature entity; has structured summon effect but still needs richer steed identity/options. |
| `find-greater-steed` | 4 | `UTILITY` | Confirmed creature entity; not currently modeled as `SUMMONING`. |
| `summon-beast` | 2 | `UTILITY` | Confirmed stat-block-style summon; current JSON does not expose a summon entity effect. |
| `summon-lesser-demons` | 3 | `UTILITY` | Confirmed creature summon; needs creature-count/control details before runtime modeling. |
| `summon-greater-demon` | 4 | `UTILITY` | Confirmed creature summon; control and hostile-breakout behavior matter to the entity model. |
| `conjure-animals` | 3 | `SUMMONING` | Confirmed creature entity; already modeled as `SUMMONING`, likely still needs option-set detail. |
| `conjure-minor-elementals` | 4 | `DAMAGE` | Confirmed creature/entity summon by bucket purpose; current JSON is damage-focused. |
| `conjure-woodland-beings` | 4 | `DAMAGE` | Confirmed creature/entity summon by bucket purpose; current JSON is damage-focused. |
| `conjure-elemental` | 5 | `DAMAGE` | Confirmed creature/entity summon; current JSON does not expose the summoned elemental as an entity. |
| `conjure-fey` | 6 | `UTILITY` | Confirmed creature/entity summon; current JSON does not expose the summoned fey as an entity. |
| `conjure-celestial` | 7 | `DAMAGE`, `HEALING` | Confirmed creature/entity summon; current JSON models downstream effects, not the entity itself. |
| `giant-insect` | 4 | `UTILITY` | Confirmed actor-like transformed/summoned combatants; needs policy on "existing creature changed into entity roster" boundary. |
| `animate-dead` | 3 | `UTILITY` | Confirmed created/controlled undead entity; current JSON does not expose a summon entity effect. |
| `create-undead` | 6 | `UTILITY` | Confirmed created/controlled undead entity; current JSON does not expose a summon entity effect. |
| `infernal-calling` | 5 | `UTILITY` | Confirmed creature/entity summon; current JSON does not expose infernal entity behavior. |

### Confirmed object / manifestation entities

| Spell | Level | Current JSON effects | Current inventory reading |
| --- | ---: | --- | --- |
| `arcane-eye` | 4 | `UTILITY` | Confirmed movable sensor manifestation; needs non-creature entity shape. |
| `animate-objects` | 5 | `UTILITY` | Confirmed object actors; needs object-to-combatant conversion policy. |
| `bigbys-hand` | 5 | `UTILITY` | Confirmed commandable manifestation; likely a key schema example for object-like entities. |
| `flaming-sphere` | 2 | `DAMAGE`, `DAMAGE` | Confirmed movable hazard/object manifestation; current JSON models damage only. |
| `watery-sphere` | 4 | `STATUS_CONDITION` | Confirmed movable control manifestation; current JSON models restraint/control only. |
| `storm-sphere` | 4 | `UTILITY` | Confirmed persistent area/manifestation; entity status depends on whether movement/control is modeled as object state. |
| `spiritual-weapon` | 2 | `DAMAGE`, `DAMAGE` | Confirmed commandable weapon manifestation; current JSON models attacks only. |
| `crown-of-stars` | 7 | `DAMAGE` | Confirmed orbiting mote/resource manifestation; may be closer to persistent spell resource than world entity. |
| `blade-of-disaster` | 9 | `DAMAGE` | Confirmed commandable damaging manifestation; current JSON models damage only. |
| `mordenkainens-faithful-hound` | 4 | `DAMAGE` | Confirmed stationary/triggered guardian manifestation; needs object/guardian schema decision. |
| `unseen-servant` | 1 | `SUMMONING` | Confirmed non-creature servant entity; already uses `SUMMONING` despite weak stat-block fit. |
| `tiny-servant` | 3 | `UTILITY` | Confirmed animated object actor; current JSON does not expose a summon entity effect. |
| `tensers-floating-disk` | 1 | `SUMMONING` | Confirmed object manifestation; already uses `SUMMONING` despite non-creature stat-block gap. |
| `arcane-sword` | 7 | `UTILITY` | Confirmed commandable weapon manifestation; current JSON does not expose a summon entity effect. |

### Adjacent / policy edge cases

| Spell | Level | Current JSON effects | Current inventory reading |
| --- | ---: | --- | --- |
| `heroes-feast` | 6 | `UTILITY` | Keep as policy-adjacent for now; it creates a feast object/event but does not clearly need an actor-like entity record. |

### Current count snapshot

- Confirmed creature / actor entity seeds: `16`
- Confirmed object / manifestation entity seeds: `14`
- Adjacent policy seeds: `1`
- Seed spells already using `SUMMONING`: `5`
- Seed spells present in JSON but not currently modeled as `SUMMONING`: `26`

## Category A Runtime Shape Split

This is the active subbucket split for `category_a_creature_statblock`.
The goal is to separate "already has summon data" from "needs JSON migration"
before changing any spell files.

| Runtime state | Count | Spells | Next action |
| --- | ---: | --- | --- |
| Structured `SUMMONING` data already present | `3` | `find-familiar`, `find-steed`, `conjure-animals` | Verify that runtime execution can read the nested `effect.summon` object correctly. |
| Summon prose trapped in `UTILITY` effects | `4` | `summon-lesser-demons`, `conjure-fey`, `giant-insect`, `infernal-calling` | Migrate to structured summon behavior after the runtime shape is aligned. |
| No structured summon effect yet | `9` | `find-greater-steed`, `summon-beast`, `summon-greater-demon`, `conjure-elemental`, `conjure-celestial`, `conjure-woodland-beings`, `conjure-minor-elementals`, `animate-dead`, `create-undead` | Add structured summon effects or explicit model-gap notes after schema direction is settled. |

### Category A Model Gap

The validator schema stores summon data under `effect.summon`, but
`SummoningCommand` and part of `useSummons` still read older flat fields such as
`summonType`, `creatureId`, `count`, and `objectDescription`.

That makes immediate bulk JSON migration risky. The next implementation pass
should either:

- update summon runtime resolution to read the nested `effect.summon` object, or
- define an adapter from validator-shaped spell JSON into the older command shape.

## Proposed Folder Structure

The repo does not yet have a settled entity file tree, so this is a proposed
direction only.

Provisional shape:

- `entities/`
  - `creatures/`
  - `objects/`
  - `manifestations/`
  - `templates/`

The existing source-backed summon templates suggest the first implementation step
should stay close to the current runtime data model rather than inventing a second
parallel authoring system.

## Per-Phase Plan

### Phase 1: Inventory

Goal:
- identify the spells that truly create or summon a tracked entity-like object

Actions:
- separate creature summons from object/manifestation spells
- mark which ones already have a usable stat block or summon template
- mark which ones need a new entity file shape

### Phase 2: Model Decision

Goal:
- decide which entity kinds need first-class file-backed data

Actions:
- confirm the creature vs object vs manifestation split
- decide whether non-creature summoned objects need a dedicated entity schema
- define the folder structure once the shape is clear

### Phase 3: Integration

Goal:
- connect the bucket outcome to the existing summoning runtime surfaces

Actions:
- align the tracker with `SummoningEffect`
- reuse `SummonedEntityStatBlock` and `SUMMON_TEMPLATES` where they already fit
- identify the gaps that still need a future entity file system

## Progress Log

- 2026-04-15
  - started the new Summoned Entities bucket
  - confirmed the repo already has:
    - `SummoningEffect`
    - `SummonedEntityStatBlock`
    - `SummoningCommand`
    - `SUMMON_TEMPLATES`
    - `CreatureTaxonomy`
  - established that the new bucket is broader than "creature summons" alone and
    also needs to track object-like manifestations such as `Arcane Eye`,
    `Bigby's Hand`, and `Tenser's Floating Disk`
- 2026-04-27
  - rechecked the bucket against Atlas v2
  - confirmed existing Atlas gap coverage is sufficient; no new gap entry needed
  - updated the Atlas map to use `kind: inventory`, numeric seed counts, and
    chip-only affected-spell rosters for both main inventory categories
- 2026-04-28
  - rechecked the bucket against Atlas v3
  - confirmed no `ExecutionStep.spells` move is needed because every current
    roster already lives on a more-specific edge case
  - confirmed no `count: null` history is needed because the current inventory
    edge cases all have numeric seed counts
  - kept `heroes-feast` as the one policy edge case now covered by neutral Atlas
    diagnostics
  - drafted the first human-pruned seed inventory against the live JSON spell
    corpus
  - confirmed all 31 seed spells exist in `public/data/spells`
  - recorded that only five seed spells currently use `SUMMONING`, while the
    remaining seed spells preserve their entity behavior inside other effect
    lanes or prose-shaped utility records
- 2026-04-28
  - resumed active `category_a_creature_statblock` work after Atlas modeling
    iteration closed
  - partitioned the `16` creature/stat-block seed spells into:
    - `3` with existing structured `SUMMONING` data
    - `4` with summon prose still stored as `UTILITY`
    - `9` with no structured summon effect yet
  - found a runtime model gap: validator-shaped JSON uses nested `effect.summon`,
    while summon execution code still reads older flat summon fields

## Remaining Work

- expand the human-pruned inventory beyond the current seed list if the broad
  corpus scan finds additional true entity-creating spells
- decide which seed spells should eventually migrate to a richer entity model
  versus staying in their current effect lanes
- decide which confirmed spells have:
  - stat-block creatures
  - object-like persistent entities
  - no stat block but still deserve a file-backed entity record
- align summon runtime code with the nested `effect.summon` JSON shape before
  bulk-migrating the `UTILITY` prose and missing-effect creature spells
- decide whether the entity tree should live under a new `entities/` data root or
  stay source-backed for now

## Open Questions / Model Gaps

- Should non-creature spell manifestations get their own file schema, or should
  they remain embedded inside the spell data model?
- Should the first entity folder tree be organized by:
  - creature vs object vs manifestation
  - or by source spell family
  - or by summon runtime behavior?
- Should `Heroes' Feast` be treated as an entity bucket item at all, or as a
  nearby but separate "created world object" concept?
- Which spells are real summoned entities versus transformation or control spells
  that merely mention a creature/object in prose?

## Current Bucket Verdict

- inventory stage: active
- implementation work: yes, but the model is not fully shaped yet
- audit work: yes, the spell corpus still needs a human-pruned entity inventory
- policy review only: no
