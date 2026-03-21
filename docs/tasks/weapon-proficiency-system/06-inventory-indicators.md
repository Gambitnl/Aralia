# Task 06: Add Inventory Visual Indicators for Proficiency

Status: historical UI implementation note
Last reviewed: 2026-03-12

## Current reading

This file now serves as a preserved inventory-warning note rather than a still-unstarted UI task.

## Verified current state

Manual repo verification on 2026-03-12 confirmed that the Character Sheet inventory surface already routes weapon eligibility through canEquipItem() and surfaces the warning through tooltip content.

What this pass did not verify is a dedicated always-visible badge or icon for non-proficient weapons. So the correct current reading is:

- Inventory Weapon Proficiency support exists
- the current warning is largely reason-driven and tooltip-driven
- a stronger always-visible indicator could still be future UI work if desired, but the subtree should not claim that no inventory warning path exists at all