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
- `npm run sync-check` runs the fast ordinary-push safety check
- `npm run quality:debt` summarizes broad type/lint debt without failing
- `npm run quality:debt:strict` runs the same summary and fails on typecheck or lint command failure
- `npm run verify` runs the broader verification chain

When working as an agent in this repo, prefer the workflow wrappers and session rules defined in [`../AGENTS.md`](../AGENTS.md), including `/test-ts`, dependency sync expectations, and `/session-ritual`.

### Push Checks And Type Debt

Aralia's pre-push policy is intentionally split between **sync blockers** and **visible debt**.

- Sync blockers are problems that mean Git or the session cannot safely publish work, such as unresolved merge conflicts, committed conflict markers, critical JSON syntax failures, or a missing intent gate.
- Visible debt includes broad `npm run typecheck` and `npm run lint` findings. Ordinary pushes do not run the full backlog anymore; use `npm run quality:debt` when you want a summarized report.
- Review or cleanup sessions can opt into strict behavior with `ARALIA_PRE_PUSH_STRICT=1 git push`, which runs the debt summary and makes typecheck or lint failure blocking for that push.

The tracked policy script is [`../scripts/git/pre-push-aralia.sh`](../scripts/git/pre-push-aralia.sh). Local `.git/hooks/pre-push` should delegate to that file instead of keeping hidden hook logic that future agents cannot inspect.

Install or refresh the local hook with:
```bash
npm run hooks:install
```

Use these push modes:
- Ordinary sync: `git push` (runs `npm run sync-check`)
- Strict review or cleanup push: `ARALIA_PRE_PUSH_STRICT=1 git push`
- Emergency bypass when Git hooks themselves are the blocker: `git push --no-verify`

This policy does **not** mean TypeScript or lint warnings are unimportant. It means broad repo debt should not turn every sync into a whole-project cleanup session. Use targeted verification for the files and behavior touched by the current task, and reserve full strict cleanup for sessions whose explicit purpose is type or lint debt.

### CI Status

GitHub CI still has blocking PR jobs for typecheck/build, lint, and tests in [`.github/workflows/ci.yml`](../.github/workflows/ci.yml). This pass only changes local ordinary-push behavior. CI policy should be reviewed separately before changing required PR gates.

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

## 6. Manual QA Checklists

Use these checklists when a change affects a user-facing flow. They are intentionally
practical rather than exhaustive, so agents can run the relevant pass without turning
every feature task into a full QA project.

### Cross-Browser Checklist

- Verify the primary flow in the current Chrome or Chromium-based browser.
- Spot-check the same flow in Firefox or Edge when the change touches layout, input,
  focus, storage, canvas, audio, media, or browser APIs.
- Confirm there are no browser-specific console errors during load, the main action,
  and return/navigation out of the flow.
- Check that fonts, icons, images, canvas layers, and scroll containers render
  consistently enough that the player can complete the task.
- Record any browser-specific limitation in the owning project proof or gap file
  instead of leaving it as an untracked note.

### Mobile Responsiveness Checklist

- Check the flow at a narrow phone viewport and a tablet-width viewport.
- Confirm primary buttons, form controls, modal close controls, and navigation targets
  are reachable without hover-only interactions.
- Confirm text wraps inside its container and does not overlap controls, counters,
  panels, tooltips, or map overlays.
- Confirm scroll ownership is clear: the page, modal, side panel, and any nested list
  should not fight for the same gesture.
- If a surface is intentionally desktop-only, record that boundary in the owning
  project docs and provide a clear fallback or disabled state.

### Console-Error Cleanup Checklist

- Start from a fresh page load and clear the browser console before the target flow.
- Exercise the main happy path, one back/cancel path, and one invalid or edge input
  path when the flow has forms or selections.
- Treat red console errors, failed asset loads, repeated proxy noise, and unhandled
  promise rejections as findings unless the owning project already documents them.
- Separate harmless known environmental noise from product errors in the proof note.
- If the error cannot be fixed in the current slice, add a routed gap with the console
  text, reproduction path, and suspected owner.

Backlog-style work belongs in the owning project gap registry under [`docs/projects/`](./projects/) or in [`GLOBAL_GAPS.md`](./projects/GLOBAL_GAPS.md) when no owner exists yet.

<!-- aralia-backlog-walked: {"source":"docs/tasks/backlog-retirement/RETIREMENT_LEDGER.md","path":"docs/DEVELOPMENT_GUIDE.md","sha256WithoutMarker":"dc35a147a8930a1524da3bb14679ab29d0aa010ae9395e3e12aa17ed01305598","markedAtUtc":"2026-06-26T00:12:35.440Z"} -->
