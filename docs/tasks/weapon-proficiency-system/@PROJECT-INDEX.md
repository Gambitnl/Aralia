# Weapon Proficiency System - Project Index

Last verified: 2026-06-25

This file is the current truth surface for the weapon-proficiency subtree. It replaces the older phase-tracker assumptions that treated the whole feature as either unstarted or cleanly phase-complete.

## Status summary

- Landed core: Weapon Proficiency Check, Permissive Weapon Equip Rule, Inventory Weapon Filtering, Equipped Weapon Warning
- Landed or partially landed combat support: isProficient tagging on weapon abilities, Weapon Mastery Proficiency Gate during combat ability generation
- Still open: fresh rendered/end-to-end verification for combat warning placement
  and penalty messaging alignment

## File status

| File | Class | Current disposition | Verified note |
|------|-------|---------------------|---------------|
| README.md | subtree landing page | rewritten current-state index | Rebased onto current repo reality. |
| START-HERE.md | subtree overview | rewritten current-state overview | Replaces the stale planning-phase narrative. |
| @WORKFLOW.md | working guide | rewritten current workflow | Use this when continuing combat-facing follow-through. |
| TASK-TEMPLATE.md | generic template | keep in place | Still usable as a neutral template; not a truth surface. |
| weapon-audit-report.md | audit evidence | rewritten in place | Preserve the historical audit but warn where its conclusions are no longer current truth. |
| 01-add-weapon-proficiency-helper.md | historical implementation note | retired 2026-06-25 | Helper exists in src/utils/character/weaponUtils.ts. |
| 02-integrate-proficiency-check.md | historical implementation note | retired 2026-06-25 | canEquipItem() now carries the permissive warning path. |
| 03-update-inventory-filtering.md | historical verification note | retired 2026-06-25 | Inventory filtering currently uses canEquipItem() from the Character Sheet inventory surface. |
| 04-equipped-weapon-warnings.md | historical UI implementation note | retired 2026-06-25 | Mannequin warning exists in src/components/CharacterSheet/Overview/EquipmentMannequin.tsx. |
| 05-update-tooltips.md | historical UI implementation note | retired 2026-06-25 | Warning text currently reaches tooltip content through shared reason plumbing. |
| 06-inventory-indicators.md | historical UI implementation note | retired 2026-06-25 | Inventory surface is real, but the warning is mostly tooltip-driven rather than a dedicated badge-heavy indicator system. |
| 07-audit-weapon-data.md | historical audit task | retired 2026-06-25 | Audit was performed; use the report with current-state cautions. |
| 08-fix-proficiency-flags.md | historical data-change note | retired 2026-06-25 | Full isMartial standardization did not fully land the way the old task claimed. |
| 09-attack-roll-penalties.md | verified gap note | retired 2026-06-25 | Command and opportunity attack paths omit proficiency bonus for non-proficient weapons and have focused regression coverage. |
| 10-weapon-mastery-integration.md | retired gap note | retired 2026-06-25 | Focused tests confirmed the core mastery/proficiency gate; remaining warning and bypass work is routed through `GAPS.md` G1-G3. |
| 11-combat-ui-warnings.md | executed gap note | retired 2026-06-25 | AbilityButton now shows a warning marker and accessible/tooltip text for non-proficient weapon attacks; rendered sign-off remains in `GAPS.md` G2. |

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

## Routed Follow-through

The remaining follow-through is no longer tracked as loose backlog here.
Use `GAPS.md` and `TRACKER.md` instead:

- Attack roll proficiency penalty bypass checks were closed in `GAPS.md` G3.
- Combat weapon proficiency warning UI was implemented and closed in `GAPS.md` G1.
- Fresh rendered verification for warning and penalty alignment routes to `GAPS.md` G2 and `TRACKER.md` T2.

<!-- aralia-backlog-walked: {"source":"docs/tasks/backlog-retirement/RETIREMENT_LEDGER.md","path":"docs/tasks/weapon-proficiency-system/@PROJECT-INDEX.md","sha256WithoutMarker":"3e633802348cc496b7bcdbf1d445a0234efda1d449371e95a8afd7c629cb705a","markedAtUtc":"2026-06-25T22:29:38.611Z"} -->
