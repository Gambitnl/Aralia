# Spell Damage Type — Phase 1 Canonical vs Structured Parity Report

Generated: 2026-06-16 (`scripts/auditSpellDamageTypeCanonical.ts`).

## Summary

Scanned **459** spell markdown files.

| Classification | Count | Notes |
| --- | ---: | --- |
| `clean` | 139 | Structured token matches canonical — no action needed |
| `canonical_no_damage` | 217 | Non-damage spell — field correctly absent/empty |
| `chooser_match` | 18 | Chooser spell; option sets agree — migrate structured to typeSelection.typeOptions |
| `chooser_mismatch` | 0 | Chooser spell; option sets differ — needs review |
| `absorb_triggering` | 1 | Damage mirrors triggering event — typeResolution shape |
| `multi_effect` | 1 | Multiple distinct damage-timing effects — split DAMAGE effects |
| `random_table` | 1 | Random from table — future weighted/table subbucket |
| `structured_empty` | 54 | Structured field blank but canonical has damage tokens |
| `mismatch` | 8 | Single-token value mismatch |
| `structured_only` | 18 | Structured has value but canonical snapshot absent |
| `no_canonical_block` | 2 | No canonical block in file |

## Chooser spells (migrate to typeSelection)

These spells store a slash-glued or comma-glued string in structured `Damage Type`. They should be migrated to `Damage Type Selection: one_of` + `Damage Type Options: <list>` in the structured layer, and to `damage.typeSelection.{ kind, options }` in the runtime JSON.

| Spell | Level | Structured raw | Canonical options | Status |
| --- | ---: | --- | --- | --- |
| `chromatic-orb` | 1 | `Acid/Cold/Fire/Lightning/Poison/Thunder` | Acid, Cold, Fire, Lightning, Poison, Thunder | options agree |
| `conjure-minor-elementals` | 4 | `Acid, Cold, Fire, or Lightning` | Acid, Cold, Fire, Lightning | options agree |
| `destructive-wave` | 5 | `Thunder, Radiant/Necrotic` | Thunder, Radiant, Necrotic | options agree |
| `dragons-breath` | 2 | `Acid/Cold/Fire/Lightning/Poison` | Acid, Cold, Fire, Lightning, Poison | options agree |
| `elemental-weapon` | 3 | `Acid/Cold/Fire/Lightning/Thunder` | Acid, Cold, Fire, Lightning, Thunder | options agree |
| `fire-shield` | 4 | `Fire or Cold` | Cold, Fire | options agree |
| `flame-strike` | 5 | `Fire, Radiant` | Fire, Radiant | options agree |
| `forbiddance` | 6 | `Radiant/Necrotic` | Radiant, Necrotic | options agree |
| `gaseous-form` | 3 | `Bludgeoning, Piercing, Slashing` | Bludgeoning, Piercing, Slashing | options agree |
| `glyph-of-warding` | 3 | `Acid/Cold/Fire/Lightning/Thunder` | Acid, Cold, Fire, Lightning, Thunder | options agree |
| `illusory-dragon` | 8 | `acid, cold, fire, lightning, necrotic, or poison` | Acid, Cold, Fire, Lightning, Necrotic, Poison | options agree |
| `investiture-of-stone` | 6 | `Bludgeoning, Piercing, Slashing` | Bludgeoning, Piercing, Slashing | options agree |
| `life-transference` | 3 | `Necrotic` | Necrotic | options agree |
| `primordial-ward` | 6 | `Acid, Cold, Fire, Lightning, Thunder` | Acid, Cold, Fire, Lightning, Thunder | options agree |
| `protection-from-energy` | 3 | `Acid, Cold, Fire, Lightning, Thunder` | Acid, Cold, Fire, Lightning, Thunder | options agree |
| `resistance` | 0 | `Acid, Bludgeoning, Cold, Fire, Lightning, Necrotic, Piercing, Poison, Radiant, Slashing, Thunder` | Acid, Bludgeoning, Cold, Fire, Lightning, Necrotic, Piercing, Poison, Radiant, Slashing, Thunder | options agree |
| `spirit-guardians` | 3 | `Radiant/Necrotic` | Necrotic, Radiant | options agree |
| `wind-walk` | 6 | `Bludgeoning, Piercing, Slashing` | Bludgeoning, Piercing, Slashing | options agree |

## Special cases

### Damage mirrors triggering event — typeResolution shape

- **`absorb-elements`** (level 1) — Damage type follows triggering event; typeResolution shape.

### Multiple distinct damage-timing effects — split DAMAGE effects

- **`hunger-of-hadar`** (level 3) — Multiple distinct DAMAGE effect timings; split into multiple DAMAGE effects at runtime.

### Random from table — future weighted/table subbucket

- **`prismatic-spray`** (level 7) — Random from d8 table; not a caster-choice one_of — future weighted/table subbucket.

## Needs attention — mismatches and empties

