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

**Next available number**: `1C`

---

## Retired Documents

**See**: [RETIRED-DOCS.md](./RETIRED-DOCS.md) for full archive with retirement reasons.

| Number | Document | Retired Date | Reason | Location |
|--------|----------|--------------|--------|----------|
| *(none yet)* | | | | |

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
