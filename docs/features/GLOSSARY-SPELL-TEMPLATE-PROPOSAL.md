# Feature Proposal: Template-Based Spell Rendering

**Status:** Exploration / Not Yet Approved
**Created:** 2024-12-12

---

## Problem Statement

Currently, each spell requires **two files**:
1. **JSON** (`public/data/spells/level-N/spell-id.json`) - Structured spell data
2. **Markdown** (`public/data/glossary/entries/spells/spell-id.md`) - Formatted display card

The markdown files are essentially **hand-formatted views of the JSON data**, creating:
- **Duplication** - Same info in two places
- **Sync issues** - JSON says 60ft range, markdown says 30ft
- **Maintenance burden** - 700+ spells × 2 files = 1400+ files to maintain
- **Folder organization problems** - The original issue that prompted this discussion

---

## Proposed Solution

Replace individual spell markdown files with a **single React template component** that renders spell cards directly from JSON data.

### How It Would Work

1. **SpellCardTemplate.tsx** - One component that takes spell JSON and renders the card layout
2. **Glossary loads JSON** - When user selects a spell, fetch the JSON directly
3. **No more spell markdown files** - JSON becomes the single source of truth

### Mapping: JSON → Display

| Display Field | JSON Source |
|---------------|-------------|
| Title | `name` |
| Level | `level` (0 → "Cantrip", else "1st", "2nd", etc.) |
| Casting Time | `castingTime.value` + `castingTime.unit` |
| Range/Area | `range.type` / `range.distance` |
| Components | `components.verbal/somatic/material` → "V, S, M" |
| Duration | `duration.value` + `duration.unit` + `concentration` |
| School | `school` |
| Attack/Save | Derived from `effects[].condition.saveType` |
| Damage/Effect | Derived from `effects[].type` or `tags` |
| Description | `description` |
| Higher Levels | `higherLevels` |
| Spell Tags | `tags[]` |
| Available For | `classes[]` |

---

## Challenge: Glossary Term Links

### Current Approach
Markdown files contain inline HTML with glossary links:
```html
<span data-term-id="cube_area" class="glossary-term-link-from-markdown">Cube</span>
```

### Problem
If descriptions live in JSON, how do we maintain clickable glossary links?

### Explored Solutions

#### Option 1: Embed HTML in JSON (Not Recommended)
```json
"description": "...5-foot <span data-term-id=\"cube_area\">Cube</span>."
```
- Works but ugly to author
- JSON becomes cluttered with HTML

#### Option 2: Wiki-style Syntax
```json
"description": "...5-foot [[cube_area|Cube]]."
```
- Cleaner to author
- Template parses and converts to links
- Explicit about intent

#### Option 3: Auto-linking (Preferred Direction)
Keep JSON descriptions as plain text, auto-detect and link glossary terms at render time.

**Challenges identified:**
- Common words that are also spell names: "Light", "Aid", "Friends", "Jump", etc.
- Would require massive exclusion list

**Refined approach - Opt-in auto-linking:**
- Create `public/data/glossary/auto-link-terms.json`
- Only terms explicitly listed get auto-linked
- Ambiguous terms (Light, Aid) don't opt in
- Safe terms (Fireball, Restrained, Cube) opt in

```json
// auto-link-terms.json
[
  "cube_area",
  "sphere_area",
  "cone_area",
  "restrained_condition",
  "prone_condition",
  "fireball",
  "magic-missile"
]
```

**Context-aware matching (future enhancement):**
- Capitalization: "Light" (spell) vs "dim light" (common word)
- Contextual phrases: "casts Light", "Light spell", "the Restrained condition"
- Category-driven rules in config file

---

## What Would Change

### Files to Create
- `src/components/Glossary/SpellCardTemplate.tsx` - Template component
- `public/data/glossary/auto-link-terms.json` - Opt-in linking manifest

### Files to Modify
- `src/components/Glossary/FullEntryDisplay.tsx` - Detect spell entries, use template
- `src/context/GlossaryContext.tsx` - May need to load spell JSON on demand
- `scripts/generateGlossaryIndex.js` - Update spell entry generation

### Files to Delete (Eventually)
- All `public/data/glossary/entries/spells/*.md` files (~180 files)

---

## Migration Path

1. **Phase 1:** Build SpellCardTemplate alongside existing markdown system
2. **Phase 2:** Test with a few spells, compare output
3. **Phase 3:** Implement auto-linking with opt-in manifest
4. **Phase 4:** Gradually migrate spells, validate each batch
5. **Phase 5:** Remove markdown files once all spells migrated

---

## Open Questions

1. **seeAlso links** - Currently in markdown frontmatter. Move to JSON schema?
2. **Aliases** - Same question
3. **Excerpt** - Used for search/preview. Derive from description or keep separate?
4. **Complex descriptions** - Some spells have tables, bullet lists. Keep as markdown in JSON `description` field?
5. **Non-spell glossary entries** - This proposal is spell-specific. Other categories keep markdown?

---

## Decision Needed

Before proceeding:
1. Is this direction worth pursuing?
2. Which auto-linking approach (opt-in list vs context-aware)?
3. Priority relative to other work?

---

## Related

- Immediate cleanup plan: See `C:\Users\gambi\.claude\plans\silly-zooming-raccoon.md`
- Current glossary system: `src/components/Glossary/`
- Spell JSON schema: `public/data/spells/level-*/`
