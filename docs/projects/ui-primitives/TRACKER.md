# UI primitives Tracker

Status: active
Last updated: 2026-06-08

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
| T7 | done | Resolve fresh coin-display semantics gap found after the audited UI primitive set was otherwise closed. | Codex | 2026-06-08 | `src/components/ui/CoinDisplay.tsx`, `src/components/ui/CoinPurseDisplay.tsx`, `src/components/ui/CoinDisplay.test.tsx`, `src/components/ui/CoinPurseDisplay.test.tsx` | Converted coin tooltip targets away from misleading button semantics and made the empty purse zero-gold display explicit. | `npm exec vitest run src/components/ui/CoinDisplay.test.tsx src/components/ui/CoinPurseDisplay.test.tsx` |

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G1 | done | adjacent_follow_up | Gemini | `docs/projects/ui-primitives/GAPS.md` | registry-to-scaffold upgrade | Align component ownership + design tokens | `docs/projects/PROJECT_TRACKER.md` | Preserves long-lived scope signal for implementation handoff | Move to active implementation tracker with owner decision | evidence added to feature-level planning |
| G2 | done | support_needed_now | Gemini | `docs/projects/ui-primitives/GAPS.md` | direct source review | No shared form input primitive in src/components/ui | `src/components/ui/Input.tsx` | Modal and form-heavy screens still define duplicate `<input>/<select>` handling | Implemented reusable input primitives and integrated in modals | Confirm usage of shared primitive replacement points |
| G3 | done | support_needed_now | Gemini | `docs/projects/ui-primitives/GAPS.md` | direct source review | Mixed modal layering token usage (`Z_INDEX` + direct CSS vars) | `src/styles/zIndex.ts`, `src/components/ui/BanterInterruptUI.tsx` | Weakens style consistency and reviewability across overlays | Migrated key elements to type-safe Z_INDEX constants | Verify no regression in modal overlay ordering |
| G4 | done | adjacent_follow_up | Gemini | `docs/projects/ui-primitives/GAPS.md` | ownership scan | No explicit ownership field in core UI primitives | `src/components/ui/*`, `src/styles/uiIds.ts` | Ownership is implicit, limiting team handoff clarity and future ownership audits | Established `@component-owner` header contract across modified files | Confirm convention is accepted and documented in code comments or tracker |
| G5 | done | adjacent_follow_up | Codex | `docs/projects/ui-primitives/GAPS.md` | G2 implementation | Lack of standard form validation cues across custom inputs | `src/components/ui/Input.tsx`; `src/components/ui/Input.test.tsx` | Error/helper text is now linked to native controls for assistive tech | Added label wiring, `aria-invalid`, and merged `aria-describedby` feedback IDs for Input, TextArea, and Select | `npm test -- --run src/components/ui/Input.test.tsx` (4 tests passed) |
| G6 | done | support_needed_now | Gemini | `docs/projects/ui-primitives/GAPS.md` | modal review | Incomplete keyboard focus trap coverage in dynamic modals | `src/components/ui/MissingChoiceModal.tsx`, `RestModal.tsx` | Lack of active focus trap hooks in some modals presents accessibility and keyboard navigation risks | Apply `useFocusTrap` hook to remaining in-scope modal surfaces | Verify keyboard tab focus wraps inside active modals |
| G7 | done | support_needed_now | Qoder | `docs/projects/ui-primitives/GAPS.md` | G6 follow-up audit | Focus trap restoration on unmount/programmatic close was broken | `src/hooks/useFocusTrap.ts` | Modals unmounted while open lost focus to document.body | Added unmount cleanup, `requestAnimationFrame` restore, optional `restoreFocusTo` param | Verify focus restores on programmatic close and unmount |
| G8 | done | support_needed_now | Qoder | `docs/projects/ui-primitives/GAPS.md` | G7 follow-up audit | Missing fallback Escape bindings at GameModals level | `src/components/layout/GameModals.tsx` | Child modals without Escape handler left users stuck | Added capture-phase fallback Escape handler respecting child `defaultPrevented` | Verify Escape closes every modal |
| G9 | done | adjacent_follow_up | Codex worker | `docs/projects/ui-primitives/GAPS.md` | G8 implementation audit | GameModals manager-owned overlays lacked focus-trap wrappers | `src/components/layout/GameModals.tsx`; `src/components/layout/__tests__/GameModals.test.tsx` | Keyboard focus could escape overlay boundaries where child modals did not own `useFocusTrap` | Added manager-level focus-trap wrappers for 14 GameModals-rendered roots; left already-self-trapped modals to their component-owned hooks | `npm test -- --run src/components/layout/__tests__/GameModals.test.tsx` (15 tests passed) |
| G10 | done | adjacent_follow_up | Qoder | `docs/projects/ui-primitives/GAPS.md` | Slice `G10` in `src/components/ui` | Inconsistent ARIA dialog labeling on shared modal roots | `src/components/ui/{ConfirmationModal.tsx,GameGuideModal.tsx,ImageModal.tsx,MissingChoiceModal.tsx,RestModal.tsx,LongRestModal.tsx}` | Screen readers previously missed or got inconsistent dialog purpose labels on shared primitives | Applied consistent `role="dialog"` + `aria-modal` + `aria-labelledby` in the UI primitives modal set | Continue to apply same convention to remaining modal families outside `src/components/ui` |
| G11 | done | adjacent_follow_up | Qoder | `docs/projects/ui-primitives/GAPS.md` | `G10` follow-up | Non-UI modal families still need labeling normalization | `src/components/*Modal.tsx` (excluding `src/components/ui/*`) | Non-UI modal roots now use dialog role, modal semantics, and label association where they are runtime modal roots; `src/components/ImageModal.tsx` is an alias shim, not a runtime root | Completed ARIA labeling pass across non-UI modal families with focused tests for representative surfaces | `npm test src/components/__tests__/EncounterModal.test.tsx src/components/CharacterSheet/__tests__/CharacterSheetModal.test.tsx src/components/Trade/__tests__/MerchantModal.test.tsx` (15 tests passed); static modal audit PASS=16 FAIL=1 alias shim |
| G12 | done | adjacent_follow_up | Codex | `docs/projects/ui-primitives/GAPS.md` | Fresh source-backed gap scan | Coin displays had stale action-semantics TODOs and the purse zero state collapsed through the default badge filter. | `src/components/ui/CoinDisplay.tsx`, `src/components/ui/CoinPurseDisplay.tsx` | Tooltip-only currency displays should be keyboard-discoverable without presenting as commands, and zero currency should remain visible in the purse summary. | Coin tiles/badges now use focusable `role="img"` tooltip-target semantics, direct zero badges remain collapsed by default, and the purse explicitly opts into a visible zero-gold badge. | `npm exec vitest run src/components/ui/CoinDisplay.test.tsx src/components/ui/CoinPurseDisplay.test.tsx` |

## Update Rules

- Update this tracker before starting any significant feature-scoped slice.
- Keep active/blocked/waiting rows current with owner, date, and next proof.
- Keep unresolved long-lived gaps in `docs/projects/ui-primitives/GAPS.md`.
