import { relaxNodeCollisions } from './collision';
import { DOMAIN_COLORS, NODE_CATEGORIES, ROOT_X, ROOT_Y } from './constants';
import { buildFeaturesByGroup } from './feature-mapping';
import type { FeatureBucket, ProcessingDocument } from './generation-types';
import { RoadmapNodeIdRegistry } from './id-validation';
import { loadProcessingDocs } from './manifest';
import { resolveNodeTestDefinition } from './node-test-definitions';
import { loadNodeTestResults } from './node-test-status';
import { inferPillarForFeature } from './pillar-inference';
import { MAIN_PILLARS, type MainPillarId } from './pillars';
import { normalizeState, slug, summarizeDocs, toFeatureDrivenSubfeatureName } from './text';
import type { RoadmapEdge, RoadmapNode } from './types';

/**
 * This file builds the roadmap graph payload that powers the roadmap visualizer screen.
 *
 * It exists so the UI can show one consistent "feature tree" even when the source data
 * comes from different places (processed docs plus synthetic dev-tool branches).
 * In this pass, the generator also injects first-class Dev Tools branches for
 * "Race Portrait Image Generation" and "Race Enrichment Pipeline" so those systems are tracked
 * like real capabilities instead of ad-hoc notes.
 *
 * Called by: scripts/roadmap-server-logic.ts -> vite roadmap API (/api/roadmap/data)
 * Depends on: roadmap-engine manifest loading, text normalization, pillar inference, collision relaxer
 */

// ============================================================================
// Generator Toggles
// ============================================================================
// This section holds top-level knobs that change how much of the tree is emitted.
// Keeping these here makes roadmap shaping easier to reason about during debugging.
// ============================================================================
const EMPTY = { version: '2.1.0', root: 'aralia_chronicles', nodes: [] as RoadmapNode[], edges: [] as RoadmapEdge[] };
const PRIME_NODES_ONLY_VIEW = false;

// ============================================================================
// Curated Subfeature Allowlist
// ============================================================================
// This allowlist prevents generic workflow prose from becoming roadmap nodes.
// Only capability-shaped labels that we explicitly trust are allowed through.
// ============================================================================
const CURATED_SUBFEATURES: Record<string, Set<string>> = {
  '3d exploration & combat': new Set([
    '3D Exploration & Combat',
    'World Map > Visuals',
    'World Map > Navigation',
    'World Map > Submap Continuity',
    'World Map > Generation & Determinism',
    'World Map > Visuals > Continuous World Map View - No Visible Tile Grid',
    'World Map > Visuals > Azgaar Layer Controls > Political Borders (Toggleable)',
    'World Map > Navigation > Travel Precision Overlay Controls',
    'World Map > Generation & Determinism > Azgaar World Generation Backbone'
  ]),
  'roadmap': new Set([
    'Roadmap',
    'Roadmap > Visualization Stability',
    'Roadmap > Visualization Stability > Connector Rendering Reliability',
    'Roadmap > Interaction UX',
    'Roadmap > Interaction UX > Panel Scroll Without Canvas Zoom',
    'Roadmap > Interaction UX > Related Docs Type Indicators',
    'Roadmap > Layout Persistence',
    'Roadmap > Layout Persistence > Auto-Save and Manual Save Clarity',
    'Roadmap > Documentation Intelligence',
    // Legacy wording "Incremental Document Ingestion" was replaced with an orchestration-first
    // capability name so the roadmap reflects what the system does, not just process cadence.
    'Roadmap > Documentation Intelligence > One-Doc Orchestrated Processing Pipeline',
    'Roadmap > Documentation Intelligence > One-Doc Orchestrated Processing Pipeline > Worker Packet Validation Gate',
    'Roadmap > Documentation Intelligence > One-Doc Orchestrated Processing Pipeline > Feature-Oriented Naming Guard',
    'Roadmap > Documentation Intelligence > Feature Taxonomy Integrity',
    'Roadmap > Strategic Opportunity Mapping',
    'Roadmap > Strategic Opportunity Mapping > Opportunity Collection',
    'Roadmap > Strategic Opportunity Mapping > Opportunity Scan Orchestration',
    'Roadmap > Strategic Opportunity Mapping > Opportunity Flag Classification',
    'Roadmap > Strategic Opportunity Mapping > Opportunity Propagation and Rollup',
    'Roadmap > Strategic Opportunity Mapping > Opportunity Snapshot Persistence',
    'Roadmap > Strategic Opportunity Mapping > Opportunity Scan Trigger',
    'Roadmap > Strategic Opportunity Mapping > Opportunity Triage Panel',
    'Roadmap > Strategic Opportunity Mapping > Opportunity-to-Node Navigation',
    'Roadmap > Strategic Opportunity Mapping > Opportunity Crosslink Detection',
    'Roadmap > Strategic Opportunity Mapping > Opportunity Module Architecture',
    'Roadmap > Strategic Opportunity Mapping > Opportunity Module Architecture > Opportunity Public Facade Module',
    'Roadmap > Strategic Opportunity Mapping > Opportunity Module Architecture > Opportunity Type Contracts Module',
    'Roadmap > Strategic Opportunity Mapping > Opportunity Module Architecture > Opportunity Graph Context Module',
    'Roadmap > Strategic Opportunity Mapping > Opportunity Module Architecture > Opportunity Scanner Module',
    'Roadmap > Strategic Opportunity Mapping > Opportunity Module Architecture > Opportunity Flag Classifier Module',
    'Roadmap > Strategic Opportunity Mapping > Opportunity Module Architecture > Opportunity Propagation Module',
    'Roadmap > Strategic Opportunity Mapping > Opportunity Module Architecture > Opportunity Crosslink Resolver Module',
    'Roadmap > Strategic Opportunity Mapping > Opportunity Module Architecture > Opportunity Storage And Sanitization Module',
    'Roadmap > Strategic Opportunity Mapping > Opportunity Filters and Sorts',
    'Roadmap > Strategic Opportunity Mapping > Historical Development Traceability',
    'Roadmap > Strategic Opportunity Mapping > Multi-Product Portfolio Branching (Future)'
  ]),
  'race portrait image generation': new Set([
    'Race Portrait Image Generation',
    'Race Portrait Image Generation > Gemini Session Control',
    'Race Portrait Image Generation > Gemini Session Control > CDP Endpoint Health Check',
    'Race Portrait Image Generation > Gemini Session Control > Gemini Tab Targeting',
    'Race Portrait Image Generation > Gemini Session Control > Consent Interstitial Handling',
    'Race Portrait Image Generation > Gemini Session Control > Per Generation Chat Reset',
    'Race Portrait Image Generation > Gemini Session Control > New Chat Confirmation Check',
    'Race Portrait Image Generation > Gemini Session Control > Single Active Run Lock',
    'Race Portrait Image Generation > Prompt Construction Engine',
    'Race Portrait Image Generation > Prompt Construction Engine > Base Prompt Template Management',
    'Race Portrait Image Generation > Prompt Construction Engine > Race Override Registry',
    'Race Portrait Image Generation > Prompt Construction Engine > Gender Variant Prompting',
    'Race Portrait Image Generation > Prompt Construction Engine > Positive Constraint Rules',
    'Race Portrait Image Generation > Prompt Construction Engine > Slice of Life Activity Allocator',
    'Race Portrait Image Generation > Prompt Construction Engine > Activity Uniqueness Normalization',
    'Race Portrait Image Generation > Prompt Construction Engine > Prompt Hash Tracking',
    'Race Portrait Image Generation > Execution Reliability',
    'Race Portrait Image Generation > Execution Reliability > Single Session Concurrency Guard',
    'Race Portrait Image Generation > Execution Reliability > Download Fallback Pipeline',
    'Race Portrait Image Generation > Execution Reliability > Retryable Failure Classification',
    'Race Portrait Image Generation > Execution Reliability > Timeout and Cooldown Policy',
    'Race Portrait Image Generation > Execution Reliability > Resume From Last Completed Item',
    'Race Portrait Image Generation > Execution Reliability > Bad Request Recovery Path',
    'Race Portrait Image Generation > Execution Reliability > Download Artifact Recovery',
    'Race Portrait Image Generation > Quality Gates',
    'Race Portrait Image Generation > Quality Gates > Square Output Enforcement',
    'Race Portrait Image Generation > Quality Gates > Blank Margin Rejection',
    'Race Portrait Image Generation > Quality Gates > Image Decode Validation',
    'Race Portrait Image Generation > Quality Gates > Full Body Framing Check',
    'Race Portrait Image Generation > Quality Gates > Duplicate Byte Hash Rejection',
    'Race Portrait Image Generation > Quality Gates > Arrow Artifact Rejection',
    'Race Portrait Image Generation > Quality Gates > Borderless Full Bleed Validation',
    'Race Portrait Image Generation > Post Generation Verification',
    'Race Portrait Image Generation > Post Generation Verification > Slice of Life Ledger Tracking',
    'Race Portrait Image Generation > Post Generation Verification > In App Race Image Sync Validation',
    'Race Portrait Image Generation > Post Generation Verification > CC Glossary Path Parity Audit',
    'Race Portrait Image Generation > Post Generation Verification > Slice of Life Completeness Audit',
    'Race Portrait Image Generation > Post Generation Verification > Duplicate Activity Keeper Decisioning',
    'Race Portrait Image Generation > Post Generation Verification > Manual Approval Capture',
    'Race Portrait Image Generation > Post Generation Verification > Verification Evidence Logging',
    'Race Portrait Image Generation > Backlog Regeneration Orchestration',
    'Race Portrait Image Generation > Backlog Regeneration Orchestration > Category Agnostic Backlog Processing',
    'Race Portrait Image Generation > Backlog Regeneration Orchestration > Backlog Parsing and Filtering',
    'Race Portrait Image Generation > Backlog Regeneration Orchestration > Targeted Race Gender Runs',
    'Race Portrait Image Generation > Backlog Regeneration Orchestration > Status Append Per Generation',
    'Race Portrait Image Generation > Backlog Regeneration Orchestration > Runbook Auto Update Hooks',
    'Race Portrait Image Generation > Backlog Regeneration Orchestration > Post Run Audit Pipeline',
    'Race Portrait Image Generation > Future Capability Expansion',
    'Race Portrait Image Generation > Future Capability Expansion > Fail Fast Branch Test Orchestration',
    'Race Portrait Image Generation > Future Capability Expansion > Node Test Definition Registry',
    'Race Portrait Image Generation > Future Capability Expansion > Fail Fast Branch Test Executor',
    'Race Portrait Image Generation > Future Capability Expansion > Test Log Retention Policy',
    'Race Portrait Image Generation > Future Capability Expansion > Roadmap Node Test Badges'
  ]),
  'race enrichment pipeline': new Set([
    'Race Enrichment Pipeline',
    'Race Enrichment Pipeline > Deep Research Collection',
    'Race Enrichment Pipeline > Deep Research Collection > Gemini Deep Research Mode Control',
    'Race Enrichment Pipeline > Output Normalization',
    'Race Enrichment Pipeline > Output Normalization > No Source Citations or URLs in Output',
    'Race Enrichment Pipeline > Content Curation',
    'Race Enrichment Pipeline > Content Curation > Wiki-Style Narrative Output',
    'Race Enrichment Pipeline > Game Data Integration',
    'Race Enrichment Pipeline > Game Data Integration > Glossary Detailed Race Lore Profiles',
    'Race Enrichment Pipeline > Image Generation Support',
    'Race Enrichment Pipeline > Image Generation Support > Race Likelihood Guidance for Activities',
    'Race Enrichment Pipeline > Planned Enhancements',
    'Race Enrichment Pipeline > Planned Enhancements > Automated Promotion Gate to Game Data'
  ])
};

