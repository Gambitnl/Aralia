# Task 1C: Version Display & Package.json Fix

**Created**: November 30, 2025
**Status**: Ready to implement
**Priority**: High (blocks proper versioning workflow)
**Estimated Effort**: 1-2 hours
**Target Version After Completion**: 0.4.0

---

## Objective

Fix package.json versioning and add version display to game UI so players and developers can see the current game version.

---

## Current State Problems

1. **package.json name includes version** (wrong):
   ```json
   "name": "aralia-rpg-v0.3.21-(village)"
   ```

2. **package.json version is incorrect**:
   ```json
   "version": "0.0.0"
   ```

3. **No version display in UI** - players/developers can't see what version they're running

---

## Required Changes

### 1. Fix package.json

**File**: `package.json`

**Change**:
```json
{
  "name": "aralia-rpg",           // ← Clean name, no version
  "version": "0.4.0",              // ← Actual version (bumped for doc system)
  // ... rest stays same
}
```

**Rationale**:
- Name should NOT include version (standard practice)
- Version field is the source of truth
- Bumping to 0.4.0 because documentation lifecycle system is a minor feature addition

---

### 2. Create Version Display Component

**File**: `src/components/VersionDisplay.tsx` (new file)

**Implementation**:
```tsx
import packageInfo from '../../package.json'

interface VersionDisplayProps {
  position?: 'main-menu' | 'game-screen'
}

export const VersionDisplay: React.FC<VersionDisplayProps> = ({
  position = 'game-screen'
}) => {
  const version = packageInfo.version

  const styles = {
    'main-menu': 'bottom-left-menu',
    'game-screen': 'top-left-subtle'
  }

  return (
    <div className={`version-display ${styles[position]}`}>
      v{version}
    </div>
  )
}
```

**CSS** (add to appropriate stylesheet):
```css
.version-display {
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.5);
  font-family: monospace;
  pointer-events: none;
  user-select: none;
}

.top-left-subtle {
  position: fixed;
  top: 8px;
  left: 8px;
  z-index: 1000;
}

.bottom-left-menu {
  position: absolute;
  bottom: 8px;
  left: 8px;
}
```

---

### 3. Add to Main Menu

**File**: `src/components/MainMenu.tsx` (or equivalent)

**Add**:
```tsx
import { VersionDisplay } from './VersionDisplay'

// Inside render:
<VersionDisplay position="main-menu" />
```

---

### 4. Add to Main Game Screen

**File**: `src/App.tsx` or main game container

**Add**:
```tsx
import { VersionDisplay } from './VersionDisplay'

// Inside render (when in PLAYING phase):
{gamePhase === GamePhase.PLAYING && (
  <VersionDisplay position="game-screen" />
)}
```

---

## Acceptance Criteria

- [ ] package.json name is `"aralia-rpg"` (no version)
- [ ] package.json version is `"0.4.0"`
- [ ] Version display appears on main menu (bottom-left)
- [ ] Version display appears on main game screen (top-left)
- [ ] Version reads from package.json (single source of truth)
- [ ] Text is subtle, non-intrusive (small, semi-transparent)
- [ ] Version format is `v0.4.0` (lowercase v, SemVer)
- [ ] TypeScript compiles without errors
- [ ] No console errors when displaying version

---

## Testing Steps

1. **Verify package.json**:
   ```bash
   cat package.json | grep -A1 '"name"'
   cat package.json | grep -A1 '"version"'
   ```
   Should show:
   ```
   "name": "aralia-rpg",
   "version": "0.4.0",
   ```

2. **Test in browser**:
   - Start game: `npm run dev`
   - Check main menu → version shows in bottom-left
   - Start game → version shows in top-left
   - Verify format: `v0.4.0`

3. **Test build**:
   ```bash
   npm run build
   npm run preview
   ```
   - Version still displays correctly in production build

---

## Dependencies

**None** - can be implemented immediately

---

## Files to Create/Modify

**Create**:
- `src/components/VersionDisplay.tsx`

**Modify**:
- `package.json` (name and version fields)
- Main menu component (add VersionDisplay)
- Main game screen component (add VersionDisplay)
- Appropriate CSS file (add version-display styles)

---

## Notes for Implementer

### TypeScript Import Issue

If you get a TypeScript error importing package.json, add to `tsconfig.json`:

```json
{
  "compilerOptions": {
    "resolveJsonModule": true,
    // ... other options
  }
}
```

### Alternative: Environment Variable

If package.json import doesn't work, use Vite env variable:

**vite.config.ts**:
```ts
import { defineConfig } from 'vite'
import packageJson from './package.json'

export default defineConfig({
  define: {
    '__APP_VERSION__': JSON.stringify(packageJson.version)
  }
})
```

**src/vite-env.d.ts**:
```ts
declare const __APP_VERSION__: string
```

**VersionDisplay.tsx**:
```tsx
const version = __APP_VERSION__
```

### Styling Considerations

- Make it SUBTLE - shouldn't distract from gameplay
- Use monospace font for technical feel
- Semi-transparent (50% opacity suggested)
- Small size (0.75rem or smaller)
- Non-interactive (pointer-events: none)

---

## Version Bumping Rationale

**Why 0.4.0?**

Starting from implied 0.3.21, bumping to 0.4.0 because:
- **Minor version bump** (0.3.x → 0.4.0)
- Added significant feature: Documentation lifecycle system (1A, 1B)
- This is the first "properly versioned" release
- Sets baseline for future version planning

**Next versions**:
- Completing this task → stays at 0.4.0 (this IS the 0.4.0 release)
- Small fixes after this → 0.4.1, 0.4.2, etc. (patches)
- Next feature/phase → 0.5.0 (minor)

---

## Future Enhancements (Out of Scope)

- Click version to show changelog
- Show build date/time
- Show commit hash (for dev builds)
- Show "Alpha" / "Beta" label
- Tooltip with more details

These can be added later as needed.

---

## Related Tasks

- **1D**: Create AGENT-README.md (depends on this task for version reference)
- **1E**: Add version planning to task template
- **1F**: Version sizing review agent (concept/roadmap item)

---

**Ready to implement!**

Assign to an agent or implement directly. Should take 1-2 hours including testing.
