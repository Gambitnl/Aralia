# Spell Sub-Classes Roster Audit

Generated: 2026-05-13T06:18:42.797Z
Roster:    `docs/tasks/spells/sub-classes/SPELL_SUPPORTED_SUBCLASS_ROSTERS.md`
Scanned:   459 spell files

## What this audits

Compares each spell's structured `- **Sub-Classes**:` line against
the canonical `Available For:` block, after applying:

- Decision 6 — only roster-supported subclass labels are kept
- Decision 2 — repeated-base entries (parent class already in `Classes`) are stripped

A spell shows as `roster_clean` only when its current structured value matches
the expected post-Decision-2/6 set exactly. `needs_*` rows are real edits left to do.

## Counts

| match_kind | count |
| --- | --- |
| `no_field` | 0 |
| `empty_field` | 0 |
| `roster_clean` | 72 |
| `needs_strip` | 0 |
| `needs_add` | 0 |
| `needs_both` | 0 |
| `no_supported_access` | 0 |
| `marker_applied` | 384 |
| `partial_canonical_source_boundary` | 3 |
| `no_canonical_block` | 0 |

## `roster_clean` (72)

No edits needed. Listed for completeness:

- aid (L2)
- arcane-eye (L4)
- bane (L1)
- beacon-of-hope (L3)
- blink (L3)
- burning-hands (L1)
- calm-emotions (L2)
- charm-person (L1)
- clairvoyance (L3)
- command (L1)
- commune (L5)
- commune-with-nature (L5)
- compulsion (L4)
- confusion (L4)
- crusaders-mantle (L3)
- cure-wounds (L1)
- daylight (L3)
- detect-thoughts (L2)
- dimension-door (L4)
- disguise-self (L1)
- dissonant-whispers (L1)
- dominate-beast (L4)
- dominate-person (L5)
- enhance-ability (L2)
- ensnaring-strike (L1)
- faerie-fire (L1)
- fear (L3)
- fire-shield (L4)
- fireball (L3)
- flame-strike (L5)
- freedom-of-movement (L4)
- geas (L5)
- greater-invisibility (L4)
- greater-restoration (L5)
- guardian-of-faith (L4)
- guiding-bolt (L1)
- haste (L3)
- hold-monster (L5)
- hold-person (L2)
- hunters-mark (L1)
- hypnotic-pattern (L3)
- ice-storm (L4)
- insect-plague (L5)
- invisibility (L2)
- legend-lore (L5)
- lesser-restoration (L2)
- light (L0)
- lightning-bolt (L3)
- mage-hand (L0)
- magic-weapon (L2)
- misty-step (L2)
- moonbeam (L2)
- nondetection (L3)
- pass-without-trace (L2)
- phantasmal-force (L2)
- plant-growth (L3)
- protection-from-energy (L3)
- ray-of-frost (L0)
- revivify (L3)
- rope-trick (L2)
- sacred-flame (L0)
- scorching-ray (L2)
- see-invisibility (L2)
- seeming (L5)
- shatter (L2)
- sleep (L1)
- speak-with-animals (L1)
- stinking-cloud (L3)
- stoneskin (L4)
- telekinesis (L5)
- tree-stride (L5)
- wall-of-fire (L4)

## `marker_applied` (384)