| Spell | Level | matchKind | Structured | Canonical | Note |
| --- | ---: | --- | --- | --- | --- |
| `alter-self` | 2 | `structured_empty` | `(blank)` | Bludgeoning, Piercing, Slashing | Structured Damage Type field is absent or blank; canonical has damage tokens. |
| `animate-objects` | 5 | `structured_empty` | `(blank)` | Force, Poison, Psychic | Structured Damage Type field is absent or blank; canonical has damage tokens. |
| `arcane-vigor` | 2 | `structured_empty` | `Healing` | Force | Could not resolve canonical token from Rules Text or Damage/Effect line. |
| `aura-of-purity` | 4 | `structured_empty` | `(blank)` | Poison | Structured Damage Type field is absent or blank; canonical has damage tokens. |
| `bigbys-hand` | 5 | `structured_empty` | `(blank)` | Bludgeoning, Force | Structured Damage Type field is absent or blank; canonical has damage tokens. |
| `conjure-animals` | 3 | `mismatch` | `Slashing` | Force, Slashing | Structured: "Slashing" | Canonical: "Force" |
| `conjure-elemental` | 5 | `structured_empty` | `variable` | Cold, Fire, Force, Lightning, Thunder | Could not resolve canonical token from Rules Text or Damage/Effect line. |
| `conjure-volley` | 5 | `structured_empty` | `variable` | Fire | Could not resolve canonical token from Rules Text or Damage/Effect line. |
| `control-water` | 4 | `structured_empty` | `(blank)` | Bludgeoning | Structured Damage Type field is absent or blank; canonical has damage tokens. |
| `detect-poison-and-disease` | 1 | `structured_empty` | `(blank)` | Poison | Structured Damage Type field is absent or blank; canonical has damage tokens. |
| `dimension-door` | 4 | `structured_empty` | `(blank)` | Force | Structured Damage Type field is absent or blank; canonical has damage tokens. |
| `dream` | 5 | `structured_empty` | `(blank)` | Psychic | Structured Damage Type field is absent or blank; canonical has damage tokens. |
| `druidcraft` | 0 | `structured_empty` | `(blank)` | Fire | Structured Damage Type field is absent or blank; canonical has damage tokens. |
| `earthquake` | 8 | `structured_empty` | `(blank)` | Bludgeoning | Structured Damage Type field is absent or blank; canonical has damage tokens. |
| `elemental-bane` | 4 | `structured_empty` | `(blank)` | Acid, Cold, Fire, Lightning, Thunder | Structured Damage Type field is absent or blank; canonical has damage tokens. |
| `elementalism` | 0 | `structured_empty` | `(blank)` | Fire | Structured Damage Type field is absent or blank; canonical has damage tokens. |
| `enemies-abound` | 3 | `structured_empty` | `(blank)` | Force | Structured Damage Type field is absent or blank; canonical has damage tokens. |
| `feign-death` | 3 | `structured_empty` | `All` | Psychic | Could not resolve canonical token from Rules Text or Damage/Effect line. |
| `find-steed` | 2 | `structured_empty` | `(blank)` | Necrotic, Psychic, Radiant | Structured Damage Type field is absent or blank; canonical has damage tokens. |
| `forcecage` | 7 | `structured_empty` | `(blank)` | Force | Structured Damage Type field is absent or blank; canonical has damage tokens. |
| `friends` | 0 | `structured_empty` | `(blank)` | Force | Structured Damage Type field is absent or blank; canonical has damage tokens. |
| `geas` | 5 | `structured_empty` | `(blank)` | Psychic | Structured Damage Type field is absent or blank; canonical has damage tokens. |
| `giant-insect` | 4 | `structured_empty` | `(blank)` | Bludgeoning, Piercing, Poison | Structured Damage Type field is absent or blank; canonical has damage tokens. |
| `hallow` | 5 | `structured_empty` | `(blank)` | ? | Structured Damage Type field is absent or blank; canonical has damage tokens. |
| `ice-knife` | 1 | `structured_empty` | `(blank)` | Cold, Piercing | Structured Damage Type field is absent or blank; canonical has damage tokens. |
| `imprisonment` | 9 | `structured_empty` | `(blank)` | Force | Structured Damage Type field is absent or blank; canonical has damage tokens. |
| `investiture-of-flame` | 6 | `mismatch` | `Fire` | Cold, Fire | Structured: "Fire" | Canonical: "Cold" |
| `lightning-lure` | 0 | `structured_empty` | `(blank)` | Lightning | Structured Damage Type field is absent or blank; canonical has damage tokens. |
| `magic-stone` | 0 | `structured_empty` | `(blank)` | Bludgeoning | Structured Damage Type field is absent or blank; canonical has damage tokens. |
| `meld-into-stone` | 3 | `structured_empty` | `(blank)` | Force | Structured Damage Type field is absent or blank; canonical has damage tokens. |
| `mental-prison` | 6 | `mismatch` | `Psychic` | Fire, Psychic | Structured: "Psychic" | Canonical: "Fire" |
| `meteor-swarm` | 9 | `mismatch` | `Fire` | Bludgeoning, Fire | Structured: "Fire" | Canonical: "Bludgeoning" |
| `mighty-fortress` | 8 | `structured_empty` | `(blank)` | Poison, Psychic | Structured Damage Type field is absent or blank; canonical has damage tokens. |
| `mind-blank` | 8 | `structured_empty` | `(blank)` | Psychic | Structured Damage Type field is absent or blank; canonical has damage tokens. |
| `modify-memory` | 5 | `structured_empty` | `not_applicable` | Acid | Could not resolve canonical token from Rules Text or Damage/Effect line. |
| `mold-earth` | 0 | `structured_empty` | `(blank)` | Force | Structured Damage Type field is absent or blank; canonical has damage tokens. |
| `plane-shift` | 7 | `structured_empty` | `(blank)` | Fire | Structured Damage Type field is absent or blank; canonical has damage tokens. |
| `prestidigitation` | 0 | `structured_empty` | `(blank)` | Fire | Structured Damage Type field is absent or blank; canonical has damage tokens. |
| `produce-flame` | 0 | `structured_empty` | `(blank)` | Fire | Structured Damage Type field is absent or blank; canonical has damage tokens. |
| `purify-food-and-drink` | 1 | `structured_empty` | `(blank)` | Poison | Structured Damage Type field is absent or blank; canonical has damage tokens. |
| `pyrotechnics` | 2 | `structured_empty` | `(blank)` | Fire | Structured Damage Type field is absent or blank; canonical has damage tokens. |
| `shape-water` | 0 | `structured_empty` | `(blank)` | Force | Structured Damage Type field is absent or blank; canonical has damage tokens. |
| `shield` | 1 | `structured_empty` | `(blank)` | Force | Structured Damage Type field is absent or blank; canonical has damage tokens. |
| `shillelagh` | 0 | `structured_empty` | `(blank)` | Force | Structured Damage Type field is absent or blank; canonical has damage tokens. |
| `silence` | 2 | `structured_empty` | `(blank)` | Thunder | Structured Damage Type field is absent or blank; canonical has damage tokens. |
| `stoneskin` | 4 | `structured_empty` | `(blank)` | Bludgeoning, Piercing, Slashing | Structured Damage Type field is absent or blank; canonical has damage tokens. |
| `storm-of-vengeance` | 9 | `mismatch` | `Thunder` | Acid, Bludgeoning, Cold, Lightning, Thunder | Structured: "Thunder" | Canonical: "Acid" |
| `summon-beast` | 2 | `structured_empty` | `(blank)` | Piercing | Structured Damage Type field is absent or blank; canonical has damage tokens. |
| `temple-of-the-gods` | 7 | `structured_empty` | `(blank)` | Force | Structured Damage Type field is absent or blank; canonical has damage tokens. |
| `tensers-floating-disk` | 1 | `structured_empty` | `(blank)` | Force | Structured Damage Type field is absent or blank; canonical has damage tokens. |
| `thaumaturgy` | 0 | `structured_empty` | `(blank)` | Fire, Thunder | Structured Damage Type field is absent or blank; canonical has damage tokens. |
| `true-resurrection` | 9 | `structured_empty` | `(blank)` | Poison | Structured Damage Type field is absent or blank; canonical has damage tokens. |
| `true-strike` | 0 | `structured_empty` | `(blank)` | Radiant | Structured Damage Type field is absent or blank; canonical has damage tokens. |
| `unseen-servant` | 1 | `structured_empty` | `(blank)` | Force | Structured Damage Type field is absent or blank; canonical has damage tokens. |
| `vampiric-touch` | 3 | `mismatch` | `Necrotic` | Force, Necrotic | Structured: "Necrotic" | Canonical: "Force" |
| `wall-of-force` | 5 | `structured_empty` | `(blank)` | Force | Structured Damage Type field is absent or blank; canonical has damage tokens. |
| `wall-of-stone` | 5 | `structured_empty` | `(blank)` | Poison, Psychic | Structured Damage Type field is absent or blank; canonical has damage tokens. |
| `wall-of-water` | 3 | `structured_empty` | `(blank)` | Cold, Fire | Structured Damage Type field is absent or blank; canonical has damage tokens. |
| `water-walk` | 3 | `structured_empty` | `(blank)` | Acid | Structured Damage Type field is absent or blank; canonical has damage tokens. |
| `web` | 2 | `structured_empty` | `(blank)` | Fire | Structured Damage Type field is absent or blank; canonical has damage tokens. |
| `wish` | 9 | `mismatch` | `Necrotic` | Force, Necrotic | Structured: "Necrotic" | Canonical: "Force" |
| `wrath-of-nature` | 5 | `mismatch` | `Slashing` | Bludgeoning, Slashing | Structured: "Slashing" | Canonical: "Bludgeoning" |

