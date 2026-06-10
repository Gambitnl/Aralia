# Design Preview Decisions

Status: active
Last updated: 2026-06-09

This file records the durable decisions that support the current Design Preview
handoff. It stays short on purpose and only captures choices that future agents
need before they move or modularize large preview step files.

## Decisions

| ID | Decision | Reason | Evidence / follow-up |
|---|---|---|---|
| D1 | Treat the lane steward map in `NORTH_STAR.md` as the source of truth for active preview ownership. | The active router is large enough that guessing owners by file size or lane label is unsafe. | `src/components/DesignPreview/DesignPreviewPage.tsx`; `docs/projects/design-preview/NORTH_STAR.md` |
| D2 | Use `PreviewTables.test.tsx` as the current step-level test anchor for split-proof work, and require a rendered preview screenshot before moving `PreviewComponents.tsx` or any other large shared-UI lane. | `PreviewEnvironment` does not yet have its own `*.test.tsx`, and `PreviewComponents.tsx` is the largest active step in the folder. | `src/components/DesignPreview/steps/PreviewTables.test.tsx`; `src/components/DesignPreview/steps/PreviewComponents.tsx`; `docs/projects/design-preview/NORTH_STAR.md` |
| D3 | Treat `PreviewMdLibrary.tsx` as a dormant helper rather than an active Design Preview lane until `DesignPreviewPage.tsx` routes it again. | The file is large, but it is not currently imported by the page router, so moving it as if it were active would misstate the current surface. | `src/components/DesignPreview/steps/PreviewMdLibrary.tsx`; `src/components/DesignPreview/DesignPreviewPage.tsx` |
| D4 | Keep the current split-proof expectations documentation-only in this pass. | The task is to prepare future agents for safe movement, not to move or split the step files now. | `docs/projects/design-preview/AUDIT_OR_PROOF.md`; `docs/projects/design-preview/GAPS.md` |

## Notes

- No human decision is required for the current lane map.
- If future work re-routes new steps into the preview page, add a decision row
  here before treating that lane as split-ready.