// ============================================================================
// Curated Subfeature Detail Registry
// ============================================================================
// Each entry provides a plain-English explanation and evidence links shown in detail view.
// This is where we keep roadmap nodes tied to concrete scripts/docs instead of vague prose.
// ============================================================================
const CURATED_SUBFEATURE_DETAILS: Record<string, { layman: string; canonicalDocs: string[] }> = {
  '3D Exploration & Combat': {
    layman: 'Top-level branch for 3D traversal and combat work under World Exploration.',
    canonicalDocs: [
      'docs/tasks/3d-exploration/feature-capabilities/3d-exploration-combat/INDEX.md'
    ]
  },
  'World Map > Visuals': {
    layman: 'Map appearance and readability controls.',
    canonicalDocs: [
      'docs/tasks/3d-exploration/feature-capabilities/world-map/visuals/INDEX.md'
    ]
  },
  'World Map > Visuals > Azgaar Layer Controls > Political Borders (Toggleable)': {
    layman: 'Azgaar political border/state overlays are available as optional visual layers and are not forced always-on.',
    canonicalDocs: [
      'docs/tasks/3d-exploration/feature-capabilities/world-map/visuals/azgaar-layer-controls-political-borders-toggleable.md'
    ]
  },
  'World Map > Navigation': {
    layman: 'World-map movement controls and precision travel interaction.',
    canonicalDocs: [
      'docs/tasks/3d-exploration/feature-capabilities/world-map/navigation/INDEX.md'
    ]
  },
  'World Map > Navigation > Travel Precision Overlay Controls': {
    layman: 'Navigation overlays are available for precise movement and route clarity. Default behavior remains pending playtest with real cell visuals.',
    canonicalDocs: [
      'docs/tasks/3d-exploration/feature-capabilities/world-map/navigation/travel-precision-overlay-controls.md'
    ]
  },
  'World Map > Submap Continuity': {
    layman: 'Contracts that keep world-map and submap behavior coherent.',
    canonicalDocs: [
      'docs/tasks/3d-exploration/feature-capabilities/world-map/submap-continuity/INDEX.md'
    ]
  },
  'World Map > Generation & Determinism': {
    layman: 'World-generation source rules and deterministic behavior guarantees.',
    canonicalDocs: [
      'docs/tasks/3d-exploration/feature-capabilities/world-map/generation-determinism/INDEX.md'
    ]
  },
  'World Map > Generation & Determinism > Azgaar World Generation Backbone': {
    layman: 'World map data is generated using Azgaar as the primary engine, not a long-term simplified fallback.',
    canonicalDocs: [
      'docs/tasks/3d-exploration/feature-capabilities/world-map/generation-determinism/azgaar-world-generation-backbone.md'
    ]
  },
  'World Map > Visuals > Continuous World Map View - No Visible Tile Grid': {
    layman: 'World map looks like one connected map image, not a visible square tile grid.',
    canonicalDocs: [
      'docs/tasks/3d-exploration/feature-capabilities/world-map/visuals/continuous-world-map-view-no-visible-tile-grid.md'
    ]
  },
  'Roadmap': {
    layman: 'Internal roadmap tooling branch that tracks roadmap feature development itself.',
    canonicalDocs: [
      'docs/tasks/roadmap/1C-ROADMAP-IMPLEMENTATION-PLAN.md'
    ]
  },
  'Roadmap > Visualization Stability': {
    layman: 'Visual reliability work so roadmap links, branch geometry, and graph readability remain stable while expanding/collapsing.',
    canonicalDocs: [
      'docs/tasks/roadmap/1C-ROADMAP-IMPLEMENTATION-PLAN.md'
    ]
  },
  'Roadmap > Visualization Stability > Connector Rendering Reliability': {
    layman: 'Hardens connector drawing for edge cases like near-flat paths and filter-related visibility failures.',
    canonicalDocs: [
      'src/components/debug/roadmap/utils.ts',
      'src/components/debug/roadmap/graph.ts',
      'src/components/debug/roadmap/RoadmapVisualizer.tsx'
    ]
  },
  'Roadmap > Interaction UX': {
    layman: 'Player/operator interaction quality for canvas drag, zoom, and panel behavior.',
    canonicalDocs: [
      'src/components/debug/roadmap/RoadmapVisualizer.tsx'
    ]
  },
  'Roadmap > Interaction UX > Panel Scroll Without Canvas Zoom': {
    layman: 'Scrolling inside the details panel should not also zoom the canvas in the background.',
    canonicalDocs: [
      'src/components/debug/roadmap/RoadmapVisualizer.tsx'
    ]
  },
  'Roadmap > Interaction UX > Canvas Pan Drag Navigation': {
    layman: 'Dragging the roadmap background pans the canvas so users can navigate large node graphs.',
    canonicalDocs: [
      'src/components/debug/roadmap/RoadmapVisualizer.tsx'
    ]
  },
  'Roadmap > Interaction UX > Wheel Zoom Around Cursor': {
    layman: 'Mouse wheel zoom is centered around pointer position instead of fixed viewport center.',
    canonicalDocs: [
      'src/components/debug/roadmap/RoadmapVisualizer.tsx'
    ]
  },
  'Roadmap > Interaction UX > Node Drag Repositioning': {
    layman: 'Individual nodes and visible branches can be dragged to custom positions.',
    canonicalDocs: [
      'src/components/debug/roadmap/RoadmapVisualizer.tsx'
    ]
  },
  'Roadmap > Interaction UX > Single Node Expand Collapse': {
    layman: 'Clicking an expandable node toggles only that node branch.',
    canonicalDocs: [
      'src/components/debug/roadmap/RoadmapVisualizer.tsx'
    ]
  },
  'Roadmap > Interaction UX > Expand All And Collapse All Controls': {
    layman: 'Global controls open or close all expandable roadmap branches at once.',
    canonicalDocs: [
      'src/components/debug/roadmap/RoadmapVisualizer.tsx'
    ]
  },
  'Roadmap > Interaction UX > View Reset Control': {
    layman: 'Reset view returns canvas pan and zoom to default framing without altering node placements.',
    canonicalDocs: [
      'src/components/debug/roadmap/RoadmapVisualizer.tsx'
    ]
  },
  'Roadmap > Interaction UX > Node Detail Drawer': {
    layman: 'Selecting a node opens a contextual side drawer with status, docs, and actions.',
    canonicalDocs: [
      'src/components/debug/roadmap/RoadmapVisualizer.tsx'
    ]
  },
  'Roadmap > Interaction UX > Open Related Docs In VS Code': {
    layman: 'Node detail action posts to local bridge endpoint to open docs directly in VS Code.',
    canonicalDocs: [
      'src/components/debug/roadmap/RoadmapVisualizer.tsx',
      'vite.config.ts'
    ]
  },
  'Roadmap > Interaction UX > Related Docs Type Indicators': {
    layman: 'Related docs list shows compact file-type badges so markdown/code/config files are instantly recognizable before opening.',
    canonicalDocs: [
      'src/components/debug/roadmap/RoadmapVisualizer.tsx'
    ]
  },
  'Roadmap > Layout Persistence': {
    layman: 'Node positions and layout behaviors are saved and restored predictably across sessions.',
    canonicalDocs: [
      'docs/tasks/roadmap/1B-ROADMAP-VISUALIZER-EVOLUTION-HANDOVER.md',
      'docs/tasks/roadmap/1C-ROADMAP-IMPLEMENTATION-PLAN.md'
    ]
  },
  'Roadmap > Layout Persistence > Auto-Save and Manual Save Clarity': {
    layman: 'Clarifies and hardens manual save vs auto-save behavior so layout state is obvious and reliable.',
    canonicalDocs: [
      'src/components/debug/roadmap/RoadmapVisualizer.tsx'
    ]
  },
  'Roadmap > Layout Persistence > Layout Restore On Load': {
    layman: 'Saved node positions are loaded when roadmap opens so user layout survives sessions.',
    canonicalDocs: [
      'src/components/debug/roadmap/RoadmapVisualizer.tsx',
      'vite.config.ts'
    ]
  },
  'Roadmap > Layout Persistence > Auto-save Debounce Cycle': {
    layman: 'Rapid drag updates are batched through debounce before writing layout to storage.',
    canonicalDocs: [
      'src/components/debug/roadmap/RoadmapVisualizer.tsx'
    ]
  },
  'Roadmap > Layout Persistence > Manual Save Trigger': {
    layman: 'Explicit save action persists current node offsets immediately.',
    canonicalDocs: [
      'src/components/debug/roadmap/RoadmapVisualizer.tsx'
    ]
  },
  'Roadmap > Layout Persistence > Reset Node Position Overrides': {
    layman: 'Reset layout clears manual offsets and returns nodes to computed positions.',
    canonicalDocs: [
      'src/components/debug/roadmap/RoadmapVisualizer.tsx'
    ]
  },
  'Roadmap > Node Test Execution Capability': {
    layman: 'Capability for running node-scoped checks directly from the roadmap detail drawer.',
    canonicalDocs: [
      'src/components/debug/roadmap/RoadmapVisualizer.tsx',
      'vite.config.ts',
      'scripts/roadmap-node-test.ts'
    ]
  },
  'Roadmap > Node Test Execution Capability > Run Node Test (Self Plus Descendants)': {
    layman: 'Runs selected node plus descendant runnable test set in one action.',
    canonicalDocs: [
      'src/components/debug/roadmap/RoadmapVisualizer.tsx'
    ]
  },
  'Roadmap > Node Test Execution Capability > Run Child Node Tests (Descendants Only)': {
    layman: 'Runs only descendant runnable tests without including selected node self checks.',
    canonicalDocs: [
      'src/components/debug/roadmap/RoadmapVisualizer.tsx'
    ]
  },
  'Roadmap > Node Test Execution Capability > Node Test Result Status Feedback': {
    layman: 'UI shows pass/fail summary and first failure details after each run.',
    canonicalDocs: [
      'src/components/debug/roadmap/RoadmapVisualizer.tsx'
    ]
  },
  'Roadmap > Node Test Execution Capability > Node Test Status Persistence': {
    layman: 'Latest node test outcomes persist into local roadmap status store for later sessions.',
    canonicalDocs: [
      'scripts/roadmap-engine/node-test-status.ts'
    ]
  },
  'Roadmap > Node Test Execution Capability > Node Test Data Refresh After Run': {
    layman: 'After execution, roadmap data reloads so badges/status reflect updated test metadata.',
    canonicalDocs: [
      'src/components/debug/roadmap/RoadmapVisualizer.tsx'
    ]
  },
  'Roadmap > Roadmap API Surface Capability': {
    layman: 'Dev-server roadmap endpoints that power visualizer data, layout, tests, opportunities, and editor actions.',
    canonicalDocs: [
      'vite.config.ts',
      'scripts/roadmap-server-logic.ts'
    ]
  },
  'Roadmap > Roadmap API Surface Capability > Roadmap Data Endpoint': {
    layman: 'Serves generated roadmap graph payload used by the UI.',
    canonicalDocs: [
      'vite.config.ts',
      'scripts/roadmap-server-logic.ts'
    ]
  },
  'Roadmap > Roadmap API Surface Capability > Layout Endpoint (Read Write)': {
    layman: 'Provides layout load/save endpoint for roadmap position persistence.',
    canonicalDocs: [
      'vite.config.ts'
    ]
  },
  'Roadmap > Roadmap API Surface Capability > Node Test Run Endpoint': {
    layman: 'Accepts node ids and executes roadmap node tests through local runner.',
    canonicalDocs: [
      'vite.config.ts',
      'scripts/roadmap-node-test.ts'
    ]
  },
  'Roadmap > Roadmap API Surface Capability > Opportunities Latest Endpoint': {
    layman: 'Returns latest opportunities payload for collector drawer and summary badges.',
    canonicalDocs: [
      'vite.config.ts',
      'scripts/roadmap-server-logic.ts'
    ]
  },
  'Roadmap > Roadmap API Surface Capability > Opportunities Scan Endpoint': {
    layman: 'Triggers on-demand opportunity scan and returns refreshed payload.',
    canonicalDocs: [
      'vite.config.ts',
      'scripts/roadmap-server-logic.ts'
    ]
  },
  'Roadmap > Roadmap API Surface Capability > Opportunities Settings Endpoint': {
    layman: 'Reads and writes roadmap opportunity scanner settings.',
    canonicalDocs: [
      'vite.config.ts',
      'scripts/roadmap-server-logic.ts'
    ]
  },
  'Roadmap > Roadmap API Surface Capability > VS Code Open Endpoint': {
    layman: 'Local endpoint opens selected doc paths in VS Code from roadmap UI.',
    canonicalDocs: [
      'vite.config.ts'
    ]
  },
  'Roadmap > Documentation Intelligence': {
    layman: 'Capability for feature-focused document understanding and roadmap derivation from verified docs.',
    canonicalDocs: [
      'docs/tasks/roadmap/1B-ROADMAP-VISUALIZER-EVOLUTION-HANDOVER.md',
      'docs/tasks/roadmap/1C-ROADMAP-IMPLEMENTATION-PLAN.md'
    ]
  },
  'Roadmap > Documentation Intelligence > One-Doc Orchestrated Processing Pipeline': {
    layman: 'Runs one document at a time through a strict worker packet flow instead of bulk ingestion, so updates stay auditable and reviewable.',
    canonicalDocs: [
      'docs/tasks/roadmap/1D-ROADMAP-ORCHESTRATION-CONTRACT.md',
      'scripts/roadmap-orchestrate-one-doc.ts'
    ]
  },
  'Roadmap > Documentation Intelligence > One-Doc Orchestrated Processing Pipeline > Worker Packet Validation Gate': {
    layman: 'Every completed worker packet must pass schema validation before it can be reviewed or applied.',
    canonicalDocs: [
      'scripts/roadmap-packet-validation.ts',
      'scripts/roadmap-validate-packet.ts',
      'docs/tasks/roadmap/schemas/run_manifest.schema.json',
      'docs/tasks/roadmap/schemas/report.schema.json',
      'docs/tasks/roadmap/schemas/move_plan.schema.json'
    ]
  },
  'Roadmap > Documentation Intelligence > One-Doc Orchestrated Processing Pipeline > Feature-Oriented Naming Guard': {
    layman: 'Generic process labels are rejected so emitted roadmap nodes stay capability-focused.',
    canonicalDocs: [
      'scripts/roadmap-orchestrate-one-doc.ts',
      'scripts/roadmap-engine/text.ts'
    ]
  },
  'Roadmap > Documentation Intelligence > Feature Taxonomy Integrity': {
    layman: 'Capability that enforces quality checks to prevent generic nodes and keep feature/subfeature naming consistent.',
    canonicalDocs: [
      'docs/tasks/roadmap/1C-ROADMAP-IMPLEMENTATION-PLAN.md',
      'scripts/roadmap-engine/text.ts',
      'scripts/roadmap-orchestrate-one-doc.ts'
    ]
  },
  'Roadmap > Strategic Opportunity Mapping': {
    layman: 'Collector capability for finding, ranking, and navigating roadmap opportunities without mixing ownership of the actual fixes.',
    canonicalDocs: [
      'docs/tasks/roadmap/1C-ROADMAP-IMPLEMENTATION-PLAN.md',
      'scripts/roadmap-engine/opportunities.ts',
      'src/components/debug/roadmap/RoadmapVisualizer.tsx'
    ]
  },
  'Roadmap > Strategic Opportunity Mapping > Opportunity Collection': {
    layman: 'Node collector surface that lists flagged roadmap nodes and keeps triage focused.',
    canonicalDocs: [
      'scripts/roadmap-engine/opportunities.ts',
      'src/components/debug/roadmap/RoadmapVisualizer.tsx'
    ]
  },
  'Roadmap > Strategic Opportunity Mapping > Opportunity Scan Orchestration': {
    layman: 'Runs deterministic scans over roadmap nodes to detect known opportunity patterns.',
    canonicalDocs: [
      'scripts/roadmap-engine/opportunities/scanner.ts',
      'scripts/roadmap-engine/opportunities/graph.ts',
      'vite.config.ts'
    ]
  },
  'Roadmap > Strategic Opportunity Mapping > Opportunity Flag Classification': {
    layman: 'Classifies opportunities into fixed flag families so results stay consistent and sortable.',
    canonicalDocs: [
      'scripts/roadmap-engine/opportunities/flag-classifier.ts'
    ]
  },
  'Roadmap > Strategic Opportunity Mapping > Opportunity Propagation and Rollup': {
    layman: 'Builds parent-level rollups from descendant flags so branch health can be seen at a glance.',
    canonicalDocs: [
      'scripts/roadmap-engine/opportunities/propagation.ts',
      'src/components/debug/roadmap/RoadmapVisualizer.tsx'
    ]
  },
  'Roadmap > Strategic Opportunity Mapping > Opportunity Snapshot Persistence': {
    layman: 'Persists local scan snapshots and logs so trend history survives across sessions.',
    canonicalDocs: [
      'scripts/roadmap-engine/opportunities/storage.ts',
      '.agent/roadmap-local/opportunities'
    ]
  },
  'Roadmap > Strategic Opportunity Mapping > Opportunity Scan Trigger': {
    layman: 'Supports both periodic background scans and explicit user-triggered scans.',
    canonicalDocs: [
      'src/components/debug/roadmap/RoadmapVisualizer.tsx',
      'vite.config.ts'
    ]
  },
  'Roadmap > Strategic Opportunity Mapping > Opportunity Triage Panel': {
    layman: 'Dedicated roadmap drawer for opportunity triage, mode toggles, and quick scan controls.',
    canonicalDocs: [
      'src/components/debug/roadmap/RoadmapVisualizer.tsx'
    ]
  },
  'Roadmap > Strategic Opportunity Mapping > Opportunity-to-Node Navigation': {
    layman: 'Clicking an opportunity centers and selects the target roadmap node.',
    canonicalDocs: [
      'src/components/debug/roadmap/RoadmapVisualizer.tsx'
    ]
  },
  'Roadmap > Strategic Opportunity Mapping > Opportunity Crosslink Detection': {
    layman: 'Detects cross-branch documentation overlap and suggests missing owner crosslinks.',
    canonicalDocs: [
      'scripts/roadmap-engine/opportunities/crosslink-resolver.ts'
    ]
  },
  'Roadmap > Strategic Opportunity Mapping > Opportunity Module Architecture': {
    layman: 'Dedicated child branch that groups the opportunity engine module implementation nodes under one architecture-focused cluster.',
    canonicalDocs: [
      'scripts/roadmap-engine/opportunities.ts',
      'scripts/roadmap-engine/opportunities/scanner.ts'
    ]
  },
  'Roadmap > Strategic Opportunity Mapping > Opportunity Module Architecture > Opportunity Public Facade Module': {
    layman: 'Stable public export surface so callers can import opportunities without deep-path coupling.',
    canonicalDocs: [
      'scripts/roadmap-engine/opportunities.ts',
      'scripts/roadmap-engine/opportunities/facade.test.ts'
    ]
  },
  'Roadmap > Strategic Opportunity Mapping > Opportunity Module Architecture > Opportunity Type Contracts Module': {
    layman: 'Shared type contracts and fixed flag vocabulary used by all opportunities modules.',
    canonicalDocs: [
      'scripts/roadmap-engine/opportunities/types.ts',
      'scripts/roadmap-engine/opportunities/types.test.ts'
    ]
  },
  'Roadmap > Strategic Opportunity Mapping > Opportunity Module Architecture > Opportunity Graph Context Module': {
    layman: 'Tree and edge context helpers used by scanner passes to derive ancestry/descendants and ownership.',
    canonicalDocs: [
      'scripts/roadmap-engine/opportunities/graph.ts',
      'scripts/roadmap-engine/opportunities/graph.test.ts'
    ]
  },
  'Roadmap > Strategic Opportunity Mapping > Opportunity Module Architecture > Opportunity Scanner Module': {
    layman: 'End-to-end scanner orchestration that runs classification, propagation, and persistence.',
    canonicalDocs: [
      'scripts/roadmap-engine/opportunities/scanner.ts',
      'scripts/roadmap-engine/opportunities/scanner.test.ts'
    ]
  },
  'Roadmap > Strategic Opportunity Mapping > Opportunity Module Architecture > Opportunity Flag Classifier Module': {
    layman: 'Direct node-level flag assignment rules for tests/docs/staleness/crosslinks.',
    canonicalDocs: [
      'scripts/roadmap-engine/opportunities/flag-classifier.ts',
      'scripts/roadmap-engine/opportunities/flag-classifier.test.ts'
    ]
  },
  'Roadmap > Strategic Opportunity Mapping > Opportunity Module Architecture > Opportunity Propagation Module': {
    layman: 'Parent rollup logic and summary counters for propagated descendant flags.',
    canonicalDocs: [
      'scripts/roadmap-engine/opportunities/propagation.ts',
      'scripts/roadmap-engine/opportunities/propagation.test.ts'
    ]
  },
  'Roadmap > Strategic Opportunity Mapping > Opportunity Module Architecture > Opportunity Crosslink Resolver Module': {
    layman: 'Cross-branch overlap matcher that suggests missing sequence ownership links.',
    canonicalDocs: [
      'scripts/roadmap-engine/opportunities/crosslink-resolver.ts',
      'scripts/roadmap-engine/opportunities/crosslink-resolver.test.ts'
    ]
  },
  'Roadmap > Strategic Opportunity Mapping > Opportunity Module Architecture > Opportunity Storage And Sanitization Module': {
    layman: 'Local storage persistence and sanitization layer for settings, snapshots, logs, and latest payload.',
    canonicalDocs: [
      'scripts/roadmap-engine/opportunities/storage.ts',
      'scripts/roadmap-engine/opportunities/storage.test.ts'
    ]
  },
  'Roadmap > Strategic Opportunity Mapping > Opportunity Filters and Sorts': {
    layman: 'Planned enrichment for deeper filtering/sorting views across large flagged-node sets.',
    canonicalDocs: [
      'docs/tasks/roadmap/1C-ROADMAP-IMPLEMENTATION-PLAN.md'
    ]
  },
  'Roadmap > Strategic Opportunity Mapping > Historical Development Traceability': {
    layman: 'Capability to reconstruct older roadmap context from commit history when historical traceability is needed.',
    canonicalDocs: [
      'docs/tasks/roadmap/1C-ROADMAP-IMPLEMENTATION-PLAN.md'
    ]
  },
  'Roadmap > Strategic Opportunity Mapping > Multi-Product Portfolio Branching (Future)': {
    layman: 'Future capability for multiple product roadmaps under one trunk, kept planned until current workflow stabilizes.',
    canonicalDocs: [
      'docs/tasks/roadmap/1C-ROADMAP-IMPLEMENTATION-PLAN.md'
    ]
  },
  'Race Portrait Image Generation': {
    layman: 'Main dev-tool branch for generating and regenerating race images with Gemini automation.',
    canonicalDocs: [
      'docs/portraits/race_portrait_regen_handoff.md'
    ]
  },
  'Race Portrait Image Generation > Gemini Session Control': {
    layman: 'Controls browser session safety so each generation starts in a clean Gemini chat state.',
    canonicalDocs: [
      'scripts/workflows/gemini/core/image-gen-mcp.ts',
      'scripts/workflows/gemini/image-gen/launch-debug-chrome.js'
    ]
  },
  'Race Portrait Image Generation > Gemini Session Control > Per Generation Chat Reset': {
    layman: 'Forces a new chat before each generation to reduce repeated outputs and context bleed.',
    canonicalDocs: [
      'scripts/workflows/gemini/core/image-gen-mcp.ts',
      'scripts/workflows/gemini/image-gen/regenerate-race-images-from-backlog.ts'
    ]
  },
  'Race Portrait Image Generation > Gemini Session Control > CDP Endpoint Health Check': {
    layman: 'Validates CDP connectivity before runs so automation fails early with useful diagnostics.',
    canonicalDocs: [
      'scripts/workflows/gemini/core/image-gen-mcp.ts'
    ]
  },
  'Race Portrait Image Generation > Gemini Session Control > Gemini Tab Targeting': {
    layman: 'Finds and focuses the active Gemini tab/context so send and download actions hit the right page.',
    canonicalDocs: [
      'scripts/workflows/gemini/core/image-gen-mcp.ts'
    ]
  },
  'Race Portrait Image Generation > Gemini Session Control > Consent Interstitial Handling': {
    layman: 'Detects and resolves Google consent interstitials that block prompt submission.',
    canonicalDocs: [
      'scripts/workflows/gemini/core/image-gen-mcp.ts'
    ]
  },
  'Race Portrait Image Generation > Gemini Session Control > New Chat Confirmation Check': {
    layman: 'Confirms new chat state before sending prompts to reduce repeated-output bleed.',
    canonicalDocs: [
      'scripts/workflows/gemini/core/image-gen-mcp.ts',
      'scripts/workflows/gemini/image-gen/regenerate-race-images-from-backlog.ts'
    ]
  },
  'Race Portrait Image Generation > Gemini Session Control > Single Active Run Lock': {
    layman: 'Planned lock guard to block concurrent regen scripts from controlling the same browser session.',
    canonicalDocs: [
      'docs/portraits/race_portrait_regen_handoff.md'
    ]
  },
  'Race Portrait Image Generation > Prompt Construction Engine': {
    layman: 'Defines how prompts are shaped so outputs match slice-of-life and composition criteria.',
    canonicalDocs: [
      'scripts/workflows/gemini/image-gen/regenerate-race-images-from-backlog.ts'
    ]
  },
  'Race Portrait Image Generation > Prompt Construction Engine > Positive Constraint Rules': {
    layman: 'Uses direct desired outcomes instead of negative-heavy prompts to improve model compliance.',
    canonicalDocs: [
      'scripts/workflows/gemini/image-gen/regenerate-race-images-from-backlog.ts',
      'docs/portraits/race_portrait_regen_handoff.md'
    ]
  },
  'Race Portrait Image Generation > Prompt Construction Engine > Slice of Life Activity Allocator': {
    layman: 'Assigns clear daily-life activities so each race/gender pair reads as grounded, non-combat life.',
    canonicalDocs: [
      'scripts/workflows/gemini/image-gen/regenerate-race-images-from-backlog.ts',
      'scripts/audits/list-slice-of-life-settings.ts'
    ]
  },
  'Race Portrait Image Generation > Prompt Construction Engine > Base Prompt Template Management': {
    layman: 'Maintains the reusable base prompt structure used across backlog generations.',
    canonicalDocs: [
      'scripts/workflows/gemini/image-gen/regenerate-race-images-from-backlog.ts'
    ]
  },
  'Race Portrait Image Generation > Prompt Construction Engine > Race Override Registry': {
    layman: 'Stores targeted race-specific prompt overrides for known failure patterns.',
    canonicalDocs: [
      'scripts/workflows/gemini/image-gen/regenerate-race-images-from-backlog.ts'
    ]
  },
  'Race Portrait Image Generation > Prompt Construction Engine > Gender Variant Prompting': {
    layman: 'Applies deterministic male/female prompt variants while preserving shared race constraints.',
    canonicalDocs: [
      'scripts/workflows/gemini/image-gen/regenerate-race-images-from-backlog.ts'
    ]
  },
  'Race Portrait Image Generation > Prompt Construction Engine > Activity Uniqueness Normalization': {
    layman: 'Normalizes activity wording so near-duplicates are detected and avoided in ledger assignment.',
    canonicalDocs: [
      'scripts/audits/list-slice-of-life-settings.ts'
    ]
  },
  'Race Portrait Image Generation > Prompt Construction Engine > Prompt Hash Tracking': {
    layman: 'Planned prompt-hash indexing to correlate outputs with exact prompt revisions.',
    canonicalDocs: [
      'docs/portraits/race_portrait_regen_handoff.md'
    ]
  },
  'Race Portrait Image Generation > Execution Reliability': {
    layman: 'Hardens long image batches against flaky browser automation and intermittent provider failures.',
    canonicalDocs: [
      'scripts/workflows/gemini/core/image-gen-mcp.ts',
      'scripts/workflows/gemini/image-gen/regenerate-race-images-from-backlog.ts'
    ]
  },
  'Race Portrait Image Generation > Execution Reliability > Single Session Concurrency Guard': {
    layman: 'Prevents two scripts from controlling the same browser at once by running batches sequentially.',
    canonicalDocs: [
      'scripts/workflows/gemini/image-gen/regenerate-race-images-from-backlog.ts',
      'docs/portraits/race_portrait_regen_handoff.md'
    ]
  },
  'Race Portrait Image Generation > Execution Reliability > Download Fallback Pipeline': {
    layman: 'If normal download fails, fallback strategies try alternate URLs and capture to avoid hard-stop failures.',
    canonicalDocs: [
      'scripts/workflows/gemini/core/image-gen-mcp.ts',
      'docs/portraits/race_portrait_regen_handoff.md'
    ]
  },
  'Race Portrait Image Generation > Execution Reliability > Retryable Failure Classification': {
    layman: 'Classifies transient failures as retryable so long runs continue without manual intervention.',
    canonicalDocs: [
      'scripts/workflows/gemini/image-gen/regenerate-race-images-from-backlog.ts'
    ]
  },
  'Race Portrait Image Generation > Execution Reliability > Timeout and Cooldown Policy': {
    layman: 'Applies generation timeout windows and cooldown intervals to reduce model-side flakiness.',
    canonicalDocs: [
      'scripts/workflows/gemini/image-gen/regenerate-race-images-from-backlog.ts'
    ]
  },
  'Race Portrait Image Generation > Execution Reliability > Resume From Last Completed Item': {
    layman: 'Supports continuation from latest written status/timestamp so interrupted runs can resume.',
    canonicalDocs: [
      'scripts/workflows/gemini/image-gen/regenerate-race-images-from-backlog.ts',
      'public/assets/images/races/race-image-status.json'
    ]
  },
  'Race Portrait Image Generation > Execution Reliability > Bad Request Recovery Path': {
    layman: 'Handles intermittent bad-request downloader failures with fallback and retry paths.',
    canonicalDocs: [
      'scripts/workflows/gemini/core/image-gen-mcp.ts',
      'scripts/workflows/gemini/image-gen/regenerate-race-images-from-backlog.ts'
    ]
  },
  'Race Portrait Image Generation > Execution Reliability > Download Artifact Recovery': {
    layman: 'Recovers output capture through alternate fetch/screenshot paths when direct download fails.',
    canonicalDocs: [
      'scripts/workflows/gemini/core/image-gen-mcp.ts'
    ]
  },
  'Race Portrait Image Generation > Quality Gates': {
    layman: 'Automated checks reject malformed images before they are accepted into the race asset set.',
    canonicalDocs: [
      'scripts/workflows/gemini/image-gen/regenerate-race-images-from-backlog.ts'
    ]
  },
  'Race Portrait Image Generation > Quality Gates > Square Output Enforcement': {
    layman: 'Rejects non-1:1 outputs and retries generation until image dimensions meet square requirements.',
    canonicalDocs: [
      'scripts/audits/check-image-square.py',
      'scripts/workflows/gemini/image-gen/regenerate-race-images-from-backlog.ts'
    ]
  },
  'Race Portrait Image Generation > Quality Gates > Blank Margin Rejection': {
    layman: 'Detects letterboxed white margins and retries until full-bleed output is produced.',
    canonicalDocs: [
      'scripts/audits/detect-blank-margins.py',
      'scripts/workflows/gemini/image-gen/regenerate-race-images-from-backlog.ts'
    ]
  },
  'Race Portrait Image Generation > Quality Gates > Image Decode Validation': {
    layman: 'Confirms generated files are readable image assets before accepting them into output paths.',
    canonicalDocs: [
      'scripts/workflows/gemini/core/image-gen-mcp.ts',
      'scripts/workflows/gemini/image-gen/regenerate-race-images-from-backlog.ts'
    ]
  },
  'Race Portrait Image Generation > Quality Gates > Full Body Framing Check': {
    layman: 'Planned detector for head-to-toe framing compliance to reduce cropped character outputs.',
    canonicalDocs: [
      'docs/portraits/race_portrait_regen_handoff.md'
    ]
  },
  'Race Portrait Image Generation > Quality Gates > Duplicate Byte Hash Rejection': {
    layman: 'Rejects duplicate image bytes so regenerated assets are not accidentally reused outputs.',
    canonicalDocs: [
      'scripts/audits/audit-race-image-bytes.ts'
    ]
  },
  'Race Portrait Image Generation > Quality Gates > Arrow Artifact Rejection': {
    layman: 'Planned detector for arrow-like visual artifacts that break desired slice-of-life output quality.',
    canonicalDocs: [
      'docs/portraits/race_portrait_regen_handoff.md'
    ]
  },
  'Race Portrait Image Generation > Quality Gates > Borderless Full Bleed Validation': {
    layman: 'Validates that artwork fills the full image canvas without blank borders.',
    canonicalDocs: [
      'scripts/audits/detect-blank-margins.py'
    ]
  },
  'Race Portrait Image Generation > Post Generation Verification': {
    layman: 'Collects audits and manual checks that confirm generated images remain coherent with game data.',
    canonicalDocs: [
      'docs/portraits/race_portrait_regen_handoff.md',
      'scripts/audits/verify-cc-glossary-race-sync.ts'
    ]
  },
  'Race Portrait Image Generation > Post Generation Verification > Slice of Life Ledger Tracking': {
    layman: 'Maintains a ledger of observed activities, duplicate detection, and keeper-vs-regen decisions.',
    canonicalDocs: [
      'scripts/audits/list-slice-of-life-settings.ts',
      'scripts/audits/slice-of-life-settings.md'
    ]
  },
  'Race Portrait Image Generation > Post Generation Verification > In App Race Image Sync Validation': {
    layman: 'Checks race image references between Character Creator, Glossary, and physical files so game wiring stays valid.',
    canonicalDocs: [
      'scripts/audits/verify-cc-glossary-race-sync.ts',
      'scripts/audit-race-sync.ts'
    ]
  },
  'Race Portrait Image Generation > Post Generation Verification > CC Glossary Path Parity Audit': {
    layman: 'Verifies Character Creator and Glossary race entries resolve to consistent image path targets.',
    canonicalDocs: [
      'scripts/audits/verify-cc-glossary-race-sync.ts'
    ]
  },
  'Race Portrait Image Generation > Post Generation Verification > Slice of Life Completeness Audit': {
    layman: 'Audits missing or undefined slice-of-life activities so every race/gender row has tracked activity context.',
    canonicalDocs: [
      'scripts/audits/list-slice-of-life-settings.ts'
    ]
  },
  'Race Portrait Image Generation > Post Generation Verification > Duplicate Activity Keeper Decisioning': {
    layman: 'Selects one keeper per duplicate-activity cluster and marks only non-keepers for regeneration.',
    canonicalDocs: [
      'scripts/audits/list-slice-of-life-settings.ts'
    ]
  },
  'Race Portrait Image Generation > Post Generation Verification > Manual Approval Capture': {
    layman: 'Stores human visual pass decisions so approvals/rejections survive interruptions and retries.',
    canonicalDocs: [
      'docs/portraits/race_portrait_regen_handoff.md'
    ]
  },
  'Race Portrait Image Generation > Post Generation Verification > Verification Evidence Logging': {
    layman: 'Collects audit outputs and run evidence so verification state can be traced later.',
    canonicalDocs: [
      'docs/portraits/race_portrait_regen_handoff.md',
      'public/assets/images/races/race-image-status.json'
    ]
  },
  'Race Portrait Image Generation > Backlog Regeneration Orchestration': {
    layman: 'Handles backlog-driven regeneration runs and staged continuation from saved run status.',
    canonicalDocs: [
      'scripts/workflows/gemini/image-gen/regenerate-race-images-from-backlog.ts',
      'public/assets/images/races/race-image-status.json'
    ]
  },
  'Race Portrait Image Generation > Backlog Regeneration Orchestration > Category Agnostic Backlog Processing': {
    layman: 'Treats all backlog categories as one operational queue while preserving per-item quality checks.',
    canonicalDocs: [
      'docs/portraits/race_portrait_regen_backlog.json',
      'scripts/workflows/gemini/image-gen/regenerate-race-images-from-backlog.ts'
    ]
  },
  'Race Portrait Image Generation > Backlog Regeneration Orchestration > Backlog Parsing and Filtering': {
    layman: 'Parses backlog entries and filters by category/race/gender before each run phase.',
    canonicalDocs: [
      'scripts/workflows/gemini/image-gen/regenerate-race-images-from-backlog.ts'
    ]
  },
  'Race Portrait Image Generation > Backlog Regeneration Orchestration > Targeted Race Gender Runs': {
    layman: 'Supports single-race or single-gender targeted reruns for fast corrective passes.',
    canonicalDocs: [
      'scripts/workflows/gemini/image-gen/regenerate-race-images-from-backlog.ts'
    ]
  },
  'Race Portrait Image Generation > Backlog Regeneration Orchestration > Status Append Per Generation': {
    layman: 'Appends timestamped generation status records after each saved output.',
    canonicalDocs: [
      'public/assets/images/races/race-image-status.json',
      'scripts/workflows/gemini/image-gen/regenerate-race-images-from-backlog.ts'
    ]
  },
  'Race Portrait Image Generation > Backlog Regeneration Orchestration > Runbook Auto Update Hooks': {
    layman: 'Maintains runbook updates during long generation runs so handoff context remains current.',
    canonicalDocs: [
      'docs/portraits/race_portrait_regen_handoff.md'
    ]
  },
  'Race Portrait Image Generation > Backlog Regeneration Orchestration > Post Run Audit Pipeline': {
    layman: 'Runs post-generation audit scripts to validate missing files, duplicates, and structural integrity.',
    canonicalDocs: [
      'scripts/audits/audit-race-image-bytes.ts',
      'scripts/audits/list-non-square-race-images.py',
      'scripts/audits/verify-cc-glossary-race-sync.ts'
    ]
  },
  'Race Portrait Image Generation > Future Capability Expansion': {
    layman: 'Roadmap testing expansion area that now includes live node-level test metadata and execution.',
    canonicalDocs: [
      'docs/portraits/race_portrait_regen_handoff.md'
    ]
  },
  'Race Portrait Image Generation > Future Capability Expansion > Fail Fast Branch Test Orchestration': {
    layman: 'Node test commands are now generated per roadmap node as a fail-fast orchestration foundation.',
    canonicalDocs: [
      'scripts/roadmap-engine/generate.ts'
    ]
  },
  'Race Portrait Image Generation > Future Capability Expansion > Node Test Definition Registry': {
    layman: 'Each generated node now carries a unique test id and default runnable test command.',
    canonicalDocs: [
      'scripts/roadmap-engine/generate.ts',
      'scripts/roadmap-engine/types.ts'
    ]
  },
  'Race Portrait Image Generation > Future Capability Expansion > Fail Fast Branch Test Executor': {
    layman: 'A dedicated CLI now executes node checks and returns non-zero on failure for fail-fast behavior.',
    canonicalDocs: [
      'scripts/roadmap-node-test.ts'
    ]
  },
  'Race Portrait Image Generation > Future Capability Expansion > Test Log Retention Policy': {
    layman: 'Node test outcomes are persisted to roadmap-local JSON so pass/fail history survives session restarts.',
    canonicalDocs: [
      '.agent/roadmap-local/node-test-status.json',
      'scripts/roadmap-engine/node-test-status.ts'
    ]
  },
  'Race Portrait Image Generation > Future Capability Expansion > Roadmap Node Test Badges': {
    layman: 'Planned visual badges in roadmap UI showing latest test pass/fail state per node.',
    canonicalDocs: [
      'src/components/debug/roadmap/RoadmapVisualizer.tsx'
    ]
  },
  'Race Enrichment Pipeline': {
    layman: 'Standalone dev workflow that researches race lore and prepares structured enrichment for game-facing race data.',
    canonicalDocs: [
      'scripts/workflows/gemini/research/research-races-with-gemini.ts',
      'docs/portraits/race_portrait_regen_handoff.md'
    ]
  },
  'Race Enrichment Pipeline > Deep Research Collection': {
    layman: 'Controls long-running Gemini deep-research collection for per-race profile generation.',
    canonicalDocs: [
      'scripts/workflows/gemini/research/research-races-with-gemini.ts'
    ]
  },
  'Race Enrichment Pipeline > Deep Research Collection > Gemini Deep Research Mode Control': {
    layman: 'Verifies that Deep Research mode is selected before prompts are sent, reducing wrong-mode output.',
    canonicalDocs: [
      'scripts/workflows/gemini/research/research-races-with-gemini.ts',
      'scripts/workflows/gemini/research/debug/inspect-gemini-deep-research-ui.ts'
    ]
  },
  'Race Enrichment Pipeline > Output Normalization': {
    layman: 'Cleans and normalizes model output so resulting text is usable in game-facing lore surfaces.',
    canonicalDocs: [
      'scripts/workflows/gemini/research/research-races-with-gemini.ts'
    ]
  },
  'Race Enrichment Pipeline > Output Normalization > No Source Citations or URLs in Output': {
    layman: 'Strips and rejects source references so stored lore stays generalized and in-world.',
    canonicalDocs: [
      'scripts/workflows/gemini/research/research-races-with-gemini.ts'
    ]
  },
  'Race Enrichment Pipeline > Content Curation': {
    layman: 'Shapes raw research into concise race profiles aligned with game tone and usability.',
    canonicalDocs: [
      'scripts/workflows/gemini/research/research-races-with-gemini.ts',
      'docs/portraits/race_profiles'
    ]
  },
  'Race Enrichment Pipeline > Content Curation > Wiki-Style Narrative Output': {
    layman: 'Formats race writeups as informative narrative prose instead of rigid bullet lists and tables.',
    canonicalDocs: [
      'scripts/workflows/gemini/research/research-races-with-gemini.ts'
    ]
  },
  'Race Enrichment Pipeline > Game Data Integration': {
    layman: 'Connects enrichment outcomes to race-facing game data surfaces once content is approved.',
    canonicalDocs: [
      'public/data/glossary/entries/races',
      'src/components/CharacterCreator'
    ]
  },
  'Race Enrichment Pipeline > Game Data Integration > Glossary Detailed Race Lore Profiles': {
    layman: 'Stores expanded race lore in glossary paths so players can access deep race context without cluttering core UI.',
    canonicalDocs: [
      'public/data/glossary/entries/races'
    ]
  },
  'Race Enrichment Pipeline > Image Generation Support': {
    layman: 'Supplies race-likely activity and culture guidance that image prompts can reuse for better fit.',
    canonicalDocs: [
      'scripts/workflows/gemini/research/research-races-with-gemini.ts',
      'scripts/workflows/gemini/image-gen/regenerate-race-images-from-backlog.ts'
    ]
  },
  'Race Enrichment Pipeline > Image Generation Support > Race Likelihood Guidance for Activities': {
    layman: 'Provides race-fit context that helps choose believable slice-of-life activities during prompt construction.',
    canonicalDocs: [
      'scripts/workflows/gemini/research/research-races-with-gemini.ts',
      'scripts/audits/list-slice-of-life-settings.ts'
    ]
  },
  'Race Enrichment Pipeline > Planned Enhancements': {
    layman: 'Future improvements for approval workflows and safer promotion of researched content into game files.',
    canonicalDocs: [
      'docs/portraits/race_portrait_regen_handoff.md'
    ]
  },
  'Race Enrichment Pipeline > Planned Enhancements > Automated Promotion Gate to Game Data': {
    layman: 'Planned guardrail that requires review before research output is promoted into glossary/character data.',
    canonicalDocs: [
      'docs/tasks/roadmap/1C-ROADMAP-IMPLEMENTATION-PLAN.md'
    ]
  }
};

