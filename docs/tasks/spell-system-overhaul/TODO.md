# Spell System Overhaul - Outstanding TODOs

## High Priority

### flat-to-nested-migration
**Issue**: 214 legacy spell JSONs exist in flat `public/data/spells/*.json` while new spells use nested `public/data/spells/level-{N}/` structure.

**Risk**: Dual directory structure may cause loading inconsistencies.

**Action Required**:
1. Audit which flat files are duplicates of nested files
2. Create migration script to move remaining flat files to level-N folders
3. Update manifest generation to handle transition
4. Delete flat files once nested migration complete

**Related Files**:
- `src/context/SpellContext.tsx` - spell loading logic
- `public/data/spells_manifest.json` - spell manifest

---

### status-level-0-sync
**Issue**: `STATUS_LEVEL_0.md` shows ~38 cantrips but `level-0/` folder has 44 files. Table is out of sync.

**Action Required**:
1. Run diff between STATUS table and actual files
2. Add missing cantrips to table
3. Update status for cantrips already migrated

**Related Files**:
- `docs/spells/STATUS_LEVEL_0.md`
- `public/data/spells/level-0/*.json`

---

## Medium Priority

### armor-of-agathys-conditional-trigger
**Issue**: Armor of Agathys retaliation damage uses `on_target_attack` trigger but per D&D 5e rules, cold damage only occurs on melee hits while temp HP remains active.

**Current State**: ✅ Has DAMAGE effect with `on_target_attack` trigger and slot-level scaling.

**Enhancement Needed**: Add condition to verify:
1. Attack was melee (not ranged)
2. Attack hit (not miss)
3. Caster still has temp HP from this spell

**Related Files**:
- `public/data/spells/level-1/armor-of-agathys.json:52-63`
- `src/systems/spells/validation/spellValidator.ts` - may need new trigger type

---

## Low Priority (Future)

### integration-test-automation
**Issue**: STATUS files have "Integration Status" column but no automated test flow exists.

**Proposal**: Create test runner that:
1. Loads spell JSON
2. Validates via `spellValidator.ts`
3. Tests `SpellContext` loading
4. Tests `spellAbilityFactory` conversion
5. Auto-updates Integration Status in STATUS files

**Related Files**:
- `docs/spells/SPELL_INTEGRATION_CHECKLIST.md`
- `src/utils/spellAbilityFactory.ts`

---

## Completed

- [x] Fix SPELL_TEMPLATE.json references (archived to `archive/SPELL_TEMPLATE.json`)
- [x] Update FINAL_SUMMARY.md broken link
- [x] Update TASK_STRATEGY_UPDATE.md references
- [x] Absorb Elements now has DAMAGE effect with `on_attack_hit` trigger
- [x] Armor of Agathys now has DAMAGE effect (trigger needs refinement per above)

---

*Last updated: Session reviewing PR #38/#39 aftermath*
