# Task 04: Add Equipped Weapon Proficiency Warnings

Status: historical UI implementation note
Last reviewed: 2026-03-12

## Current reading

This is now a preserved UI implementation note for behavior that already landed.

## Verified landing

Manual repo verification on 2026-03-12 confirmed that src/components/CharacterSheet/Overview/EquipmentMannequin.tsx:

- imports isWeaponProficient() and isWeaponMartial()
- marks non-proficient equipped weapons as proficiencyMismatch
- uses the existing red warning treatment already shared with armor mismatches
- carries the mismatch reason into tooltip content

The main thing this file still does not prove is rendered visual verification. The source code now matches the intended Equipped Weapon Warning behavior, but the warning still needs screenshot-level verification before anyone should claim the final UX is visually settled.