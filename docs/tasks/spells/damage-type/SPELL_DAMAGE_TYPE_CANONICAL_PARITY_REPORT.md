# Spell Damage Type - Phase 1 Canonical vs Structured Parity Report

Generated: 2026-05-07 (`scripts/auditSpellDamageTypeCanonical.ts`).

## Summary

Scanned **459** spell markdown files.

| Classification | Count | Notes |
| --- | ---: | --- |
| `clean` | 120 | Structured token matches canonical - no action needed |
| `canonical_no_damage` | 220 | Non-damage spell - field correctly absent/empty |
| `chooser_match` | 9 | Chooser spell; option sets agree - migrate structured to typeSelection.typeOptions |
| `chooser_mismatch` | 2 | Chooser spell; option sets differ - needs review |
| `absorb_triggering` | 1 | Damage mirrors triggering event - typeResolution shape |
| `multi_effect` | 1 | Multiple distinct damage-timing effects - split DAMAGE effects |
| `random_table` | 1 | Random from table - future weighted/table subbucket |
| `structured_empty` | 80 | Structured field blank but canonical has damage tokens |
| `mismatch` | 8 | Single-token value mismatch |
| `structured_only` | 15 | Structured has value but canonical snapshot absent |
| `no_canonical_block` | 2 | No canonical block in file |

## Chooser spells (migrate to typeSelection)

These spells store a slash-glued or comma-glued string in structured `Damage Type`. They should be migrated to `Damage Type Selection: one_of` + `Damage Type Options: <list>` in the structured layer, and to `damage.typeSelection.{ kind, options }` in the runtime JSON.

| Spell | Level | Structured raw | Canonical options | Status |
| --- | ---: | --- | --- | --- |
| `chromatic-orb` | 1 | `Acid/Cold/Fire/Lightning/Poison/Thunder` | Acid, Cold, Fire, Lightning, Poison, Thunder | options agree |
| `conjure-minor-elementals` | 4 | `Acid, Cold, Fire, or Lightning` | Acid, Cold, Fire, Lightning | options agree |
| `destructive-wave` | 5 | `Thunder` | Thunder, Radiant, Necrotic | **MISMATCH** |
| `dragons-breath` | 2 | `Acid/Cold/Fire/Lightning/Poison` | Acid, Cold, Fire, Lightning, Poison | options agree |
| `elemental-weapon` | 3 | `Acid/Cold/Fire/Lightning/Thunder` | Acid, Cold, Fire, Lightning, Thunder | options agree |
| `fire-shield` | 4 | `Fire or Cold` | Cold, Fire | options agree |
| `forbiddance` | 6 | `Radiant` | Radiant, Necrotic | **MISMATCH** |
| `glyph-of-warding` | 3 | `Acid/Cold/Fire/Lightning/Thunder` | Acid, Cold, Fire, Lightning, Thunder | options agree |
| `illusory-dragon` | 8 | `acid, cold, fire, lightning, necrotic, or poison` | Acid, Cold, Fire, Lightning, Necrotic, Poison | options agree |
| `life-transference` | 3 | `Necrotic` | Necrotic | options agree |
| `spirit-guardians` | 3 | `Radiant/Necrotic` | Necrotic, Radiant | options agree |

## Special cases

### Damage mirrors triggering event - typeResolution shape

- **`absorb-elements`** (level 1) - Damage type follows triggering event; typeResolution shape.

### Multiple distinct damage-timing effects - split DAMAGE effects

- **`hunger-of-hadar`** (level 3) - Multiple distinct DAMAGE effect timings; split into multiple DAMAGE effects at runtime.

### Random from table - future weighted/table subbucket

- **`prismatic-spray`** (level 7) - Random from d8 table; not a caster-choice one_of - future weighted/table subbucket.

## Needs attention - mismatches and empties