const CURATED_REQUIRED_SUBFEATURES: Record<string, string[]> = {
  '3d exploration & combat': [
    '3D Exploration & Combat',
    'World Map > Visuals',
    'World Map > Navigation',
    'World Map > Submap Continuity',
    'World Map > Generation & Determinism'
  ],
  'roadmap': [
    'Roadmap',
    'Roadmap > Visualization Stability',
    'Roadmap > Interaction UX',
    'Roadmap > Layout Persistence',
    'Roadmap > Documentation Intelligence',
    'Roadmap > Strategic Opportunity Mapping',
    'Roadmap > Strategic Opportunity Mapping > Opportunity Collection',
    'Roadmap > Strategic Opportunity Mapping > Opportunity Scan Orchestration',
    'Roadmap > Strategic Opportunity Mapping > Opportunity Triage Panel',
    'Roadmap > Strategic Opportunity Mapping > Opportunity Module Architecture',
    'Roadmap > Strategic Opportunity Mapping > Opportunity Module Architecture > Opportunity Public Facade Module',
    'Roadmap > Strategic Opportunity Mapping > Opportunity Module Architecture > Opportunity Type Contracts Module',
    'Roadmap > Strategic Opportunity Mapping > Opportunity Module Architecture > Opportunity Graph Context Module',
    'Roadmap > Strategic Opportunity Mapping > Opportunity Module Architecture > Opportunity Scanner Module',
    'Roadmap > Strategic Opportunity Mapping > Opportunity Module Architecture > Opportunity Flag Classifier Module',
    'Roadmap > Strategic Opportunity Mapping > Opportunity Module Architecture > Opportunity Propagation Module',
    'Roadmap > Strategic Opportunity Mapping > Opportunity Module Architecture > Opportunity Crosslink Resolver Module',
    'Roadmap > Strategic Opportunity Mapping > Opportunity Module Architecture > Opportunity Storage And Sanitization Module'
  ],
  'roadmap (capability-first)': [
    'Roadmap (Capability-First)',
    'Roadmap (Capability-First) > Visualization Stability',
    'Roadmap (Capability-First) > Interaction UX',
    'Roadmap (Capability-First) > Layout Persistence',
    'Roadmap (Capability-First) > Node Test Execution Capability',
    'Roadmap (Capability-First) > Roadmap API Surface Capability',
    'Roadmap (Capability-First) > Documentation Intelligence',
    'Roadmap (Capability-First) > Strategic Opportunity Mapping',
    // Strategic Opportunity Mapping in capability-first mode is grouped by
    // operational buckets; child nodes intentionally avoid "... Capability"
    // suffixes so labels stay concise and feature-oriented in the UI.
    'Roadmap (Capability-First) > Strategic Opportunity Mapping > Scan Pipeline',
    'Roadmap (Capability-First) > Strategic Opportunity Mapping > Scan Pipeline > Scan Orchestration',
    'Roadmap (Capability-First) > Strategic Opportunity Mapping > Scan Pipeline > Flag Classification',
    'Roadmap (Capability-First) > Strategic Opportunity Mapping > Scan Pipeline > Propagation And Rollup',
    'Roadmap (Capability-First) > Strategic Opportunity Mapping > Scan Pipeline > Crosslink Detection',
    'Roadmap (Capability-First) > Strategic Opportunity Mapping > Operator Workflow',
    'Roadmap (Capability-First) > Strategic Opportunity Mapping > Operator Workflow > Opportunity Collection',
    'Roadmap (Capability-First) > Strategic Opportunity Mapping > Operator Workflow > Scan Trigger',
    'Roadmap (Capability-First) > Strategic Opportunity Mapping > Operator Workflow > Triage Panel',
    'Roadmap (Capability-First) > Strategic Opportunity Mapping > Operator Workflow > Node Navigation',
    'Roadmap (Capability-First) > Strategic Opportunity Mapping > Operator Workflow > Filters And Sorts',
    'Roadmap (Capability-First) > Strategic Opportunity Mapping > Data Persistence',
    'Roadmap (Capability-First) > Strategic Opportunity Mapping > Data Persistence > Snapshot Persistence',
    'Roadmap (Capability-First) > Strategic Opportunity Mapping > Governance And Expansion',
    'Roadmap (Capability-First) > Strategic Opportunity Mapping > Governance And Expansion > Historical Development Traceability',
    'Roadmap (Capability-First) > Strategic Opportunity Mapping > Governance And Expansion > Multi-product Portfolio Branching (future)'
  ],
  'race portrait image generation': [
    'Race Portrait Image Generation',
    'Race Portrait Image Generation > Gemini Session Control',
    'Race Portrait Image Generation > Prompt Construction Engine',
    'Race Portrait Image Generation > Execution Reliability',
    'Race Portrait Image Generation > Quality Gates',
    'Race Portrait Image Generation > Post Generation Verification',
    'Race Portrait Image Generation > Backlog Regeneration Orchestration',
    'Race Portrait Image Generation > Future Capability Expansion'
  ],
  'race enrichment pipeline': [
    'Race Enrichment Pipeline',
    'Race Enrichment Pipeline > Deep Research Collection',
    'Race Enrichment Pipeline > Output Normalization',
    'Race Enrichment Pipeline > Content Curation',
    'Race Enrichment Pipeline > Game Data Integration',
    'Race Enrichment Pipeline > Image Generation Support',
    'Race Enrichment Pipeline > Planned Enhancements'
  ]
};

