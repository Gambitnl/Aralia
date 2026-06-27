# Documentation Registry & Naming Conventions

**Last Updated**: 2026-06-25
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
| 1A | `1A-PROJECT-MASTER-SPRINGBOARD.md` | retired 2026-06-25; duplicated by current Spells north star and child-lane routing docs |
| 1B | [1B-SPELL-MIGRATION-ROADMAP.md](./tasks/spell-system-overhaul/1B-SPELL-MIGRATION-ROADMAP.md) | present |
| 1C | [1C~VERSION-DISPLAY-AND-PACKAGE-FIX.md](./tasks/spell-system-overhaul/1C~VERSION-DISPLAY-AND-PACKAGE-FIX.md) | retired marker present |
| 1D | [1D-ARCHIVE-OLD-SPELL-DOCS.md](./tasks/spell-system-overhaul/1D-ARCHIVE-OLD-SPELL-DOCS.md) | present |
| 1E | [1E-CONSOLIDATE-JULES-WORKFLOW.md](./tasks/spell-system-overhaul/1E-CONSOLIDATE-JULES-WORKFLOW.md) | present |
| 1F | [1F-AUDIT-SPELL-SCOPE.md](./tasks/spell-system-overhaul/1F-AUDIT-SPELL-SCOPE.md) | present |
| 1F | `1F-VERSION-REVIEW-AGENT-CONCEPT.md` | retired 2026-06-25; duplicate pointer deleted after surviving version-bump guidance moved to Scripts: Workflows G4/T6 |
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
These files are real and should be preserved during migration, but they are not part of the simple `1A` to `1Q` strand: `00-AGENT-COORDINATION.md`, `00-DATA-VALIDATION-STRATEGY.md`, `00-PARALLEL-PROJECT_ARCHITECTURE.md`, `01-typescript-interfaces.md`, `03-command-pattern-base.md`. `1A-PROJECT-MASTER-SPRINGBOARD.md`, `0-PRIORITY-SCHEMA-EVOLUTION.md`, `19-ai-spell-arbitrator.md`, `00-TASK-INDEX.md`, `00-GAP-ANALYSIS.md`, `GAP-01-AI-INPUT-UI.md`, `GAP-02-EXAMPLE-AI-SPELLS.md`, `GAP-03-AI-CACHING.md`, `GAP-04-REAL-TERRAIN-DATA.md`, `11A-DYNAMIC-LIGHTING-SUPPORT.md`, `11B-SAVE-PENALTY-RIDER.md`, `11C-TERRAIN-UTILITY-STRUCTURES.md`, and `IMPLEMENT-REMAINING-EFFECT-COMMANDS.md` were retired on 2026-06-25 after their live follow-through moved into the Spells gap registries, Spells parent routing docs, and backlog-retirement ledger.

### Backlog Retirement
**Location**: `docs/tasks/backlog-retirement/`

| Document | Current file-state note |
|----------|-------------------------|
| [RETIREMENT_LEDGER.md](./tasks/backlog-retirement/RETIREMENT_LEDGER.md) | active control ledger for markdown backlog files already walked, migrated, retired, or queued for the next retirement pass |

### Documentation Cleanup
**Location**: `docs/tasks/documentation-cleanup/`

#### Retired historical strand
| Identifier | Former file bucket | Current file-state note |
|------------|--------------------|-------------------------|
| 1A-1F | `docs/tasks/documentation-cleanup/1A*.md` through `1F*.md` | retired 2026-06-25; use `docs/projects/documentation-cleanup/`, `docs/archive/reports/`, `docs/@DOC-REGISTRY.md`, `docs/@DOCUMENTATION-GUIDE.md`, and registry ledgers |
| 1G | `docs/tasks/documentation-cleanup/1G*.md` | retired 2026-06-25; use `docs/projects/documentation-cleanup/`, `docs/archive/improvements/`, source-adjacent READMEs, and registry ledgers |

### Spell Completeness Audit
**Location**: `docs/tasks/spell-completeness-audit/`

| Identifier | File | Current file-state note |
|------------|------|-------------------------|
| 1A | `1A~INVENTORY-LOCAL-SPELLS.md` | retired 2026-06-25; output remains at `docs/tasks/spell-completeness-audit/output/LOCAL-INVENTORY.md` |
| 1B | `1B~RESEARCH-PHB-2024-LIST.md` | retired 2026-06-25; output remains at `docs/tasks/spell-completeness-audit/output/PHB-2024-REFERENCE.md` |
| 1C | `1C~GAP-ANALYSIS.md` | retired 2026-06-25; report remains at `docs/tasks/spell-completeness-audit/@SPELL-COMPLETENESS-REPORT.md` |
| 2A | `2A-EXTRACT-LEVEL-1-DESCRIPTIONS.md` | retired 2026-06-25; live work routed to `docs/projects/spells/subprojects/spell-completeness-audit/GAPS.md` |
| 2B | `2B-EXTRACT-REMAINING-LEVELS.md` | retired 2026-06-25; live work routed to `docs/projects/spells/subprojects/spell-completeness-audit/GAPS.md` |

### 3D Exploration
**Location**: `docs/tasks/3d-exploration/` for remaining capability notes; living ownership now sits in `docs/projects/world3d/`, `docs/projects/world-3d-ui/`, and `docs/projects/three-d-modal/`.

| Identifier | File | Current file-state note |
|------------|------|-------------------------|
| 1A | `1A-3D-EXPLORATION-ROADMAP.md` | retired 2026-06-25; live work represented by `docs/projects/world3d/GAPS.md` W3D-G23..W3D-G27 |
| 2B | `2B-3D-INTEGRATION-DESIGN-PLAN.md` | retired 2026-06-25; modal-specific context preserved in `docs/projects/three-d-modal/GAPS.md` and forward-owned by `docs/projects/world-3d-ui/GAPS.md` |

*(`implementation_plan.md` was also retired 2026-06-25. `world-map-rewire-mapping.md` remains as the live coupling/parity map.)*

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
| 1A | Inventory Local Spells | `docs/tasks/spell-completeness-audit/` | retired 2026-06-25; use `output/LOCAL-INVENTORY.md` |
| 1B | Research PHB 2024 Spell List | `docs/tasks/spell-completeness-audit/` | retired 2026-06-25; use `output/PHB-2024-REFERENCE.md` |
| 1C | Gap Analysis | `docs/tasks/spell-completeness-audit/` | retired 2026-06-25; use `@SPELL-COMPLETENESS-REPORT.md` and living subproject gap `spell-completeness-audit-G1` |

### Restoration Guidance
If a retired numbered work doc needs to become active again:
1. Rename it back to the active local convention for that subtree.
2. Update this file.
3. Update `@README-INDEX.md` if it should return to the current work-entry surface.
4. Add a short note explaining why the retired state was reversed.

<!-- aralia-backlog-walked: {"source":"docs/tasks/backlog-retirement/RETIREMENT_LEDGER.md","path":"docs/@DOC-REGISTRY.md","sha256WithoutMarker":"bbaec158c383742c8c50d813497889375fb9f749e06bb7ec86490240bcc5714f","markedAtUtc":"2026-06-26T00:07:34.891Z"} -->
