# Spell Range/Area Inventory

Last Updated: 2026-04-10

## Purpose

This inventory turns the `Range/Area` bucket into concrete work queues.

It exists so follow-up work can answer:
- which spells need canonical snapshot repair
- which spells need structured `.md` reshaping
- which spells need runtime JSON follow-up
- which spells are probably boundary-only or wider model/mechanics cases

This file is a working inventory, not a final verdict ledger.

## Current Work Order

- active first queue: `Canonical Snapshot Repair Candidates`
- current practical focus:
  - repair copied canonical lines where live D&D Beyond markup clearly carries
    missing shape data through icon classes or compact area fragments
  - then reclassify each repaired spell into:
    - formatting-only residue
    - shape-semantics boundary
    - true structured drift

## Source Surfaces

- canonical -> structured:
  - `F:\Repos\Aralia\.agent\roadmap-local\spell-validation\spell-structured-vs-canonical-report.json`
  - live count: `172`
- structured -> json:
  - `F:\Repos\Aralia\.agent\roadmap-local\spell-validation\spell-structured-vs-json-report.json`
  - live count: `61`
- bucket interpretation:
  - `F:\Repos\Aralia\docs\tasks\spells\range-area\SPELL_RANGE_AREA_BUCKET_TRACKER.md`

## Inventory Categories

### 1. Canonical Snapshot Repair Candidates

Meaning:
- the copied canonical `Range/Area` line likely lost shape information or other
  spatial detail that the live D&D Beyond page carries in icons or footnote-style
  area markup
- these should be repaired on the canonical side before treating them as
  structured-data drift

Current count:
- `70` remaining heuristic candidates after the currently confirmed repair batches

Current spells:
- `abi-dalzims-horrid-wilting`
- `antimagic-field`
- `arms-of-hadar`
- `aura-of-vitality`
- `bones-of-the-earth`
- `burning-hands`
- `call-lightning`
- `circle-of-death`
- `cloudkill`
- `cloud-of-daggers`
- `color-spray`
- `cone-of-cold`
- `confusion`
- `conjure-animals`
- `conjure-celestial`
- `conjure-minor-elementals`
- `conjure-woodland-beings`
- `control-water`
- `cordon-of-arrows`
- `darkness`
- `demiplane`
- `destructive-wave`
- `detect-evil-and-good`
- `detect-magic`
- `detect-poison-and-disease`
- `detect-thoughts`
- `druid-grove`
- `erupting-earth`
- `evards-black-tentacles`
- `fear`
- `fireball`
- `flame-strike`
- `flaming-sphere`
- `forcecage`
- `globe-of-invulnerability`
- `gust-of-wind`
- `hail-of-thorns`
- `hallow`
- `hallucinatory-terrain`
- `holy-aura`
- `hunger-of-hadar`
- `hypnotic-pattern`
- `ice-knife`
- `ice-storm`
- `incendiary-cloud`
- `insect-plague`
- `maddening-darkness`
- `maelstrom`
- `magic-circle`
- `major-image`
- `mass-cure-wounds`
- `meteor-swarm`
- `mighty-fortress`
- `mirage-arcane`
- `moonbeam`
- `mordenkainens-private-sanctum`
- `move-earth`
- `otilukes-freezing-sphere`
- `passwall`
- `pass-without-trace`
- `plant-growth`
- `programmed-illusion`
- `pyrotechnics`
- `shatter`
- `silence`
- `silent-image`
- `sleet-storm`
- `speak-with-plants`
- `spike-growth`
- `spirit-guardians`
- `stinking-cloud`
- `storm-of-vengeance`
- `sunbeam`
- `sunburst`
- `symbol`
- `teleportation-circle`
- `temple-of-the-gods`
- `tidal-wave`
- `transmute-rock`
- `vitriolic-sphere`
- `watery-sphere`
- `web`
- `weird`
- `whirlwind`
- `wrath-of-nature`
- `zone-of-truth`

Current reading:
- mostly canonical-source repair
- not automatically structured drift
- latest confirmed repair batches already landed on:
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
  - `burning-hands`
  - `color-spray`
  - `cone-of-cold`
  - `fear`
  - `sunbeam`
  - `detect-magic`
  - `detect-evil-and-good`
  - `detect-poison-and-disease`
  - `antimagic-field`
- practical result so far:
  - the raw canonical-side `Range/Area` count is still `172`
  - the repaired spells are no longer mostly missing shape words
  - they now separate more cleanly into:
    - formatting-only residue
    - shape-semantics boundary
    - true structured drift
  - the remaining heuristic repair set is now `70`, down from the earlier `90`
  - latest confirmed self-centered repair batch also moved:
    - `pass-without-trace`
    - `spirit-guardians`
    - `conjure-minor-elementals`
    into formatting-only residue
  - and surfaced clearer shape-semantics boundary on:
    - `globe-of-invulnerability`
    - `holy-aura`
  - the final confirmed self-centered icon-loss mini-queue also landed on:
    - `antilife-shell`
    - `investiture-of-ice`
    - `investiture-of-wind`
    - `prismatic-spray`
    - `thunderwave`
  - the remaining self-centered canonical-side residue set is now `24`, but those
    are no longer confirmed icon-shape capture-loss cases

