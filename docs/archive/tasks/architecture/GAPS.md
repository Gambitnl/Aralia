> **ARCHIVED 2026-07-01** — docs-only sweep complete, all gaps closed. Archived by doc-triage batch 1. Original location: `docs/tasks/architecture/GAPS.md`.

# Architecture Sweep Gaps

Status: archived
Last updated: 2026-07-01

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| AR-1 | done | in_scope_now | Codex | Architecture Sweep | Sweep docs pass | `docs/ARCHITECTURE.md` pointed to `CODE_WALKTHROUGH.md` and `@PROJECT-OVERVIEW.README.md`, but those targets are missing in `docs/`. | `docs/ARCHITECTURE.md`, "Related Documentation" section. | Broken links reduce cold-start reliability. | Replaced the missing links with existing `PROJECT_ARCHITECTURE.md`, `DEVELOPMENT_GUIDE.md`, and `@README-INDEX.md` references. | `Test-Path` confirmed the old missing targets were absent and the replacement targets exist; `git diff --check` covers the edited docs. |
| AR-2 | done | adjacent_follow_up | Codex | Architecture Sweep | Sweep docs pass | `docs/VISION.md` was believed to link a missing `PROJECT_ARCHITECTURE.md` target. | `docs/VISION.md`, related documentation list; `docs/PROJECT_ARCHITECTURE.md` | Link drift weakens architecture discoverability for future readers. | Rechecked the target and closed the stale finding because `docs/PROJECT_ARCHITECTURE.md` exists. | `Test-Path docs/PROJECT_ARCHITECTURE.md` returned true. |
| AR-3 | done | adjacent_follow_up | Worker D | Architecture Sweep | Sweep docs pass | Some architecture-domain text includes encoding artifacts (for example smart quotes converted to replacement sequences). | `docs/architecture/domains/combat.md`, known artifact text blocks. | Encoding drift affects readability and can violate local doc quality expectations. | Closed 2026-07-01: cleanup landed via the 2026-06-27 snapshot; no further action. | Full-file non-ASCII scan of `docs/architecture/domains/combat.md` on 2026-07-01 found 0 non-ASCII bytes. Folder-wide, the only residue is a single em-dash (U+2014) in `docs/architecture/domains/battle-map.md`, noted as trivial. |

## Classification Guide

- `in_scope_now`: must be handled before the current active task can close.
- `adjacent_follow_up`: useful and related, but outside the current docs-only pass.
- `out_of_scope`: clearly unrelated to the active project and should be routed elsewhere.
- `blocked_human_decision`: requires explicit owner input before continuation.
- `blocked_external_state`: waiting on another system, PR, or person.

<!-- aralia-backlog-walked: {"source":"docs/tasks/backlog-retirement/RETIREMENT_LEDGER.md","path":"docs/archive/tasks/architecture/GAPS.md","sha256WithoutMarker":"b9ae0736273ed0ee91c85d52c3065d40088e89bcc7d8c0de7971a54f585ffb6d","markedAtUtc":"2026-08-09T20:22:07.641Z"} -->
