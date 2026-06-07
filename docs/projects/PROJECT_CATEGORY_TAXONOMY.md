# Project Category Taxonomy

Status: active
Last updated: 2026-06-06

This file defines the dashboard category taxonomy for Aralia living projects.
It does not replace project ownership. It is a navigation layer that helps the
global project tracker group many project cards into readable buckets.

## Taxonomy Levels

Use three levels:

1. `main_category`: broad area for dashboard navigation.
2. `subcategory`: smaller work area inside the main category.
3. `category`: exact project-facing category label.

The dashboard may infer the first two levels from project name, slug, category,
and evidence while projects are being migrated. Project docs should eventually
store these fields explicitly in `NORTH_STAR.md` frontmatter.

## Main Categories And Subcategories

| Main category | Subcategory | Use for |
|---|---|---|
| Game & Simulation | Combat & Encounters | Combat, battle maps, action flow, dice, encounter generation. |
| Game & Simulation | World, Travel & Maps | World, town, travel, submap, navigation, visibility, environment, 3D world. |
| Game & Simulation | Core Sim Systems | Economy, crime, crafting, creatures, companions, events, history, memory, religion, rituals, puzzles. |
| Interface & Experience | Player UI Surfaces | Character, party, quest, trade, crafting, naval, crime, economy, dialogue, conversation UI. |
| Interface & Experience | UI Shell & Components | Layout, providers, design preview, UI primitives, modals, panes, visual shell. |
| Content & Rules | Rules, Spells & Source Data | Spells, racial mechanics, weapon proficiency, glossary, PHB/source-data audits. |
| Content & Rules | Items & Content Pipelines | Item categorization, item icons, town description content, content generation support. |
| Runtime & Services | Commands & Runtime Support | Command runtime, command effects, command factories, runtime feature services. |
| Runtime & Services | AI / External Services | Gemini, Ollama, RealmSmith, WorldSim, and service adapters. |
| Tools, Docs & Agents | Scripts & Automation | Scripts, audits, quality, git automation, workflow scripts, script tests. |
| Tools, Docs & Agents | Docs, Roadmap & Workflow | Documentation cleanup, roadmap maintenance, architecture sweep, living-project workflow, investigations. |
| Review / Archive | Deprecation Review | Merge candidates, archive candidates, reference-only projects, corrupted doc surfaces. |

## Duplicate-Ownership Review Rules

Potential duplicates should be classified before any merge/archive decision:

1. `duplicate_tracker_row`: same project appears twice in the registry but one
   project folder owns the work.
2. `ui_runtime_pair`: UI and system projects intentionally split ownership.
   Do not merge unless evidence proves duplicate ownership.
3. `task_project_overlap`: task docs and project docs cover the same work.
   Route to canonical owner before archive.
4. `stale_pointer`: registry points at an old path while `docs/projects/<slug>`
   owns the current surface.
5. `corrupted_doc_surface`: project remains valid but one or more docs need
   rebuild/repair before dispatch.

## Known Duplicate / Overlap Areas

| Area | Classification | Current guidance |
|---|---|---|
| Gameplay/world rows repeated under `Projectized Planning Areas` | duplicate_tracker_row | Merge duplicate registry rows only; keep canonical project folders. |
| Spell Phase Workstream and Structured Spell Execution | task_project_overlap | Treat Spell Phase as a milestone/phase unless human review says it needs a standalone card. |
| 3D Combat Map conductor path and docs/projects path | stale_pointer | Keep `docs/projects/3d-combat-map`; review/demote old conductor pointer. |
| UI/system pairs like Crafting UI + Crafting System | ui_runtime_pair | Keep both unless their North Stars converge on the same owner and tasks. |
| Crime project giant North Star | corrupted_doc_surface | Repair/rebuild docs; do not deprecate Crime System. |
