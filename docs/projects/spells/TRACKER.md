# Spells Parent Routing Tracker

Status: active
Last updated: 2026-06-22

This tracker belongs to the Spells parent scoped-dashboard. It tracks routing, lane ownership, parent-visible imported gaps, and dashboard readiness. Executable spell work belongs in the child setup packet selected from `SUBPROJECTS.md`.

## Status Vocabulary

- `not_started`
- `active`
- `waiting`
- `blocked`
- `done`
- `superseded`
- `out_of_scope`

## Active Task Queue

| ID | Status | Task | Owner | Last updated | Evidence | Next action | Next check/proof |
|---|---|---|---|---|---|---|---|
| T4 | active | Maintain the Spells child-lane registry and keep the dashboard folded under the parent project. | Codex | 2026-06-22 | `SUBPROJECTS.md`; project detail dashboard | Keep top-level spell-related projects linked or folded under the parent view instead of drifting as unrelated rows. | `npm run projects:audit`; rendered Spells parent detail page. |
| T5 | active | Route the next high-impact spell work to the correct child packet before implementation starts. | Codex | 2026-06-22 | `GAPS.md`; `SUBPROJECTS.md` | Start from Mechanics Discovery Packages / created-object structures unless the user overrides priority. | Child packet tracker updated before runtime/data/UI edits. |
| T6 | active | Import only parent-visible gaps from child lanes and linked support projects. | Codex | 2026-06-22 | `GAPS.md`; `DECISIONS.md` | Keep child-local TODOs in child packets; import only cross-lane, ownership, priority, or product-behavior gaps. | Parent gap counts still match audit output. |

## Parent Maintenance Queue

| ID | Status | Task | Owner | Last updated | Evidence | Next action | Next check/proof |
|---|---|---|---|---|---|---|---|
| T7 | active | Keep the parent docs aligned with the parent-with-subprojects template. | Codex | 2026-06-22 | `PROJECT_CARD_SCHEMA.md`; `PARENT_PROJECT_WITH_SUBPROJECTS.md` | Preserve schema fields while keeping parent language scoped to routing. | Project audit reports Spells as valid. |

## Routed Child Work

| Former parent task | Current routing | Parent responsibility |
|---|---|---|
| T2: Track unresolved spell runtime/data gaps | Structured Spell Execution, Spell Data Taxonomy, Spell Automation And Validation | Keep imported parent gaps visible after a lane owns the execution work. |
| T3: Preserve integration map across runtime, UI, validation, and data | Spell Documentation And Handoffs plus the relevant implementation child lane | Keep the map discoverable; do not centralize every implementation detail in the parent. |

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| T-G1 | active | workflow | Codex | parent dashboard | 2026-06-22 parent reshape | The parent must remain schema-valid while using parent scoped-dashboard language. | `docs/projects/spells/NORTH_STAR.md`; `docs/projects/spells/COLD_START_AGENT_PROMPT.md`; `docs/projects/PROJECT_CARD_SCHEMA.md` | If the parent drops schema fields, the dashboard stops treating the project as valid even when the routing model is right. | Keep legacy audit-required fields present until the dashboard audit supports parent-specific reduced contracts. | `npm run projects:audit` shows Spells valid. |

## Update Rules

- Keep parent tasks about routing, dashboard health, child lane inventory, imported gap policy, and ownership decisions.
- Put runtime, data, validation, UI, and detailed audit execution in the relevant child tracker.
- Refresh `SUBPROJECTS.md` whenever lane names, counts, relationships, or proof boundaries change.
- Update parent `GAPS.md` only for cross-lane, parent-visible, linked-support, or product-behavior gaps.