// Technical: canonical roadmap source template used to derive capability-first
// roadmap nodes.
// Layman: this is not a rendered branch by itself; it's the source list used to
// build "Roadmap (Capability-First)".
const ROADMAP_CAPABILITY_SOURCE_DOCS: ProcessingDocument[] = [
  {
    sourcePath: 'docs/tasks/roadmap/1C-ROADMAP-IMPLEMENTATION-PLAN.md',
    canonicalPath: 'docs/tasks/roadmap/1C-ROADMAP-IMPLEMENTATION-PLAN.md',
    featureGroup: 'roadmap-capability-template',
    feature: 'Roadmap Template',
    subFeatures: [
      { name: 'Roadmap', state: 'active', canonicalPath: 'docs/tasks/roadmap/1C-ROADMAP-IMPLEMENTATION-PLAN.md' },
      { name: 'Roadmap > Visualization Stability', state: 'active', canonicalPath: 'docs/tasks/roadmap/1C-ROADMAP-IMPLEMENTATION-PLAN.md' },
      { name: 'Roadmap > Visualization Stability > Connector Rendering Reliability', state: 'done', canonicalPath: 'src/components/debug/roadmap/graph.ts' },
      { name: 'Roadmap > Interaction UX', state: 'active', canonicalPath: 'src/components/debug/roadmap/RoadmapVisualizer.tsx' },
      { name: 'Roadmap > Interaction UX > Panel Scroll Without Canvas Zoom', state: 'done', canonicalPath: 'src/components/debug/roadmap/RoadmapVisualizer.tsx' },
      { name: 'Roadmap > Interaction UX > Related Docs Type Indicators', state: 'done', canonicalPath: 'src/components/debug/roadmap/RoadmapVisualizer.tsx' },
      { name: 'Roadmap > Interaction UX > Canvas Pan Drag Navigation', state: 'done', canonicalPath: 'src/components/debug/roadmap/RoadmapVisualizer.tsx' },
      { name: 'Roadmap > Interaction UX > Wheel Zoom Around Cursor', state: 'done', canonicalPath: 'src/components/debug/roadmap/RoadmapVisualizer.tsx' },
      { name: 'Roadmap > Interaction UX > Node Drag Repositioning', state: 'done', canonicalPath: 'src/components/debug/roadmap/RoadmapVisualizer.tsx' },
      { name: 'Roadmap > Interaction UX > Single Node Expand Collapse', state: 'done', canonicalPath: 'src/components/debug/roadmap/RoadmapVisualizer.tsx' },
      { name: 'Roadmap > Interaction UX > Expand All And Collapse All Controls', state: 'done', canonicalPath: 'src/components/debug/roadmap/RoadmapVisualizer.tsx' },
      { name: 'Roadmap > Interaction UX > View Reset Control', state: 'done', canonicalPath: 'src/components/debug/roadmap/RoadmapVisualizer.tsx' },
      { name: 'Roadmap > Interaction UX > Node Detail Drawer', state: 'done', canonicalPath: 'src/components/debug/roadmap/RoadmapVisualizer.tsx' },
      { name: 'Roadmap > Interaction UX > Open Related Docs In VS Code', state: 'done', canonicalPath: 'vite.config.ts' },
      { name: 'Roadmap > Layout Persistence', state: 'active', canonicalPath: 'docs/tasks/roadmap/1B-ROADMAP-VISUALIZER-EVOLUTION-HANDOVER.md' },
      { name: 'Roadmap > Layout Persistence > Auto-Save and Manual Save Clarity', state: 'done', canonicalPath: 'src/components/debug/roadmap/RoadmapVisualizer.tsx' },
      { name: 'Roadmap > Layout Persistence > Layout Restore On Load', state: 'done', canonicalPath: 'vite.config.ts' },
      { name: 'Roadmap > Layout Persistence > Auto-save Debounce Cycle', state: 'done', canonicalPath: 'src/components/debug/roadmap/RoadmapVisualizer.tsx' },
      { name: 'Roadmap > Layout Persistence > Manual Save Trigger', state: 'done', canonicalPath: 'src/components/debug/roadmap/RoadmapVisualizer.tsx' },
      { name: 'Roadmap > Layout Persistence > Reset Node Position Overrides', state: 'done', canonicalPath: 'src/components/debug/roadmap/RoadmapVisualizer.tsx' },
      { name: 'Roadmap > Node Test Execution Capability', state: 'active', canonicalPath: 'scripts/roadmap-node-test.ts' },
      { name: 'Roadmap > Node Test Execution Capability > Run Node Test (Self Plus Descendants)', state: 'done', canonicalPath: 'src/components/debug/roadmap/RoadmapVisualizer.tsx' },
      { name: 'Roadmap > Node Test Execution Capability > Run Child Node Tests (Descendants Only)', state: 'done', canonicalPath: 'src/components/debug/roadmap/RoadmapVisualizer.tsx' },
      { name: 'Roadmap > Node Test Execution Capability > Node Test Result Status Feedback', state: 'done', canonicalPath: 'src/components/debug/roadmap/RoadmapVisualizer.tsx' },
      { name: 'Roadmap > Node Test Execution Capability > Node Test Status Persistence', state: 'done', canonicalPath: 'scripts/roadmap-engine/node-test-status.ts' },
      { name: 'Roadmap > Node Test Execution Capability > Node Test Data Refresh After Run', state: 'done', canonicalPath: 'src/components/debug/roadmap/RoadmapVisualizer.tsx' },
      // Technical: capability branch for roadmap health-signal warnings.
      // Layman: tracks the node quality signal system (tests, density, and badge UI).
      { name: 'Roadmap > Node Health Signals', state: 'done', canonicalPath: 'src/components/debug/roadmap/health-signals/types.ts' },
      { name: 'Roadmap > Node Health Signals > Health Signal Computation', state: 'done', canonicalPath: 'src/components/debug/roadmap/health-signals/compute-health-signals.ts' },
      { name: 'Roadmap > Node Health Signals > Health Badge Component', state: 'done', canonicalPath: 'src/components/debug/roadmap/health-signals/NodeHealthBadge.tsx' },
      { name: 'Roadmap > Node Health Signals > Visualizer Integration', state: 'done', canonicalPath: 'src/components/debug/roadmap/RoadmapVisualizer.tsx' },
      { name: 'Roadmap > Node Health Signals > Density Warning Detection', state: 'done', canonicalPath: 'src/components/debug/roadmap/health-signals/compute-health-signals.ts' },
      // Technical: capability branch for test-file declaration and disk presence checks.
      // Layman: tracks whether roadmap nodes declare tests and whether those files exist.
      { name: 'Roadmap > Node Test Presence', state: 'done', canonicalPath: 'scripts/roadmap-server-logic.ts' },
      { name: 'Roadmap > Node Test Presence > Test File Declaration Schema', state: 'done', canonicalPath: 'scripts/roadmap-server-logic.ts' },
      { name: 'Roadmap > Node Test Presence > Disk Presence Checker', state: 'done', canonicalPath: 'scripts/roadmap/node-test-presence/test-presence-checker.ts' },
      { name: 'Roadmap > Node Test Presence > Pipeline Annotation', state: 'done', canonicalPath: 'scripts/roadmap-server-logic.ts' },
      { name: 'Roadmap > Roadmap API Surface Capability', state: 'active', canonicalPath: 'vite.config.ts' },
      { name: 'Roadmap > Roadmap API Surface Capability > Roadmap Data Endpoint', state: 'done', canonicalPath: 'vite.config.ts' },
      { name: 'Roadmap > Roadmap API Surface Capability > Layout Endpoint (Read Write)', state: 'done', canonicalPath: 'vite.config.ts' },
      { name: 'Roadmap > Roadmap API Surface Capability > Node Test Run Endpoint', state: 'done', canonicalPath: 'vite.config.ts' },
      { name: 'Roadmap > Roadmap API Surface Capability > Opportunities Latest Endpoint', state: 'done', canonicalPath: 'vite.config.ts' },
      { name: 'Roadmap > Roadmap API Surface Capability > Opportunities Scan Endpoint', state: 'done', canonicalPath: 'vite.config.ts' },
      { name: 'Roadmap > Roadmap API Surface Capability > Opportunities Settings Endpoint', state: 'done', canonicalPath: 'vite.config.ts' },
      { name: 'Roadmap > Roadmap API Surface Capability > VS Code Open Endpoint', state: 'done', canonicalPath: 'vite.config.ts' },
      { name: 'Roadmap > Documentation Intelligence', state: 'active', canonicalPath: 'docs/tasks/roadmap/1D-ROADMAP-ORCHESTRATION-CONTRACT.md' },
      { name: 'Roadmap > Documentation Intelligence > One-Doc Orchestrated Processing Pipeline', state: 'done', canonicalPath: 'scripts/roadmap-orchestrate-one-doc.ts' },
      { name: 'Roadmap > Documentation Intelligence > One-Doc Orchestrated Processing Pipeline > Worker Packet Validation Gate', state: 'done', canonicalPath: 'scripts/roadmap-packet-validation.ts' },
      { name: 'Roadmap > Documentation Intelligence > One-Doc Orchestrated Processing Pipeline > Feature-Oriented Naming Guard', state: 'done', canonicalPath: 'scripts/roadmap-orchestrate-one-doc.ts' },
      { name: 'Roadmap > Documentation Intelligence > Feature Taxonomy Integrity', state: 'done', canonicalPath: 'scripts/roadmap-engine/text.ts' },
      { name: 'Roadmap > Strategic Opportunity Mapping', state: 'active', canonicalPath: 'scripts/roadmap-engine/opportunities.ts' },
      { name: 'Roadmap > Strategic Opportunity Mapping > Opportunity Collection', state: 'done', canonicalPath: 'scripts/roadmap-engine/opportunities.ts' },
      { name: 'Roadmap > Strategic Opportunity Mapping > Opportunity Scan Orchestration', state: 'done', canonicalPath: 'scripts/roadmap-engine/opportunities/scanner.ts' },
      { name: 'Roadmap > Strategic Opportunity Mapping > Opportunity Flag Classification', state: 'done', canonicalPath: 'scripts/roadmap-engine/opportunities/flag-classifier.ts' },
      { name: 'Roadmap > Strategic Opportunity Mapping > Opportunity Propagation and Rollup', state: 'done', canonicalPath: 'scripts/roadmap-engine/opportunities/propagation.ts' },
      { name: 'Roadmap > Strategic Opportunity Mapping > Opportunity Snapshot Persistence', state: 'done', canonicalPath: 'scripts/roadmap-engine/opportunities/storage.ts' },
      { name: 'Roadmap > Strategic Opportunity Mapping > Opportunity Scan Trigger', state: 'done', canonicalPath: 'src/components/debug/roadmap/RoadmapVisualizer.tsx' },
      { name: 'Roadmap > Strategic Opportunity Mapping > Opportunity Triage Panel', state: 'done', canonicalPath: 'src/components/debug/roadmap/RoadmapVisualizer.tsx' },
      { name: 'Roadmap > Strategic Opportunity Mapping > Opportunity-to-Node Navigation', state: 'done', canonicalPath: 'src/components/debug/roadmap/RoadmapVisualizer.tsx' },
      { name: 'Roadmap > Strategic Opportunity Mapping > Opportunity Crosslink Detection', state: 'done', canonicalPath: 'scripts/roadmap-engine/opportunities/crosslink-resolver.ts' },
      { name: 'Roadmap > Strategic Opportunity Mapping > Opportunity Module Architecture', state: 'active', canonicalPath: 'scripts/roadmap-engine/opportunities.ts' },
      { name: 'Roadmap > Strategic Opportunity Mapping > Opportunity Module Architecture > Opportunity Public Facade Module', state: 'done', canonicalPath: 'scripts/roadmap-engine/opportunities.ts' },
      { name: 'Roadmap > Strategic Opportunity Mapping > Opportunity Module Architecture > Opportunity Type Contracts Module', state: 'done', canonicalPath: 'scripts/roadmap-engine/opportunities/types.ts' },
      { name: 'Roadmap > Strategic Opportunity Mapping > Opportunity Module Architecture > Opportunity Graph Context Module', state: 'done', canonicalPath: 'scripts/roadmap-engine/opportunities/graph.ts' },
      { name: 'Roadmap > Strategic Opportunity Mapping > Opportunity Module Architecture > Opportunity Scanner Module', state: 'done', canonicalPath: 'scripts/roadmap-engine/opportunities/scanner.ts' },
      { name: 'Roadmap > Strategic Opportunity Mapping > Opportunity Module Architecture > Opportunity Flag Classifier Module', state: 'done', canonicalPath: 'scripts/roadmap-engine/opportunities/flag-classifier.ts' },
      { name: 'Roadmap > Strategic Opportunity Mapping > Opportunity Module Architecture > Opportunity Propagation Module', state: 'done', canonicalPath: 'scripts/roadmap-engine/opportunities/propagation.ts' },
      { name: 'Roadmap > Strategic Opportunity Mapping > Opportunity Module Architecture > Opportunity Crosslink Resolver Module', state: 'done', canonicalPath: 'scripts/roadmap-engine/opportunities/crosslink-resolver.ts' },
      { name: 'Roadmap > Strategic Opportunity Mapping > Opportunity Module Architecture > Opportunity Storage And Sanitization Module', state: 'done', canonicalPath: 'scripts/roadmap-engine/opportunities/storage.ts' },
      { name: 'Roadmap > Strategic Opportunity Mapping > Opportunity Filters and Sorts', state: 'planned', canonicalPath: 'src/components/debug/roadmap/RoadmapVisualizer.tsx' },
      { name: 'Roadmap > Strategic Opportunity Mapping > Historical Development Traceability', state: 'planned', canonicalPath: 'docs/tasks/roadmap/1C-ROADMAP-IMPLEMENTATION-PLAN.md' },
      { name: 'Roadmap > Strategic Opportunity Mapping > Multi-Product Portfolio Branching (Future)', state: 'planned', canonicalPath: 'docs/tasks/roadmap/1C-ROADMAP-IMPLEMENTATION-PLAN.md' }
    ]
  }
];

