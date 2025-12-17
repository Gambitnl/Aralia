<!-- TODO: Expand scope/title to levels 0–9 so this prompt is reusable for all batches, not just “Level 3+”; ensure batching/acceptance text matches the roll-up docs. -->
# SPELL MIGRATION TASK (Level 3+)

## CORE PRINCIPLE: JSON = SOURCE OF TRUTH

The JSON file is the **canonical source** for all spell data. The glossary MD is derived from it.
- JSON must be accurate to **2024 PHB** (or original source if legacy)
- JSON must follow **uniform schema** (field order, formatting)
- Add `"source": "PHB 2024"` or `"source": "Tasha's Cauldron of Everything"` etc.
- Add `"legacy": true` for spells not in 2024 PHB

---

## MANDATORY READING (in order)
1. `docs/tasks/spell-system-overhaul/JULES_ACCEPTANCE_CRITERIA.md`
2. `docs/spells/SPELL_JSON_EXAMPLES.md`
3. `docs/tasks/spell-system-overhaul/LEVEL-{N}-BATCHES.md`
4. `docs/tasks/spell-system-overhaul/gaps/LEVEL-{N}-GAPS.md` (check solved/known gaps before flagging new ones)

## ASSIGNMENT
Migrate these spells (Level {N}):
- [ ] {spell-1}
- [ ] {spell-2}
- [ ] {spell-3}
- [ ] {spell-4}
- [ ] {spell-5}
<!-- TODO: Add an explicit step to update class spell lists in src/data/classes/index.ts when new spells are introduced, mirroring acceptance criteria. -->

---

## OUTPUT FILES

| Type | Path |
|------|------|
| JSON (primary) | `public/data/spells/level-{N}/{id}.json` |
| Glossary (derived) | `public/data/glossary/entries/spells/level-{N}/{id}.md` (frontmatter `filePath` must match this level path) |
| Old copies | Remove any flat `public/data/spells/{id}.json` / `public/data/glossary/entries/spells/{id}.md` after field comparison |

## REFERENCE EXAMPLES (review before coding)
- Level 2: `public/data/spells/level-2/web.json` + `public/data/glossary/entries/spells/level-2/web.md`
- Level 2: `public/data/spells/level-2/moonbeam.json` + `public/data/glossary/entries/spells/level-2/moonbeam.md`
- Level 1: `public/data/spells/level-1/thunderwave.json` + `public/data/glossary/entries/spells/level-1/thunderwave.md`

---

## JSON SCHEMA (canonical field order)

```json
{
  "id": "spell-id",
  "name": "Spell Name",
  "level": 3,
  "school": "Evocation",
  "source": "PHB 2024",
  "legacy": false,
  "classes": ["Wizard", "Sorcerer"],
  "description": "...",
  "higherLevels": "...",
  "tags": ["damage", "fire"],
  "ritual": false,
  "castingTime": { "value": 1, "unit": "action", "combatCost": { "type": "action" } },
  "range": { "type": "ranged", "distance": 60 },
  "components": { "verbal": true, "somatic": true, "material": false },
  "duration": { "type": "instantaneous", "concentration": false },
  "targeting": { ... },
  "effects": [ ... ]
}
```

---

## IRON RULES

### Effect Structure
**Every effect MUST have `trigger` + `condition`**:
```json
{ "type": "DAMAGE", "trigger": { "type": "immediate" }, "condition": { "type": "hit" }, ... }
```

### Casing (case-sensitive)

| Category | Format | Examples |
|----------|--------|----------|
| Effect Types | ALL CAPS | `DAMAGE`, `HEALING`, `DEFENSIVE`, `STATUS_CONDITION` |
| Schools/Damage/Classes | Title Case | `Evocation`, `Fire`, `Wizard` |
| validTargets | Plural | `creatures`, `objects`, `allies` |

### Scaling
- **Cantrips**: `"type": "character_level"`  
- **Leveled**: `"type": "slot_level"`

---

## 2024 PHB ACCURACY

For each spell, verify against 2024 PHB:
- **School** (e.g., Acid Splash changed from Conjuration → Evocation)
- **Range** (e.g., Chill Touch changed 120ft → Touch)
- **Damage dice** (e.g., Vicious Mockery changed 1d4 → 1d6)
- **Mechanics** (e.g., Blade Ward now gives -1d4 to attacks, not resistance)

If 2024 PHB data unavailable, use best authorized source and log in gaps file.

---

## FIELD COMPARISON (if old file exists)

If `public/data/spells/{id}.json` exists:
1. Read old file first
2. Copy: `ritual`, `castingTime.combatCost`, `tags`, `arbitrationType`
3. Fix: `validTargets` → plural, `damage.type` → Title Case
4. Delete old file ONLY AFTER copying

---

## GAP HANDLING

```markdown
## System Gaps & Follow-up
- [ ] **{Spell Name}**: {Missing feature}
```
Log gaps in `docs/tasks/spell-system-overhaul/gaps/LEVEL-{N}-GAPS.md`.

---

<!-- TODO: Swap validation steps to the current pnpm pipeline and mirror the manifest/validation sequence used in cantrip batches. -->
## VALIDATION

```bash
npx tsx scripts/regenerate-manifest.ts
npm run validate
npx tsx scripts/check-spell-integrity.ts
```

Log progress in `docs/tasks/spell-system-overhaul/LEVEL-{N}-BATCHES.md` (do NOT edit shared status files).

---

## CHECKLIST

- [ ] `source` field added (PHB 2024 / Tasha's / etc)?
- [ ] Data verified against 2024 PHB?
- [ ] Every effect has `trigger` + `condition`?
- [ ] Casing correct (ALL CAPS effects, Title Case schools)?
- [ ] `ritual` and `castingTime.combatCost.type` present?
- [ ] Files in level subfolder? Manifest paths nested?
- [ ] Glossary `filePath` matches level-aware location?
