# Architecture Sweep Gaps

Status: active
Last updated: 2026-06-25

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| AR-1 | done | in_scope_now | Codex | Architecture Sweep | Sweep docs pass | `docs/ARCHITECTURE.md` pointed to `CODE_WALKTHROUGH.md` and `@PROJECT-OVERVIEW.README.md`, but those targets are missing in `docs/`. | `docs/ARCHITECTURE.md`, "Related Documentation" section. | Broken links reduce cold-start reliability. | Replaced the missing links with existing `PROJECT_ARCHITECTURE.md`, `DEVELOPMENT_GUIDE.md`, and `@README-INDEX.md` references. | `Test-Path` confirmed the old missing targets were absent and the replacement targets exist; `git diff --check` covers the edited docs. |
| AR-2 | done | adjacent_follow_up | Codex | Architecture Sweep | Sweep docs pass | `docs/VISION.md` was believed to link a missing `PROJECT_ARCHITECTURE.md` target. | `docs/VISION.md`, related documentation list; `docs/PROJECT_ARCHITECTURE.md` | Link drift weakens architecture discoverability for future readers. | Rechecked the target and closed the stale finding because `docs/PROJECT_ARCHITECTURE.md` exists. | `Test-Path docs/PROJECT_ARCHITECTURE.md` returned true. |
| AR-3 | open | adjacent_follow_up | Worker D | Architecture Sweep | Sweep docs pass | Some architecture-domain text includes encoding artifacts (for example smart quotes converted to replacement sequences). | `docs/architecture/domains/combat.md`, known artifact text blocks. | Encoding drift affects readability and can violate local doc quality expectations. | Keep this as a follow-up cleanup gate rather than blocking this docs-only sweep. | Run a targeted ASCII/text-hygiene audit with documentation scope later. |

## Classification Guide

- `in_scope_now`: must be handled before the current active task can close.
- `adjacent_follow_up`: useful and related, but outside the current docs-only pass.
- `out_of_scope`: clearly unrelated to the active project and should be routed elsewhere.
- `blocked_human_decision`: requires explicit owner input before continuation.
- `blocked_external_state`: waiting on another system, PR, or person.

<!-- aralia-backlog-walked: {"source":"docs/tasks/backlog-retirement/RETIREMENT_LEDGER.md","path":"docs/tasks/architecture/GAPS.md","sha256WithoutMarker":"deea3e41998b4a447f575c4b7e7a6e4b6cf945dc64cea1de0bc1710f6de0dd6a","markedAtUtc":"2026-06-25T22:29:38.633Z"} -->
