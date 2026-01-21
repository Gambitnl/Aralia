# UI Styling System

This directory contains centralized styling constants and utilities for consistent UI design across the Aralia RPG application.

## Z-Index Registry (`zIndex.ts`)

### Overview
The Z-Index Registry provides a centralized system for managing UI layering across the application. It eliminates magic numbers and ensures consistent stacking order for all UI elements.

### Why Centralized Z-Index Management?

**Problems Solved:**
- **Magic Numbers**: Hardcoded values like `z-[100]` are meaningless and error-prone
- **Layering Conflicts**: Multiple components using the same z-index values
- **Maintenance Burden**: Difficult to add new layered components safely
- **Debugging Complexity**: Hard to identify stacking order issues

**Benefits:**
- **Consistency**: All components use named, documented constants
- **Maintainability**: Clear hierarchy prevents conflicts
- **Developer Experience**: Type-safe, auto-completed layer names
- **Debugging**: Easy to identify and resolve layering issues

### Layering Hierarchy

```
┌─────────────────────────────────────────────────────────────┐
│                    EMERGENCY OVERRIDE (9999)                │
│  • MAXIMUM: Nuclear option - use only when absolutely      │
│    necessary                                                │
├─────────────────────────────────────────────────────────────┤
│               ALWAYS-ON-TOP ELEMENTS (1000+)               │
│  • TOOLTIP: Contextual help and hints                      │
│  • NOTIFICATION: System alerts and messages                │
│  • DEBUG_OVERLAY: Development tools                        │
├─────────────────────────────────────────────────────────────┤
│               ADVANCED UI FEATURES (800-999)               │
│  • WINDOW_FRAME: Resizable window containers               │
│  • LOADING_TRANSITION: Loading screens and transitions     │
│  • ERROR_OVERLAY: Error notifications                      │
├─────────────────────────────────────────────────────────────┤
│              INTERACTIVE ELEMENTS (500-799)                │
│  • RESIZE_HANDLES_*: Window resize controls                │
│  • DRAG_INDICATORS: Visual drag feedback                   │
├─────────────────────────────────────────────────────────────┤
│                FEATURE OVERLAYS (300-499)                  │
│  • DICE_OVERLAY: Dice rolling animations                   │
│  • PARTY_OVERLAY: Party member indicators                  │
│  • COMBAT_OVERLAY: Combat system overlays                  │
├─────────────────────────────────────────────────────────────┤
│                   MODAL SYSTEM (100-299)                   │
│  • MODAL_BACKGROUND: Modal backdrop (blocks interaction)   │
│  • MODAL_CONTENT: Standard modal content                   │
│  • MODAL_INTERACTIVE: Modals with form inputs              │
│  • MODAL_IMMERSIVE_*: Full-screen immersive modals         │
│  • MODAL_SPECIALIZED_OVERLAY: Specialized modal overlays   │
├─────────────────────────────────────────────────────────────┤
│            BASE CONTENT & INFRASTRUCTURE (0-99)            │
│  • BASE: Default content layer                             │
│  • CONTENT: Content above base                             │
│  • SUBMAP_OVERLAY: SVG overlays on submaps                 │
└─────────────────────────────────────────────────────────────┘
```

### Usage Examples

#### Basic Usage
```tsx
import { Z_INDEX } from '../styles/zIndex';

// Modal with backdrop and content
<div className={`fixed inset-0 z-[${Z_INDEX.MODAL_BACKGROUND}]`}>
  <div className={`relative z-[${Z_INDEX.MODAL_CONTENT}]`}>
    Modal content here
  </div>
</div>
```

#### Using Utility Functions
```tsx
import { getZIndexClass, getZIndexValue, isValidZIndex } from '../styles/zIndex';

// Get complete Tailwind class
<div className={getZIndexClass('TOOLTIP')}>

// Get just the numeric value
const tooltipZIndex = getZIndexValue('TOOLTIP');

// Validate z-index values
if (isValidZIndex(someValue)) {
  // Value exists in registry
}
```

#### Type-Safe Layer Names
```tsx
import type { ZIndexLayer } from '../styles/zIndex';

function MyComponent(props: { layer: ZIndexLayer }) {
  return <div className={`z-[${Z_INDEX[props.layer]}]`} />;
}

// TypeScript will autocomplete and validate layer names
<MyComponent layer="MODAL_BACKGROUND" />; // ✅ Valid
<MyComponent layer="invalid_layer" />;   // ❌ TypeScript error
```

### Adding New Layers

