# Documentation Naming Conventions

**Last Updated**: November 30, 2025

**Purpose**: Standard system for naming and managing project documentation.

---

## The Numbering System

All active work documents use **sequential alphanumeric numbering**:

`1A`, `1B`, `1C` ... `1Z` → `2A`, `2B`, `2C` ... `2Z` → `3A`, etc.

### Format

**Active document:**
```
[NUMBER]-[DESCRIPTIVE-NAME].md

Examples:
1A-PROJECT-MASTER-SPRINGBOARD.md
1B-SPELL-MIGRATION-ROADMAP.md
1C-JULES-WORKFLOW-CONSOLIDATED.md
```

**Retired document:**
```
[NUMBER]~[DESCRIPTIVE-NAME].md

Examples:
1D~OLD-APPROACH-DEPRECATED.md
1E~DUPLICATE-WORKFLOW-MERGED.md
```

The **tilde (`~`)** character marks a document as retired.

---

## Why This System?

1. **Chronological ordering** - See which docs were created in what order
2. **Easy to find latest work** - Highest number = most recent
3. **No cognitive overload** - Don't need to remember complex names
4. **Natural sorting** - Alphabetically sorts by creation order
5. **Visual retirement marker** - Tilde clearly indicates "not active"

---

## Creating a New Document

**Steps:**

1. Check [DOC-REGISTRY.md](./DOC-REGISTRY.md) for "Next available number"
2. Create file with that number: `1C-YOUR-DOC-NAME.md`
3. Add entry to DOC-REGISTRY.md
4. If this is active work, add to [ACTIVE-DOCS.md](./ACTIVE-DOCS.md)

**Example:**
```bash
# Latest doc is 1B, so next is 1C
touch docs/tasks/spell-system-overhaul/1C-JULES-WORKFLOW.md

# Update registry
# Add to ACTIVE-DOCS.md if currently working on it
```

---

## Retiring a Document

**When to retire:**
- Work is complete and no longer actively referenced
- Document was superseded by a better approach
- Content was consolidated into another doc
- Work was abandoned/deprioritized

**Steps:**

1. **Rename** with tilde marker:
   ```bash
   mv 1C-JULES-WORKFLOW.md 1C~JULES-WORKFLOW.md
   ```

2. **Update DOC-REGISTRY.md**:
   - Move entry from "Active" to "Retired" section

3. **Log in RETIRED-DOCS.md**:
   - Add to appropriate category (Archived/Abandoned/Obsolete/Duplicate)
   - Include retirement reason
   - Include date

4. **Remove from ACTIVE-DOCS.md** if listed there

**Important**: Keep the number! Don't create gaps in the sequence.

---

## Naming Guidelines

**DO:**
- ✅ Use descriptive names: `1C-JULES-WORKFLOW-CONSOLIDATED.md`
- ✅ Use ALL-CAPS for the descriptive part of the filename: `1A-PROJECT-MASTER-SPRINGBOARD.md`
- ✅ Use hyphens to separate words: `SPELL-MIGRATION-ROADMAP`
- ✅ Be specific: `JULES-WORKFLOW` not just `WORKFLOW`

**DON'T:**
- ❌ Use generic names: `1C-NOTES.md`
- ❌ Use special characters: `1C-DOC!.md`, `1C-DOC*.md`
- ❌ Skip numbers: If 1B exists, next must be 1C (not 1D)
- ❌ Reuse numbers: Each number is used exactly once

---

## Number Progression

```
1A → 1B → 1C → ... → 1Y → 1Z → 2A → 2B → ...
```

**After 1Z, go to 2A** (not 10A or AA)

This gives you:
- 26 docs per "tier" (A-Z)
- Tier 1: 1A-1Z (26 docs)
- Tier 2: 2A-2Z (26 docs)
- Tier 3: 3A-3Z (26 docs)
- etc.

**Unlikely to run out** - by the time you hit 3A, you've created 52 documents!

---

## Finding Documents

**To find active work:**
1. Open [ACTIVE-DOCS.md](./ACTIVE-DOCS.md)
2. See what's currently being worked on
3. Click links to relevant docs

**To find a specific doc:**
1. Check [DOC-REGISTRY.md](./DOC-REGISTRY.md)
2. Search by number or name
3. See if it's active or retired

**To see all numbered docs:**
```bash
# In docs/ or any subfolder
ls -1 [0-9]*-*.md
ls -1 [0-9]*~*.md  # retired only
```

---

## Maintenance

**Weekly:**
- Review ACTIVE-DOCS.md
- Retire docs that are no longer being worked on
- Update registry if new docs were created

**Monthly:**
- Audit DOC-REGISTRY.md for accuracy
- Check for gaps in numbering (there shouldn't be any!)
- Archive very old retired docs if needed

---

## Special Cases

**Multiple people working in parallel:**
- Check DOC-REGISTRY.md before creating
- Reserve your number by creating empty file immediately
- Prevents number conflicts

**Document gets split into multiple:**
- Original: `1D-BIG-DOC.md`
- Split into: `1E-PART-ONE.md`, `1F-PART-TWO.md`
- Retire original: `1D~BIG-DOC-SPLIT-INTO-1E-1F.md`

**Document gets merged:**
- Sources: `1G-DOC-ONE.md`, `1H-DOC-TWO.md`
- Merged into: `1I-COMBINED-DOC.md`
- Retire sources: `1G~DOC-ONE-MERGED-INTO-1I.md`, etc.

---

## Registry Files

**[DOC-REGISTRY.md](./DOC-REGISTRY.md)**
- Master list of ALL numbered docs (active + retired)
- Shows next available number
- Single source of truth

**[ACTIVE-DOCS.md](./ACTIVE-DOCS.md)**
- Quick reference for current work
- Your main entry point when returning to project
- Links to relevant docs

**[RETIRED-DOCS.md](./RETIRED-DOCS.md)**
- Archive of retired docs with reasons
- Categorized: Archived, Abandoned, Obsolete, Duplicate
- Searchable history

---

## Questions?

If unsure about numbering:
1. Check DOC-REGISTRY.md for "Next available number"
2. Use that number
3. Don't overthink it!

The system is designed to be simple and automatic.
