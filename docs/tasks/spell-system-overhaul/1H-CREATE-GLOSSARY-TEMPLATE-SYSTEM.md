# Path 2.E: Spell Description Glossary Linking

**Status:** Active capability gap note
**Last Reviewed:** 2026-03-12

## Purpose

Track the still-open capability of linking spell-description terms to the live glossary surfaces without pretending the older template-system brief still matches the current repo.

## Verified Current State

- src/context/GlossaryContext.tsx exists and loads the generated glossary index tree.
- src/components/Glossary/GlossaryTooltip.tsx exists and can resolve a glossary entry by termId.
- src/components/CharacterSheet/Spellbook/SpellDetailPane.tsx still renders spell.description and spell.higherLevels as plain text.
- public/data/glossary/index/spells.json exists.
- public/data/glossary/spell-terms-template.json does not exist.
- public/data/glossary/entries/spells/ does not exist.
- The current repo does not show a structured glossaryTerms field on the spell data lane.

## Concrete Capability Name

- Spell Description Glossary Linking

## Current Follow-Through

1. Decide whether term links should be driven by explicit spell metadata, a curated shared term map, or text parsing at render time.
2. If explicit metadata wins, define one concrete spell-data field instead of reviving the old loose template wording.
3. Route linked rendering through SpellDetailPane.tsx or its successor using the existing glossary context and tooltip path.
4. Add new glossary source files only if the needed terms are actually missing from the current indexed glossary surfaces.

## What This File No Longer Assumes

- that a spell-term template JSON already exists
- that spell glossary entries live in a dedicated public/data/glossary/entries/spells/ markdown lane
- that a template-generation step is the only viable path to spell glossary linking
