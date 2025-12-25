# Taxonomist's Worklog

## 2024-05-23 - Initial Setup
**Learning:** Establishing the journal for tracking critical classification insights.
**Action:** Will record high-impact taxonomy decisions here.

## 2024-05-23 - DamageType Enum Migration
**Learning:** Converting `DamageType` from a string union to an Enum provides better type safety and extensibility (like associating descriptions/traits) without breaking existing string-based usage if the Enum values are strings. However, explicit type assertions are sometimes needed when interacting with legacy string-typed interfaces.
**Action:** When migrating other unions like `ConditionName` or `ItemType`, prioritize creating the Enum first, update the type definition to use the Enum, and provide a migration path (TODOs) for consumers to switch to strict Enum usage.

## 2024-05-20 - Missing Language Taxonomy
**Learning:** The D&D language system was completely missing, relying on implicit string definitions in race traits and purely UI-focused localization context. This gap prevented any mechanical interaction with languages (e.g., deciphering scripts).
**Action:** Created a full `Language` enum with `Script` and `Rarity` traits. Future personas should use this for the `Race` interface and character sheet.

## 2024-06-12 - SpellSchool Taxonomy
**Learning:** The `SpellSchool` type was previously a simple string union, which lacked the semantic depth required for UI tooltips and lore integration. By converting it to a string Enum and attaching `SpellSchoolTraits` (description, themes), we now have a single source of truth for both mechanical values and flavor text.
**Action:** Future updates to spell filtering UI can now directly iterate over `SpellSchoolDefinitions` to auto-generate tooltips and theme-colored tags, removing the need for scattered helper maps.
