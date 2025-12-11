# Level 2 Spell Migration - Batch 3

**Scope**: Migrate/update the next ten Level 2 spells to the structured schema, glossary, and manifest. Remove flat roots, ensure glossary coverage with level tags, and keep validator/integrity scripts green.

## Spells in this batch
- detect-thoughts
- dragons-breath
- enhance-ability
- enlarge-reduce
- enthrall
- find-steed
- find-traps
- flame-blade
- flaming-sphere
- gentle-repose

## Execution Steps
1. Migrate each spell to `public/data/spells/level-2/{id}.json` (remove any flat copy).
2. Ensure required fields: `ritual` present, `castingTime.combatCost.type` present, enums/casing correct, every effect has `trigger` + `condition`, `validTargets` plural.
3. Add/update glossary entry `public/data/glossary/entries/spells/{id}.md` with matching ID/name + level tag.
4. Run `npx tsx scripts/regenerate-manifest.ts`, then `npm run validate`, then `npx tsx scripts/check-spell-integrity.ts`.
5. Log results and any gaps.

## Per-Spell Checklist
- detect-thoughts: Data ✅ / Validation ✅ / Integration ✅ (surface thoughts + deeper probe save; blocked by materials)
- dragons-breath: Data ✅ / Validation ✅ / Integration ✅ (bonus action imbue; 15-ft cone Dex save, scaling +1d6)
- enhance-ability: Data ✅ / Validation ✅ / Integration ✅ (six ability options; scaling +1 target per slot)
- enlarge-reduce: Data ✅ / Validation ✅ / Integration ✅ (size +/-1; Str adv/disadv; weapon dmg +/-1d4; Con save end)
- enthrall: Data ✅ / Validation ✅ / Integration ✅ (Perception disadvantage vs others on failed Wis save)
- find-steed: Data ✅ / Validation ✅ / Integration ✅ (persistent mount summon; form/type choice; dismissed/action)
- find-traps: Data ✅ / Validation ✅ / Integration ✅ (sense traps in LOS; nature only, not exact trigger)
- flame-blade: Data ✅ / Validation ✅ / Integration ✅ (bonus action summon blade; melee spell attack 3d6 fire; scaling per slot)
- flaming-sphere: Data ✅ / Validation ✅ / Integration ✅ (ram/end-turn Dex save 2d6 fire; scaling +1d6)
- gentle-repose: Data ✅ / Validation ✅ / Integration ✅ (ritual; prevents decay/undeath 10 days; extends raise-dead window)

## Commands Run
- `npx tsx scripts/regenerate-manifest.ts`
- `npm run validate`
- `npx tsx scripts/check-spell-integrity.ts`

## Gaps / Follow-ups
- None for this batch.
