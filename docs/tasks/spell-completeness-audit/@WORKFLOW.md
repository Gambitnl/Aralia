# Spell Completeness Audit Workflow

Created: 2025-12-04 15:40 UTC  
Last Updated: 2025-12-06 15:11 UTC  
Reusable procedures for the audit and extraction project. Keep updates minimal and reference external sources instead of embedding long rules.

---

## Inventory Collection
1. Scan `public/data/spells/` for JSON spell files.
2. Extract `level` and `id` from each file; ignore cantrips (`level: 0`).
3. Aggregate counts per level and capture filenames/ids.
4. Save results to `output/LOCAL-INVENTORY.md` with totals and per-level listings.
5. If spell-by-spell checks are needed, process in batches of ≤10 per level with no cross-level mixing.

## PHB 2024 Research
1. Search for the official 2024 Player's Handbook spell list (levels 1-9).
2. Capture spell names, levels, and citations (book page or trusted source link).
3. Normalize spell names for comparison (uppercase, trim punctuation).
4. Record findings in `output/PHB-2024-REFERENCE.md` (validate in batches of ≤10 if reviewing per-spell data).

## Gap Analysis
1. Align naming between local inventory and PHB list (case-insensitive compare).
2. Per level, categorize spells as ✅ Present, ❌ Missing, or ❓ Extra.
3. Summarize totals per category and level.
4. Publish static reference at `@SPELL-COMPLETENESS-REPORT.md`.

## Description Extraction
1. Use a reliable rules source for mechanical text (avoid user-generated content).
2. Capture fields: Name, Level, School, Casting Time, Range, Components, Duration, Classes, Description, At Higher Levels.

> **[Claude Agent Note]** Successfully tested data sources for spell extraction (Dec 2025):
> - **Primary**: `https://www.aidedd.org/spell/{spell-id}` - Reliable PHB 2024 data; use WebFetch with HTTP.
> - **Fallback**: WebSearch for "D&D 5e 2024 PHB {spell-name} spell" then fetch from results.
> - **Avoid**: `dnd2024.wikidot.com` - Has redirect issues (301 loops between HTTP/HTTPS).
> - URL pattern: Use kebab-case spell IDs (e.g., `cloud-of-daggers`, `blindness-deafness`).
3. For level 1, create `docs/spells/reference/LEVEL-1-REFERENCE.md` (pilot quality).
4. For levels 2-9, replicate structure per level: `LEVEL-{N}-REFERENCE.md`.
5. Maintain source notes for traceability; do not modify game data files.
6. Always work in batches of ≤10 spells per level with no cross-level overlap; finish the full check cycle per batch (online verification → local code review → add/update references) before moving to the next batch.
7. For each entry, include structured fields per the template alignment (ritual; casting time with activation/reaction; range type; components with material details/cost/consumed; duration with concentration; targeting/area; save/attack; damage/healing with scaling; conditions; secondary effects) before the narrative Description.

## Migration & Validation (Levels 1-9)
1. Read in order: `JULES_ACCEPTANCE_CRITERIA.md`, `SPELL_TEMPLATE.json`, `output/PHB-2024-REFERENCE.md`, `output/LOCAL-INVENTORY.md`, `@SPELL-COMPLETENESS-REPORT.md`, level reference file, cantrip learnings (`1I-MIGRATE-CANTRIPS-BATCH-1.md`, `gaps/BATCH-1-GAPS.md`).
2. Sequence: level-by-level (1→9), batches ≤10 in PHB order (local-only appended). Finish a batch before starting the next.
3. Reference updates: structured fields per template in `docs/spells/reference/LEVEL-{N}-REFERENCE.md`, update timestamps, remove TODOs, include citation and "None" for missing higher-level scaling.
4. Implementation: for missing/outdated spells, create/update JSON at `public/data/spells/level-{N}/{id}.json` and glossary at `public/data/glossary/entries/spells/{id}.md`; PHB IDs take precedence, log conflicts in batch gaps; keep local-only spells with source noted.
5. Validation per batch (in order): `npm run lint`; `npm test`; `npx tsx scripts/regenerate-manifest.ts`; `npm run validate`. Log outcomes (success/failure) in the batch gaps file; rerun once only if transient/missing.
6. Gap logging: create `docs/tasks/spell-system-overhaul/gaps/LEVEL-{N}-BATCH-{X}-GAPS.md` per batch with timestamp, commands run + outcomes, spell list, blockers or "No blockers", and any source/schema gaps.
7. Pause after each level: summarize blockers before moving to the next level. See `docs/tasks/spell-system-overhaul/LEVELS-1-9-MIGRATION-GUIDE.md` for full details.
