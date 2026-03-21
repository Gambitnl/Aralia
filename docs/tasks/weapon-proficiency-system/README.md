# Weapon Proficiency System

Current-state task packet for Aralia's weapon proficiency behavior.

This subtree is no longer a greenfield plan. Manual repo verification on 2026-03-12 confirmed that the core helper, permissive equip rule, inventory wiring, mannequin warning, and weapon-mastery proficiency gate already exist in code. The remaining work is narrower: combat-roll penalty enforcement, combat-facing warning surfaces, and any follow-through tests or visual verification that have not been rerun recently.

## Start surfaces

- [START-HERE.md](START-HERE.md): verified current-state overview and remaining gaps
- [@PROJECT-INDEX.md](@PROJECT-INDEX.md): file-by-file status and disposition for this subtree
- [@WORKFLOW.md](@WORKFLOW.md): how to work this subtree now that core implementation already landed
- [TASK-TEMPLATE.md](TASK-TEMPLATE.md): generic template retained for future bounded follow-up tasks

## Verified code anchors

- src/utils/character/weaponUtils.ts: shared Weapon Proficiency Check helper and Weapon Category helper
- src/utils/character/characterUtils.ts: permissive canEquipItem warning path for non-proficient weapons
- src/components/CharacterSheet/Overview/EquipmentMannequin.tsx: Equipped Weapon Warning surface
- src/components/CharacterSheet/Overview/InventoryList.tsx: inventory filtering and tooltip plumbing
- src/utils/combat/combatUtils.ts: combat ability generation carries isProficient and Weapon Mastery Proficiency Gate
- src/components/CharacterCreator/WeaponMasterySelection.tsx: older class-creation proficiency filtering reference

## Subtree shape

- Tasks 01 through 08 now function mostly as preserved implementation and audit notes for work that already landed.
- Tasks 09 through 11 remain the active gap notes for combat-roll penalties and combat-facing warning UX.
- weapon-audit-report.md remains the preserved audit evidence packet, but its older recommendation to remove isMartial should not be treated as already-landed truth.

## Current capability summary

- Weapon Proficiency Check: implemented
- Permissive Weapon Equip Rule: implemented
- Inventory Weapon Proficiency Filtering: implemented
- Equipped Weapon Warning: implemented
- Inventory Weapon Proficiency Tooltip: implemented through shared warning text
- Weapon Mastery Proficiency Gate: partially implemented in combat ability generation
- Attack Roll Proficiency Penalty: not yet verified as enforced in final attack resolution
- Combat Weapon Proficiency Warning: not yet verified in the combat UI

## Historical note

Most files in this subtree were written in December 2025 as forward-looking task briefs. They are being preserved because they explain intent and landing order, but they should now be read through the verified-current-state framing in this subtree rather than as untouched implementation instructions.