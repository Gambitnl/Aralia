# Auditor Worklog

## 2024-05-22 - Cantrip Scaling Data vs. Engine Mismatch

**Learning:** The spell data files were using `bonusPerLevel` (a linear scaling concept) or unparseable text strings for cantrips, while the `ScalingEngine` was hardcoded to use a 5/11/17 multiplier logic. This mismatch meant that any cantrip deviating from standard dice multiplication (e.g. Acid Splash or Eldritch Blast) was impossible to implement correctly.

**Action:** When auditing systems driven by data files, always verify that the engine actually *reads* the fields present in the data. Just because a field like `customFormula` exists in the JSON doesn't mean the code uses it.

## 2024-05-25 - Implicit Rules in Structured Data (Enchantment Immunities)

**Learning:** "Enchantment" spells in D&D 5e have strong implicit targeting rules (Immunity to Charmed, Undead/Construct immunity) that are often omitted from structured JSON data because they are "assumed" or buried in description text. A purely schema-based validation misses these gaps because the fields are optional.

**Action:** Build "Semantic Validators" (`LegacySpellValidator`) that enforce domain-specific rules (e.g., "If School=Enchantment, require ExclusionFilter") rather than just checking type correctness.

## 2024-05-25 - Systematic Targeting Gaps in JSON

**Learning:** A systematic audit of Level 1 spells revealed that text-based targeting constraints (e.g., "no effect on Undead") are consistently missing from the `targeting.filter` JSON objects. This forces the engine to rely on unstable text parsing or the honor system.

**Action:** Created `src/systems/spells/validation/TargetingPresets.ts` to provide standardized, reusable filter configurations. Future audits should map these text constraints to these strict constants.

## 2024-05-25 - Invalid Enums in Modal Spells

**Learning:** Spells that offer a choice (e.g., *Blindness/Deafness*) often force invalid data into required fields (e.g., `statusCondition.name: "Blinded/Deafened"`) because the schema lacks a "Choice" structure. This passes loose JSON validation but fails strict Type checks or runtime lookups.

**Action:** Created `GAP-CHOICE-SPELLS.md`. In the interim, always default to the primary effect (e.g., "Blinded") and use `arbitrationType: "player_choice"` to signal the UI/AI to intervene, rather than corrupting the data field with invalid values.

## 2024-05-26 - "Save Half" on Cantrips (Copy-Paste Error)

**Learning:** An audit of Level 0 spells revealed that 30% of saving-throw cantrips (specifically *Thunderclap*, *Toll the Dead*, *Word of Radiance*) incorrectly used `saveEffect: "half"`. This is likely due to copy-pasting from leveled AoE spells like *Burning Hands*. Cantrips in 5e are strictly "all or nothing".

**Action:** Created `scripts/audits/cantrip_save_audit.ts` to strictly enforce `saveEffect: "none"` (or "negates_condition") for all Level 0 spells. This semantic check should be integrated into the main `spellValidator.ts` pipeline.
