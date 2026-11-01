# Aralia Project Tracker (Seed Inventory)

This file is a deliberately expansion-first inventory for gap discovery and planning.
It mixes implemented, partial, and planned initiatives and intentionally prefers
preserving intent over strict completion.

## Legend

- **Status**: planned | partial | in-progress | active | idle | experimental
- **Confidence**: high / medium / low (how strongly evidence supports project distinctness and boundaries)
- **Evidence**: minimal file-system evidence showing intentional scope
- **Gap signal**: whether explicit gap artifact exists or a gap pass is still required

## 🏛️ The Agora - Agent Collaborative Spaces

**Agora is the local peer-coordination daemon for agents sharing this checkout.** Multiple
agents work `F:\Repos\Aralia` concurrently and otherwise clobber each other (most
destructively via `git reset --hard`). If you are an agent and another agent may be active,
**use Agora**: register your presence, lock files before editing, and announce/claim work so
nobody overwrites anyone. Locks are advisory (honor-system) - cooperation is the whole point.

- **Is it up?** `curl -s http://localhost:4319/health` (`"ok": true` ⇒ running)
- **Start it:** `npm run agora`
- **Full API + worker etiquette:** [`tools/agora/PROTOCOL.md`](../../tools/agora/PROTOCOL.md)
- **Running a multi-agent campaign (ORCHESTRATORS start here):** [`tools/agora/ORCHESTRATOR.md`](../../tools/agora/ORCHESTRATOR.md) - ties the board + agent matrix + this tracker together, end to end
- **Design spec:** [`tools/agora/AGENT.md`](../../tools/agora/AGENT.md) - the 2026-06-27 dated design spec (docs/superpowers/specs) was retired into git history by the 2026-09 dated-docs consolidation (removed in 4448b9d97); PROTOCOL.md + AGENT.md are the living design record
- **Etiquette loop:** **register** on arrival -> **lock** paths before editing (and check
  `/locks` before any risky `git reset`/`checkout`) -> **announce** (post a task / `say`) ->
  **release** locks + mark task done when finished. Heartbeat occasionally.

## Project -> North Star map (copy-ready)

