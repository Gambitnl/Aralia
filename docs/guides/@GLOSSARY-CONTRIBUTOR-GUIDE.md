# Aralia Glossary: Contributor Guide

This guide documents the current JSON-driven glossary contribution flow.
The important current-state correction is that the glossary is already JSON-based and that spell-related glossary content is no longer well-described by the older  spell markdown file worldview.

## Current Structure

Glossary content is split between:

- entries under public/data/glossary/entries/
- generated index files under public/data/glossary/index/

This pass verified live entry families under rules, races, and classes, along with nested subfolders such as rules/conditions, rules/crafting, rules/spells, and the race lineage or variant folders.

## Entry Format

The current entry format is still JSON with fields such as:

- id
- title
- category
- tags
- excerpt
- aliases
- seeAlso
- filePath
- markdown

This was verified directly against public/data/glossary/entries/rules/advantage.json.

## Contribution Rules

1. Create or update a JSON file under the correct glossary entry category.
2. Keep ids unique across the glossary.
3. Keep filePath aligned with the actual location under public/data/glossary/entries/.
4. Use the markdown field for the rendered body content.
5. Regenerate the glossary index after adding, moving, or renaming entries.

## Cross-Linking Note

The markdown field still supports glossary-link syntax and richer formatted content, but contributors should treat that as entry-body content inside JSON rather than as a separate markdown-file workflow.

## Spell-Specific Correction

The older version of this guide implied a cleaner split where spell glossary content lived in its own dedicated markdown lane.
That no longer reflects the current repo.
This pass confirmed that:

- spell-related glossary content exists under rules/spells within the glossary entries tree
- scripts/generateGlossaryIndex.js already contains spell-specific index logic based on the spell manifest

So spell additions and spell glossary behavior should be treated as a specialized workflow layered on top of the broader JSON glossary system, not as a simple parallel markdown-file lane.

## Regenerating The Index

After adding or moving glossary entry files, regenerate the glossary index with:

- node scripts/generateGlossaryIndex.js

The generated files under public/data/glossary/index/ should still be treated as derived outputs rather than hand-maintained content.

## Related Guidance

For race additions that also affect character-creator behavior, use the repo-local race guides in docs/guides/ rather than the older file-URL link style that pointed outside the current workspace.

## Current Interpretation

Re-verified on 2026-03-11.
Treat this file as the live contributor guide for JSON glossary entries, while handling spell-specific glossary behavior as a specialized extension of that flow rather than as a separate markdown-document system.