// Technical: maps implementation-module names to their owning capability in the
// capability-first roadmap clone.
// Layman: this is the routing table that places each "module" under one
// capability parent instead of using a separate "Module Architecture" branch.
const CAPABILITY_FIRST_MODULE_PARENT_BY_NAME: Record<string, string> = {
  'Opportunity Public Facade Module': 'Operator Workflow > Opportunity Collection',
  'Opportunity Type Contracts Module': 'Scan Pipeline > Scan Orchestration',
  'Opportunity Graph Context Module': 'Scan Pipeline > Scan Orchestration',
  'Opportunity Scanner Module': 'Scan Pipeline > Scan Orchestration',
  'Opportunity Flag Classifier Module': 'Scan Pipeline > Flag Classification',
  'Opportunity Propagation Module': 'Scan Pipeline > Propagation And Rollup',
  'Opportunity Crosslink Resolver Module': 'Scan Pipeline > Crosslink Detection',
  'Opportunity Storage And Sanitization Module': 'Data Persistence > Snapshot Persistence'
};

const LEGACY_STRATEGIC_TO_CAPABILITY_FIRST: Record<string, string> = {
  'Roadmap > Strategic Opportunity Mapping > Opportunity Collection':
    'Roadmap (Capability-First) > Strategic Opportunity Mapping > Operator Workflow > Opportunity Collection',
  'Roadmap > Strategic Opportunity Mapping > Opportunity Scan Orchestration':
    'Roadmap (Capability-First) > Strategic Opportunity Mapping > Scan Pipeline > Scan Orchestration',
  'Roadmap > Strategic Opportunity Mapping > Opportunity Flag Classification':
    'Roadmap (Capability-First) > Strategic Opportunity Mapping > Scan Pipeline > Flag Classification',
  'Roadmap > Strategic Opportunity Mapping > Opportunity Propagation and Rollup':
    'Roadmap (Capability-First) > Strategic Opportunity Mapping > Scan Pipeline > Propagation And Rollup',
  'Roadmap > Strategic Opportunity Mapping > Opportunity Snapshot Persistence':
    'Roadmap (Capability-First) > Strategic Opportunity Mapping > Data Persistence > Snapshot Persistence',
  'Roadmap > Strategic Opportunity Mapping > Opportunity Scan Trigger':
    'Roadmap (Capability-First) > Strategic Opportunity Mapping > Operator Workflow > Scan Trigger',
  'Roadmap > Strategic Opportunity Mapping > Opportunity Triage Panel':
    'Roadmap (Capability-First) > Strategic Opportunity Mapping > Operator Workflow > Triage Panel',
  'Roadmap > Strategic Opportunity Mapping > Opportunity-to-Node Navigation':
    'Roadmap (Capability-First) > Strategic Opportunity Mapping > Operator Workflow > Node Navigation',
  'Roadmap > Strategic Opportunity Mapping > Opportunity Crosslink Detection':
    'Roadmap (Capability-First) > Strategic Opportunity Mapping > Scan Pipeline > Crosslink Detection',
  'Roadmap > Strategic Opportunity Mapping > Opportunity Filters and Sorts':
    'Roadmap (Capability-First) > Strategic Opportunity Mapping > Operator Workflow > Filters And Sorts',
  'Roadmap > Strategic Opportunity Mapping > Historical Development Traceability':
    'Roadmap (Capability-First) > Strategic Opportunity Mapping > Governance And Expansion > Historical Development Traceability',
  'Roadmap > Strategic Opportunity Mapping > Multi-Product Portfolio Branching (Future)':
    'Roadmap (Capability-First) > Strategic Opportunity Mapping > Governance And Expansion > Multi-product Portfolio Branching (future)'
};