| Project | North Star |
|---|---|
| Gameplay Flow | [docs/projects/gameplay-flow/NORTH_STAR.md](gameplay-flow/NORTH_STAR.md) - active integrated play loop: interactive towns, resident lives and memory, story exploration, companions, 3D presentation, and logical UI |
| Whole-Game Systems Audit and Gap Resolution | [docs/architecture/domains/test-quality.md](../architecture/domains/test-quality.md) - absorbed 2026-07-16; planmap topic `whole-game-systems-audit` |
| Combat System | [docs/architecture/domains/combat.md](../architecture/domains/combat.md) - absorbed 2026-07-16 |
| Companions System | [docs/architecture/domains/npcs-companions.md](../architecture/domains/npcs-companions.md) - absorbed 2026-07-16 |
| Crafting System | [docs/architecture/domains/crafting-economy.md](../architecture/domains/crafting-economy.md) - absorbed 2026-07-16 |
| Creatures System | [docs/architecture/domains/creature-taxonomy.md](../architecture/domains/creature-taxonomy.md) - absorbed 2026-07-16 |
| Crime System | [docs/architecture/domains/intrigue-crime.md](../architecture/domains/intrigue-crime.md) - absorbed 2026-07-16 |
| Economy System | [docs/architecture/domains/crafting-economy.md](../architecture/domains/crafting-economy.md) - absorbed 2026-07-16 |
| Environment System | [docs/architecture/domains/environment-physics.md](../architecture/domains/environment-physics.md) - absorbed 2026-07-16 |
| Events System | [docs/architecture/domains/time-world-events.md](../architecture/domains/time-world-events.md) - absorbed 2026-07-16 |
| History System | planmap `parked (2026-07-15, no link) · W09 Simulation time and environment · tracker row stale vs planmap: planmap has a dedicated parked topic, not just absorption into time-world-events |
| Intrigue System | [docs/architecture/domains/intrigue-crime.md](../architecture/domains/intrigue-crime.md) - absorbed 2026-07-16 |
| Logic System | planmap `parked (2026-07-15, no link) · W-step unconfirmed (core/game-logic rules have no clean single-wave home; W05 character mechanics or W09 simulation both partial-fit) · parked pending W-step ruling |
| Memory System | planmap `done (4/4 features, 2026-07-09 handover) · absorbed into npcs-companions.md · tracker 'partial' label stale: planmap says done |
| Naval System | planmap `parked (2026-07-15, no link) · W08 Extended travel and realms (with Planar/Underdark) · tracker 'partial' label stale vs planmap parked |
| Physics System | planmap `parked (2026-07-15, no link) · W09 Simulation time and environment (with Time) · tracker 'partial' label stale vs planmap parked |
| Planar System | planmap `parked (2026-07-15, no link) · W08 Extended travel and realms (with Naval/Underdark) · tracker 'partial' label stale vs planmap parked |
| Puzzles System | [docs/architecture/domains/puzzles-quests-rituals.md](../architecture/domains/puzzles-quests-rituals.md) - absorbed 2026-07-16 |
| Quests System | [docs/architecture/domains/puzzles-quests-rituals.md](../architecture/domains/puzzles-quests-rituals.md) - absorbed 2026-07-16 |
| Religion System | planmap `parked (2026-07-15, no link) · W07 Factions crime and faith (with Rituals) · parked pending build decision |
| Rituals System | planmap `done (4/4 features: schema, manager fixture, executor routing, battle-map progress) · absorbed into puzzles-quests-rituals.md · tracker 'partial' label stale: planmap says done |
| Spells Parent | [docs/projects/spells/NORTH_STAR.md](spells/NORTH_STAR.md) |
| Time System | planmap `active (4/5 features done: G1 time contract, G3 seasons, G4 rest/day-boundary, G5 dialogue day-part; G2 day-boundary test done) · W09 Simulation time and environment · tracker 'partial' label stale vs planmap active |
| Travel System | [docs/architecture/domains/overland-travel.md](../architecture/domains/overland-travel.md) - absorbed 2026-07-16 |
| Underdark System | planmap `done (1/1: magical_darkness on UnderdarkBiome) · absorbed into naval-underdark.md · tracker 'partial' label stale: planmap says done |
| Visibility System | planmap `done (1/1: ambientLight on BattleMapData) · absorbed into battle-map.md · tracker 'partial' label stale: planmap says done |
| World System | [docs/architecture/domains/world-map.md](../architecture/domains/world-map.md) - absorbed 2026-07-16 |
| World 3D System | [docs/architecture/domains/streamed-3d-world.md](../architecture/domains/streamed-3d-world.md) - absorbed 2026-07-16 |
| Action Pane | [docs/architecture/domains/ui-modals.md](../architecture/domains/ui-modals.md) - absorbed 2026-07-16 |
| Battle Map | [docs/architecture/domains/battle-map.md](../architecture/domains/battle-map.md) - absorbed 2026-07-16 |
| Character Creator | [docs/architecture/domains/character-creator.md](../architecture/domains/character-creator.md) - absorbed 2026-07-16 |
| Character Sheet | [docs/architecture/domains/character-sheet.md](../architecture/domains/character-sheet.md) - absorbed 2026-07-16 |
| Compass Pane | [docs/architecture/domains/world-map.md](../architecture/domains/world-map.md) - absorbed 2026-07-16 |
| Conversation Panel | [docs/architecture/domains/npcs-companions.md](../architecture/domains/npcs-companions.md) - absorbed 2026-07-16 |
| Crafting UI | [docs/architecture/domains/crafting-economy.md](../architecture/domains/crafting-economy.md) - absorbed 2026-07-16 |
| Crime UI | [docs/architecture/domains/intrigue-crime.md](../architecture/domains/intrigue-crime.md) - absorbed 2026-07-16 |
| Demo Area | [docs/architecture/domains/design-preview-navigation.md](../architecture/domains/design-preview-navigation.md) - reference artifact |
| Design Preview | [docs/architecture/domains/design-preview-navigation.md](../architecture/domains/design-preview-navigation.md) - absorbed 2026-07-16 |
| Design Preview Scenarios | [docs/architecture/domains/design-preview-navigation.md](../architecture/domains/design-preview-navigation.md) - absorbed 2026-07-16 |
| Design Preview Scenarios / Cover Mechanics | [docs/architecture/domains/battle-map.md](../architecture/domains/battle-map.md) - absorbed 2026-07-16 |
| Design Preview Scenarios / Darkvision & Senses | [docs/architecture/domains/battle-map.md](../architecture/domains/battle-map.md) - absorbed 2026-07-16 |
| Design Preview Scenarios / Difficult Terrain | [docs/architecture/domains/battle-map.md](../architecture/domains/battle-map.md) - absorbed 2026-07-16 |
| Design Preview Scenarios / Spell Concentration | [docs/architecture/domains/spells.md](../architecture/domains/spells.md) - absorbed 2026-07-16 |
| Design Preview Scenarios / Opportunity Attacks | [docs/architecture/domains/combat.md](../architecture/domains/combat.md) - absorbed 2026-07-16 |
| Design Preview Scenarios / Resistance & Vulnerability | [docs/architecture/domains/combat.md](../architecture/domains/combat.md) - absorbed 2026-07-16 |
| Dialogue | [docs/architecture/domains/npcs-companions.md](../architecture/domains/npcs-companions.md) - absorbed 2026-07-16 |
| Dice | [docs/architecture/domains/core-systems.md](../architecture/domains/core-systems.md) - absorbed 2026-07-16; project folder at `docs/projects/dice` |
| Economy UI | [docs/architecture/domains/crafting-economy.md](../architecture/domains/crafting-economy.md) - absorbed 2026-07-16 |
| Encounter Generator | [docs/architecture/domains/creature-taxonomy.md](../architecture/domains/creature-taxonomy.md) - absorbed 2026-07-16 |
| Glossary UI | [docs/architecture/domains/glossary.md](../architecture/domains/glossary.md) - absorbed 2026-07-16 |
| Logbook | [docs/architecture/domains/puzzles-quests-rituals.md](../architecture/domains/puzzles-quests-rituals.md) - absorbed 2026-07-16 |
| Naval UI | [docs/architecture/domains/naval-underdark.md](../architecture/domains/naval-underdark.md) - absorbed 2026-07-16 |
| Organization | [docs/architecture/domains/core-systems.md](../architecture/domains/core-systems.md) - absorbed 2026-07-16 |
| Party UI | [docs/architecture/domains/npcs-companions.md](../architecture/domains/npcs-companions.md) - absorbed 2026-07-16 |
| Quest Log | [docs/architecture/domains/puzzles-quests-rituals.md](../architecture/domains/puzzles-quests-rituals.md) - absorbed 2026-07-16 |
| SaveLoad | [docs/architecture/domains/data-pipelines.md](../architecture/domains/data-pipelines.md) - absorbed 2026-07-16 |
| Submap and Tile-Grid Retirement | [docs/architecture/domains/submap.md](../architecture/domains/submap.md) - absorbed 2026-07-16; project folder at `docs/projects/submap` |
| Trade UI | [docs/architecture/domains/items-trade-inventory.md](../architecture/domains/items-trade-inventory.md) - absorbed 2026-07-16 |
| Town | [docs/architecture/domains/town-map.md](../architecture/domains/town-map.md) - absorbed 2026-07-16 |
| ThreeD Modal | [docs/architecture/domains/streamed-3d-world.md](../architecture/domains/streamed-3d-world.md) - absorbed into World 3D UI 2026-06-10 (D5) |
| World 3D UI | [docs/architecture/domains/streamed-3d-world.md](../architecture/domains/streamed-3d-world.md) - absorbed 2026-07-16 |
| Types UI | [docs/architecture/domains/ui-modals.md](../architecture/domains/ui-modals.md) - absorbed 2026-07-16 |
| Layout | [docs/architecture/domains/ui-modals.md](../architecture/domains/ui-modals.md) - absorbed 2026-07-16 |
| Providers | [docs/architecture/domains/ui-modals.md](../architecture/domains/ui-modals.md) - absorbed 2026-07-16 |
| UI Primitives | [docs/architecture/domains/ui-modals.md](../architecture/domains/ui-modals.md) - absorbed 2026-07-16 |
| Submap Generation | [docs/architecture/domains/submap.md](../architecture/domains/submap.md) - absorbed 2026-07-16 |
| Command Base Runtime | [docs/architecture/domains/commands.md](../architecture/domains/commands.md) - absorbed 2026-07-16 |
| Command Effects Runtime | [docs/architecture/domains/commands.md](../architecture/domains/commands.md) - absorbed 2026-07-16 |
| Command Factory Runtime | [docs/architecture/domains/commands.md](../architecture/domains/commands.md) - absorbed 2026-07-16 |
| Gemini Service | [docs/architecture/domains/data-pipelines.md](../architecture/domains/data-pipelines.md) - absorbed 2026-07-16 |
| Ollama Service | [docs/architecture/domains/data-pipelines.md](../architecture/domains/data-pipelines.md) - absorbed 2026-07-16 |
| RealmSmith Service | [docs/architecture/domains/data-pipelines.md](../architecture/domains/data-pipelines.md) - absorbed 2026-07-16 |
| WorldSim Service | [docs/architecture/domains/data-pipelines.md](../architecture/domains/data-pipelines.md) - absorbed 2026-07-16 |
| Scripts: archive | [docs/architecture/domains/test-quality.md](../architecture/domains/test-quality.md) - absorbed 2026-07-16 |
| Scripts: audits | [docs/architecture/domains/test-quality.md](../architecture/domains/test-quality.md) - absorbed 2026-07-16 |
| Scripts: git | [docs/architecture/domains/developer-environment.md](../architecture/domains/developer-environment.md) - absorbed 2026-07-16 |
| Scripts: quality | [docs/architecture/domains/test-quality.md](../architecture/domains/test-quality.md) - absorbed 2026-07-16 |
| Scripts: spell-runtime-template-audit | [docs/architecture/domains/test-quality.md](../architecture/domains/test-quality.md) - absorbed 2026-07-16 |
| Scripts: tooling | [docs/architecture/domains/developer-environment.md](../architecture/domains/developer-environment.md) - absorbed 2026-07-16 |
| Scripts: workflows | [docs/architecture/domains/developer-environment.md](../architecture/domains/developer-environment.md) - absorbed 2026-07-16 |
| Script tests | [docs/architecture/domains/test-quality.md](../architecture/domains/test-quality.md) - absorbed 2026-07-16 |
| Item Categorization | [docs/architecture/domains/items-trade-inventory.md](../architecture/domains/items-trade-inventory.md) - absorbed 2026-07-16 |
| PHB 2024 Glossary Audit | [docs/architecture/domains/glossary-data.md](../architecture/domains/glossary-data.md) - archived reference-only per D24 |
| Tiered Autosave | [docs/architecture/domains/data-pipelines.md](../architecture/domains/data-pipelines.md) - absorbed 2026-07-16 |
| Town Description System | [docs/architecture/domains/town-map.md](../architecture/domains/town-map.md) - absorbed 2026-07-16 |
| 3D Combat Map | [docs/architecture/domains/battle-map.md](../architecture/domains/battle-map.md) - absorbed into plan-map topic `combat-map-reskin` on 2026-07-15; the dated absorbed-3d-combat-map spec was retired into git history by the 2026-09 dated-docs consolidation (removed in 4448b9d97); the old `conductor/` path is gone, see [CONDUCTOR_RETIRED.md](CONDUCTOR_RETIRED.md) |
| Action System Refactor | [docs/tasks/action-system-refactor/NORTH_STAR.md](../tasks/action-system-refactor/NORTH_STAR.md) |
| Architecture Sweep | [docs/archive/tasks/architecture/NORTH_STAR.md](../archive/tasks/architecture/NORTH_STAR.md) - archived task |
| Combat Messaging Enhancement | [docs/tasks/combat-messaging-enhancement/NORTH_STAR.md](../tasks/combat-messaging-enhancement/NORTH_STAR.md) |
| Combat Scenario Tester | [docs/tasks/combat-scenario-tester/NORTH_STAR.md](../tasks/combat-scenario-tester/NORTH_STAR.md) |
| Code Modularization Audit | [docs/architecture/domains/technical-debt-scanner.md](../architecture/domains/technical-debt-scanner.md) - absorbed 2026-07-16 |
| Documentation Cleanup | [docs/tasks/documentation-cleanup/NORTH_STAR.md](../tasks/documentation-cleanup/NORTH_STAR.md) |
| Feature Capabilities | [docs/tasks/feature-capabilities/NORTH_STAR.md](../tasks/feature-capabilities/NORTH_STAR.md) |
| Glossary | [docs/tasks/glossary/NORTH_STAR.md](../tasks/glossary/NORTH_STAR.md) |
| Spells / Spell Completeness Audit subproject | [docs/projects/spells/subprojects/spell-completeness-audit/SPELL_COMPLETENESS_COVERAGE_SNAPSHOT.md](spells/subprojects/spell-completeness-audit/SPELL_COMPLETENESS_COVERAGE_SNAPSHOT.md) (parent: [spells/NORTH_STAR.md](spells/NORTH_STAR.md)) |
| Spells / Structured Spell Execution subproject | [docs/tasks/spells/NORTH_STAR.md](../tasks/spells/NORTH_STAR.md) (parent: [spells/NORTH_STAR.md](spells/NORTH_STAR.md)) |
| Testing Overhaul | [docs/tasks/testing-overhaul/NORTH_STAR.md](../tasks/testing-overhaul/NORTH_STAR.md) |
| UI Features | [docs/tasks/ui-features/NORTH_STAR.md](../tasks/ui-features/NORTH_STAR.md) |
| Weapon Proficiency System | [docs/tasks/weapon-proficiency-system/NORTH_STAR.md](../tasks/weapon-proficiency-system/NORTH_STAR.md) |
| Investigation Task Cluster | [docs/tasks/investigations/NORTH_STAR.md](../tasks/investigations/NORTH_STAR.md) |
| Item Icons | [docs/archive/tasks/item-icons/NORTH_STAR.md](../archive/tasks/item-icons/NORTH_STAR.md) - archived task |
| Roadmap Maintenance | [docs/tasks/roadmap/NORTH_STAR.md](../tasks/roadmap/NORTH_STAR.md) |
| Racial Mechanics / Race Hierarchy | [docs/architecture/domains/character-creator.md](../architecture/domains/character-creator.md) - absorbed 2026-07-16; parked planmap topic `racial-mechanics` |
| Spells / Spell Phase Workstream merged reference | [docs/tasks/spells/NORTH_STAR.md](../tasks/spells/NORTH_STAR.md) |
| Worldforge (flagship) | [docs/architecture/domains/region-terrain.md](../architecture/domains/region-terrain.md) - living home of the worldforge generation pipeline (`generateRegion`); companions: town-map.md + streamed-3d-world.md. The dated absorbed-worldforge spec was retired into git history by the 2026-09 dated-docs consolidation (removed in 4448b9d97; recover via `git show 4448b9d97^:docs/superpowers/specs/2026-07-14-absorbed-worldforge.md`) |

## North Star sanity check (2026-06-01)

I validated all North Star references already present in this tracker:

- `docs/projects/racial-mechanics/NORTH_STAR.md`
- `docs/projects/racial-mechanics/TRACKER.md`
- `docs/tasks/spell-system-overhaul/NORTH_STAR.md`
- `docs/tasks/spell-system-overhaul/TRACKER.md`
- `docs/tasks/spell-system-overhaul/GAPS.md`
- `docs/tasks/spell-system-overhaul/TASK_SLICE.md`
- `docs/tasks/spell-system-overhaul/DECISIONS.md`
- `docs/tasks/spell-system-overhaul/AUDIT_OR_PROOF.md`
- `docs/tasks/spell-system-overhaul/RUNBOOK.md`
- `docs/tasks/spell-system-overhaul/ARCHITECTURE_NOTE.md`

No referenced `NORTH_STAR.md` files are missing from the current tracker paths.

## Living Project Registration Rule

Every task converted with the living project protocol should be registered here.
Before adding a row, check whether an existing row already owns the same system,
feature, task cluster, or planning area. Refresh the existing row rather than
duplicating it.

New or refreshed rows should point to the project's North Star, tracker, and
gap file when they exist. If the project imported rows from
`docs/projects/GLOBAL_GAPS.md`, mention the imported global gap IDs in the gap
signal or next step when useful.

Some rows are intentionally preregistered before living-project docs exist. If
an agent later converts work for one of these rows, the row is the discovery
anchor. Create the missing North Star and supporting docs in the correct owning
folder, then refresh the existing row with those links instead of adding a
duplicate project.

## Decision Blitz (2026-06-10)

All pending Required Review Briefs / `blocked_human_decision` items across
`docs/projects/*` and `docs/tasks/*` were resolved by the owner on 2026-06-10;
the master record `DECISION_BLITZ_2026-06-10.md` was retired into git history by the
2026-09 dated-docs consolidation (recover with
`git show 4448b9d97^:docs/projects/DECISION_BLITZ_2026-06-10.md`)
(decisions D1-D24 plus items converted to work). Guardrail and project rows
below were refreshed accordingly - formerly review-blocked lanes now read as
current. Several decisions follow the June 2026 campaign context recorded in
that file: a unified Azgaar-based proc-gen pipeline extending below Azgaar's
deepest zoom to replace the Submap, continuing into a 3D ground-level mode,
with owned town generation, 3D enterable towns, and an entity generation pipeline.

## Dashboard Assignment Guardrails (2026-06-08)

Projects in this table are still preserved as discoverable intent, but they are
not safe targets for forward-moving sub-agent iteration until the review flag is
cleared in the owning project docs. Do not delete their systems as part of this
classification. The Decision Blitz (2026-06-10) cleared most of the holds below;
each row's Assignment rule cell is authoritative.

| Project/scope | Lifecycle status | Deprecation confidence | Canonical owner | Assignment rule | Evidence/rationale |
|---|---|---|---|---|---|
| Demo Area (`docs/projects/demo-area`) | reference-only (by decision) | medium | `docs/projects/demo-area` (decided 2026-06-10) | Reference-only by choice; no forward iteration needed - decision no longer pending | D19 (Decision Blitz 2026-06-10): `src/components/demo/CombatMessagingDemo.tsx` is retained as a reference artifact; the keep/move/remove question is resolved as keep (no re-home, no removal). |
| PHB 2024 Glossary Audit (`docs/projects/phb2024_glossary_audit`) | archived reference-only | medium | `docs/projects/item_categorization` for item metadata; `docs/tasks/glossary` for broader glossary workflow | Do not assign forward iteration; remaining gaps stay routed to the adjacent owners | Archived reference-only per D24 (Decision Blitz 2026-06-10); implementation slice complete, remaining gaps stay routed to Item Categorization and Glossary maintenance. |
| Roadmap task folder (`docs/tasks/roadmap`) | merged-reference | strong | `docs/projects/roadmap-maintenance` | Assign only through Roadmap Maintenance | `roadmap-maintenance/NORTH_STAR.md` names this folder as historical/task evidence while the project folder is the durable dashboard owner. |
| 3D Combat Map old conductor path (`conductor/projects/3d-combat-map`) | RESOLVED 2026-09-05 | - | `docs/superpowers/specs/2026-07-14-absorbed-3d-combat-map.md` | `conductor/` was deleted; that path was never tracked and is gone for good. Note `docs/projects/3d-combat-map` does NOT exist either. See CONDUCTOR_RETIRED.md. |
| Spell Phase Workstream row | merged-reference | strong | `docs/tasks/spell-system-overhaul` / Structured Spell Execution | Assign only through Structured Spell Execution | This row points at the same spell-overhaul workstream already registered as Structured Spell Execution. |
| Crime System (`docs/projects/crime`) | complete_for_current_gap_set | none | `docs/projects/crime` | Do not assign more Crime work without a fresh source-backed gap scan | NORTH_STAR repaired 2026-06-11 (orchestrator): ~141k lines of foreign corpus removed, legit frontmatter/body preserved, statuses normalized (see the file's Repair Note). G1 expired-bounty cleanup, G2 fence outcome contract, G3 market utility ownership, G4 heat/severity boundary, G5 TODO/type-debt classification, and G6 suspect/report decision resolved 2026-06-25. |
| Script tests (`docs/projects/script-tests`) | merged-reference | strong | `docs/projects/scripts-quality` | Assign only through Scripts: quality | Merged into Scripts: quality per D21 (Decision Blitz 2026-06-10); `script-tests` is support surface of `docs/projects/scripts-quality` and its tracker row is merged-reference. |
| Scripts: spell-runtime-template-audit (`docs/projects/scripts-spell-runtime-template-audit`) | linked-support | high | `docs/projects/scripts-spell-runtime-template-audit`; linked from `docs/projects/spells/SUBPROJECTS.md` | Assignment allowed in the scripts project for audit/vocabulary work; import only product-runtime gaps into Spells | Ownership decision encoded 2026-06-22: this remains a standalone scripts/tooling project and linked support for Spells, not an owned Spells child lane. SRTA-001 still implements the D22 vocabulary registration with migration notes. |
| ThreeD Modal (`docs/projects/three-d-modal`) | merged-reference | strong | `docs/projects/world-3d-ui` | Assign only through World 3D UI | Merged into World 3D UI per D5 (Decision Blitz 2026-06-10); World 3D UI is single owner of all 3D entrypoints (modal launch, phase transition, close/focus policy); ThreeD Modal docs are merged-reference. |
| Character Creator (`docs/projects/character-creator`) | active | strong | same project | Forward assignment allowed; review hold cleared 2026-06-10 | `GAPS.md` G2 (sidebar navigation policy) was already resolved 2026-06-08 in favor of permissive navigation; Decision Blitz 2026-06-10 confirms the hold is dropped (no decision was outstanding). |
| Scripts: audits (`docs/projects/scripts-audits`) | policy-decided | strong | same project | Forward assignment allowed under the manual policy | S4 decided per D20 (Decision Blitz 2026-06-10): audits stay optional/manual, no CI gates this cycle; revisit when the audit suite stabilizes; unblocks CMA-G19 under the manual policy. |
| World System (`docs/projects/world`) | complete_for_world_owned_scope | strong | same project | Do not assign more World work unless a new source-backed World-owned gap is opened | 2026-06-18: T2/T4-T18 complete. World has 0 open gaps: G1/G2/G3/G4/G5/G7/G9/G10 resolved; G6/G8/G11 routed to owner projects. Remaining related work belongs to WorldSim Service WSS-001, Travel G6-G10, Submap G9-G12, and Global GG-29. |
| Submap and Tile-Grid Retirement (`docs/projects/submap`) | active | strong | `docs/projects/submap` | Assign setup and inventory work (T6) | Upgraded on 2026-06-15 to own the retirement of both the Submap system and the legacy rectangular tile-grid world model. |
| Layout/App shell (`docs/projects/layout`) | app-shell-split-approved | strong | same project | Assignment allowed for the app-shell split slice with preservation tests | G3/G4 decided per D7 (Decision Blitz 2026-06-10): split the app shell with explicit tests preserving provider order, `DataLoaderGate`, and `GameProvider` boundaries; `isUIInteractive` stays as a documented compatibility pass-through (wire or retire later - separate decision). |
| Providers/App provider stack (`docs/projects/providers`) | provider-split-approved | strong | same project | Assignment allowed for the provider-split slice with boundary preservation tests | G5 decided per D7 (Decision Blitz 2026-06-10): move provider composition out of `App.tsx` into a dedicated app-shell module with explicit tests preserving provider order, `DataLoaderGate`, and `GameProvider` boundaries. |

## Gameplay & World Systems (`src/systems/*`)

| Project | Status | Confidence | Evidence | Gap signal | Living project protocol | Next step |
|---|---|---|---|---|---|---|
| Combat System (`combat`) | active | high | `src/systems/combat`, `src/components/Combat`, `src/utils/combat` | GAPS.md present; current behavior gaps resolved through G20/G23/G24/G25 and related rule slices; G30 decided 2026-06-10 - Code Modularization Audit owns the split plan, Combat contributes invariants/tests (D6) | implemented | contribute Combat invariants and tests for the `useAbilitySystem.ts`/`useCombatEngine.ts` split plan owned by Code Modularization Audit, before any code movement |
| Companions System | [docs/architecture/domains/npcs-companions.md](../architecture/domains/npcs-companions.md) - absorbed 2026-07-16 |
| Crafting System | [docs/architecture/domains/crafting-economy.md](../architecture/domains/crafting-economy.md) - absorbed 2026-07-16 |
| Creatures System | [docs/architecture/domains/creature-taxonomy.md](../architecture/domains/creature-taxonomy.md) - absorbed 2026-07-16 |
| Crime System | [docs/architecture/domains/intrigue-crime.md](../architecture/domains/intrigue-crime.md) - absorbed 2026-07-16 |
| Economy System | [docs/architecture/domains/crafting-economy.md](../architecture/domains/crafting-economy.md) - absorbed 2026-07-16 |
| Environment System | [docs/architecture/domains/environment-physics.md](../architecture/domains/environment-physics.md) - absorbed 2026-07-16 |
| Events System | [docs/architecture/domains/time-world-events.md](../architecture/domains/time-world-events.md) - absorbed 2026-07-16 |
| History System | planmap `history` = parked (2026-07-15, no link) · W09 Simulation time and environment · tracker row stale vs planmap: planmap has a dedicated parked topic, not just absorption into time-world-events |
| Intrigue System | [docs/architecture/domains/intrigue-crime.md](../architecture/domains/intrigue-crime.md) - absorbed 2026-07-16 |
| Logic System | planmap `logic` = parked (2026-07-15, no link) · W-step unconfirmed (core/game-logic rules have no clean single-wave home; W05 character mechanics or W09 simulation both partial-fit) · parked pending W-step ruling |
| Memory System | planmap `npc-memory-reconciliation` = done (4/4 features, 2026-07-09 handover) · absorbed into npcs-companions.md · tracker partial label stale: planmap says done |
| Naval System | planmap `naval` = parked (2026-07-15, no link) · W08 Extended travel and realms (with Planar/Underdark) · tracker partial label stale vs planmap parked |
| Physics System | planmap `physics` = parked (2026-07-15, no link) · W09 Simulation time and environment (with Time) · tracker partial label stale vs planmap parked |
| Planar System | planmap `planar` = parked (2026-07-15, no link) · W08 Extended travel and realms (with Naval/Underdark) · tracker partial label stale vs planmap parked |
| Puzzles System | [docs/architecture/domains/puzzles-quests-rituals.md](../architecture/domains/puzzles-quests-rituals.md) - absorbed 2026-07-16 |
| Quests System | [docs/architecture/domains/puzzles-quests-rituals.md](../architecture/domains/puzzles-quests-rituals.md) - absorbed 2026-07-16 |
| Religion System | planmap `religion` = parked (2026-07-15, no link) · W07 Factions crime and faith (with Rituals) · parked pending build decision |
| Rituals System | planmap `rituals` = done (4/4 features: schema, manager fixture, executor routing, battle-map progress) · absorbed into puzzles-quests-rituals.md · tracker partial label stale: planmap says done |
| Spells Parent | [docs/projects/spells/NORTH_STAR.md](spells/NORTH_STAR.md) |
| Time System | planmap `generational-time` = active (4/5 features done: G1 time contract, G3 seasons, G4 rest/day-boundary, G5 dialogue day-part; G2 day-boundary test done) · W09 Simulation time and environment · tracker partial label stale vs planmap active |
| Travel System | [docs/architecture/domains/overland-travel.md](../architecture/domains/overland-travel.md) - absorbed 2026-07-16 |
| Underdark System | planmap `underdark` = done (1/1: magical_darkness on UnderdarkBiome) · absorbed into naval-underdark.md · tracker partial label stale: planmap says done |
| Visibility System | planmap `visibility` = done (1/1: ambientLight on BattleMapData) · absorbed into battle-map.md · tracker partial label stale: planmap says done |
| World System | [docs/architecture/domains/world-map.md](../architecture/domains/world-map.md) - absorbed 2026-07-16 |
| World 3D System | [docs/architecture/domains/streamed-3d-world.md](../architecture/domains/streamed-3d-world.md) - absorbed 2026-07-16 |

## Feature/UI Projects (`src/components/*`)

| Project | Status | Confidence | Evidence | Gap signal | Living project protocol | Next step |
|---|---|---|---|---|---|---|
| Action Pane | [docs/architecture/domains/ui-modals.md](../architecture/domains/ui-modals.md) - absorbed 2026-07-16 |
| Battle Map | [docs/architecture/domains/battle-map.md](../architecture/domains/battle-map.md) - absorbed 2026-07-16 |
| Character Creator | [docs/architecture/domains/character-creator.md](../architecture/domains/character-creator.md) - absorbed 2026-07-16 |
| Character Sheet | [docs/architecture/domains/character-sheet.md](../architecture/domains/character-sheet.md) - absorbed 2026-07-16 |
| Compass Pane | [docs/architecture/domains/world-map.md](../architecture/domains/world-map.md) - absorbed 2026-07-16 |
| Conversation Panel | [docs/architecture/domains/npcs-companions.md](../architecture/domains/npcs-companions.md) - absorbed 2026-07-16 |
| Crafting UI | [docs/architecture/domains/crafting-economy.md](../architecture/domains/crafting-economy.md) - absorbed 2026-07-16 |
| Crime UI | [docs/architecture/domains/intrigue-crime.md](../architecture/domains/intrigue-crime.md) - absorbed 2026-07-16 |
| Demo Area | [docs/architecture/domains/design-preview-navigation.md](../architecture/domains/design-preview-navigation.md) - reference artifact |
| Design Preview | [docs/architecture/domains/design-preview-navigation.md](../architecture/domains/design-preview-navigation.md) - absorbed 2026-07-16 |
| Design Preview Scenarios | [docs/architecture/domains/design-preview-navigation.md](../architecture/domains/design-preview-navigation.md) - absorbed 2026-07-16 |
| Dialogue | [docs/architecture/domains/npcs-companions.md](../architecture/domains/npcs-companions.md) - absorbed 2026-07-16 |
| Dice | [docs/architecture/domains/core-systems.md](../architecture/domains/core-systems.md) - absorbed 2026-07-16; project folder at `docs/projects/dice` |
| Economy UI | [docs/architecture/domains/crafting-economy.md](../architecture/domains/crafting-economy.md) - absorbed 2026-07-16 |
| Encounter Generator | [docs/architecture/domains/creature-taxonomy.md](../architecture/domains/creature-taxonomy.md) - absorbed 2026-07-16 |
| Glossary UI | [docs/architecture/domains/glossary.md](../architecture/domains/glossary.md) - absorbed 2026-07-16 |
| Logbook | [docs/architecture/domains/puzzles-quests-rituals.md](../architecture/domains/puzzles-quests-rituals.md) - absorbed 2026-07-16 |
| Naval UI | [docs/architecture/domains/naval-underdark.md](../architecture/domains/naval-underdark.md) - absorbed 2026-07-16 |
| Organization | [docs/architecture/domains/core-systems.md](../architecture/domains/core-systems.md) - absorbed 2026-07-16 |
| Party UI | [docs/architecture/domains/npcs-companions.md](../architecture/domains/npcs-companions.md) - absorbed 2026-07-16 |
| Quest Log | [docs/architecture/domains/puzzles-quests-rituals.md](../architecture/domains/puzzles-quests-rituals.md) - absorbed 2026-07-16 |
| SaveLoad | [docs/architecture/domains/data-pipelines.md](../architecture/domains/data-pipelines.md) - absorbed 2026-07-16 |
| Submap and Tile-Grid Retirement | [docs/architecture/domains/submap.md](../architecture/domains/submap.md) - absorbed 2026-07-16; project folder at `docs/projects/submap` |
| Trade UI | [docs/architecture/domains/items-trade-inventory.md](../architecture/domains/items-trade-inventory.md) - absorbed 2026-07-16 |
| Town | [docs/architecture/domains/town-map.md](../architecture/domains/town-map.md) - absorbed 2026-07-16 |
| ThreeD Modal | [docs/architecture/domains/streamed-3d-world.md](../architecture/domains/streamed-3d-world.md) - absorbed into World 3D UI 2026-06-10 (D5) |
| World 3D UI | [docs/architecture/domains/streamed-3d-world.md](../architecture/domains/streamed-3d-world.md) - absorbed 2026-07-16 |
| types UI | partial | medium | `src/components/types` | GAPS.md present | implemented | document type registry and exports |
| Layout | [docs/architecture/domains/ui-modals.md](../architecture/domains/ui-modals.md) - absorbed 2026-07-16 |
| Providers | [docs/architecture/domains/ui-modals.md](../architecture/domains/ui-modals.md) - absorbed 2026-07-16 |
| UI primitives | active | high | [docs/architecture/domains/ui-modals.md](../architecture/domains/ui-modals.md) | GAPS.md present; G5 validation feedback, G9 focus-trap manager coverage, G10/G11 modal ARIA labels, and G12 coin-display semantics done | implemented | no open audited UI primitive gap remains after G12; run a fresh source-backed gap scan before assigning another forward pass |

## Feature Domains and Runtime Support (`src/features`, `src/commands`, `src/workers`, `src/services`)

| Project | Status | Confidence | Evidence | Gap signal | Living project protocol | Next step |
|---|---|---|---|---|---|---|
| Submap Generation | [docs/architecture/domains/submap.md](../architecture/domains/submap.md) - absorbed 2026-07-16 |
| Command Base Runtime | [docs/architecture/domains/commands.md](../architecture/domains/commands.md) - absorbed 2026-07-16 |
| Command Effects Runtime | [docs/architecture/domains/commands.md](../architecture/domains/commands.md) - absorbed 2026-07-16 |
| Command Factory Runtime | [docs/architecture/domains/commands.md](../architecture/domains/commands.md) - absorbed 2026-07-16 |
| Gemini Service | [docs/architecture/domains/data-pipelines.md](../architecture/domains/data-pipelines.md) - absorbed 2026-07-16 |
| Ollama Service | [docs/architecture/domains/data-pipelines.md](../architecture/domains/data-pipelines.md) - absorbed 2026-07-16 |
| RealmSmith Service | [docs/architecture/domains/data-pipelines.md](../architecture/domains/data-pipelines.md) - absorbed 2026-07-16 |
| WorldSim Service | [docs/architecture/domains/data-pipelines.md](../architecture/domains/data-pipelines.md) - absorbed 2026-07-16 |

## Tools, Automation, and Infrastructure

| Project | Status | Confidence | Evidence | Gap signal | Living project protocol | Next step |
|---|---|---|---|---|---|---|
| Scripts: archive | [docs/architecture/domains/test-quality.md](../architecture/domains/test-quality.md) - absorbed 2026-07-16 |
| Scripts: audits | [docs/architecture/domains/test-quality.md](../architecture/domains/test-quality.md) - absorbed 2026-07-16 |
| Scripts: git | [docs/architecture/domains/developer-environment.md](../architecture/domains/developer-environment.md) - absorbed 2026-07-16 |
| Scripts: quality | [docs/architecture/domains/test-quality.md](../architecture/domains/test-quality.md) - absorbed 2026-07-16 |
| Scripts: spell-runtime-template-audit | [docs/architecture/domains/test-quality.md](../architecture/domains/test-quality.md) - absorbed 2026-07-16 |
| Scripts: tooling | [docs/architecture/domains/developer-environment.md](../architecture/domains/developer-environment.md) - absorbed 2026-07-16 |
| Scripts: workflows | [docs/architecture/domains/developer-environment.md](../architecture/domains/developer-environment.md) - absorbed 2026-07-16 |
| Idea Board | active | high | `docs/projects/idea-board/NORTH_STAR.md`; `public/idea-board/` | IB-0001 through IB-0006 are verified; CozyClay is a distinct previsualization record blocked on its acknowledged Mixamo redistribution issue and Aralia legal/shot-boundary evidence; 2 open gaps cover live-link receipts and archive retention | implemented | intake the next supplied source; append reassessments only with new evidence; run recorded experiments only on explicit request and after named blockers clear |
| Script tests | [docs/architecture/domains/test-quality.md](../architecture/domains/test-quality.md) - absorbed 2026-07-16 |
| Code Modularization Audit | [docs/architecture/domains/technical-debt-scanner.md](../architecture/domains/technical-debt-scanner.md) - absorbed 2026-07-16 |

## Merged Duplicate Tracker Block (2026-06-08)

This location previously repeated the gameplay, UI, runtime, and infrastructure
tables already listed above. The duplicate rows were merged back into their
canonical sections to prevent the dashboard tracker from offering the same
projects as separate assignment targets. No project folders, code systems, or
future intent were removed.

## Projectized Planning Areas (`docs/projects`, `docs/tasks`)

| Project | Status | Confidence | Evidence | Gap signal | Living project protocol | Next step |
|---|---|---|---|---|---|---|
| Worldforge (flagship) | active | high | [docs/architecture/domains/region-terrain.md](../architecture/domains/region-terrain.md) - absorbed-worldforge spec retired into git history (removed in 4448b9d97) | generation-pipeline gaps route via planmap worldforge topics | lives in domain docs, no project folder | route new gen-pipeline work through the domain docs + planmap |

### Project folders without a `NORTH_STAR.md` (tracker completeness note)

The `Project -> North Star map` above points the project-target rows at existing
reference folders under `docs/projects/` and `docs/tasks/`. Those folders exist on
disk, but only the ones listed in the map already carry their own
`NORTH_STAR.md`. The remaining folders are real project/issue surfaces that have no
north star yet; they are kept here as an incomplete-intent inventory rather than
treated as dead paths.

Folders under `docs/projects/` with no `NORTH_STAR.md`:

- `docs/projects/combat`
- `docs/projects/effects`
- `docs/projects/items`
- `docs/projects/script-tests`
- `docs/projects/scripts-audits`
- `docs/projects/scripts-quality`
- `docs/projects/scripts-spell-runtime-template-audit`

Folders/tasks under `docs/tasks/` and `docs/archive/tasks/` with no `NORTH_STAR.md`:

- `docs/tasks/spell-execution-audit`
- `docs/tasks/spells/subprojects/spell-execution-audit`
- `docs/archive/tasks/documentation-cleanup`
- `docs/archive/tasks/spells`

Reference-only or lone-evidence folders that exist but are not project north-star
targets:

- `docs/projects/demo-area/REFERENCES.md` (reference-only by decision; see the
  tracker's Demo Area row)

D1 verdict, rechecked 2026-10-25: the tracker's `absorbed 2026-07-16` project rows
are not link rot. Every one of those ~100 rows points at a real, present domain doc
under `docs/architecture/domains/`, and the domain docs resolve. The only
"missing-folder" signal in this file is the stale-vs-planmap drift already recorded
in `docs/architecture/domains/` (GG-37 routing) plus the `docs/projects/world3d/`
and `docs/projects/design-preview/` folders that were deleted from git on
2026-07-16 and never restored; those two are the only genuinely absent project
folders named by the tracker, and they are covered by GG-37. No other tracker row
points at a missing folder.
| Item Categorization | [docs/architecture/domains/items-trade-inventory.md](../architecture/domains/items-trade-inventory.md) - absorbed 2026-07-16 |
| PHB 2024 Glossary Audit | [docs/architecture/domains/glossary-data.md](../architecture/domains/glossary-data.md) - archived reference-only per D24 |
| Tiered Autosave | [docs/architecture/domains/data-pipelines.md](../architecture/domains/data-pipelines.md) - absorbed 2026-07-16 |
| Town Description System | [docs/architecture/domains/town-map.md](../architecture/domains/town-map.md) - absorbed 2026-07-16 |
| 3D Combat Map | [docs/architecture/domains/battle-map.md](../architecture/domains/battle-map.md) - absorbed into plan-map topic `combat-map-reskin` on 2026-07-15; the dated absorbed-3d-combat-map spec was retired into git history by the 2026-09 dated-docs consolidation (removed in 4448b9d97); the old `conductor/` path is gone, see [CONDUCTOR_RETIRED.md](CONDUCTOR_RETIRED.md) |
| Action System Refactor | [docs/tasks/action-system-refactor/NORTH_STAR.md](../tasks/action-system-refactor/NORTH_STAR.md) |
| Architecture Sweep | [docs/archive/tasks/architecture/NORTH_STAR.md](../archive/tasks/architecture/NORTH_STAR.md) - archived task |
| Combat Messaging Enhancement | [docs/tasks/combat-messaging-enhancement/NORTH_STAR.md](../tasks/combat-messaging-enhancement/NORTH_STAR.md) |
| Combat Scenario Tester | [docs/tasks/combat-scenario-tester/NORTH_STAR.md](../tasks/combat-scenario-tester/NORTH_STAR.md) |
| Documentation Cleanup | [docs/tasks/documentation-cleanup/NORTH_STAR.md](../tasks/documentation-cleanup/NORTH_STAR.md) |
| Feature Capabilities | [docs/tasks/feature-capabilities/NORTH_STAR.md](../tasks/feature-capabilities/NORTH_STAR.md) |
| Glossary | [docs/tasks/glossary/NORTH_STAR.md](../tasks/glossary/NORTH_STAR.md) |
| Spells / Spell Completeness Audit subproject | [docs/projects/spells/subprojects/spell-completeness-audit/SPELL_COMPLETENESS_COVERAGE_SNAPSHOT.md](spells/subprojects/spell-completeness-audit/SPELL_COMPLETENESS_COVERAGE_SNAPSHOT.md) (parent: [spells/NORTH_STAR.md](spells/NORTH_STAR.md)) |
| Spells / Structured Spell Execution subproject | [docs/tasks/spells/NORTH_STAR.md](../tasks/spells/NORTH_STAR.md) (parent: [spells/NORTH_STAR.md](spells/NORTH_STAR.md)) |
| Testing Overhaul | [docs/tasks/testing-overhaul/NORTH_STAR.md](../tasks/testing-overhaul/NORTH_STAR.md) |
| UI Features | [docs/tasks/ui-features/NORTH_STAR.md](../tasks/ui-features/NORTH_STAR.md) |
| Weapon Proficiency System | [docs/tasks/weapon-proficiency-system/NORTH_STAR.md](../tasks/weapon-proficiency-system/NORTH_STAR.md) |
| Investigation Task Cluster | [docs/tasks/investigations/NORTH_STAR.md](../tasks/investigations/NORTH_STAR.md) |
| Item Icons | [docs/archive/tasks/item-icons/NORTH_STAR.md](../archive/tasks/item-icons/NORTH_STAR.md) - archived task |
| Roadmap Maintenance | [docs/tasks/roadmap/NORTH_STAR.md](../tasks/roadmap/NORTH_STAR.md) |

| Whole-Game Systems Audit and Gap Resolution | [docs/architecture/domains/test-quality.md](../architecture/domains/test-quality.md) - absorbed 2026-07-16; planmap topic `whole-game-systems-audit` |

## Design-Intent References

| Project | Status | Confidence | Evidence | Gap signal | Living project protocol | Next step |
|---|---|---|---|---|---|---|
| Racial Mechanics / Race Hierarchy | [docs/architecture/domains/character-creator.md](../architecture/domains/character-creator.md) - absorbed 2026-07-16; parked planmap topic `racial-mechanics` |
| Spells / Spell Phase Workstream merged reference | [docs/tasks/spells/NORTH_STAR.md](../tasks/spells/NORTH_STAR.md) |


### Project folders without a NORTH_STAR.md (tracker completeness note)

The Project -> North Star map above points the project-target rows at existing
reference folders under docs/projects/ and docs/tasks/. Those folders exist on
disk, but only the ones listed in the map already carry their own NORTH_STAR.md.
The remaining folders are real project/issue surfaces that have no north star yet;
they are kept here as an incomplete-intent inventory rather than treated as dead paths.

Folders under docs/projects/ with no NORTH_STAR.md:

- docs/projects/combat
- docs/projects/effects
- docs/projects/items
- docs/projects/script-tests
- docs/projects/scripts-audits
- docs/projects/scripts-quality
- docs/projects/scripts-spell-runtime-template-audit

Folders/tasks under docs/tasks/ and docs/archive/tasks/ with no NORTH_STAR.md:

- docs/tasks/spell-execution-audit
- docs/tasks/spells/subprojects/spell-execution-audit
- docs/archive/tasks/documentation-cleanup
- docs/archive/tasks/spells

Reference-only or lone-evidence folders that exist but are not project north-star
targets:

- docs/projects/demo-area/REFERENCES.md (reference-only by decision; see the
  tracker Demo Area row)

D1 verdict, rechecked 2026-10-25: the tracker absorbed 2026-07-16 project rows are
not link rot. Every one of those roughly 100 rows points at a real present domain
doc under docs/architecture/domains/, and the domain docs resolve. The only missing-
folder signal in this file is the stale-vs-planmap drift already recorded in
docs/architecture/domains/ (GG-37 routing) plus the docs/projects/world3d/ and
docs/projects/design-preview/ folders that were deleted from git on 2026-07-16 and
never restored; those two are the only genuinely absent project folders named by the
tracker, and they are covered by GG-37. No other tracker row points at a missing folder.
## How to use this tracker

- Treat each row as a project candidate.
- Move items into one of your project systems as separate tracks (gameplay, infra, docs, etc.).
- Use the gap column to drive the next planning cycle; projects with explicit `GAPS.md` should be prioritized.
- Add columns as needed (owner, due date, blockers, dependencies) without deleting these entries unless a project is truly merged away.
- D1 is a specific exploration of the "absorbed 2026-07-16 rows" and "missing North Stars" signals in this file. Its findings live in the
  `### Project folders without a \`NORTH_STAR.md\`` note above; the underlying repo issue it closed (gapIndex missing ~220 open rows because the
  tracker and GLOBAL_GAPS.md both had split/blocked reads) is tracked separately and was fixed before this note was written.
