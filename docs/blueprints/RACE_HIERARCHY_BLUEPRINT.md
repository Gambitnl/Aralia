# Race Hierarchy Blueprint

## Purpose

This file remains a planning blueprint for a more hierarchical race presentation and folder model in the character creator.
The important current-state correction is that the live repo has not adopted this blueprint literally. The current race data lane is much flatter and many of the older selection components the blueprint planned to delete still exist.

## Verified Current-State Surfaces

This pass confirmed:

- the live race data currently sits in a mostly flat src/data/races/ file lane
- raceGroups.ts already exists under src/data/races/
- the Character Creator race UI still includes dedicated selection components such as DragonbornAncestrySelection.tsx, TieflingLegacySelection.tsx, GiantAncestrySelection.tsx, GnomeSubraceSelection.tsx, HumanSkillSelection.tsx, CentaurNaturalAffinitySkillSelection.tsx, ChangelingInstinctsSelection.tsx, and RacialSpellAbilitySelection.tsx
- RaceSelection.tsx, RaceDetailPane.tsx, and RaceDetailModal.tsx still exist as the main current UI anchors

## What The Blueprint Still Contributes

The blueprint is still useful as a planning artifact for:

- desired grouping logic
- accordion and comparison-table behavior
- inline racial-choice UX goals
- future migration sequencing for race data and UI cleanup

## What Has Drifted From Repo Reality

- The repo has not moved to the nested folder structure shown in the blueprint; src/data/races/ is still predominantly flat.
- Several names in the blueprint do not match the current race IDs exactly because the live repo now contains renamed or project-specific variants such as beastborn_human, guardian_human, hearthkeeper_halfling, mender_halfling, runeward_dwarf, and wordweaver_gnome.
- The  delete obsolete selection components after migration step has not happened yet; those specialized components are still live in the CharacterCreator race subtree.

## Current Interpretation

Re-verified on 2026-03-11.
Treat this file as a preserved planning blueprint for a possible future hierarchy refactor, not as a description of the race architecture that currently exists in the repo.
