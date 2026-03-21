# Creature Taxonomy System

## Purpose

This file documents the CreatureTaxonomy service and its intended role as a safer typed lane for creature-type validation, normalization, and trait lookup.
The important current-state correction is that the service exists and is tested, but it is not yet the shared runtime path for all spell-targeting logic.

## Verified Entry Points

- src/systems/creatures/CreatureTaxonomy.ts
- src/systems/creatures/__tests__/CreatureTaxonomy.test.ts
- src/types/creatures.ts

## Current Service Surface

This pass confirmed that CreatureTaxonomy currently exposes:

- isValidTarget(targetTypes, filter)
- normalize(type)
- getTraits(type)

These APIs are real and tested, and they support both whitelist and blacklist style creature-type filtering.

## Important Current-State Correction

The older version of this doc implied that creature-type targeting had already been consolidated into one unified runtime path.
That is not yet true in the current repo.

This pass confirmed that live targeting and filtering still also run through:

- src/systems/spells/targeting/TargetResolver.ts
- src/systems/spells/targeting/TargetValidationUtils.ts
- src/commands/factory/SpellCommandFactory.ts

So the right interpretation is:

- CreatureTaxonomy is a real typed service
- CreatureTaxonomy is a strong candidate for consolidation
- legacy string-based and duplicated checks still exist alongside it

## What Is Verified Today

### Verified service behavior

- isValidTarget supports include and exclude creature-type checks
- normalize converts strings into the CreatureType enum shape
- getTraits returns CreatureTypeTraits metadata from src/types/creatures.ts

### Verified trait support

The current type metadata still supports creature-type-driven rules such as standard immunities and condition immunities.
That means this service can support checks like construct charm immunity, even though this pass did not verify a single universal runtime consumer for that pattern.

## Boundary Note

Usage examples such as Humanoid-only targeting or excluding Undead and Constructs are valid examples of direct CreatureTaxonomy API usage.
They should not be read as proof that the entire spell engine already routes through this service.

## Future Work Still Supported By The Repo

This pass still supports the following as forward-looking integration work:

- replacing or consolidating legacy targeting checks in TargetResolver and TargetValidationUtils
- handling subtype or tag pressure more explicitly, with repo-backed examples such as Shapechanger and Goblinoid

## Current Interpretation

Re-verified on 2026-03-11.
Treat this file as the typed creature-targeting service note: accurate about the API that exists today, but explicit that the full runtime migration away from scattered string checks is not complete yet.
