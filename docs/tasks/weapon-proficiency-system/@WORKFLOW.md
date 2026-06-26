# Weapon Proficiency System - Workflow Guide

Last reviewed: 2026-06-25

Use this workflow for continuing the weapon-proficiency subtree after the core implementation already landed.

## What this subtree is for now

This subtree is no longer a start from task 01 packet. It is a mixed bundle of:

- preserved implementation notes for work that already landed
- audit evidence about weapon data
- active gap notes for combat-facing follow-through

## Working order

1. Read START-HERE.md for the verified current-state summary.
2. Check @PROJECT-INDEX.md to see which files are historical notes and which remain active gap notes.
3. Verify against live code before trusting any task language, especially older path references like src/components/InventoryList.tsx or src/utils/characterUtils.ts.

## Current code anchors to verify first

- src/utils/character/weaponUtils.ts
- src/utils/character/characterUtils.ts
- src/components/CharacterSheet/Overview/EquipmentMannequin.tsx
- src/components/CharacterSheet/Overview/InventoryList.tsx
- src/utils/combat/combatUtils.ts
- src/components/CharacterCreator/WeaponMasterySelection.tsx

## How to treat the task files

- Tasks 01 through 09 and 11 are retired; use `GAPS.md`, `TRACKER.md`, and the
  backlog retirement ledger instead of reopening those packet files.
- weapon-audit-report.md is evidence, not an instruction to blindly remove isMartial.

## Current focus areas

### Already landed enough to preserve, not rebuild

- Weapon Proficiency Check helper
- Permissive Weapon Equip Rule
- Inventory Weapon Filtering
- Equipped Weapon Warning
- Tooltip warning propagation

### Needs narrower follow-through

- Fresh rendered verification of the warning UX
- Fresh end-to-end proof that warning copy and attack penalty behavior align

## Review rule

When changing this subtree, prefer:

1. update stale planning language into current-state notes
2. preserve historical intent where useful
3. only create new work items for the concrete remaining combat gaps

<!-- aralia-backlog-walked: {"source":"docs/tasks/backlog-retirement/RETIREMENT_LEDGER.md","path":"docs/tasks/weapon-proficiency-system/@WORKFLOW.md","sha256WithoutMarker":"c5032ee26c0f35e492bc3b99a8e2a9797e75e0b1f32536b80ea2b4f410d45853","markedAtUtc":"2026-06-25T22:29:38.612Z"} -->
