# Racial Mechanics / Race Hierarchy North Star

Last updated: 2026-06-03

Purpose and scope
This project is the single source for race-mechanics runtime behavior in the character stack: parser extraction, state materialization, combat math integration, user-facing sheet visibility for race traits, and glossary entry alignment with 2024 standards.

## Design Pillars
- **D&D 2024 Alignment:** All core races (Aarakocra to Yuan-ti) must eventually prioritize 2024 mechanics (e.g., 30ft base speed, Proficiency Bonus uses).
- **Rule-Version Transparency:** The UI must clearly distinguish between official D&D 2024 content and legacy content that has been modernized to fit 2024 standards.
- **Single Source of Truth:** `src/data/races/*.ts` is the master for runtime behavior; `public/data/glossary/entries/races/*.json` must stay in sync for flavor.

## Global Gap Imports
| Gap ID | Imported? | Destination | Scope Rationale | Checked |
|---|---|---|---|---|
| GG-5 | yes | RM-GG5-001 | Racial skill proficiency choices belong to the character creator assembly path. | 2026-06-02 |
| GG-6 | yes | RM-GG6-001 | Powerful Build is a racial trait modifier that must be wired into combat/inventory math. | 2026-06-02 |
| GG-7 | yes | RM-GG7-001 | Movement speed visibility is a core racial trait display requirement. | 2026-06-02 |
| GG-9 | yes | RM-GG9-001 | Condition immunities are racial trait materialization outputs. | 2026-06-02 |
| GG-18 | no | n/a | Character Creator draft persistence is out of scope for mechanical traits. | 2026-06-02 |
| GG-19 | no | n/a | Heavy Armor UI feedback is a general UI concern, not race-specific. | 2026-06-02 |
| GG-20 | no | n/a | GameModals refactoring is a Core UI/Architecture task, not race-specific. | 2026-06-03 |
| GG-21 | no | n/a | ActionPane local state refactoring is a Core UI/Architecture task, not race-specific. | 2026-06-03 |
| GG-22 | no | n/a | SpellEffect type casing is a combat/spells architecture issue. | 2026-06-03 |
| GG-23 | no | n/a | SpellEffect double-casting is a combat/spells typing issue. | 2026-06-03 |

Scope boundary:
- In scope: race trait parsing and materialization across racial spells, usages, defenses, modifiers, reactions, race resources, and race choices; alignment of race glossary entries with 2024 rule text.
- Out of scope unless re-accepted: broad UI redesigns, race-grouping redesign, and full spell-list authoring system changes.

Single-project position
- Treat this as the cold-start file for race mechanics and deferred race hierarchy evolution.
- `docs/blueprints/RACE_HIERARCHY_BLUEPRINT.md` is a planning blueprint and is not the current runtime shape.
- Current live race traits stay in `src/data/races/*.ts` plus runtime files listed below.

Current evidence baseline (2026-05-31)
- 111 races scanned.
- 819 traits in `traits-implementation-mapping.md`.
- 772 traits marked Implemented, 47 Text-Only/Flavor.
- `traits-implementation-mapping.md` is a curated evidence ledger of per-trait status.
- `AUDIT_OR_PROOF.md` contains current deferred parser patterns.

Implemented state
- Completed core extraction + materialization flow in canonical runtime path:
  `src/data/races/racialTraits.ts` -> `src/utils/character/characterUtils.ts` ->
  `src/state/reducers/characterReducer.ts` -> `src/utils/combat/*`.
- Completed families:
  spell grants, spell-choice metadata, spell casting limits, usage resources,
  damage-type defenses, reusable modifier buckets, reactions, breath weapon engine,
  proficiencies/initiative, difficult terrain handling, and sheet display for these buckets.
- Combat projection now handles racial cast source, resource limits, and limited-use refresh behavior via existing action/spell execution paths.

Planned / adjacent work
- Defer and classify adjacent behavior as separate tasks until explicitly promoted:
  - RM-013: mark-table spell-list traits (`Spells of the Mark` / table-based grants).
  - RM-014: open non-concrete spell-choice text (`...cantrip of your choice...`).
  - RM-006: heuristic classifier replacement for race feature inference.
- Any open choice-list behavior that affects class-wide spell lists should not be implemented inside parser-only handling without a source-list model.

File map for this project
- Runtime docs:
  - `src/data/races/index.ts`, `src/data/races/racialTraits.ts`, `src/data/races/raceGroups.ts`
  - `src/utils/character/characterUtils.ts`
  - `src/utils/combat/combatUtils.ts`, `src/utils/combat/actionEconomyUtils.ts`
  - `src/state/reducers/characterReducer.ts`
  - `src/components/CharacterSheet/Overview/CharacterOverview.tsx`
- Parser + evidence:
  - `scripts/audits/racialSpellParserAudit.ts`
  - `scripts/audits/trait_analyzer.ts`
  - `docs/projects/racial-mechanics/AUDIT_OR_PROOF.md`
  - `docs/projects/racial-mechanics/traits-implementation-mapping.md`
  - `docs/projects/racial-mechanics/traits-implementation-mapping.json`
- Race workflow references:
  - `docs/guides/RACE_ADDITION_GUIDE.md`
  - `docs/guides/@RACE-ADDITION-DEV-GUIDE.md`
  - `docs/guides/RACE_ENRICHMENT_WORKFLOW.md`
  - `docs/blueprints/RACE_HIERARCHY_BLUEPRINT.md`

Integrations
- Spell system: parser outputs flow into spell ability creation and action economy checks.
- Combat system: racial modifiers and reactions apply through combat utilities and command execution.
- Character sheet: defense and modifier sections show state-derived racial effects.
- Tests:
  - `src/utils/character/__tests__/characterUtils.test.ts`
  - `src/state/reducers/__tests__/characterReducer.test.ts`
  - `src/utils/combat/__tests__/actionEconomyUtils.test.ts`

Gaps and uncertainties
- Deferred mechanics are confirmed and evidence-bound (mark-table traits + open spell-choice lines).
- A true race-hierarchy migration path is intentionally deferred; blueprint remains non-live.
- Exact parser schema for non-concrete class spell list choices is still a separate domain task.

Verification standards
- All racial traits must be empiricaly verified via `scripts/audits/trait_analyzer.ts`.
- Character sheet display must show correctly materialized buckets (defenses, modifiers, etc.).
- Glossary alignment: Each race must have a corresponding glossary entry in `public/data/glossary/entries/races/` that lists the 2024 version of its racial traits. 2014 text should be purged from glossary entries to ensure player-facing consistency.

Next checks
- Re-run:
  - `scripts/audits/racialSpellParserAudit.ts`
  - `scripts/audits/trait_analyzer.ts`
- Validate that tracker entries and `GAPS.md` match evidence before any parser or combat-path changes.
- If RM-013 or RM-014 become required, promote them out of adjacent-deferred and include acceptance checks in tracker.


## Cold-Start Handover Protocol
Every agent closing a session must:
- Read `TRACKER.md` and `GAPS.md` first.
- Close one high-value gap end-to-end (Data + Logic + UI + Tests).
- Discover and register 2 additional unrelated gaps.
- Generate a handover prompt for the successor following this same protocol.