| Spell | Level | matchKind | Structured | Canonical | Note |
| --- | ---: | --- | --- | --- | --- |
| `alter-self` | 2 | `structured_empty` | `(blank)` | Bludgeoning, Piercing, Slashing | Structured Damage Type field is absent or blank; canonical has damage tokens. |
| `animate-objects` | 5 | `structured_empty` | `(blank)` | Force, Poison, Psychic | Structured Damage Type field is absent or blank; canonical has damage tokens. |
| `arcane-vigor` | 2 | `structured_empty` | `Healing` | Force | Could not resolve canonical token from Rules Text or Damage/Effect line. |
| `aura-of-life` | 4 | `structured_empty` | `(blank)` | Necrotic | Structured Damage Type field is absent or blank; canonical has damage tokens. |
| `aura-of-purity` | 4 | `structured_empty` | `(blank)` | Poison | Structured Damage Type field is absent or blank; canonical has damage tokens. |
| `banishing-smite` | 5 | `structured_empty` | `(blank)` | Force | Structured Damage Type field is absent or blank; canonical has damage tokens. |
| `bigbys-hand` | 5 | `structured_empty` | `(blank)` | Bludgeoning, Force | Structured Damage Type field is absent or blank; canonical has damage tokens. |
| `blade-barrier` | 6 | `mismatch` | `Slashing` | Force | Structured: "Slashing" | Canonical: "Force" |
| `conjure-animals` | 3 | `mismatch` | `Slashing` | Force, Slashing | Structured: "Slashing" | Canonical: "Force" |
| `conjure-barrage` | 3 | `structured_empty` | `weapon_damage_type` | Force | Could not resolve canonical token from Rules Text or Damage/Effect line. |
| `conjure-elemental` | 5 | `structured_empty` | `variable` | Cold, Fire, Force, Lightning, Thunder | Could not resolve canonical token from Rules Text or Damage/Effect line. |
| `conjure-fey` | 6 | `structured_empty` | `(blank)` | Psychic | Structured Damage Type field is absent or blank; canonical has damage tokens. |
| `conjure-volley` | 5 | `structured_empty` | `(blank)` | Fire | Structured Damage Type field is absent or blank; canonical has damage tokens. |
| `contact-other-plane` | 5 | `structured_empty` | `(blank)` | Psychic | Structured Damage Type field is absent or blank; canonical has damage tokens. |
| `control-water` | 4 | `structured_empty` | `(blank)` | Bludgeoning | Structured Damage Type field is absent or blank; canonical has damage tokens. |
| `create-homunculus` | 6 | `structured_empty` | `(blank)` | Piercing | Structured Damage Type field is absent or blank; canonical has damage tokens. |
| `detect-poison-and-disease` | 1 | `structured_empty` | `(blank)` | Poison | Structured Damage Type field is absent or blank; canonical has damage tokens. |
| `dimension-door` | 4 | `structured_empty` | `(blank)` | Force | Structured Damage Type field is absent or blank; canonical has damage tokens. |
| `dream` | 5 | `structured_empty` | `(blank)` | Psychic | Structured Damage Type field is absent or blank; canonical has damage tokens. |
| `druidcraft` | 0 | `structured_empty` | `(blank)` | Fire | Structured Damage Type field is absent or blank; canonical has damage tokens. |
| `earthquake` | 8 | `structured_empty` | `(blank)` | Bludgeoning | Structured Damage Type field is absent or blank; canonical has damage tokens. |
| `elemental-bane` | 4 | `structured_empty` | `(blank)` | Acid, Cold, Fire, Lightning, Thunder | Structured Damage Type field is absent or blank; canonical has damage tokens. |
| `elementalism` | 0 | `structured_empty` | `(blank)` | Fire | Structured Damage Type field is absent or blank; canonical has damage tokens. |
| `enemies-abound` | 3 | `structured_empty` | `(blank)` | Force | Structured Damage Type field is absent or blank; canonical has damage tokens. |
| `etherealness` | 7 | `structured_empty` | `(blank)` | Force | Structured Damage Type field is absent or blank; canonical has damage tokens. |
| `feign-death` | 3 | `structured_empty` | `(blank)` | Psychic | Structured Damage Type field is absent or blank; canonical has damage tokens. |
| `find-steed` | 2 | `structured_empty` | `(blank)` | Necrotic, Psychic, Radiant | Structured Damage Type field is absent or blank; canonical has damage tokens. |
| `forcecage` | 7 | `structured_empty` | `(blank)` | Force | Structured Damage Type field is absent or blank; canonical has damage tokens. |
| `friends` | 0 | `structured_empty` | `(blank)` | Force | Structured Damage Type field is absent or blank; canonical has damage tokens. |
| `gaseous-form` | 3 | `structured_empty` | `(blank)` | Bludgeoning, Piercing, Slashing | Structured Damage Type field is absent or blank; canonical has damage tokens. |
| `geas` | 5 | `structured_empty` | `(blank)` | Psychic | Structured Damage Type field is absent or blank; canonical has damage tokens. |
| `giant-insect` | 4 | `structured_empty` | `(blank)` | Bludgeoning, Piercing, Poison | Structured Damage Type field is absent or blank; canonical has damage tokens. |
| `hallow` | 5 | `structured_empty` | `(blank)` | ? | Structured Damage Type field is absent or blank; canonical has damage tokens. |
| `heroes-feast` | 6 | `structured_empty` | `(blank)` | Poison | Structured Damage Type field is absent or blank; canonical has damage tokens. |
| `holy-weapon` | 5 | `structured_empty` | `(blank)` | Radiant | Structured Damage Type field is absent or blank; canonical has damage tokens. |
| `ice-knife` | 1 | `structured_empty` | `(blank)` | Cold, Piercing | Structured Damage Type field is absent or blank; canonical has damage tokens. |
| `imprisonment` | 9 | `structured_empty` | `(blank)` | Force | Structured Damage Type field is absent or blank; canonical has damage tokens. |
| `intellect-fortress` | 3 | `structured_empty` | `(blank)` | Psychic | Structured Damage Type field is absent or blank; canonical has damage tokens. |
| `investiture-of-flame` | 6 | `mismatch` | `Fire` | Cold, Fire | Structured: "Fire" | Canonical: "Cold" |
| `investiture-of-stone` | 6 | `structured_empty` | `(blank)` | Bludgeoning, Piercing, Slashing | Structured Damage Type field is absent or blank; canonical has damage tokens. |
| `lightning-lure` | 0 | `structured_empty` | `(blank)` | Lightning | Structured Damage Type field is absent or blank; canonical has damage tokens. |
| `magic-stone` | 0 | `structured_empty` | `(blank)` | Bludgeoning | Structured Damage Type field is absent or blank; canonical has damage tokens. |
| `meld-into-stone` | 3 | `structured_empty` | `(blank)` | Force | Structured Damage Type field is absent or blank; canonical has damage tokens. |
| `mental-prison` | 6 | `mismatch` | `Psychic` | Fire, Psychic | Structured: "Psychic" | Canonical: "Fire" |
| `meteor-swarm` | 9 | `mismatch` | `Fire` | Bludgeoning, Fire | Structured: "Fire" | Canonical: "Bludgeoning" |
| `mighty-fortress` | 8 | `structured_empty` | `(blank)` | Poison, Psychic | Structured Damage Type field is absent or blank; canonical has damage tokens. |
| `mind-blank` | 8 | `structured_empty` | `(blank)` | Psychic | Structured Damage Type field is absent or blank; canonical has damage tokens. |
| `modify-memory` | 5 | `structured_empty` | `- **Description**: You attempt to reshape another creature's memories. One creature that you can see must make a Wisdom saving throw. If you are fighting the creature, it has advantage on the saving throw. On a failed save, the target becomes charmed by you for the duration. The charmed target is incapacitated and unaware of its surroundings, though it can still hear you. If it takes any damage or is targeted by another spell, this spell ends, and none of the target's memories are modified. While this charm lasts, you can affect the target's memory of an event that it experienced within the last 24 hours and that lasted no more than 10 minutes. You can permanently eliminate all memory of the event, allow the target to recall the event with perfect clarity and exacting detail, change its memory of the details of the event, or create a memory of some other event. You must speak to the target to describe how its memories are affected, and it must be able to understand your language for the modified memories to take root. Its mind fills in any gaps in the details of your description. If the spell ends before you have finished describing the modified memories, the creature's memory isn't altered. Otherwise, the modified memories take hold when the spell ends. A modified memory doesn't necessarily affect how a creature behaves, particularly if the memory contradicts the creature's natural inclinations, alignment, or beliefs. An illogical modified memory, such as implanting a memory of how much the creature enjoyed dousing itself in acid, is dismissed, perhaps as a bad dream. The GM might deem a modified memory too nonsensical to affect a creature in a significant manner. A remove curse or greater restoration spell cast on the target restores the creature's true memory.` | Acid | Could not resolve canonical token from Rules Text or Damage/Effect line. |
| `mold-earth` | 0 | `structured_empty` | `(blank)` | Force | Structured Damage Type field is absent or blank; canonical has damage tokens. |
| `plane-shift` | 7 | `structured_empty` | `(blank)` | Fire | Structured Damage Type field is absent or blank; canonical has damage tokens. |
| `power-word-kill` | 9 | `structured_empty` | `(blank)` | Psychic | Structured Damage Type field is absent or blank; canonical has damage tokens. |
| `prestidigitation` | 0 | `structured_empty` | `(blank)` | Fire | Structured Damage Type field is absent or blank; canonical has damage tokens. |
| `primordial-ward` | 6 | `structured_empty` | `(blank)` | Acid, Cold, Fire, Lightning, Thunder | Structured Damage Type field is absent or blank; canonical has damage tokens. |
| `produce-flame` | 0 | `structured_empty` | `(blank)` | Fire | Structured Damage Type field is absent or blank; canonical has damage tokens. |
| `protection-from-energy` | 3 | `structured_empty` | `(blank)` | Acid, Cold, Fire, Lightning, Thunder | Structured Damage Type field is absent or blank; canonical has damage tokens. |
| `protection-from-poison` | 2 | `structured_empty` | `(blank)` | Poison | Structured Damage Type field is absent or blank; canonical has damage tokens. |
| `purify-food-and-drink` | 1 | `structured_empty` | `(blank)` | Poison | Structured Damage Type field is absent or blank; canonical has damage tokens. |
| `pyrotechnics` | 2 | `structured_empty` | `(blank)` | Fire | Structured Damage Type field is absent or blank; canonical has damage tokens. |
| `resistance` | 0 | `structured_empty` | `(blank)` | Acid, Bludgeoning, Cold, Fire, Lightning, Necrotic, Piercing, Poison, Radiant, Slashing, Thunder | Structured Damage Type field is absent or blank; canonical has damage tokens. |
| `shadow-of-moil` | 4 | `structured_empty` | `(blank)` | Necrotic, Radiant | Structured Damage Type field is absent or blank; canonical has damage tokens. |
| `shape-water` | 0 | `structured_empty` | `(blank)` | Force | Structured Damage Type field is absent or blank; canonical has damage tokens. |
| `shield` | 1 | `structured_empty` | `(blank)` | Force | Structured Damage Type field is absent or blank; canonical has damage tokens. |
| `shillelagh` | 0 | `structured_empty` | `(blank)` | Force | Structured Damage Type field is absent or blank; canonical has damage tokens. |
| `sickening-radiance` | 4 | `structured_empty` | `(blank)` | Radiant | Structured Damage Type field is absent or blank; canonical has damage tokens. |
| `silence` | 2 | `structured_empty` | `(blank)` | Thunder | Structured Damage Type field is absent or blank; canonical has damage tokens. |
| `staggering-smite` | 4 | `structured_empty` | `(blank)` | Psychic | Structured Damage Type field is absent or blank; canonical has damage tokens. |
| `stoneskin` | 4 | `structured_empty` | `(blank)` | Bludgeoning, Piercing, Slashing | Structured Damage Type field is absent or blank; canonical has damage tokens. |
| `storm-of-vengeance` | 9 | `mismatch` | `Thunder` | Acid, Bludgeoning, Cold, Lightning, Thunder | Structured: "Thunder" | Canonical: "Acid" |
| `storm-sphere` | 4 | `structured_empty` | `(blank)` | Bludgeoning, Lightning | Structured Damage Type field is absent or blank; canonical has damage tokens. |
| `summon-beast` | 2 | `structured_empty` | `(blank)` | Piercing | Structured Damage Type field is absent or blank; canonical has damage tokens. |
| `teleport` | 7 | `structured_empty` | `(blank)` | Force | Structured Damage Type field is absent or blank; canonical has damage tokens. |
| `temple-of-the-gods` | 7 | `structured_empty` | `(blank)` | Force | Structured Damage Type field is absent or blank; canonical has damage tokens. |
| `tensers-floating-disk` | 1 | `structured_empty` | `(blank)` | Force | Structured Damage Type field is absent or blank; canonical has damage tokens. |
| `tensers-transformation` | 6 | `structured_empty` | `(blank)` | Force | Structured Damage Type field is absent or blank; canonical has damage tokens. |
| `thaumaturgy` | 0 | `structured_empty` | `(blank)` | Fire, Thunder | Structured Damage Type field is absent or blank; canonical has damage tokens. |
| `true-resurrection` | 9 | `structured_empty` | `(blank)` | Poison | Structured Damage Type field is absent or blank; canonical has damage tokens. |
| `true-strike` | 0 | `structured_empty` | `(blank)` | Radiant | Structured Damage Type field is absent or blank; canonical has damage tokens. |
| `unseen-servant` | 1 | `structured_empty` | `(blank)` | Force | Structured Damage Type field is absent or blank; canonical has damage tokens. |
| `vampiric-touch` | 3 | `mismatch` | `Necrotic` | Force, Necrotic | Structured: "Necrotic" | Canonical: "Force" |
| `vitriolic-sphere` | 4 | `structured_empty` | `(blank)` | Acid | Structured Damage Type field is absent or blank; canonical has damage tokens. |
| `wall-of-force` | 5 | `structured_empty` | `(blank)` | Force | Structured Damage Type field is absent or blank; canonical has damage tokens. |
| `wall-of-stone` | 5 | `structured_empty` | `(blank)` | Poison, Psychic | Structured Damage Type field is absent or blank; canonical has damage tokens. |
| `wall-of-water` | 3 | `structured_empty` | `(blank)` | Cold, Fire | Structured Damage Type field is absent or blank; canonical has damage tokens. |
| `water-walk` | 3 | `structured_empty` | `(blank)` | Acid | Structured Damage Type field is absent or blank; canonical has damage tokens. |
| `web` | 2 | `structured_empty` | `(blank)` | Fire | Structured Damage Type field is absent or blank; canonical has damage tokens. |
| `wind-walk` | 6 | `structured_empty` | `(blank)` | Bludgeoning, Piercing, Slashing | Structured Damage Type field is absent or blank; canonical has damage tokens. |
| `wish` | 9 | `structured_empty` | `(blank)` | Force, Necrotic | Structured Damage Type field is absent or blank; canonical has damage tokens. |
| `wrath-of-nature` | 5 | `mismatch` | `Slashing` | Bludgeoning, Slashing | Structured: "Slashing" | Canonical: "Bludgeoning" |

