# 2026-02-27 Roadmap Audit Corrections

Node statuses for the Roadmap (Capability-First) branch are sourced in scripts/roadmap-engine/generate.ts, specifically in ROADMAP_CAPABILITY_SOURCE_DOCS where each entry under subFeatures sets state (for example Roadmap > Interaction UX > Canvas Pan Drag Navigation is currently state: 'active'), then generateRoadmapData() converts that to node status via 
ormalizeState(sub.state) and emits IDs like sub_pillar_dev_tools_roadmap_capability_first_interaction_ux_canvas_pan_drag_navigation; the runtime chain is scripts/roadmap-server-logic.ts generateRoadmapData() -> unBridge('generate-roadmap') -> scripts/roadmap-local-bridge.ts -> scripts/roadmap-engine/generate.ts generateRoadmapData(), so to update one status you edit that node's state in ROADMAP_CAPABILITY_SOURCE_DOCS and reload the roadmap/API response, with no dev-server restart required because bridge calls spawn 
px tsx per request.

## 2026-02-28 Task 2 Status Corrections

- Updated roadmap node status source data in scripts/roadmap-engine/generate.ts (ROADMAP_CAPABILITY_SOURCE_DOCS -> subFeatures).
- Changed all Task 2 listed nodes from state: 'active' to state: 'done'.
- Scope was data-only status correction for roadmap node state entries.

## 2026-02-28 Task 4 Status Corrections (Audit-Verified)

Applied 7 additional active→done corrections confirmed by Codex code audit:

- Roadmap > Layout Persistence > Layout Restore On Load (RoadmapVisualizer.tsx:363, vite.config.ts:545)
- Roadmap > Layout Persistence > Reset Node Position Overrides (RoadmapVisualizer.tsx:858)
- Roadmap > Node Test Execution Capability > Node Test Status Persistence (node-test-status.ts:38)
- Roadmap > Roadmap API Surface Capability > Opportunities Settings Endpoint (vite.config.ts:699)
- Roadmap > Documentation Intelligence > One-Doc Orchestrated Processing Pipeline (roadmap-orchestrate-one-doc.ts:224)
- Roadmap > Documentation Intelligence > Feature Taxonomy Integrity (text.ts:74)
- Roadmap > Strategic Opportunity Mapping > Opportunity Snapshot Persistence (storage.ts, scanner.ts:186)

Nodes confirmed no-change (already correct): Panel Scroll Without Canvas Zoom, Related Docs Type Indicators, Opportunity Public Facade Module.
Nodes confirmed planned (no change needed): Historical Development Traceability, Multi-product Portfolio Branching, Filters And Sorts.
