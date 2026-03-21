# Weapon Proficiency System - Verified Current State

Last reviewed: 2026-03-12

This document replaces the older planning-phase framing for the weapon proficiency subtree. The core question is no longer how do we build weapon proficiency, but which parts already landed, which parts are still partial, and which combat-facing gaps remain.

## Verified current state

### Landed core behavior

- src/utils/character/weaponUtils.ts exports isWeaponProficient() and isWeaponMartial().
- src/utils/character/characterUtils.ts routes weapon items through canEquipItem() and returns a permissive warning reason when the character is not proficient.
- src/components/CharacterSheet/Overview/EquipmentMannequin.tsx shows an Equipped Weapon Warning using the same red warning treatment used for armor mismatches.
- src/components/CharacterSheet/Overview/InventoryList.tsx uses canEquipItem() during slot filtering, so non-proficient weapons stay equippable while still carrying the warning reason into tooltip content.
- src/utils/character/__tests__/weaponUtils.test.ts exists, so the helper is not just a doc claim.

### Partially landed combat behavior

- src/utils/combat/combatUtils.ts carries isProficient on generated weapon abilities.
- The same file only attaches ability.mastery when the weapon is proficient and selected, which means a Weapon Mastery Proficiency Gate already exists in combat ability generation.
- That same file still expects external attack modifiers to be passed into resolveAttack(). This pass did not prove that the final attack-bonus pipeline already strips proficiency bonus for non-proficient weapon attacks.

### Still-open or still-unverified gaps

- Attack Roll Proficiency Penalty in the final combat modifier pipeline
- Combat Weapon Proficiency Warning surfaces during attack selection or action confirmation
- Fresh rendered verification for inventory and mannequin warning UX
- Fresh end-to-end testing that proves the warning text and combat penalties stay aligned

## Rules frame

The subtree consistently assumes the permissive 2024 DnD model:

- characters can equip weapons they are not proficient with
- non-proficient weapons should lose proficiency bonus on attack rolls
- non-proficient weapons should not grant weapon mastery effects
- warning UX should explain the penalty without blocking the action

## File map

- README.md: concise subtree landing page
- @PROJECT-INDEX.md: verified file-by-file status
- @WORKFLOW.md: how to work this subtree now
- 01-add-weapon-proficiency-helper.md through 08-fix-proficiency-flags.md: preserved implementation and audit notes for work that already landed or partially landed
- 09-attack-roll-penalties.md through 11-combat-ui-warnings.md: remaining combat-facing follow-through notes
- weapon-audit-report.md: preserved audit evidence with a current-state header

## Reading guidance

Do not treat the older December 2025 phase sequence in this subtree as current truth. Use the verified code anchors first, then use the task files as preserved landing history or gap notes.