| spell | level | strip | add | note |
| --- | --- | --- | --- | --- |
| `abi-dalzims-horrid-wilting` | 8 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `absorb-elements` | 1 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `acid-splash` | 0 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `alarm` | 1 | - | - | Marker `Unsupported Entries` matches canonical analysis. |
| `alter-self` | 2 | - | - | Marker `Unsupported Entries` matches canonical analysis. |
| `animal-friendship` | 1 | - | - | Marker `Unsupported Entries` matches canonical analysis. |
| `animal-messenger` | 2 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `animal-shapes` | 8 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `animate-dead` | 3 | - | - | Marker `Unsupported Entries` matches canonical analysis. |
| `animate-objects` | 5 | - | - | Marker `Unsupported Entries` matches canonical analysis. |
| `antilife-shell` | 5 | - | - | Marker `Unsupported Entries` matches canonical analysis. |
| `antimagic-field` | 8 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `antipathy-sympathy` | 8 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `arcane-gate` | 6 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `arcane-lock` | 2 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `arcane-sword` | 7 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `arcane-vigor` | 2 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `armor-of-agathys` | 1 | - | - | Marker `Unsupported Entries` matches canonical analysis. |
| `arms-of-hadar` | 1 | - | - | Marker `Unsupported Entries` matches canonical analysis. |
| `astral-projection` | 9 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `augury` | 2 | - | - | Marker `Unsupported Entries` matches canonical analysis. |
| `aura-of-life` | 4 | - | - | Explicit `not_applicable` sentinel plus marker `No Subclass Entries` matches canonical analysis. |
| `aura-of-purity` | 4 | - | - | Explicit `not_applicable` sentinel plus marker `No Subclass Entries` matches canonical analysis. |
| `aura-of-vitality` | 3 | - | - | Marker `Folded into Classes` matches canonical analysis. |
| `awaken` | 5 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `banishing-smite` | 5 | - | - | Marker `Unsupported Entries` matches canonical analysis. |
| `banishment` | 4 | - | - | Marker `Folded into Classes` matches canonical analysis. |
| `barkskin` | 2 | - | - | Marker `Unsupported Entries` matches canonical analysis. |
| `beast-sense` | 2 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `bestow-curse` | 3 | - | - | Marker `Unsupported Entries` matches canonical analysis. |
| `bigbys-hand` | 5 | - | - | Explicit `not_applicable` sentinel plus marker `No Subclass Entries` matches canonical analysis. |
| `blade-barrier` | 6 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `blade-ward` | 0 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `bless` | 1 | - | - | Marker `Folded into Classes` matches canonical analysis. |
| `blight` | 4 | - | - | Marker `Unsupported Entries` matches canonical analysis. |
| `blinding-smite` | 3 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `blindness-deafness` | 2 | - | - | Marker `Unsupported Entries` matches canonical analysis. |
| `blur` | 2 | - | - | Marker `Unsupported Entries` matches canonical analysis. |
| `bones-of-the-earth` | 6 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `booming-blade` | 0 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `call-lightning` | 3 | - | - | Marker `Unsupported Entries` matches canonical analysis. |
| `catapult` | 1 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `catnap` | 3 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `chain-lightning` | 6 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `charm-monster` | 4 | - | - | Marker `Unsupported Entries` matches canonical analysis. |
| `chill-touch` | 0 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `chromatic-orb` | 1 | - | - | Marker `Folded into Classes` matches canonical analysis. |
| `circle-of-death` | 6 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `circle-of-power` | 5 | - | - | Explicit `not_applicable` sentinel plus marker `No Subclass Entries` matches canonical analysis. |
| `clone` | 8 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `cloud-of-daggers` | 2 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `cloudkill` | 5 | - | - | Marker `Unsupported Entries` matches canonical analysis. |
| `color-spray` | 1 | - | - | Explicit `not_applicable` sentinel plus marker `No Subclass Entries` matches canonical analysis. |
| `compelled-duel` | 1 | - | - | Marker `Folded into Classes` matches canonical analysis. |
| `comprehend-languages` | 1 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `cone-of-cold` | 5 | - | - | Marker `Unsupported Entries` matches canonical analysis. |
| `conjure-animals` | 3 | - | - | Explicit `not_applicable` sentinel plus marker `No Subclass Entries` matches canonical analysis. |
| `conjure-barrage` | 3 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `conjure-celestial` | 7 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `conjure-elemental` | 5 | - | - | Marker `Folded into Classes` matches canonical analysis. |
| `conjure-fey` | 6 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `conjure-minor-elementals` | 4 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `conjure-volley` | 5 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `conjure-woodland-beings` | 4 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `contact-other-plane` | 5 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `contagion` | 5 | - | - | Marker `Unsupported Entries` matches canonical analysis. |
| `contingency` | 6 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `continual-flame` | 2 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `control-water` | 4 | - | - | Marker `Unsupported Entries` matches canonical analysis. |
| `control-weather` | 8 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `control-winds` | 5 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `cordon-of-arrows` | 2 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `counterspell` | 3 | - | - | Marker `Unsupported Entries` matches canonical analysis. |
| `create-bonfire` | 0 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `create-food-and-water` | 3 | - | - | Marker `Unsupported Entries` matches canonical analysis. |
| `create-homunculus` | 6 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `create-or-destroy-water` | 1 | - | - | Marker `Unsupported Entries` matches canonical analysis. |
| `create-undead` | 6 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `creation` | 5 | - | - | Marker `Unsupported Entries` matches canonical analysis. |
| `crown-of-madness` | 2 | - | - | Marker `Unsupported Entries` matches canonical analysis. |
| `crown-of-stars` | 7 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `dancing-lights` | 0 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `danse-macabre` | 5 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `darkness` | 2 | - | - | Marker `Unsupported Entries` matches canonical analysis. |
| `darkvision` | 2 | - | - | Marker `Folded into Classes` matches canonical analysis. |
| `dawn` | 5 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `death-ward` | 4 | - | - | Marker `Unsupported Entries` matches canonical analysis. |
| `delayed-blast-fireball` | 7 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `demiplane` | 8 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `destructive-wave` | 5 | - | - | Marker `Unsupported Entries` matches canonical analysis. |
| `detect-evil-and-good` | 1 | - | - | Marker `Unsupported Entries` matches canonical analysis. |
| `detect-magic` | 1 | - | - | Marker `Folded into Classes` matches canonical analysis. |
| `detect-poison-and-disease` | 1 | - | - | Marker `Unsupported Entries` matches canonical analysis. |
| `disintegrate` | 6 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `dispel-evil-and-good` | 5 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `dispel-magic` | 3 | - | - | Marker `Folded into Classes` matches canonical analysis. |
| `divination` | 4 | - | - | Marker `Folded into Classes` matches canonical analysis. |
| `divine-favor` | 1 | - | - | Marker `Folded into Classes` matches canonical analysis. |
| `divine-smite` | 1 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `divine-word` | 7 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `dominate-monster` | 8 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `draconic-transformation` | 7 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `dragons-breath` | 2 | - | - | Marker `Folded into Classes` matches canonical analysis. |
| `drawmijs-instant-summons` | 6 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `dream` | 5 | - | - | Marker `Unsupported Entries` matches canonical analysis. |
| `dream-of-the-blue-veil` | 7 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `druid-grove` | 6 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `druidcraft` | 0 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `earthquake` | 8 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `eldritch-blast` | 0 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `elemental-bane` | 4 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `elemental-weapon` | 3 | - | - | Marker `Unsupported Entries` matches canonical analysis. |
| `elementalism` | 0 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `enemies-abound` | 3 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `enervation` | 5 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `enlarge-reduce` | 2 | - | - | Explicit `not_applicable` sentinel plus marker `No Subclass Entries` matches canonical analysis. |
| `entangle` | 1 | - | - | Marker `Unsupported Entries` matches canonical analysis. |
| `enthrall` | 2 | - | - | Explicit `not_applicable` sentinel plus marker `No Subclass Entries` matches canonical analysis. |
| `erupting-earth` | 3 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `etherealness` | 7 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `evards-black-tentacles` | 4 | - | - | Marker `Unsupported Entries` matches canonical analysis. |
| `expeditious-retreat` | 1 | - | - | Marker `Unsupported Entries` matches canonical analysis. |
| `eyebite` | 6 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `fabricate` | 4 | - | - | Marker `Unsupported Entries` matches canonical analysis. |
| `false-life` | 1 | - | - | Marker `Unsupported Entries` matches canonical analysis. |
| `far-step` | 5 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `fast-friends` | 3 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `feather-fall` | 1 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `feeblemind` | 8 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `feign-death` | 3 | - | - | Marker `Unsupported Entries` matches canonical analysis. |
| `find-familiar` | 1 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `find-greater-steed` | 4 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `find-steed` | 2 | - | - | Marker `Unsupported Entries` matches canonical analysis. |
| `find-the-path` | 6 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `find-traps` | 2 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `finger-of-death` | 7 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `fire-bolt` | 0 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `fire-storm` | 7 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `flame-arrows` | 3 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `flame-blade` | 2 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `flaming-sphere` | 2 | - | - | Marker `Folded into Classes` matches canonical analysis. |
| `flesh-to-stone` | 6 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `fly` | 3 | - | - | Marker `Unsupported Entries` matches canonical analysis. |
| `fog-cloud` | 1 | - | - | Marker `Unsupported Entries` matches canonical analysis. |
| `forbiddance` | 6 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `forcecage` | 7 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `foresight` | 9 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `friends` | 0 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `frostbite` | 0 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `gaseous-form` | 3 | - | - | Marker `Unsupported Entries` matches canonical analysis. |
| `gate` | 9 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `gentle-repose` | 2 | - | - | Marker `Unsupported Entries` matches canonical analysis. |
| `giant-insect` | 4 | - | - | Marker `Folded into Classes` matches canonical analysis. |
| `glibness` | 8 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `globe-of-invulnerability` | 6 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `glyph-of-warding` | 3 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `goodberry` | 1 | - | - | Marker `Unsupported Entries` matches canonical analysis. |
| `grasping-vine` | 4 | - | - | Marker `Unsupported Entries` matches canonical analysis. |
| `grease` | 1 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `green-flame-blade` | 0 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `guardian-of-nature` | 4 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `guards-and-wards` | 6 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `guidance` | 0 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `gust-of-wind` | 2 | - | - | Marker `Unsupported Entries` matches canonical analysis. |
| `hail-of-thorns` | 1 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `hallow` | 5 | - | - | Marker `Folded into Classes` matches canonical analysis. |
| `hallucinatory-terrain` | 4 | - | - | Marker `Unsupported Entries` matches canonical analysis. |
| `harm` | 6 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `heal` | 6 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `healing-word` | 1 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `heat-metal` | 2 | - | - | Marker `Unsupported Entries` matches canonical analysis. |
| `hellish-rebuke` | 1 | - | - | Marker `Unsupported Entries` matches canonical analysis. |
| `heroes-feast` | 6 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `heroism` | 1 | - | - | Marker `Unsupported Entries` matches canonical analysis. |
| `hex` | 1 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `holy-aura` | 8 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `holy-weapon` | 5 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `hunger-of-hadar` | 3 | - | - | Marker `Unsupported Entries` matches canonical analysis. |
| `ice-knife` | 1 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `identify` | 1 | - | - | Marker `Unsupported Entries` matches canonical analysis. |
| `illusory-dragon` | 8 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `illusory-script` | 1 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `immolation` | 5 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `imprisonment` | 9 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `incendiary-cloud` | 8 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `incite-greed` | 3 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `infernal-calling` | 5 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `inflict-wounds` | 1 | - | - | Marker `Unsupported Entries` matches canonical analysis. |
| `intellect-fortress` | 3 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `investiture-of-flame` | 6 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `investiture-of-ice` | 6 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `investiture-of-stone` | 6 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `investiture-of-wind` | 6 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `invulnerability` | 9 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `jump` | 1 | - | - | Marker `Unsupported Entries` matches canonical analysis. |
| `knock` | 2 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `leomunds-secret-chest` | 4 | - | - | Marker `Unsupported Entries` matches canonical analysis. |
| `leomunds-tiny-hut` | 3 | - | - | Marker `Unsupported Entries` matches canonical analysis. |
| `levitate` | 2 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `life-transference` | 3 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `lightning-arrow` | 3 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `lightning-lure` | 0 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `locate-animals-or-plants` | 2 | - | - | Explicit `not_applicable` sentinel plus marker `No Subclass Entries` matches canonical analysis. |
| `locate-creature` | 4 | - | - | Marker `Unsupported Entries` matches canonical analysis. |
| `locate-object` | 2 | - | - | Marker `Unsupported Entries` matches canonical analysis. |
| `longstrider` | 1 | - | - | Explicit `not_applicable` sentinel plus marker `No Subclass Entries` matches canonical analysis. |
| `maddening-darkness` | 8 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `maelstrom` | 5 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `mage-armor` | 1 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `magic-circle` | 3 | - | - | Marker `Folded into Classes` matches canonical analysis. |
| `magic-jar` | 6 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `magic-missile` | 1 | - | - | Marker `Unsupported Entries` matches canonical analysis. |
| `magic-mouth` | 2 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `magic-stone` | 0 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `major-image` | 3 | - | - | Marker `Unsupported Entries` matches canonical analysis. |
| `mass-cure-wounds` | 5 | - | - | Explicit `not_applicable` sentinel plus marker `No Subclass Entries` matches canonical analysis. |
| `mass-heal` | 9 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `mass-healing-word` | 3 | - | - | Marker `Folded into Classes` matches canonical analysis. |
| `mass-polymorph` | 9 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `mass-suggestion` | 6 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `maze` | 8 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `meld-into-stone` | 3 | - | - | Marker `Unsupported Entries` matches canonical analysis. |
| `melfs-acid-arrow` | 2 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `melfs-minute-meteors` | 3 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `mending` | 0 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `mental-prison` | 6 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `message` | 0 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `meteor-swarm` | 9 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `mighty-fortress` | 8 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `mind-blank` | 8 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `mind-sliver` | 0 | - | - | Marker `Folded into Classes` matches canonical analysis. |
| `mind-spike` | 2 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `minor-illusion` | 0 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `mirage-arcane` | 7 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `mirror-image` | 2 | - | - | Explicit `not_applicable` sentinel plus marker `No Subclass Entries` matches canonical analysis. |
| `mislead` | 5 | - | - | Explicit `not_applicable` sentinel plus marker `No Subclass Entries` matches canonical analysis. |
| `modify-memory` | 5 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `mold-earth` | 0 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `mordenkainens-faithful-hound` | 4 | - | - | Marker `Unsupported Entries` matches canonical analysis. |
| `mordenkainens-magnificent-mansion` | 7 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `mordenkainens-private-sanctum` | 4 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `motivational-speech` | 3 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `move-earth` | 6 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `negative-energy-flood` | 5 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `nystuls-magic-aura` | 2 | - | - | Marker `Unsupported Entries` matches canonical analysis. |
| `otilukes-freezing-sphere` | 6 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `otilukes-resilient-sphere` | 4 | - | - | Marker `Unsupported Entries` matches canonical analysis. |
| `ottos-irresistible-dance` | 6 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `passwall` | 5 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `phantasmal-killer` | 4 | - | - | Marker `Unsupported Entries` matches canonical analysis. |
| `phantom-steed` | 3 | - | - | Marker `Unsupported Entries` matches canonical analysis. |
| `planar-ally` | 6 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `planar-binding` | 5 | - | - | Explicit `not_applicable` sentinel plus marker `No Subclass Entries` matches canonical analysis. |
| `plane-shift` | 7 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `poison-spray` | 0 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `polymorph` | 4 | - | - | Marker `Unsupported Entries` matches canonical analysis. |
| `power-word-heal` | 9 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `power-word-kill` | 9 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `power-word-pain` | 7 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `power-word-stun` | 8 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `prayer-of-healing` | 2 | - | - | Marker `Folded into Classes` matches canonical analysis. |
| `prestidigitation` | 0 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `primal-savagery` | 0 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `primordial-ward` | 6 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `prismatic-spray` | 7 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `prismatic-wall` | 9 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `produce-flame` | 0 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `programmed-illusion` | 6 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `project-image` | 7 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `protection-from-evil-and-good` | 1 | - | - | Marker `Unsupported Entries` matches canonical analysis. |
| `protection-from-poison` | 2 | - | - | Marker `Folded into Classes` matches canonical analysis. |
| `psychic-scream` | 9 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `purify-food-and-drink` | 1 | - | - | Marker `Folded into Classes` matches canonical analysis. |
| `pyrotechnics` | 2 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `raise-dead` | 5 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `rarys-telepathic-bond` | 5 | - | - | Explicit `not_applicable` sentinel plus marker `No Subclass Entries` matches canonical analysis. |
| `ray-of-enfeeblement` | 2 | - | - | Marker `Unsupported Entries` matches canonical analysis. |
| `ray-of-sickness` | 1 | - | - | Marker `Unsupported Entries` matches canonical analysis. |
| `regenerate` | 7 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `reincarnate` | 5 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `remove-curse` | 3 | - | - | Explicit `not_applicable` sentinel plus marker `No Subclass Entries` matches canonical analysis. |
| `resistance` | 0 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `resurrection` | 7 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `reverse-gravity` | 7 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `sanctuary` | 1 | - | - | Marker `Unsupported Entries` matches canonical analysis. |
| `scatter` | 6 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `scrying` | 5 | - | - | Explicit `not_applicable` sentinel plus marker `No Subclass Entries` matches canonical analysis. |
| `searing-smite` | 1 | - | - | Marker `Unsupported Entries` matches canonical analysis. |
| `sending` | 3 | - | - | Marker `Unsupported Entries` matches canonical analysis. |
| `sequester` | 7 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `shadow-of-moil` | 4 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `shape-water` | 0 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `shapechange` | 9 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `shield` | 1 | - | - | Marker `Unsupported Entries` matches canonical analysis. |
| `shield-of-faith` | 1 | - | - | Marker `Folded into Classes` matches canonical analysis. |
| `shillelagh` | 0 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `shining-smite` | 2 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `shocking-grasp` | 0 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `sickening-radiance` | 4 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `silence` | 2 | - | - | Marker `Unsupported Entries` matches canonical analysis. |
| `silent-image` | 1 | - | - | Marker `Unsupported Entries` matches canonical analysis. |
| `simulacrum` | 7 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `skill-empowerment` | 5 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `skywrite` | 2 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `sleet-storm` | 3 | - | - | Marker `Unsupported Entries` matches canonical analysis. |
| `slow` | 3 | - | - | Marker `Unsupported Entries` matches canonical analysis. |
| `snare` | 1 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `soul-cage` | 6 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `spare-the-dying` | 0 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `speak-with-dead` | 3 | - | - | Marker `Unsupported Entries` matches canonical analysis. |
| `speak-with-plants` | 3 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `spider-climb` | 2 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `spike-growth` | 2 | - | - | Marker `Unsupported Entries` matches canonical analysis. |
| `spirit-guardians` | 3 | - | - | Marker `Unsupported Entries` matches canonical analysis. |
| `spiritual-weapon` | 2 | - | - | Marker `Unsupported Entries` matches canonical analysis. |
| `staggering-smite` | 4 | - | - | Explicit `not_applicable` sentinel plus marker `No Subclass Entries` matches canonical analysis. |
| `starry-wisp` | 0 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `steel-wind-strike` | 5 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `stone-shape` | 4 | - | - | Marker `Unsupported Entries` matches canonical analysis. |
| `storm-of-vengeance` | 9 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `storm-sphere` | 4 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `suggestion` | 2 | - | - | Marker `Folded into Classes` matches canonical analysis. |
| `summon-beast` | 2 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `summon-greater-demon` | 4 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `summon-lesser-demons` | 3 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `sunbeam` | 6 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `sunburst` | 8 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `swift-quiver` | 5 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `sword-burst` | 0 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `symbol` | 7 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `synaptic-static` | 5 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `tashas-caustic-brew` | 1 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `tashas-hideous-laughter` | 1 | - | - | Marker `Unsupported Entries` matches canonical analysis. |
| `telepathy` | 8 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `teleport` | 7 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `teleportation-circle` | 5 | - | - | Marker `Unsupported Entries` matches canonical analysis. |
| `temple-of-the-gods` | 7 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `tensers-floating-disk` | 1 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `tensers-transformation` | 6 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `thaumaturgy` | 0 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `thorn-whip` | 0 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `thunder-step` | 3 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `thunderclap` | 0 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `thunderous-smite` | 1 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `thunderwave` | 1 | - | - | Marker `Unsupported Entries` matches canonical analysis. |
| `tidal-wave` | 3 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `time-stop` | 9 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `tiny-servant` | 3 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `toll-the-dead` | 0 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `tongues` | 3 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `transmute-rock` | 5 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `transport-via-plants` | 6 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `true-polymorph` | 9 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `true-resurrection` | 9 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `true-seeing` | 6 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `true-strike` | 0 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `tsunami` | 8 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `unseen-servant` | 1 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `vampiric-touch` | 3 | - | - | Marker `Unsupported Entries` matches canonical analysis. |
| `vicious-mockery` | 0 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `vitriolic-sphere` | 4 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `wall-of-force` | 5 | - | - | Marker `Unsupported Entries` matches canonical analysis. |
| `wall-of-ice` | 6 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `wall-of-light` | 5 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `wall-of-sand` | 3 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `wall-of-stone` | 5 | - | - | Marker `Unsupported Entries` matches canonical analysis. |
| `wall-of-thorns` | 6 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `wall-of-water` | 3 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `warding-bond` | 2 | - | - | Marker `Folded into Classes` matches canonical analysis. |
| `water-breathing` | 3 | - | - | Marker `Unsupported Entries` matches canonical analysis. |
| `water-walk` | 3 | - | - | Marker `Unsupported Entries` matches canonical analysis. |
| `watery-sphere` | 4 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `web` | 2 | - | - | Marker `Unsupported Entries` matches canonical analysis. |
| `weird` | 9 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `whirlwind` | 7 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `wind-walk` | 6 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `wind-wall` | 3 | - | - | Marker `Unsupported Entries` matches canonical analysis. |
| `wish` | 9 | - | - | Marker `Unsupported Entries` matches canonical analysis. |
| `witch-bolt` | 1 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `word-of-radiance` | 0 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `word-of-recall` | 6 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `wrath-of-nature` | 5 | - | - | Marker `No Subclass Entries` matches canonical analysis. |
| `wrathful-smite` | 1 | - | - | Marker `Unsupported Entries` matches canonical analysis. |
| `zone-of-truth` | 2 | - | - | Marker `Folded into Classes` matches canonical analysis. |

## `partial_canonical_source_boundary` (3)

| spell | level | strip | add | note |
| --- | --- | --- | --- | --- |
| `blade-of-disaster` | 9 | - | - | No public D&D Beyond canonical block exists; this spell uses the approved partial 5etools identity cross-check already recognized by the main canonical parity audit. |
| `galders-speedy-courier` | 4 | - | - | No public D&D Beyond canonical block exists; this spell uses the approved partial 5etools identity cross-check already recognized by the main canonical parity audit. |
| `galders-tower` | 3 | - | - | No public D&D Beyond canonical block exists; this spell uses the approved partial 5etools identity cross-check already recognized by the main canonical parity audit. |