### 2. Structured `.md` Likely Real Drift Candidates

Meaning:
- the structured `Range/Area` facts still look actually behind the canonical source
- these are the highest-value canonical-side correction queue

Current count:
- `12`

Current spells:
- `aura-of-life`
- `aura-of-purity`
- `call-lightning`
- `circle-of-power`
- `clairvoyance`
- `cordon-of-arrows`
- `draconic-transformation`
- `dream`
- `goodberry`
- `heroes-feast`
- `skywrite`
- `word-of-recall`

Current reading:
- real structured follow-up
- some may still widen into model questions, but they should not be dismissed as
  simple boundary-only residue

### 3. Structured-Only Cleanup Candidates

Meaning:
- the structured layer is still carrying old formatting artifacts or placeholder-like
  geometry, while the runtime JSON is already closer to the intended shape

#### 3a. Phantom `0-ft. None` residue

Current count:
- `31`

Current spells:
- `arcane-gate`
- `chain-lightning`
- `conjure-fey`
- `contingency`
- `eyebite`
- `find-the-path`
- `flesh-to-stone`
- `forbiddance`
- `guards-and-wards`
- `harm`
- `heroes-feast`
- `investiture-of-flame`
- `investiture-of-ice`
- `investiture-of-stone`
- `investiture-of-wind`
- `magic-jar`
- `mental-prison`
- `mislead`
- `modify-memory`
- `negative-energy-flood`
- `ottos-irresistible-dance`
- `planar-ally`
- `planar-binding`
- `raise-dead`
- `rarys-telepathic-bond`
- `reincarnate`
- `scrying`
- `tensers-transformation`
- `transport-via-plants`
- `true-seeing`
- `wind-walk`

Current reading:
- structured `.md` cleanup
- generally low-value compared with the real-drift and runtime-lag queues

#### 3b. Scalar / parser artifact residue

Current count:
- `14`

Current spells:
- `delayed-blast-fireball`
- `fire-storm`
- `mislead`
- `modify-memory`
- `negative-energy-flood`
- `planar-binding`
- `prismatic-spray`
- `raise-dead`
- `rarys-telepathic-bond`
- `reincarnate`
- `reverse-gravity`
- `scrying`
- `storm-sphere`
- `synaptic-static`

Current reading:
- structured formatting/parser cleanup
- mostly not a runtime-mechanics blocker by itself

### 4. Structured + JSON Upgrade Candidates

Meaning:
- the structured layer is already expressing geometry that the runtime JSON still
  does not house correctly or completely
- these are the highest-value runtime follow-up queue

#### 4a. Emanation normalization drift

Current count:
- `7`

Current spells:
- `antilife-shell`
- `aura-of-vitality`
- `conjure-animals`
- `conjure-minor-elementals`
- `conjure-woodland-beings`
- `crusaders-mantle`
- `pass-without-trace`

Current reading:
- true runtime JSON lag
- runtime still stores `Sphere` where structured has already moved to `Emanation`

#### 4b. Runtime JSON missing area geometry

Current count:
- `4`

Current spells:
- `conjure-celestial`
- `ice-storm`
- `mirage-arcane`
- `whirlwind`

Current reading:
- true runtime JSON lag or model gap
- these should be reviewed before broader spell migration because the runtime layer
  is still behind the structured interpretation

### 5. Boundary / Model-Gap / Mechanics Review Set

Meaning:
- these spells are unlikely to be solved by a simple one-line sync
- they probably need explicit boundary acceptance, model widening, or mechanics
  review

Current set:
- `control-weather`
- `earthquake`
- `leomunds-tiny-hut`
- `mirage-arcane`
- `project-image`
- `sending`
- `telepathy`
- `tsunami`

Current reading:
- mixed model-gap and semantics set
- examples:
  - `leomunds-tiny-hut`: hemisphere vs sphere semantics
  - `earthquake`: circle vs sphere vocabulary
  - `tsunami`: wall vs line semantics and unit weirdness
  - `sending` / `telepathy`: `Unlimited` vs `Special`
  - `project-image`: extreme range encoding and bad runtime formatting

## Immediate Work Order

1. Canonical snapshot repair
   - continue the icon-shape and compact-area repair queue
2. Canonical-side real drift
   - review the `12` likely real structured drift spells
3. Runtime JSON lag
   - fix the `7` emanation normalization cases
   - review the `4` missing-area-geometry cases
4. Structured-only cleanup
   - clean the phantom/scalar residue after the higher-value queues above
5. Boundary/model-gap review
   - isolate the spells that need explicit policy or schema decisions

## Open Notes

- Categories intentionally overlap in a few places.
- This is a working execution inventory, not a final arbitration report.
- When a spell moves out of one queue, update both this file and the main
  `SPELL_RANGE_AREA_BUCKET_TRACKER.md` surface.
