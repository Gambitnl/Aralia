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

## 2024-05-24 - SpellSchool Taxonomy
**Learning:** The `SpellSchool` type was just a string union, preventing us from attaching thematic descriptions or standardizing UI colors/icons centrally. By converting it to a String Enum, we maintained backward compatibility with JSON data (which stores schools as strings) while enabling a centralized `SpellSchoolTraits` system.
**Action:** Use `SpellSchoolDefinitions` to drive UI tooltips and filter logic instead of hardcoding school descriptions in components.

## 2025-05-02 - Alignment Taxonomy
**Learning:** `Alignment` was a simple string union, lacking the structure to define relationships (axes) or descriptions. By converting it to an Enum and adding `AlignmentTraits`, we can now systematically determine if an alignment is "Lawful" or "Evil" without string parsing, enabling alignment-based mechanics (e.g., *Protection from Evil and Good*) to function robustly.
**Action:** Future systems needing moral/ethical checks should inspect the `AlignmentDefinitions` traits rather than checking for substrings like "Lawful".
