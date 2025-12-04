# How to Create Batch Instruction Files for Jules

**Purpose**: Guide for creating migration batch task files that Jules can execute.

---

## File Structure Pattern

Every batch instruction file **MUST** include these sections in order:

### 1. MISSION
A single sentence defining the goal.
- State the spell count, level, and batch number
- Keep it concise and unambiguous

### 2. REQUIRED READING (in order)
An ordered list of files Jules must read **before starting**:

1. `docs/tasks/spell-system-overhaul/JULES_ACCEPTANCE_CRITERIA.md` — The "Iron Rules" (always first)
2. `docs/tasks/spell-system-overhaul/@WORKFLOW-SPELL-CONVERSION.md` — Conversion procedure
3. `docs/spells/SPELL_JSON_EXAMPLES.md` — Validated reference examples
4. `docs/tasks/spell-system-overhaul/SALVAGED_SPELL_CONTEXT.md` — Context for complex spells
5. `docs/spells/SPELL_INTEGRATION_CHECKLIST.md` — Integration verification steps
6. The appropriate audit file for selection (e.g., `@SPELL-AUDIT-CANTRIPS.md`)

### 3. EXECUTION STEPS
Numbered procedural steps describing **actions**, not concepts:
- "Create file at path X"
- "Run command Y"
- "Log results in this file"

**Do NOT** embed rules inline — reference the documents instead.

### 4. CONSTRAINTS (optional but recommended)
What Jules must **NOT** do:
- Do NOT edit shared status files
- Do NOT modify files outside the assigned scope
- Do NOT create PR without passing validation

### 5. PER-SPELL CHECKLIST
A section where Jules logs progress for each spell in the batch.

---

## File Naming Convention

```
{sequence}-MIGRATE-{LEVEL}-BATCH-{N}.md
```

| Segment | Description |
|---------|-------------|
| `{sequence}` | Alphanumeric ordering (1I, 1J, 2A, etc.) |
| `{LEVEL}` | CANTRIPS, LEVEL-1, LEVEL-2, etc. |
| `{N}` | Batch number within that level |

---

## Guiding Principles

1. **Procedural over conceptual** — Write steps as actions, not goals
2. **Reference over embed** — Point to source files rather than duplicating rules
3. **Explicit over implicit** — If format is critical, state which file defines it
4. **No inline examples** — Examples cause LLM overfitting; always reference the examples document
5. **Acceptance criteria are external** — Always reference `JULES_ACCEPTANCE_CRITERIA.md`

---

## Iterative Refinement Process

As batches are processed and reviewed, gaps will be discovered:

1. **Review PR** → Identify issues not covered by current criteria
2. **Update `JULES_ACCEPTANCE_CRITERIA.md`** with new rules
3. **Future batches** automatically inherit new criteria via REQUIRED READING
4. **Earlier batches** may need re-review against updated criteria

By the end of all cantrip batches, the criteria should be comprehensive enough for Level 1 spells.

---

## Template Skeleton

```markdown
# Path X.Y: Migrate {Level} Batch {N} ({count} spells)

## MISSION
Convert batch {N} of {count} {level} spells from Old Format to New Format.

## REQUIRED READING (in order)
* `docs/tasks/spell-system-overhaul/JULES_ACCEPTANCE_CRITERIA.md`
* `docs/tasks/spell-system-overhaul/@WORKFLOW-SPELL-CONVERSION.md`
* `docs/spells/SPELL_JSON_EXAMPLES.md`
* `docs/tasks/spell-system-overhaul/SALVAGED_SPELL_CONTEXT.md`
* `docs/spells/SPELL_INTEGRATION_CHECKLIST.md`
* `docs/tasks/spell-system-overhaul/@SPELL-AUDIT-{LEVEL}.md` (for selection)

## EXECUTION STEPS
1) Select spells from the audit file.
2) For each selected spell:
   - Create JSON at `public/data/spells/level-{N}/{id}.json`
   - Create glossary entry at `public/data/glossary/entries/spells/{id}.md`
   - Run integration checklist and log results below
3) Manifest: `npx tsx scripts/regenerate-manifest.ts`
4) Validation: `npm run validate` — fix any errors
5) Do NOT edit shared status files; track completion in this file only.

## PER-SPELL CHECKLIST (record here)
- [spell-id-1]: Data / Validation / Integration (notes: )
- [spell-id-2]: Data / Validation / Integration (notes: )
...
```

**Note**: The skeleton above is intentionally abstract. Do not add specific spell names or inline examples — let Jules discover the spell list from the audit file.
