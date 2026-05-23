# Racial Mechanics Task Tracker

Last updated: 2026-05-23
Source objective: `Implement a reusable, race-agnostic racial-mechanics engine (including race-granted spells, race-specific usage resources, and source-scoped casting behavior), fully wire Deep Gnome as the first canonical implementation, and while mapping races, maintain a single living tracker file at docs/racial-mechanics-task-tracker.md as the authoritative task collection for discovered in-scope and adjacent tasks. Record each task with status (Not started / In progress / Blocked / Deferred / Completed), scope, and explicit rationale when deferred, while allowing optional sub-task files for deeper tracking.`

## Living Tracking Rules

- This file is the single authoritative task collection for race-mechanics work discovered during implementation.
- Each task must include status, scope, and a rationale field.
- Use `Scope = in-scope-now` for work needed to satisfy the current objective.
- Use `Scope = adjacent-deferred` for meaningful neighboring work found during mapping.
- Sub-task detail files are allowed for depth, but every sub-task must link here.

## Task Log

| Task ID | Status | Scope | Task | Notes | Rationale |
| --- | --- | --- | --- | --- | --- |
| RM-001 | Completed | in-scope-now | Implement race-agnostic spell/feature trait extraction in `src/data/races/racialTraits.ts` | Existing generic parser now emits feature traits and extracts spell grants from trait text, including ability-choice hints and default spell fallback behavior. | Core architecture is now complete enough to drive race-spell discovery across all races. |
| RM-002 | Completed | in-scope-now | Add race-specific usage resource tracking to traits (`resource` mechanic) | Parser now builds race resource metadata for traits with usage/reset language; Deep Gnome camouflage now uses usage language in source data. | Required to support limited-use racial actions without special-case race files. |
| RM-003 | Completed | in-scope-now | Wire source-scoped racial cast behavior in `src/state/reducers/characterReducer.ts` | Racial casts are now treated separately and only consume racial resources when appropriate; racial spells do not occupy normal prepared slots. | This is required behavior for traits that should not count against prep limits. |
| RM-004 | Completed | in-scope-now | Fully wire Deep Gnome as canonical first implementation | `src/data/races/deep_gnome.ts` now has explicit per-spell cast-level caps and upcast flags; traits also define usage/choice text for resource parsing. | Deep Gnome is now the canonical test-bed for non-upcastable, race-gated spell limits and usage mechanics. |
| RM-010 | Completed | in-scope-now | Enforce race spell level caps when a racial spell is marked non-upcastable in `isRacialSpellCastLevelAllowed` | `src/utils/character/characterUtils.ts` now defaults the cap to `minLevel` when no explicit `maxCastLevel` exists, preventing unintended upcast usage. | Prevents silent bypass of intended non-upcastable spell semantics on future and existing race grants. |
| RM-005 | Completed | in-scope-now | Normalize and reconcile existing race data model for choice requirements (`racialSpellChoice`) | Character creation and sidebar validation now consume parser-generated `RacialChoiceRequirement` metadata as primary input. `RaceSelection` now passes normalized spell-choice metadata to detail rendering with an explicit `parser` or `legacy` source marker for remaining compatibility cases. | Remaining legacy dependency is explicit (`source: legacy`) and scoped as a temporary bridge while parser-adjacent gaps are handled in RM-014. |
| RM-006 | Not started | adjacent-deferred | Replace heuristic text classification in `inferRacialFeatureType` with explicit schema source tags | Current feature-type inference is text-based and can misclassify traits across races. | Adjacent refactor to reduce brittleness; could affect all existing races and should be done carefully. |
| RM-007 | Completed | in-scope-now | Add mapping pass across all races in `src/data/races/` and classify traits into reusable groups | `scripts/audits/racialSpellParserAudit.ts` now provides repeatable mapping across all 111 race files and classifies deferred patterns separately from in-scope parser gaps. | Mapping across all races is complete and now emits reusable evidence for ongoing parser and mechanic work. |
| RM-008 | Completed | in-scope-now | Add explicit Deep Gnome spell/resource usage tests/fixtures | Added utility and reducer coverage for deep gnome grant materialization, non-upcastable cap checks, non-prep interaction handling, resource consumption, long-rest refresh, and short-rest non-refresh. | This is now verified through `src/utils/character/__tests__/characterUtils.test.ts` and `src/state/reducers/__tests__/characterReducer.test.ts`. |
| RM-009 | Deferred | adjacent-deferred | Rework deep gnome notes file naming (`deep_gnome.README.md`) to a different convention | User feedback indicated naming is awkward; existing repo convention already uses `*.README.md` for several races. | Deferred until after mechanical tracker work is accepted; not directly required for mechanic correctness. |
| RM-011 | Completed | in-scope-now | Expand spell-text extraction for "learn / when you reach level" phrasing in `src/data/races/racialTraits.ts` | Parser now handles `learn`-based leveled spell text in traits, includes spell-token acceptability filtering, and infers upcastability from slot wording where the phrase suggests fixed-level casting. | Generic parser coverage is now preferred over ad-hoc race exceptions to keep cross-race behavior consistent. |
| RM-012 | Completed | adjacent-deferred | Build and maintain an acceptance diff between race corpus spell text and parser-emitted `RacialSpellTrait` grants | Added repeatable script `scripts/audits/racialSpellParserAudit.ts` and generated evidence in `docs/racial-mechanics-parser-gap-audit-2026-05-21.md`. The latest run scans 111 races, with no in-scope parser gaps and 59 deferred-pattern lines split between mark-table and open cantrip-choice text. | Required workflow is now reproducible and evidence-driven, with deferred-pattern classes separated for RM-013/RM-014. |
| RM-013 | In Progress | adjacent-deferred | Handle `Spells of the Mark` / table-driven spell list traits (`Spells of the Mark`, `table of` grants) | Multiple races use mark-table text that implies spell access for class spell lists, but parser currently only handles direct `learn/cast` spell grant language. | Adjacent behavior likely belongs to class-mark and source-list mechanics, not pure racial-grant extraction; defer until dedicated mark-source scope is added. |
| RM-014 | In Progress | adjacent-deferred | Handle open racial spell choice lines with non-concrete spell references (for example `You know one cantrip ... of your choice`) | Half-elf high and similar entries describe choice without concrete spell IDs, and parser currently has no structured representation for "open spell list choice" yet. | This requires cross-system spell source selection UI/schema changes; adjacent to race-parser hardening and should not block immediate canonical Deep Gnome implementation. |
| RM-015 | Completed | in-scope-now | Map and audit all 819 unique racial traits across all 111 races for active mechanical vs. text-only status | Programmatic analyzer `scripts/audits/trait_analyzer.ts` has mapped all 819 traits, producing `docs/racial-traits-implementation-mapping.json` and `docs/racial-traits-implementation-mapping.md`. | All race traits are now accounted for with a reproducible audit pass; this satisfies mapping/reuse baseline for the objective. |
| RM-016 | Completed | in-scope-now | Enforce racial spell grant consumption behavior during combat spell execution | `AbilityCost` now carries optional `castSource`, `createAbilityFromSpell` emits `castSource` for racial grants, and `actionEconomyUtils` resolves racial limited-use + slot-fallback rules during both affordability checks and resource consumption. | In-progress work confirmed gap where race grants were bypassed in combat via action-cost checks only consuming spell slots. |
| RM-017 | Completed | in-scope-now | Implement a reusable trait-materialization engine for race mechanical traits not limited to spell grants, starting with defenses (resistance / immunity / vulnerability) and reusable modifier buckets | Implemented parser-driven defensive trait materialization in `applyRacialSpellGrantsByLevel`, applying parsed resistance/immunity/vulnerability buckets to `PlayerCharacter` and passing them into combat character conversion. | This is required for parity: many mapped defensive traits now work uniformly at runtime using shared buckets instead of race-specific hacks. |
| RM-018 | Completed | in-scope-now | Surface parsed racial damage defenses in character sheet UI | Character overview now displays parsed resistance / immunity / vulnerability buckets (`resistances`, `immunities`, `vulnerabilities`) generated from mechanical trait parsing so these effects are visible during review. | This addresses the user-visible gap where fallen aasimar and similar defensive mechanics existed in state but were not explicit in character-sheet trait output. |


