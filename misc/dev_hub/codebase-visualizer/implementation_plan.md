# Modularize Codebase Visualizer Implementation Plan

The objective is to refactor `scripts/codebase-visualizer-server.ts` from a single monolithic file into a modularized structure under the Dev Hub ecosystem. The visualizer will be moved to a dedicated `misc/dev_hub/codebase-visualizer/` folder, separating concerns into discrete sub-components for the server API, file system parsing, HTML templates, CSS styling, and client-side JavaScript.

## Architecture & Directory Structure

We will transition the visualizer to the following directory structure:

```text
misc/dev_hub/codebase-visualizer/
├── server/
│   ├── index.ts          # Main HTTP server and request routing
│   ├── api.ts            # API handlers (/api/scan, /api/graph, /api/health)
│   ├── analyzer.ts       # Code extraction and AST/Regex parsing logic
│   ├── graphBuilder.ts   # Graph node/edge relationship generation
│   ├── sync.ts           # The headless dependency `--sync` mutation logic
│   └── types.ts          # Shared shared TypeScript interfaces
└── client/
    ├── index.html        # Main HTML shell (serving the UI)
    ├── css/
    │   └── style.css     # UI Styling (currently embedded in a template literal)
    └── js/
        ├── main.js       # Core initialization and D3 setup
        ├── rendering.js  # D3 graph simulation and node drawing
        ├── panel.js      # Sidebar UI state and Detail Panel populating
        └── api.js        # Client-side fetch wrappers for server endpoints
```

## Codebase Migration

Since the user requested that we update all 170+ references across the codebase to point to the new location instead of using proxy scripts, this migration will involve a large-scale search and replace operation.

**The Solution:** We will delete `scripts/codebase-visualizer-server.ts` and `scripts/codebase-visualizer.ts` entirely. We will then execute a repository-wide string replacement:
*   Find: `scripts/codebase-visualizer-server.ts`
*   Replace: `misc/dev_hub/codebase-visualizer/server/index.ts`
*   Find: `scripts/codebase-visualizer.ts`
*   Replace: `misc/dev_hub/codebase-visualizer/server/staticGenerator.ts`

This ensures that all agent workflows, JSDoc architectural headers, and automated checks correctly point to the new scripts.

## Detailed Component Breakdown

### 1. `server/types.ts`
Move all root interfaces into this standalone file to be shared across modules:
*   `CodeBlock`
*   `FileNode`
*   `FileEdge`
*   `GraphData`

### 2. `server/analyzer.ts`
Extract all raw text parsing and file resolution responsibilities here:
*   `extractImports(content, filePath)`
*   `resolveImportPath(importPath, currentFilePath)`
*   `extractCodeBlocks(content)`
*   `generateFileDescription(relativePath, content)`
*   `getFileCategory(relativePath)`

### 3. `server/graphBuilder.ts`
Extract the graph assembly loop from the main monolithic function:
*   `generateGraphData()`: Will traverse the `src/` directory, map files, utilize `analyzer.ts` to parse them, build connections, resolve orphan/bridge classifications, and return standard `GraphData`.

### 4. `server/sync.ts`
Extract the specific headless `--sync` command logic:
*   `syncFileDependencies(targetPath)`: Includes the JSDoc header template, calculates local import/dependent counts, labels the "Advisory Status", and safely overwrites the marker blocks. **Note:** Ensure the updated message string references the new `misc/dev_hub/...` path!

### 5. `server/api.ts`
Handle backend logic for non-page routes:
*   `/api/health`: Status check
*   `/api/shutdown`: Graceful termination
*   `/api/scan`: Runs `scripts/scan-quality.ts` via child process
*   `/api/graph`: Returns the fresh layout from `graphBuilder.ts`

### 6. `server/index.ts`
The core HTTP Server and CLI routing script:
*   Parses CLI arguments. If `args.includes('--sync')`, dispatches to `sync.ts`.
*   Spawns `http.createServer`.
*   Routes `/api/*` requests to `api.ts`.
*   Serves standard static files for `/` (index.html), `/css/*` and `/js/*` by reading from the `client/` directory and setting appropriate mime types (`text/css`, `application/javascript`, `text/html`).
*   Includes the specific `killProcessOnPort` logic to prevent EADDRINUSE errors on Windows/Linux environments when restarting.

### 7. Client UI (`client/`)
We will de-stringify the massive 1,300-line HTML generation function.
*   **`client/index.html`**: A clean, standard HTML shell linking to `style.css` and the `.js` files.
*   **`client/css/style.css`**: Extracts the massive `<style>` block.
*   **`client/js/`**: The vanilla JavaScript embedded via backticks will be split into logical chunks (`rendering.js`, `panel.js`, and `main.js`).

### 8. The Static Exporter (`server/staticGenerator.ts`)
*   Extract the static HTML generation logic currently located in **`scripts/codebase-visualizer.ts`**, which concatenates the CSS and JS files inline with the graph JSON to produce a standalone `codebase-visualization.html` document.

### 9. Update All Codebase References
Apply a global string replacement across `src/`, `.agent/`, `misc/`, and the repository root docs:
*   Replace `scripts/codebase-visualizer-server.ts` with `misc/dev_hub/codebase-visualizer/server/index.ts`
*   Replace `scripts/codebase-visualizer.ts` with `misc/dev_hub/codebase-visualizer/server/staticGenerator.ts`
*   Move `scripts/VISUALIZER_README.md` to the new folder and update its contents.
*   Delete the original scripts.

## Verification Plan

### Automated Checks
*   Run the project's standard `npm run lint` or `npm run typecheck` to ensure the modularized TypeScript components do not introduce TS compilation errors.

### Manual Verification
1.  **Headless Sync Validation**: Ensure the new path works by running `npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync src/utils/logger.ts`.
2.  **Server Integrity**: Run `npx tsx misc/dev_hub/codebase-visualizer/server/index.ts`. Ensure it boots on Port 3847 without crashing.
3.  **Static Export**: Run `npx tsx misc/dev_hub/codebase-visualizer/server/staticGenerator.ts` to confirm it still produces a fully functioning standalone HTML file.
4.  **UI Integrity**: Navigate to `http://localhost:3847`. Ensure the sidebar search, detailed panel, color mode settings (Code Quality), and the interactive D3 graph load flawlessly, validating that static assets (CSS, JS) are properly served.
5.  **Reference Verification**: Perform a git grep for `scripts/codebase-visualizer-server.ts` to guarantee zero straggling legacy references exist.

<!-- aralia-backlog-walked: {"source":"docs/tasks/backlog-retirement/RETIREMENT_LEDGER.md","path":"misc/dev_hub/codebase-visualizer/implementation_plan.md","sha256WithoutMarker":"0d0f0b3492cfe99271dddfd8f3f7504acc6001cfd674af0324a15b7be1cd078b","markedAtUtc":"2026-06-26T00:40:14.571Z"} -->
