---
schema_version: 1
project: Ui Primitives
slug: ui-primitives
category: active project
main_category: "Interface & Experience"
subcategory: "UI Shell & Components"
status: active
last_updated: 2026-06-12
iteration: 2
confidence: unknown
evidence: "docs/projects/ui-primitives/TRACKER.md; docs/projects/ui-primitives/GAPS.md"
gap_signal: "0 open gaps; validation feedback, focus-trap, ARIA, and coin-display semantics gaps are marked done"
protocol: living-project
next_step: "No open UI primitive gap remains after G12; run a fresh source-backed gap scan before assigning another forward pass."
agent_comments: ""
required_docs:
  - NORTH_STAR.md
  - TRACKER.md
  - GAPS.md
  - COLD_START_AGENT_PROMPT.md
  - DECISIONS.md
  - AUDIT_OR_PROOF.md
  - RUNBOOK.md
optional_docs:
required_verification:
  - docs consistency
completed_verification:
  - docs refresh
  - focused GameModals
  - Input
  - and coin-display tests
last_proof: 2026-06-08
workflow_gaps_reviewed: ""
compaction_status: not_needed
lifecycle_status: active
deprecation_confidence: none
deprecation_reason: ""
canonical_owner: ""
human_decision_required: "no"
---
# UI Primitives North Star

Status: active  
Last updated: 2026-06-12

## Dashboard Card Schema

| Field | Value |
|---|---|
| Project | Ui Primitives |
| Slug | ui-primitives |
| Category | active project |
| Status | active |
| Confidence | unknown |
| Evidence | docs/projects/ui-primitives/TRACKER.md; docs/projects/ui-primitives/GAPS.md |
| Gap signal | G5 validation feedback, G9 focus-trap manager coverage, G10/G11 ARIA labeling passes, and G12 coin-display semantics done |
| Protocol | living-project |
| Next step | No open UI primitive gap remains after G12; run a fresh source-backed gap scan before assigning another forward pass. |
| Required verification | docs consistency |
| Completed verification | docs refresh, focused GameModals, Input, and coin-display tests |
| Last proof | 2026-06-08 GameModals focus-trap tests, Input accessibility feedback tests, and CoinDisplay/CoinPurseDisplay tests |
| Workflow gaps reviewed | yes |

## Why this project exists
UI primitives are the shared foundation for gameplay and feature interfaces. This project tracks how far `src/components/ui` is already covering reusable controls, overlays, and modal surfaces, and what must stay stable before expansion work proceeds.

## Purpose and scope
- Scope: `src/components/ui` plus direct shared references in `src/styles` and `src/components/layout/GameModals.tsx`, `src/App.tsx`, `src/components/DesignPreview/steps/PreviewComponents.tsx`.
- In scope: reusable controls, modal families, tokens/IDs, and component ownership evidence.
- Out of scope: new feature logic and broad refactors outside `docs/projects/ui-primitives/`.

## File map (cold-start evidence)
- Core controls: `src/components/ui/Button.tsx`, `Input.tsx`, `Spinner.tsx`, `Table.tsx`, `Typography.tsx`, `SplitPaneLayout.tsx`, `SelectionCard.tsx`, `SelectionList.tsx`.
- Modal surfaces: `ConfirmationModal.tsx`, `MissingChoiceModal.tsx`, `RestModal.tsx`, `GameGuideModal.tsx`, `ImageModal.tsx`, `OllamaDependencyModal.tsx`.
- App shell + overlays: `LoadingSpinner.tsx`, `NotificationSystem.tsx`, `WindowFrame.tsx`, `ResizeHandles.tsx`, `ErrorBoundary.tsx`, `ErrorOverlay.tsx`.
- Utility and shared data surfaces: `CoinDisplay.tsx`, `CoinPurseDisplay.tsx`, `TimeWidget.tsx`, `VersionDisplay.tsx`.
- Style tokens and IDs: `src/styles/buttonStyles.ts`, `src/styles/zIndex.ts`, `src/styles/uiIds.ts`.
- Hooks: `src/hooks/useFocusTrap.ts` (focus trap + Escape + unmount restoration).
- Lifecycle/reference surface: `src/components/layout/GameModals.tsx`, `src/components/DesignPreview/steps/PreviewComponents.tsx`.