## Defer/Risk Register

- RM-006: heuristic classifier drift risk. Keep parser rules conservative until trait inventory is complete.
- RM-005: parser-first migration is complete for Deep Gnome-class path and related choices; legacy UI fallback remains only for compatibility where parser data is absent.
- RM-009: naming cleanup has no behavioral impact and can be done later once mechanics are locked.
- RM-011: parser regexes for legacy race text still rely on heuristic phrase matching and may still miss bracketed spell names or legacy alias text.
- RM-012: acceptance workflow is now repeatable (`scripts/audits/racialSpellParserAudit.ts`), with a current report that splits in-scope parser gaps from deferred pattern classes.
- RM-013: mark-table spell list text (`Spells of the Mark`) appears in many races and is not yet represented by generic spell-grant tokens.
- RM-014: open spell choice phrasing ("one cantrip of your choice") appears in some races without concrete spell IDs and needs separate choice-source modeling.
- RM-007: no in-scope parser gaps currently; remaining work is deferred behavior modeling. Re-run audit after any major race data changes.
- RM-015: visual validation of mapping artifacts is now a routine check; no remaining visual blockers for objective completion.
- RM-017: defensive trait materialization is now applied to character state, so the remaining parity work is broader mechanical enforcement for traits still mapped as text-only (documented in `docs/racial-traits-implementation-mapping.md`) rather than a missing sheet-visibility layer.
- RM-017 Adjacent record: race count discrepancy was resolved by design, not data parity. The 5 race IDs present in `src/data/races` but not in glossary entries are `dragonborn`, `eladrin`, `elf`, `goliath`, and `tiefling` (forced-choice base family records). `ACTIVE_RACES` filters these out via `NON_SELECTABLE_BASE_RACE_IDS`.

## Progress Notes

