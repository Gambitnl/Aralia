## 2025-12-30 - Smite Spell Targeting Audit

**Context:**
I audited "Smite" spells (e.g., *Searing Smite*, *Ensnaring Strike*) which are typically cast as a Bonus Action on Self, applying a buff that triggers on the next attack.

**Observation:**
These spells were consistently configured with `range: { type: "self" }` but `targeting: { type: "single" }`. This created a logic gap: the engine would expect the user to select a target at cast time, but the range of 0 limited selection to the caster only. The "Single" targeting implies an external target, whereas "Self" targeting is automatic.

**Fix:**
I created a `validateSmiteTargeting` framework to identify these mismatches.
I updated the following spells to use `targeting: { type: "self" }`, ensuring they correctly function as self-buffs:
*   `searing-smite`
*   `ensnaring-strike`
*   `hail-of-thorns`
*   `thunderous-smite`
*   `wrathful-smite`

**Exception:**
`divine-smite` (2024 version) is cast *after* a hit, so it requires targeting the enemy directly. I updated it to use `targeting: { type: "single", range: 5 }` and `range: { type: "touch" }` to allow selecting the enemy.

**Framework:**
The validator `src/systems/spells/validation/smiteValidator.ts` is available for future use.

**TODO:**
// TODO(Auditor): Integrate `validateSmiteTargeting` into the main `SpellIntegrityValidator` pipeline.
