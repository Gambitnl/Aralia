# Spell System Troubleshooting Guide

Last Updated: 2026-03-11
Purpose: Quick current-state troubleshooting guide for spell data, manifest, and integration failures.

## Start Here

When a spell change goes wrong, check these layers in order:
1. spell JSON file
2. validator compatibility
3. manifest state
4. class-list and integration references
5. runtime consumer surfaces

This order matters. A lot of spell-broke-in-UI issues are actually data-shape or manifest issues first.

## Current Validation Surface

The current repo does not expose the package command npm run validate:spells.

Use these commands instead:
- npx tsx scripts/validateSpellJsons.ts
- npx tsx scripts/check-spell-integrity.ts
- npm run validate
- npm run typecheck
- npm run build

## Problem: Spell JSON Fails Validation

### What To Check

- missing required root fields
- missing trigger or condition inside an effect
- enum drift in school names, damage types, target types, or effect types
- outdated field shapes copied from an older doc example

### Ground Truth

The live validation truth is src/systems/spells/validation/spellValidator.ts.

If an example doc disagrees with the validator, the validator wins for this troubleshooting pass.

### Recovery Steps

1. Run npx tsx scripts/validateSpellJsons.ts.
2. Open the failing spell JSON and compare it against:
   - src/systems/spells/validation/spellValidator.ts
   - docs/spells/SPELL_JSON_EXAMPLES.md
3. Fix the validator mismatch before checking UI symptoms.

## Problem: Spell Exists On Disk But Does Not Show Up

### What To Check

- the file is under the correct public/data/spells/level-{N}/ directory
- the filename matches id
- the manifest was regenerated after adding or moving the file
- the manifest path points at the correct level folder

### Recovery Steps

1. Regenerate the manifest with npx tsx scripts/regenerate-manifest.ts.
2. Run the integrity check with npx tsx scripts/check-spell-integrity.ts.
3. Confirm the spell appears in public/data/spells_manifest.json.

## Problem: Class Access Is Wrong

### Symptoms

- the spell does not appear for the expected class
- the spell appears for the wrong class
- subclass naming does not line up with the current validator

### What To Check

- the classes array in the spell JSON
- the current class-name whitelist inside spellValidator.ts
- any class spell-list references surfaced by check-spell-integrity.ts

### Recovery Steps

1. Run npx tsx scripts/check-spell-integrity.ts.
2. If class-list IDs are missing from the manifest output, fix the manifest or spell ID first.
3. If the spell validates but still does not appear where expected, inspect the relevant class-selection or spell-gating surface next.

## Problem: The Spell Appears In Data But Not In Runtime

### Likely Causes

- manifest or context data is stale
- the gameplay surface has stronger gating than the JSON alone
- the effect structure validates but the runtime mechanic is only partially implemented

### What To Check

- docs/spells/SPELL_INTEGRATION_CHECKLIST.md
- the relevant status file under docs/spells/
- the runtime feature lane the spell depends on

Examples:
- light-producing spells may still depend on renderer or cleanup follow-through
- terrain spells may validate cleanly but still have persistence limitations
- save-rider spells may have partial runtime coverage

### Recovery Steps

1. Verify whether the problem is data-shape or runtime-consumer behavior.
2. If the spell uses a complex mechanic, compare it with a current in-repo spell already using that mechanic.
3. If the mechanic is only partial, document that explicitly instead of treating it as a pure data bug.

## Problem: Docs And Code Disagree

This is common in the current migration.

### Rule

When a spell doc conflicts with:
- package.json
- spellValidator.ts
- the scripts under scripts/
- the manifest on disk

trust the repo surfaces first and treat the doc as stale until re-verified.

### Common Stale Signals

- references to npm run validate:spells
- older flat spell-file placement assumptions
- older fully-migrated claims not backed by the current runtime
- older status language that predates newer validator fields

## Problem: Full Validation Passes But The Spell Still Feels Wrong

At that point the issue is usually one of:
- runtime consumer mismatch
- partial feature implementation
- stale status documentation
- incorrect expectations copied from an older guide

### Next Checks

- test the relevant gameplay surface directly
- inspect the nearest similar working spell
- update the nearby status or guide doc if current truth changed during debugging

## Practical Recovery Sequence

Use this exact order to avoid thrashing:
1. npx tsx scripts/validateSpellJsons.ts
2. npx tsx scripts/check-spell-integrity.ts
3. npx tsx scripts/regenerate-manifest.ts if files were added or moved
4. npm run validate
5. npm run typecheck
6. npm run build
7. runtime verification in the touched gameplay surface

## Related References

- docs/guides/SPELL_IMPLEMENTATION_CHECKLIST.md
- docs/guides/SPELL_ADDITION_WORKFLOW_GUIDE.md
- docs/spells/SPELL_JSON_EXAMPLES.md
- docs/spells/SPELL_INTEGRATION_CHECKLIST.md
- docs/SPELL_INTEGRATION_STATUS.md
