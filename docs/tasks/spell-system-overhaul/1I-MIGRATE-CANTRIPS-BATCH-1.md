# Path 2.F: Migrate Cantrips Batch 1 (5 spells)

## MISSION
Convert the first batch of 5 high-priority cantrips from Old Format to New Format.

## REQUIRED READING (in order)
* `docs/tasks/spell-system-overhaul/@WORKFLOW-SPELL-CONVERSION.md`
* `docs/spells/SPELL_JSON_EXAMPLES.md`
* `docs/tasks/spell-system-overhaul/SALVAGED_SPELL_CONTEXT.md`
* `docs/tasks/spell-system-overhaul/SPELL-WORKFLOW-QUICK-REF.md`
* `docs/spells/SPELL_INTEGRATION_CHECKLIST.md`
* `docs/tasks/spell-system-overhaul/@SPELL-AUDIT-CANTRIPS.md` (for selection)

## EXECUTION STEPS
1) Select the top 5 "Needs Migration" cantrips from `@SPELL-AUDIT-CANTRIPS.md`.
2) For each selected spell:
   - Create/convert JSON at `public/data/spells/level-0/{id}.json` (apply BaseEffect fields, correct enums/casing).
   - Create/update glossary entry at `public/data/glossary/entries/spells/{id}.md`.
   - Run `docs/spells/SPELL_INTEGRATION_CHECKLIST.md` and log results in this file.
3) Manifest: `npx tsx scripts/regenerate-manifest.ts` to refresh `public/data/spells_manifest.json`.
4) Validation: `npm run validate` (or `npm run validate:spells`) and fix any errors.
5) Do NOT edit shared status files; track completion in this file only.

## PER-SPELL CHECKLIST (record here)
- [spell-id-1]: Data ƒo. / Validation ƒo. / Integration ƒo. (notes: ƒ?Ý)
- [spell-id-2]: Data ƒo. / Validation ƒo. / Integration ƒo. (notes: ƒ?Ý)
- [spell-id-3]: Data ƒo. / Validation ƒo. / Integration ƒo. (notes: ƒ?Ý)
- [spell-id-4]: Data ƒo. / Validation ƒo. / Integration ƒo. (notes: ƒ?Ý)
- [spell-id-5]: Data ƒo. / Validation ƒo. / Integration ƒo. (notes: ƒ?Ý)
