# Architecture Sweep Gaps

Status: active
Last updated: 2026-05-31

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| AR-1 | open | in_scope_now | Worker D | Architecture Sweep | Sweep docs pass | `docs/ARCHITECTURE.md` points to `CODE_WALKTHROUGH.md` and `@PROJECT-OVERVIEW.README.md`, but those targets are missing in `docs/`. | `docs/ARCHITECTURE.md`, "Related Documentation" section. | Broken links reduce cold-start reliability. | Update this pass by replacing missing targets with existing files or removing dead links. | Verify file existence for each target in `docs/` and run a link walk. |
| AR-2 | open | adjacent_follow_up | Worker D | Architecture Sweep | Sweep docs pass | `docs/VISION.md` links `PROJECT_ARCHITECTURE.md`, but this path is not present. | `docs/VISION.md`, related documentation list. | Link drift weakens architecture discoverability for future readers. | Decide whether to point this to `docs/ARCHITECTURE.md` or keep a dedicated equivalent and create it. | Confirm updated target exists before continuing the architecture sweep. |
| AR-3 | open | adjacent_follow_up | Worker D | Architecture Sweep | Sweep docs pass | Some architecture-domain text includes encoding artifacts (for example smart quotes converted to replacement sequences). | `docs/architecture/domains/combat.md`, known artifact text blocks. | Encoding drift affects readability and can violate local doc quality expectations. | Keep this as a follow-up cleanup gate rather than blocking this docs-only sweep. | Run a targeted ASCII/text-hygiene audit with documentation scope later. |

## Classification Guide

- `in_scope_now`: must be handled before the current active task can close.
- `adjacent_follow_up`: useful and related, but outside the current docs-only pass.
- `out_of_scope`: clearly unrelated to the active project and should be routed elsewhere.
- `blocked_human_decision`: requires explicit owner input before continuation.
- `blocked_external_state`: waiting on another system, PR, or person.
