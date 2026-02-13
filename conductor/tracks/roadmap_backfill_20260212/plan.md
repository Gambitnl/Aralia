# Implementation Plan: Roadmap Chronicles

## Phase 1: Data Infrastructure & Extraction
- [x] Task: Research and script true creation dates for all historical .md files using `git log`. [b40d203]
- [x] Task: Generate exhaustive `roadmap.json` by synthesizing `docs/@DOC-REGISTRY.md` and project sub-directories. [b40d203]
- [x] Task: Implement `roadmap-api` endpoint in Vite dev server to serve the dynamically aggregated data (merging static history with live Conductor metadata). [b40d203]
- [x] Task: Conductor - User Manual Verification 'Data Infrastructure' (Protocol in workflow.md) [b40d203]

## Phase 2: Engine Enhancement (Layouts & Taxonomy)
- [x] Task: Implement "Layout Engine" logic for Timeline, Categorical, and Spiral algorithms.
- [x] Task: Create "Visual Taxonomy" system (dynamic colors, icons, and status shading based on domain).
- [x] Task: Implement UI Selectors for Layout and Taxonomy in the Roadmap header.
- [~] Task: Conductor - User Manual Verification 'Layout Engine' (Protocol in workflow.md)

## Phase 3: High-Granularity & Performance
- [x] Task: Implement "Drill-down" sub-view component for Milestone nodes.
- [x] Task: Optimize SVG layer with "Chunked Rendering" to support 500+ nodes without lag.
- [x] Task: Implement "Navigation Mode" selector (Zoom Clustering, Historical Fog).
- [~] Task: Conductor - User Manual Verification 'Performance & Drill-down' (Protocol in workflow.md)

## Phase 4: Persistence & Polish
- [x] Task: Implement "Save Layout" logic to persist manual node placements.
- [x] Task: Final visual polish (animations, arcane glow effects, deep-link routing).
- [x] Task: Conductor - User Manual Verification 'Final Polish' (Protocol in workflow.md)
