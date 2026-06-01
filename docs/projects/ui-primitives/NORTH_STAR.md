# UI Primitives North Star

Status: active  
Last updated: 2026-05-31

## Why this project exists
UI primitives are the shared foundation for gameplay and feature interfaces. This project tracks how far `src/components/ui` is already covering reusable controls, overlays, and modal surfaces, and what must stay stable before expansion work proceeds.

## Purpose and scope
- Scope: `src/components/ui` plus direct shared references in `src/styles` and `src/components/layout/GameModals.tsx`, `src/App.tsx`, `src/components/DesignPreview/steps/PreviewComponents.tsx`.
- In scope: reusable controls, modal families, tokens/IDs, and component ownership evidence.
- Out of scope: new feature logic and broad refactors outside `docs/projects/ui-primitives/`.

## File map (cold-start evidence)
- Core controls: `src/components/ui/Button.tsx`, `Spinner.tsx`, `Table.tsx`, `Typography.tsx`, `SplitPaneLayout.tsx`, `SelectionCard.tsx`, `SelectionList.tsx`.
- Modal surfaces: `ConfirmationModal.tsx`, `MissingChoiceModal.tsx`, `RestModal.tsx`, `GameGuideModal.tsx`, `ImageModal.tsx`, `OllamaDependencyModal.tsx`.
- App shell + overlays: `LoadingSpinner.tsx`, `NotificationSystem.tsx`, `WindowFrame.tsx`, `ResizeHandles.tsx`, `ErrorBoundary.tsx`, `ErrorOverlay.tsx`.
- Utility and shared data surfaces: `CoinDisplay.tsx`, `CoinPurseDisplay.tsx`, `TimeWidget.tsx`, `VersionDisplay.tsx`.
- Style tokens and IDs: `src/styles/buttonStyles.ts`, `src/styles/zIndex.ts`, `src/styles/uiIds.ts`.
- Lifecycle/reference surface: `src/components/layout/GameModals.tsx`, `src/components/DesignPreview/steps/PreviewComponents.tsx`.

## Implemented state
- Existing shared styling system is active for buttons (`Button.tsx` + `buttonStyles.ts`) and modal layering (`zIndex.ts` + App-level CSS variable setup).
- Modal orchestration already lives in `GameModals.tsx`, so most feature modals render through a single integration point.
- UI primitives show mixed integration quality: shared primitives exist, but several modal/input files still define raw controls and style tokens inline.

## Integrations and ownership shape
- `src/App.tsx` is the global composition point for shell-level primitives (`LoadingSpinner`, `NotificationSystem`, reaction/UI error surfaces).
- `src/components/layout/GameModals.tsx` is the main runtime owner of modal rendering and visibility branching.
- `src/components/DesignPreview/steps/PreviewComponents.tsx` provides the canonical catalog used for verification and future expansion checks.
- No explicit `owner` metadata is declared in primitive files; ownership is inferred from import/usage ownership.

## Gaps and uncertainties
- No dedicated shared input primitive (`<input>`, `<select>`, textarea family) is visible under `src/components/ui`.
- Modal layering is mixed: some consumers use shared `Z_INDEX` constants while others use direct CSS variables.
- Component ownership remains informal; no in-file ownership contract exists yet.

## Next checks
- Normalize proof list to keep this file aligned to: `TRACKER.md` and `GAPS.md`.
- Record migration candidates before touching implementation (input primitive + z-index consistency order).
- Keep this project to docs updates only until a follow-up implementation ticket opens.