// Technical: rewrites classic roadmap labels into capability-first labels.
// Layman: this clones the Roadmap branch but puts implementation modules under
// concrete capabilities (single tree) instead of a separate architecture branch.
const toCapabilityFirstRoadmapLabel = (subfeatureName: string): string | null => {
  if (!subfeatureName.startsWith('Roadmap')) return subfeatureName;

  const mappedStrategic = LEGACY_STRATEGIC_TO_CAPABILITY_FIRST[subfeatureName];
  if (mappedStrategic) return mappedStrategic;

  const modulePrefix = 'Roadmap > Strategic Opportunity Mapping > Opportunity Module Architecture > ';
  const architectureNode = 'Roadmap > Strategic Opportunity Mapping > Opportunity Module Architecture';
  if (subfeatureName === architectureNode) {
    return null;
  }

  if (subfeatureName.startsWith(modulePrefix)) {
    const moduleName = subfeatureName.slice(modulePrefix.length).trim();
    const capabilityParent = CAPABILITY_FIRST_MODULE_PARENT_BY_NAME[moduleName];
    if (!capabilityParent) return null;
    return `Roadmap (Capability-First) > Strategic Opportunity Mapping > ${capabilityParent} > ${moduleName}`;
  }

  return subfeatureName.replace(/^Roadmap(?=$| >)/, 'Roadmap (Capability-First)');
};

// Technical: synthetic docs for capability-first roadmap clone.
// Layman: this creates a sibling branch under Dev Tools where roadmap nodes are
// arranged as capability -> module (single tree) instead of mixed layout.
const ROADMAP_CAPABILITY_FIRST_DEV_SYNTHETIC_DOCS: ProcessingDocument[] = ROADMAP_CAPABILITY_SOURCE_DOCS.map((doc) => {
  const transformedSubFeatures = doc.subFeatures
    .map((sub) => {
      const mappedName = toCapabilityFirstRoadmapLabel(sub.name);
      if (!mappedName) return null;
      return { ...sub, name: mappedName };
    })
    .filter((sub): sub is NonNullable<typeof sub> => Boolean(sub));

  return {
    ...doc,
    featureGroup: 'roadmap-capability-first-dev-tools',
    feature: 'Roadmap (Capability-First)',
    subFeatures: transformedSubFeatures
  };
});

const ROADMAP_CAPABILITY_FIRST_DEV_FEATURE_BUCKET: FeatureBucket = {
  id: 'feature_roadmap_capability_first_dev_tools',
  featureGroup: 'roadmap-capability-first-dev-tools',
  feature: 'Roadmap (Capability-First)',
  featureCategory: 'Build & Infrastructure',
  docs: ROADMAP_CAPABILITY_FIRST_DEV_SYNTHETIC_DOCS
};