## Structured-only (no canonical block)

- `aid` — Canonical prose shows no damage type; structured has a value — may be derived / summon damage.
- `alarm` — Canonical prose shows no damage type; structured has a value — may be derived / summon damage.
- `aura-of-vitality` — Canonical prose shows no damage type; structured has a value — may be derived / summon damage.
- `blade-of-disaster` — Canonical snapshot absent; cannot compare.
- `cure-wounds` — Canonical prose shows no damage type; structured has a value — may be derived / summon damage.
- `galders-speedy-courier` — No canonical block and no structured value.
- `galders-tower` — No canonical block and no structured value.
- `mass-cure-wounds` — Canonical prose shows no damage type; structured has a value — may be derived / summon damage.
- `mass-healing-word` — Canonical prose shows no damage type; structured has a value — may be derived / summon damage.
- `mislead` — Canonical prose shows no damage type; structured has a value — may be derived / summon damage.
- `otilukes-resilient-sphere` — Canonical prose shows no damage type; structured has a value — may be derived / summon damage.
- `passwall` — Canonical prose shows no damage type; structured has a value — may be derived / summon damage.
- `planar-binding` — Canonical prose shows no damage type; structured has a value — may be derived / summon damage.
- `prayer-of-healing` — Canonical prose shows no damage type; structured has a value — may be derived / summon damage.
- `raise-dead` — Canonical prose shows no damage type; structured has a value — may be derived / summon damage.
- `rarys-telepathic-bond` — Canonical prose shows no damage type; structured has a value — may be derived / summon damage.
- `reincarnate` — Canonical prose shows no damage type; structured has a value — may be derived / summon damage.
- `reverse-gravity` — Canonical prose shows no damage type; structured has a value — may be derived / summon damage.
- `scrying` — Canonical prose shows no damage type; structured has a value — may be derived / summon damage.
- `warding-bond` — Canonical prose shows no damage type; structured has a value — may be derived / summon damage.

<details>
<summary>Full record list (all spells)</summary>

