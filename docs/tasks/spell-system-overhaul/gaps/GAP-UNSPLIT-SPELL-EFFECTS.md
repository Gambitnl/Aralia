# Spell System Gap: Unsplit Multi-Component Effects

## Overview
An unresolved architectural debt remains in the implementation of spells that possess 2 or more distinct mechanical outcomes within the JSON data layer. 

Currently, an audit has confirmed that exactly 113 spells feature a single, monolithic `effects` object.

A monolithic `effects` object is an `effects` array that contains only a single `Effect` element. A spell is flagged as 'monolithic' if it uses this single-element array despite its narrative description implying two or more distinct mechanical events (which are strictly defined as discrete applications of Damage, Healing, Status Conditions, or Terrain manipulation).

These monolithic effects are inappropriately categorized because they almost universally (112 out of 113 instances) use `UTILITY` as a catch-all umbrella type. They use this generic type to mask what should be an array of granular, distinct damage, status, or terrain components.

Because these spells were imported during early prototyping—prior to the engine supporting arrays of distinct effects—their effect-level `"description"` is currently just a 1-to-1 duplicate of the top-level spell `"description"`.

## Examples Identified
- `public/data/spells/level-9/prismatic-wall.json`: The entire spell acts as a single `UTILITY` block. It must be broken down sequentially: a conditional Fire damage effect (layer 1), Acid damage effect (layer 2), Lightning damage (layer 3), Poison damage (layer 4), Cold damage (layer 5), a conditional Restrained/Petrified status effect (layer 6), and a Blinded/teleportation effect (layer 7).

- `public/data/spells/level-9/mass-heal.json`: Modeled as a single `UTILITY` block (originally suspected to be `HEALING`). Its top-level `description` contains formatting errors (`Blinded , Deafened ,`) compared to the `effect.description` (`Blinded, Deafened,`), demonstrating how direct string-matching validations currently fail. The monolithic format completely hides its secondary mechanical events (curing the Blinded, Deafened, and Poisoned conditions), failing to expose those status-removal actions to the engine.

- Additional spells of Level 5 and above share this incomplete implementation. The manual data curation for these complex spells was intentionally deferred during early engine prototyping to unblock the release of the combat sandbox.

## Architectural Problems Caused
The `Aralia` architecture utilizes a component-based, machine-readable runtime for combat. When the engine executes a spell action, it expects to resolve individual `Effect` components discretely. 

If spell mechanics aren't properly split into distinct effects in the JSON:
1. **Automation Fails:** The game engine cannot automatically apply distinct mechanical outcomes (e.g., resolving the Fire damage layer vs. the Blinded status condition layer of a Prismatic Wall). It has no modular pieces to parse.
2. **AI Burden:** The Arbitration engine is forced to fall back on interpreting the top-level, natural language text of the spell, totally negating the purpose of the rigid component data structure.
3. **UI/UX Mismatch:** The interface attempts to present per-effect snippets (e.g., showing only the "Cold Damage Explosion" text when that specific phase triggers). Duplicate descriptions mean the UI will just regurgitate the full 4-paragraph spell text instead of the relevant micro-context.

## Scope & Remediation
This is a systematic issue affecting exactly 113 spells (out of 459 total). While high-level spells are heavily affected, 35 monolithic spells exist between Level 0-4. The overwhelming majority of these mask their complex mechanics behind a single `UTILITY` effect object.

### Next Steps 

**Phase 1: Automated Auditing & Test Integration**
Before fixing individual files, we need to generate a clear hit list of violating spells within the current test infrastructure.
1. **Integrity Rule Update:** Update the existing "Monolithic Effect Formulation" rule in `src/systems/spells/validation/SpellIntegrityValidator.ts` (lines 53-64) that loops over `spell.effects` and pushes `"Monolithic Effect Description"` if a spell hits all three heuristics:
   - Has exactly 1 effect element (`effects.length === 1`).
   - The top-level `spell.description` is > 150 chars (prevents flagging extremely simple, valid spells like *Blade Ward*).
   - The top-level `spell.description` includes the `effect.description` as a substring. *Note on validation rules: The current rule at line 59 uses `.includes()` which is flawed. It fails to flag known monolithic spells like `mass-heal.json` because of minor whitespace and punctuation discrepancies between the duplicate descriptions. Whitespace must be normalized before comparison to catch all 113 instances.*
2. **Regression Test Flagging:** In the relevant regression tests (e.g. `src/systems/spells/validation/SpellIntegrityValidator.test.ts` or equivalent, which needs to be created or updated), capture these monolithic failures. Maintain a minimal `MONOLITHIC_SAFE_LIST` array for any genuine exceptions. Do *not* assert an empty length immediately (which would blow up the test suite). Instead, filter the failures by this error string and `console.warn` them. This automatically generates a remaining hit list every time tests are run.

**Phase 2: Component Breakdown**
Work through the newly tracked hit list prioritizing spells in the following order:
1. Must be a playable spell (possess a non-empty `classes` string array inside the JSON).
2. Must be a combat spell (possess an execution time of `Action`, `Bonus Action`, or `Reaction`).
3. Prioritize by Effect Type: Strip down spells hiding under the catch-all `UTILITY` category first.
4. Order ascending from Level 0 upwards.

1. **Mechanics Breakdown:** Rewrite the monolithic `effects` arrays for these spells to accurately separate them into independent components. Each distinct effect must map strictly to one variant of the `SpellEffect` exported union defined in `src/types/spells.ts` (lines 412-422) (e.g. mapping exactly to the `DamageEffect`, `HealingEffect`, `StatusConditionEffect`, etc. interfaces). Validation will fail if the types are incorrect.

2. **Refine Descriptions:** Write a 1-2 sentence description for each distinct effect that states only the mechanical outcomes. Forbidden content includes adjectives describing the visual appearance, sound, or emotional impact of the spell. Allowed content is strictly limited to: dice values, damage types, area of effect sizes, saving throw abilities, and condition names (e.g. "Deals 3d6 Cold Damage in a 10-foot radius. Constitution save for half.").

**Phase 3: Validation Lock**
1. **Enforce the Rule:** Once the hit list of monolithic spells drops to zero, update the `SpellIntegrityValidator.test.ts` assertion to strictly require `expect(monolithicFailures).toHaveLength(0)`. This permanently prevents future monolithic spells from polluting the database.
2. **Verify Targeting:** Execute `npx vitest` to ensure the newly populated array of distinct `SpellEffect` objects passes the `systems/spells/validation/SpellIntegrityValidator.test.ts` suite with zero console errors or test failures.