## Structured-only (no canonical block)

- `aid` - Canonical prose shows no damage type; structured has a value - may be derived / summon damage.
- `alarm` - Canonical prose shows no damage type; structured has a value - may be derived / summon damage.
- `aura-of-vitality` - Canonical prose shows no damage type; structured has a value - may be derived / summon damage.
- `blade-of-disaster` - Canonical snapshot absent; cannot compare.
- `cure-wounds` - Canonical prose shows no damage type; structured has a value - may be derived / summon damage.
- `galders-speedy-courier` - No canonical block and no structured value.
- `galders-tower` - No canonical block and no structured value.
- `mass-cure-wounds` - Canonical prose shows no damage type; structured has a value - may be derived / summon damage.
- `mass-healing-word` - Canonical prose shows no damage type; structured has a value - may be derived / summon damage.
- `mislead` - Canonical prose shows no damage type; structured has a value - may be derived / summon damage.
- `passwall` - Canonical prose shows no damage type; structured has a value - may be derived / summon damage.
- `planar-binding` - Canonical prose shows no damage type; structured has a value - may be derived / summon damage.
- `prayer-of-healing` - Canonical prose shows no damage type; structured has a value - may be derived / summon damage.
- `raise-dead` - Canonical prose shows no damage type; structured has a value - may be derived / summon damage.
- `rarys-telepathic-bond` - Canonical prose shows no damage type; structured has a value - may be derived / summon damage.
- `reincarnate` - Canonical prose shows no damage type; structured has a value - may be derived / summon damage.
- `scrying` - Canonical prose shows no damage type; structured has a value - may be derived / summon damage.

<details>
<summary>Full record list (all spells)</summary>