| Spell | Lv | matchKind | Structured | Canonical options |
| --- | ---: | --- | --- | --- |
| `abi-dalzims-horrid-wilting` | 8 | `clean` | `Necrotic` | Necrotic |
| `absorb-elements` | 1 | `absorb_triggering` | `triggering_damage_type` | — |
| `acid-splash` | 0 | `clean` | `Acid` | Acid |
| `aid` | 2 | `structured_only` | `Healing` | — |
| `alarm` | 1 | `structured_only` | `not_applicable` | — |
| `alter-self` | 2 | `structured_empty` | `(blank)` | Bludgeoning, Piercing, Slashing |
| `animal-friendship` | 1 | `canonical_no_damage` | `(blank)` | — |
| `animal-messenger` | 2 | `canonical_no_damage` | `(blank)` | — |
| `animal-shapes` | 8 | `canonical_no_damage` | `(blank)` | — |
| `animate-dead` | 3 | `canonical_no_damage` | `(blank)` | — |
| `animate-objects` | 5 | `structured_empty` | `(blank)` | Force, Poison, Psychic |
| `antilife-shell` | 5 | `canonical_no_damage` | `(blank)` | — |
| `antimagic-field` | 8 | `canonical_no_damage` | `(blank)` | — |
| `antipathy-sympathy` | 8 | `canonical_no_damage` | `(blank)` | — |
| `arcane-eye` | 4 | `canonical_no_damage` | `(blank)` | — |
| `arcane-gate` | 6 | `canonical_no_damage` | `(blank)` | — |
| `arcane-lock` | 2 | `canonical_no_damage` | `(blank)` | — |
| `arcane-sword` | 7 | `clean` | `Force` | Force |
| `arcane-vigor` | 2 | `structured_empty` | `Healing` | Force |
| `armor-of-agathys` | 1 | `clean` | `Cold` | Cold |
| `arms-of-hadar` | 1 | `clean` | `Necrotic` | Necrotic |
| `astral-projection` | 9 | `canonical_no_damage` | `(blank)` | — |
| `augury` | 2 | `canonical_no_damage` | `(blank)` | — |
| `aura-of-life` | 4 | `clean` | `Necrotic` | Necrotic |
| `aura-of-purity` | 4 | `structured_empty` | `(blank)` | Poison |
| `aura-of-vitality` | 3 | `structured_only` | `Healing` | — |
| `awaken` | 5 | `canonical_no_damage` | `(blank)` | — |
| `bane` | 1 | `canonical_no_damage` | `(blank)` | — |
| `banishing-smite` | 5 | `clean` | `Force` | Force |
| `banishment` | 4 | `canonical_no_damage` | `(blank)` | — |
| `barkskin` | 2 | `canonical_no_damage` | `(blank)` | — |
| `beacon-of-hope` | 3 | `canonical_no_damage` | `(blank)` | — |
| `beast-sense` | 2 | `canonical_no_damage` | `(blank)` | — |
| `bestow-curse` | 3 | `canonical_no_damage` | `(blank)` | — |
| `bigbys-hand` | 5 | `structured_empty` | `(blank)` | Bludgeoning, Force |
| `blade-barrier` | 6 | `clean` | `Force` | Force |
| `blade-of-disaster` | 9 | `structured_only` | `Force` | — |
| `blade-ward` | 0 | `canonical_no_damage` | `(blank)` | — |
| `bless` | 1 | `canonical_no_damage` | `(blank)` | — |
| `blight` | 4 | `clean` | `Necrotic` | Necrotic |
| `blinding-smite` | 3 | `clean` | `Radiant` | Radiant |
| `blindness-deafness` | 2 | `canonical_no_damage` | `(blank)` | — |
| `blink` | 3 | `canonical_no_damage` | `(blank)` | — |
| `blur` | 2 | `canonical_no_damage` | `(blank)` | — |
| `bones-of-the-earth` | 6 | `clean` | `Bludgeoning` | Bludgeoning |
| `booming-blade` | 0 | `clean` | `Thunder` | Thunder |
| `burning-hands` | 1 | `clean` | `Fire` | Fire |
| `call-lightning` | 3 | `clean` | `Lightning` | Lightning |
| `calm-emotions` | 2 | `canonical_no_damage` | `(blank)` | — |
| `catapult` | 1 | `clean` | `Bludgeoning` | Bludgeoning |
| `catnap` | 3 | `canonical_no_damage` | `(blank)` | — |
| `chain-lightning` | 6 | `clean` | `Lightning` | Lightning |
| `charm-monster` | 4 | `canonical_no_damage` | `(blank)` | — |
| `charm-person` | 1 | `canonical_no_damage` | `(blank)` | — |
| `chill-touch` | 0 | `clean` | `Necrotic` | Necrotic |
| `chromatic-orb` | 1 | `chooser_match` | `Acid/Cold/Fire/Lightning/Poison/Thunder` | Acid, Cold, Fire, Lightning, Poison, Thunder |
| `circle-of-death` | 6 | `clean` | `Necrotic` | Necrotic |
| `circle-of-power` | 5 | `canonical_no_damage` | `(blank)` | — |
| `clairvoyance` | 3 | `canonical_no_damage` | `(blank)` | — |
| `clone` | 8 | `canonical_no_damage` | `(blank)` | — |
| `cloud-of-daggers` | 2 | `clean` | `Slashing` | Slashing |
| `cloudkill` | 5 | `clean` | `Poison` | Poison |
| `color-spray` | 1 | `canonical_no_damage` | `(blank)` | — |
| `command` | 1 | `canonical_no_damage` | `(blank)` | — |
| `commune` | 5 | `canonical_no_damage` | `(blank)` | — |
| `commune-with-nature` | 5 | `canonical_no_damage` | `(blank)` | — |
| `compelled-duel` | 1 | `canonical_no_damage` | `(blank)` | — |
| `comprehend-languages` | 1 | `canonical_no_damage` | `(blank)` | — |
| `compulsion` | 4 | `canonical_no_damage` | `(blank)` | — |
| `cone-of-cold` | 5 | `clean` | `Cold` | Cold |
| `confusion` | 4 | `canonical_no_damage` | `(blank)` | — |
| `conjure-animals` | 3 | `mismatch` | `Slashing` | Force, Slashing |
| `conjure-barrage` | 3 | `clean` | `Force` | Force |
| `conjure-celestial` | 7 | `clean` | `Radiant` | Radiant |
| `conjure-elemental` | 5 | `structured_empty` | `variable` | Cold, Fire, Force, Lightning, Thunder |
| `conjure-fey` | 6 | `clean` | `Psychic` | Psychic |
| `conjure-minor-elementals` | 4 | `chooser_match` | `Acid, Cold, Fire, or Lightning` | Acid, Cold, Fire, Lightning |
| `conjure-volley` | 5 | `structured_empty` | `variable` | Fire |
| `conjure-woodland-beings` | 4 | `clean` | `Force` | Force |
| `contact-other-plane` | 5 | `clean` | `Psychic` | Psychic |
| `contagion` | 5 | `clean` | `Necrotic` | Necrotic |
| `contingency` | 6 | `canonical_no_damage` | `(blank)` | — |
| `continual-flame` | 2 | `canonical_no_damage` | `(blank)` | — |
| `control-water` | 4 | `structured_empty` | `(blank)` | Bludgeoning |
| `control-weather` | 8 | `canonical_no_damage` | `(blank)` | — |
| `control-winds` | 5 | `canonical_no_damage` | `(blank)` | — |
| `cordon-of-arrows` | 2 | `clean` | `Piercing` | Piercing |
| `counterspell` | 3 | `canonical_no_damage` | `(blank)` | — |
| `create-bonfire` | 0 | `clean` | `Fire` | Fire |
| `create-food-and-water` | 3 | `canonical_no_damage` | `(blank)` | — |
| `create-homunculus` | 6 | `clean` | `Piercing` | Piercing |
| `create-or-destroy-water` | 1 | `canonical_no_damage` | `(blank)` | — |
| `create-undead` | 6 | `canonical_no_damage` | `(blank)` | — |
| `creation` | 5 | `canonical_no_damage` | `(blank)` | — |
| `crown-of-madness` | 2 | `canonical_no_damage` | `(blank)` | — |
| `crown-of-stars` | 7 | `clean` | `Radiant` | Radiant |
| `crusaders-mantle` | 3 | `clean` | `Radiant` | Radiant |
| `cure-wounds` | 1 | `structured_only` | `Healing` | — |
| `dancing-lights` | 0 | `canonical_no_damage` | `(blank)` | — |
| `danse-macabre` | 5 | `canonical_no_damage` | `(blank)` | — |
| `darkness` | 2 | `canonical_no_damage` | `(blank)` | — |
| `darkvision` | 2 | `canonical_no_damage` | `(blank)` | — |
| `dawn` | 5 | `clean` | `Radiant` | Radiant |
| `daylight` | 3 | `canonical_no_damage` | `(blank)` | — |
| `death-ward` | 4 | `canonical_no_damage` | `(blank)` | — |
| `delayed-blast-fireball` | 7 | `clean` | `Fire` | Fire |
| `demiplane` | 8 | `canonical_no_damage` | `(blank)` | — |
| `destructive-wave` | 5 | `chooser_match` | `Thunder, Radiant/Necrotic` | Thunder, Radiant, Necrotic |
| `detect-evil-and-good` | 1 | `canonical_no_damage` | `(blank)` | — |
| `detect-magic` | 1 | `canonical_no_damage` | `(blank)` | — |
| `detect-poison-and-disease` | 1 | `structured_empty` | `(blank)` | Poison |
| `detect-thoughts` | 2 | `canonical_no_damage` | `(blank)` | — |
| `dimension-door` | 4 | `structured_empty` | `(blank)` | Force |
| `disguise-self` | 1 | `canonical_no_damage` | `(blank)` | — |
| `disintegrate` | 6 | `clean` | `Force` | Force |
| `dispel-evil-and-good` | 5 | `canonical_no_damage` | `(blank)` | — |
| `dispel-magic` | 3 | `canonical_no_damage` | `(blank)` | — |
| `dissonant-whispers` | 1 | `clean` | `Psychic` | Psychic |
| `divination` | 4 | `canonical_no_damage` | `(blank)` | — |
| `divine-favor` | 1 | `clean` | `Radiant` | Radiant |
| `divine-smite` | 1 | `clean` | `Radiant` | Radiant |
| `divine-word` | 7 | `canonical_no_damage` | `(blank)` | — |
| `dominate-beast` | 4 | `canonical_no_damage` | `(blank)` | — |
| `dominate-monster` | 8 | `canonical_no_damage` | `(blank)` | — |
| `dominate-person` | 5 | `canonical_no_damage` | `(blank)` | — |
| `draconic-transformation` | 7 | `clean` | `Force` | Force |
| `dragons-breath` | 2 | `chooser_match` | `Acid/Cold/Fire/Lightning/Poison` | Acid, Cold, Fire, Lightning, Poison |
| `drawmijs-instant-summons` | 6 | `canonical_no_damage` | `(blank)` | — |
| `dream` | 5 | `structured_empty` | `(blank)` | Psychic |
| `dream-of-the-blue-veil` | 7 | `canonical_no_damage` | `(blank)` | — |
| `druid-grove` | 6 | `canonical_no_damage` | `(blank)` | — |
| `druidcraft` | 0 | `structured_empty` | `(blank)` | Fire |
| `earthquake` | 8 | `structured_empty` | `(blank)` | Bludgeoning |
| `eldritch-blast` | 0 | `clean` | `Force` | Force |
| `elemental-bane` | 4 | `structured_empty` | `(blank)` | Acid, Cold, Fire, Lightning, Thunder |
| `elemental-weapon` | 3 | `chooser_match` | `Acid/Cold/Fire/Lightning/Thunder` | Acid, Cold, Fire, Lightning, Thunder |
| `elementalism` | 0 | `structured_empty` | `(blank)` | Fire |
| `enemies-abound` | 3 | `structured_empty` | `(blank)` | Force |
| `enervation` | 5 | `clean` | `Necrotic` | Necrotic |
| `enhance-ability` | 2 | `canonical_no_damage` | `(blank)` | — |
| `enlarge-reduce` | 2 | `canonical_no_damage` | `(blank)` | — |
| `ensnaring-strike` | 1 | `clean` | `Piercing` | Piercing |
| `entangle` | 1 | `canonical_no_damage` | `(blank)` | — |
| `enthrall` | 2 | `canonical_no_damage` | `(blank)` | — |
| `erupting-earth` | 3 | `clean` | `Bludgeoning` | Bludgeoning |
| `etherealness` | 7 | `clean` | `Force` | Force |
| `evards-black-tentacles` | 4 | `clean` | `Bludgeoning` | Bludgeoning |
| `expeditious-retreat` | 1 | `canonical_no_damage` | `(blank)` | — |
| `eyebite` | 6 | `canonical_no_damage` | `(blank)` | — |
| `fabricate` | 4 | `canonical_no_damage` | `(blank)` | — |
| `faerie-fire` | 1 | `canonical_no_damage` | `(blank)` | — |
| `false-life` | 1 | `canonical_no_damage` | `(blank)` | — |
| `far-step` | 5 | `canonical_no_damage` | `(blank)` | — |
| `fast-friends` | 3 | `canonical_no_damage` | `(blank)` | — |
| `fear` | 3 | `canonical_no_damage` | `(blank)` | — |
| `feather-fall` | 1 | `canonical_no_damage` | `(blank)` | — |
| `feeblemind` | 8 | `clean` | `Psychic` | Psychic |
| `feign-death` | 3 | `structured_empty` | `All` | Psychic |
| `find-familiar` | 1 | `canonical_no_damage` | `(blank)` | — |
| `find-greater-steed` | 4 | `canonical_no_damage` | `(blank)` | — |
| `find-steed` | 2 | `structured_empty` | `(blank)` | Necrotic, Psychic, Radiant |
| `find-the-path` | 6 | `canonical_no_damage` | `(blank)` | — |
| `find-traps` | 2 | `canonical_no_damage` | `(blank)` | — |
| `finger-of-death` | 7 | `clean` | `Necrotic` | Necrotic |
| `fire-bolt` | 0 | `clean` | `Fire` | Fire |
| `fire-shield` | 4 | `chooser_match` | `Fire or Cold` | Cold, Fire |
| `fire-storm` | 7 | `clean` | `Fire` | Fire |
| `fireball` | 3 | `clean` | `Fire` | Fire |
| `flame-arrows` | 3 | `clean` | `Fire` | Fire |
| `flame-blade` | 2 | `clean` | `Fire` | Fire |
| `flame-strike` | 5 | `chooser_match` | `Fire, Radiant` | Fire, Radiant |
| `flaming-sphere` | 2 | `clean` | `Fire` | Fire |
| `flesh-to-stone` | 6 | `canonical_no_damage` | `(blank)` | — |
| `fly` | 3 | `canonical_no_damage` | `(blank)` | — |
| `fog-cloud` | 1 | `canonical_no_damage` | `(blank)` | — |
| `forbiddance` | 6 | `chooser_match` | `Radiant/Necrotic` | Radiant, Necrotic |
| `forcecage` | 7 | `structured_empty` | `(blank)` | Force |
| `foresight` | 9 | `canonical_no_damage` | `(blank)` | — |
| `freedom-of-movement` | 4 | `canonical_no_damage` | `(blank)` | — |
| `friends` | 0 | `structured_empty` | `(blank)` | Force |
| `frostbite` | 0 | `clean` | `Cold` | Cold |
| `galders-speedy-courier` | 4 | `no_canonical_block` | `(blank)` | — |
| `galders-tower` | 3 | `no_canonical_block` | `(blank)` | — |
| `gaseous-form` | 3 | `chooser_match` | `Bludgeoning, Piercing, Slashing` | Bludgeoning, Piercing, Slashing |
| `gate` | 9 | `canonical_no_damage` | `(blank)` | — |
| `geas` | 5 | `structured_empty` | `(blank)` | Psychic |
| `gentle-repose` | 2 | `canonical_no_damage` | `(blank)` | — |
| `giant-insect` | 4 | `structured_empty` | `(blank)` | Bludgeoning, Piercing, Poison |
| `glibness` | 8 | `canonical_no_damage` | `(blank)` | — |
| `globe-of-invulnerability` | 6 | `canonical_no_damage` | `(blank)` | — |
| `glyph-of-warding` | 3 | `chooser_match` | `Acid/Cold/Fire/Lightning/Thunder` | Acid, Cold, Fire, Lightning, Thunder |
| `goodberry` | 1 | `canonical_no_damage` | `(blank)` | — |
| `grasping-vine` | 4 | `clean` | `Bludgeoning` | Bludgeoning |
| `grease` | 1 | `canonical_no_damage` | `(blank)` | — |
| `greater-invisibility` | 4 | `canonical_no_damage` | `(blank)` | — |
| `greater-restoration` | 5 | `canonical_no_damage` | `(blank)` | — |
| `green-flame-blade` | 0 | `clean` | `Fire` | Fire |
| `guardian-of-faith` | 4 | `clean` | `Radiant` | Radiant |
| `guardian-of-nature` | 4 | `canonical_no_damage` | `(blank)` | — |
| `guards-and-wards` | 6 | `canonical_no_damage` | `(blank)` | — |
| `guidance` | 0 | `canonical_no_damage` | `(blank)` | — |
| `guiding-bolt` | 1 | `clean` | `Radiant` | Radiant |
| `gust-of-wind` | 2 | `canonical_no_damage` | `(blank)` | — |
| `hail-of-thorns` | 1 | `clean` | `Piercing` | Piercing |
| `hallow` | 5 | `structured_empty` | `(blank)` | — |
| `hallucinatory-terrain` | 4 | `canonical_no_damage` | `(blank)` | — |
| `harm` | 6 | `clean` | `Necrotic` | Necrotic |
| `haste` | 3 | `canonical_no_damage` | `(blank)` | — |
| `heal` | 6 | `canonical_no_damage` | `(blank)` | — |
| `healing-word` | 1 | `canonical_no_damage` | `(blank)` | — |
| `heat-metal` | 2 | `clean` | `Fire` | Fire |
| `hellish-rebuke` | 1 | `clean` | `Fire` | Fire |
| `heroes-feast` | 6 | `clean` | `Poison` | Poison |
| `heroism` | 1 | `canonical_no_damage` | `(blank)` | — |
| `hex` | 1 | `clean` | `Necrotic` | Necrotic |
| `hold-monster` | 5 | `canonical_no_damage` | `(blank)` | — |
| `hold-person` | 2 | `canonical_no_damage` | `(blank)` | — |
| `holy-aura` | 8 | `canonical_no_damage` | `(blank)` | — |
| `holy-weapon` | 5 | `clean` | `Radiant` | Radiant |
| `hunger-of-hadar` | 3 | `multi_effect` | `Cold/Acid` | Cold, Acid |
| `hunters-mark` | 1 | `clean` | `Force` | Force |
| `hypnotic-pattern` | 3 | `canonical_no_damage` | `(blank)` | — |
| `ice-knife` | 1 | `structured_empty` | `(blank)` | Cold, Piercing |
| `ice-storm` | 4 | `clean` | `Bludgeoning` | Bludgeoning, Cold |
| `identify` | 1 | `canonical_no_damage` | `(blank)` | — |
| `illusory-dragon` | 8 | `chooser_match` | `acid, cold, fire, lightning, necrotic, or poison` | Acid, Cold, Fire, Lightning, Necrotic, Poison |
| `illusory-script` | 1 | `canonical_no_damage` | `(blank)` | — |
| `immolation` | 5 | `clean` | `Fire` | Fire |
| `imprisonment` | 9 | `structured_empty` | `(blank)` | Force |
| `incendiary-cloud` | 8 | `clean` | `Fire` | Fire |
| `incite-greed` | 3 | `canonical_no_damage` | `(blank)` | — |
| `infernal-calling` | 5 | `canonical_no_damage` | `(blank)` | — |
| `inflict-wounds` | 1 | `clean` | `Necrotic` | Necrotic |
| `insect-plague` | 5 | `clean` | `Piercing` | Piercing |
| `intellect-fortress` | 3 | `clean` | `Psychic` | Psychic |
| `investiture-of-flame` | 6 | `mismatch` | `Fire` | Cold, Fire |
| `investiture-of-ice` | 6 | `clean` | `Cold` | Cold, Fire |
| `investiture-of-stone` | 6 | `chooser_match` | `Bludgeoning, Piercing, Slashing` | Bludgeoning, Piercing, Slashing |
| `investiture-of-wind` | 6 | `clean` | `Bludgeoning` | Bludgeoning |
| `invisibility` | 2 | `canonical_no_damage` | `(blank)` | — |
| `invulnerability` | 9 | `canonical_no_damage` | `(blank)` | — |
| `jump` | 1 | `canonical_no_damage` | `(blank)` | — |
| `knock` | 2 | `canonical_no_damage` | `(blank)` | — |
| `legend-lore` | 5 | `canonical_no_damage` | `(blank)` | — |
| `leomunds-secret-chest` | 4 | `canonical_no_damage` | `(blank)` | — |
| `leomunds-tiny-hut` | 3 | `canonical_no_damage` | `(blank)` | — |
| `lesser-restoration` | 2 | `canonical_no_damage` | `(blank)` | — |
| `levitate` | 2 | `canonical_no_damage` | `(blank)` | — |
| `life-transference` | 3 | `chooser_match` | `Necrotic` | Necrotic |
| `light` | 0 | `canonical_no_damage` | `(blank)` | — |
| `lightning-arrow` | 3 | `clean` | `Lightning` | Lightning |
| `lightning-bolt` | 3 | `clean` | `Lightning` | Lightning |
| `lightning-lure` | 0 | `structured_empty` | `(blank)` | Lightning |
| `locate-animals-or-plants` | 2 | `canonical_no_damage` | `(blank)` | — |
| `locate-creature` | 4 | `canonical_no_damage` | `(blank)` | — |
| `locate-object` | 2 | `canonical_no_damage` | `(blank)` | — |
| `longstrider` | 1 | `canonical_no_damage` | `(blank)` | — |
| `maddening-darkness` | 8 | `clean` | `Psychic` | Psychic |
| `maelstrom` | 5 | `clean` | `Bludgeoning` | Bludgeoning |
| `mage-armor` | 1 | `canonical_no_damage` | `(blank)` | — |
| `mage-hand` | 0 | `canonical_no_damage` | `(blank)` | — |
| `magic-circle` | 3 | `canonical_no_damage` | `(blank)` | — |
| `magic-jar` | 6 | `canonical_no_damage` | `(blank)` | — |
| `magic-missile` | 1 | `clean` | `Force` | Force |
| `magic-mouth` | 2 | `canonical_no_damage` | `(blank)` | — |
| `magic-stone` | 0 | `structured_empty` | `(blank)` | Bludgeoning |
| `magic-weapon` | 2 | `canonical_no_damage` | `(blank)` | — |
| `major-image` | 3 | `canonical_no_damage` | `(blank)` | — |
| `mass-cure-wounds` | 5 | `structured_only` | `not_applicable` | — |
| `mass-heal` | 9 | `canonical_no_damage` | `(blank)` | — |
| `mass-healing-word` | 3 | `structured_only` | `Healing` | — |
| `mass-polymorph` | 9 | `canonical_no_damage` | `(blank)` | — |
| `mass-suggestion` | 6 | `canonical_no_damage` | `(blank)` | — |
| `maze` | 8 | `canonical_no_damage` | `(blank)` | — |
| `meld-into-stone` | 3 | `structured_empty` | `(blank)` | Force |
| `melfs-acid-arrow` | 2 | `clean` | `Acid` | Acid |
| `melfs-minute-meteors` | 3 | `clean` | `Fire` | Fire |
| `mending` | 0 | `canonical_no_damage` | `(blank)` | — |
| `mental-prison` | 6 | `mismatch` | `Psychic` | Fire, Psychic |
| `message` | 0 | `canonical_no_damage` | `(blank)` | — |
| `meteor-swarm` | 9 | `mismatch` | `Fire` | Bludgeoning, Fire |
| `mighty-fortress` | 8 | `structured_empty` | `(blank)` | Poison, Psychic |
| `mind-blank` | 8 | `structured_empty` | `(blank)` | Psychic |
| `mind-sliver` | 0 | `clean` | `Psychic` | Psychic |
| `mind-spike` | 2 | `clean` | `Psychic` | Psychic |
| `minor-illusion` | 0 | `canonical_no_damage` | `(blank)` | — |
| `mirage-arcane` | 7 | `canonical_no_damage` | `(blank)` | — |
| `mirror-image` | 2 | `canonical_no_damage` | `(blank)` | — |
| `mislead` | 5 | `structured_only` | `not_applicable` | — |
| `misty-step` | 2 | `canonical_no_damage` | `(blank)` | — |
| `modify-memory` | 5 | `structured_empty` | `not_applicable` | Acid |
| `mold-earth` | 0 | `structured_empty` | `(blank)` | Force |
| `moonbeam` | 2 | `clean` | `Radiant` | Radiant |
| `mordenkainens-faithful-hound` | 4 | `clean` | `Force` | Force |
| `mordenkainens-magnificent-mansion` | 7 | `canonical_no_damage` | `(blank)` | — |
| `mordenkainens-private-sanctum` | 4 | `canonical_no_damage` | `(blank)` | — |
| `motivational-speech` | 3 | `canonical_no_damage` | `(blank)` | — |
| `move-earth` | 6 | `canonical_no_damage` | `(blank)` | — |
| `negative-energy-flood` | 5 | `clean` | `Necrotic` | Necrotic |
| `nondetection` | 3 | `canonical_no_damage` | `(blank)` | — |
| `nystuls-magic-aura` | 2 | `canonical_no_damage` | `(blank)` | — |
| `otilukes-freezing-sphere` | 6 | `clean` | `Cold` | Cold |
| `otilukes-resilient-sphere` | 4 | `structured_only` | `All` | — |
| `ottos-irresistible-dance` | 6 | `canonical_no_damage` | `(blank)` | — |
| `pass-without-trace` | 2 | `canonical_no_damage` | `(blank)` | — |
| `passwall` | 5 | `structured_only` | `not_applicable` | — |
| `phantasmal-force` | 2 | `clean` | `Psychic` | Psychic |
| `phantasmal-killer` | 4 | `clean` | `Psychic` | Psychic |
| `phantom-steed` | 3 | `canonical_no_damage` | `(blank)` | — |
| `planar-ally` | 6 | `canonical_no_damage` | `(blank)` | — |
| `planar-binding` | 5 | `structured_only` | `not_applicable` | — |
| `plane-shift` | 7 | `structured_empty` | `(blank)` | Fire |
| `plant-growth` | 3 | `canonical_no_damage` | `(blank)` | — |
| `poison-spray` | 0 | `clean` | `Poison` | Poison |
| `polymorph` | 4 | `canonical_no_damage` | `(blank)` | — |
| `power-word-heal` | 9 | `canonical_no_damage` | `(blank)` | — |
| `power-word-kill` | 9 | `clean` | `Psychic` | Psychic |
| `power-word-pain` | 7 | `canonical_no_damage` | `(blank)` | — |
| `power-word-stun` | 8 | `canonical_no_damage` | `(blank)` | — |
| `prayer-of-healing` | 2 | `structured_only` | `Healing` | — |
| `prestidigitation` | 0 | `structured_empty` | `(blank)` | Fire |
| `primal-savagery` | 0 | `clean` | `Acid` | Acid |
| `primordial-ward` | 6 | `chooser_match` | `Acid, Cold, Fire, Lightning, Thunder` | Acid, Cold, Fire, Lightning, Thunder |
| `prismatic-spray` | 7 | `random_table` | `Fire, Acid, Lightning, Poison, Cold` | — |
| `prismatic-wall` | 9 | `canonical_no_damage` | `(blank)` | — |
| `produce-flame` | 0 | `structured_empty` | `(blank)` | Fire |
| `programmed-illusion` | 6 | `canonical_no_damage` | `(blank)` | — |
| `project-image` | 7 | `canonical_no_damage` | `(blank)` | — |
| `protection-from-energy` | 3 | `chooser_match` | `Acid, Cold, Fire, Lightning, Thunder` | Acid, Cold, Fire, Lightning, Thunder |
| `protection-from-evil-and-good` | 1 | `canonical_no_damage` | `(blank)` | — |
| `protection-from-poison` | 2 | `clean` | `Poison` | Poison |
| `psychic-scream` | 9 | `clean` | `Psychic` | Psychic |
| `purify-food-and-drink` | 1 | `structured_empty` | `(blank)` | Poison |
| `pyrotechnics` | 2 | `structured_empty` | `(blank)` | Fire |
| `raise-dead` | 5 | `structured_only` | `not_applicable` | — |
| `rarys-telepathic-bond` | 5 | `structured_only` | `not_applicable` | — |
| `ray-of-enfeeblement` | 2 | `canonical_no_damage` | `(blank)` | — |
| `ray-of-frost` | 0 | `clean` | `Cold` | Cold |
| `ray-of-sickness` | 1 | `clean` | `Poison` | Poison |
| `regenerate` | 7 | `canonical_no_damage` | `(blank)` | — |
| `reincarnate` | 5 | `structured_only` | `not_applicable` | — |
| `remove-curse` | 3 | `canonical_no_damage` | `(blank)` | — |
| `resistance` | 0 | `chooser_match` | `Acid, Bludgeoning, Cold, Fire, Lightning, Necrotic, Piercing, Poison, Radiant, Slashing, Thunder` | Acid, Bludgeoning, Cold, Fire, Lightning, Necrotic, Piercing, Poison, Radiant, Slashing, Thunder |
| `resurrection` | 7 | `canonical_no_damage` | `(blank)` | — |
| `reverse-gravity` | 7 | `structured_only` | `Bludgeoning` | — |
| `revivify` | 3 | `canonical_no_damage` | `(blank)` | — |
| `rope-trick` | 2 | `canonical_no_damage` | `(blank)` | — |
| `sacred-flame` | 0 | `clean` | `Radiant` | Radiant |
| `sanctuary` | 1 | `canonical_no_damage` | `(blank)` | — |
| `scatter` | 6 | `canonical_no_damage` | `(blank)` | — |
| `scorching-ray` | 2 | `clean` | `Fire` | Fire |
| `scrying` | 5 | `structured_only` | `not_applicable` | — |
| `searing-smite` | 1 | `clean` | `Fire` | Fire |
| `see-invisibility` | 2 | `canonical_no_damage` | `(blank)` | — |
| `seeming` | 5 | `canonical_no_damage` | `(blank)` | — |
| `sending` | 3 | `canonical_no_damage` | `(blank)` | — |
| `sequester` | 7 | `canonical_no_damage` | `(blank)` | — |
| `shadow-of-moil` | 4 | `clean` | `Necrotic` | Necrotic, Radiant |
| `shape-water` | 0 | `structured_empty` | `(blank)` | Force |
| `shapechange` | 9 | `canonical_no_damage` | `(blank)` | — |
| `shatter` | 2 | `clean` | `Thunder` | Thunder |
| `shield` | 1 | `structured_empty` | `(blank)` | Force |
| `shield-of-faith` | 1 | `canonical_no_damage` | `(blank)` | — |
| `shillelagh` | 0 | `structured_empty` | `(blank)` | Force |
| `shining-smite` | 2 | `clean` | `Radiant` | Radiant |
| `shocking-grasp` | 0 | `clean` | `Lightning` | Lightning |
| `sickening-radiance` | 4 | `clean` | `Radiant` | Radiant |
| `silence` | 2 | `structured_empty` | `(blank)` | Thunder |
| `silent-image` | 1 | `canonical_no_damage` | `(blank)` | — |
| `simulacrum` | 7 | `canonical_no_damage` | `(blank)` | — |
| `skill-empowerment` | 5 | `canonical_no_damage` | `(blank)` | — |
| `skywrite` | 2 | `canonical_no_damage` | `(blank)` | — |
| `sleep` | 1 | `canonical_no_damage` | `(blank)` | — |
| `sleet-storm` | 3 | `canonical_no_damage` | `(blank)` | — |
| `slow` | 3 | `canonical_no_damage` | `(blank)` | — |
| `snare` | 1 | `canonical_no_damage` | `(blank)` | — |
| `soul-cage` | 6 | `canonical_no_damage` | `(blank)` | — |
| `spare-the-dying` | 0 | `canonical_no_damage` | `(blank)` | — |
| `speak-with-animals` | 1 | `canonical_no_damage` | `(blank)` | — |
| `speak-with-dead` | 3 | `canonical_no_damage` | `(blank)` | — |
| `speak-with-plants` | 3 | `canonical_no_damage` | `(blank)` | — |
| `spider-climb` | 2 | `canonical_no_damage` | `(blank)` | — |
| `spike-growth` | 2 | `clean` | `Piercing` | Piercing |
| `spirit-guardians` | 3 | `chooser_match` | `Radiant/Necrotic` | Necrotic, Radiant |
| `spiritual-weapon` | 2 | `clean` | `Force` | Force |
| `staggering-smite` | 4 | `clean` | `Psychic` | Psychic |
| `starry-wisp` | 0 | `clean` | `Radiant` | Radiant |
| `steel-wind-strike` | 5 | `clean` | `Force` | Force |
| `stinking-cloud` | 3 | `canonical_no_damage` | `(blank)` | — |
| `stone-shape` | 4 | `canonical_no_damage` | `(blank)` | — |
| `stoneskin` | 4 | `structured_empty` | `(blank)` | Bludgeoning, Piercing, Slashing |
| `storm-of-vengeance` | 9 | `mismatch` | `Thunder` | Acid, Bludgeoning, Cold, Lightning, Thunder |
| `storm-sphere` | 4 | `clean` | `Bludgeoning` | Bludgeoning, Lightning |
| `suggestion` | 2 | `canonical_no_damage` | `(blank)` | — |
| `summon-beast` | 2 | `structured_empty` | `(blank)` | Piercing |
| `summon-greater-demon` | 4 | `canonical_no_damage` | `(blank)` | — |
| `summon-lesser-demons` | 3 | `canonical_no_damage` | `(blank)` | — |
| `sunbeam` | 6 | `clean` | `Radiant` | Radiant |
| `sunburst` | 8 | `clean` | `Radiant` | Radiant |
| `swift-quiver` | 5 | `canonical_no_damage` | `(blank)` | — |
| `sword-burst` | 0 | `clean` | `Force` | Force |
| `symbol` | 7 | `clean` | `Necrotic` | Necrotic |
| `synaptic-static` | 5 | `clean` | `Psychic` | Psychic |
| `tashas-caustic-brew` | 1 | `clean` | `Acid` | Acid |
| `tashas-hideous-laughter` | 1 | `canonical_no_damage` | `(blank)` | — |
| `telekinesis` | 5 | `canonical_no_damage` | `(blank)` | — |
| `telepathy` | 8 | `canonical_no_damage` | `(blank)` | — |
| `teleport` | 7 | `clean` | `Force` | Force |
| `teleportation-circle` | 5 | `canonical_no_damage` | `(blank)` | — |
| `temple-of-the-gods` | 7 | `structured_empty` | `(blank)` | Force |
| `tensers-floating-disk` | 1 | `structured_empty` | `(blank)` | Force |
| `tensers-transformation` | 6 | `clean` | `Force` | Force |
| `thaumaturgy` | 0 | `structured_empty` | `(blank)` | Fire, Thunder |
| `thorn-whip` | 0 | `clean` | `Piercing` | Piercing |
| `thunder-step` | 3 | `clean` | `Thunder` | Thunder |
| `thunderclap` | 0 | `clean` | `Thunder` | Thunder |
| `thunderous-smite` | 1 | `clean` | `Thunder` | Thunder |
| `thunderwave` | 1 | `clean` | `Thunder` | Thunder |
| `tidal-wave` | 3 | `clean` | `Bludgeoning` | Bludgeoning |
| `time-stop` | 9 | `canonical_no_damage` | `(blank)` | — |
| `tiny-servant` | 3 | `canonical_no_damage` | `(blank)` | — |
| `toll-the-dead` | 0 | `clean` | `Necrotic` | Necrotic |
| `tongues` | 3 | `canonical_no_damage` | `(blank)` | — |
| `transmute-rock` | 5 | `clean` | `Bludgeoning` | Bludgeoning, Poison, Psychic |
| `transport-via-plants` | 6 | `canonical_no_damage` | `(blank)` | — |
| `tree-stride` | 5 | `canonical_no_damage` | `(blank)` | — |
| `true-polymorph` | 9 | `canonical_no_damage` | `(blank)` | — |
| `true-resurrection` | 9 | `structured_empty` | `(blank)` | Poison |
| `true-seeing` | 6 | `canonical_no_damage` | `(blank)` | — |
| `true-strike` | 0 | `structured_empty` | `(blank)` | Radiant |
| `tsunami` | 8 | `clean` | `Bludgeoning` | Bludgeoning, Force |
| `unseen-servant` | 1 | `structured_empty` | `(blank)` | Force |
| `vampiric-touch` | 3 | `mismatch` | `Necrotic` | Force, Necrotic |
| `vicious-mockery` | 0 | `clean` | `Psychic` | Psychic |
| `vitriolic-sphere` | 4 | `clean` | `Acid` | Acid |
| `wall-of-fire` | 4 | `clean` | `Fire` | Fire |
| `wall-of-force` | 5 | `structured_empty` | `(blank)` | Force |
| `wall-of-ice` | 6 | `clean` | `Cold` | Cold, Fire, Poison, Psychic |
| `wall-of-light` | 5 | `clean` | `Radiant` | Radiant |
| `wall-of-sand` | 3 | `canonical_no_damage` | `(blank)` | — |
| `wall-of-stone` | 5 | `structured_empty` | `(blank)` | Poison, Psychic |
| `wall-of-thorns` | 6 | `clean` | `Piercing` | Piercing, Slashing |
| `wall-of-water` | 3 | `structured_empty` | `(blank)` | Cold, Fire |
| `warding-bond` | 2 | `structured_only` | `All` | — |
| `water-breathing` | 3 | `canonical_no_damage` | `(blank)` | — |
| `water-walk` | 3 | `structured_empty` | `(blank)` | Acid |
| `watery-sphere` | 4 | `canonical_no_damage` | `(blank)` | — |
| `web` | 2 | `structured_empty` | `(blank)` | Fire |
| `weird` | 9 | `clean` | `Psychic` | Psychic |
| `whirlwind` | 7 | `clean` | `Bludgeoning` | Bludgeoning |
| `wind-walk` | 6 | `chooser_match` | `Bludgeoning, Piercing, Slashing` | Bludgeoning, Piercing, Slashing |
| `wind-wall` | 3 | `clean` | `Bludgeoning` | Bludgeoning |
| `wish` | 9 | `mismatch` | `Necrotic` | Force, Necrotic |
| `witch-bolt` | 1 | `clean` | `Lightning` | Lightning |
| `word-of-radiance` | 0 | `clean` | `Radiant` | Radiant |
| `word-of-recall` | 6 | `canonical_no_damage` | `(blank)` | — |
| `wrath-of-nature` | 5 | `mismatch` | `Slashing` | Bludgeoning, Slashing |
| `wrathful-smite` | 1 | `clean` | `Necrotic` | Necrotic |
| `zone-of-truth` | 2 | `canonical_no_damage` | `(blank)` | — |

</details>

<!-- aralia-backlog-walked: {"source":"docs/tasks/backlog-retirement/RETIREMENT_LEDGER.md","path":"docs/tasks/spells/damage-type/SPELL_DAMAGE_TYPE_CANONICAL_PARITY_REPORT.md","sha256WithoutMarker":"d610eff5170bf044a99b272fdd4908892a7a324bfebe3e517fbf4b0b660a44a9","markedAtUtc":"2026-06-25T22:29:38.513Z"} -->