- Goal is active. Track tasks and status here as mapping proceeds.
- When a task is discovered, add a row immediately.
- If a deferred task becomes required by blocking behavior, move it to in-scope-now and remove defer rationale.

## 2026-05-22 Tracker Sync (Validation pass)
- Scope: Verify objective-complete state for race-mechanics engine and align tracker-critical file paths to repository reality.
- Status: Completed
- Rationale: Core implementation already exists for race-grant spell casting, source-scoped resource checks/consumption, and Deep Gnome-specific grants.
- Dependencies: existing tests in src/utils/combat/__tests__/actionEconomyUtils.test.ts, race reducer and character utility codepaths, race data definitions
- Owner: Codex

### Canonical critical info files (actual paths)
- docs/racial-mechanics-task-tracker.md
- src/utils/combat/actionEconomyUtils.ts
- src/utils/character/spellAbilityFactory.ts
- src/hooks/combat/useActionEconomy.ts
- src/hooks/combat/useAbilitySystem.ts (if present in workspace; currently compatibility note indicates alias path usage)
- src/utils/combat/__tests__/actionEconomyUtils.test.ts
- src/types/combat.ts
- src/utils/character/characterUtils.ts
- src/state/reducers/characterReducer.ts
- src/components/CharacterSheet/Overview/CharacterOverview.tsx
- src/data/races/deep_gnome.ts
- src/data/races/racialTraits.ts
- src/data/races/index.ts
- src/utils/character/characterUtils.test.ts (for race grant behavior assertions)
- src/hooks/useAbilitySystem.ts (combat ability execution path; source-scoped castSource is preserved through `AbilityCost`)
- src/state/characterReducer.ts path is a historical alias; canonical reducer is `src/state/reducers/characterReducer.ts`
- src/character/characterUtils.ts path is a historical alias; canonical utilities are under `src/utils/character/characterUtils.ts`

### Owner & Dependency Index
- RM-001: Owner: Codex. Dependencies: `src/data/races/racialTraits.ts`.
- RM-002: Owner: Codex. Dependencies: `src/data/races/racialTraits.ts`.
- RM-003: Owner: Codex. Dependencies: `src/state/reducers/characterReducer.ts`, `src/utils/character/characterUtils.ts`.
- RM-004: Owner: Codex. Dependencies: `src/data/races/deep_gnome.ts`, `src/data/races/index.ts`.
- RM-005: Owner: Codex. Dependencies: `src/data/races/racialTraits.ts`, `src/state/reducers/characterReducer.ts`, `src/utils/character/characterUtils.ts`.
- RM-006: Owner: Codex. Dependencies: none (deferred).
- RM-007: Owner: Codex. Dependencies: `scripts/audits/trait_analyzer.ts`, race corpus under `src/data/races/`.
- RM-008: Owner: Codex. Dependencies: `src/utils/character/__tests__/characterUtils.test.ts`, `src/state/reducers/__tests__/characterReducer.test.ts`.
- RM-009: Owner: Codex. Dependencies: none (deferred).
- RM-010: Owner: Codex. Dependencies: `src/utils/character/characterUtils.ts`.
- RM-011: Owner: Codex. Dependencies: `src/data/races/racialTraits.ts`.
- RM-012: Owner: Codex. Dependencies: `scripts/audits/racialSpellParserAudit.ts`, `docs/racial-mechanics-parser-gap-audit-2026-05-21.md`.
- RM-013: Owner: Codex. Dependencies: `scripts/audits/markTableSpellSources` (planned) and affected race trait docs.
- RM-014: Owner: Codex. Dependencies: race trait schema + spell-source selection UI.
- RM-015: Owner: Codex. Dependencies: `scripts/audits/trait_analyzer.ts`, `docs/racial-traits-implementation-mapping.json`, `docs/racial-traits-implementation-mapping.md`.
- RM-016: Owner: Codex. Dependencies: `src/utils/combat/actionEconomyUtils.ts`, `src/utils/character/spellAbilityFactory.ts`.
- RM-017: Owner: Codex. Dependencies: `src/utils/character/characterUtils.ts`, `src/utils/combat/actionEconomyUtils.ts`, `src/utils/combat/__tests__/actionEconomyUtils.test.ts`, `src/hooks/combat/useAbilitySystem.ts` (compatibility path review), `src/data/races/racialTraits.ts`, `docs/racial-traits-implementation-mapping.md`.
- RM-018: Owner: Codex. Dependencies: `src/components/CharacterSheet/Overview/CharacterOverview.tsx`.

### Deferred/path-adjacency note
- Task: reconcile user-requested path names vs canonical repo paths in tracker references
- Status: Deferred
- Scope: Documentation alignment only (no runtime behavior change)
- Rationale: Requested paths (src/character/characterUtils.ts, src/state/characterReducer.ts, src/hooks/combat/useAbilitySystem.ts) are legacy/alternate namespaces; canonical implementations live in the corresponding current files. A compatibility note is needed so future edits target active files.
- Dependencies: none
- Owner: Codex
- Handoff note: when adding future race work, use the canonical paths above as source-of-truth; treat legacy paths as aliases or historical references.
