# Level 1 Spell Targeting Filter Audit

Last reviewed: 2026-03-12

This file preserves a useful Level 1 targeting audit, but it is no longer a fully current snapshot. Some of the originally flagged gaps were fixed after the audit was written, while others are still only partially resolved.

## Current verified status

| Spell | Description constraint | Current JSON/filter state | Current status |
|------|------|------|------|
| Cure Wounds | No effect on Undead or Constructs | targeting.filter.excludeCreatureTypes is still empty in public/data/spells/level-1/cure-wounds.json | Open |
| Healing Word | No effect on Undead or Constructs | targeting.filter.excludeCreatureTypes is still empty in public/data/spells/level-1/healing-word.json | Open |
| Charm Person | Humanoid only | targeting.filter.creatureTypes and effect-level target filter now both use Humanoid | Fixed |
| Animal Friendship | Beast only | targeting.filter.creatureTypes now uses Beast, and the status effect also carries a beast filter | Fixed |
| Sleep | Undead and creatures immune to Charmed are not affected | Undead exclusion is still not encoded in the top-level targeting filter, and the charm-immunity exclusion is not directly modeled in the current filter schema | Partial |

## What changed after the original audit

- The runtime targeting stack now consumes filter data through the live targeting utilities rather than relying only on free-text description handling.
- src/systems/spells/validation/TargetingPresets.ts already exists and provides reusable presets for common creature-type filters.
- The remaining issue is not the absence of a targeting-filter framework. The remaining issue is incomplete application of that framework to some spell JSON files.

## Verified repo anchors

- public/data/spells/level-1/cure-wounds.json
- public/data/spells/level-1/healing-word.json
- public/data/spells/level-1/charm-person.json
- public/data/spells/level-1/animal-friendship.json
- public/data/spells/level-1/sleep.json
- src/systems/spells/validation/TargetingPresets.ts
- src/systems/spells/targeting/TargetValidationUtils.ts
- src/systems/creatures/CreatureTaxonomy.ts

## Current interpretation

The original 2024 audit correctly identified a real gap, but it should now be treated as a preserved partial-gap note rather than proof of a system-wide missing framework.

