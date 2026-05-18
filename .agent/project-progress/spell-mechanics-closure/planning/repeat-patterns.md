# Spell Mechanics Repeat Patterns

This ledger records corpus-level extraction failure patterns found during the manual mechanics-discovery pass. A repeat pattern is different from an individual spell finding: it means the same kind of mechanic is being flattened, omitted, or inconsistently represented across multiple spells and may need a bulk propagation pass.

## Repeat Save And Escape Check Artifacts

- **Pattern**: Status-condition effects sometimes carry generic `escapeCheck` or `repeatSave` data even when the canonical prose does not grant that escape action or repeat saving throw.
- **Why it is wrong**: The runtime can accidentally give targets extra ways to end a condition, or use the wrong save ability/timing.
- **Representative examples**: Banishment, Compulsion, Confusion, Wall of Sand, Evard's Black Tentacles, Grasping Vine, Greater Invisibility.
- **Correction rule**: Remove `escapeCheck` and `repeatSave` unless canonical prose explicitly grants them. If the prose does grant them, preserve the exact ability, skill, DC, action cost, trigger, and timing.
- **Status**: Active repeat pattern. Continue scanning as status-condition spells are reviewed.

## Utility Type Runtime Enum Flattening

- **Pattern**: Structured markdown can contain more specific Utility Type values than runtime JSON currently accepts, causing runtime JSON to fall back to `other` or a broader compatible value.
- **Why it is wrong**: The structured layer preserves the spell's mechanical family, but runtime loses that category and downstream systems cannot distinguish it without rereading prose.
- **Representative examples**: Freedom of Movement uses structured `movement`; Giant Insect uses structured `summoning`; Hallucinatory Terrain uses structured `illusion`; Leomund's Secret Chest uses structured `storage`; Polymorph uses structured `transformation`; Otiluke's Resilient Sphere uses structured `defensive`; Mordenkainen's Private Sanctum uses structured `warding`.
- **Correction rule**: Either expand the runtime utility enum/schema to match structured utility families or add a deliberate mapping table that records the original structured utility family alongside the compatible runtime value.
- **Status**: Open propagation pattern. Do not force unsupported enum values into runtime JSON before schema support exists.

## Mechanical Prose Misclassified As Deferred Flavor

- **Pattern**: Prose with evocative or planar language can be routed into `deferred_descriptive_flavor` even when it carries a concrete runtime mechanic.
- **Why it is wrong**: Mechanical behavior can be excluded from the goal just because the detector associated words like "spectral" or "Ethereal" with flavor.
- **Representative examples**: Leomund's Secret Chest stores, recalls, sends back, and strands a real chest on the Ethereal Plane; Guardian of Faith has descriptive spectral appearance, but also has created-guardian placement, invulnerability, enemy aura damage, and a 60-damage depletion rule.
- **Correction rule**: Split appearance-only prose from mechanical world-state, placement, travel, object, trigger, or lifetime rules. Only the appearance-only residue should remain deferred flavor.
- **Status**: Active repeat pattern. Continue correcting during manual review.

## JSON Surface Formatting Drift

- **Pattern**: Spell JSON files use mixed formatting styles, including older wide PowerShell-style spacing and newer 2-space formatting.
- **Why it is risky**: JSON whitespace does not change behavior, but inconsistent surfaces are harder to review and make mechanical shape differences look like formatting noise.
- **Representative examples**: `elementalism.json` is compact 2-space JSON; `blade-ward.json` and `fire-bolt.json` use older wide spacing.
- **Correction rule**: Do not treat formatting drift as a mechanics defect by itself. Track mechanical drift separately: if two spells encode the same mechanic using incompatible JSON shapes, that is actionable; if only whitespace differs, defer mass formatting unless it becomes a review bottleneck.
- **Status**: Not a blocking mechanics bucket yet; watch for same-mechanic/different-shape cases.

### Current Level 4 Formatting Notes

- `summon-greater-demon.json` and `watery-sphere.json` still use older wide PowerShell-style JSON spacing.
- `storm-sphere.json` now contains a mixed surface after targeted mechanics edits: most of the file is compact 2-space JSON, while part of the retained utility effect still carries older spacing.
- These notes are formatting-drift observations only. They should be corrected in a focused normalization pass or when they block review, with semantic-equivalence gates before and after.

## Created Or Controlled Entity Flattening

- **Pattern**: Spells that create, summon, animate, or control an entity are frequently represented as generic `UTILITY` prose even when the canonical spell gives the entity concrete runtime mechanics.
- **Why it is wrong**: Runtime systems cannot reason about command economy, initiative timing, allegiance, default behavior, stat blocks, HP, AC, senses, languages, immunities, object reversion, disappearance, or early ending if those details stay in prose.
- **Representative examples**: Giant Insect, Grasping Vine, Mordenkainen's Faithful Hound, Summon Greater Demon, Animate Objects, Bigby's Hand.
- **Correction rule**: Split entity creation/control into typed fields for placement, entity identity, stat block references or formulas, command actions, default behavior, turn order, allegiance, movement, durability, and lifecycle endings. Keep appearance-only text in deferred flavor if it has no mechanical role.
- **Status**: Active repeat pattern. Continue recording individual spell details in summon/created-object/object-stats buckets until a broader summon/created-entity schema pass is feasible.

## Ordinary Target Selection Misbucketed As Choice Mode

- **Pattern**: The `choice_or_mode` detector sometimes flags ordinary target selection, area-origin selection, or placement wording because the prose says "creature of your choice", "creatures of your choice", "point of your choice", or "space of your choice".
- **Why it is wrong**: These phrases often do not create a spell mode, selectable branch, or option-specific effect. Treating them as mode mechanics inflates the choice bucket and hides the real question: whether the existing targeting, placement, or area fields already preserve the selection rule.
- **Representative examples**: Lightning Lure, Dissonant Whispers, Healing Word, Shield of Faith, Tasha's Hideous Laughter, Tenser's Floating Disk, Shatter, Catnap.
- **Correction rule**: Close the `choice_or_mode` row when the only choice is ordinary target/point/space selection and the structured/runtime targeting layer already preserves the number, target kind, visibility, willingness, range, and area. Keep the row open when the choice changes downstream mechanics, creates multiple modes, allocates independent instances, chooses an option-specific effect, or needs per-target/per-instance branching.
- **Status**: Active repeat pattern. Use this rule during the `choice_or_mode` pass to close detector noise without discarding real modal mechanics.