## Implemented state
- **Core Custom UI Showcase:** Every custom component under `src/components/ui` (including the premium `<Input>` primitives) is fully visual-preview integrated and documented with Code Commentary inside `src/components/DesignPreview/steps/PreviewComponents.tsx`. This establishes a complete live interactive sandbox baseline with sliders, active triggers, and dials.
- Existing shared styling system is active for buttons (`Button.tsx` + `buttonStyles.ts`), input primitives (`Input.tsx` supporting standard input/select/checkbox/textarea variants), and modal layering (`zIndex.ts` + App-level CSS variable setup).
- Modal orchestration already lives in `GameModals.tsx`, so most feature modals render through a single integration point.
- UI primitives are now strictly integrated: shared input primitives exist, and key stubs use proper `Z_INDEX` constants with explicit ownership declarations.
- Focus traps are fully integrated and verified across all dynamic modals (`MissingChoiceModal`, `RestModal`, `GameGuideModal`, `ImageModal`, `ConfirmationModal`, `OllamaDependencyModal`) using the unified `useFocusTrap` hook. All custom components under `src/components/ui/` now strictly align with the `@component-owner` header contract for clean module and team ownership mapping.
- **Focus trap restoration (G7):** `useFocusTrap` now properly restores focus on component unmount (common when GameModals conditionally removes a modal while `isOpen` is still `true`). Added optional `restoreFocusTo` parameter for custom restoration targets and `requestAnimationFrame` deferral for DOM stability.
- **Fallback Escape handler (G8):** `GameModals.tsx` now registers a capture-phase Escape key listener that closes the topmost visible modal when child components haven't already handled the event (checked via `defaultPrevented`).

## Integrations and ownership shape
- `src/App.tsx` is the global composition point for shell-level primitives (`LoadingSpinner`, `NotificationSystem`, reaction/UI error surfaces).
- `src/components/layout/GameModals.tsx` is the main runtime owner of modal rendering and visibility branching.
- `src/components/DesignPreview/steps/PreviewComponents.tsx` provides the canonical catalog used for verification and future expansion checks.
- Explicit `@component-owner` metadata is now standard across all UI primitive files, establishing direct team/module ownership.

## Gaps and uncertainties
- [RESOLVED] Dedicated shared input primitives (`Input`, `TextArea`, `Select`, `Checkbox`) are implemented under `src/components/ui/Input.tsx` and migrated in modals.
- [RESOLVED] Mixed modal layering is resolved for key stubs (e.g. `BanterInterruptUI.tsx` migrated to type-safe `Z_INDEX` constants).
- [RESOLVED] Explicit component-owner header contract has been introduced and applied across all UI components in `src/components/ui/`.
- [RESOLVED] Focus traps have been audited and fully implemented across all dynamic modals.
- [RESOLVED] Focus trap restoration on unmount/programmatic close is now fixed with cleanup and deferred restoration.
- [RESOLVED] Fallback Escape handler at GameModals level ensures all modals are closeable via keyboard.
- [RESOLVED] Input/TextArea/Select validation feedback now uses native label, invalid, and described-by relationships (G5).
- [RESOLVED] GameModals manager-owned overlays now use focus-trap wrappers where child components do not already own `useFocusTrap` (G9).
- [RESOLVED for `src/components/ui`] Shared UI modal roots now use consistent dialog labeling (`role="dialog"`, `aria-modal`, and title-backed labeling) (G10).
- Non-UI modal families completed the same labeling normalization (G11); `src/components/ImageModal.tsx` is an alias shim rather than a runtime modal root.
- [RESOLVED] Coin display primitives are focusable tooltip targets without misleading button semantics, and the empty purse state now renders a visible zero-gold badge (G12).

## Next checks
- No open UI primitive gap remains from the current audited set after the G12 coin-display semantics pass. Before assigning another forward pass, run a fresh source-backed gap scan and register the specific finding.


## Cold-Start Gap Routing

The next cold-start agent must:
- read `TRACKER.md` and `GAPS.md` first
- tackle one real, evidence-backed project gap in the same pass
- identify and register 2 additional real project gaps tied to this project in `GAPS.md`
- if no valid in-scope project gaps exist, identify 2 real cross-project gaps in `docs/projects/GLOBAL_GAPS.md` instead and register them there
- do not invent gaps just to satisfy the count

## Global Gap Imports

| GG ID | Imported? | Destination | Scope rationale | Checked |
|---|---|---|---|---|
| GG-20 | no | â€” | GameModals.tsx architectural split is out of scope; ui-primitives covers reusable controls/surfaces, not file-level decomposition of the orchestrator | 2026-06-03 |
| GG-21 | no | â€” | ActionPane local state fragmentation belongs to state/architecture project, not ui-primitives surface | 2026-06-03 |
