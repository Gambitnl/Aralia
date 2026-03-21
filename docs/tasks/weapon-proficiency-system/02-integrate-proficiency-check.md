# Task 02: Integrate Weapon Proficiency Check into canEquipItem

Status: historical implementation note
Last reviewed: 2026-03-12

## Current reading

This task is now a historical implementation note for a behavior that already landed.

## Verified landing

Manual repo verification on 2026-03-12 confirmed:

- src/utils/character/characterUtils.ts now routes weapon items through canEquipItem().
- Non-proficient weapons return can: true together with a warning reason that explains the lost proficiency bonus and weapon mastery access.
- The same file uses isWeaponMartial() for the displayed weapon-type wording.
- src/utils/characterUtils.ts is now only a bridge export path, so older references to that flat path are historical.

## What this preserved task still explains

- why the system is permissive instead of blocking equip
- why the warning reason belongs in canEquipItem()
- why downstream UI surfaces can reuse the same reason string instead of inventing parallel messaging

The core implementation exists. Any future work here should be about message consistency or new combat plumbing, not about adding the first weapon proficiency check.