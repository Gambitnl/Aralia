# UI primitives Gaps

Status: active
Last updated: 2026-06-03

Use this file for durable unresolved findings that genuinely belong to this project.

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G1 | done | adjacent_follow_up | Worker B | docs/projects/ui-primitives/TRACKER.md | registry-to-scaffold upgrade | Align component ownership + design tokens | docs/projects/PROJECT_TRACKER.md | The registry explicitly marks this as unresolved scope for UI primitives and it should survive handoff | Completed — @component-owner headers applied | Project-level proof or state transition |
| G2 | done | support_needed_now | Gemini | docs/projects/ui-primitives/TRACKER.md | direct source review | No shared form input primitive in src/components/ui | src/components/ui/{GameGuideModal.tsx,MissingChoiceModal.tsx}, src/components/BanterInterruptUI.tsx, src/components/CollapsibleBanterPanel.tsx, src/components/OllamaDependencyModal.tsx | Modal and form-heavy screens still define duplicate `<input>/<select>` handling | Implemented in `src/components/ui/Input.tsx` and integrated in modals | Review modal controls for safe migration opportunities |
| G3 | done | support_needed_now | Gemini | docs/projects/ui-primitives/TRACKER.md | direct source review | Mixed modal layer conventions (`Z_INDEX` and raw CSS vars) | src/styles/zIndex.ts, src/components/ui/*.tsx, src/App.tsx, var(--z-index-modal-background) references | Risk of inconsistent overlay behavior and harder audits across teams/features | Migrated key elements to type-safe Z_INDEX constants | Run overlay ordering checks on representative modals |
| G4 | done | adjacent_follow_up | Gemini | docs/projects/ui-primitives/TRACKER.md | ownership scan | No explicit in-file UI ownership contract | src/components/ui/*.tsx | Hard to answer ownership questions during reviews and handoff without extra graph scans | Established `@component-owner` header contract across modified files | Verify alignment with feature/project owner and tracker |
| G5 | not_started | adjacent_follow_up | Worker B | docs/projects/ui-primitives/TRACKER.md | G2 implementation | Lack of standard form validation cues across custom inputs | src/components/ui/Input.tsx | Inputs have standard error props but lack dynamic schema-based validation integrations | Define shared form validation and feedback specs | Review validation error states in sandboxes |
| G6 | done | support_needed_now | Worker B | docs/projects/ui-primitives/TRACKER.md | modal review | Incomplete keyboard focus trap coverage in dynamic modals | src/components/ui/MissingChoiceModal.tsx, RestModal.tsx | Lack of active focus trap hooks in some modals presents accessibility and keyboard navigation risks | Apply `useFocusTrap` hook to remaining in-scope modal surfaces | Verify keyboard tab focus wraps inside active modals |
| G7 | done | support_needed_now | Qoder | docs/projects/ui-primitives/TRACKER.md | G6 follow-up audit | Focus trap restoration hooks can capture stale or incorrect elements during external close events | src/hooks/useFocusTrap.ts | If a modal is closed via state mutations/external triggers rather than the standard overlay click, the active element is not restored properly | Fixed: added unmount cleanup with `requestAnimationFrame` restoration and optional `restoreFocusTo` override param | Verify focus restores correctly on programmatic close and unmount across modals |
| G8 | done | support_needed_now | Qoder | docs/projects/ui-primitives/TRACKER.md | G7 follow-up audit | Missing standard close/Escape bindings at top-level modal wrapper | src/components/layout/GameModals.tsx | If a child modal fails to implement correct Escape or close handlers, the user cannot close the overlay at all | Added fallback Escape handler in GameModals that respects child `defaultPrevented` and closes topmost modal | Verify Escape closes each modal even when child doesn't bind its own handler |
| G9 | not_started | adjacent_follow_up | Qoder | docs/projects/ui-primitives/TRACKER.md | G8 implementation audit | ~16 modals rendered via GameModals lack `useFocusTrap` coverage | src/components/layout/GameModals.tsx, grep for `useFocusTrap` in src/ | Keyboard focus can escape outside modal overlay boundaries (MapPane, QuestLog, SubmapPane, CharacterSheetModal, DevMenu, EncounterModal, MerchantModal, Glossary, and ~8 others) | Audit which modals need focus trapping and integrate `useFocusTrap` or equivalent | Verify Tab key stays inside each modal overlay |
| G10 | not_started | adjacent_follow_up | Qoder | docs/projects/ui-primitives/TRACKER.md | G8 implementation audit | Inconsistent ARIA dialog labeling convention across modal surfaces | src/components/ui/*.tsx, src/components/*Modal.tsx | Some modals use `aria-labelledby`, others `aria-label`, others have neither — screen readers cannot consistently identify dialog purpose | Define a standard ARIA labeling convention for all modal surfaces | Audit all modal root elements for consistent `role`, `aria-modal`, and label attributes |

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
