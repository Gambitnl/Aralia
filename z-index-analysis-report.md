# Z-Index Usage Analysis Report

## Current Correction (2026-06-26)

Backlog retirement rechecked the current tree and found this report is stale. Runtime source still contains four hardcoded `z-[number]` classes in `src/components/World3D/AtlasPlayerMarker.tsx`, `src/components/MapPane.tsx`, `src/components/DesignPreview/steps/PreviewComponents.tsx`, and `src/components/CharacterCreator/Race/RaceDetailPane.tsx`.

The remaining work is now owned by `docs/projects/ui-primitives/GAPS.md` G3 and `docs/projects/ui-primitives/TRACKER.md` T1. Treat the older "0 runtime instances" section below as historical context, not current completion evidence.

## Status Summary (2026-01-31)
A current scan finds no hardcoded `z-[number]` values in runtime source code under `src/**`. All remaining occurrences are in documentation, tests, or archived references.

## Methodology (Current)
- Searched for `z-[number]` patterns using regex `z-\[\d+\]`.
- Reviewed all hits and classified them by runtime vs. non-runtime usage.

## Current Findings

### Runtime Code
- **0** hardcoded `z-[number]` instances in `src/**`.
- All layering appears to route through the Z-Index registry.

### Non-Runtime References (examples, docs, tests)
Hardcoded `z-[number]` values remain in non-runtime files:
- `src/components/ui/Tooltip.README.md`
- `src/components/SaveLoad/LoadGameTransition.README.md`
- `docs/archive/improvements/10_enhance_loading_transition.md`
- `src/styles/README.md`
- `src/styles/__tests__/zIndex.test.ts`
- `src/styles/zIndex.ts` (example in comments)

## Implications
- No migration work remains for runtime components.
- Optional cleanup: update documentation examples to prefer `Z_INDEX.*` over hardcoded numbers to avoid reintroducing old patterns.

## Historical Context
An earlier pre-migration scan identified 42 hardcoded z-index instances and recommended a centralized registry. That migration has since been completed, leaving only non-runtime references as noted above.

<!-- aralia-backlog-walked: {"source":"docs/tasks/backlog-retirement/RETIREMENT_LEDGER.md","path":"z-index-analysis-report.md","sha256WithoutMarker":"135893adc5628cfb2147b7ad2622f3c613cee325e1c8e7e3728d907b9a130a4c","markedAtUtc":"2026-06-26T00:40:14.571Z"} -->
