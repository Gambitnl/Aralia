# Levels 1-9 Spell Migration Guide

Created: 2025-12-06 15:11 UTC  
Last Updated: 2025-12-06 15:11 UTC  
Scope: Levels 1-9 only (no cantrips) — structured references + JSON + glossary + validation/logging per batch.

---

## Purpose
Operational playbook for completing the spell completeness + migration work for levels 1-9 (excludes cantrips). Use this alongside the acceptance criteria and template files to ensure every spell is fully covered and validated.

## Read These First (in order)
- `docs/tasks/spell-system-overhaul/JULES_ACCEPTANCE_CRITERIA.md`
- `docs/tasks/spell-system-overhaul/archive/SPELL_TEMPLATE.json`
- `docs/tasks/spell-completeness-audit/output/PHB-2024-REFERENCE.md`
- `docs/tasks/spell-completeness-audit/output/LOCAL-INVENTORY.md`
- `docs/tasks/spell-completeness-audit/@SPELL-COMPLETENESS-REPORT.md`
- Level-specific reference before working that level: `docs/spells/reference/LEVEL-{N}-REFERENCE.md`
- Cantrip learnings/validation patterns: `docs/tasks/spell-system-overhaul/1I-MIGRATE-CANTRIPS-BATCH-1.md`, `docs/tasks/spell-system-overhaul/gaps/BATCH-1-GAPS.md`

## Sources & Precedence
- PHB 2024 is primary. If PHB 2014 differs, PHB 2024 wins.
- If an authorized site conflicts with PHB 2024, follow PHB and note the discrepancy in the batch gaps file.
- Spells absent in PHB 2024 but present locally: keep them; cite “Local (non-PHB)” or the known source; apply full template.
- If PHB 2024 text is unavailable: use the best authorized web source (aidedd, wikidot, Roll20, Kassoon) and flag the PHB source gap in the batch gaps file.

## Sequencing & Batching
- Work strictly level-by-level (1 → 9). Finish all batches for a level before starting the next; no cross-level parallelization.
- Per level, batches of ≤10 spells using PHB order from `PHB-2024-REFERENCE.md`. Local-only spells append after PHB-listed spells within their batch/level.
- Finish a batch before starting the next: source check → structured entry → JSON/glossary if needed → validation/logging.

## Outputs (Per Level)
### Reference Updates
- Update `docs/spells/reference/LEVEL-{N}-REFERENCE.md` with structured fields aligned to `SPELL_TEMPLATE.json`:
  - Name; Level; School; Ritual (true/false)
  - Casting Time: value/unit; activation type; reaction condition (if any)
  - Range: type + distance
  - Components: V/S/M flags; material description; cost; consumed flag (default cost=0 gp, consumed=false; “focus or components worth X gp” → cost=X gp, consumed=false)
  - Duration: type; value/unit; concentration flag (instantaneous → type=instant, conc=false; until dispelled/special → type=special/until-dispelled, value null)
  - Classes (PHB classes first; local-only classes marked “(local only)”)
  - Targeting/Area: shape/keyword (sphere, cube, cone, line, cylinder, emanation, self, touch, special), size, range, valid targets, line of sight; for “Self (X-foot radius)”, range=self and area includes shape/size/origin self
  - Save/Attack: save type or attack roll; outcome (half/negates/on hit). If both save+attack, combine in one field.
  - Damage/Healing: dice, type; scaling (slot-level/other)
  - Conditions Applied: name, duration (controlled vocab; flag new ones in gaps; add glossary only if standard practice)
  - Secondary Effects: movement/terrain/summon/utility as applicable
  - Description (narrative; preserve meaning; keep paragraph breaks; strip italics only); At Higher Levels (if none, set “None”); Source/Citation
- Keep batch headings; remove TODOs; update “Last Updated” timestamps in `YYYY-MM-DD HH:MM UTC` using current UTC when editing.

### Implementation (JSON/Glossary)
- For ❌ Missing spells in `@SPELL-COMPLETENESS-REPORT.md`: create JSON at `public/data/spells/level-{N}/{id}.json`; create/update glossary entry at `public/data/glossary/entries/spells/{id}.md`.
- For ✅ Present but outdated schema: update JSON to template without changing intent; drop extra local-only fields that don’t fit the schema (preserve intent in prose if needed).
- Local extras: keep and template them; cite as local. PHB classes first, then local-only with “(local only)”.
- IDs: use PHB kebab-case from `PHB-2024-REFERENCE.md` / `LOCAL-INVENTORY.md`. If PHB and local differ, PHB wins; log conflict in the batch gaps file. For local-only with no ID, derive kebab-case (strip punctuation, hyphenate, lowercase, trim hyphens).

## Validation & Logging (Per Batch)
1) `npm run lint`  
2) `npm test`  
3) `npx tsx scripts/regenerate-manifest.ts` (or the manifest script referenced in cantrip tasks)  
4) `npm run validate`  
- If a command is missing/fails because absent, rerun once if transient; otherwise log failure in the batch gaps file and continue.
- Create `docs/tasks/spell-system-overhaul/gaps/LEVEL-{N}-BATCH-{X}-GAPS.md` for every processed batch. Include: timestamp, commands run + outcomes (even success), spell list (IDs/names), blockers if any (“No blockers” if none). Note source gaps and schema limitations here.

## Description & Citation Rules
- Preserve paragraph breaks; avoid lists unless source uses them. Strip italics only.
- At Higher Levels: if no scaling, “None.”
- Citations: “PHB 2024 p. X”; if scraped, append URL in parentheses. Book-only → no URL.
- If PHB text unavailable, cite authorized source URL and log PHB gap in the batch gaps file.

## Pause/Review Gates
- Halt after finishing each level; provide a summary of gaps/blockers (even if “No blockers”) before moving to the next level.

## Acceptance Criteria (Roll-up)
- Every spell levels 1–9 has a complete structured reference entry with citation; no TODOs remain.
- Missing spells implemented with JSON + glossary; outdated entries updated to template schema.
- Batch sizes respected; validation steps run; gaps files populated (including successful runs).
- Timestamps updated; formatting consistent; IDs/batching per PHB order; no cross-level mixing.
