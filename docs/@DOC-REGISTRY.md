# Documentation Registry

**Last Updated**: 2026-03-11  
**Purpose**: Track the numbered work-doc families that still depend on an explicit registry, while documenting the numbering exceptions that the broader documentation migration still needs to normalize.

## What This Registry Covers

This file is no longer presented as a complete master index of every markdown file in the repository.

It currently tracks:
- the main numbered work-doc families that still use explicit registry guidance
- retired-number conventions where those families are already using `~`
- known numbering anomalies that must be preserved and reviewed, not silently flattened

It does not try to be:
- a full inventory of every doc under `docs/`
- a source of truth for excluded roadmap-tooling docs
- a guarantee that every numbered file outside the tracked families has already been normalized

For the broader doc-system structure, see [@DOCUMENTATION-GUIDE.md](./@DOCUMENTATION-GUIDE.md). For the active migration queue, see [docs/registry/@DOC-REVIEW-LEDGER.md](./registry/@DOC-REVIEW-LEDGER.md).

## Tracked Numbered Families

### Spell System Overhaul

**Location**: `docs/tasks/spell-system-overhaul/`

This subtree currently contains both a primary numbered strand and several side-numbered documents.

#### Primary numbered strand on disk

| Identifier | File | Current file-state note |
|------------|------|-------------------------|
| 1A | [1A-PROJECT-MASTER-SPRINGBOARD.md](./tasks/spell-system-overhaul/1A-PROJECT-MASTER-SPRINGBOARD.md) | present |
| 1B | [1B-SPELL-MIGRATION-ROADMAP.md](./tasks/spell-system-overhaul/1B-SPELL-MIGRATION-ROADMAP.md) | present |
| 1C | [1C~VERSION-DISPLAY-AND-PACKAGE-FIX.md](./tasks/spell-system-overhaul/1C~VERSION-DISPLAY-AND-PACKAGE-FIX.md) | retired marker present |
| 1D | [1D-ARCHIVE-OLD-SPELL-DOCS.md](./tasks/spell-system-overhaul/1D-ARCHIVE-OLD-SPELL-DOCS.md) | present |
| 1E | [1E-CONSOLIDATE-JULES-WORKFLOW.md](./tasks/spell-system-overhaul/1E-CONSOLIDATE-JULES-WORKFLOW.md) | present |
| 1F | [1F-AUDIT-SPELL-SCOPE.md](./tasks/spell-system-overhaul/1F-AUDIT-SPELL-SCOPE.md) | present |
| 1F | [1F-VERSION-REVIEW-AGENT-CONCEPT.md](./tasks/spell-system-overhaul/1F-VERSION-REVIEW-AGENT-CONCEPT.md) | duplicate identifier present |
| 1G | [1G-REORGANIZE-SPELL-FILES.md](./tasks/spell-system-overhaul/1G-REORGANIZE-SPELL-FILES.md) | present |
| 1H | [1H-CREATE-GLOSSARY-TEMPLATE-SYSTEM.md](./tasks/spell-system-overhaul/1H-CREATE-GLOSSARY-TEMPLATE-SYSTEM.md) | present |
| 1I | [1I-MIGRATE-CANTRIPS-BATCH-1.md](./tasks/spell-system-overhaul/1I-MIGRATE-CANTRIPS-BATCH-1.md) | present |
| 1J | [1J-MIGRATE-CANTRIPS-BATCH-2.md](./tasks/spell-system-overhaul/1J-MIGRATE-CANTRIPS-BATCH-2.md) | present |
| 1K | [1K-MIGRATE-CANTRIPS-BATCH-3.md](./tasks/spell-system-overhaul/1K-MIGRATE-CANTRIPS-BATCH-3.md) | present |
| 1L | [1L-MIGRATE-CANTRIPS-BATCH-4.md](./tasks/spell-system-overhaul/1L-MIGRATE-CANTRIPS-BATCH-4.md) | present |
| 1M | [1M-MIGRATE-CANTRIPS-BATCH-5.md](./tasks/spell-system-overhaul/1M-MIGRATE-CANTRIPS-BATCH-5.md) | present |
| 1N | [1N-MIGRATE-CANTRIPS-BATCH-6.md](./tasks/spell-system-overhaul/1N-MIGRATE-CANTRIPS-BATCH-6.md) | present |
| 1O | [1O-MIGRATE-CANTRIPS-BATCH-7.md](./tasks/spell-system-overhaul/1O-MIGRATE-CANTRIPS-BATCH-7.md) | present |
| 1P | [1P-MIGRATE-CANTRIPS-BATCH-8.md](./tasks/spell-system-overhaul/1P-MIGRATE-CANTRIPS-BATCH-8.md) | present |
| 1Q | [1Q-MIGRATE-CANTRIPS-BATCH-9.md](./tasks/spell-system-overhaul/1Q-MIGRATE-CANTRIPS-BATCH-9.md) | present |

