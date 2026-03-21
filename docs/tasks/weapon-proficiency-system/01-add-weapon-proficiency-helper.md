# Task 01: Weapon Proficiency Helper Function

Status: historical implementation note
Last reviewed: 2026-03-12

## Current reading

This task now serves as a preserved implementation note for work that already landed.

## Verified landing

Manual repo verification on 2026-03-12 confirmed:

- src/utils/character/weaponUtils.ts exists and exports isWeaponProficient() plus isWeaponMartial().
- src/utils/weaponUtils.ts now serves only as a bridge export to the character utility path.
- src/utils/character/__tests__/weaponUtils.test.ts exists, so the helper has dedicated test coverage.
- The helper still uses category first and isMartial as a fallback, which means the older remove isMartial entirely plan did not fully land.

## Why this note still matters

This file preserves the design intent for the shared Weapon Proficiency Check capability:

- one reusable helper
- blanket Simple vs Martial proficiency support
- specific-weapon proficiency support
- compatibility with mixed historical weapon data

Use the current helper implementation as truth, not the old new-file creation language this task originally carried.