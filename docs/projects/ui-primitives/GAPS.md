# UI primitives Gaps

Status: active
Last updated: 2026-05-31

Use this file for durable unresolved findings that genuinely belong to this project.

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G1 | not_started | adjacent_follow_up | Worker B | docs/projects/ui-primitives/TRACKER.md | registry-to-scaffold upgrade | Align component ownership + design tokens | docs/projects/PROJECT_TRACKER.md | The registry explicitly marks this as unresolved scope for UI primitives and it should survive handoff | Add to project tracker when implementation begins | Project-level proof or state transition |
| G2 | not_started | support_needed_now | Worker B | docs/projects/ui-primitives/TRACKER.md | direct source review | No shared form input primitive in src/components/ui | src/components/ui/{GameGuideModal.tsx,MissingChoiceModal.tsx}, src/components/BanterInterruptUI.tsx, src/components/CollapsibleBanterPanel.tsx, src/components/OllamaDependencyModal.tsx | Modal and form-heavy screens still define duplicate `<input>/<select>` handling | Add an input primitive before next modal UI expansion | Review modal controls for safe migration opportunities |
| G3 | not_started | support_needed_now | Worker B | docs/projects/ui-primitives/TRACKER.md | direct source review | Mixed modal layer conventions (`Z_INDEX` and raw CSS vars) | src/styles/zIndex.ts, src/components/ui/*.tsx, src/App.tsx, var(--z-index-modal-background) references | Risk of inconsistent overlay behavior and harder audits across teams/features | Publish modal layering rule and migrate call sites incrementally | Run overlay ordering checks on representative modals |
| G4 | not_started | adjacent_follow_up | Worker B | docs/projects/ui-primitives/TRACKER.md | ownership scan | No explicit in-file UI ownership contract | src/components/ui/*.tsx | Hard to answer ownership questions during reviews and handoff without extra graph scans | Add explicit ownership convention in docs and implementation guidance | Verify alignment with feature/project owner and tracker |

## Classification Reference

| Classification | Use when |
|---|---|
| `in_scope_now` | The task cannot honestly complete without it. |
| `support_needed_now` | Not in slice but required for task to progress. |
| `adjacent_follow_up` | Useful and related, but not required for this slice. |
| `out_of_scope` | Explicitly not part of this project/task. |
| `blocked_human_decision` | A real owner/operator choice is required. |
| `blocked_external_state` | Waiting on another actor, PR, environment, or service. |

## Update Rules

- Keep gaps tied to evidence and a next proof/check.
- Route out-of-project items to `docs/projects/GLOBAL_GAPS.md` instead of retaining them here.
