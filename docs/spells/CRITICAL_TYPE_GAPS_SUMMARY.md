# Critical Type Definition Gaps - Summary

Last Updated: 2026-03-11
Purpose: Preserve the historical record of an earlier spell-schema blocking phase without leaving the file looking like a current blocker report.

## Historical Status

This file is no longer a current blocking-status document.

It reflects an earlier point in the spell-overhaul effort when the schema still lacked key surfaces that are now present in the repo.

## What Changed Since The Original Version

The following gaps described by the older version are now represented in the current spell validation surface:
- ritual support
- rarity support
- combat and exploration casting-cost structure
- nontrivial effect definitions for movement, defensive, summoning, terrain, and utility lanes

That means this file should now be read as preserved migration history rather than active stop-work guidance.

## Current Source Of Truth

For current spell-shape truth, use:
- src/systems/spells/validation/spellValidator.ts
- docs/guides/SPELL_DATA_CREATION_GUIDE.md
- docs/guides/SPELL_IMPLEMENTATION_CHECKLIST.md
- docs/spells/SPELL_PROPERTIES_REFERENCE.md

## Why Keep This File

This file still has historical value because it explains:
- why the schema had to expand before migration could scale
- which categories of spell behavior were once under-modeled
- why older migration docs are so focused on type and validator completeness

## Current Interpretation Rule

Do not treat this file as proof that these gaps are still open.

If a modern spell still fails, verify the current validator and runtime consumer surfaces directly instead of using this file as a live blocker list.
