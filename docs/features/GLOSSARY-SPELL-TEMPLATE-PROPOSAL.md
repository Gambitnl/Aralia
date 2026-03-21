# Feature Proposal: Template-Based Spell Rendering

## Purpose

This file should now be read as a historical feature proposal that overlaps with work the repo has already partly absorbed.
The core problem it described was real, but the current glossary and spell index flow has already moved away from some of the assumptions in the original note.

## Verified Current-State Corrections

This pass confirmed:

- glossary entries are JSON files with embedded markdown fields under public/data/glossary/entries/
- the glossary index generator already has spell-specific logic in scripts/generateGlossaryIndex.js
- the generator builds spell index entries from public/data/spells_manifest.json rather than from a dedicated spell-markdown folder contract
- the rules glossary still contains spell-related glossary entries under public/data/glossary/entries/rules/spells/

## What Still Holds Up

The underlying concern about duplicated spell-display sources was legitimate.
A template-driven spell rendering approach is still a coherent architectural direction if the project wants one single display source for spell detail cards.

## What Has Drifted

- The repo no longer cleanly matches the older  every spell requires JSON plus glossary markdown framing.
- Current glossary entry content is already JSON-based, not raw standalone markdown files.
- The spell glossary and spell-manifest flow now pass through generateGlossaryIndex.js in a more specialized way than the original note assumed.
- The old related-plan path under C:\Users\gambi\.claude\plans\ is not a repo-local reference and should not be treated as part of the maintained documentation surface.

## Current Interpretation

Re-verified on 2026-03-11.
Treat this file as a preserved proposal note for a partly superseded direction: still useful for understanding the original duplication problem, but no longer accurate as a description of the repo's current spell-glossary architecture.
