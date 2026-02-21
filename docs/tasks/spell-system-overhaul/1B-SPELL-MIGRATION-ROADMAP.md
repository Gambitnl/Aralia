# Spell System - Feature Roadmap (Rebased)

**Last Updated**: Feb 16, 2026  
**Status**: Active / Rebased  
**Purpose**: Maintain a feature-first roadmap for spell data, runtime behavior, and validation.

---

## Verified Current State (Fact-Checked)

- Spell JSON files in `public/data/spells/`: **469**
- Spell manifest entries in `public/data/spells_manifest.json`: **469**
- Folder structure is already levelized: `level-0` through `level-9`
- No root-level spell JSON files remain under `public/data/spells/`
- Validation command exists and is active: `npm run validate`

### Level Distribution

- `level-0`: 44
- `level-1`: 68
- `level-2`: 65
- `level-3`: 68
- `level-4`: 47
- `level-5`: 59
- `level-6`: 45
- `level-7`: 27
- `level-8`: 24
- `level-9`: 22

---

## Feature Tree for Roadmap Visualizer

### Feature: Spell Data Architecture

**Goal**: Keep spell data consistent, discoverable, and migration-safe.

**Sub-features**
- Level-based file topology (`public/data/spells/level-{N}/`) - **Active**
- Manifest integrity (`public/data/spells_manifest.json`) - **Active**
- Duplicate detection and ID hygiene - **Active**
- Legacy migration cleanup tooling - **Active**

### Feature: Spell Retrieval and Runtime Wiring

**Goal**: Ensure runtime systems can load and resolve spells reliably.

**Sub-features**
- Manifest-driven spell lookup (`src/services/SpellService.ts`) - **Active**
- Glossary/runtime integration (`src/context/SpellContext.tsx`, glossary components) - **Active**
- Path and level gate checks (`src/hooks/useSpellGateChecks.ts`) - **Active**

### Feature: Spell Rules Execution

**Goal**: Convert spell data into correct in-game behavior.

**Sub-features**
- Command/effect execution pipeline - **Active**
- Targeting and save/concentration mechanics - **Active**
- Mechanical consistency validation - **Active**

### Feature: Spell QA and Audit Loop

**Goal**: Continuously verify data correctness and implementation quality.

**Sub-features**
- Data validation pipeline (`scripts/validate-data.ts`) - **Active**
- Spell integrity and consistency audits (`scripts/check-spell-integrity.ts`, validators) - **Active**
- Batch audit/reporting workflows - **Active**

---

## Open Tasks (From This Pass)

- [ ] Normalize progress tracking in registry rows to explicit percentages where possible.
- [ ] Resolve known identifier collisions in related roadmap docs that can break deterministic node IDs.
- [ ] Define phase gates for when spell migration is considered "complete enough" versus "fully complete."
- [ ] Split future spell docs by feature area when one document mixes data migration, runtime logic, and QA.

---

## Historical Note

The prior November 2025 version of this document was migration-batch oriented (for example: "10 spells migrated", "33 cantrips remaining").  
Current codebase evidence indicates the spell dataset has already moved far beyond that baseline. This roadmap now tracks feature health instead of early migration batch choreography.

---

## Working Rule

This is a living feature roadmap.  
When processing related docs, update this file to reflect:
- what is verifiably implemented,
- what remains open,
- and which sub-features changed state.

