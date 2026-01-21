# Z-Index Usage Analysis Report

## Executive Summary
Analysis of 42 hardcoded z-index instances across the Aralia codebase reveals inconsistent usage patterns and potential layering conflicts. This confirms the need for a centralized Z-Index registry.

## Methodology
- Searched for all `z-[number]` patterns using regex `z-\[\d+\]`
- Categorized by component type and z-index value
- Analyzed usage patterns and potential conflicts

## Current Z-Index Distribution

### By Value
| Z-Index | Count | Components | Category |
|---------|-------|------------|----------|
| `20` | 1 | SubmapPane overlay | Base content |
| `60` | 5 | CombatView, DevMenu, OllamaDependencyModal, FenceInterface, SubmapPane | Modal backgrounds |
| `70` | 1 | GameGuideModal | Modal |
| `80` | 2 | DiceOverlay, MissingChoiceModal | Modal/Overlay |
| `100` | 5 | WindowFrame, ImageModal, LoadGameTransition, SubmapTile, App error | Infrastructure/Modal |
| `110` | 4 | ResizeHandles (horizontal) | Interactive elements |
| `120` | 6 | ResizeHandles (corners), RestModal, LevelUpModal | Interactive/Modal |
| `150` | 1 | ThreeDModal background | Modal background |
| `200` | 2 | ThreeDModal content, SpellbookOverlay | Modal content/Overlay |
| `9999` | 1 | Tooltip | Always-on-top |

### By Component Category
| Category | Count | Z-Index Values | Notes |
|----------|-------|----------------|-------|
| **Modals** | 12 | 60, 70, 80, 100, 120, 150, 200 | Wide range, inconsistent |
| **Overlays** | 5 | 60, 80, 100, 200 | Conflicting with modals |
| **Interactive Elements** | 10 | 110, 120 | Resize handles |
| **Infrastructure** | 6 | 20, 60, 100 | Base layers and frames |
| **Special Cases** | 2 | 9999 (Tooltip), 100 (Error) | Extreme values |
| **Backgrounds** | 7 | 60, 100, 150 | Modal/combat backgrounds |

## Issues Identified

### 1. Inconsistent Layering
- Modals use values from 60-200 with no clear hierarchy
- Some modals (z-[60]) have lower priority than overlays (z-[80])
- No distinction between modal backgrounds vs. content

### 2. Potential Conflicts
- Multiple components using z-[60] (5 instances)
- Multiple components using z-[100] (5 instances)
- Resize handles span z-[110] to z-[120] range

### 3. Missing Standards
- No clear separation between UI layers
- Arbitrary value choices (why 70 vs 80?)
- No documentation of intended layering

### 4. Extreme Values
- Tooltip uses z-[9999] - potentially overkill
- No intermediate layers for future features

## Layering Hierarchy Recommendations

Based on current usage patterns, proposed hierarchy:

```
0-49: Base content and infrastructure
50-99: Modal backgrounds and overlays
100-199: Modal content and interactive elements
200-499: Specialized overlays and features
500-899: Advanced UI elements
900-9998: Always-on-top elements
9999: Emergency override
```

## Migration Priority

### High Priority (Immediate)
- Modal system standardization
- Interactive elements (resize handles)
- Tooltip and notification layers

### Medium Priority
- Background overlays
- Infrastructure elements
- Error states

### Low Priority
- Legacy components with unique values
- Documentation updates

## Implementation Impact

### Files to Modify: 19 components
- `src/components/layout/GameModals.tsx` (remove TODO)
- `src/components/ui/` (8 modal components)
- `src/components/CharacterSheet/` (3 components)
- `src/components/Submap/` (2 components)
- `src/App.tsx` (error display)
- `src/components/ThreeDModal/`
- `src/components/dice/`
- `src/components/debug/`

### Risk Assessment
- **Low Risk**: Registry constants are compile-time safe
- **Medium Risk**: Visual layering changes during migration
- **High Risk**: Undiscovered edge cases in complex modal interactions

## Next Steps
1. Design registry structure based on this analysis
2. Create `src/styles/zIndex.ts` with hierarchical constants
3. Begin migration with high-priority components
4. Test for visual regressions and layering conflicts

## Conclusion
The analysis confirms the TODO's validity and urgency. The current system has grown organically without standards, leading to maintenance challenges and potential bugs. A centralized registry will improve code maintainability and prevent future layering conflicts.