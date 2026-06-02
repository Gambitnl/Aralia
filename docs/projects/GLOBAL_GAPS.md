# Global Gap Tracker

Status: active
Last updated: 2026-06-02 (GG-18, GG-19 added by Racial Mechanics)

Use this file for gaps discovered during project work that do not clearly belong
to the active project's own gap tracker. This is a repo-level surfacing and
routing file for cross-project, orphaned, or out-of-current-scope gaps.

When a living project is created or refreshed, check this file before creating
new gap rows. Import only the gaps that genuinely belong to the project after
critical scope review.

## Gap Log

| Gap ID | Status | Classification | Detected during | Gap | Evidence/source | Why it matters | Suspected owner/project | Routing decision | Destination | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|---|

| GG-1 | untriaged | support_needed_now | World 3D rendering debug (2026-06-01) | Consolidation merge left a stale import that crashed the whole app: `characterValidation.ts` imported `SKILL_DATA` from `dndData.ts`, but skill data was relocated/renamed to `SKILLS_DATA` in `src/data/skills/`. One fix applied locally (uncommitted); other stale imports may exist. | `src/utils/character/characterValidation.ts` (fixed import), `src/data/skills/index.ts` (`SKILLS_DATA`), `src/data/dndData.ts` (no `SKILL_DATA`) | A single bad ESM import blanks the entire app with no error-boundary catch — found only because the 3D preview wouldn't load | Character/data modules (not world3d) | untriaged | none yet | Commit the `characterValidation` fix; grep `src/` for other imports of relocated `dndData`/skill symbols | `tsc --noEmit` clean + app boots to main menu with no blank-page ESM error |
| GG-2 | untriaged | adjacent_follow_up | Racial Mechanics Audit (2026-06-01) | TradeRoute status is cast to 'booming' as a placeholder; richer states are not yet supported or implemented in the business simulation. | `src/systems/economy/TradeRouteManager.ts:136` | Economy simulation remains flat and non-dynamic without varied trade route states. | Economy System | untriaged | none yet | Implement richer TradeRoute states and update simulation logic. | TradeRoute system unit tests. |
| GG-3 | untriaged | adjacent_follow_up | Racial Mechanics Audit (2026-06-01) | Unused imports (Location) and 'any' types in tests indicate technical debt in the economy system. | `src/systems/economy/TradeRouteSystem.ts`, `src/systems/economy/__tests__/TradeRouteSystem.test.ts` | Reduces type safety and maintainability of the economy simulation. | Economy System | untriaged | none yet | Clean up unused imports and replace 'any' with concrete test shapes. | `npm run lint` + `tsc --noEmit`. |
| GG-4 | imported | adjacent_follow_up | World 3D Review (2026-06-01) | The scattering algorithm in `vegetationScatter.ts` recalculates scattering layouts on every viewport shift without instanced mesh caching, leading to GC spikes. | `src/systems/world3d/vegetationScatter.ts` | Causes micro-stuttering and reduced FPS during camera transitions in dense 3D scenes. | World 3D System | imported → world3d (rendering perf; file lives in `src/systems/world3d/`) on 2026-06-02 | `docs/projects/world3d/GAPS.md` (W3D-G25) | Implement instanced mesh caching for vegetation scattering. | Performance profile checks and frame-time tracking. |
| GG-5 | imported | adjacent_follow_up | Character Creator Audit (2026-06-01) | Selecting a race and class that grant overlapping skill proficiencies does not offer alternate skill choices or perform deduplication. | `src/components/CharacterCreator/hooks/useCharacterAssembly.ts` | Breaks D&D 2024 PHB rules, leading to redundant proficiencies. | Character Creator | imported → Racial Mechanics on 2026-06-02 | `docs/projects/racial-mechanics/GAPS.md` (RM-GG5-001) | Implement skill proficiency deduplication and alternate choice selection. | Character sheet validation tests. |
| GG-6 | imported | adjacent_follow_up | Racial Mechanics Implementation (2026-06-02) | "Powerful Build" trait (Orc, Goliath) is not wired into carrying capacity or encumbrance logic. | `src/types/character.ts` (modifier exists), `src/utils/characterUtils.ts` (logic missing) | Racial traits affecting physical capability have no mechanical impact on inventory/encumbrance systems. | Racial Mechanics / Inventory | imported → Racial Mechanics on 2026-06-02 | `docs/projects/racial-mechanics/GAPS.md` (RM-GG6-001) | Update carrying capacity calculation to check for `powerfulBuild` modifier. | Inventory weight capacity tests. |
| GG-7 | imported | adjacent_follow_up | Racial Mechanics Implementation (2026-06-02) | `CharacterOverview.tsx` only displays a single base `Speed` value, failing to show `Flying`, `Swimming`, or `Climbing` speeds. | `src/components/CharacterSheet/Overview/CharacterOverview.tsx:243` | 2024 races (Dragonborn, Sea Elf) rely on alternate movement speeds which are currently invisible in the UI. | Character Sheet UI | imported → Racial Mechanics on 2026-06-02 | `docs/projects/racial-mechanics/GAPS.md` (RM-GG7-001) | Update Vitals section to display all movement speeds from the character state. | Character sheet UI visual check. |
| GG-8 | untriaged | adjacent_follow_up | Racial Mechanics Implementation (2026-06-02) | Spellcasting system does not track or enforce material component requirements, including those with a gold piece cost. | `src/state/reducers/characterReducer.ts` (CAST_SPELL), `src/types/spells.ts` | High-level balancing in D&D relies on resource-heavy spells having a tangible cost in the game world. | Character/Spell System | untriaged | none yet | Implement a component validation check in the spell casting pipeline. | Test casting "Revivify" without 300gp diamonds. |
| GG-9 | imported | adjacent_follow_up | Racial Mechanics Implementation (2026-06-02) | Racial condition immunities (e.g., Yuan-ti's immunity to the Poisoned condition) are not automatically enforced when effects are applied. | `src/state/reducers/characterReducer.ts` (status effect logic) | Mechanical benefits of certain races are ignored by the automated status effect systems. | Racial Mechanics | imported → Racial Mechanics on 2026-06-02 | `docs/projects/racial-mechanics/GAPS.md` (RM-GG9-001) | Update status effect application logic to check character immunities before applying conditions. | Test applying 'poisoned' to a Yuan-ti character. |
| GG-10 | untriaged | adjacent_follow_up | Combat System Durations (2026-06-02) | The Character Creator allows selecting feats (e.g., "War Caster") without verifying if the character meets prerequisites like spellcasting capability or level thresholds. | `src/components/CharacterCreator/hooks/useCharacterAssembly.ts` | Permits illegal character builds violating D&D 2024 PHB rules, breaking mechanical integrity. | Character Creator | untriaged | none yet | Implement prerequisite checking in the feat selection module. | Add unit tests verifying invalid feat selections are rejected. |
| GG-11 | untriaged | adjacent_follow_up | Combat System Durations (2026-06-02) | Equipped items requiring attunement do not check or enforce the limit of 3 attuned items, nor do they prevent receiving benefits of unattuned items. | `src/state/reducers/characterReducer.ts` or `src/utils/characterUtils.ts` | Allows characters to equip unlimited attunement items, bypassing high-level balancing rules. | Inventory / State | untriaged | none yet | Add check in equipItem pipeline to count attuned items and reject if limit exceeded. | Test equipping 4 items requiring attunement. |
| GG-12 | untriaged | adjacent_follow_up | Racial Mechanics Implementation (2026-06-02) | Inventory system lacks a "Junk" management feature, making it tedious for players to sell multiple low-value items. | `src/components/Inventory/InventoryList.tsx` | UI friction during merchant interactions reduces the pace of gameplay. | Character/Inventory | untriaged | none yet | Implement "Mark as Junk" and "Sell All Junk" functionality in inventory and merchant views. | Verify bulk-selling logic in merchant modal. |
| GG-13 | untriaged | adjacent_follow_up | Racial Mechanics Implementation (2026-06-02) | Combat log state is transient and cleared upon page reload, with no history or export functionality. | `src/state/reducers/combatReducer.ts` | Important combat events and results are lost, hindering long-term tactical review or bug reporting. | Combat System | untriaged | none yet | Implement local storage persistence or an export feature for the combat log. | Verify log persistence after page refresh. |
| GG-14 | untriaged | test_infrastructure | World 3D UI minimap slice (2026-06-02) | jsdom has no canvas backend, so `HTMLCanvasElement.getContext()` throws "Not implemented" in unit tests; every canvas-painting component (`World3DMinimap`, `WorldAtlasStrip`, `MapTile`, submap painters) can assert mount/props but **not** its actual paint output. | vitest run logs: "Not implemented: HTMLCanvasElement's getContext() method" on `World3DMinimap.test.tsx` and `WorldAtlasStrip.test.tsx` | Pixel/draw-call regressions in minimaps and map tiles are invisible to CI; tests give false confidence on rendering logic | Test infrastructure / tooling | untriaged | none yet | Add `vitest-canvas-mock` (or node-canvas) to the test setup so `getContext('2d')` returns a spyable stub; assert key fillRect/clearRect calls in one canvas component as a pattern | Canvas test asserts ≥1 `fillRect` call without the "Not implemented" warning |
| GG-15 | untriaged | dev_experience | World 3D UI Playwright run (2026-06-02) | The Vite dev server proxies `/api/ollama/*` to `http://localhost:11434`; when Ollama isn't running it floods the WebServer log with repeated `ECONNREFUSED` AggregateError stacks during every dev/Playwright session. | Playwright `[WebServer]` output: "[proxy] /api/ollama/tags -> http://localhost:11434/api failed (ECONNREFUSED)" repeated; `vite.config.ts` proxy target | Drowns real errors in CI/dev logs and adds connection-retry latency; new contributors think the app is broken | Dev tooling / Vite config | untriaged | none yet | Gate the Ollama proxy behind an env flag or add `configure`/`onError` handling that logs once and suppresses the stack when the target is down | Dev/Playwright run with Ollama off shows at most one suppressed warning, no repeated stacks |
| GG-16 | untriaged | dev_experience | WorldSim WSS-004 remediation (2026-06-02) | The `@dependencies-start` codebase-visualizer advisory header in `worldDataMigration.ts` declares "Dependents: None (Orphan)", but the module is imported by `mapService.ts` and `saveLoadService.ts`. The auto-sync headers are stale across the repo and misreport the dependency graph. | `src/state/migrations/worldDataMigration.ts` (header says Orphan) vs `src/services/mapService.ts:25` and `src/services/saveLoadService.ts` (both import it) | Multi-agent "safety" decisions are made off these headers; a wrong "Orphan" verdict invites unsafe edits/deletions of a file that is actually on the world-load critical path | Dev tooling / codebase-visualizer | untriaged | none yet | Re-run the visualizer `--sync` across `src/` (or fix the generator) so dependent lists are accurate; consider a CI check that fails on stale headers | A sampled set of advisory headers matches `tsc`/import-graph reality |
| GG-17 | untriaged | adjacent_follow_up | WorldSim WSS-004 remediation (2026-06-02) | `src/types/world.ts` and a parallel hand-maintained `src/types/world.d.ts` both declare the same interfaces (e.g. `WorldGenDiagnostics`); a contract change must be edited in both by hand or the `.d.ts` silently drifts from the `.ts`. The `.d.ts` looks like a stale duplicate that is not generated from the source. | `src/types/world.ts:244-257` and `src/types/world.d.ts:212-216` (both define `WorldGenDiagnostics`) | Type drift between the two files can let wrong types pass review/CI; every type change pays a double-edit tax and is error-prone | Types / build hygiene | untriaged | none yet | Decide a single source of truth: delete the checked-in `.d.ts` and let `tsc` emit it, or generate it in CI; remove the manual mirror | Only one hand-edited declaration of each `world` type remains; CI guards regeneration |
| GG-18 | untriaged | dev_experience | Racial Mechanics Implementation (2026-06-02) | Character Creator lacks a "Save Draft" or local persistence feature; unexpected crashes or page reloads result in complete loss of character progress. | User feedback / observation during crash fix. | High risk of user frustration and churn if progress is lost during a multi-step creation process. | UI / UX | untriaged | none yet | Implement local storage persistence for the Character Creator state. | Verify progress retention after page refresh. |
| GG-19 | untriaged | UI_polish | Racial Mechanics Implementation (2026-06-02) | Character Sheet does not provide visual feedback (e.g. red text or a warning icon) when a character suffers a speed penalty from wearing Heavy Armor without meeting the Strength requirement. | `src/components/CharacterSheet/Overview/CharacterOverview.tsx` | Obscures mechanical penalties, leading to confusion about why speed values are lower than expected. | UI / Character Sheet | untriaged | none yet | Add a warning indicator to the Speed field in `CharacterOverview` when an armor-based penalty is active. | Verify warning visibility for a low-STR character in Plate armor. |

## Status Vocabulary

| Status | Meaning |
|---|---|
| `untriaged` | Recorded for surfacing; no owning project has accepted it yet. |
| `candidate` | May belong to a known project, but needs critical scope review. |
| `imported` | Accepted into a project gap tracker; destination is linked. |
| `routed` | Sent to another existing subsystem tracker; destination is linked. |
| `declined` | Reviewed and intentionally not accepted; rationale is recorded. |
| `done` | Resolved with completion evidence linked or summarized. |

## Routing Rules

- Add gaps here when they are cross-project, orphaned, or outside the active
  project's current scope.
- Do not add gaps here just because they are inconvenient. If the active project
  cannot honestly complete without the gap, it belongs in the project tracker or
  project `GAPS.md`.
- When a project imports a global gap, copy the actionable context into that
  project's `GAPS.md`, then mark the global row `imported` and link the
  destination. Preserve the global row as routing history.
- When the gap clearly belongs to another established subsystem, mark the row
  `routed` and link that subsystem's tracker.
- When scope review rejects a gap, mark it `declined` with a concise reason.
- **Only change a row's Status for gaps inside YOUR active project's scope**
  (import/decline/route those). If a row belongs to a *different* project, leave
  its Status `untriaged` for the owner to claim — do NOT mark it
  `declined`/`routed`/`imported` on the owner's behalf. You may fill or correct
  the `Suspected owner/project` column so future out-of-score agents can skip it
  in one glance (a hint, not a status claim). A gap leaves the active triage pool
  only when its **owner** imports/declines/routes it. Truly orphaned,
  no-clear-owner gaps stay `untriaged` and should be escalated for a human
  routing decision rather than force-statused.

## Physical object registry for combat/world targeting - 2026-05-31

Source project: Structured Spell Execution (docs/tasks/spell-system-overhaul).

Problem:
- Spell targeting now has a minimal runtime object validation envelope, but there is no shared combat/world source of positioned targetable physical objects.
- Existing battle-map decorations are visual/terrain obstacle metadata, not spell-targetable object entities.
- Existing loot generation returns unpositioned item results, not battle-map object candidates.

Needed system:
- A physical object registry or adapter that can expose positioned object candidates with stable ids, names, positions, size, weight, magical status, worn/carried/fixed state, and enough map context for line-of-sight/range checks.

Why global:
- This is not only spell execution. It also touches battle-map interaction, loot placement, object inspection, inventory/world item state, and environmental manipulation.

Spell-side dependency:
- TargetResolver.isValidObjectTarget can validate supplied candidates once such a registry exists.