// Technical: synthetic docs for image generation roadmap branch.
// Layman: these are the "source records" that create Dev Tools > Race Portrait Image Generation.
const IMAGE_GEN_DEV_SYNTHETIC_DOCS: ProcessingDocument[] = [
  {
    sourcePath: 'docs/portraits/race_portrait_regen_handoff.md',
    canonicalPath: 'docs/portraits/race_portrait_regen_handoff.md',
    featureGroup: 'race-portrait-image-gen-dev-tools',
    feature: 'Race Portrait Image Generation',
    subFeatures: [
      { name: 'Race Portrait Image Generation', state: 'active', canonicalPath: 'docs/portraits/race_portrait_regen_handoff.md' },
      { name: 'Race Portrait Image Generation > Gemini Session Control', state: 'active', canonicalPath: 'scripts/workflows/gemini/core/image-gen-mcp.ts' },
      { name: 'Race Portrait Image Generation > Gemini Session Control > CDP Endpoint Health Check', state: 'done', canonicalPath: 'scripts/workflows/gemini/core/image-gen-mcp.ts' },
      { name: 'Race Portrait Image Generation > Gemini Session Control > Gemini Tab Targeting', state: 'done', canonicalPath: 'scripts/workflows/gemini/core/image-gen-mcp.ts' },
      { name: 'Race Portrait Image Generation > Gemini Session Control > Consent Interstitial Handling', state: 'done', canonicalPath: 'scripts/workflows/gemini/core/image-gen-mcp.ts' },
      { name: 'Race Portrait Image Generation > Gemini Session Control > Per Generation Chat Reset', state: 'active', canonicalPath: 'scripts/workflows/gemini/core/image-gen-mcp.ts' },
      { name: 'Race Portrait Image Generation > Gemini Session Control > New Chat Confirmation Check', state: 'active', canonicalPath: 'scripts/workflows/gemini/core/image-gen-mcp.ts' },
      { name: 'Race Portrait Image Generation > Gemini Session Control > Single Active Run Lock', state: 'planned', canonicalPath: 'docs/portraits/race_portrait_regen_handoff.md' },
      { name: 'Race Portrait Image Generation > Prompt Construction Engine', state: 'active', canonicalPath: 'scripts/workflows/gemini/image-gen/regenerate-race-images-from-backlog.ts' },
      { name: 'Race Portrait Image Generation > Prompt Construction Engine > Base Prompt Template Management', state: 'active', canonicalPath: 'scripts/workflows/gemini/image-gen/regenerate-race-images-from-backlog.ts' },
      { name: 'Race Portrait Image Generation > Prompt Construction Engine > Race Override Registry', state: 'active', canonicalPath: 'scripts/workflows/gemini/image-gen/regenerate-race-images-from-backlog.ts' },
      { name: 'Race Portrait Image Generation > Prompt Construction Engine > Gender Variant Prompting', state: 'active', canonicalPath: 'scripts/workflows/gemini/image-gen/regenerate-race-images-from-backlog.ts' },
      { name: 'Race Portrait Image Generation > Prompt Construction Engine > Positive Constraint Rules', state: 'active', canonicalPath: 'scripts/workflows/gemini/image-gen/regenerate-race-images-from-backlog.ts' },
      { name: 'Race Portrait Image Generation > Prompt Construction Engine > Slice of Life Activity Allocator', state: 'active', canonicalPath: 'scripts/workflows/gemini/image-gen/regenerate-race-images-from-backlog.ts' },
      { name: 'Race Portrait Image Generation > Prompt Construction Engine > Activity Uniqueness Normalization', state: 'done', canonicalPath: 'scripts/audits/list-slice-of-life-settings.ts' },
      { name: 'Race Portrait Image Generation > Prompt Construction Engine > Prompt Hash Tracking', state: 'planned', canonicalPath: 'docs/portraits/race_portrait_regen_handoff.md' },
      { name: 'Race Portrait Image Generation > Execution Reliability', state: 'active', canonicalPath: 'scripts/workflows/gemini/core/image-gen-mcp.ts' },
      { name: 'Race Portrait Image Generation > Execution Reliability > Single Session Concurrency Guard', state: 'done', canonicalPath: 'scripts/workflows/gemini/image-gen/regenerate-race-images-from-backlog.ts' },
      { name: 'Race Portrait Image Generation > Execution Reliability > Download Fallback Pipeline', state: 'done', canonicalPath: 'scripts/workflows/gemini/core/image-gen-mcp.ts' },
      { name: 'Race Portrait Image Generation > Execution Reliability > Retryable Failure Classification', state: 'done', canonicalPath: 'scripts/workflows/gemini/image-gen/regenerate-race-images-from-backlog.ts' },
      { name: 'Race Portrait Image Generation > Execution Reliability > Timeout and Cooldown Policy', state: 'done', canonicalPath: 'scripts/workflows/gemini/image-gen/regenerate-race-images-from-backlog.ts' },
      { name: 'Race Portrait Image Generation > Execution Reliability > Resume From Last Completed Item', state: 'active', canonicalPath: 'scripts/workflows/gemini/image-gen/regenerate-race-images-from-backlog.ts' },
      { name: 'Race Portrait Image Generation > Execution Reliability > Bad Request Recovery Path', state: 'done', canonicalPath: 'scripts/workflows/gemini/core/image-gen-mcp.ts' },
      { name: 'Race Portrait Image Generation > Execution Reliability > Download Artifact Recovery', state: 'active', canonicalPath: 'scripts/workflows/gemini/core/image-gen-mcp.ts' },
      { name: 'Race Portrait Image Generation > Quality Gates', state: 'active', canonicalPath: 'scripts/workflows/gemini/image-gen/regenerate-race-images-from-backlog.ts' },
      { name: 'Race Portrait Image Generation > Quality Gates > Square Output Enforcement', state: 'done', canonicalPath: 'scripts/audits/check-image-square.py' },
      { name: 'Race Portrait Image Generation > Quality Gates > Blank Margin Rejection', state: 'done', canonicalPath: 'scripts/audits/detect-blank-margins.py' },
      { name: 'Race Portrait Image Generation > Quality Gates > Image Decode Validation', state: 'active', canonicalPath: 'scripts/workflows/gemini/core/image-gen-mcp.ts' },
      { name: 'Race Portrait Image Generation > Quality Gates > Full Body Framing Check', state: 'planned', canonicalPath: 'docs/portraits/race_portrait_regen_handoff.md' },
      { name: 'Race Portrait Image Generation > Quality Gates > Duplicate Byte Hash Rejection', state: 'active', canonicalPath: 'scripts/audits/audit-race-image-bytes.ts' },
      { name: 'Race Portrait Image Generation > Quality Gates > Arrow Artifact Rejection', state: 'planned', canonicalPath: 'docs/portraits/race_portrait_regen_handoff.md' },
      { name: 'Race Portrait Image Generation > Quality Gates > Borderless Full Bleed Validation', state: 'done', canonicalPath: 'scripts/audits/detect-blank-margins.py' },
      { name: 'Race Portrait Image Generation > Post Generation Verification', state: 'active', canonicalPath: 'scripts/audits/verify-cc-glossary-race-sync.ts' },
      { name: 'Race Portrait Image Generation > Post Generation Verification > Slice of Life Ledger Tracking', state: 'active', canonicalPath: 'scripts/audits/list-slice-of-life-settings.ts' },
      { name: 'Race Portrait Image Generation > Post Generation Verification > In App Race Image Sync Validation', state: 'done', canonicalPath: 'scripts/audits/verify-cc-glossary-race-sync.ts' },
      { name: 'Race Portrait Image Generation > Post Generation Verification > CC Glossary Path Parity Audit', state: 'done', canonicalPath: 'scripts/audits/verify-cc-glossary-race-sync.ts' },
      { name: 'Race Portrait Image Generation > Post Generation Verification > Slice of Life Completeness Audit', state: 'active', canonicalPath: 'scripts/audits/list-slice-of-life-settings.ts' },
      { name: 'Race Portrait Image Generation > Post Generation Verification > Duplicate Activity Keeper Decisioning', state: 'active', canonicalPath: 'scripts/audits/list-slice-of-life-settings.ts' },
      { name: 'Race Portrait Image Generation > Post Generation Verification > Manual Approval Capture', state: 'active', canonicalPath: 'docs/portraits/race_portrait_regen_handoff.md' },
      { name: 'Race Portrait Image Generation > Post Generation Verification > Verification Evidence Logging', state: 'active', canonicalPath: 'public/assets/images/races/race-image-status.json' },
      { name: 'Race Portrait Image Generation > Backlog Regeneration Orchestration', state: 'active', canonicalPath: 'docs/portraits/race_portrait_regen_backlog.json' },
      { name: 'Race Portrait Image Generation > Backlog Regeneration Orchestration > Category Agnostic Backlog Processing', state: 'done', canonicalPath: 'docs/portraits/race_portrait_regen_handoff.md' },
      { name: 'Race Portrait Image Generation > Backlog Regeneration Orchestration > Backlog Parsing and Filtering', state: 'done', canonicalPath: 'scripts/workflows/gemini/image-gen/regenerate-race-images-from-backlog.ts' },
      { name: 'Race Portrait Image Generation > Backlog Regeneration Orchestration > Targeted Race Gender Runs', state: 'done', canonicalPath: 'scripts/workflows/gemini/image-gen/regenerate-race-images-from-backlog.ts' },
      { name: 'Race Portrait Image Generation > Backlog Regeneration Orchestration > Status Append Per Generation', state: 'done', canonicalPath: 'public/assets/images/races/race-image-status.json' },
      { name: 'Race Portrait Image Generation > Backlog Regeneration Orchestration > Runbook Auto Update Hooks', state: 'active', canonicalPath: 'docs/portraits/race_portrait_regen_handoff.md' },
      { name: 'Race Portrait Image Generation > Backlog Regeneration Orchestration > Post Run Audit Pipeline', state: 'done', canonicalPath: 'scripts/audits/verify-cc-glossary-race-sync.ts' },
      { name: 'Race Portrait Image Generation > Future Capability Expansion', state: 'active', canonicalPath: 'docs/portraits/race_portrait_regen_handoff.md' },
      { name: 'Race Portrait Image Generation > Future Capability Expansion > Fail Fast Branch Test Orchestration', state: 'active', canonicalPath: 'scripts/roadmap-engine/generate.ts' },
      { name: 'Race Portrait Image Generation > Future Capability Expansion > Node Test Definition Registry', state: 'done', canonicalPath: 'scripts/roadmap-engine/types.ts' },
      { name: 'Race Portrait Image Generation > Future Capability Expansion > Fail Fast Branch Test Executor', state: 'done', canonicalPath: 'scripts/roadmap-node-test.ts' },
      { name: 'Race Portrait Image Generation > Future Capability Expansion > Test Log Retention Policy', state: 'active', canonicalPath: 'scripts/roadmap-engine/node-test-status.ts' },
      { name: 'Race Portrait Image Generation > Future Capability Expansion > Roadmap Node Test Badges', state: 'planned', canonicalPath: 'src/components/debug/roadmap/RoadmapVisualizer.tsx' }
    ]
  }
];

const IMAGE_GEN_DEV_FEATURE_BUCKET: FeatureBucket = {
  id: 'feature_race_portrait_image_gen_dev_tools',
  featureGroup: 'race-portrait-image-gen-dev-tools',
  feature: 'Race Portrait Image Generation',
  featureCategory: 'Build & Infrastructure',
  docs: IMAGE_GEN_DEV_SYNTHETIC_DOCS
};

// Technical: synthetic docs for race enrichment roadmap branch.
// Layman: these nodes track enrichment as a standalone workflow that can feed image generation and game data.
const RACE_ENRICHMENT_DEV_SYNTHETIC_DOCS: ProcessingDocument[] = [
  {
    sourcePath: 'scripts/workflows/gemini/research/research-races-with-gemini.ts',
    canonicalPath: 'scripts/workflows/gemini/research/research-races-with-gemini.ts',
    featureGroup: 'race-enrichment-dev-tools',
    feature: 'Race Enrichment Pipeline',
    subFeatures: [
      { name: 'Race Enrichment Pipeline', state: 'active', canonicalPath: 'scripts/workflows/gemini/research/research-races-with-gemini.ts' },
      { name: 'Race Enrichment Pipeline > Deep Research Collection', state: 'active', canonicalPath: 'scripts/workflows/gemini/research/research-races-with-gemini.ts' },
      { name: 'Race Enrichment Pipeline > Deep Research Collection > Gemini Deep Research Mode Control', state: 'active', canonicalPath: 'scripts/workflows/gemini/research/debug/inspect-gemini-deep-research-ui.ts' },
      { name: 'Race Enrichment Pipeline > Output Normalization', state: 'active', canonicalPath: 'scripts/workflows/gemini/research/research-races-with-gemini.ts' },
      { name: 'Race Enrichment Pipeline > Output Normalization > No Source Citations or URLs in Output', state: 'active', canonicalPath: 'scripts/workflows/gemini/research/research-races-with-gemini.ts' },
      { name: 'Race Enrichment Pipeline > Content Curation', state: 'active', canonicalPath: 'docs/portraits/race_profiles' },
      { name: 'Race Enrichment Pipeline > Content Curation > Wiki-Style Narrative Output', state: 'active', canonicalPath: 'scripts/workflows/gemini/research/research-races-with-gemini.ts' },
      { name: 'Race Enrichment Pipeline > Game Data Integration', state: 'planned', canonicalPath: 'public/data/glossary/entries/races' },
      { name: 'Race Enrichment Pipeline > Game Data Integration > Glossary Detailed Race Lore Profiles', state: 'planned', canonicalPath: 'public/data/glossary/entries/races' },
      { name: 'Race Enrichment Pipeline > Image Generation Support', state: 'active', canonicalPath: 'scripts/workflows/gemini/image-gen/regenerate-race-images-from-backlog.ts' },
      { name: 'Race Enrichment Pipeline > Image Generation Support > Race Likelihood Guidance for Activities', state: 'planned', canonicalPath: 'scripts/audits/list-slice-of-life-settings.ts' },
      { name: 'Race Enrichment Pipeline > Planned Enhancements', state: 'planned', canonicalPath: 'docs/portraits/race_portrait_regen_handoff.md' },
      { name: 'Race Enrichment Pipeline > Planned Enhancements > Automated Promotion Gate to Game Data', state: 'planned', canonicalPath: 'docs/tasks/roadmap/1C-ROADMAP-IMPLEMENTATION-PLAN.md' }
    ]
  }
];

