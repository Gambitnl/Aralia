# Aralia Changelog

**Last Updated**: 2026-03-11  
**Purpose**: Preserve a high-level historical timeline of notable Aralia milestones without relying on the older broken split-changelog links.

## Status Of This File

This is a historical change log.

It is useful for broad project history, but it is not a current source-of-truth architecture guide, implementation checklist, or verification ledger.

## High-Level Historical Milestones

### 2025-07-17

- Living NPC work reached a major completion milestone, including memory, gossip, reputation, evidence, and consequence-linking surfaces.
- Character Creator underwent a major reducer-based overhaul with `useCharacterAssembly` and broader race/class flow work.

### 2025-07-15

- Barbarian class support was added to the game data and character-creation surface.
- Class-addition documentation became part of the broader project guidance.

### 2025-07-14

- App-level reducer/state logic moved toward a more modular architecture.

### 2025-07-13

- Large glossary and action-system refactors landed, including decomposition of action handling into more focused handlers.

### 2025-07-04

- Spellcasting data was pushed toward a `spellbook`-centered model.

### 2025-06-28

- Framer Motion entered the stack for UI animation work.
- Glossary-content workflow changed around `public/data/glossary/entries/`.

### 2025-06-20 through 2025-06-26

- A large iterative development period covered:
  - character-creation expansion
  - save/load work
  - reducer-based app state
  - glossary growth
  - modal, mapping, and interaction improvements
  - Gemini-related tooling and support surfaces

## Important Note About Older Entries

Earlier versions of this file linked to many detailed files under `docs/changelogs/`.

That directory does not currently exist in the maintained docs tree, so those older links are intentionally not repeated here as if they were still live.

Where possible, use the current root docs, architecture docs, task trees, and archive surfaces to recover more detailed context.

## Related Docs

- [`@PROJECT-OVERVIEW.README.md`](./@PROJECT-OVERVIEW.README.md) for the current high-level project summary
- [`ARCHITECTURE.md`](./ARCHITECTURE.md) for current subsystem orientation
- [`archive/`](./archive/) for preserved historical material
