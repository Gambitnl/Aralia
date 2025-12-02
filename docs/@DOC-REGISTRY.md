# Documentation Registry

**Purpose**: Master index of all numbered documentation files in the project.

**Last Updated**: November 30, 2025

---

## How This Works

All active work documents use sequential numbering: `1A`, `1B`, `1C`... `1Z`, then `2A`, `2B`, etc.

- **Active docs**: `1A-DOCUMENT-NAME.md`
- **Retired docs**: `1A~DOCUMENT-NAME.md` (tilde marker)

When a doc is retired, it gets the `~` marker and is logged in [RETIRED-DOCS.md](./RETIRED-DOCS.md).

---

## Active Documents

**See**: [ACTIVE-DOCS.md](./ACTIVE-DOCS.md) for quick reference to current work.

| Number | Document | Location | Created | Status |
|--------|----------|----------|---------|--------|
| 1A | Project Master Springboard | `docs/tasks/spell-system-overhaul/` | Nov 30, 2025 | Active |
| 1B | Spell Migration Roadmap | `docs/tasks/spell-system-overhaul/` | Nov 30, 2025 | Active |
| 1D | Archive Old Spell Docs | `docs/tasks/spell-system-overhaul/` | Nov 28, 2025 | Active |
| 1E | Consolidate Jules Workflow | `docs/tasks/spell-system-overhaul/` | Nov 28, 2025 | Active |
| 1F | Audit Spell Scope | `docs/tasks/spell-system-overhaul/` | Nov 28, 2025 | Active |
| 1G | Reorganize Spell Files | `docs/tasks/spell-system-overhaul/` | Nov 28, 2025 | Active |
| 1H | Create Glossary Template | `docs/tasks/spell-system-overhaul/` | Nov 28, 2025 | Active |
| 1I | Migrate Cantrips Batch 1 | `docs/tasks/spell-system-overhaul/` | Nov 28, 2025 | Active |
| 1A | Survey and Classification | `docs/tasks/documentation-cleanup/` | Nov 28, 2025 | Active |
| 1B | Apply Prefix to Root Docs | `docs/tasks/documentation-cleanup/` | Nov 28, 2025 | Pending |
| 1C | Archive Obsolete Docs | `docs/tasks/documentation-cleanup/` | Nov 28, 2025 | Pending |
| 1D | Consolidate Duplicate Content | `docs/tasks/documentation-cleanup/` | Nov 28, 2025 | Pending |
| 1E | Verify Doc Links | `docs/tasks/documentation-cleanup/` | Nov 28, 2025 | Pending |
| 1F | Create System Status Report | `docs/tasks/documentation-cleanup/` | Nov 28, 2025 | Pending |

**Next available number**: `1J`

---

## Retired Documents

**See**: [RETIRED-DOCS.md](./RETIRED-DOCS.md) for full archive with retirement reasons.

| Number | Document | Retired Date | Reason | Location |
|--------|----------|--------------|--------|----------|
| 1C | Version Display & Package Fix | Nov 30, 2025 | Task completed | `docs/tasks/spell-system-overhaul/1C~VERSION-DISPLAY-AND-PACKAGE-FIX.md` |

---

## Registry Maintenance

**When creating a new doc**:
1. Check this registry for the latest number
2. Use the next sequential number (e.g., if latest is `1B`, use `1C`)
3. Add entry to this registry under "Active Documents"
4. Update "Next available number"

**When retiring a doc**:
1. Rename file: `1C-DOC.md` → `1C~DOC.md`
2. Move entry from "Active Documents" to "Retired Documents"
3. Add to [RETIRED-DOCS.md](./RETIRED-DOCS.md) with reason
4. "Next available number" stays the same (no gaps!)

---

## Conventions

**See**: [DOC-NAMING-CONVENTIONS.md](./DOC-NAMING-CONVENTIONS.md) for full details on the numbering system.