#### Additional numbering exceptions already on disk

These files are real and should be preserved during migration, but they are not part of the simple `1A` to `1Q` strand:

- `00-AGENT-COORDINATION.md`
- `00-DATA-VALIDATION-STRATEGY.md`
- `00-GAP-ANALYSIS.md`
- `00-PARALLEL-ARCHITECTURE.md`
- `00-TASK-INDEX.md`
- `01-typescript-interfaces.md`
- `03-command-pattern-base.md`
- `0-PRIORITY-SCHEMA-EVOLUTION.md`
- `11A-DYNAMIC-LIGHTING-SUPPORT.md`
- `11B-SAVE-PENALTY-RIDER.md`
- `11C-TERRAIN-UTILITY-STRUCTURES.md`
- `19-ai-spell-arbitrator.md`

**Practical note**: if this subtree needs a new primary-strand doc before its numbering is normalized, the next unused simple identifier is `1R`. That does not resolve the duplicate `1F`; it only avoids introducing another collision.

### Documentation Cleanup

**Location**: `docs/tasks/documentation-cleanup/`

This subtree contains a main `1A` to `1G` strand plus a `1G.x` subseries.

#### Main strand on disk

| Identifier | File | Current file-state note |
|------------|------|-------------------------|
| 1A | [1A-SURVEY-AND-CLASSIFICATION.md](./tasks/documentation-cleanup/1A-SURVEY-AND-CLASSIFICATION.md) | present |
| 1B | [1B-APPLY-PREFIX-TO-ROOT-DOCS.md](./tasks/documentation-cleanup/1B-APPLY-PREFIX-TO-ROOT-DOCS.md) | present |
| 1C | [1C-ARCHIVE-OBSOLETE-DOCS.md](./tasks/documentation-cleanup/1C-ARCHIVE-OBSOLETE-DOCS.md) | present |
| 1D | [1D-CONSOLIDATE-DUPLICATE-CONTENT.md](./tasks/documentation-cleanup/1D-CONSOLIDATE-DUPLICATE-CONTENT.md) | present |
| 1E | [1E-VERIFY-DOC-LINKS.md](./tasks/documentation-cleanup/1E-VERIFY-DOC-LINKS.md) | present |
| 1F | [1F-CREATE-SYSTEM-STATUS-REPORT.md](./tasks/documentation-cleanup/1F-CREATE-SYSTEM-STATUS-REPORT.md) | present |
| 1G | [1G-MIGRATE-IMPROVEMENT-DOCS.md](./tasks/documentation-cleanup/1G-MIGRATE-IMPROVEMENT-DOCS.md) | present |

#### `1G.x` subseries on disk

- [1G.1-COMMON-COMPONENTS.md](./tasks/documentation-cleanup/1G.1-COMMON-COMPONENTS.md)
- [1G.2-CONFIG-DECOUPLING.md](./tasks/documentation-cleanup/1G.2-CONFIG-DECOUPLING.md)
- [1G.3-PLAYER-TYPES.md](./tasks/documentation-cleanup/1G.3-PLAYER-TYPES.md)
- [1G.4-EXTERNALIZE-CSS.md](./tasks/documentation-cleanup/1G.4-EXTERNALIZE-CSS.md)
- [1G.5-API-ERROR-HANDLING.md](./tasks/documentation-cleanup/1G.5-API-ERROR-HANDLING.md)
- [1G.6-SUBMAP-RENDERING.md](./tasks/documentation-cleanup/1G.6-SUBMAP-RENDERING.md)
- [1G.7-REDUCER-LOGIC.md](./tasks/documentation-cleanup/1G.7-REDUCER-LOGIC.md)
- [1G.8-POINT-BUY-UI.md](./tasks/documentation-cleanup/1G.8-POINT-BUY-UI.md)
- [1G.9-LOADING-TRANSITION.md](./tasks/documentation-cleanup/1G.9-LOADING-TRANSITION.md)
- [1G.10-SUBMAP-GENERATION.md](./tasks/documentation-cleanup/1G.10-SUBMAP-GENERATION.md)

