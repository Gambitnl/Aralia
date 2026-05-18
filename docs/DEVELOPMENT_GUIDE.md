# Aralia Development Guide

**Last Updated**: 2026-05-17  
**Purpose**: Provide practical development orientation for humans and agents. This unified guide covers core commands, the boot sequence, verification rules, and common troubleshooting patterns.

## 1. Core Commands

- `npm run dev` starts the Vite dev server
- `npm run build` builds the production bundle
- `npm run preview` previews the production build
- `npm run test` runs Vitest
- `npm run test:types` runs the TSD type tests
- `npm run validate` runs data and charset validation
- `npm run typecheck` runs the TypeScript project build
- `npm run lint` runs ESLint over `src`, `scripts`, and `tests`
- `npm run verify` runs the broader verification chain

When working as an agent in this repo, prefer the workflow wrappers and session rules defined in [`../AGENTS.md`](../AGENTS.md), including `/test-ts`, dependency sync expectations, and `/session-ritual`.

---

## 2. Architecture & Directory Orientation

### Architecture Snapshot
- React 19 + TypeScript application built with Vite
- state management is anchored by `src/state/appState.ts` and the reducer/state modules under `src/state`
- UI lives primarily under `src/components/`
- reusable logic lives in `src/hooks/`
- game systems and rules logic live across `src/systems`, `src/utils`, `src/data`, and supporting service layers
- project documentation lives in `docs/`, while source-adjacent implementation docs live near the code in `src`

### Directory Layout
- `src/components/` contains major UI surfaces and component-local READMEs
- `src/data/` contains static game data and entity definitions
- `src/services/` contains external integration and persistence logic
- `src/hooks/` contains reusable game and UI orchestration hooks
- `src/state/` contains reducer-driven state management
- `docs/architecture/` contains domain-level architecture references
- `docs/guides/` contains repeatable contributor and workflow docs
- `docs/tasks/` contains active project execution material

---

## 3. Application Boot Sequence

The current high-level boot chain for the browser app is:
```text
index.html -> index.tsx -> src/App.tsx
```

### Step 1: `index.html`
- **Responsibilities**: Sets basic HTML metadata and strict Content-Security-Policy (CSP) rules, loads Google Fonts, loads the base stylesheet (`styles.css`), provides the `#root` mount node, and loads `/index.tsx` as the module entry script.
- **Details**: Uses `body.bg-gray-900`, contains a `noscript` fallback message, and enforces a strict CSP for scripts, styles, fonts, and worker connections.

### Step 2: Styling Context
The repo uses a package-managed frontend toolchain (dependencies in `package.json`).
- `index.html` loads `styles.css` from the `public/` directory
- `index.tsx` imports `./src/index.css`
- Broader styling surfaces exist under `src/styles/` and `public/css/`

### Step 3: `index.tsx`
- **Responsibilities**: Imports React, `react-dom/client`, global CSS, and the root `App` component. Finds the DOM root node and creates the React root to render `<App />` inside `React.StrictMode`.
- **Behavior**: Throws if the `#root` element is missing and uses `ReactDOM.createRoot(...)`.

### Step 4: Handoff To `App.tsx`
After bootstrap, control passes to `src/App.tsx`. That file is the right place to continue if you need app-level state orchestration, provider composition, top-level UI composition, or startup behavior beyond the raw browser entry sequence.

---

## 4. Verifying Changes

**Core Rule:** Do not claim a change is complete just because the source code looks right.

### Verification Levels
1. **Structural verification**: Use when you changed organization, docs, naming, or references. (e.g. check if links resolve or file exists). This is necessary, but not enough for behavioral claims.
2. **Behavioral verification**: Use when code behavior or data flow changed. Run the relevant unit tests (`npm run test`), type checks (`npm run typecheck`), lint (`npm run lint`), or perform targeted runtime checks.
3. **Visual verification**: Use when the task changes layout, styling, visibility, or other UI/UX behavior. Rendered output is the source of truth. Do not claim a visual fix from DOM inspection alone; verify the rendered result.

### What To Report Back
A good verification note says: what was checked, what command/method was used, what passed, what was not checked, and any residual risk.
- *Good*: "Verified the docs rewrite against the current `docs/tasks/` tree and updated the registry links. No code tests were run because no runtime behavior changed."
- *Bad*: "Verified."

If full verification is blocked, say what blocked it, what you checked instead, and what remains uncertain.

---

## 5. Troubleshooting & Known Issues

### State Management
- **Nested state immutability**: React components may not re-render if reducers mutate nested data in place. Create fresh references at every changed nesting level, especially for structures like `npcMemory`.

### Gemini Integration
- **JSON parsing cleanup**: AI responses sometimes arrive wrapped in fenced Markdown code blocks. JSON-cleaning logic exists, but do not assume `src/services/geminiService.ts` is the single place where that cleanup happens. If parsing fails, inspect the actual response-handling path that owns the feature.
- **Rate limiting**: Repeated calls can hit rate limits. Check `src/services/gemini/core.ts` and `src/config/geminiConfig.ts`.

### Rendering And Assets
- **Mannequin slot icons**: `DynamicMannequinSlotIcon.tsx` supports fallback behavior and currently defaults to fallbacks because dynamic SVG loading is disabled. Verify whether missing images are expected under the current fallback setup.
- **Submap rendering performance**: Large tile counts can cause sluggish rendering. `SubmapTile` memoization matters, and handler stability (callbacks passed into tiles) must remain memoized so `React.memo` is not defeated.

### Content Rendering
- **Markdown tables inside collapsible sections**: Markdown tables do not render reliably directly inside HTML `<details>` blocks. `GlossaryContentRenderer` handles this by parsing markdown first and constructing `<details>` wrappers programmatically. Do not reintroduce raw HTML-wrapped markdown tables.

---

## 6. Manual QA Notes & Backlog
These are intentionally left visible here because they remain open documentation tasks:
- add a cross-browser testing checklist
- add a mobile responsiveness checklist
- add a console-error cleanup checklist for core flows

Additional backlog items are tracked in [`BACKLOG.md`](./BACKLOG.md).
