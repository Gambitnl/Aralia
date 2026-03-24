# Reset Node Positions Dock Button Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Move the "Reset Node Positions" button from the collapsible toolbar menu into the permanent bottom dock, placed after "Reset View" and separated by a visual divider.

**Architecture:** Pure DOM restructuring in `RoadmapVisualizer.tsx` — remove one `<button>` from the menu, add a divider + new `<button>` to the bottom dock. No new state, props, or functions.

**Tech Stack:** React, Tailwind CSS

---

### Task 1: Remove button from toolbar menu

**Files:**
- Modify: `devtools/roadmap/src/components/debug/roadmap/RoadmapVisualizer.tsx:2039`

**Step 1: Delete the menu button**

Find and remove this line (line ~2039):

```tsx
<button type="button" onClick={resetNodePositions} className={`rounded-lg px-4 py-2 text-xs font-semibold border backdrop-blur-md transition-colors ${glassButtonClass(isDark)}`}>Reset Node Positions</button>
```

**Step 2: Verify the file still compiles**

Run: `cd devtools/roadmap && npx tsc --noEmit`
Expected: no errors

**Step 3: Commit**

```bash
git add devtools/roadmap/src/components/debug/roadmap/RoadmapVisualizer.tsx
git commit -m "refactor(roadmap): remove Reset Node Positions from toolbar menu"
```

---

### Task 2: Add divider + Reset Node Positions button to bottom dock

**Files:**
- Modify: `devtools/roadmap/src/components/debug/roadmap/RoadmapVisualizer.tsx:3557–3569`

**Step 1: Insert divider and new button after the "Reset View" button**

Find this block (lines ~3557–3569):

```tsx
          {/* Shrink the reset button copy on compact screens so the dock stays narrow
              while still exposing one obvious escape hatch back to the default view. */}
          <button
            type="button"
            onClick={resetView}
            className={`min-h-10 rounded-full border px-4 text-sm font-semibold transition-colors ${
              isDark
                ? 'border-slate-700/70 bg-slate-900/45 text-slate-100 hover:bg-slate-800/75'
                : 'border-slate-300/90 bg-white/55 text-slate-700 hover:bg-slate-100/90'
            } ${isCompactViewport ? 'min-w-[84px]' : 'min-w-[112px]'}`}
          >
            {isCompactViewport ? 'Reset' : 'Reset View'}
          </button>
```

Replace with:

```tsx
          {/* Shrink the reset button copy on compact screens so the dock stays narrow
              while still exposing one obvious escape hatch back to the default view. */}
          <div className={`h-5 w-px ${isDark ? 'bg-slate-700/80' : 'bg-slate-300/90'}`} />
          <button
            type="button"
            onClick={resetView}
            className={`min-h-10 rounded-full border px-4 text-sm font-semibold transition-colors ${
              isDark
                ? 'border-slate-700/70 bg-slate-900/45 text-slate-100 hover:bg-slate-800/75'
                : 'border-slate-300/90 bg-white/55 text-slate-700 hover:bg-slate-100/90'
            } ${isCompactViewport ? 'min-w-[84px]' : 'min-w-[112px]'}`}
          >
            {isCompactViewport ? 'Reset' : 'Reset View'}
          </button>
          <button
            type="button"
            onClick={resetNodePositions}
            className={`min-h-10 rounded-full border px-4 text-sm font-semibold transition-colors ${
              isDark
                ? 'border-slate-700/70 bg-slate-900/45 text-slate-100 hover:bg-slate-800/75'
                : 'border-slate-300/90 bg-white/55 text-slate-700 hover:bg-slate-100/90'
            } ${isCompactViewport ? 'min-w-[84px]' : 'min-w-[140px]'}`}
          >
            {isCompactViewport ? 'Node Pos' : 'Reset Node Positions'}
          </button>
```

**Step 2: Verify the file still compiles**

Run: `cd devtools/roadmap && npx tsc --noEmit`
Expected: no errors

**Step 3: Commit**

```bash
git add devtools/roadmap/src/components/debug/roadmap/RoadmapVisualizer.tsx
git commit -m "feat(roadmap): add Reset Node Positions button to bottom dock"
```

---

### Task 3: Visual verification

**Step 1: Open the roadmap in the browser and confirm:**
- Bottom dock shows: `[ - | + ]  |  Reset View  |  Reset Node Positions`
- Clicking "Reset Node Positions" resets node positions (same behaviour as the old menu button)
- The old menu no longer contains a "Reset Node Positions" button
- On a narrow viewport, labels read "Reset" and "Node Pos"