1. **Choose Appropriate Range**: Select a range based on the layer type
2. **Find Available Value**: Check existing values to avoid conflicts
3. **Add to Registry**: Add the constant to the Z_INDEX object
4. **Update Documentation**: Update this README with the new layer
5. **Test**: Verify no conflicts with existing UI

```typescript
// Example: Adding a new notification type
export const Z_INDEX = {
  // ... existing layers ...
  NOTIFICATION_SUCCESS: 1110,
  NOTIFICATION_ERROR: 1120,
  // ... more layers ...
} as const;
```

### Migration Guide

#### Before (Hardcoded)
```tsx
// ❌ Don't do this
<div className="fixed inset-0 z-[100] bg-black/70">
```

#### After (Registry)
```tsx
// ✅ Do this instead
import { Z_INDEX } from '../styles/zIndex';

<div className={`fixed inset-0 z-[${Z_INDEX.MODAL_BACKGROUND}] bg-black/70`}>
```

#### Batch Migration Script
For migrating multiple files, you can use this pattern:

```bash
# Find all z-[number] patterns
grep -r "z-\[" src/components/ --include="*.tsx"

# Replace common patterns (use with caution)
sed -i 's/z-\[100\]/z-[${Z_INDEX.MODAL_BACKGROUND}]/g' file.tsx
```

### Best Practices

#### Do's ✅
- Always use registry constants instead of magic numbers
- Use template literals: `` `z-[${Z_INDEX.LAYER_NAME}]` ``
- Import only what you need: `import { Z_INDEX } from '../styles/zIndex'`
- Use utility functions for complex scenarios
- Document new layers when adding them

#### Don'ts ❌
- Don't use hardcoded numbers: `z-[100]`
- Don't create local z-index constants
- Don't use arbitrary values without checking the registry
- Don't modify existing layer values without testing
- Don't add layers without updating documentation

### Debugging Layering Issues

#### Common Problems & Solutions

**Modal Not Appearing Above Content:**
```tsx
// Check if using correct layers
<div className={`z-[${Z_INDEX.MODAL_BACKGROUND}]`}>  // ✅ 100
<div className={`z-[${Z_INDEX.CONTENT}]`}>           // ❌ 1 - Too low!
```

**Tooltip Hidden Behind Modal:**
```tsx
// Ensure tooltip is above modal system
<div className={`z-[${Z_INDEX.TOOLTIP}]`}>          // ✅ 1000
<div className={`z-[${Z_INDEX.MODAL_CONTENT}]`}>     // ❌ 110 - Too low!
```

#### Debugging Tools
```tsx
import { getZIndexDebugInfo, getLayersInRange } from '../styles/zIndex';

// Get comprehensive registry information
const debugInfo = getZIndexDebugInfo();
console.log('Available layers:', debugInfo.layerNames);

// Find layers in problematic range
const modalLayers = getLayersInRange(100, 200);
console.log('Modal system layers:', modalLayers);
```

### Testing Guidelines

#### Visual Regression Testing
- Test modal stacking with multiple modals open
- Verify tooltip positioning over various elements
- Check resize handle visibility during drag operations
- Test loading states and error overlays

#### Unit Testing
```tsx
import { Z_INDEX, isValidZIndex, getLayerByValue } from '../styles/zIndex';

describe('Z-Index Registry', () => {
  it('should have valid modal background layer', () => {
    expect(Z_INDEX.MODAL_BACKGROUND).toBe(100);
    expect(isValidZIndex(100)).toBe(true);
    expect(getLayerByValue(100)).toBe('MODAL_BACKGROUND');
  });

  it('should maintain proper layering hierarchy', () => {
    expect(Z_INDEX.BASE).toBeLessThan(Z_INDEX.CONTENT);
    expect(Z_INDEX.MODAL_BACKGROUND).toBeLessThan(Z_INDEX.TOOLTIP);
  });
});
```

### Maintenance

#### Code Reviews
- **Required**: All z-index changes must be reviewed
- **Checklist**: Verify layer choice, test for conflicts, update docs
- **Automation**: ESLint rule to flag hardcoded z-index values

#### Version Control
- Registry changes should be atomic commits
- Update dependent components in same PR
- Tag releases that modify layering system

#### Monitoring
- Watch for layering bugs in issue tracker
- Audit z-index usage quarterly
- Update registry as new UI patterns emerge

### Related Files
- `src/styles/zIndex.ts` - Main registry implementation
- `src/styles/buttonStyles.ts` - Button styling constants
- `tailwind.config.js` - Tailwind CSS configuration

### Contributing
When adding new UI components that require specific layering:
1. Check existing layers for suitability
2. Add new layer to registry if needed
3. Update this documentation
4. Test for visual regressions
5. Update component READMEs if applicable