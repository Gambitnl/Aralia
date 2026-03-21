# Aralia Code Walkthrough

**Last Updated**: 2026-03-11  
**Purpose**: Explain the current frontend boot sequence from `index.html` into `index.tsx`, without carrying forward the older import-map and CDN assumptions that no longer match the repo.

## Scope Of This File

This walkthrough currently covers the app bootstrap surface:
- `index.html`
- `index.tsx`

It does not attempt to document the full React component tree. Treat it as an entry walkthrough, not a complete application map.

## Entry Flow

```text
index.html
  ->
index.tsx
  ->
src/App.tsx
```

This is the current high-level boot chain for the browser app.

## Step 1: `index.html`

`index.html` is still the browser entry document.

Current responsibilities:
- set basic HTML metadata
- load the Google Fonts used by the app shell
- provide the `#root` mount node
- load `/index.tsx` as the module entry script

Important current details:
- the document still uses `body.bg-gray-900`
- the `noscript` fallback message is still present
- the root mount point is still `<div id="root"></div>`

## Step 2: Styling Context

Older versions of this walkthrough described a Tailwind CDN script and an ES-module import-map setup.

That is no longer an accurate description of the repo.

Current reality:
- the repo uses a package-managed frontend toolchain
- frontend dependencies are declared in [`package.json`](../package.json)
- `index.tsx` imports `./src/index.css`
- the repo also contains broader styling surfaces under `src/styles/` and `public/css/`

Do not use this file as evidence that the app still boots from CDN-loaded Tailwind or browser import maps.

## Step 3: `index.tsx`

`index.tsx` is still the React bootstrap file.

Current responsibilities:
- import React
- import `react-dom/client`
- import global CSS from `./src/index.css`
- import the root `App` component from `./src/App`
- find the DOM root node
- create the React root and render `<App />` inside `React.StrictMode`

Important current behavior:
- the file throws if the `#root` element is missing
- it still uses `ReactDOM.createRoot(...)`
- it still wraps the app in `React.StrictMode`

## Step 4: Handoff To `App.tsx`

After bootstrap, control passes to [`src/App.tsx`](../src/App.tsx).

That file is the right place to continue if you need:
- app-level state orchestration
- provider composition
- top-level UI composition
- startup behavior beyond the raw browser entry sequence

## Historical Drift Note

This file used to describe:
- Tailwind loaded from a CDN script
- an `importmap` resolving packages from `esm.sh`
- a broader walkthrough tone that implied the full component tree was covered

Those older assumptions are preserved here only as a warning not to rely on them. They should not be treated as current architecture facts.

## Related Docs

- [`@PROJECT-OVERVIEW.README.md`](./@PROJECT-OVERVIEW.README.md) for the current high-level project summary
- [`ARCHITECTURE.md`](./ARCHITECTURE.md) for subsystem-level orientation
- [`DEVELOPMENT_GUIDE.md`](./DEVELOPMENT_GUIDE.md) for day-to-day development workflow
