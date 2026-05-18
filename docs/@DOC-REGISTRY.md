# Documentation Registry & Naming Conventions

**Last Updated**: 2026-05-17  
**Purpose**: Track the numbered work-doc families that still depend on an explicit registry, define the naming and retirement rules for these legacy numbering systems, and maintain a ledger of retired docs.

## 1. Naming & Numbering Rules

Aralia currently has more than one naming era on disk.

### Canonical root docs
These are stable orientation docs at the root of `docs/` (e.g., `PROJECT_PROJECT_ARCHITECTURE.md`, `DEVELOPMENT_GUIDE.md`).
- Canonical root docs do not all use the `@` prefix.
- Do not introduce `AGENT` into new filenames unless the file is specifically about agent behavior or compatibility.

### Legacy numbered work-doc families
Several active or historical work trees use local numbering systems (e.g., `1A-PROJECT-MASTER-SPRINGBOARD.md`).
- Treat numbering as local to the work tree where it already exists.
- Do not assume a single global numbering system for all docs.
- The most common historical format is: `[NUMBER]-[DESCRIPTIVE-NAME].md`

### How To Name A New Doc
- **Canonical root doc**: Keep the name human-readable and role-based (e.g., `PROJECT_OVERVIEW`, `WORKFLOW`).
- **Inside an established numbered work tree**: Inspect adjacent files first and continue the local pattern. Check the registries below to avoid collisions.
- **Source-adjacent implementation doc**: Use `README.md` for a directory overview, or `[Name].README.md` for specific implementation notes near code.

---

## 2. Tracked Numbered Families

### Spell System Overhaul
**Location**: `docs/tasks/spell-system-overhaul/`

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
These files are real and should be preserved during migration, but they are not part of the simple `1A` to `1Q` strand: `00-AGENT-COORDINATION.md`, `00-DATA-VALIDATION-STRATEGY.md`, `00-GAP-ANALYSIS.md`, `00-PARALLEL-PROJECT_ARCHITECTURE.md`, `00-TASK-INDEX.md`, `01-typescript-interfaces.md`, `03-command-pattern-base.md`, `0-PRIORITY-SCHEMA-EVOLUTION.md`, `11A-DYNAMIC-LIGHTING-SUPPORT.md`, `11B-SAVE-PENALTY-RIDER.md`, `11C-TERRAIN-UTILITY-STRUCTURES.md`, `19-ai-spell-arbitrator.md`.

### Documentation Cleanup
**Location**: `docs/tasks/documentation-cleanup/`

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

*(Also includes the `1G.1` to `1G.10` subseries).*

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

*(Plus `implementation_plan.md` and `world-map-rewire-mapping.md`).*

---

## 3. Retired Documentation Ledger

### Retirement Convention
For the numbered work-doc families that use tilde retirement:
1. The identifier is preserved.
2. The filename changes from `[NUMBER]-NAME.md` to `[NUMBER]~NAME.md`.
3. The retired file stays available for historical context.
4. The retirement should be reconciled with this registry.

*(Important: A missing `~` does not prove that a numbered doc is still current).*

### Retired Numbered Docs Currently Verified On Disk

| Identifier | Document | Location | Verified file-state note |
|------------|----------|----------|--------------------------|
| 1C | [Version Display & Package Fix](./tasks/spell-system-overhaul/1C~VERSION-DISPLAY-AND-PACKAGE-FIX.md) | `docs/tasks/spell-system-overhaul/` | tilde-marked file present |
| 1A | [Inventory Local Spells](./tasks/spell-completeness-audit/1A~INVENTORY-LOCAL-SPELLS.md) | `docs/tasks/spell-completeness-audit/` | tilde-marked file present |
| 1B | [Research PHB 2024 Spell List](./tasks/spell-completeness-audit/1B~RESEARCH-PHB-2024-LIST.md) | `docs/tasks/spell-completeness-audit/` | tilde-marked file present |
| 1C | [Gap Analysis](./tasks/spell-completeness-audit/1C~GAP-ANALYSIS.md) | `docs/tasks/spell-completeness-audit/` | tilde-marked file present |

### Restoration Guidance
If a retired numbered work doc needs to become active again:
1. Rename it back to the active local convention for that subtree.
2. Update this file.
3. Update `@README-INDEX.md` if it should return to the current work-entry surface.
4. Add a short note explaining why the retired state was reversed.
