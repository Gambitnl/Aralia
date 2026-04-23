# Spell Missing Structured Markdown Tracker

Last Updated: 2026-04-14

## Purpose

Track spell reference markdown files that still only contain the raw canonical snapshot and do not yet have the structured Aralia field block at the top of the file.

This pass exists because:
- the spell-truth audits skip files marked `<!-- CANONICAL-ONLY-REFERENCE -->`
- that hides parity signal
- cantrips were especially under-represented because most of the remaining missing files are level-0 spells

## Current Inventory

- Original missing structured markdown files in this pass: `47`
- Level-0 files completed: `43`
- Level-1 files completed: `4`
- Remaining canonical-only structured markdown stubs: `0`

## Completed Files

### Level 0

- `acid-splash`
- `blade-ward`
- `booming-blade`
- `chill-touch`
- `create-bonfire`
- `dancing-lights`
- `druidcraft`
- `eldritch-blast`
- `elementalism`
- `fire-bolt`
- `friends`
- `frostbite`
- `green-flame-blade`
- `guidance`
- `light`
- `lightning-lure`
- `mage-hand`
- `magic-stone`
- `mending`
- `message`
- `mind-sliver`
- `minor-illusion`
- `mold-earth`
- `poison-spray`
- `prestidigitation`
- `primal-savagery`
- `produce-flame`
- `ray-of-frost`
- `resistance`
- `sacred-flame`
- `shape-water`
- `shillelagh`
- `shocking-grasp`
- `spare-the-dying`
- `starry-wisp`
- `sword-burst`
- `thaumaturgy`
- `thorn-whip`
- `thunderclap`
- `toll-the-dead`
- `true-strike`
- `vicious-mockery`
- `word-of-radiance`

### Level 1

- `absorb-elements`
- `catapult`
- `snare`
- `tashas-caustic-brew`

## Current Rule For This Pass

- Add the structured markdown block manually, file by file.
- Mirror the current runtime spell JSON field vocabulary.
- Preserve the existing canonical snapshot block underneath.
- Do not use bulk mutation scripts to rewrite the corpus.

## Validation Result

- `Select-String ... CANONICAL-ONLY-REFERENCE`: `0` remaining files
- `npm run validate:spell-markdown`
  - markdown files scanned: `459`
  - total mismatches: `657`
- `npx tsx scripts/auditSpellStructuredAgainstJson.ts`
  - compared spell files: `459`
  - total mismatches: `153`
- `npx tsx scripts/auditSpellStructuredAgainstCanonical.ts`
  - compared spell files: `456`
  - total mismatches: `521`

## Status

- Inventory: complete
- Field vocabulary check against current parser/template: complete
- File patch pass: complete
- Validation: complete

## Outcome

- Every spell reference markdown file now has a structured top block.
- The spell-truth audits no longer skip the old canonical-only cantrip and level-1 files.
- The remaining parity counts now represent live structured data differences instead of missing-file silence.
