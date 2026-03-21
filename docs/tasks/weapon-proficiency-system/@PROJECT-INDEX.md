# Weapon Proficiency System - Project Index

Last verified: 2026-03-12

This file is the current truth surface for the weapon-proficiency subtree. It replaces the older phase-tracker assumptions that treated the whole feature as either unstarted or cleanly phase-complete.

## Status summary

- Landed core: Weapon Proficiency Check, Permissive Weapon Equip Rule, Inventory Weapon Filtering, Equipped Weapon Warning
- Landed or partially landed combat support: isProficient tagging on weapon abilities, Weapon Mastery Proficiency Gate during combat ability generation
- Still open: Attack Roll Proficiency Penalty in the final roll pipeline, Combat Weapon Proficiency Warning surfaces, fresh end-to-end verification

## File status

| File | Class | Current disposition | Verified note |
|------|-------|---------------------|---------------|
| README.md | subtree landing page | rewritten current-state index | Rebased onto current repo reality. |
| START-HERE.md | subtree overview | rewritten current-state overview | Replaces the stale planning-phase narrative. |
| @WORKFLOW.md | working guide | rewritten current workflow | Use this when continuing combat-facing follow-through. |
| TASK-TEMPLATE.md | generic template | keep in place | Still usable as a neutral template; not a truth surface. |
| weapon-audit-report.md | audit evidence | rewritten in place | Preserve the historical audit but warn where its conclusions are no longer current truth. |
| 01-add-weapon-proficiency-helper.md | historical implementation note | rewritten in place | Helper exists in src/utils/character/weaponUtils.ts. |
| 02-integrate-proficiency-check.md | historical implementation note | rewritten in place | canEquipItem() now carries the permissive warning path. |
| 03-update-inventory-filtering.md | historical verification note | rewritten in place | Inventory filtering currently uses canEquipItem() from the Character Sheet inventory surface. |
| 04-equipped-weapon-warnings.md | historical UI implementation note | rewritten in place | Mannequin warning exists in src/components/CharacterSheet/Overview/EquipmentMannequin.tsx. |
| 05-update-tooltips.md | historical UI implementation note | rewritten in place | Warning text currently reaches tooltip content through shared reason plumbing. |
| 06-inventory-indicators.md | historical UI implementation note | rewritten in place | Inventory surface is real, but the warning is mostly tooltip-driven rather than a dedicated badge-heavy indicator system. |
| 07-audit-weapon-data.md | historical audit task | rewritten in place | Audit was performed; use the report with current-state cautions. |
| 08-fix-proficiency-flags.md | historical data-change note | rewritten in place | Full isMartial standardization did not fully land the way the old task claimed. |
| 09-attack-roll-penalties.md | active gap note | rewritten in place | Final attack-bonus stripping for non-proficient weapons remains unproven here. |
| 10-weapon-mastery-integration.md | active gap note | rewritten in place | A proficiency gate already exists in combat ability generation; any remaining work is narrower than the old file claims. |
| 11-combat-ui-warnings.md | active gap note | rewritten in place | No dedicated combat warning surface was verified in this pass. |

## Verified code anchors

- src/utils/character/weaponUtils.ts
- src/utils/weaponUtils.ts as a bridge export only
- src/utils/character/characterUtils.ts
- src/utils/characterUtils.ts as a bridge export only
- src/components/CharacterSheet/Overview/EquipmentMannequin.tsx
- src/components/CharacterSheet/Overview/InventoryList.tsx
- src/components/CharacterCreator/WeaponMasterySelection.tsx
- src/utils/combat/combatUtils.ts
- src/utils/character/__tests__/weaponUtils.test.ts

## Remaining concrete follow-through

- Re-verify or implement Attack Roll Proficiency Penalty in the final combat modifier pipeline.
- Verify whether combat selection UI needs a dedicated Combat Weapon Proficiency Warning surface.
- Re-run rendered verification for mannequin and inventory warning UX before claiming the warning layer is fully settled.