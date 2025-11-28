# CRITICAL BUG REPORT: Submap Rendering Failure
**Date Discovered:** 2025-11-28 17:09 CET  
**Severity:** 🔴 **CRITICAL** - Game-breaking  
**Status:** �� Active in Production  
**Affects:** https://gambitnl.github.io/Aralia/

---

## 🚨 Bug Description

**Error Message:**
```
TypeError: Cannot read properties of undefined (reading 'canvas')
```

**Component Stack:**
```
at h7 (SubmapPane minified)
Component: SubmapRendererPixi.tsx
```

**Trigger:** Clicking the "Submap" button to view local terrain details

**Impact:** **Complete submap feature unavailable** - players cannot:
- View local terrain
- Inspect tiles
- Navigate locally
- See village layouts

---

## 🔍 Root Cause Analysis

**File:** `src/components/SubmapRendererPixi.tsx`  
**Line:** 202

**Problematic Code:**
```typescript
canvasRef.current.appendChild(app.view as HTMLCanvasElement);
```

**Issue:** `app.view` is **undefined** when PixiJS application initializes.

**Likely Causes:**
1. **PixiJS v8 API Change** - In PixiJS v8, `app.view` was replaced with `app.canvas`
2. **Version Mismatch** - Production build may have different PixiJS version than dev
3. **Async Initialization** - `app.view` not ready when code executes

---

## ✅ RECOMMENDED FIX

### Option 1: Update for PixiJS v8 (Recommended)

```typescript
// Line 202 - BEFORE
canvasRef.current.appendChild(app.view as HTMLCanvasElement);

// Line 202 - AFTER (PixiJS v8)
canvasRef.current.appendChild(app.canvas);
```

### Option 2: Add Null Check (Safeguard)

```typescript
// Line 194-203 - Enhanced with safety checks
if (canvasRef.current && !appRef.current) {
  const app = new PIXI.Application({
    width: dimensions.cols * TILE_SIZE,
    height: dimensions.rows * TILE_SIZE,
    background: '#0b0b0b',
    antialias: true,
  });
  
  appRef.current = app;
  
  // Wait for view to be ready
  if (app.view || app.canvas) {
    const canvas = (app.view || app.canvas) as HTMLCanvasElement;
    if (canvas) {
      canvasRef.current.appendChild(canvas);
    } else {
      console.error('PixiJS canvas not available');
    }
  }
}
```

### Option 3: Use Async Initialization

```typescript
if (canvasRef.current && !appRef.current) {
  (async () => {
    const app = new PIXI.Application();
    await app.init({
      width: dimensions.cols * TILE_SIZE,
      height: dimensions.rows * TILE_SIZE,
      background: '#0b0b0b',
      antialias: true,
    });
    appRef.current = app;
    canvasRef.current?.appendChild(app.canvas);
  })();
}
```

---

## 📝 VERIFICATION NEEDED

1. **Check PixiJS Version:**
   ```bash
   npm list pixi.js
   ```
   - If v7.x → Use `app.view`
   - If v8.x → Use `app.canvas`

2. **Check Import Map** (build tool-less setup):
   ```html
   <!-- In index.html -->
   <script type="importmap">
     {
       "imports": {
         "pixi.js": "https://cdn.jsdelivr.net/npm/pixi.js@8.x/..."
       }
     }
   </script>
   ```

3. **Test Locally:**
   - Start dev server
   - Click "Submap" button
   - Verify rendering works

---

## 🔄 DEPLOYMENT STEPS

1. **Apply Fix** to `src/components/SubmapRendererPixi.tsx`
2. **Test Locally** - Verify submap renders
3. **Build for Production** - `npm run build` (if applicable)
4. **Deploy** - Push to GitHub Pages
5. **Verify** - Test at https://gambitnl.github.io/Aralia/

---

## 📊 IMPACT ASSESSMENT

| Component | Status | Notes |
|-----------|--------|-------|
| **Main Game** | ✅ Working | Core gameplay unaffected |
| **Submap** | 🔴 BROKEN | Complete feature failure |
| **Villages** | 🔴 BROKEN | Cannot view village layouts |
| **Tile Inspection** | 🔴 BROKEN | Depends on submap |
| **Quick Travel** | 🔴 BROKEN | Depends on submap |
| **Character Creation** | ✅ Working | Verified with Point Buy UI |
| **Battle System** | ⚠️ Unknown | May use similar canvas logic |

**Users Affected:** 100% of players attempting to use submap feature

---

## 🎯 PRIORITY

**Severity:** P0 - Critical  
**Urgency:** Immediate  
**Complexity:** Low (1-line fix likely)  
**Risk:** Low (isolated to submap rendering)

**Recommended Timeline:** Fix within 24 hours

---

## 📚 RELATED ISSUES

- **FEATURES_TODO.md** items #3, #5 (Village generation bugs) - CANNOT TEST until this is fixed
- **Point Buy UI** (Improvement #08) - Verified working, unaffected
- **v1.1 Bug Audit** - This bug not in original list (NEW discovery)

---

*Bug discovered during documentation audit manual testing*  
*Reported: 2025-11-28 17:09 CET*  
*Reporter: User testing + Antigravity analysis*
