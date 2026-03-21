# Architectural Improvement: Town Component Consolidation
This file was re-verified on 2026-03-14.
It is preserved as architectural provenance for a town-component consolidation that substantially landed.

Current reality:
- the town components it wanted grouped are already under `src/components/Town/`
- this file is now historical evidence for the consolidation direction rather than a still-live refactor plan


**Status:** Proposed / To-Do
**Date:** 2024-05-23
**Author:** Mason (Agent)

## 1. Context & Problem
The `src/components/` directory currently houses several top-level files related to the "Town" or "Village" feature:
- `src/components/TownCanvas.tsx`
- `src/components/TownNavigationControls.tsx`
- `src/components/VillageScene.tsx` (and its README)

This violates the principle of "A place for everything, and everything in its place." These components represent a cohesive domain (town exploration and rendering) and should be grouped together to reduce clutter and improve discoverability.

Additionally, the services backing these components (`RealmSmithTownGenerator.ts`, `RealmSmithAssetPainter.ts`) are located in the generic `src/services/` folder, despite having no other consumers in the application.

## 2. Proposed Solution
Create a dedicated directory structure for the Town feature. This could be a simple component grouping or a full "Feature" promotion depending on the desired architectural strictness.

### Phase 1: Component Grouping (Immediate)
Move the UI components into a dedicated folder.

**Target Structure:**
```text
src/components/Town/
â”œâ”€â”€ TownCanvas.tsx
â”œâ”€â”€ TownNavigationControls.tsx
â”œâ”€â”€ VillageScene.tsx
â””â”€â”€ VillageScene.README.md
```

**Steps:**
1. Create `src/components/Town/`.
2. Move the files listed above.
3. Update imports in `src/App.tsx` and within the moved files.

### Phase 2: Feature Isolation (Extensive)
Since the `RealmSmith` services are exclusive to `TownCanvas`, we should consider a "Vertical Slice" architecture or at least co-location.

**Option A: Enhanced Component Structure**
Move the services into a `services` subdirectory within the component folder, or a `hooks` folder if we refactor them.

```text
src/components/Town/
â”œâ”€â”€ services/
â”‚   â”œâ”€â”€ RealmSmithTownGenerator.ts
â”‚   â””â”€â”€ RealmSmithAssetPainter.ts
â”œâ”€â”€ TownCanvas.tsx
â””â”€â”€ ...
```

**Option B: Promotion to `src/features/`**
If the "Town" is considered a major game mode (like Combat), it might belong in `src/features/Town/`.

```text
src/features/Town/
â”œâ”€â”€ components/
â”‚   â”œâ”€â”€ TownCanvas.tsx
â”‚   â””â”€â”€ TownNavigationControls.tsx
â”œâ”€â”€ services/
â”‚   â”œâ”€â”€ RealmSmithTownGenerator.ts
â”‚   â””â”€â”€ RealmSmithAssetPainter.ts
â”œâ”€â”€ hooks/
â”‚   â””â”€â”€ useTownNavigation.ts (extract logic from Canvas)
â””â”€â”€ index.ts (public API)
```

## 3. Detailed Execution Plan (Phase 1)

1.  **Create Directory**: `mkdir -p src/components/Town`
2.  **Move Files**:
    - `git mv src/components/TownCanvas.tsx src/components/Town/`
    - `git mv src/components/TownNavigationControls.tsx src/components/Town/`
    - `git mv src/components/VillageScene.tsx src/components/Town/`
    - `git mv src/components/VillageScene.README.md src/components/Town/`
3.  **Refactor Imports**:
    - In `src/App.tsx`:
      `import TownCanvas from './components/TownCanvas';` -> `import TownCanvas from './components/Town/TownCanvas';`
    - In `src/components/Town/TownCanvas.tsx`:
      Update relative imports to step up one level (e.g., `../services/` -> `../../services/`).
4.  **Verify**:
    - Run `npm run build` to catch module resolution errors.
    - Check for circular dependencies (unlikely here, but good practice).

## 4. Open Questions / Legacy Check
- **VillageScene.tsx**: This component appears to be a legacy implementation of the village view.
    - *Action*: Confirm if this is dead code. If so, delete it instead of moving it.
    - *Clue*: Check `src/services/villageGenerator.ts`. It mentions "Canvas hit-testing in the VillageScene". This implies `VillageScene` might still be the intended consumer for the legacy generator, while `TownCanvas` uses `RealmSmith`.
    - *Recommendation*: Keep both for now, but mark `VillageScene` as `@deprecated` if confirmed.

## 5. Benefits
- **Reduced Cognitive Load**: Developers browsing `src/components` won't be overwhelmed by loose files.
- **Cohesion**: Related files are physically close.
- **Portability**: The "Town" feature becomes easier to move or refactor in the future.
