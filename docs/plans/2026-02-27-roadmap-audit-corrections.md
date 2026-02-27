# 2026-02-27 Roadmap Audit Corrections

Node statuses for the Roadmap (Capability-First) branch are sourced in scripts/roadmap-engine/generate.ts, specifically in ROADMAP_CAPABILITY_SOURCE_DOCS where each entry under subFeatures sets state (for example Roadmap > Interaction UX > Canvas Pan Drag Navigation is currently state: 'active'), then generateRoadmapData() converts that to node status via 
ormalizeState(sub.state) and emits IDs like sub_pillar_dev_tools_roadmap_capability_first_interaction_ux_canvas_pan_drag_navigation; the runtime chain is scripts/roadmap-server-logic.ts generateRoadmapData() -> unBridge('generate-roadmap') -> scripts/roadmap-local-bridge.ts -> scripts/roadmap-engine/generate.ts generateRoadmapData(), so to update one status you edit that node's state in ROADMAP_CAPABILITY_SOURCE_DOCS and reload the roadmap/API response, with no dev-server restart required because bridge calls spawn 
px tsx per request.
