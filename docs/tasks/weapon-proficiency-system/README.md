# Weapon Proficiency System

Current-state task packet for Aralia's weapon proficiency behavior.

This subtree is no longer a greenfield plan. Manual repo verification on 2026-03-12 confirmed that the core helper, permissive equip rule, inventory wiring, mannequin warning, and weapon-mastery proficiency gate already exist in code. Follow-up proof on 2026-06-25 confirmed attack-roll penalty regression coverage and added a combat ability-button warning surface. The remaining work is narrower: rendered warning verification and end-to-end alignment proof.

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

- Tasks 01 through 09 and 11 were retired on 2026-06-25 after their useful
  implementation history and active work were centralized in `GAPS.md`,
  `TRACKER.md`, and the backlog retirement ledger.
- Task 10 was retired earlier into the living gap rows.
- weapon-audit-report.md remains the preserved audit evidence packet, but its older recommendation to remove isMartial should not be treated as already-landed truth.

## Current capability summary

- Weapon Proficiency Check: implemented
- Permissive Weapon Equip Rule: implemented
- Inventory Weapon Proficiency Filtering: implemented
- Equipped Weapon Warning: implemented
- Inventory Weapon Proficiency Tooltip: implemented through shared warning text
- Weapon Mastery Proficiency Gate: implemented in combat ability generation; downstream bypass and warning proof stay in `GAPS.md`
- Attack Roll Proficiency Penalty: verified in command and opportunity attack tests
- Combat Weapon Proficiency Warning: implemented on the combat ability button; rendered flow verification remains open

## Historical note

Most files in this subtree were written in December 2025 as forward-looking task briefs. They are being preserved because they explain intent and landing order, but they should now be read through the verified-current-state framing in this subtree rather than as untouched implementation instructions.

<!-- aralia-backlog-walked: {"source":"docs/tasks/backlog-retirement/RETIREMENT_LEDGER.md","path":"docs/tasks/weapon-proficiency-system/README.md","sha256WithoutMarker":"8a4a4e15f1ee00225c959d25f9840aceeb4ac959b1b08264959ec1bb5dd385a5","markedAtUtc":"2026-06-25T22:29:38.614Z"} -->