| Spell | Lv | matchKind | Structured | Canonical options |
| --- | ---: | --- | --- | --- |
| `abi-dalzims-horrid-wilting` | 8 | `clean` | `Necrotic` | Necrotic |
| `absorb-elements` | 1 | `absorb_triggering` | `(blank)` | - |
| `acid-splash` | 0 | `clean` | `Acid` | Acid |
| `aid` | 2 | `structured_only` | `Healing` | - |
| `alarm` | 1 | `structured_only` | `None` | - |
| `alter-self` | 2 | `structured_empty` | `(blank)` | Bludgeoning, Piercing, Slashing |
| `animal-friendship` | 1 | `canonical_no_damage` | `(blank)` | - |
| `animal-messenger` | 2 | `canonical_no_damage` | `(blank)` | - |
| `animal-shapes` | 8 | `canonical_no_damage` | `(blank)` | - |
| `animate-dead` | 3 | `canonical_no_damage` | `(blank)` | - |
| `animate-objects` | 5 | `structured_empty` | `(blank)` | Force, Poison, Psychic |
| `antilife-shell` | 5 | `canonical_no_damage` | `(blank)` | - |
| `antimagic-field` | 8 | `canonical_no_damage` | `(blank)` | - |
| `antipathy-sympathy` | 8 | `canonical_no_damage` | `(blank)` | - |
| `arcane-eye` | 4 | `canonical_no_damage` | `(blank)` | - |
| `arcane-gate` | 6 | `canonical_no_damage` | `(blank)` | - |
| `arcane-lock` | 2 | `canonical_no_damage` | `(blank)` | - |
| `arcane-sword` | 7 | `clean` | `Force` | Force |
| `arcane-vigor` | 2 | `structured_empty` | `Healing` | Force |
| `armor-of-agathys` | 1 | `clean` | `Cold` | Cold |
| `arms-of-hadar` | 1 | `clean` | `Necrotic` | Necrotic |
| `astral-projection` | 9 | `canonical_no_damage` | `(blank)` | - |
| `augury` | 2 | `canonical_no_damage` | `(blank)` | - |
| `aura-of-life` | 4 | `structured_empty` | `(blank)` | Necrotic |
| `aura-of-purity` | 4 | `structured_empty` | `(blank)` | Poison |
| `aura-of-vitality` | 3 | `structured_only` | `Healing` | - |
| `awaken` | 5 | `canonical_no_damage` | `(blank)` | - |
| `bane` | 1 | `canonical_no_damage` | `(blank)` | - |
| `banishing-smite` | 5 | `structured_empty` | `(blank)` | Force |
| `banishment` | 4 | `canonical_no_damage` | `(blank)` | - |
| `barkskin` | 2 | `canonical_no_damage` | `(blank)` | - |
| `beacon-of-hope` | 3 | `canonical_no_damage` | `(blank)` | - |
| `beast-sense` | 2 | `canonical_no_damage` | `(blank)` | - |
| `bestow-curse` | 3 | `canonical_no_damage` | `(blank)` | - |
| `bigbys-hand` | 5 | `structured_empty` | `(blank)` | Bludgeoning, Force |
| `blade-barrier` | 6 | `mismatch` | `Slashing` | Force |
| `blade-of-disaster` | 9 | `structured_only` | `Force` | - |
| `blade-ward` | 0 | `canonical_no_damage` | `(blank)` | - |
| `bless` | 1 | `canonical_no_damage` | `(blank)` | - |
| `blight` | 4 | `clean` | `Necrotic` | Necrotic |
| `blinding-smite` | 3 | `clean` | `Radiant` | Radiant |
| `blindness-deafness` | 2 | `canonical_no_damage` | `(blank)` | - |
| `blink` | 3 | `canonical_no_damage` | `(blank)` | - |
| `blur` | 2 | `canonical_no_damage` | `(blank)` | - |
| `bones-of-the-earth` | 6 | `clean` | `Bludgeoning` | Bludgeoning |
| `booming-blade` | 0 | `clean` | `Thunder` | Thunder |
| `burning-hands` | 1 | `clean` | `Fire` | Fire |
| `call-lightning` | 3 | `clean` | `Lightning` | Lightning |
| `calm-emotions` | 2 | `canonical_no_damage` | `(blank)` | - |
| `catapult` | 1 | `clean` | `Bludgeoning` | Bludgeoning |
| `catnap` | 3 | `canonical_no_damage` | `(blank)` | - |
| `chain-lightning` | 6 | `clean` | `Lightning` | Lightning |
| `charm-monster` | 4 | `canonical_no_damage` | `(blank)` | - |
| `charm-person` | 1 | `canonical_no_damage` | `(blank)` | - |
| `chill-touch` | 0 | `clean` | `Necrotic` | Necrotic |
| `chromatic-orb` | 1 | `chooser_match` | `Acid/Cold/Fire/Lightning/Poison/Thunder` | Acid, Cold, Fire, Lightning, Poison, Thunder |
| `circle-of-death` | 6 | `clean` | `Necrotic` | Necrotic |
| `circle-of-power` | 5 | `canonical_no_damage` | `(blank)` | - |
| `clairvoyance` | 3 | `canonical_no_damage` | `(blank)` | - |
| `clone` | 8 | `canonical_no_damage` | `(blank)` | - |
| `cloud-of-daggers` | 2 | `clean` | `Slashing` | Slashing |
| `cloudkill` | 5 | `clean` | `Poison` | Poison |
| `color-spray` | 1 | `canonical_no_damage` | `(blank)` | - |
| `command` | 1 | `canonical_no_damage` | `(blank)` | - |
| `commune` | 5 | `canonical_no_damage` | `(blank)` | - |
| `commune-with-nature` | 5 | `canonical_no_damage` | `(blank)` | - |
| `compelled-duel` | 1 | `canonical_no_damage` | `(blank)` | - |
| `comprehend-languages` | 1 | `canonical_no_damage` | `(blank)` | - |
| `compulsion` | 4 | `canonical_no_damage` | `(blank)` | - |
| `cone-of-cold` | 5 | `clean` | `Cold` | Cold |
| `confusion` | 4 | `canonical_no_damage` | `(blank)` | - |
| `conjure-animals` | 3 | `mismatch` | `Slashing` | Force, Slashing |
| `conjure-barrage` | 3 | `structured_empty` | `weapon_damage_type` | Force |
| `conjure-celestial` | 7 | `clean` | `Radiant` | Radiant |
| `conjure-elemental` | 5 | `structured_empty` | `variable` | Cold, Fire, Force, Lightning, Thunder |
| `conjure-fey` | 6 | `structured_empty` | `(blank)` | Psychic |
| `conjure-minor-elementals` | 4 | `chooser_match` | `Acid, Cold, Fire, or Lightning` | Acid, Cold, Fire, Lightning |
| `conjure-volley` | 5 | `structured_empty` | `(blank)` | Fire |
| `conjure-woodland-beings` | 4 | `clean` | `Force` | Force |
| `contact-other-plane` | 5 | `structured_empty` | `(blank)` | Psychic |
| `contagion` | 5 | `clean` | `Necrotic` | Necrotic |
| `contingency` | 6 | `canonical_no_damage` | `(blank)` | - |
| `continual-flame` | 2 | `canonical_no_damage` | `(blank)` | - |
| `control-water` | 4 | `structured_empty` | `(blank)` | Bludgeoning |
| `control-weather` | 8 | `canonical_no_damage` | `(blank)` | - |
| `control-winds` | 5 | `canonical_no_damage` | `(blank)` | - |
| `cordon-of-arrows` | 2 | `clean` | `Piercing` | Piercing |
| `counterspell` | 3 | `canonical_no_damage` | `(blank)` | - |
| `create-bonfire` | 0 | `clean` | `Fire` | Fire |
| `create-food-and-water` | 3 | `canonical_no_damage` | `(blank)` | - |
| `create-homunculus` | 6 | `structured_empty` | `(blank)` | Piercing |
| `create-or-destroy-water` | 1 | `canonical_no_damage` | `(blank)` | - |
| `create-undead` | 6 | `canonical_no_damage` | `(blank)` | - |
| `creation` | 5 | `canonical_no_damage` | `(blank)` | - |
| `crown-of-madness` | 2 | `canonical_no_damage` | `(blank)` | - |
| `crown-of-stars` | 7 | `clean` | `Radiant` | Radiant |
| `crusaders-mantle` | 3 | `clean` | `Radiant` | Radiant |
| `cure-wounds` | 1 | `structured_only` | `Healing` | - |
| `dancing-lights` | 0 | `canonical_no_damage` | `(blank)` | - |
| `danse-macabre` | 5 | `canonical_no_damage` | `(blank)` | - |
| `darkness` | 2 | `canonical_no_damage` | `(blank)` | - |
| `darkvision` | 2 | `canonical_no_damage` | `(blank)` | - |
| `dawn` | 5 | `clean` | `Radiant` | Radiant |
| `daylight` | 3 | `canonical_no_damage` | `(blank)` | - |
| `death-ward` | 4 | `canonical_no_damage` | `(blank)` | - |
| `delayed-blast-fireball` | 7 | `clean` | `Fire` | Fire |
| `demiplane` | 8 | `canonical_no_damage` | `(blank)` | - |
| `destructive-wave` | 5 | `chooser_mismatch` | `Thunder` | Thunder, Radiant, Necrotic |
| `detect-evil-and-good` | 1 | `canonical_no_damage` | `(blank)` | - |
| `detect-magic` | 1 | `canonical_no_damage` | `(blank)` | - |
| `detect-poison-and-disease` | 1 | `structured_empty` | `(blank)` | Poison |
| `detect-thoughts` | 2 | `canonical_no_damage` | `(blank)` | - |
| `dimension-door` | 4 | `structured_empty` | `(blank)` | Force |
| `disguise-self` | 1 | `canonical_no_damage` | `(blank)` | - |
| `disintegrate` | 6 | `clean` | `Force` | Force |
| `dispel-evil-and-good` | 5 | `canonical_no_damage` | `(blank)` | - |
| `dispel-magic` | 3 | `canonical_no_damage` | `(blank)` | - |
| `dissonant-whispers` | 1 | `clean` | `Psychic` | Psychic |
| `divination` | 4 | `canonical_no_damage` | `(blank)` | - |
| `divine-favor` | 1 | `clean` | `Radiant` | Radiant |
| `divine-smite` | 1 | `clean` | `Radiant` | Radiant |
| `divine-word` | 7 | `canonical_no_damage` | `(blank)` | - |
| `dominate-beast` | 4 | `canonical_no_damage` | `(blank)` | - |
| `dominate-monster` | 8 | `canonical_no_damage` | `(blank)` | - |
| `dominate-person` | 5 | `canonical_no_damage` | `(blank)` | - |
| `draconic-transformation` | 7 | `clean` | `Force` | Force |
| `dragons-breath` | 2 | `chooser_match` | `Acid/Cold/Fire/Lightning/Poison` | Acid, Cold, Fire, Lightning, Poison |
| `drawmijs-instant-summons` | 6 | `canonical_no_damage` | `(blank)` | - |
| `dream` | 5 | `structured_empty` | `(blank)` | Psychic |
| `dream-of-the-blue-veil` | 7 | `canonical_no_damage` | `(blank)` | - |
| `druid-grove` | 6 | `canonical_no_damage` | `(blank)` | - |
| `druidcraft` | 0 | `structured_empty` | `(blank)` | Fire |
| `earthquake` | 8 | `structured_empty` | `(blank)` | Bludgeoning |
| `eldritch-blast` | 0 | `clean` | `Force` | Force |
| `elemental-bane` | 4 | `structured_empty` | `(blank)` | Acid, Cold, Fire, Lightning, Thunder |
| `elemental-weapon` | 3 | `chooser_match` | `Acid/Cold/Fire/Lightning/Thunder` | Acid, Cold, Fire, Lightning, Thunder |
| `elementalism` | 0 | `structured_empty` | `(blank)` | Fire |
| `enemies-abound` | 3 | `structured_empty` | `(blank)` | Force |
| `enervation` | 5 | `clean` | `Necrotic` | Necrotic |
| `enhance-ability` | 2 | `canonical_no_damage` | `(blank)` | - |
| `enlarge-reduce` | 2 | `canonical_no_damage` | `(blank)` | - |
| `ensnaring-strike` | 1 | `clean` | `Piercing` | Piercing |
| `entangle` | 1 | `canonical_no_damage` | `(blank)` | - |
| `enthrall` | 2 | `canonical_no_damage` | `(blank)` | - |
| `erupting-earth` | 3 | `clean` | `Bludgeoning` | Bludgeoning |
| `etherealness` | 7 | `structured_empty` | `(blank)` | Force |
| `evards-black-tentacles` | 4 | `clean` | `Bludgeoning` | Bludgeoning |
| `expeditious-retreat` | 1 | `canonical_no_damage` | `(blank)` | - |
| `eyebite` | 6 | `canonical_no_damage` | `(blank)` | - |
| `fabricate` | 4 | `canonical_no_damage` | `(blank)` | - |
| `faerie-fire` | 1 | `canonical_no_damage` | `(blank)` | - |
| `false-life` | 1 | `canonical_no_damage` | `(blank)` | - |
| `far-step` | 5 | `canonical_no_damage` | `(blank)` | - |
| `fast-friends` | 3 | `canonical_no_damage` | `(blank)` | - |
| `fear` | 3 | `canonical_no_damage` | `(blank)` | - |
| `feather-fall` | 1 | `canonical_no_damage` | `(blank)` | - |
| `feeblemind` | 8 | `clean` | `Psychic` | Psychic |
| `feign-death` | 3 | `structured_empty` | `(blank)` | Psychic |
| `find-familiar` | 1 | `canonical_no_damage` | `(blank)` | - |
| `find-greater-steed` | 4 | `canonical_no_damage` | `(blank)` | - |
| `find-steed` | 2 | `structured_empty` | `(blank)` | Necrotic, Psychic, Radiant |
| `find-the-path` | 6 | `canonical_no_damage` | `(blank)` | - |
| `find-traps` | 2 | `canonical_no_damage` | `(blank)` | - |
| `finger-of-death` | 7 | `clean` | `Necrotic` | Necrotic |
| `fire-bolt` | 0 | `clean` | `Fire` | Fire |
| `fire-shield` | 4 | `chooser_match` | `Fire or Cold` | Cold, Fire |
| `fire-storm` | 7 | `clean` | `Fire` | Fire |
| `fireball` | 3 | `clean` | `Fire` | Fire |
| `flame-arrows` | 3 | `clean` | `Fire` | Fire |
| `flame-blade` | 2 | `clean` | `Fire` | Fire |
| `flame-strike` | 5 | `clean` | `Fire` | Fire, Radiant |
| `flaming-sphere` | 2 | `clean` | `Fire` | Fire |
| `flesh-to-stone` | 6 | `canonical_no_damage` | `(blank)` | - |
| `fly` | 3 | `canonical_no_damage` | `(blank)` | - |
| `fog-cloud` | 1 | `canonical_no_damage` | `(blank)` | - |
| `forbiddance` | 6 | `chooser_mismatch` | `Radiant` | Radiant, Necrotic |
| `forcecage` | 7 | `structured_empty` | `(blank)` | Force |
| `foresight` | 9 | `canonical_no_damage` | `(blank)` | - |
| `freedom-of-movement` | 4 | `canonical_no_damage` | `(blank)` | - |
| `friends` | 0 | `structured_empty` | `(blank)` | Force |
| `frostbite` | 0 | `clean` | `Cold` | Cold |
| `galders-speedy-courier` | 4 | `no_canonical_block` | `(blank)` | - |
| `galders-tower` | 3 | `no_canonical_block` | `(blank)` | - |
| `gaseous-form` | 3 | `structured_empty` | `(blank)` | Bludgeoning, Piercing, Slashing |
| `gate` | 9 | `canonical_no_damage` | `(blank)` | - |
| `geas` | 5 | `structured_empty` | `(blank)` | Psychic |
| `gentle-repose` | 2 | `canonical_no_damage` | `(blank)` | - |
| `giant-insect` | 4 | `structured_empty` | `(blank)` | Bludgeoning, Piercing, Poison |
| `glibness` | 8 | `canonical_no_damage` | `(blank)` | - |
| `globe-of-invulnerability` | 6 | `canonical_no_damage` | `(blank)` | - |
| `glyph-of-warding` | 3 | `chooser_match` | `Acid/Cold/Fire/Lightning/Thunder` | Acid, Cold, Fire, Lightning, Thunder |
| `goodberry` | 1 | `canonical_no_damage` | `(blank)` | - |
| `grasping-vine` | 4 | `clean` | `Bludgeoning` | Bludgeoning |
| `grease` | 1 | `canonical_no_damage` | `(blank)` | - |
| `greater-invisibility` | 4 | `canonical_no_damage` | `(blank)` | - |
| `greater-restoration` | 5 | `canonical_no_damage` | `(blank)` | - |
| `green-flame-blade` | 0 | `clean` | `Fire` | Fire |
| `guardian-of-faith` | 4 | `clean` | `Radiant` | Radiant |
| `guardian-of-nature` | 4 | `canonical_no_damage` | `(blank)` | - |
| `guards-and-wards` | 6 | `canonical_no_damage` | `(blank)` | - |
| `guidance` | 0 | `canonical_no_damage` | `(blank)` | - |
| `guiding-bolt` | 1 | `clean` | `Radiant` | Radiant |
| `gust-of-wind` | 2 | `canonical_no_damage` | `(blank)` | - |
| `hail-of-thorns` | 1 | `clean` | `Piercing` | Piercing |
| `hallow` | 5 | `structured_empty` | `(blank)` | - |
| `hallucinatory-terrain` | 4 | `canonical_no_damage` | `(blank)` | - |
| `harm` | 6 | `clean` | `Necrotic` | Necrotic |
| `haste` | 3 | `canonical_no_damage` | `(blank)` | - |
| `heal` | 6 | `canonical_no_damage` | `(blank)` | - |
| `healing-word` | 1 | `canonical_no_damage` | `(blank)` | - |
| `heat-metal` | 2 | `clean` | `Fire` | Fire |
| `hellish-rebuke` | 1 | `clean` | `Fire` | Fire |
| `heroes-feast` | 6 | `structured_empty` | `(blank)` | Poison |
| `heroism` | 1 | `canonical_no_damage` | `(blank)` | - |
| `hex` | 1 | `clean` | `Necrotic` | Necrotic |
| `hold-monster` | 5 | `canonical_no_damage` | `(blank)` | - |
| `hold-person` | 2 | `canonical_no_damage` | `(blank)` | - |
| `holy-aura` | 8 | `canonical_no_damage` | `(blank)` | - |
| `holy-weapon` | 5 | `structured_empty` | `(blank)` | Radiant |
| `hunger-of-hadar` | 3 | `multi_effect` | `Cold/Acid` | Cold, Acid |
| `hunters-mark` | 1 | `clean` | `Force` | Force |
| `hypnotic-pattern` | 3 | `canonical_no_damage` | `(blank)` | - |
| `ice-knife` | 1 | `structured_empty` | `(blank)` | Cold, Piercing |
| `ice-storm` | 4 | `clean` | `Bludgeoning` | Bludgeoning, Cold |
| `identify` | 1 | `canonical_no_damage` | `(blank)` | - |
| `illusory-dragon` | 8 | `chooser_match` | `acid, cold, fire, lightning, necrotic, or poison` | Acid, Cold, Fire, Lightning, Necrotic, Poison |
| `illusory-script` | 1 | `canonical_no_damage` | `(blank)` | - |
| `immolation` | 5 | `clean` | `Fire` | Fire |
| `imprisonment` | 9 | `structured_empty` | `(blank)` | Force |
| `incendiary-cloud` | 8 | `clean` | `Fire` | Fire |
| `incite-greed` | 3 | `canonical_no_damage` | `(blank)` | - |
| `infernal-calling` | 5 | `canonical_no_damage` | `(blank)` | - |
| `inflict-wounds` | 1 | `clean` | `Necrotic` | Necrotic |
| `insect-plague` | 5 | `clean` | `Piercing` | Piercing |
| `intellect-fortress` | 3 | `structured_empty` | `(blank)` | Psychic |
| `investiture-of-flame` | 6 | `mismatch` | `Fire` | Cold, Fire |
| `investiture-of-ice` | 6 | `clean` | `Cold` | Cold, Fire |
| `investiture-of-stone` | 6 | `structured_empty` | `(blank)` | Bludgeoning, Piercing, Slashing |
| `investiture-of-wind` | 6 | `clean` | `Bludgeoning` | Bludgeoning |
| `invisibility` | 2 | `canonical_no_damage` | `(blank)` | - |
| `invulnerability` | 9 | `canonical_no_damage` | `(blank)` | - |
| `jump` | 1 | `canonical_no_damage` | `(blank)` | - |
| `knock` | 2 | `canonical_no_damage` | `(blank)` | - |
| `legend-lore` | 5 | `canonical_no_damage` | `(blank)` | - |
| `leomunds-secret-chest` | 4 | `canonical_no_damage` | `(blank)` | - |
| `leomunds-tiny-hut` | 3 | `canonical_no_damage` | `(blank)` | - |
| `lesser-restoration` | 2 | `canonical_no_damage` | `(blank)` | - |
| `levitate` | 2 | `canonical_no_damage` | `(blank)` | - |
| `life-transference` | 3 | `chooser_match` | `Necrotic` | Necrotic |
| `light` | 0 | `canonical_no_damage` | `(blank)` | - |
| `lightning-arrow` | 3 | `clean` | `Lightning` | Lightning |
| `lightning-bolt` | 3 | `clean` | `Lightning` | Lightning |
| `lightning-lure` | 0 | `structured_empty` | `(blank)` | Lightning |
| `locate-animals-or-plants` | 2 | `canonical_no_damage` | `(blank)` | - |
| `locate-creature` | 4 | `canonical_no_damage` | `(blank)` | - |
| `locate-object` | 2 | `canonical_no_damage` | `(blank)` | - |
| `longstrider` | 1 | `canonical_no_damage` | `(blank)` | - |
| `maddening-darkness` | 8 | `clean` | `Psychic` | Psychic |
| `maelstrom` | 5 | `clean` | `Bludgeoning` | Bludgeoning |
| `mage-armor` | 1 | `canonical_no_damage` | `(blank)` | - |
| `mage-hand` | 0 | `canonical_no_damage` | `(blank)` | - |
| `magic-circle` | 3 | `canonical_no_damage` | `(blank)` | - |
| `magic-jar` | 6 | `canonical_no_damage` | `(blank)` | - |
| `magic-missile` | 1 | `clean` | `Force` | Force |
| `magic-mouth` | 2 | `canonical_no_damage` | `(blank)` | - |
| `magic-stone` | 0 | `structured_empty` | `(blank)` | Bludgeoning |
| `magic-weapon` | 2 | `canonical_no_damage` | `(blank)` | - |
| `major-image` | 3 | `canonical_no_damage` | `(blank)` | - |
| `mass-cure-wounds` | 5 | `structured_only` | `- **Description**: A wave of healing energy washes out from a point of your choice within range. Choose up to six creatures in a 30-foot-radius sphere centered on that point. Each target regains hit points equal to 3d8 + your spellcasting ability modifier. This spell has no effect on undead or constructs.` | - |
| `mass-heal` | 9 | `canonical_no_damage` | `(blank)` | - |
| `mass-healing-word` | 3 | `structured_only` | `Healing` | - |
| `mass-polymorph` | 9 | `canonical_no_damage` | `(blank)` | - |
| `mass-suggestion` | 6 | `canonical_no_damage` | `(blank)` | - |
| `maze` | 8 | `canonical_no_damage` | `(blank)` | - |
| `meld-into-stone` | 3 | `structured_empty` | `(blank)` | Force |
| `melfs-acid-arrow` | 2 | `clean` | `Acid` | Acid |
| `melfs-minute-meteors` | 3 | `clean` | `Fire` | Fire |
| `mending` | 0 | `canonical_no_damage` | `(blank)` | - |
| `mental-prison` | 6 | `mismatch` | `Psychic` | Fire, Psychic |
| `message` | 0 | `canonical_no_damage` | `(blank)` | - |
| `meteor-swarm` | 9 | `mismatch` | `Fire` | Bludgeoning, Fire |
| `mighty-fortress` | 8 | `structured_empty` | `(blank)` | Poison, Psychic |
| `mind-blank` | 8 | `structured_empty` | `(blank)` | Psychic |
| `mind-sliver` | 0 | `clean` | `Psychic` | Psychic |
| `mind-spike` | 2 | `clean` | `Psychic` | Psychic |
| `minor-illusion` | 0 | `canonical_no_damage` | `(blank)` | - |
| `mirage-arcane` | 7 | `canonical_no_damage` | `(blank)` | - |
| `mirror-image` | 2 | `canonical_no_damage` | `(blank)` | - |
| `mislead` | 5 | `structured_only` | `- **Description**: You become invisible at the same time that an illusory double of you appears where you are standing. The double lasts for the duration, but the invisibility ends if you attack or cast a spell. You can use your action to move your illusory double up to twice your Speed and make it gesture, speak, and behave in whatever way you choose. You can see through its eyes and hear through its ears as if you were located where it is. On each of your turns as a bonus action, you can switch from using its senses to using your own, or back again. While you are using its senses, you are blinded and deafened in regard to your own surroundings.` | - |
| `misty-step` | 2 | `canonical_no_damage` | `(blank)` | - |
| `modify-memory` | 5 | `structured_empty` | `- **Description**: You attempt to reshape another creature's memories. One creature that you can see must make a Wisdom saving throw. If you are fighting the creature, it has advantage on the saving throw. On a failed save, the target becomes charmed by you for the duration. The charmed target is incapacitated and unaware of its surroundings, though it can still hear you. If it takes any damage or is targeted by another spell, this spell ends, and none of the target's memories are modified. While this charm lasts, you can affect the target's memory of an event that it experienced within the last 24 hours and that lasted no more than 10 minutes. You can permanently eliminate all memory of the event, allow the target to recall the event with perfect clarity and exacting detail, change its memory of the details of the event, or create a memory of some other event. You must speak to the target to describe how its memories are affected, and it must be able to understand your language for the modified memories to take root. Its mind fills in any gaps in the details of your description. If the spell ends before you have finished describing the modified memories, the creature's memory isn't altered. Otherwise, the modified memories take hold when the spell ends. A modified memory doesn't necessarily affect how a creature behaves, particularly if the memory contradicts the creature's natural inclinations, alignment, or beliefs. An illogical modified memory, such as implanting a memory of how much the creature enjoyed dousing itself in acid, is dismissed, perhaps as a bad dream. The GM might deem a modified memory too nonsensical to affect a creature in a significant manner. A remove curse or greater restoration spell cast on the target restores the creature's true memory.` | Acid |
| `mold-earth` | 0 | `structured_empty` | `(blank)` | Force |
| `moonbeam` | 2 | `clean` | `Radiant` | Radiant |
| `mordenkainens-faithful-hound` | 4 | `clean` | `Force` | Force |
| `mordenkainens-magnificent-mansion` | 7 | `canonical_no_damage` | `(blank)` | - |
| `mordenkainens-private-sanctum` | 4 | `canonical_no_damage` | `(blank)` | - |
| `motivational-speech` | 3 | `canonical_no_damage` | `(blank)` | - |
| `move-earth` | 6 | `canonical_no_damage` | `(blank)` | - |
| `negative-energy-flood` | 5 | `clean` | `Necrotic` | Necrotic |
| `nondetection` | 3 | `canonical_no_damage` | `(blank)` | - |
| `nystuls-magic-aura` | 2 | `canonical_no_damage` | `(blank)` | - |
| `otilukes-freezing-sphere` | 6 | `clean` | `Cold` | Cold |
| `otilukes-resilient-sphere` | 4 | `canonical_no_damage` | `(blank)` | - |
| `ottos-irresistible-dance` | 6 | `canonical_no_damage` | `(blank)` | - |
| `pass-without-trace` | 2 | `canonical_no_damage` | `(blank)` | - |
| `passwall` | 5 | `structured_only` | `- **Description**: A passage appears at a point of your choice that you can see on a wooden, plaster, or stone surface (such as a wall, a ceiling, or a floor) within range, and lasts for the duration. You choose the opening's dimensions: up to 5 feet wide, 8 feet tall, and 20 feet deep. The passage creates no instability in a structure surrounding it. When the opening disappears, any creatures or objects still in the passage created by the spell are safely ejected to an unoccupied space nearest to the surface on which you cast the spell.` | - |
| `phantasmal-force` | 2 | `clean` | `Psychic` | Psychic |
| `phantasmal-killer` | 4 | `clean` | `Psychic` | Psychic |
| `phantom-steed` | 3 | `canonical_no_damage` | `(blank)` | - |
| `planar-ally` | 6 | `canonical_no_damage` | `(blank)` | - |
| `planar-binding` | 5 | `structured_only` | `- **Description**: With this spell, you attempt to bind a celestial, an elemental, a fey, or a fiend to your service. The creature must be within range for the entire casting of the spell. (Typically, the creature is first summoned into the center of an inverted magic circle in order to keep it trapped while this spell is cast.) At the completion of the casting, the target must make a Charisma saving throw. On a failed save, it is bound to serve you for the duration. If the creature was summoned or created by another spell, that spell's duration is extended to match the duration of this spell. A bound creature must follow your instructions to the best of its ability. You might command the creature to accompany you on an adventure, to guard a location, or to deliver a message. The creature obeys the letter of your instructions, but if the creature is hostile to you, it strives to twist your words to achieve its own objectives. If the creature carries out your instructions completely before the spell ends, it travels to you to report this fact if you are on the same plane of existence. If you are on a different plane of existence, it returns to the place where you bound it and remains there until the spell ends.` | - |
| `plane-shift` | 7 | `structured_empty` | `(blank)` | Fire |
| `plant-growth` | 3 | `canonical_no_damage` | `(blank)` | - |
| `poison-spray` | 0 | `clean` | `Poison` | Poison |
| `polymorph` | 4 | `canonical_no_damage` | `(blank)` | - |
| `power-word-heal` | 9 | `canonical_no_damage` | `(blank)` | - |
| `power-word-kill` | 9 | `structured_empty` | `(blank)` | Psychic |
| `power-word-pain` | 7 | `canonical_no_damage` | `(blank)` | - |
| `power-word-stun` | 8 | `canonical_no_damage` | `(blank)` | - |
| `prayer-of-healing` | 2 | `structured_only` | `Healing` | - |
| `prestidigitation` | 0 | `structured_empty` | `(blank)` | Fire |
| `primal-savagery` | 0 | `clean` | `Acid` | Acid |
| `primordial-ward` | 6 | `structured_empty` | `(blank)` | Acid, Cold, Fire, Lightning, Thunder |
| `prismatic-spray` | 7 | `random_table` | `Fire, Acid, Lightning, Poison, Cold` | - |
| `prismatic-wall` | 9 | `canonical_no_damage` | `(blank)` | - |
| `produce-flame` | 0 | `structured_empty` | `(blank)` | Fire |
| `programmed-illusion` | 6 | `canonical_no_damage` | `(blank)` | - |
| `project-image` | 7 | `canonical_no_damage` | `(blank)` | - |
| `protection-from-energy` | 3 | `structured_empty` | `(blank)` | Acid, Cold, Fire, Lightning, Thunder |
| `protection-from-evil-and-good` | 1 | `canonical_no_damage` | `(blank)` | - |
| `protection-from-poison` | 2 | `structured_empty` | `(blank)` | Poison |
| `psychic-scream` | 9 | `clean` | `Psychic` | Psychic |
| `purify-food-and-drink` | 1 | `structured_empty` | `(blank)` | Poison |
| `pyrotechnics` | 2 | `structured_empty` | `(blank)` | Fire |
| `raise-dead` | 5 | `structured_only` | `- **Description**: You return a dead creature you touch to life, provided that it has been dead no longer than 10 days. If the creature's soul is both willing and at liberty to rejoin the body, the creature returns to life with 1 hit point. This spell also neutralizes any poisons and cures nonmagical diseases that affected the creature at the time it died. This spell doesn't, however, remove magical diseases, curses, or similar effects; if these aren't first removed prior to casting the spell, they take effect when the creature returns to life. The spell can't return an undead creature to life. This spell closes all mortal wounds, but it doesn't restore missing body parts. If the creature is lacking body parts or organs integral for its survival--its head, for instance--the spell automatically fails. Coming back from the dead is an ordeal. The target takes a -4 penalty to all attack rolls, saving throws, and ability checks. Every time the target finishes a long rest, the penalty is reduced by 1 until it disappears.` | - |
| `rarys-telepathic-bond` | 5 | `structured_only` | `- **Description**: You forge a telepathic link among up to eight willing creatures of your choice within range, psychically linking each creature to all the others for the duration. Creatures with Intelligence scores of 2 or less aren't affected by this spell. Until the spell ends, the targets can communicate telepathically through the bond whether or not they have a common language. The communication is possible over any distance, though it can't extend to other planes of existence.` | - |
| `ray-of-enfeeblement` | 2 | `canonical_no_damage` | `(blank)` | - |
| `ray-of-frost` | 0 | `clean` | `Cold` | Cold |
| `ray-of-sickness` | 1 | `clean` | `Poison` | Poison |
| `regenerate` | 7 | `canonical_no_damage` | `(blank)` | - |
| `reincarnate` | 5 | `structured_only` | `- **Description**: You touch a dead humanoid or a piece of a dead humanoid. Provided that the creature has been dead no longer than 10 days, the spell forms a new adult body for it and then calls the soul to enter that body. If the target's soul isn't free or willing to do so, the spell fails. The magic fashions a new body for the creature to inhabit, which likely causes the creature's race to change. The GM rolls a d100 and consults the following table to determine what form the creature takes when restored to life, or the GM chooses a form. The reincarnated creature recalls its former life and experiences. It retains the capabilities it had in its original form, except it exchanges its original race for the new one and changes its racial traits accordingly.` | - |
| `remove-curse` | 3 | `canonical_no_damage` | `(blank)` | - |
| `resistance` | 0 | `structured_empty` | `(blank)` | Acid, Bludgeoning, Cold, Fire, Lightning, Necrotic, Piercing, Poison, Radiant, Slashing, Thunder |
| `resurrection` | 7 | `canonical_no_damage` | `(blank)` | - |
| `reverse-gravity` | 7 | `canonical_no_damage` | `(blank)` | - |
| `revivify` | 3 | `canonical_no_damage` | `(blank)` | - |
| `rope-trick` | 2 | `canonical_no_damage` | `(blank)` | - |
| `sacred-flame` | 0 | `clean` | `Radiant` | Radiant |
| `sanctuary` | 1 | `canonical_no_damage` | `(blank)` | - |
| `scatter` | 6 | `canonical_no_damage` | `(blank)` | - |
| `scorching-ray` | 2 | `clean` | `Fire` | Fire |
| `scrying` | 5 | `structured_only` | `- **Description**: You can see and hear a particular creature you choose that is on the same plane of existence as you. The target must make a Wisdom saving throw, which is modified by how well you know the target and the sort of physical connection you have to it. If a target knows you're casting this spell, it can fail the saving throw voluntarily if it wants to be observed. Knowledge On a successful save, the target isn't affected, and you can't use this spell against it again for 24 hours. On a failed save, the spell creates an invisible sensor within 10 feet of the target. You can see and hear through the sensor as if you were there. The sensor moves with the target, remaining within 10 feet of it for the duration. A creature that can see invisible objects sees the sensor as a luminous orb about the size of your fist. Instead of targeting a creature, you can choose a location you have seen before as the target of this spell. When you do, the sensor appears at that location and doesn't move.` | - |
| `searing-smite` | 1 | `clean` | `Fire` | Fire |
| `see-invisibility` | 2 | `canonical_no_damage` | `(blank)` | - |
| `seeming` | 5 | `canonical_no_damage` | `(blank)` | - |
| `sending` | 3 | `canonical_no_damage` | `(blank)` | - |
| `sequester` | 7 | `canonical_no_damage` | `(blank)` | - |
| `shadow-of-moil` | 4 | `structured_empty` | `(blank)` | Necrotic, Radiant |
| `shape-water` | 0 | `structured_empty` | `(blank)` | Force |
| `shapechange` | 9 | `canonical_no_damage` | `(blank)` | - |
| `shatter` | 2 | `clean` | `Thunder` | Thunder |
| `shield` | 1 | `structured_empty` | `(blank)` | Force |
| `shield-of-faith` | 1 | `canonical_no_damage` | `(blank)` | - |
| `shillelagh` | 0 | `structured_empty` | `(blank)` | Force |
| `shining-smite` | 2 | `clean` | `Radiant` | Radiant |
| `shocking-grasp` | 0 | `clean` | `Lightning` | Lightning |
| `sickening-radiance` | 4 | `structured_empty` | `(blank)` | Radiant |
| `silence` | 2 | `structured_empty` | `(blank)` | Thunder |
| `silent-image` | 1 | `canonical_no_damage` | `(blank)` | - |
| `simulacrum` | 7 | `canonical_no_damage` | `(blank)` | - |
| `skill-empowerment` | 5 | `canonical_no_damage` | `(blank)` | - |
| `skywrite` | 2 | `canonical_no_damage` | `(blank)` | - |
| `sleep` | 1 | `canonical_no_damage` | `(blank)` | - |
| `sleet-storm` | 3 | `canonical_no_damage` | `(blank)` | - |
| `slow` | 3 | `canonical_no_damage` | `(blank)` | - |
| `snare` | 1 | `canonical_no_damage` | `(blank)` | - |
| `soul-cage` | 6 | `canonical_no_damage` | `(blank)` | - |
| `spare-the-dying` | 0 | `canonical_no_damage` | `(blank)` | - |
| `speak-with-animals` | 1 | `canonical_no_damage` | `(blank)` | - |
| `speak-with-dead` | 3 | `canonical_no_damage` | `(blank)` | - |
| `speak-with-plants` | 3 | `canonical_no_damage` | `(blank)` | - |
| `spider-climb` | 2 | `canonical_no_damage` | `(blank)` | - |
| `spike-growth` | 2 | `clean` | `Piercing` | Piercing |
| `spirit-guardians` | 3 | `chooser_match` | `Radiant/Necrotic` | Necrotic, Radiant |
| `spiritual-weapon` | 2 | `clean` | `Force` | Force |
| `staggering-smite` | 4 | `structured_empty` | `(blank)` | Psychic |
| `starry-wisp` | 0 | `clean` | `Radiant` | Radiant |
| `steel-wind-strike` | 5 | `clean` | `Force` | Force |
| `stinking-cloud` | 3 | `canonical_no_damage` | `(blank)` | - |
| `stone-shape` | 4 | `canonical_no_damage` | `(blank)` | - |
| `stoneskin` | 4 | `structured_empty` | `(blank)` | Bludgeoning, Piercing, Slashing |
| `storm-of-vengeance` | 9 | `mismatch` | `Thunder` | Acid, Bludgeoning, Cold, Lightning, Thunder |
| `storm-sphere` | 4 | `structured_empty` | `(blank)` | Bludgeoning, Lightning |
| `suggestion` | 2 | `canonical_no_damage` | `(blank)` | - |
| `summon-beast` | 2 | `structured_empty` | `(blank)` | Piercing |
| `summon-greater-demon` | 4 | `canonical_no_damage` | `(blank)` | - |
| `summon-lesser-demons` | 3 | `canonical_no_damage` | `(blank)` | - |
| `sunbeam` | 6 | `clean` | `Radiant` | Radiant |
| `sunburst` | 8 | `clean` | `Radiant` | Radiant |
| `swift-quiver` | 5 | `canonical_no_damage` | `(blank)` | - |
| `sword-burst` | 0 | `clean` | `Force` | Force |
| `symbol` | 7 | `clean` | `Necrotic` | Necrotic |
| `synaptic-static` | 5 | `clean` | `Psychic` | Psychic |
| `tashas-caustic-brew` | 1 | `clean` | `Acid` | Acid |
| `tashas-hideous-laughter` | 1 | `canonical_no_damage` | `(blank)` | - |
| `telekinesis` | 5 | `canonical_no_damage` | `(blank)` | - |
| `telepathy` | 8 | `canonical_no_damage` | `(blank)` | - |
| `teleport` | 7 | `structured_empty` | `(blank)` | Force |
| `teleportation-circle` | 5 | `canonical_no_damage` | `(blank)` | - |
| `temple-of-the-gods` | 7 | `structured_empty` | `(blank)` | Force |
| `tensers-floating-disk` | 1 | `structured_empty` | `(blank)` | Force |
| `tensers-transformation` | 6 | `structured_empty` | `(blank)` | Force |
| `thaumaturgy` | 0 | `structured_empty` | `(blank)` | Fire, Thunder |
| `thorn-whip` | 0 | `clean` | `Piercing` | Piercing |
| `thunder-step` | 3 | `clean` | `Thunder` | Thunder |
| `thunderclap` | 0 | `clean` | `Thunder` | Thunder |
| `thunderous-smite` | 1 | `clean` | `Thunder` | Thunder |
| `thunderwave` | 1 | `clean` | `Thunder` | Thunder |
| `tidal-wave` | 3 | `clean` | `Bludgeoning` | Bludgeoning |
| `time-stop` | 9 | `canonical_no_damage` | `(blank)` | - |
| `tiny-servant` | 3 | `canonical_no_damage` | `(blank)` | - |
| `toll-the-dead` | 0 | `clean` | `Necrotic` | Necrotic |
| `tongues` | 3 | `canonical_no_damage` | `(blank)` | - |
| `transmute-rock` | 5 | `clean` | `Bludgeoning` | Bludgeoning, Poison, Psychic |
| `transport-via-plants` | 6 | `canonical_no_damage` | `(blank)` | - |
| `tree-stride` | 5 | `canonical_no_damage` | `(blank)` | - |
| `true-polymorph` | 9 | `canonical_no_damage` | `(blank)` | - |
| `true-resurrection` | 9 | `structured_empty` | `(blank)` | Poison |
| `true-seeing` | 6 | `canonical_no_damage` | `(blank)` | - |
| `true-strike` | 0 | `structured_empty` | `(blank)` | Radiant |
| `tsunami` | 8 | `clean` | `Bludgeoning` | Bludgeoning, Force |
| `unseen-servant` | 1 | `structured_empty` | `(blank)` | Force |
| `vampiric-touch` | 3 | `mismatch` | `Necrotic` | Force, Necrotic |
| `vicious-mockery` | 0 | `clean` | `Psychic` | Psychic |
| `vitriolic-sphere` | 4 | `structured_empty` | `(blank)` | Acid |
| `wall-of-fire` | 4 | `clean` | `Fire` | Fire |
| `wall-of-force` | 5 | `structured_empty` | `(blank)` | Force |
| `wall-of-ice` | 6 | `clean` | `Cold` | Cold, Fire, Poison, Psychic |
| `wall-of-light` | 5 | `clean` | `Radiant` | Radiant |
| `wall-of-sand` | 3 | `canonical_no_damage` | `(blank)` | - |
| `wall-of-stone` | 5 | `structured_empty` | `(blank)` | Poison, Psychic |
| `wall-of-thorns` | 6 | `clean` | `Piercing` | Piercing, Slashing |
| `wall-of-water` | 3 | `structured_empty` | `(blank)` | Cold, Fire |
| `warding-bond` | 2 | `canonical_no_damage` | `(blank)` | - |
| `water-breathing` | 3 | `canonical_no_damage` | `(blank)` | - |
| `water-walk` | 3 | `structured_empty` | `(blank)` | Acid |
| `watery-sphere` | 4 | `canonical_no_damage` | `(blank)` | - |
| `web` | 2 | `structured_empty` | `(blank)` | Fire |
| `weird` | 9 | `clean` | `Psychic` | Psychic |
| `whirlwind` | 7 | `clean` | `Bludgeoning` | Bludgeoning |
| `wind-walk` | 6 | `structured_empty` | `(blank)` | Bludgeoning, Piercing, Slashing |
| `wind-wall` | 3 | `clean` | `Bludgeoning` | Bludgeoning |
| `wish` | 9 | `structured_empty` | `(blank)` | Force, Necrotic |
| `witch-bolt` | 1 | `clean` | `Lightning` | Lightning |
| `word-of-radiance` | 0 | `clean` | `Radiant` | Radiant |
| `word-of-recall` | 6 | `canonical_no_damage` | `(blank)` | - |
| `wrath-of-nature` | 5 | `mismatch` | `Slashing` | Bludgeoning, Slashing |
| `wrathful-smite` | 1 | `clean` | `Necrotic` | Necrotic |
| `zone-of-truth` | 2 | `canonical_no_damage` | `(blank)` | - |

</details>
