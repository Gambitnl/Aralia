# UI primitives Gaps

Status: active
Last updated: 2026-05-31

Use this file for durable unresolved findings that genuinely belong to this project.

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G1 | not_started | adjacent_follow_up | Worker B | docs/projects/ui-primitives/TRACKER.md | registry-to-scaffold upgrade | Align component ownership + design tokens | docs/projects/PROJECT_TRACKER.md | The registry explicitly marks this as unresolved scope for UI primitives and it should survive handoff | Add to project tracker when implementation begins | Project-level proof or state transition |
| G2 | done | support_needed_now | Gemini | docs/projects/ui-primitives/TRACKER.md | direct source review | No shared form input primitive in src/components/ui | src/components/ui/{GameGuideModal.tsx,MissingChoiceModal.tsx}, src/components/BanterInterruptUI.tsx, src/components/CollapsibleBanterPanel.tsx, src/components/OllamaDependencyModal.tsx | Modal and form-heavy screens still define duplicate `<input>/<select>` handling | Implemented in `src/components/ui/Input.tsx` and integrated in modals | Review modal controls for safe migration opportunities |
| G3 | done | support_needed_now | Gemini | docs/projects/ui-primitives/TRACKER.md | direct source review | Mixed modal layer conventions (`Z_INDEX` and raw CSS vars) | src/styles/zIndex.ts, src/components/ui/*.tsx, src/App.tsx, var(--z-index-modal-background) references | Risk of inconsistent overlay behavior and harder audits across teams/features | Migrated key elements to type-safe Z_INDEX constants | Run overlay ordering checks on representative modals |
| G4 | done | adjacent_follow_up | Gemini | docs/projects/ui-primitives/TRACKER.md | ownership scan | No explicit in-file UI ownership contract | src/components/ui/*.tsx | Hard to answer ownership questions during reviews and handoff without extra graph scans | Established `@component-owner` header contract across modified files | Verify alignment with feature/project owner and tracker |
| G5 | not_started | adjacent_follow_up | Worker B | docs/projects/ui-primitives/TRACKER.md | G2 implementation | Lack of standard form validation cues across custom inputs | src/components/ui/Input.tsx | Inputs have standard error props but lack dynamic schema-based validation integrations | Define shared form validation and feedback specs | Review validation error states in sandboxes |
| G6 | done | support_needed_now | Worker B | docs/projects/ui-primitives/TRACKER.md | modal review | Incomplete keyboard focus trap coverage in dynamic modals | src/components/ui/MissingChoiceModal.tsx, RestModal.tsx | Lack of active focus trap hooks in some modals presents accessibility and keyboard navigation risks | Apply `useFocusTrap` hook to remaining in-scope modal surfaces | Verify keyboard tab focus wraps inside active modals |
| G7 | not_started | adjacent_follow_up | Gemini | docs/projects/ui-primitives/TRACKER.md | modal audit | Focus trap restoration hooks can capture stale or incorrect elements during external closed events | src/hooks/useFocusTrap.ts | If a modal is closed via state mutations/external triggers rather than the standard overlay click, the active element is not restored properly. | Refactor previousFocusRef behavior to support manual target override or callback-based restoration. | Test restoration on programmatically closed modals. |
| G8 | not_started | adjacent_follow_up | Gemini | docs/projects/ui-primitives/TRACKER.md | modal audit | Missing standard close/Escape bindings at top-level modal wrapper | src/components/layout/GameModals.tsx | If a child modal fails to implement correct Escape or close handlers, the user cannot close the overlay at all. | Add standard fallback click-outside and Escape handlers to the modal container. | Verify closing behavior when children don't bind close keys. |

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
