# Project Deprecation Review

Status: active
Last updated: 2026-06-08

This file records evidence-backed candidates for merge, archive, downgrade, or
repair. It does not authorize deletion. Aralia is expansion-first, so the safe
default is to preserve intent until a canonical owner, routed gaps, and archive
target are clear.

## 2026-06-08 Dashboard Application Notes

- `docs/projects/PROJECT_TRACKER.md` now has assignment guardrails for the
  review-only candidates in this file.
- Duplicate gameplay/world tracker rows were merged back into their canonical
  tracker sections; no systems or project folders were removed.
- The stale `conductor/projects/3d-combat-map` row now points at
  `docs/projects/3d-combat-map`.
- `demo-area`, `phb2024_glossary_audit`, `script-tests`,
  `scripts-spell-runtime-template-audit`, `three-d-modal`, and `crime` now carry
  dashboard-facing lifecycle/review fields in their North Stars.
- Review-gated projects should not receive forward-moving sub-agent assignments
  until their human-decision or repair flag is cleared.
- `character-creator`, `scripts-audits`, and `world` were added to the
  assignment guardrails after fresh evidence showed human-policy or phase-out
  contract decisions are needed before forward-moving work.
- The `submap` project remains assignable for quick-travel/inspect contract
  extraction, but its DOM renderer/painter replacement slice is review-gated
  until the active renderer authority is decided.

## Review Rules

1. Deprecate duplicate project surfaces, stale tracker rows, corrupted docs, or
   reference-only shells before deprecating product intent.
2. Never delete a project because it is incomplete, low-confidence, or small.
3. Before archive or merge, route open gaps and next actions into the canonical
   owner.
4. If human intent is unclear, mark `needs-human-decision`.

## Strong Candidates

| Candidate | Proposed status | Confidence | Reason | Canonical owner / archive target | Evidence |
|---|---|---|---|---|---|
| Duplicate gameplay/world rows in `Projectized Planning Areas` | merge-tracker-row | strong | Duplicate tracker rows repeat system projects already owned under `Gameplay & World Systems`. | Keep canonical project folders; merge duplicate registry rows only. | `docs/projects/PROJECT_TRACKER.md` |
| Spell Phase Workstream separate project card | archive-after-routing | strong | Looks like a milestone/phase inside Structured Spell Execution rather than a durable standalone project. | `docs/tasks/spell-system-overhaul/NORTH_STAR.md` or structured spell execution project. | `docs/projects/PROJECT_TRACKER.md`, `docs/tasks/spell-system-overhaul/NORTH_STAR.md` |
| Crime `NORTH_STAR.md` surface | keep-but-repair-docs | strong | Project should remain, but North Star appears abnormally large/corrupted and contains unrelated corpus/glossary material. | Rebuild `docs/projects/crime/NORTH_STAR.md` from tracker/gaps/source evidence before dispatch. | `docs/projects/crime/NORTH_STAR.md`, `docs/projects/crime/TRACKER.md` |
| 3D Combat Map old conductor pointer | keep-but-repair-docs | medium | Tracker still points at old conductor path while `docs/projects/3d-combat-map` now owns living docs. | Keep `docs/projects/3d-combat-map`; demote old conductor pointer if still present. | `docs/projects/PROJECT_TRACKER.md`, `docs/projects/3d-combat-map/NORTH_STAR.md` |

## Duplicate Ownership Investigation

| Duplicate / overlap area | Classification | Current recommendation |
|---|---|---|
| Gameplay/world systems repeated under `Projectized Planning Areas` | duplicate_tracker_row | Merge duplicate registry rows; keep the canonical project folders. |
| UI/runtime pairs such as Crafting UI + Crafting System, Quest Log + Quests, Trade UI + Economy | ui_runtime_pair | Keep separate unless the North Stars collapse onto the same owner, evidence, and next action. |
| Spell Phase Workstream + Structured Spell Execution | task_project_overlap | Route phase work into the structured spell owner unless a standalone phase dashboard is explicitly needed. |
| 3D Combat Map conductor docs + `docs/projects/3d-combat-map` | stale_pointer | Keep docs/projects as canonical and review old conductor pointer. |
| Script tests + Scripts quality/audits | task_project_overlap | Human decision: keep if tests need a standalone ownership surface; otherwise merge into scripts quality/audits. |
| ThreeD Modal + World 3D UI | possible_ui_runtime_pair | Human decision: keep if modal entrypoint has separate UX ownership; merge if it only duplicates World 3D UI transition work. |

## Weak Candidates / Human Decision Needed

| Candidate | Proposed status | Confidence | Why review is needed | Evidence |
|---|---|---|---|---|
| Demo Area | downgrade-reference-only or keep-active | weak | Tracker already asks whether this should be retained or removed. | `docs/projects/demo-area/NORTH_STAR.md`, `docs/projects/PROJECT_TRACKER.md` |
| Sideproject: Basic Chat | downgrade-reference-only | weak | May be reference-only unless still used as an active sideproject. | `docs/projects/sideproject-basic-chat/NORTH_STAR.md` |
| Scripts: spell-runtime-template-audit | archive-after-routing or keep-active | weak | Overlaps spell-system-overhaul and scripts/audit ownership. | `docs/projects/scripts-spell-runtime-template-audit/NORTH_STAR.md` |
| Script tests | merge-tracker-row | weak | Could be support surface for script quality rather than standalone project. | `docs/projects/script-tests/NORTH_STAR.md` |
| PHB 2024 Glossary Audit | archive-after-routing | weak | Audit/task-like surface; archive only after results are routed to glossary/source-data owner. | `docs/projects/phb2024_glossary_audit/NORTH_STAR.md` |
| ThreeD Modal | needs-human-decision | weak | Possible overlap with World 3D UI, but may preserve a useful UI entrypoint boundary. | `docs/projects/three-d-modal/NORTH_STAR.md`, `docs/projects/world-3d-ui/NORTH_STAR.md` |

## Explicit Keep List

| Project | Keep reason |
|---|---|
| Documentation Cleanup | Durable Aralia-facing home for documentation cleanup work that would otherwise be lost in ignored/local task files. |
| Roadmap Maintenance | Durable docs/projects owner for roadmap-local/tooling evidence. |
| Submap Generation | Intentional generation-vs-UI split from Submap. Needs scaffold upgrade, not deprecation. |
| Trade UI / Economy, Quest Log / Quests, Crafting UI / Crafting | UI/runtime split is intentional unless source evidence proves duplicate ownership. |
| World 3D and World 3D UI | Engine/rendering and UI/HUD ownership are usefully separate. |

## Dashboard Fields To Support

| Field | Values / purpose |
|---|---|
| `lifecycle_status` | `active`, `planned`, `reference-only`, `merge-candidate`, `archive-candidate`, `archived`, `superseded`, `corrupted-doc-surface` |
| `deprecation_confidence` | `none`, `weak`, `medium`, `strong` |
| `deprecation_reason` | `duplicate_owner`, `stale_pointer`, `task_not_project`, `reference_only`, `corrupted_surface`, `superseded_by`, `non_project_artifact` |
| `canonical_owner` | Project/card that should own routed work. |
| `human_decision_required` | `yes` or `no`; use `yes` when merge/archive could lose intent. |
