# UI primitives Tracker

Status: active
Last updated: 2026-06-05

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
| T1 | done | Create initial project docs scaffold from registry evidence | Worker B | 2026-05-31 | `docs/projects/PROJECT_TRACKER.md` | Keep files in `docs/projects/ui-primitives/` and confirm protocol files are complete | `Get-ChildItem docs/projects/ui-primitives/NORTH_STAR.md,docs/projects/ui-primitives/TRACKER.md,docs/projects/ui-primitives/GAPS.md` |
| T2 | done | Capture shared-token and ownership evidence for cold-start handoff | Worker B | 2026-05-31 | `src/components/ui`, `src/styles`, `src/components/layout/GameModals.tsx` | Cross-walk actual primitive usage and add unresolved items | Verify this doc set matches findings in `GAPS.md` |
| T3 | done | Reconcile adjacent follow-up planning gaps (G1-G4) and align tracker checklist | Gemini | 2026-06-01 | `NORTH_STAR.md` + `GAPS.md` | Keep project gap checklist aligned and evidence-based | Reconcile `TRACKER.md` gap IDs with `GAPS.md` rows |
| T4 | done | Implement interactive live visual previews for all table-only components in Atomic UI Step (`PreviewComponents.tsx`) | Gemini | 2026-06-01 | `src/components/DesignPreview/steps/PreviewComponents.tsx` | Ensure interactive sandboxes, spinners, budget sliders, and modal triggers compile and behave smoothly | Verified via local dev server checks and tsc compilation |
| T5 | done | Audit and implement focus traps in remaining dynamic modals (G6) and align component ownership contracts (G1) | Gemini | 2026-06-01 | `src/components/ui/MissingChoiceModal.tsx`, `RestModal.tsx` | Integrate `useFocusTrap` hook into MissingChoiceModal and RestModal, and add component owner header to remaining files in `src/components/ui` | Verified modal overlays trap keyboard focus properly and build compiles cleanly |
| T6 | done | Fix focus trap restoration on programmatic close (G7) and add fallback Escape handler (G8) | Qoder | 2026-06-03 | `src/hooks/useFocusTrap.ts`, `src/components/layout/GameModals.tsx` | Fixed unmount focus restoration with `requestAnimationFrame` + `restoreFocusTo` override; added capture-phase fallback Escape handler in GameModals respecting child `defaultPrevented` | TSC compilation clean (no new errors); verify focus restores on unmount and Escape closes all modals |

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G1 | done | adjacent_follow_up | Gemini | `docs/projects/ui-primitives/GAPS.md` | registry-to-scaffold upgrade | Align component ownership + design tokens | `docs/projects/PROJECT_TRACKER.md` | Preserves long-lived scope signal for implementation handoff | Move to active implementation tracker with owner decision | evidence added to feature-level planning |
| G2 | done | support_needed_now | Gemini | `docs/projects/ui-primitives/GAPS.md` | direct source review | No shared form input primitive in src/components/ui | `src/components/ui/Input.tsx` | Modal and form-heavy screens still define duplicate `<input>/<select>` handling | Implemented reusable input primitives and integrated in modals | Confirm usage of shared primitive replacement points |
| G3 | done | support_needed_now | Gemini | `docs/projects/ui-primitives/GAPS.md` | direct source review | Mixed modal layering token usage (`Z_INDEX` + direct CSS vars) | `src/styles/zIndex.ts`, `src/components/ui/BanterInterruptUI.tsx` | Weakens style consistency and reviewability across overlays | Migrated key elements to type-safe Z_INDEX constants | Verify no regression in modal overlay ordering |
| G4 | done | adjacent_follow_up | Gemini | `docs/projects/ui-primitives/GAPS.md` | ownership scan | No explicit ownership field in core UI primitives | `src/components/ui/*`, `src/styles/uiIds.ts` | Ownership is implicit, limiting team handoff clarity and future ownership audits | Established `@component-owner` header contract across modified files | Confirm convention is accepted and documented in code comments or tracker |
| G5 | not_started | adjacent_follow_up | Worker B | `docs/projects/ui-primitives/GAPS.md` | G2 implementation | Lack of standard form validation cues across custom inputs | `src/components/ui/Input.tsx` | Inputs have standard error props but lack dynamic schema-based validation integrations | Define shared form validation and feedback specs | Review validation error states in sandboxes |
| G6 | done | support_needed_now | Gemini | `docs/projects/ui-primitives/GAPS.md` | modal review | Incomplete keyboard focus trap coverage in dynamic modals | `src/components/ui/MissingChoiceModal.tsx`, `RestModal.tsx` | Lack of active focus trap hooks in some modals presents accessibility and keyboard navigation risks | Apply `useFocusTrap` hook to remaining in-scope modal surfaces | Verify keyboard tab focus wraps inside active modals |
| G7 | done | support_needed_now | Qoder | `docs/projects/ui-primitives/GAPS.md` | G6 follow-up audit | Focus trap restoration on unmount/programmatic close was broken | `src/hooks/useFocusTrap.ts` | Modals unmounted while open lost focus to document.body | Added unmount cleanup, `requestAnimationFrame` restore, optional `restoreFocusTo` param | Verify focus restores on programmatic close and unmount |
| G8 | done | support_needed_now | Qoder | `docs/projects/ui-primitives/GAPS.md` | G7 follow-up audit | Missing fallback Escape bindings at GameModals level | `src/components/layout/GameModals.tsx` | Child modals without Escape handler left users stuck | Added capture-phase fallback Escape handler respecting child `defaultPrevented` | Verify Escape closes every modal |
| G9 | not_started | adjacent_follow_up | Qoder | `docs/projects/ui-primitives/GAPS.md` | G8 implementation audit | ~16 modals in GameModals lack `useFocusTrap` | `src/components/layout/GameModals.tsx` | Keyboard focus escapes overlay boundaries | Audit and integrate focus trapping per modal | Tab key stays inside each modal |
| G10 | not_started | adjacent_follow_up | Qoder | `docs/projects/ui-primitives/GAPS.md` | G8 implementation audit | Inconsistent ARIA dialog labeling | `src/components/ui/*.tsx` | Screen readers cannot identify dialog purpose consistently | Define standard ARIA convention | Audit all modal roots for consistent labeling |

## Update Rules

- Update this tracker before starting any significant feature-scoped slice.
- Keep active/blocked/waiting rows current with owner, date, and next proof.
- Keep unresolved long-lived gaps in `docs/projects/ui-primitives/GAPS.md`.
