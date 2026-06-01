# Glossary Gaps

Status: active
Last updated: 2026-05-31

## Purpose

Track glossary-planning gaps discovered from the current docs-only pass and route
them without collapsing scope.

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|
| G1 | not_started | support_needed_now | Worker | docs/projects/PROJECT_TRACKER.md | docs/tasks/glossary scan | No explicit terminology-governance document exists for final inclusion/exclusion decisions. | `docs/projects/PROJECT_TRACKER.md` row for Glossary includes `connect terminology governance`; glossary docs have no single owner note yet. | Terms and exclusions can drift across updates without a stable policy anchor. | Add a short governance section in `NORTH_STAR.md` naming owners and decision rules. | Confirm one-row governance statement links all included scopes and skip rules. |
| G2 | not_started | adjacent_follow_up | Worker | docs/projects/phb2024_glossary_audit | docs/projects/PHB glossary audit scan | PHB 2024 audit scope completion is split from this task and there is no shared handoff checklist for term set overlap. | `docs/projects/phb2024_glossary_audit/NORTH_STAR.md`; `GLOSSARY_RELEVANT_RULES_TARGET_SET.md` | Overlap between "remaining PHB families" and current glossary term priority can produce duplicate or inconsistent target sets. | Add a short cross-check note before next term-audit slice. | Run one comparison: PHB-audit project scope list versus this task's relevant rules target set. |

## Classification Reference

- `in_scope_now`: required to complete a reliable handoff for this task.
- `support_needed_now`: needed now to continue with stable planning posture.
- `adjacent_follow_up`: useful and related, but not required to complete this docs layer.
- `out_of_scope`: should be tracked elsewhere.
- `blocked_human_decision`: requires explicit owner choice.
- `blocked_external_state`: blocked by another team/build/service dependency.
