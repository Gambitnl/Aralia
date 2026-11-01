# Tailwind CSS v4 Upgrade Evaluation

Date: 2026-10-25
Status: Decided (No-Go / Parked)
Ref: agora-9d53.9 (H9)

## Context

Aralia's core build and runtime stack is current (React 19.2, Vite 7.3, TypeScript 5.9, Vitest 4, ESLint 9, Playwright 1.57). The principal framework dependency with an available major release upgrade is Tailwind CSS (`tailwindcss ^3.4.17` vs. Tailwind v4).

Task `agora-9d53.9` requested an architectural evaluation with a go/no-go recommendation and estimated blast radius.

## Findings

1. **Usage Footprint Across the Codebase**:
   - Total TS/TSX files in `src/`: 5,089 files.
   - Files with inline `className` usage: 438 files spanning core game screens, Character Creator & Sheet, BattleMap overlays, Atlas, Worldforge, DevTools, Dialogue, Crafting, and Design Preview harnesses.
   - Central stylesheet: `src/index.css` defines base fonts, custom Design Preview overlay guards, and `@layer components` utility abstractions (`.btn`, `.btn-primary`, `.btn-green`, `.btn-yellow`).
   - Configuration: `tailwind.config.js` defines an extensive dark-mode color scheme (`primary: #EAB308`, `background-dark: #0B0E14`, `sidebar-dark: #11141D`, `card-dark: #161B22`, `border-dark: #21262D`, `gray-850`) and custom keyframe animations (`bounce-subtle`, `pulseInspectHighlight`).
   - PostCSS: `postcss.config.js` runs `tailwindcss` and `autoprefixer`.
   - Plugins: `@tailwindcss/typography ^0.5.16`.

2. **Tailwind v4 Architectural Changes & Breaking Shifts**:
   - **CSS-First Configuration**: Tailwind v4 deprecates `tailwind.config.js` in favor of in-CSS `@theme` blocks and CSS custom properties (`@import "tailwindcss";`, `@theme { --color-primary: #EAB308; }`).
   - **Vite Integration**: Replaces PostCSS setup with the dedicated `@tailwindcss/vite` plugin.
   - **Default Border Color Change**: In Tailwind v3, the default border color is `gray-200` (`#e5e7eb`). In Tailwind v4, the default border color changes to `currentColor`. In a predominantly dark UI like Aralia (`#0B0E14` backgrounds with white text), any component using `border` or `border-t` without an explicit color modifier would immediately shift from subtle dark-gray to bright white text color, causing visual glare and contrast breakage across numerous screens.
   - **Component Layer & `@apply` Semantics**: In v4, `@layer components` is replaced by `@utility` directives; complex `@apply` rules chained with pseudo-variants (`hover:`, `disabled:`, `focus:`) in `index.css` require restructuring.
   - **Plugin Model**: `@tailwindcss/typography` requires loading via CSS `@plugin` rather than JS `require(...)`.

3. **Blast Radius Analysis**:
   - **Build Configuration**: Low risk. Vite plugin replacement is straightforward.
   - **Visual Consistency & Regression**: **HIGH RISK**. With 438 consuming component files and no unified automated pixel-diff snapshot test suite across all 16+ phase screens and Design Preview steps, visual regressions in border colors, ring opacities, and typography margins would require extensive manual inspection across hundreds of surfaces.
   - **Performance / Feature ROI**: Low. Tailwind v3.4 under Vite HMR builds in milliseconds. Tailwind v4 does not unlock essential missing gameplay or architectural capability for Aralia.

## Decision: NO-GO (Parked)

Do not upgrade to Tailwind CSS v4 at this time. Retain `tailwindcss ^3.4.17`.

### Prerequisites for Any Future Reconsideration

Before initiating a v4 migration in a future wave:
1. Establish automated Playwright visual golden baselines for primary UI surfaces (Character Creator, Character Sheet, BattleMap, Atlas, Town 3D, and Design Preview steps).
2. Explicitly audit all 438 component files for uncolored `border` utilities to prevent `currentColor` contrast breakage under dark mode.
3. Migrate custom theme colors and keyframes from `tailwind.config.js` to standalone CSS variables as an incremental precursor step.
