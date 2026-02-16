# Race Enrichment Workflow

**Roadmap**: Added (Feb 13, 2026)
**Verification Status**: ✅ 100% Sync (106/106 races)

Last updated: 2026-02-12

## Purpose

In this repo, "race enrichment" means syncing Glossary race data to Character Creator race data so IDs, grouping, and male/female image paths are consistent.

Primary implementation scripts:

- `scripts/sync-glossary-races-with-character-creator.ts`
- `scripts/audit-race-sync.ts`
- `scripts/audits/verify-cc-glossary-race-sync.ts`

## One-Pass Command Sequence

Run from repo root (`F:\Repos\Aralia`):

```powershell
npx tsx scripts/sync-glossary-races-with-character-creator.ts
npm run audit:races
npx tsx scripts/audits/verify-cc-glossary-race-sync.ts
npm run build
```

## What Each Step Does

1. `sync-glossary-races-with-character-creator.ts`
- Normalizes race IDs between CC and Glossary.
- Syncs glossary `maleImageUrl`/`femaleImageUrl` from CC race illustration paths.
- Regenerates `public/data/glossary/index/character_races.json` to match CC grouping.

2. `audit-race-sync.ts`
- Coverage-style audit: which CC races are missing glossary matches.
- Quick signal for large sync gaps.

3. `verify-cc-glossary-race-sync.ts`
- Strict validation for:
  - missing glossary entries
  - mismatched image paths
  - missing image files
  - group membership mismatches
- Exits non-zero when mismatches exist.

4. `npm run build`
- Final app-level sanity check that data changes did not break runtime/build.

## Pass Criteria

Treat the run as passing when all are true:

- `npm run audit:races` reports full or expected coverage.
- `npx tsx scripts/audits/verify-cc-glossary-race-sync.ts` returns:
  - `missingGlossaryCount: 0`
  - `imagePathMismatchCount: 0`
  - `missingImageFileCount: 0`
  - `missingGroupMembershipCount: 0`
  - `wrongGroupMembershipCount: 0`
- `npm run build` succeeds.

## Source-of-Truth Files

- Character Creator race definitions: `src/data/races/*.ts`
- Glossary race entry files: `public/data/glossary/entries/races/**/*.json`
- Glossary race grouped index: `public/data/glossary/index/character_races.json`

## Notes

- `unenriched_races.txt` exists in the repo but is not referenced by active scripts; treat it as a legacy artifact, not a source of truth.
- Portrait regeneration is a separate workflow (see `docs/portraits/race_portrait_regen_handoff.md`).
