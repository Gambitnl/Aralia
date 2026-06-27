# Z-Index Registry Migration Progress

## Current Correction (2026-06-26)

Backlog retirement rechecked the current tree and found this progress note is stale. Runtime source still contains four hardcoded `z-[number]` classes in `src/components/World3D/AtlasPlayerMarker.tsx`, `src/components/MapPane.tsx`, `src/components/DesignPreview/steps/PreviewComponents.tsx`, and `src/components/CharacterCreator/Race/RaceDetailPane.tsx`.

The remaining work is now owned by `docs/projects/ui-primitives/GAPS.md` G3 and `docs/projects/ui-primitives/TRACKER.md` T1. Treat the older "100%" sections below as historical migration context, not current completion evidence.

## Completed Migrations ✅

### High Priority Components
- **Tooltip.tsx**: `z-[9999]` → `Z_INDEX.TOOLTIP`
- **ConfirmationModal.tsx**: `z-[60]` → `Z_INDEX.MODAL_BACKGROUND`
- **GameGuideModal.tsx**: `z-[70]` → `Z_INDEX.MODAL_CONTENT`
- **WindowFrame.tsx**: `z-[100]` → `Z_INDEX.WINDOW_FRAME`
- **ResizeHandles.tsx**: `z-[110]` → `Z_INDEX.RESIZE_HANDLES_HORIZONTAL`, `z-[120]` → `Z_INDEX.RESIZE_HANDLES_CORNERS`

### TypeScript Validation ✅
- All migrated components pass TypeScript compilation
- No type errors introduced by registry usage
- Template literal syntax working correctly with Tailwind CSS

## Current Status (2026-01-31)
- No hardcoded `z-[number]` values remain in runtime source (`src/**`).
- Remaining occurrences are limited to docs/tests/examples (e.g., READMEs, archived docs, test fixtures).

## Migration Statistics
- **Historical hardcoded instances migrated**: 42
- **Completed migrations**: 42 instances (100%)
- **Remaining migrations**: 0 instances (0%)
- **Components migrated**: 19/19 (100%)

## Migration Completed ✅

### All Components Migrated:
- **Modal System**: 11 components (ConfirmationModal, GameGuideModal, RestModal, LevelUpModal, ImageModal, MissingChoiceModal, OllamaDependencyModal, FenceInterface, SpellbookOverlay, ThreeDModal, DevMenu)
- **Overlay Components**: 3 components (DiceOverlay, CombatView, SubmapPane glossary)
- **Interactive Elements**: 2 components (ResizeHandles, GlossaryResizeHandles)
- **Infrastructure**: 5 components (WindowFrame, SubmapPane overlay, SubmapTile, LoadGameTransition, App error)
- **Always-on-top**: 1 component (Tooltip)

### Migration Quality:
- ✅ **TypeScript Validation**: All components compile without z-index related errors
- ✅ **Registry Coverage**: All 42 hardcoded values replaced with named constants
- ✅ **Consistent Naming**: Logical hierarchy with clear layer separation
- ✅ **Template Literal Safety**: All z-index values properly interpolated

## Quality Assurance
- [x] TypeScript compilation passes
- [x] No runtime errors in migrated components
- [ ] Visual regression testing needed
- [ ] Modal stacking behavior verification needed
- [ ] Cross-browser compatibility check needed

## Risk Assessment
- **Low Risk**: Registry constants are compile-time safe
- **Medium Risk**: Visual layering changes during migration
- **High Risk**: Complex modal interactions may have edge cases

## Success Criteria
- ✅ 100% migration of hardcoded z-index values
- ✅ Consistent layering across all UI components
- ✅ Improved developer experience with named constants
- ✅ No visual regressions in production

<!-- aralia-backlog-walked: {"source":"docs/tasks/backlog-retirement/RETIREMENT_LEDGER.md","path":"z-index-migration-progress.md","sha256WithoutMarker":"e918e4bb3cde81c9c746138c5b54ef66f3bcd5fe91a1299ebe48c34f5269fe47","markedAtUtc":"2026-06-26T00:40:14.570Z"} -->
