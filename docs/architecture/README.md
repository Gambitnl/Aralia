# Architecture Documentation Maintenance Guide

This guide explains how to maintain the architecture compendium as the codebase evolves.

---

## Directory Structure

```
docs/architecture/
  README.md              # This file
  domains/               # Per-domain documentation
    glossary.md
    world-map.md
    submap.md
    ...
  _generated/            # Machine-generated artifacts (do not edit)
    deps.json            # Full dependency graph
    file-inventory.json  # All tracked files
```

---

## Regenerating Dependency Graph

Run the following command to update generated artifacts:

```bash
npx --no-install tsx scripts/generate-architecture-compendium.ts
```

This will:
1. Walk `src/`, `scripts/`, and `public/data/`
2. Parse import statements from TypeScript/JavaScript files
3. Generate `deps.json` with bidirectional import relationships
4. Generate `file-inventory.json` with all tracked files

> [!IMPORTANT]
> Never manually edit files in `_generated/`. They are overwritten on each run.

---

## Adding a New Domain

1. Create a new file in `docs/architecture/domains/` using the template below
2. Add an entry to the table in `docs/ARCHITECTURE.md`
3. Update the mermaid diagram if the domain has significant dependencies
4. Run the generator to verify file ownership

---

## Domain Document Template

```markdown
# [Domain Name]

## Purpose
What the user experiences in this domain.

## Key Entry Points
| File | Role |
|------|------|
| `src/components/X.tsx` | Primary UI component |
| `src/hooks/useX.ts` | State management hook |

## Subcomponents
- **SubA**: Brief description
- **SubB**: Brief description

## File Ownership
<!-- All files that belong to this domain -->
| Path | Type | Description |
|------|------|-------------|
| `src/components/Domain/` | Directory | UI components |
| `src/hooks/useDomain.ts` | Hook | Business logic |

## Dependencies

### Depends On
- [Other Domain](./other-domain.md) - Why this dependency exists

### Used By
- [Another Domain](./another-domain.md) - How it uses this domain

## Boundaries / Constraints
- Should NOT import from [Domain X] directly
- All Y access must go through Z service

## Open Questions / TODOs
- [ ] Clarify boundary with Domain Q
- [ ] Document subsystem X
```

---

## Updating File Ownership

File ownership is manually curated in domain documents. When files move:

1. Run the generator to see current import relationships
2. Update the "File Ownership" table in the relevant domain document
3. If a file belongs to multiple domains, document it in the primary domain and note the shared usage

---

## Verifying Consistency

After making changes:

```bash
# Regenerate dependency data
npx --no-install tsx scripts/generate-architecture-compendium.ts

# Run project validation
npm run validate

# Check for non-ASCII characters
npx --no-install tsx scripts/check-non-ascii.ts
```

---

## Cross-Domain Dependencies

When documenting dependencies:

1. **Depends On**: List domains this domain imports from
2. **Used By**: List domains that import from this domain (derived from `deps.json`)

Use the generated `deps.json` to verify relationships:

```json
{
  "files": {
    "src/components/Combat/CombatView.tsx": {
      "imports": ["src/systems/spells/...", "src/utils/combatUtils.ts"],
      "importedBy": ["src/App.tsx"]
    }
  }
}
```

---

## Naming Conventions

- Domain document filenames: `kebab-case.md` (e.g., `character-creator.md`)
- Generated files: `kebab-case.json`
- All paths in documentation should be repo-relative (e.g., `src/components/...`)