const RACE_ENRICHMENT_DEV_FEATURE_BUCKET: FeatureBucket = {
  id: 'feature_race_enrichment_dev_tools',
  featureGroup: 'race-enrichment-dev-tools',
  feature: 'Race Enrichment Pipeline',
  featureCategory: 'Build & Infrastructure',
  docs: RACE_ENRICHMENT_DEV_SYNTHETIC_DOCS
};

// Technical: one source of truth for all synthetic dev-tools branches.
// Layman: this list is the full set of manually-injected Dev Tools branches.
const DEV_TOOLS_SYNTHETIC_FEATURES: FeatureBucket[] = [
  ROADMAP_CAPABILITY_FIRST_DEV_FEATURE_BUCKET,
  IMAGE_GEN_DEV_FEATURE_BUCKET,
  RACE_ENRICHMENT_DEV_FEATURE_BUCKET
];

const DEV_TOOLS_SYNTHETIC_GROUPS = new Set(
  DEV_TOOLS_SYNTHETIC_FEATURES.map((feature) => feature.featureGroup)
);

// Technical: maps capability-first roadmap labels back to legacy roadmap labels
// so we can reuse existing detail text/docs without duplicating registry entries.
// Layman: capability-first nodes still get rich descriptions from the same source.
const toLegacyRoadmapLabelFromCapabilityFirst = (subfeatureName: string): string | null => {
  if (!subfeatureName.startsWith('Roadmap (Capability-First)')) return null;

  // Reverse map for renamed strategic-opportunity labels.
  for (const [legacy, capFirst] of Object.entries(LEGACY_STRATEGIC_TO_CAPABILITY_FIRST)) {
    if (subfeatureName === capFirst) return legacy;
  }

  if (
    subfeatureName === 'Roadmap (Capability-First) > Strategic Opportunity Mapping > Scan Pipeline' ||
    subfeatureName === 'Roadmap (Capability-First) > Strategic Opportunity Mapping > Operator Workflow' ||
    subfeatureName === 'Roadmap (Capability-First) > Strategic Opportunity Mapping > Data Persistence' ||
    subfeatureName === 'Roadmap (Capability-First) > Strategic Opportunity Mapping > Governance And Expansion'
  ) {
    return 'Roadmap > Strategic Opportunity Mapping';
  }

  const base = subfeatureName.replace(/^Roadmap \(Capability-First\)(?=$| >)/, 'Roadmap');
  const prefix = 'Roadmap > Strategic Opportunity Mapping > ';
  for (const [moduleName, capabilityParent] of Object.entries(CAPABILITY_FIRST_MODULE_PARENT_BY_NAME)) {
    const capabilityScoped = `${prefix}${capabilityParent} > ${moduleName}`;
    if (base === capabilityScoped) {
      return `${prefix}Opportunity Module Architecture > ${moduleName}`;
    }
  }
  return base;
};

const getCuratedDetails = (subfeatureName: string) => {
  const direct = CURATED_SUBFEATURE_DETAILS[subfeatureName];
  if (direct) return direct;
  const legacyAlias = toLegacyRoadmapLabelFromCapabilityFirst(subfeatureName);
  if (legacyAlias && CURATED_SUBFEATURE_DETAILS[legacyAlias]) {
    return CURATED_SUBFEATURE_DETAILS[legacyAlias];
  }
  const lower = subfeatureName.toLowerCase();
  const key = Object.keys(CURATED_SUBFEATURE_DETAILS).find((candidate) => candidate.toLowerCase() === lower);
  return key ? CURATED_SUBFEATURE_DETAILS[key] : undefined;
};

const isCuratedSubfeature = (featureName: string, subfeatureName: string) => {
  // Technical: capability-first roadmap clone is generated from trusted synthetic docs.
  // Layman: allow its transformed labels without forcing a second static allowlist.
  if (featureName.toLowerCase() === 'roadmap (capability-first)') {
    return subfeatureName.startsWith('Roadmap (Capability-First)');
  }
  const allowed = CURATED_SUBFEATURES[featureName.toLowerCase()];
  if (!allowed) return false;
  if (allowed.has(subfeatureName)) return true;
  const lower = subfeatureName.toLowerCase();
  for (const candidate of allowed) {
    if (candidate.toLowerCase() === lower) return true;
  }
  return false;
};

const buildSubfeatureDescription = (subfeatureName: string, relatedDocs: string[]) => {
  const details = getCuratedDetails(subfeatureName);
  if (!details) return `Related doc(s): ${summarizeDocs(relatedDocs)}`;
  return `${details.layman}\n\nRelated doc(s): ${summarizeDocs(relatedDocs)}`;
};

// Technical: deterministic per-node test metadata generator.
// Layman: assigns tests only to completed roadmap nodes; in-progress/planned nodes
// stay unassigned until they are finished.
const applyNodeTestMetadata = (nodes: RoadmapNode[]): RoadmapNode[] => {
  const persistedByNodeId = loadNodeTestResults();
  return nodes.map((node) => {
    const definition = resolveNodeTestDefinition(node);
    if (!definition) {
      return {
        ...node,
        testId: undefined,
        testCommand: undefined,
        testStatus: undefined,
        lastTestedAt: undefined,
        lastTestMessage: undefined
      };
    }

    const persisted = persistedByNodeId[node.id];
    return {
      ...node,
      testId: definition.testId,
      testCommand: definition.testCommand,
      testStatus: persisted?.status ?? 'unverified',
      lastTestedAt: persisted?.lastTestedAt,
      lastTestMessage: persisted?.lastTestMessage
    };
  });
};

export function generateRoadmapData() {
  const docs = loadProcessingDocs();
  if (docs.length === 0) return EMPTY;

  const nodes: RoadmapNode[] = [];
  const edges: RoadmapEdge[] = [];
  const nodeIds = new RoadmapNodeIdRegistry();

  const rootId = 'aralia_chronicles';
  nodeIds.register(rootId, 'root: Aralia Game Roadmap');
  nodes.push({
    id: rootId,
    label: 'Aralia Game Roadmap',
    type: 'root',
    category: NODE_CATEGORIES.trunk,
    sourceKind: 'system',
    feature: 'Game Feature Roadmap',
    featureCategory: 'Program Governance',
    status: 'active',
    initialX: ROOT_X,
    initialY: ROOT_Y,
    color: '#fbbf24',
    description: 'Feature-first roadmap generated from processed game documentation.'
  });

  const featuresByGroup = buildFeaturesByGroup(docs);
  // Technical: inject synthetic dev-tool branches so they are first-class roadmap features.
  // Layman: adds Dev Tools children (Roadmap, Race Portrait Image Generation, Race Enrichment Pipeline)
  // into the same tree as everything else.
  for (const syntheticFeature of DEV_TOOLS_SYNTHETIC_FEATURES) {
    featuresByGroup.set(syntheticFeature.featureGroup, syntheticFeature);
  }
  const featuresByPillar = new Map<MainPillarId, FeatureBucket[]>();
  for (const pillar of MAIN_PILLARS) featuresByPillar.set(pillar.id, []);

  for (const feature of featuresByGroup.values()) {
    const pillarId = DEV_TOOLS_SYNTHETIC_GROUPS.has(feature.featureGroup)
      ? 'dev-tools'
      : inferPillarForFeature(feature);
    const arr = featuresByPillar.get(pillarId) ?? [];
    arr.push(feature);
    featuresByPillar.set(pillarId, arr);
  }

  for (const arr of featuresByPillar.values()) {
    arr.sort((a, b) => a.feature.localeCompare(b.feature));
  }

  let pillarIndex = 0;

  for (const pillar of MAIN_PILLARS) {
    const pillarFeatures = featuresByPillar.get(pillar.id) ?? [];
    const docCount = pillarFeatures.reduce((sum, feature) => sum + feature.docs.length, 0);
    const x = ROOT_X + (pillarIndex % 3 - 1) * 520;
    const y = ROOT_Y + 280 + Math.floor(pillarIndex / 3) * 420;
    pillarIndex += 1;
    const pillarNodeId = `pillar_${slug(pillar.id)}`;
    const pillarStatus: RoadmapNode['status'] = pillarFeatures.length > 0 ? 'active' : 'planned';
    nodeIds.register(pillarNodeId, `pillar: ${pillar.label}`);

    nodes.push({
      id: pillarNodeId,
      label: pillar.label,
      type: 'project',
      category: NODE_CATEGORIES.pillar,
      sourceKind: 'registry',
      feature: pillar.label,
      featureCategory: pillar.label,
      status: pillarStatus,
      initialX: x,
      initialY: y,
      color: DOMAIN_COLORS.default,
      description: `${pillar.summary} Mapped features: ${pillarFeatures.length}. Processed docs: ${docCount}.`
    });
    edges.push({ from: rootId, to: pillarNodeId, type: 'containment' });

    if (PRIME_NODES_ONLY_VIEW) {
      continue;
    }

    let subIndex = 0;
    for (const feature of pillarFeatures) {
      const featureSubfeatures = new Map<string, {
        name: string;
        state: RoadmapNode['status'];
        score: number;
        sourceDocs: Set<string>;
        canonicalDocs: Set<string>;
      }>();

      for (const doc of feature.docs) {
        for (const sub of doc.subFeatures ?? []) {
          const displayName = toFeatureDrivenSubfeatureName(sub.name, feature.feature, doc.sourcePath);
          if (!displayName) continue;
          if (!isCuratedSubfeature(feature.feature, displayName)) continue;
          const key = displayName.toLowerCase();
          const state = normalizeState(sub.state);
          const current = featureSubfeatures.get(key);
          if (!current) {
            featureSubfeatures.set(key, {
              name: displayName,
              state,
              score: 1,
              sourceDocs: new Set([doc.sourcePath]),
              canonicalDocs: new Set([sub.canonicalPath || doc.canonicalPath || doc.sourcePath])
            });
          } else {
            if (current.state !== 'done' && state === 'done') {
              current.state = 'done';
            } else if (current.state === 'planned' && state === 'active') {
              current.state = 'active';
            }
            current.score += 1;
            current.sourceDocs.add(doc.sourcePath);
            current.canonicalDocs.add(sub.canonicalPath || doc.canonicalPath || doc.sourcePath);
          }
        }
      }

      const scoredSubfeatures = Array.from(featureSubfeatures.values())
        .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));

      const requiredSubfeatures = CURATED_REQUIRED_SUBFEATURES[feature.feature.toLowerCase()] ?? [];
      for (const requiredName of requiredSubfeatures) {
        if (scoredSubfeatures.some((sub) => sub.name === requiredName)) continue;
        const details = getCuratedDetails(requiredName);
        const docsFallback = feature.docs.map((doc) => doc.sourcePath);
        const canonicalFallback = feature.docs.map((doc) => doc.canonicalPath || doc.sourcePath);
        scoredSubfeatures.unshift({
          name: requiredName,
          state: 'active',
          score: 999,
          sourceDocs: new Set(details?.canonicalDocs?.length ? details.canonicalDocs : docsFallback),
          canonicalDocs: new Set(details?.canonicalDocs?.length ? details.canonicalDocs : canonicalFallback)
        });
      }

      for (const sub of scoredSubfeatures) {
        const curatedDetails = getCuratedDetails(sub.name);
        const sourceDocs = curatedDetails?.canonicalDocs?.length
          ? curatedDetails.canonicalDocs
          : Array.from(sub.sourceDocs).sort();
        const canonicalDocs = curatedDetails?.canonicalDocs?.length
          ? curatedDetails.canonicalDocs
          : Array.from(sub.canonicalDocs).sort();
        const subId = `sub_${slug(pillarNodeId)}_${slug(sub.name)}`;
        nodeIds.register(
          subId,
          `subfeature: pillar="${pillar.label}" feature="${feature.feature}" label="${sub.name}"`
        );

        nodes.push({
          id: subId,
          label: sub.name,
          type: 'milestone',
          category: NODE_CATEGORIES.feature,
          sourceKind: 'registry',
          feature: feature.feature,
          featureCategory: pillar.label,
          status: sub.state,
          initialX: x - 180 + (subIndex % 3) * 180,
          initialY: y + 170 + Math.floor(subIndex / 3) * 120,
          color: DOMAIN_COLORS.default,
          description: buildSubfeatureDescription(sub.name, canonicalDocs),
          sourceDocs,
          canonicalDocs,
          link: canonicalDocs[0]
        });
        edges.push({ from: pillarNodeId, to: subId, type: 'containment' });
        subIndex += 1;
      }
    }
  }

  relaxNodeCollisions(nodes);
  const nodesWithTestMetadata = applyNodeTestMetadata(nodes);
  return { version: '2.1.0', root: rootId, nodes: nodesWithTestMetadata, edges };
}
