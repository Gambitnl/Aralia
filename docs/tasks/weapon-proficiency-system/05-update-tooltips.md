# Task 05: Update Tooltips with Proficiency Status

Status: historical UI implementation note
Last reviewed: 2026-03-12

## Current reading

This is now a preserved tooltip implementation note.

## Verified landing

Manual repo verification on 2026-03-12 confirmed:

- EquipmentMannequin.tsx already pushes the proficiency mismatch reason into its tooltip surface
- InventoryList.tsx builds tooltip content from the shared warning reason returned by canEquipItem()
- src/components/ui/Tooltip.tsx remains the shared tooltip shell; this subtree did not need a dedicated tooltip component rewrite

What remains unverified here is rendered behavior, not the source-code wiring. This file should therefore be read as a landed wiring note plus a reminder that visual verification still matters.