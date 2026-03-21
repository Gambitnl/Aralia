# Mason: Plan for Breaking Circular Dependencies in src/types

Last Reviewed: 2026-03-12
Status: Preserved refactor plan / partially landed modularization note

## Purpose

This file preserves one specific plan for reducing circular dependency pressure in the type lane.
It should now be read as a preserved refactor note, not as a literal statement that the repo still only has one monolithic types barrel.

## Verified Current State

A manual repo check during the 2026-03-12 doc pass confirmed:
- src/types/core.ts exists
- src/types/items.ts exists
- src/types/character.ts exists
- src/types/index.ts still exists as the barrel surface
- the type lane has already been decomposed more than this older plan implies

## What The Plan Still Captures Well

The preserved plan still points at a real concern:
- circular dependencies around shared type barrels can make the type layer brittle
- domain-specific type files are healthier than one all-consuming root file
- combat, character, and item types benefit from clearer dependency direction

## What Drifted

The older plan assumed the decomposition had not happened yet.
That is no longer current. The repo already contains the core, items, and character files named here, which makes this note more useful as preserved rationale than as a literal next-step checklist.

## Current Reading Rule

Use this file as preserved refactor rationale for continued dependency cleanup in src/types.
For current implementation truth, inspect the live files under ../../src/types/ and the current import graph around index.ts and combat.ts.