**Practical note**: this family is historically meaningful but not yet fully normalized. Presence on disk does not, by itself, settle whether each file is still active, completed, or historical. That review is handled in the doc-review ledger.

### Spell Completeness Audit

**Location**: `docs/tasks/spell-completeness-audit/`

| Identifier | File | Current file-state note |
|------------|------|-------------------------|
| 1A | [1A~INVENTORY-LOCAL-SPELLS.md](./tasks/spell-completeness-audit/1A~INVENTORY-LOCAL-SPELLS.md) | retired marker present |
| 1B | [1B~RESEARCH-PHB-2024-LIST.md](./tasks/spell-completeness-audit/1B~RESEARCH-PHB-2024-LIST.md) | retired marker present |
| 1C | [1C~GAP-ANALYSIS.md](./tasks/spell-completeness-audit/1C~GAP-ANALYSIS.md) | retired marker present |
| 2A | [2A-EXTRACT-LEVEL-1-DESCRIPTIONS.md](./tasks/spell-completeness-audit/2A-EXTRACT-LEVEL-1-DESCRIPTIONS.md) | present |
| 2B | [2B-EXTRACT-REMAINING-LEVELS.md](./tasks/spell-completeness-audit/2B-EXTRACT-REMAINING-LEVELS.md) | present |

### 3D Exploration

**Location**: `docs/tasks/3d-exploration/`

| Identifier | File | Current file-state note |
|------------|------|-------------------------|
| 1A | [1A-3D-EXPLORATION-ROADMAP.md](./tasks/3d-exploration/1A-3D-EXPLORATION-ROADMAP.md) | present |
| 2B | [2B-3D-INTEGRATION-DESIGN-PLAN.md](./tasks/3d-exploration/2B-3D-INTEGRATION-DESIGN-PLAN.md) | present |

Additional unnumbered work docs also exist in this subtree:
- [implementation_plan.md](./tasks/3d-exploration/implementation_plan.md)
- [world-map-rewire-mapping.md](./tasks/3d-exploration/world-map-rewire-mapping.md)

## Known Exceptions And Boundaries

- `docs/tasks/roadmap/` exists on disk but is currently excluded from the maintained documentation system by [@DOCUMENTATION-GUIDE.md](./@DOCUMENTATION-GUIDE.md).
- [@ROADMAP-SYSTEM-GUIDE.md](./@ROADMAP-SYSTEM-GUIDE.md) also exists on disk but is part of that excluded roadmap-tooling surface.
- [@RETIRED-DOCS.md](./@RETIRED-DOCS.md) is a manually curated retirement ledger that is currently synced to the retired numbered docs explicitly tracked by this registry.

## Maintenance Rules

When adding a new numbered work doc:

1. Check the local subtree first.
2. Continue the numbering pattern already used in that subtree.
3. Avoid creating a new duplicate identifier.
4. Update this registry only if the subtree is one of the tracked families above.
5. Update [@ACTIVE-DOCS.md](./@ACTIVE-DOCS.md) only if the new doc is meant to be part of the current work-entry surface.

When retiring a numbered work doc:

1. Use the `~` marker if that family already uses tilde retirement.
2. Preserve the identifier.
3. Update this registry or the relevant local registry surface.
4. Add or reconcile the retirement entry in [@RETIRED-DOCS.md](./@RETIRED-DOCS.md) when that ledger is being maintained for the family.

## Related Files

- [@ACTIVE-DOCS.md](./@ACTIVE-DOCS.md) is the current work-entry surface.
- [@DOC-NAMING-CONVENTIONS.md](./@DOC-NAMING-CONVENTIONS.md) explains the naming systems and the limits of the legacy numbering rules.
- [docs/registry/@DOC-REVIEW-LEDGER.md](./registry/@DOC-REVIEW-LEDGER.md) is the authoritative review queue for the current documentation overhaul.
