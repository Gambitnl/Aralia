# Spell Summoned Entities Bucket Tracker

Last Updated: 2026-04-15

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

- Inventory stage: starting
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

## Remaining Work

- build the first human-pruned inventory of entity-creating spells
- decide which spells have:
  - stat-block creatures
  - object-like persistent entities
  - no stat block but still deserve a file-backed entity record
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
