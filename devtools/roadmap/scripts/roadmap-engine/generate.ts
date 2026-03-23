import { relaxNodeCollisions } from './collision.js';
import { DOMAIN_COLORS, NODE_CATEGORIES, ROOT_X, ROOT_Y } from './constants.js';
import { buildFeaturesByGroup } from './feature-mapping.js';
import type { FeatureBucket, ProcessingDocument } from './generation-types.js';
import { RoadmapNodeIdRegistry } from './id-validation.js';
import { loadProcessingDocs } from './manifest.js';
import { resolveNodeTestDefinition } from './node-test-definitions.js';
import { loadNodeTestResults } from './node-test-status.js';
import { inferPillarForFeature } from './pillar-inference.js';
import { MAIN_PILLARS, type MainPillarId } from './pillars.js';
import { normalizeState, slug, summarizeDocs, toFeatureDrivenSubfeatureName } from './text.js';
import type { RoadmapEdge, RoadmapNode } from './types.js';

/**
 * This file builds the roadmap graph payload that powers the roadmap visualizer screen.
 *
 * It exists so the UI can show one consistent "feature tree" even when the source data
 * comes from different places (processed docs plus synthetic dev-tool branches).
 * In this pass, the generator also injects first-class Dev Tools branches for
 * "Race Portrait Image Generation" and "Race Enrichment Pipeline" so those systems are tracked
 * like real capabilities instead of ad-hoc notes.
 *
 * Called by: devtools/roadmap/scripts/roadmap-server-logic.ts -> vite roadmap API (/api/roadmap/data)
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
  'roadmap tool': new Set([
    'Roadmap Tool',
    'Roadmap Tool > Visualization Stability',
    'Roadmap Tool > Visualization Stability > Connector Rendering Reliability',
    'Roadmap Tool > Interaction UX',
    'Roadmap Tool > Interaction UX > Panel Scroll Without Canvas Zoom',
    'Roadmap Tool > Interaction UX > Related Docs Type Indicators',
    'Roadmap Tool > Layout Persistence',
    'Roadmap Tool > Layout Persistence > Auto-Save and Manual Save Clarity',
    'Roadmap Tool > Documentation Intelligence',
    // Legacy wording "Incremental Document Ingestion" was replaced with an orchestration-first
    // capability name so the roadmap reflects what the system does, not just process cadence.
    'Roadmap Tool > Documentation Intelligence > One-Doc Orchestrated Processing Pipeline',
    'Roadmap Tool > Documentation Intelligence > One-Doc Orchestrated Processing Pipeline > Worker Packet Validation Gate',
    'Roadmap Tool > Documentation Intelligence > One-Doc Orchestrated Processing Pipeline > Feature-Oriented Naming Guard',
    'Roadmap Tool > Documentation Intelligence > Feature Taxonomy Integrity',
    'Roadmap Tool > Strategic Opportunity Mapping',
    'Roadmap Tool > Strategic Opportunity Mapping > Opportunity Collection',
    'Roadmap Tool > Strategic Opportunity Mapping > Opportunity Scan Orchestration',
    'Roadmap Tool > Strategic Opportunity Mapping > Opportunity Flag Classification',
    'Roadmap Tool > Strategic Opportunity Mapping > Opportunity Propagation and Rollup',
    'Roadmap Tool > Strategic Opportunity Mapping > Opportunity Snapshot Persistence',
    'Roadmap Tool > Strategic Opportunity Mapping > Opportunity Scan Trigger',
    'Roadmap Tool > Strategic Opportunity Mapping > Opportunity Triage Panel',
    'Roadmap Tool > Strategic Opportunity Mapping > Opportunity-to-Node Navigation',
    'Roadmap Tool > Strategic Opportunity Mapping > Opportunity Crosslink Detection',
    'Roadmap Tool > Strategic Opportunity Mapping > Opportunity Module Architecture',
    'Roadmap Tool > Strategic Opportunity Mapping > Opportunity Module Architecture > Opportunity Public Facade Module',
    'Roadmap Tool > Strategic Opportunity Mapping > Opportunity Module Architecture > Opportunity Type Contracts Module',
    'Roadmap Tool > Strategic Opportunity Mapping > Opportunity Module Architecture > Opportunity Graph Context Module',
    'Roadmap Tool > Strategic Opportunity Mapping > Opportunity Module Architecture > Opportunity Scanner Module',
    'Roadmap Tool > Strategic Opportunity Mapping > Opportunity Module Architecture > Opportunity Flag Classifier Module',
    'Roadmap Tool > Strategic Opportunity Mapping > Opportunity Module Architecture > Opportunity Propagation Module',
    'Roadmap Tool > Strategic Opportunity Mapping > Opportunity Module Architecture > Opportunity Crosslink Resolver Module',
    'Roadmap Tool > Strategic Opportunity Mapping > Opportunity Module Architecture > Opportunity Storage And Sanitization Module',
    'Roadmap Tool > Strategic Opportunity Mapping > Opportunity Filters and Sorts',
    'Roadmap Tool > Strategic Opportunity Mapping > Historical Development Traceability',
    'Roadmap Tool > Strategic Opportunity Mapping > Multi-Product Portfolio Branching (Future)',
    'Roadmap Tool > Spell Branch Navigator',
    'Roadmap Tool > Spell Branch Navigator > Axis Engine',
    'Roadmap Tool > Spell Branch Navigator > VSM Drill-Down Navigator',
    'Roadmap Tool > Spell Branch Navigator > Requirements Component Mapping',
    'Roadmap Tool > Spell Graph Navigation',
    'Roadmap Tool > Spell Graph Navigation > Live Axis Filtering Engine',
    'Roadmap Tool > Spell Graph Navigation > Canvas-Coordinated Node Layout',
    'Roadmap Tool > Spell Graph Navigation > Spell Branch Tab Handoff',
    'Roadmap Tool > Node Media Previews',
    'Roadmap Tool > Node Media Previews > Convention-Based Media Scanner',
    'Roadmap Tool > Node Media Previews > Media File Endpoint',
    'Roadmap Tool > Node Media Previews > Info Panel Preview Button',
    'Roadmap Tool > Node Media Previews > Lightbox Viewer',
  ]),
  'race portrait image generation': new Set([
    'Race Portrait Image Generation',
    'Race Portrait Image Generation > AI Session Manager',
    'Race Portrait Image Generation > AI Session Manager > Check AI Connection Is Alive',
    'Race Portrait Image Generation > AI Session Manager > Find the Right AI Browser Tab',
    'Race Portrait Image Generation > AI Session Manager > Dismiss AI Consent Popups',
    'Race Portrait Image Generation > AI Session Manager > Start Fresh Chat Per Image',
    'Race Portrait Image Generation > AI Session Manager > Confirm New Chat Started',
    'Race Portrait Image Generation > AI Session Manager > Prevent Two Runs at Once',
    'Race Portrait Image Generation > Image Prompt Builder',
    'Race Portrait Image Generation > Image Prompt Builder > Base Prompt Templates',
    'Race Portrait Image Generation > Image Prompt Builder > Per-Race Prompt Overrides',
    'Race Portrait Image Generation > Image Prompt Builder > Gender-Specific Prompts',
    'Race Portrait Image Generation > Image Prompt Builder > What to Include in Prompts',
    'Race Portrait Image Generation > Image Prompt Builder > Assign Activities to Characters',
    'Race Portrait Image Generation > Image Prompt Builder > Prevent Duplicate Activities',
    'Race Portrait Image Generation > Image Prompt Builder > Track Which Prompts Were Used',
    'Race Portrait Image Generation > Execution Reliability',
    'Race Portrait Image Generation > Execution Reliability > One Run at a Time',
    'Race Portrait Image Generation > Execution Reliability > Retry Download on Failure',
    'Race Portrait Image Generation > Execution Reliability > Know When to Retry',
    'Race Portrait Image Generation > Execution Reliability > Wait Times Between Attempts',
    'Race Portrait Image Generation > Execution Reliability > Resume From Last Completed Item',
    'Race Portrait Image Generation > Execution Reliability > Handle Bad Requests Gracefully',
    'Race Portrait Image Generation > Execution Reliability > Recover Failed Downloads',
    'Race Portrait Image Generation > Quality Gates',
    'Race Portrait Image Generation > Quality Gates > Require Square Images',
    'Race Portrait Image Generation > Quality Gates > Reject Images With Blank Borders',
    'Race Portrait Image Generation > Quality Gates > Verify Image Is Readable',
    'Race Portrait Image Generation > Quality Gates > Require Full Body in Frame',
    'Race Portrait Image Generation > Quality Gates > Reject Duplicate Images',
    'Race Portrait Image Generation > Quality Gates > Reject Images With UI Arrows',
    'Race Portrait Image Generation > Quality Gates > Require Edge-to-Edge Image',
    'Race Portrait Image Generation > Post Generation Verification',
    'Race Portrait Image Generation > Post Generation Verification > Track Activities Per Character',
    'Race Portrait Image Generation > Post Generation Verification > Verify Images Match In-Game Data',
    'Race Portrait Image Generation > Post Generation Verification > Check Glossary Image Paths Match',
    'Race Portrait Image Generation > Post Generation Verification > Check All Activities Are Covered',
    'Race Portrait Image Generation > Post Generation Verification > Decide Which Duplicate to Keep',
    'Race Portrait Image Generation > Post Generation Verification > Manual Approval Capture',
    'Race Portrait Image Generation > Post Generation Verification > Log Verification Results',
    'Race Portrait Image Generation > Backlog Regeneration Runner',
    'Race Portrait Image Generation > Backlog Regeneration Runner > Process Any Backlog Category',
    'Race Portrait Image Generation > Backlog Regeneration Runner > Backlog Parsing and Filtering',
    'Race Portrait Image Generation > Backlog Regeneration Runner > Run Specific Race and Gender Combos',
    'Race Portrait Image Generation > Backlog Regeneration Runner > Record Status After Each Image',
    'Race Portrait Image Generation > Backlog Regeneration Runner > Auto-Update the Run Guide',
    'Race Portrait Image Generation > Backlog Regeneration Runner > Audit After Each Run',
    'Race Portrait Image Generation > Future Capability Expansion',
    'Race Portrait Image Generation > Future Capability Expansion > Quick-Fail Branch Test Runner',
    'Race Portrait Image Generation > Future Capability Expansion > Where Node Tests Are Defined',
    'Race Portrait Image Generation > Future Capability Expansion > Quick-Fail Test Executor',
    'Race Portrait Image Generation > Future Capability Expansion > How Long Test Logs Are Kept',
    'Race Portrait Image Generation > Future Capability Expansion > Test Status Badges on Nodes'
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
  ]),
  'character creator': new Set([
    'Character Creator',
    'Character Creator > Wizard Flow',
    'Character Creator > Background Confirmation Flow',
    'Character Creator > Step Validation And Progression'
  ]),
  'merchant pricing and economy integration': new Set([
    'Merchant Pricing And Economy Integration',
    'Merchant Pricing And Economy Integration > Transaction Price Calculation',
    'Merchant Pricing And Economy Integration > Regional Price Modifiers',
    'Merchant Pricing And Economy Integration > Merchant Modal Price Wiring'
  ]),
  'companion banter': new Set([
    'Companion Banter',
    'Companion Banter > Player Directed Banter',
    'Companion Banter > NPC To NPC Banter',
    'Companion Banter > Escalation Line Selection'
  ]),
  'voyage management': new Set([
    'Voyage Management',
    'Voyage Management > Voyage Event Resolution',
    'Voyage Management > Voyage State Progression',
    'Voyage Management > Naval Travel Reliability'
  ]),
  'noble house generation': new Set([
    'Noble House Generation',
    'Noble House Generation > Seeded House Variation',
    'Noble House Generation > House Identity Composition',
    'Noble House Generation > Intrigue System Support'
  ]),
  'url and history state synchronization': new Set([
    'URL And History State Synchronization',
    'URL And History State Synchronization > Initial Mount Guard',
    'URL And History State Synchronization > Deep Link Restoration',
    'URL And History State Synchronization > Browser Navigation Consistency'
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
  'Character Creator': {
    layman: 'Top-level branch for the player-facing character creation flow.',
    canonicalDocs: [
      'docs/tasks/feature-capabilities/character-creator.md'
    ]
  },
  'Character Creator > Wizard Flow': {
    layman: 'The multi-step creation wizard that walks the player through building a character.',
    canonicalDocs: [
      'docs/tasks/feature-capabilities/character-creator.md'
    ]
  },
  'Character Creator > Background Confirmation Flow': {
    layman: 'Background selection currently auto-populates and then requires explicit confirmation before progression.',
    canonicalDocs: [
      'docs/tasks/feature-capabilities/character-creator.md'
    ]
  },
  'Character Creator > Step Validation And Progression': {
    layman: 'Each creator step enforces progression rules so the wizard cannot advance in an invalid state.',
    canonicalDocs: [
      'docs/tasks/feature-capabilities/character-creator.md'
    ]
  },
  'Merchant Pricing And Economy Integration': {
    layman: 'Top-level branch for shared market pricing and merchant UI integration.',
    canonicalDocs: [
      'docs/tasks/feature-capabilities/merchant-pricing-economy.md',
      'docs/tasks/worldsmith-economy-plan.md'
    ]
  },
  'Merchant Pricing And Economy Integration > Transaction Price Calculation': {
    layman: 'Buy and sell values come from shared pricing rules instead of merchant-only hardcoded math.',
    canonicalDocs: [
      'docs/tasks/feature-capabilities/merchant-pricing-economy.md',
      'docs/tasks/worldsmith-economy-plan.md'
    ]
  },
  'Merchant Pricing And Economy Integration > Regional Price Modifiers': {
    layman: 'Regional wealth and economy state can change local prices, so markets do not all feel identical.',
    canonicalDocs: [
      'docs/tasks/feature-capabilities/merchant-pricing-economy.md',
      'docs/tasks/worldsmith-economy-plan.md'
    ]
  },
  'Merchant Pricing And Economy Integration > Merchant Modal Price Wiring': {
    layman: 'Merchant screens must route visible prices through the shared economy layer so UI and simulation stay aligned.',
    canonicalDocs: [
      'docs/tasks/feature-capabilities/merchant-pricing-economy.md',
      'docs/tasks/worldsmith-economy-plan.md'
    ]
  },
  'Companion Banter': {
    layman: 'Top-level branch for companion and party banter behavior.',
    canonicalDocs: [
      'docs/tasks/feature-capabilities/companion-banter.md'
    ]
  },
  'Companion Banter > Player Directed Banter': {
    layman: 'Some banter lines are spoken toward the player and need their own conversation framing.',
    canonicalDocs: [
      'docs/tasks/feature-capabilities/companion-banter.md'
    ]
  },
  'Companion Banter > NPC To NPC Banter': {
    layman: 'Companions should also talk to each other directly instead of routing every exchange through the player.',
    canonicalDocs: [
      'docs/tasks/feature-capabilities/companion-banter.md'
    ]
  },
  'Companion Banter > Escalation Line Selection': {
    layman: 'Escalation logic chooses stronger follow-up lines when a banter sequence intensifies.',
    canonicalDocs: [
      'docs/tasks/feature-capabilities/companion-banter.md'
    ]
  },
  'Voyage Management': {
    layman: 'Top-level branch for naval travel and voyage-state management.',
    canonicalDocs: [
      'docs/tasks/feature-capabilities/voyage-management.md'
    ]
  },
  'Voyage Management > Voyage Event Resolution': {
    layman: 'Voyages can trigger events and those events need deterministic, testable resolution behavior.',
    canonicalDocs: [
      'docs/tasks/feature-capabilities/voyage-management.md'
    ]
  },
  'Voyage Management > Voyage State Progression': {
    layman: 'The active voyage should move through its lifecycle without losing or corrupting state.',
    canonicalDocs: [
      'docs/tasks/feature-capabilities/voyage-management.md'
    ]
  },
  'Voyage Management > Naval Travel Reliability': {
    layman: 'Travel behavior should remain stable even when event outcomes depend on random rolls.',
    canonicalDocs: [
      'docs/tasks/feature-capabilities/voyage-management.md'
    ]
  },
  'Noble House Generation': {
    layman: 'Top-level branch for intrigue-facing noble house generation.',
    canonicalDocs: [
      'docs/tasks/feature-capabilities/noble-house-generation.md'
    ]
  },
  'Noble House Generation > Seeded House Variation': {
    layman: 'Different seeds should produce meaningfully different noble houses instead of repeating the same result.',
    canonicalDocs: [
      'docs/tasks/feature-capabilities/noble-house-generation.md'
    ]
  },
  'Noble House Generation > House Identity Composition': {
    layman: 'Generated houses should combine names, traits, and markers into a coherent faction identity.',
    canonicalDocs: [
      'docs/tasks/feature-capabilities/noble-house-generation.md'
    ]
  },
  'Noble House Generation > Intrigue System Support': {
    layman: 'House generation exists to feed broader intrigue and political systems, not stand alone as a toy generator.',
    canonicalDocs: [
      'docs/tasks/feature-capabilities/noble-house-generation.md'
    ]
  },
  'URL And History State Synchronization': {
    layman: 'Top-level branch for browser history and deep-link state synchronization.',
    canonicalDocs: [
      'docs/tasks/feature-capabilities/url-history-state-sync.md'
    ]
  },
  'URL And History State Synchronization > Initial Mount Guard': {
    layman: 'Initial render should not write misleading history state before the screen has resolved its first real state.',
    canonicalDocs: [
      'docs/tasks/feature-capabilities/url-history-state-sync.md'
    ]
  },
  'URL And History State Synchronization > Deep Link Restoration': {
    layman: 'Deep links should restore the intended application state without incorrect intermediate history writes.',
    canonicalDocs: [
      'docs/tasks/feature-capabilities/url-history-state-sync.md'
    ]
  },
  'URL And History State Synchronization > Browser Navigation Consistency': {
    layman: 'Back and forward navigation should reflect real state transitions instead of stale snapshots.',
    canonicalDocs: [
      'docs/tasks/feature-capabilities/url-history-state-sync.md'
    ]
  },
  'Roadmap Tool': {
    layman: 'Internal roadmap tooling branch that tracks roadmap feature development itself.',
    canonicalDocs: [
      'devtools/roadmap/ROADMAP-TOOL-REFERENCE.local.md',
      'devtools/roadmap/scripts/roadmap-server-logic.ts'
    ]
  },
  'Roadmap Tool > Visualization Stability': {
    layman: 'Visual reliability work so roadmap links, branch geometry, and graph readability remain stable while expanding/collapsing.',
    canonicalDocs: [
      'devtools/roadmap/src/components/debug/roadmap/graph.ts',
      'devtools/roadmap/src/components/debug/roadmap/RoadmapVisualizer.tsx'
    ]
  },
  'Roadmap Tool > Visualization Stability > Connector Rendering Reliability': {
    layman: 'Hardens connector drawing for edge cases like near-flat paths and filter-related visibility failures.',
    canonicalDocs: [
      'devtools/roadmap/src/components/debug/roadmap/utils.ts',
      'devtools/roadmap/src/components/debug/roadmap/graph.ts',
      'devtools/roadmap/src/components/debug/roadmap/RoadmapVisualizer.tsx'
    ]
  },
  'Roadmap Tool > Interaction UX': {
    layman: 'Player/operator interaction quality for canvas drag, zoom, and panel behavior.',
    canonicalDocs: [
      'devtools/roadmap/src/components/debug/roadmap/RoadmapVisualizer.tsx'
    ]
  },
  'Roadmap Tool > Interaction UX > Panel Scroll Without Canvas Zoom': {
    layman: 'Scrolling inside the details panel should not also zoom the canvas in the background.',
    canonicalDocs: [
      'devtools/roadmap/src/components/debug/roadmap/modules/panel-scroll-isolation.ts'
    ]
  },
  'Roadmap Tool > Interaction UX > Canvas Pan Drag Navigation': {
    layman: 'Dragging the roadmap background pans the canvas so users can navigate large node graphs.',
    canonicalDocs: [
      'devtools/roadmap/src/components/debug/roadmap/modules/canvas-pan-navigation.ts'
    ]
  },
  'Roadmap Tool > Interaction UX > Wheel Zoom Around Cursor': {
    layman: 'Mouse wheel zoom is centered around pointer position instead of fixed viewport center.',
    canonicalDocs: [
      'devtools/roadmap/src/components/debug/roadmap/modules/cursor-centered-wheel-zoom.ts'
    ]
  },
  'Roadmap Tool > Interaction UX > Node Drag Repositioning': {
    layman: 'Individual nodes and visible branches can be dragged to custom positions.',
    canonicalDocs: [
      'devtools/roadmap/src/components/debug/roadmap/modules/node-position-editing.ts'
    ]
  },
  'Roadmap Tool > Interaction UX > Single Node Expand Collapse': {
    layman: 'Clicking an expandable node toggles only that node branch.',
    canonicalDocs: [
      'devtools/roadmap/src/components/debug/roadmap/modules/branch-toggle-per-node.ts'
    ]
  },
  'Roadmap Tool > Interaction UX > Expand All And Collapse All Controls': {
    layman: 'Global controls open or close all expandable roadmap branches at once.',
    canonicalDocs: [
      'devtools/roadmap/src/components/debug/roadmap/modules/global-branch-expansion-controls.ts'
    ]
  },
  'Roadmap Tool > Interaction UX > View Reset Control': {
    layman: 'Reset view returns canvas pan and zoom to default framing without altering node placements.',
    canonicalDocs: [
      'devtools/roadmap/src/components/debug/roadmap/modules/canvas-view-reset.ts'
    ]
  },
  'Roadmap Tool > Interaction UX > Node Detail Drawer': {
    layman: 'Selecting a node opens a contextual side drawer with status, docs, and actions.',
    canonicalDocs: [
      'devtools/roadmap/src/components/debug/roadmap/modules/node-detail-panel.ts'
    ]
  },
  'Roadmap Tool > Interaction UX > Open Related Docs In VS Code': {
    layman: 'Node detail action posts to local bridge endpoint to open docs directly in VS Code.',
    canonicalDocs: [
      'devtools/roadmap/src/components/debug/roadmap/modules/related-document-launch.ts',
      'vite.config.ts'
    ]
  },
  'Roadmap Tool > Interaction UX > Related Docs Type Indicators': {
    layman: 'Related docs list shows compact file-type badges so markdown/code/config files are instantly recognizable before opening.',
    canonicalDocs: [
      'devtools/roadmap/src/components/debug/roadmap/modules/related-document-type-badging.ts'
    ]
  },
  'Roadmap Tool > Layout Persistence': {
    layman: 'Node positions and layout behaviors are saved and restored predictably across sessions.',
    canonicalDocs: [
      'devtools/roadmap/src/components/debug/roadmap/RoadmapVisualizer.tsx',
      'vite.config.ts'
    ]
  },
  'Roadmap Tool > Layout Persistence > Auto-Save and Manual Save Clarity': {
    layman: 'Clarifies and hardens manual save vs auto-save behavior so layout state is obvious and reliable.',
    canonicalDocs: [
      'devtools/roadmap/src/components/debug/roadmap/RoadmapVisualizer.tsx'
    ]
  },
  'Roadmap Tool > Layout Persistence > Layout Restore On Load': {
    layman: 'Saved node positions are loaded when roadmap opens so user layout survives sessions.',
    canonicalDocs: [
      'devtools/roadmap/src/components/debug/roadmap/RoadmapVisualizer.tsx',
      'vite.config.ts'
    ]
  },
  'Roadmap Tool > Layout Persistence > Auto-save Debounce Cycle': {
    layman: 'Rapid drag updates are batched through debounce before writing layout to storage.',
    canonicalDocs: [
      'devtools/roadmap/src/components/debug/roadmap/RoadmapVisualizer.tsx'
    ]
  },
  'Roadmap Tool > Layout Persistence > Manual Save Trigger': {
    layman: 'Explicit save action persists current node offsets immediately.',
    canonicalDocs: [
      'devtools/roadmap/src/components/debug/roadmap/RoadmapVisualizer.tsx'
    ]
  },
  'Roadmap Tool > Layout Persistence > Reset Node Position Overrides': {
    layman: 'Reset layout clears manual offsets and returns nodes to computed positions.',
    canonicalDocs: [
      'devtools/roadmap/src/components/debug/roadmap/RoadmapVisualizer.tsx'
    ]
  },
  'Roadmap Tool > Node Test Execution Capability': {
    layman: 'Capability for running node-scoped checks directly from the roadmap detail drawer.',
    canonicalDocs: [
      'devtools/roadmap/src/components/debug/roadmap/RoadmapVisualizer.tsx',
      'vite.config.ts',
      'devtools/roadmap/scripts/roadmap-node-test.ts'
    ]
  },
  'Roadmap Tool > Node Test Execution Capability > Run Node Test (Self Plus Descendants)': {
    layman: 'Runs selected node plus descendant runnable test set in one action.',
    canonicalDocs: [
      'devtools/roadmap/src/components/debug/roadmap/RoadmapVisualizer.tsx'
    ]
  },
  'Roadmap Tool > Node Test Execution Capability > Run Child Node Tests (Descendants Only)': {
    layman: 'Runs only descendant runnable tests without including selected node self checks.',
    canonicalDocs: [
      'devtools/roadmap/src/components/debug/roadmap/RoadmapVisualizer.tsx'
    ]
  },
  'Roadmap Tool > Node Test Execution Capability > Node Test Result Status Feedback': {
    layman: 'UI shows pass/fail summary and first failure details after each run.',
    canonicalDocs: [
      'devtools/roadmap/src/components/debug/roadmap/RoadmapVisualizer.tsx'
    ]
  },
  'Roadmap Tool > Node Test Execution Capability > Node Test Status Persistence': {
    layman: 'Latest node test outcomes persist into local roadmap status store for later sessions.',
    canonicalDocs: [
      'devtools/roadmap/scripts/roadmap-engine/node-test-status.ts'
    ]
  },
  'Roadmap Tool > Node Test Execution Capability > Node Test Data Refresh After Run': {
    layman: 'After execution, roadmap data reloads so badges/status reflect updated test metadata.',
    canonicalDocs: [
      'devtools/roadmap/src/components/debug/roadmap/RoadmapVisualizer.tsx'
    ]
  },
  'Roadmap Tool > Roadmap API Surface Capability': {
    layman: 'Dev-server roadmap endpoints that power visualizer data, layout, tests, opportunities, and editor actions.',
    canonicalDocs: [
      'vite.config.ts',
      'devtools/roadmap/scripts/roadmap-server-logic.ts'
    ]
  },
  'Roadmap Tool > Roadmap API Surface Capability > Roadmap Data Endpoint': {
    layman: 'Serves generated roadmap graph payload used by the UI.',
    canonicalDocs: [
      'vite.config.ts',
      'devtools/roadmap/scripts/roadmap-server-logic.ts'
    ]
  },
  'Roadmap Tool > Roadmap API Surface Capability > Layout Endpoint (Read Write)': {
    layman: 'Provides layout load/save endpoint for roadmap position persistence.',
    canonicalDocs: [
      'vite.config.ts'
    ]
  },
  'Roadmap Tool > Roadmap API Surface Capability > Node Test Run Endpoint': {
    layman: 'Accepts node ids and executes roadmap node tests through local runner.',
    canonicalDocs: [
      'vite.config.ts',
      'devtools/roadmap/scripts/roadmap-node-test.ts'
    ]
  },
  'Roadmap Tool > Roadmap API Surface Capability > Opportunities Latest Endpoint': {
    layman: 'Returns latest opportunities payload for collector drawer and summary badges.',
    canonicalDocs: [
      'vite.config.ts',
      'devtools/roadmap/scripts/roadmap-server-logic.ts'
    ]
  },
  'Roadmap Tool > Roadmap API Surface Capability > Opportunities Scan Endpoint': {
    layman: 'Triggers on-demand opportunity scan and returns refreshed payload.',
    canonicalDocs: [
      'vite.config.ts',
      'devtools/roadmap/scripts/roadmap-server-logic.ts'
    ]
  },
  'Roadmap Tool > Roadmap API Surface Capability > Opportunities Settings Endpoint': {
    layman: 'Reads and writes roadmap opportunity scanner settings.',
    canonicalDocs: [
      'vite.config.ts',
      'devtools/roadmap/scripts/roadmap-server-logic.ts'
    ]
  },
  'Roadmap Tool > Roadmap API Surface Capability > VS Code Open Endpoint': {
    layman: 'Local endpoint opens selected doc paths in VS Code from roadmap UI.',
    canonicalDocs: [
      'vite.config.ts'
    ]
  },
  'Roadmap Tool > Documentation Intelligence': {
    layman: 'Capability for feature-focused document understanding and roadmap derivation from verified docs.',
    canonicalDocs: [
      'devtools/roadmap/scripts/roadmap-orchestrate-one-doc.ts',
      'devtools/roadmap/scripts/roadmap-session-close.ts'
    ]
  },
  'Roadmap Tool > Documentation Intelligence > One-Doc Orchestrated Processing Pipeline': {
    layman: 'Runs one document at a time through a strict worker packet flow instead of bulk ingestion, so updates stay auditable and reviewable.',
    canonicalDocs: [
      'devtools/roadmap/scripts/roadmap-orchestrate-one-doc.ts'
    ]
  },
  'Roadmap Tool > Documentation Intelligence > One-Doc Orchestrated Processing Pipeline > Worker Packet Validation Gate': {
    layman: 'Every completed worker packet must pass schema validation before it can be reviewed or applied.',
    canonicalDocs: [
      'devtools/roadmap/scripts/roadmap-packet-validation.ts',
      'devtools/roadmap/scripts/roadmap-validate-packet.ts',
      'docs/tasks/roadmap/schemas/run_manifest.schema.json',
      'docs/tasks/roadmap/schemas/report.schema.json',
      'docs/tasks/roadmap/schemas/move_plan.schema.json'
    ]
  },
  'Roadmap Tool > Documentation Intelligence > One-Doc Orchestrated Processing Pipeline > Feature-Oriented Naming Guard': {
    layman: 'Generic process labels are rejected so emitted roadmap nodes stay capability-focused.',
    canonicalDocs: [
      'devtools/roadmap/scripts/roadmap-orchestrate-one-doc.ts',
      'devtools/roadmap/scripts/roadmap-engine/text.ts'
    ]
  },
  'Roadmap Tool > Documentation Intelligence > Feature Taxonomy Integrity': {
    layman: 'Capability that enforces quality checks to prevent generic nodes and keep feature/subfeature naming consistent.',
    canonicalDocs: [
      'devtools/roadmap/scripts/roadmap-engine/text.ts',
      'devtools/roadmap/scripts/roadmap-orchestrate-one-doc.ts'
    ]
  },
  'Roadmap Tool > Strategic Opportunity Mapping': {
    layman: 'Collector capability for finding, ranking, and navigating roadmap opportunities without mixing ownership of the actual fixes.',
    canonicalDocs: [
      'devtools/roadmap/scripts/roadmap-engine/opportunities.ts',
      'devtools/roadmap/src/components/debug/roadmap/RoadmapVisualizer.tsx'
    ]
  },
  'Roadmap Tool > Strategic Opportunity Mapping > Opportunity Collection': {
    layman: 'Node collector surface that lists flagged roadmap nodes and keeps triage focused.',
    canonicalDocs: [
      'devtools/roadmap/scripts/roadmap-engine/opportunities.ts',
      'devtools/roadmap/src/components/debug/roadmap/RoadmapVisualizer.tsx'
    ]
  },
  'Roadmap Tool > Strategic Opportunity Mapping > Opportunity Scan Orchestration': {
    layman: 'Runs deterministic scans over roadmap nodes to detect known opportunity patterns.',
    canonicalDocs: [
      'devtools/roadmap/scripts/roadmap-engine/opportunities/scanner.ts',
      'devtools/roadmap/scripts/roadmap-engine/opportunities/graph.ts',
      'vite.config.ts'
    ]
  },
  'Roadmap Tool > Strategic Opportunity Mapping > Opportunity Flag Classification': {
    layman: 'Classifies opportunities into fixed flag families so results stay consistent and sortable.',
    canonicalDocs: [
      'devtools/roadmap/scripts/roadmap-engine/opportunities/flag-classifier.ts'
    ]
  },
  'Roadmap Tool > Strategic Opportunity Mapping > Opportunity Propagation and Rollup': {
    layman: 'Builds parent-level rollups from descendant flags so branch health can be seen at a glance.',
    canonicalDocs: [
      'devtools/roadmap/scripts/roadmap-engine/opportunities/propagation.ts',
      'devtools/roadmap/src/components/debug/roadmap/RoadmapVisualizer.tsx'
    ]
  },
  'Roadmap Tool > Strategic Opportunity Mapping > Opportunity Snapshot Persistence': {
    layman: 'Persists local scan snapshots and logs so trend history survives across sessions.',
    canonicalDocs: [
      'devtools/roadmap/scripts/roadmap-engine/opportunities/storage.ts',
      '.agent/roadmap-local/opportunities'
    ]
  },
  'Roadmap Tool > Strategic Opportunity Mapping > Opportunity Scan Trigger': {
    layman: 'Supports both periodic background scans and explicit user-triggered scans.',
    canonicalDocs: [
      'devtools/roadmap/src/components/debug/roadmap/modules/opportunity-scan-initiation.ts',
      'vite.config.ts'
    ]
  },
  'Roadmap Tool > Strategic Opportunity Mapping > Opportunity Triage Panel': {
    layman: 'Dedicated roadmap drawer for opportunity triage, mode toggles, and quick scan controls.',
    canonicalDocs: [
      'devtools/roadmap/src/components/debug/roadmap/modules/opportunity-triage-workspace.ts'
    ]
  },
  'Roadmap Tool > Strategic Opportunity Mapping > Opportunity-to-Node Navigation': {
    layman: 'Clicking an opportunity centers and selects the target roadmap node.',
    canonicalDocs: [
      'devtools/roadmap/src/components/debug/roadmap/modules/opportunity-to-node-navigation.ts'
    ]
  },
  'Roadmap Tool > Strategic Opportunity Mapping > Opportunity Crosslink Detection': {
    layman: 'Detects cross-branch documentation overlap and suggests missing owner crosslinks.',
    canonicalDocs: [
      'devtools/roadmap/scripts/roadmap-engine/opportunities/crosslink-resolver.ts'
    ]
  },
  'Roadmap Tool > Strategic Opportunity Mapping > Opportunity Module Architecture': {
    layman: 'Dedicated child branch that groups the opportunity engine module implementation nodes under one architecture-focused cluster.',
    canonicalDocs: [
      'devtools/roadmap/scripts/roadmap-engine/opportunities.ts',
      'devtools/roadmap/scripts/roadmap-engine/opportunities/scanner.ts'
    ]
  },
  'Roadmap Tool > Strategic Opportunity Mapping > Opportunity Module Architecture > Opportunity Public Facade Module': {
    layman: 'Stable public export surface so callers can import opportunities without deep-path coupling.',
    canonicalDocs: [
      'devtools/roadmap/scripts/roadmap-engine/opportunities.ts',
      'devtools/roadmap/scripts/roadmap-engine/opportunities/facade.test.ts'
    ]
  },
  'Roadmap Tool > Strategic Opportunity Mapping > Opportunity Module Architecture > Opportunity Type Contracts Module': {
    layman: 'Shared type contracts and fixed flag vocabulary used by all opportunities modules.',
    canonicalDocs: [
      'devtools/roadmap/scripts/roadmap-engine/opportunities/types.ts',
      'devtools/roadmap/scripts/roadmap-engine/opportunities/types.test.ts'
    ]
  },
  'Roadmap Tool > Strategic Opportunity Mapping > Opportunity Module Architecture > Opportunity Graph Context Module': {
    layman: 'Tree and edge context helpers used by scanner passes to derive ancestry/descendants and ownership.',
    canonicalDocs: [
      'devtools/roadmap/scripts/roadmap-engine/opportunities/graph.ts',
      'devtools/roadmap/scripts/roadmap-engine/opportunities/graph.test.ts'
    ]
  },
  'Roadmap Tool > Strategic Opportunity Mapping > Opportunity Module Architecture > Opportunity Scanner Module': {
    layman: 'End-to-end scanner orchestration that runs classification, propagation, and persistence.',
    canonicalDocs: [
      'devtools/roadmap/scripts/roadmap-engine/opportunities/scanner.ts',
      'devtools/roadmap/scripts/roadmap-engine/opportunities/scanner.test.ts'
    ]
  },
  'Roadmap Tool > Strategic Opportunity Mapping > Opportunity Module Architecture > Opportunity Flag Classifier Module': {
    layman: 'Direct node-level flag assignment rules for tests/docs/staleness/crosslinks.',
    canonicalDocs: [
      'devtools/roadmap/scripts/roadmap-engine/opportunities/flag-classifier.ts',
      'devtools/roadmap/scripts/roadmap-engine/opportunities/flag-classifier.test.ts'
    ]
  },
  'Roadmap Tool > Strategic Opportunity Mapping > Opportunity Module Architecture > Opportunity Propagation Module': {
    layman: 'Parent rollup logic and summary counters for propagated descendant flags.',
    canonicalDocs: [
      'devtools/roadmap/scripts/roadmap-engine/opportunities/propagation.ts',
      'devtools/roadmap/scripts/roadmap-engine/opportunities/propagation.test.ts'
    ]
  },
  'Roadmap Tool > Strategic Opportunity Mapping > Opportunity Module Architecture > Opportunity Crosslink Resolver Module': {
    layman: 'Cross-branch overlap matcher that suggests missing sequence ownership links.',
    canonicalDocs: [
      'devtools/roadmap/scripts/roadmap-engine/opportunities/crosslink-resolver.ts',
      'devtools/roadmap/scripts/roadmap-engine/opportunities/crosslink-resolver.test.ts'
    ]
  },
  'Roadmap Tool > Strategic Opportunity Mapping > Opportunity Module Architecture > Opportunity Storage And Sanitization Module': {
    layman: 'Local storage persistence and sanitization layer for settings, snapshots, logs, and latest payload.',
    canonicalDocs: [
      'devtools/roadmap/scripts/roadmap-engine/opportunities/storage.ts',
      'devtools/roadmap/scripts/roadmap-engine/opportunities/storage.test.ts'
    ]
  },
  'Roadmap Tool > Strategic Opportunity Mapping > Opportunity Filters and Sorts': {
    layman: 'Planned enrichment for deeper filtering/sorting views across large flagged-node sets.',
    canonicalDocs: [
      'devtools/roadmap/src/components/debug/roadmap/modules/opportunity-filtering-and-sorting.ts'
    ]
  },
  'Roadmap Tool > Strategic Opportunity Mapping > Historical Development Traceability': {
    layman: 'Capability to reconstruct older roadmap context from commit history when historical traceability is needed.',
    canonicalDocs: [
      'devtools/roadmap/src/components/debug/roadmap/modules/roadmap-history-traceability.ts'
    ]
  },
  'Roadmap Tool > Strategic Opportunity Mapping > Multi-Product Portfolio Branching (Future)': {
    layman: 'Future capability for multiple product roadmaps under one trunk, kept planned until current workflow stabilizes.',
    canonicalDocs: [
      'devtools/roadmap/src/components/debug/roadmap/modules/multi-product-roadmap-branching.ts'
    ]
  },
  // Technical: explicit capability-first parent mappings ensure these nodes keep
  // program evidence even when they are synthesized via renamed taxonomy rules.
  // Layman: these parent cards should not look docs-only when their implementation
  // lives in current roadmap visualizer/opportunity UI code.
  'Roadmap Tool > Strategic Opportunity Mapping > Opportunity Operations > Opportunity Scan Initiation': {
    layman: 'Capability parent for scan-trigger interaction and controls.',
    canonicalDocs: [
      'devtools/roadmap/src/components/debug/roadmap/RoadmapVisualizer.tsx',
      'vite.config.ts'
    ]
  },
  'Roadmap Tool > Strategic Opportunity Mapping > Opportunity Operations > Opportunity Triage Workspace': {
    layman: 'Capability parent for the opportunity triage workspace and drawer behavior.',
    canonicalDocs: [
      'devtools/roadmap/src/components/debug/roadmap/RoadmapVisualizer.tsx'
    ]
  },
  'Roadmap Tool > Strategic Opportunity Mapping > Opportunity Operations > Opportunity To Node Navigation': {
    layman: 'Capability parent for routing from opportunity rows to roadmap node focus.',
    canonicalDocs: [
      'devtools/roadmap/src/components/debug/roadmap/RoadmapVisualizer.tsx'
    ]
  },
  'Roadmap Tool > Strategic Opportunity Mapping > Opportunity Operations > Opportunity Filtering And Sorting': {
    layman: 'Capability parent for filtering and sorting controls in opportunity operations.',
    canonicalDocs: [
      'devtools/roadmap/src/components/debug/roadmap/RoadmapVisualizer.tsx'
    ]
  },
  'Roadmap Tool > Strategic Opportunity Mapping > Governance Capability > Roadmap History Traceability': {
    layman: 'Capability parent for historical roadmap traceability behavior.',
    canonicalDocs: [
      'devtools/roadmap/src/components/debug/roadmap/RoadmapVisualizer.tsx'
    ]
  },
  'Roadmap Tool > Strategic Opportunity Mapping > Governance Capability > Multi-product Roadmap Branching Future': {
    layman: 'Capability parent for future multi-product roadmap branching behavior.',
    canonicalDocs: [
      'devtools/roadmap/src/components/debug/roadmap/RoadmapVisualizer.tsx'
    ]
  },
  'Roadmap Tool > Spell Branch Navigator': {
    layman: 'Tab-based navigator for browsing the spell library through a series of discriminating axis choices — class, level, school, and so on — until a filtered spell list is shown.',
    canonicalDocs: [
      'devtools/roadmap/src/spell-branch/SpellBranchNavigator.tsx',
      'devtools/roadmap/src/spell-branch/axis-engine.ts'
    ]
  },
  'Roadmap Tool > Spell Branch Navigator > Axis Engine': {
    layman: 'Pure function that takes the full spell set plus all choices made so far, filters down to matching spells, and returns the remaining discriminating axes with value counts.',
    canonicalDocs: [
      'devtools/roadmap/src/spell-branch/axis-engine.ts'
    ]
  },
  'Roadmap Tool > Spell Branch Navigator > VSM Drill-Down Navigator': {
    layman: 'Step-by-step axis selection UI where each choice narrows the spell pool and reveals the next set of filters, ending at a filtered spell list.',
    canonicalDocs: [
      'devtools/roadmap/src/spell-branch/SpellBranchNavigator.tsx',
      'devtools/roadmap/src/spell-branch/vsm-tree.ts'
    ]
  },
  'Roadmap Tool > Spell Branch Navigator > Requirements Component Mapping': {
    layman: 'Maps raw V/S/M component combinations to human-readable labels (e.g. "Verbal + Somatic") so the Requirements axis is readable in the navigator.',
    canonicalDocs: [
      'devtools/roadmap/src/spell-branch/vsm-tree.ts',
      'devtools/roadmap/src/spell-branch/axis-engine.ts'
    ]
  },
  'Roadmap Tool > Spell Graph Navigation': {
    layman: 'Overlay that mounts a live spell decision tree inside the roadmap canvas when the Spells project node is expanded, letting users drill into spells directly from the graph view.',
    canonicalDocs: [
      'devtools/roadmap/src/spell-branch/SpellGraphOverlay.tsx',
      'devtools/roadmap/src/components/debug/roadmap/RoadmapVisualizer.tsx'
    ]
  },
  'Roadmap Tool > Spell Graph Navigation > Live Axis Filtering Engine': {
    layman: 'Recursive virtual-node builder that re-runs the axis engine at each expanded value node, producing an arbitrarily deep drill path limited by MAX_DEPTH = 14.',
    canonicalDocs: [
      'devtools/roadmap/src/spell-branch/SpellGraphOverlay.tsx',
      'devtools/roadmap/src/spell-branch/axis-engine.ts'
    ]
  },
  'Roadmap Tool > Spell Graph Navigation > Canvas-Coordinated Node Layout': {
    layman: 'Pure layout function that places virtual spell nodes in depth-column × leaf-cursor grid, centering each parent over its children and sharing canvas coordinates with real roadmap nodes.',
    canonicalDocs: [
      'devtools/roadmap/src/spell-branch/SpellGraphOverlay.tsx',
      'devtools/roadmap/src/components/debug/roadmap/constants.ts'
    ]
  },
  'Roadmap Tool > Spell Graph Navigation > Spell Branch Tab Handoff': {
    layman: 'Show Spells virtual nodes expose an "Open in Spell Branch" action that switches to the Spell Branch tab with all current axis choices pre-applied.',
    canonicalDocs: [
      'devtools/roadmap/src/spell-branch/SpellGraphOverlay.tsx',
      'devtools/roadmap/src/spell-branch/SpellBranchNavigator.tsx'
    ]
  },
  'Roadmap Tool > Node Media Previews': {
    layman: 'Attaches PNG/GIF captures to leaf nodes so the info panel can show a focused visual of the capability in action.',
    canonicalDocs: [
      'devtools/roadmap/.media/.gitkeep',
      'devtools/roadmap/src/components/debug/roadmap/RoadmapVisualizer.tsx'
    ]
  },
  'Roadmap Tool > Node Media Previews > Convention-Based Media Scanner': {
    layman: 'Scans .media/ at server startup and stamps hasMedia on any node whose ID has a matching file.',
    canonicalDocs: [
      'devtools/roadmap/scripts/roadmap/node-media-presence/media-scanner.ts'
    ]
  },
  'Roadmap Tool > Node Media Previews > Media File Endpoint': {
    layman: 'GET /api/roadmap/media/:nodeId serves the raw PNG or GIF file from .media/.',
    canonicalDocs: [
      'vite.config.ts'
    ]
  },
  'Roadmap Tool > Node Media Previews > Info Panel Preview Button': {
    layman: '"View Preview" button appears in the node info panel only when a media file exists for that node.',
    canonicalDocs: [
      'devtools/roadmap/src/components/debug/roadmap/RoadmapVisualizer.tsx'
    ]
  },
  'Roadmap Tool > Node Media Previews > Lightbox Viewer': {
    layman: 'Dark overlay lightbox that shows the full image or GIF, dismissed by clicking the overlay or pressing Escape.',
    canonicalDocs: [
      'devtools/roadmap/src/components/debug/roadmap/RoadmapVisualizer.tsx'
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
      'devtools/roadmap/scripts/roadmap-engine/generate.ts'
    ]
  },
  'Race Portrait Image Generation > Future Capability Expansion > Node Test Definition Registry': {
    layman: 'Each generated node now carries a unique test id and default runnable test command.',
    canonicalDocs: [
      'devtools/roadmap/scripts/roadmap-engine/generate.ts',
      'devtools/roadmap/scripts/roadmap-engine/types.ts'
    ]
  },
  'Race Portrait Image Generation > Future Capability Expansion > Fail Fast Branch Test Executor': {
    layman: 'A dedicated CLI now executes node checks and returns non-zero on failure for fail-fast behavior.',
    canonicalDocs: [
      'devtools/roadmap/scripts/roadmap-node-test.ts'
    ]
  },
  'Race Portrait Image Generation > Future Capability Expansion > Test Log Retention Policy': {
    layman: 'Node test outcomes are persisted to roadmap-local JSON so pass/fail history survives session restarts.',
    canonicalDocs: [
      '.agent/roadmap-local/node-test-status.json',
      'devtools/roadmap/scripts/roadmap-engine/node-test-status.ts'
    ]
  },
  'Race Portrait Image Generation > Future Capability Expansion > Roadmap Node Test Badges': {
    layman: 'Planned visual badges in roadmap UI showing latest test pass/fail state per node.',
    canonicalDocs: [
      'devtools/roadmap/src/components/debug/roadmap/RoadmapVisualizer.tsx'
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
      'docs/portraits/race_portrait_regen_handoff.md'
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
  'roadmap tool': [
    'Roadmap Tool',
    'Roadmap Tool > Graph Display Stability',
    'Roadmap Tool > Interaction And Navigation',
    'Roadmap Tool > Layout Persistence',
    'Roadmap Tool > Run Tests From The Roadmap',
    'Roadmap Tool > Roadmap Server Endpoints',
    'Roadmap Tool > Doc Processing Pipeline',
    'Roadmap Tool > Strategic Opportunity Mapping',
    // Strategic Opportunity Mapping in capability-first mode is grouped by
    // operational buckets; child nodes intentionally avoid "... Capability"
    // suffixes so labels stay concise and feature-oriented in the UI.
    'Roadmap Tool > Strategic Opportunity Mapping > Opportunity Detection',
    'Roadmap Tool > Strategic Opportunity Mapping > Opportunity Detection > Scan Execution Orchestration',
    'Roadmap Tool > Strategic Opportunity Mapping > Opportunity Detection > Opportunity Flag Assignment',
    'Roadmap Tool > Strategic Opportunity Mapping > Opportunity Detection > Parent Rollup Computation',
    'Roadmap Tool > Strategic Opportunity Mapping > Opportunity Detection > Cross-branch Overlap Detection',
    'Roadmap Tool > Strategic Opportunity Mapping > Opportunity Operations',
    'Roadmap Tool > Strategic Opportunity Mapping > Opportunity Operations > Opportunity Capture',
    'Roadmap Tool > Strategic Opportunity Mapping > Opportunity Operations > Opportunity Scan Initiation',
    'Roadmap Tool > Strategic Opportunity Mapping > Opportunity Operations > Opportunity Triage Workspace',
    'Roadmap Tool > Strategic Opportunity Mapping > Opportunity Operations > Opportunity To Node Navigation',
    'Roadmap Tool > Strategic Opportunity Mapping > Opportunity Operations > Opportunity Filtering And Sorting',
    'Roadmap Tool > Strategic Opportunity Mapping > Data Persistence',
    'Roadmap Tool > Strategic Opportunity Mapping > Data Persistence > Snapshot Persistence',
    'Roadmap Tool > Strategic Opportunity Mapping > Governance Capability',
    'Roadmap Tool > Strategic Opportunity Mapping > Governance Capability > Roadmap History Traceability',
    'Roadmap Tool > Strategic Opportunity Mapping > Governance Capability > Multi-product Roadmap Branching Future',
    'Roadmap Tool > Spell Branch Navigator',
    'Roadmap Tool > Spell Graph Navigation',
    'Roadmap Tool > Node Media Previews',
  ],
  'race portrait image generation': [
    'Race Portrait Image Generation',
    'Race Portrait Image Generation > AI Session Manager',
    'Race Portrait Image Generation > Image Prompt Builder',
    'Race Portrait Image Generation > Execution Reliability',
    'Race Portrait Image Generation > Quality Gates',
    'Race Portrait Image Generation > Post Generation Verification',
    'Race Portrait Image Generation > Backlog Regeneration Runner',
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
  ],
  'character creator': [
    'Character Creator',
    'Character Creator > Wizard Flow',
    'Character Creator > Background Confirmation Flow',
    'Character Creator > Step Validation And Progression'
  ],
  'merchant pricing and economy integration': [
    'Merchant Pricing And Economy Integration',
    'Merchant Pricing And Economy Integration > Transaction Price Calculation',
    'Merchant Pricing And Economy Integration > Regional Price Modifiers',
    'Merchant Pricing And Economy Integration > Merchant Modal Price Wiring'
  ],
  'companion banter': [
    'Companion Banter',
    'Companion Banter > Player Directed Banter',
    'Companion Banter > NPC To NPC Banter',
    'Companion Banter > Escalation Line Selection'
  ],
  'voyage management': [
    'Voyage Management',
    'Voyage Management > Voyage Event Resolution',
    'Voyage Management > Voyage State Progression',
    'Voyage Management > Naval Travel Reliability'
  ],
  'noble house generation': [
    'Noble House Generation',
    'Noble House Generation > Seeded House Variation',
    'Noble House Generation > House Identity Composition',
    'Noble House Generation > Intrigue System Support'
  ],
  'url and history state synchronization': [
    'URL And History State Synchronization',
    'URL And History State Synchronization > Initial Mount Guard',
    'URL And History State Synchronization > Deep Link Restoration',
    'URL And History State Synchronization > Browser Navigation Consistency'
  ]
};

// Technical: canonical roadmap source template used to derive capability-first
// roadmap nodes.
// Layman: this is not a rendered branch by itself; it's the source list used to
// build "Roadmap".
const ROADMAP_CAPABILITY_SOURCE_DOCS: ProcessingDocument[] = [
  {
    sourcePath: 'devtools/roadmap/ROADMAP-TOOL-REFERENCE.local.md',
    canonicalPath: 'devtools/roadmap/ROADMAP-TOOL-REFERENCE.local.md',
    featureGroup: 'roadmap-capability-template',
    feature: 'Roadmap Template',
    subFeatures: [
      { name: 'Roadmap Tool', state: 'active', canonicalPath: 'devtools/roadmap/ROADMAP-TOOL-REFERENCE.local.md' },
      { name: 'Roadmap Tool > Visualization Stability', state: 'active', canonicalPath: 'devtools/roadmap/src/components/debug/roadmap/graph.ts' },
      { name: 'Roadmap Tool > Visualization Stability > Connector Rendering Reliability', state: 'done', canonicalPath: 'devtools/roadmap/src/components/debug/roadmap/graph.ts' },
      { name: 'Roadmap Tool > Interaction UX', state: 'active', canonicalPath: 'devtools/roadmap/src/components/debug/roadmap/RoadmapVisualizer.tsx' },
      { name: 'Roadmap Tool > Interaction UX > Panel Scroll Without Canvas Zoom', state: 'done', canonicalPath: 'devtools/roadmap/src/components/debug/roadmap/RoadmapVisualizer.tsx' },
      { name: 'Roadmap Tool > Interaction UX > Related Docs Type Indicators', state: 'done', canonicalPath: 'devtools/roadmap/src/components/debug/roadmap/RoadmapVisualizer.tsx' },
      { name: 'Roadmap Tool > Interaction UX > Canvas Pan Drag Navigation', state: 'done', canonicalPath: 'devtools/roadmap/src/components/debug/roadmap/RoadmapVisualizer.tsx' },
      { name: 'Roadmap Tool > Interaction UX > Wheel Zoom Around Cursor', state: 'done', canonicalPath: 'devtools/roadmap/src/components/debug/roadmap/RoadmapVisualizer.tsx' },
      { name: 'Roadmap Tool > Interaction UX > Node Drag Repositioning', state: 'done', canonicalPath: 'devtools/roadmap/src/components/debug/roadmap/RoadmapVisualizer.tsx' },
      { name: 'Roadmap Tool > Interaction UX > Single Node Expand Collapse', state: 'done', canonicalPath: 'devtools/roadmap/src/components/debug/roadmap/RoadmapVisualizer.tsx' },
      { name: 'Roadmap Tool > Interaction UX > Node Focus and Viewport Containment', state: 'done', canonicalPath: 'devtools/roadmap/src/components/debug/roadmap/modules/node-focus-and-viewport-containment.ts' },
      { name: 'Roadmap Tool > Interaction UX > Expand All And Collapse All Controls', state: 'done', canonicalPath: 'devtools/roadmap/src/components/debug/roadmap/RoadmapVisualizer.tsx' },
      { name: 'Roadmap Tool > Interaction UX > View Reset Control', state: 'done', canonicalPath: 'devtools/roadmap/src/components/debug/roadmap/RoadmapVisualizer.tsx' },
      { name: 'Roadmap Tool > Interaction UX > Node Detail Drawer', state: 'done', canonicalPath: 'devtools/roadmap/src/components/debug/roadmap/RoadmapVisualizer.tsx' },
      { name: 'Roadmap Tool > Interaction UX > Open Related Docs In VS Code', state: 'done', canonicalPath: 'vite.config.ts' },
      { name: 'Roadmap Tool > Layout Persistence', state: 'active', canonicalPath: 'devtools/roadmap/src/components/debug/roadmap/RoadmapVisualizer.tsx' },
      { name: 'Roadmap Tool > Layout Persistence > Auto-Save and Manual Save Clarity', state: 'done', canonicalPath: 'devtools/roadmap/src/components/debug/roadmap/RoadmapVisualizer.tsx' },
      { name: 'Roadmap Tool > Layout Persistence > Layout Restore On Load', state: 'done', canonicalPath: 'vite.config.ts' },
      { name: 'Roadmap Tool > Layout Persistence > Auto-save Debounce Cycle', state: 'done', canonicalPath: 'devtools/roadmap/src/components/debug/roadmap/RoadmapVisualizer.tsx' },
      { name: 'Roadmap Tool > Layout Persistence > Manual Save Trigger', state: 'done', canonicalPath: 'devtools/roadmap/src/components/debug/roadmap/RoadmapVisualizer.tsx' },
      { name: 'Roadmap Tool > Layout Persistence > Reset Node Position Overrides', state: 'done', canonicalPath: 'devtools/roadmap/src/components/debug/roadmap/RoadmapVisualizer.tsx' },
      { name: 'Roadmap Tool > Node Test Execution Capability', state: 'active', canonicalPath: 'devtools/roadmap/scripts/roadmap-node-test.ts' },
      { name: 'Roadmap Tool > Node Test Execution Capability > Run Node Test (Self Plus Descendants)', state: 'done', canonicalPath: 'devtools/roadmap/src/components/debug/roadmap/RoadmapVisualizer.tsx' },
      { name: 'Roadmap Tool > Node Test Execution Capability > Run Child Node Tests (Descendants Only)', state: 'done', canonicalPath: 'devtools/roadmap/src/components/debug/roadmap/RoadmapVisualizer.tsx' },
      { name: 'Roadmap Tool > Node Test Execution Capability > Node Test Result Status Feedback', state: 'done', canonicalPath: 'devtools/roadmap/src/components/debug/roadmap/RoadmapVisualizer.tsx' },
      { name: 'Roadmap Tool > Node Test Execution Capability > Node Test Status Persistence', state: 'done', canonicalPath: 'devtools/roadmap/scripts/roadmap-engine/node-test-status.ts' },
      { name: 'Roadmap Tool > Node Test Execution Capability > Node Test Data Refresh After Run', state: 'done', canonicalPath: 'devtools/roadmap/src/components/debug/roadmap/RoadmapVisualizer.tsx' },
      // Technical: capability branch for roadmap health-signal warnings.
      // Layman: tracks the node quality signal system (tests, density, and badge UI).
      { name: 'Roadmap Tool > Node Health Signals', state: 'done', canonicalPath: 'devtools/roadmap/src/components/debug/roadmap/health-signals/types.ts' },
      { name: 'Roadmap Tool > Node Health Signals > Health Signal Computation', state: 'done', canonicalPath: 'devtools/roadmap/src/components/debug/roadmap/health-signals/compute-health-signals.ts' },
      { name: 'Roadmap Tool > Node Health Signals > Health Badge Component', state: 'done', canonicalPath: 'devtools/roadmap/src/components/debug/roadmap/health-signals/NodeHealthBadge.tsx' },
      { name: 'Roadmap Tool > Node Health Signals > Visualizer Integration', state: 'done', canonicalPath: 'devtools/roadmap/src/components/debug/roadmap/RoadmapVisualizer.tsx' },
      { name: 'Roadmap Tool > Node Health Signals > Density Warning Detection', state: 'done', canonicalPath: 'devtools/roadmap/src/components/debug/roadmap/health-signals/compute-health-signals.ts' },
      // Technical: capability branch for test-file declaration and disk presence checks.
      // Layman: tracks whether roadmap nodes declare tests and whether those files exist.
      { name: 'Roadmap Tool > Node Test Presence', state: 'done', canonicalPath: 'devtools/roadmap/scripts/roadmap-server-logic.ts' },
      { name: 'Roadmap Tool > Node Test Presence > Test File Declaration Schema', state: 'done', canonicalPath: 'devtools/roadmap/scripts/roadmap-server-logic.ts' },
      { name: 'Roadmap Tool > Node Test Presence > Disk Presence Checker', state: 'done', canonicalPath: 'devtools/roadmap/scripts/roadmap/node-test-presence/test-presence-checker.ts' },
      { name: 'Roadmap Tool > Node Test Presence > Pipeline Annotation', state: 'done', canonicalPath: 'devtools/roadmap/scripts/roadmap-server-logic.ts' },
      { name: 'Roadmap Tool > Roadmap API Surface Capability', state: 'active', canonicalPath: 'vite.config.ts' },
      { name: 'Roadmap Tool > Roadmap API Surface Capability > Roadmap Data Endpoint', state: 'done', canonicalPath: 'vite.config.ts' },
      { name: 'Roadmap Tool > Roadmap API Surface Capability > Layout Endpoint (Read Write)', state: 'done', canonicalPath: 'vite.config.ts' },
      { name: 'Roadmap Tool > Roadmap API Surface Capability > Node Test Run Endpoint', state: 'done', canonicalPath: 'vite.config.ts' },
      { name: 'Roadmap Tool > Roadmap API Surface Capability > Opportunities Latest Endpoint', state: 'done', canonicalPath: 'vite.config.ts' },
      { name: 'Roadmap Tool > Roadmap API Surface Capability > Opportunities Scan Endpoint', state: 'done', canonicalPath: 'vite.config.ts' },
      { name: 'Roadmap Tool > Roadmap API Surface Capability > Opportunities Settings Endpoint', state: 'done', canonicalPath: 'vite.config.ts' },
      { name: 'Roadmap Tool > Roadmap API Surface Capability > VS Code Open Endpoint', state: 'done', canonicalPath: 'vite.config.ts' },
      { name: 'Roadmap Tool > Documentation Intelligence', state: 'active', canonicalPath: 'devtools/roadmap/scripts/roadmap-orchestrate-one-doc.ts' },
      { name: 'Roadmap Tool > Documentation Intelligence > One-Doc Orchestrated Processing Pipeline', state: 'done', canonicalPath: 'devtools/roadmap/scripts/roadmap-orchestrate-one-doc.ts' },
      { name: 'Roadmap Tool > Documentation Intelligence > One-Doc Orchestrated Processing Pipeline > Worker Packet Validation Gate', state: 'done', canonicalPath: 'devtools/roadmap/scripts/roadmap-packet-validation.ts' },
      { name: 'Roadmap Tool > Documentation Intelligence > One-Doc Orchestrated Processing Pipeline > Feature-Oriented Naming Guard', state: 'done', canonicalPath: 'devtools/roadmap/scripts/roadmap-orchestrate-one-doc.ts' },
      { name: 'Roadmap Tool > Documentation Intelligence > Feature Taxonomy Integrity', state: 'done', canonicalPath: 'devtools/roadmap/scripts/roadmap-engine/text.ts' },
      { name: 'Roadmap Tool > Strategic Opportunity Mapping', state: 'active', canonicalPath: 'devtools/roadmap/scripts/roadmap-engine/opportunities.ts' },
      { name: 'Roadmap Tool > Strategic Opportunity Mapping > Opportunity Collection', state: 'done', canonicalPath: 'devtools/roadmap/scripts/roadmap-engine/opportunities.ts' },
      { name: 'Roadmap Tool > Strategic Opportunity Mapping > Opportunity Scan Orchestration', state: 'done', canonicalPath: 'devtools/roadmap/scripts/roadmap-engine/opportunities/scanner.ts' },
      { name: 'Roadmap Tool > Strategic Opportunity Mapping > Opportunity Flag Classification', state: 'done', canonicalPath: 'devtools/roadmap/scripts/roadmap-engine/opportunities/flag-classifier.ts' },
      { name: 'Roadmap Tool > Strategic Opportunity Mapping > Opportunity Propagation and Rollup', state: 'done', canonicalPath: 'devtools/roadmap/scripts/roadmap-engine/opportunities/propagation.ts' },
      { name: 'Roadmap Tool > Strategic Opportunity Mapping > Opportunity Snapshot Persistence', state: 'done', canonicalPath: 'devtools/roadmap/scripts/roadmap-engine/opportunities/storage.ts' },
      { name: 'Roadmap Tool > Strategic Opportunity Mapping > Opportunity Scan Trigger', state: 'done', canonicalPath: 'devtools/roadmap/src/components/debug/roadmap/RoadmapVisualizer.tsx' },
      { name: 'Roadmap Tool > Strategic Opportunity Mapping > Opportunity Triage Panel', state: 'done', canonicalPath: 'devtools/roadmap/src/components/debug/roadmap/RoadmapVisualizer.tsx' },
      { name: 'Roadmap Tool > Strategic Opportunity Mapping > Opportunity-to-Node Navigation', state: 'done', canonicalPath: 'devtools/roadmap/src/components/debug/roadmap/RoadmapVisualizer.tsx' },
      { name: 'Roadmap Tool > Strategic Opportunity Mapping > Opportunity Crosslink Detection', state: 'done', canonicalPath: 'devtools/roadmap/scripts/roadmap-engine/opportunities/crosslink-resolver.ts' },
      { name: 'Roadmap Tool > Strategic Opportunity Mapping > Opportunity Module Architecture', state: 'active', canonicalPath: 'devtools/roadmap/scripts/roadmap-engine/opportunities.ts' },
      { name: 'Roadmap Tool > Strategic Opportunity Mapping > Opportunity Module Architecture > Opportunity Public Facade Module', state: 'done', canonicalPath: 'devtools/roadmap/scripts/roadmap-engine/opportunities.ts' },
      { name: 'Roadmap Tool > Strategic Opportunity Mapping > Opportunity Module Architecture > Opportunity Type Contracts Module', state: 'done', canonicalPath: 'devtools/roadmap/scripts/roadmap-engine/opportunities/types.ts' },
      { name: 'Roadmap Tool > Strategic Opportunity Mapping > Opportunity Module Architecture > Opportunity Graph Context Module', state: 'done', canonicalPath: 'devtools/roadmap/scripts/roadmap-engine/opportunities/graph.ts' },
      { name: 'Roadmap Tool > Strategic Opportunity Mapping > Opportunity Module Architecture > Opportunity Scanner Module', state: 'done', canonicalPath: 'devtools/roadmap/scripts/roadmap-engine/opportunities/scanner.ts' },
      { name: 'Roadmap Tool > Strategic Opportunity Mapping > Opportunity Module Architecture > Opportunity Flag Classifier Module', state: 'done', canonicalPath: 'devtools/roadmap/scripts/roadmap-engine/opportunities/flag-classifier.ts' },
      { name: 'Roadmap Tool > Strategic Opportunity Mapping > Opportunity Module Architecture > Opportunity Propagation Module', state: 'done', canonicalPath: 'devtools/roadmap/scripts/roadmap-engine/opportunities/propagation.ts' },
      { name: 'Roadmap Tool > Strategic Opportunity Mapping > Opportunity Module Architecture > Opportunity Crosslink Resolver Module', state: 'done', canonicalPath: 'devtools/roadmap/scripts/roadmap-engine/opportunities/crosslink-resolver.ts' },
      { name: 'Roadmap Tool > Strategic Opportunity Mapping > Opportunity Module Architecture > Opportunity Storage And Sanitization Module', state: 'done', canonicalPath: 'devtools/roadmap/scripts/roadmap-engine/opportunities/storage.ts' },
      // These capability leaves were previously parked as planned placeholders. They
      // now have concrete module implementations and UI wiring, so the roadmap data
      // should advertise them as shipped instead of underreporting branch progress.
      { name: 'Roadmap Tool > Strategic Opportunity Mapping > Opportunity Filters and Sorts', state: 'done', canonicalPath: 'devtools/roadmap/src/components/debug/roadmap/RoadmapVisualizer.tsx' },
      { name: 'Roadmap Tool > Strategic Opportunity Mapping > Historical Development Traceability', state: 'done', canonicalPath: 'devtools/roadmap/src/components/debug/roadmap/RoadmapVisualizer.tsx' },
      { name: 'Roadmap Tool > Strategic Opportunity Mapping > Multi-Product Portfolio Branching (Future)', state: 'done', canonicalPath: 'devtools/roadmap/src/components/debug/roadmap/RoadmapVisualizer.tsx' },
      // Technical: Spell Branch Navigator — tab-based axis drill UI for browsing spell profiles.
      // Layman: the standalone spell filtering navigator accessible from the Spell Branch tab.
      { name: 'Roadmap Tool > Spell Branch Navigator', state: 'active', canonicalPath: 'devtools/roadmap/src/spell-branch/SpellBranchNavigator.tsx' },
      { name: 'Roadmap Tool > Spell Branch Navigator > Axis Engine', state: 'done', canonicalPath: 'devtools/roadmap/src/spell-branch/axis-engine.ts' },
      { name: 'Roadmap Tool > Spell Branch Navigator > VSM Drill-Down Navigator', state: 'done', canonicalPath: 'devtools/roadmap/src/spell-branch/SpellBranchNavigator.tsx' },
      { name: 'Roadmap Tool > Spell Branch Navigator > Requirements Component Mapping', state: 'done', canonicalPath: 'devtools/roadmap/src/spell-branch/vsm-tree.ts' },
      // Technical: Spell Graph Navigation — canvas-overlaid virtual node tree for graph-based drill.
      // Layman: the in-graph spell exploration overlay that expands directly on the roadmap canvas.
      { name: 'Roadmap Tool > Spell Graph Navigation', state: 'active', canonicalPath: 'devtools/roadmap/src/spell-branch/SpellGraphOverlay.tsx' },
      { name: 'Roadmap Tool > Spell Graph Navigation > Live Axis Filtering Engine', state: 'done', canonicalPath: 'devtools/roadmap/src/spell-branch/SpellGraphOverlay.tsx' },
      { name: 'Roadmap Tool > Spell Graph Navigation > Canvas-Coordinated Node Layout', state: 'done', canonicalPath: 'devtools/roadmap/src/spell-branch/SpellGraphOverlay.tsx' },
      { name: 'Roadmap Tool > Spell Graph Navigation > Spell Branch Tab Handoff', state: 'done', canonicalPath: 'devtools/roadmap/src/spell-branch/SpellGraphOverlay.tsx' },
      // Technical: Node Media Previews — convention-based screenshot/GIF system for leaf nodes.
      // Layman: tracks the media preview system that lets the info panel show capabilities in action.
      { name: 'Roadmap Tool > Node Media Previews', state: 'active', canonicalPath: 'devtools/roadmap/scripts/roadmap/node-media-presence/media-scanner.ts' },
      { name: 'Roadmap Tool > Node Media Previews > Convention-Based Media Scanner', state: 'done', canonicalPath: 'devtools/roadmap/scripts/roadmap/node-media-presence/media-scanner.ts' },
      { name: 'Roadmap Tool > Node Media Previews > Media File Endpoint', state: 'done', canonicalPath: 'vite.config.ts' },
      { name: 'Roadmap Tool > Node Media Previews > Info Panel Preview Button', state: 'done', canonicalPath: 'devtools/roadmap/src/components/debug/roadmap/RoadmapVisualizer.tsx' },
      { name: 'Roadmap Tool > Node Media Previews > Lightbox Viewer', state: 'done', canonicalPath: 'devtools/roadmap/src/components/debug/roadmap/RoadmapVisualizer.tsx' },
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

// Technical: renamed roadmap labels (old capability-first -> new taxonomy names).
// Layman: this is the single rename table that updates roadmap wording while keeping
// compatibility with old ids/details through reverse lookup maps below.
const ROADMAP_CAPABILITY_RENAME_RULES: Array<{ from: string; to: string }> = [
  {
    from: 'Roadmap Tool > Documentation Intelligence > One-Doc Orchestrated Processing Pipeline',
    to: 'Roadmap Tool > Documentation Intelligence > Single-document Processing Capability'
  },
  {
    from: 'Roadmap Tool > Documentation Intelligence > One-Doc Orchestrated Processing Pipeline > Feature-Oriented Naming Guard',
    to: 'Roadmap Tool > Documentation Intelligence > Single-document Processing Capability > Feature Naming Validation > Feature Naming Validation Module'
  },
  {
    from: 'Roadmap Tool > Documentation Intelligence > One-Doc Orchestrated Processing Pipeline > Worker Packet Validation Gate',
    to: 'Roadmap Tool > Documentation Intelligence > Single-document Processing Capability > Worker Packet Schema Validation > Worker Packet Schema Validation Module'
  },
  {
    from: 'Roadmap Tool > Interaction UX',
    to: 'Roadmap Tool > Interaction And Navigation'
  },
  {
    from: 'Roadmap Tool > Interaction UX > Canvas Pan Drag Navigation',
    to: 'Roadmap Tool > Interaction And Navigation > Canvas Pan Navigation > Canvas Pan Navigation Module'
  },
  {
    from: 'Roadmap Tool > Interaction UX > Expand All And Collapse All Controls',
    to: 'Roadmap Tool > Interaction And Navigation > Global Branch Expansion Controls > Global Branch Expansion Controls Module'
  },
  {
    from: 'Roadmap Tool > Interaction UX > Node Detail Drawer',
    to: 'Roadmap Tool > Interaction And Navigation > Node Detail Panel > Node Detail Panel Module'
  },
  {
    from: 'Roadmap Tool > Interaction UX > Node Drag Repositioning',
    to: 'Roadmap Tool > Interaction And Navigation > Node Position Editing > Node Position Editing Module'
  },
  {
    from: 'Roadmap Tool > Interaction UX > Open Related Docs In VS Code',
    to: 'Roadmap Tool > Interaction And Navigation > Related Document Launch > Related Document Launch Module'
  },
  {
    from: 'Roadmap Tool > Interaction UX > Panel Scroll Without Canvas Zoom',
    to: 'Roadmap Tool > Interaction And Navigation > Panel Scroll Isolation > Panel Scroll Isolation Module'
  },
  {
    from: 'Roadmap Tool > Interaction UX > Related Docs Type Indicators',
    to: 'Roadmap Tool > Interaction And Navigation > Related Document Type Badging > Related Document Type Badging Module'
  },
  {
    from: 'Roadmap Tool > Interaction UX > Single Node Expand Collapse',
    to: 'Roadmap Tool > Interaction And Navigation > Branch Toggle Per Node > Branch Toggle Per Node Module'
  },
  {
    from: 'Roadmap Tool > Interaction UX > Node Focus and Viewport Containment',
    to: 'Roadmap Tool > Interaction And Navigation > Node Focus And Viewport Containment > Node Focus And Viewport Containment Module'
  },
  {
    from: 'Roadmap Tool > Interaction UX > View Reset Control',
    to: 'Roadmap Tool > Interaction And Navigation > Canvas View Reset > Canvas View Reset Module'
  },
  {
    from: 'Roadmap Tool > Interaction UX > Wheel Zoom Around Cursor',
    to: 'Roadmap Tool > Interaction And Navigation > Cursor-centered Wheel Zoom > Cursor-centered Wheel Zoom Module'
  },
  {
    from: 'Roadmap Tool > Strategic Opportunity Mapping > Scan Pipeline',
    to: 'Roadmap Tool > Strategic Opportunity Mapping > Opportunity Detection'
  },
  {
    from: 'Roadmap Tool > Strategic Opportunity Mapping > Scan Pipeline > Scan Orchestration',
    to: 'Roadmap Tool > Strategic Opportunity Mapping > Opportunity Detection > Scan Execution Orchestration'
  },
  {
    from: 'Roadmap Tool > Strategic Opportunity Mapping > Scan Pipeline > Flag Classification',
    to: 'Roadmap Tool > Strategic Opportunity Mapping > Opportunity Detection > Opportunity Flag Assignment'
  },
  {
    from: 'Roadmap Tool > Strategic Opportunity Mapping > Scan Pipeline > Propagation And Rollup',
    to: 'Roadmap Tool > Strategic Opportunity Mapping > Opportunity Detection > Parent Rollup Computation'
  },
  {
    from: 'Roadmap Tool > Strategic Opportunity Mapping > Scan Pipeline > Crosslink Detection',
    to: 'Roadmap Tool > Strategic Opportunity Mapping > Opportunity Detection > Cross-branch Overlap Detection'
  },
  {
    from: 'Roadmap Tool > Strategic Opportunity Mapping > Operator Workflow',
    to: 'Roadmap Tool > Strategic Opportunity Mapping > Opportunity Operations'
  },
  {
    from: 'Roadmap Tool > Strategic Opportunity Mapping > Operator Workflow > Opportunity Collection',
    to: 'Roadmap Tool > Strategic Opportunity Mapping > Opportunity Operations > Opportunity Capture'
  },
  {
    from: 'Roadmap Tool > Strategic Opportunity Mapping > Operator Workflow > Scan Trigger',
    to: 'Roadmap Tool > Strategic Opportunity Mapping > Opportunity Operations > Opportunity Scan Initiation > Opportunity Scan Initiation Module'
  },
  {
    from: 'Roadmap Tool > Strategic Opportunity Mapping > Operator Workflow > Triage Panel',
    to: 'Roadmap Tool > Strategic Opportunity Mapping > Opportunity Operations > Opportunity Triage Workspace > Opportunity Triage Workspace Module'
  },
  {
    from: 'Roadmap Tool > Strategic Opportunity Mapping > Operator Workflow > Node Navigation',
    to: 'Roadmap Tool > Strategic Opportunity Mapping > Opportunity Operations > Opportunity To Node Navigation > Opportunity To Node Navigation Module'
  },
  {
    from: 'Roadmap Tool > Strategic Opportunity Mapping > Operator Workflow > Filters And Sorts',
    to: 'Roadmap Tool > Strategic Opportunity Mapping > Opportunity Operations > Opportunity Filtering And Sorting > Opportunity Filtering And Sorting Module'
  },
  {
    from: 'Roadmap Tool > Strategic Opportunity Mapping > Governance And Expansion',
    to: 'Roadmap Tool > Strategic Opportunity Mapping > Governance Capability'
  },
  {
    from: 'Roadmap Tool > Strategic Opportunity Mapping > Governance And Expansion > Historical Development Traceability',
    to: 'Roadmap Tool > Strategic Opportunity Mapping > Governance Capability > Roadmap History Traceability > Roadmap History Traceability Module'
  },
  {
    from: 'Roadmap Tool > Strategic Opportunity Mapping > Governance And Expansion > Multi-product Portfolio Branching (future)',
    to: 'Roadmap Tool > Strategic Opportunity Mapping > Governance Capability > Multi-product Roadmap Branching Future > Multi-product Roadmap Branching Module'
  },
  {
    from: 'Roadmap Tool > Strategic Opportunity Mapping > Operator Workflow > Opportunity Collection > Opportunity Public Facade Module',
    to: 'Roadmap Tool > Strategic Opportunity Mapping > Opportunity Operations > Opportunity Capture > Opportunity Public Facade Module'
  },
  {
    from: 'Roadmap Tool > Strategic Opportunity Mapping > Scan Pipeline > Scan Orchestration > Opportunity Type Contracts Module',
    to: 'Roadmap Tool > Strategic Opportunity Mapping > Opportunity Detection > Scan Execution Orchestration > Opportunity Type Contracts Module'
  },
  {
    from: 'Roadmap Tool > Strategic Opportunity Mapping > Scan Pipeline > Scan Orchestration > Opportunity Graph Context Module',
    to: 'Roadmap Tool > Strategic Opportunity Mapping > Opportunity Detection > Scan Execution Orchestration > Opportunity Graph Context Module'
  },
  {
    from: 'Roadmap Tool > Strategic Opportunity Mapping > Scan Pipeline > Scan Orchestration > Opportunity Scanner Module',
    to: 'Roadmap Tool > Strategic Opportunity Mapping > Opportunity Detection > Scan Execution Orchestration > Opportunity Scanner Module'
  },
  {
    from: 'Roadmap Tool > Strategic Opportunity Mapping > Scan Pipeline > Flag Classification > Opportunity Flag Classifier Module',
    to: 'Roadmap Tool > Strategic Opportunity Mapping > Opportunity Detection > Opportunity Flag Assignment > Opportunity Flag Classifier Module'
  },
  {
    from: 'Roadmap Tool > Strategic Opportunity Mapping > Scan Pipeline > Propagation And Rollup > Opportunity Propagation Module',
    to: 'Roadmap Tool > Strategic Opportunity Mapping > Opportunity Detection > Parent Rollup Computation > Opportunity Propagation Module'
  },
  {
    from: 'Roadmap Tool > Strategic Opportunity Mapping > Scan Pipeline > Crosslink Detection > Opportunity Crosslink Resolver Module',
    to: 'Roadmap Tool > Strategic Opportunity Mapping > Opportunity Detection > Cross-branch Overlap Detection > Opportunity Crosslink Resolver Module'
  },
  // Technical: drops the redundant "Capability" suffix from the API surface branch
  // so the label matches every other L2 Roadmap Tool branch in naming style.
  {
    from: 'Roadmap Tool > Roadmap API Surface Capability',
    to: 'Roadmap Tool > Roadmap API Surface'
  },
  {
    from: 'Roadmap Tool > Roadmap API Surface Capability > Roadmap Data Endpoint',
    to: 'Roadmap Tool > Roadmap API Surface > Roadmap Data Endpoint'
  },
  {
    from: 'Roadmap Tool > Roadmap API Surface Capability > Layout Endpoint (Read Write)',
    to: 'Roadmap Tool > Roadmap API Surface > Layout Endpoint (Read Write)'
  },
  {
    from: 'Roadmap Tool > Roadmap API Surface Capability > Node Test Run Endpoint',
    to: 'Roadmap Tool > Roadmap API Surface > Node Test Run Endpoint'
  },
  {
    from: 'Roadmap Tool > Roadmap API Surface Capability > Opportunities Latest Endpoint',
    to: 'Roadmap Tool > Roadmap API Surface > Opportunities Latest Endpoint'
  },
  {
    from: 'Roadmap Tool > Roadmap API Surface Capability > Opportunities Scan Endpoint',
    to: 'Roadmap Tool > Roadmap API Surface > Opportunities Scan Endpoint'
  },
  {
    from: 'Roadmap Tool > Roadmap API Surface Capability > Opportunities Settings Endpoint',
    to: 'Roadmap Tool > Roadmap API Surface > Opportunities Settings Endpoint'
  },
  {
    from: 'Roadmap Tool > Roadmap API Surface Capability > VS Code Open Endpoint',
    to: 'Roadmap Tool > Roadmap API Surface > VS Code Open Endpoint'
  },
  // ── Layman renames: Roadmap Tool sub-branch parents ──────────────────────
  {
    from: 'Roadmap Tool > Visualization Stability',
    to: 'Roadmap Tool > Graph Display Stability'
  },
  {
    from: 'Roadmap Tool > Visualization Stability > Connector Rendering Reliability',
    to: 'Roadmap Tool > Graph Display Stability > Connector Rendering Reliability'
  },
  {
    from: 'Roadmap Tool > Node Test Execution Capability',
    to: 'Roadmap Tool > Run Tests From the Roadmap'
  },
  {
    from: 'Roadmap Tool > Node Health Signals',
    to: 'Roadmap Tool > Node Quality Warnings'
  },
  {
    from: 'Roadmap Tool > Node Test Presence',
    to: 'Roadmap Tool > Which Nodes Have Tests'
  },
  {
    from: 'Roadmap Tool > Documentation Intelligence',
    to: 'Roadmap Tool > Doc Processing Pipeline'
  },
  // ── Layman renames: Layout Persistence children ───────────────────────────
  {
    from: 'Roadmap Tool > Layout Persistence > Auto-save Debounce Cycle',
    to: 'Roadmap Tool > Layout Persistence > Delayed Auto-Save'
  },
  // ── Layman renames: Run Tests From the Roadmap children ───────────────────
  {
    from: 'Roadmap Tool > Node Test Execution Capability > Run Node Test (Self Plus Descendants)',
    to: 'Roadmap Tool > Run Tests From the Roadmap > Run This Node and Its Children\'s Tests'
  },
  {
    from: 'Roadmap Tool > Node Test Execution Capability > Run Child Node Tests (Descendants Only)',
    to: 'Roadmap Tool > Run Tests From the Roadmap > Run Only Child Tests'
  },
  {
    from: 'Roadmap Tool > Node Test Execution Capability > Node Test Result Status Feedback',
    to: 'Roadmap Tool > Run Tests From the Roadmap > Show Test Pass/Fail Results'
  },
  {
    from: 'Roadmap Tool > Node Test Execution Capability > Node Test Status Persistence',
    to: 'Roadmap Tool > Run Tests From the Roadmap > Remember Test Results Between Sessions'
  },
  {
    from: 'Roadmap Tool > Node Test Execution Capability > Node Test Data Refresh After Run',
    to: 'Roadmap Tool > Run Tests From the Roadmap > Refresh Results After Running'
  },
  // ── Layman renames: Node Quality Warnings children ────────────────────────
  {
    from: 'Roadmap Tool > Node Health Signals > Health Signal Computation',
    to: 'Roadmap Tool > Node Quality Warnings > How Warnings Are Calculated'
  },
  {
    from: 'Roadmap Tool > Node Health Signals > Health Badge Component',
    to: 'Roadmap Tool > Node Quality Warnings > Warning Badge Display'
  },
  {
    from: 'Roadmap Tool > Node Health Signals > Visualizer Integration',
    to: 'Roadmap Tool > Node Quality Warnings > Warnings Shown On Canvas'
  },
  {
    from: 'Roadmap Tool > Node Health Signals > Density Warning Detection',
    to: 'Roadmap Tool > Node Quality Warnings > Too Many Children Warning'
  },
  // ── Layman renames: Which Nodes Have Tests children ───────────────────────
  {
    from: 'Roadmap Tool > Node Test Presence > Test File Declaration Schema',
    to: 'Roadmap Tool > Which Nodes Have Tests > How Tests Are Declared'
  },
  {
    from: 'Roadmap Tool > Node Test Presence > Disk Presence Checker',
    to: 'Roadmap Tool > Which Nodes Have Tests > Verify Test Files Exist'
  },
  {
    from: 'Roadmap Tool > Node Test Presence > Pipeline Annotation',
    to: 'Roadmap Tool > Which Nodes Have Tests > Stamp Nodes With Test Info'
  },
  // ── Layman renames: Roadmap Server Endpoints + children ───────────────────
  // These override the earlier partial renames that only removed "Capability".
  {
    from: 'Roadmap Tool > Roadmap API Surface Capability',
    to: 'Roadmap Tool > Roadmap Server Endpoints'
  },
  {
    from: 'Roadmap Tool > Roadmap API Surface Capability > Roadmap Data Endpoint',
    to: 'Roadmap Tool > Roadmap Server Endpoints > Serve Roadmap Data'
  },
  {
    from: 'Roadmap Tool > Roadmap API Surface Capability > Layout Endpoint (Read Write)',
    to: 'Roadmap Tool > Roadmap Server Endpoints > Save and Load Layout'
  },
  {
    from: 'Roadmap Tool > Roadmap API Surface Capability > Node Test Run Endpoint',
    to: 'Roadmap Tool > Roadmap Server Endpoints > Run Tests From Browser'
  },
  {
    from: 'Roadmap Tool > Roadmap API Surface Capability > Opportunities Latest Endpoint',
    to: 'Roadmap Tool > Roadmap Server Endpoints > Fetch Current Opportunities'
  },
  {
    from: 'Roadmap Tool > Roadmap API Surface Capability > Opportunities Scan Endpoint',
    to: 'Roadmap Tool > Roadmap Server Endpoints > Trigger an Opportunity Scan'
  },
  {
    from: 'Roadmap Tool > Roadmap API Surface Capability > Opportunities Settings Endpoint',
    to: 'Roadmap Tool > Roadmap Server Endpoints > Opportunity Scan Settings'
  },
  {
    from: 'Roadmap Tool > Roadmap API Surface Capability > VS Code Open Endpoint',
    to: 'Roadmap Tool > Roadmap Server Endpoints > Open File in VS Code'
  },
  // ── Layman renames: Doc Processing Pipeline + children ────────────────────
  // These override the earlier renames that used "Single-document Processing Capability".
  {
    from: 'Roadmap Tool > Documentation Intelligence > One-Doc Orchestrated Processing Pipeline',
    to: 'Roadmap Tool > Doc Processing Pipeline > Process One Doc at a Time'
  },
  {
    from: 'Roadmap Tool > Documentation Intelligence > One-Doc Orchestrated Processing Pipeline > Worker Packet Validation Gate',
    to: 'Roadmap Tool > Doc Processing Pipeline > Process One Doc at a Time > Validate Doc Before Processing'
  },
  {
    from: 'Roadmap Tool > Documentation Intelligence > One-Doc Orchestrated Processing Pipeline > Feature-Oriented Naming Guard',
    to: 'Roadmap Tool > Doc Processing Pipeline > Process One Doc at a Time > Enforce Capability-First Names'
  },
  {
    from: 'Roadmap Tool > Documentation Intelligence > Feature Taxonomy Integrity',
    to: 'Roadmap Tool > Doc Processing Pipeline > Node Names Follow Naming Rules'
  },
  // Task 7: Strategic Opportunity Mapping children
  {
    from: 'Roadmap Tool > Strategic Opportunity Mapping > Opportunity Collection',
    to: 'Roadmap Tool > Strategic Opportunity Mapping > Gather Improvement Opportunities'
  },
  {
    from: 'Roadmap Tool > Strategic Opportunity Mapping > Opportunity Scan Orchestration',
    to: 'Roadmap Tool > Strategic Opportunity Mapping > Run the Opportunity Scan'
  },
  {
    from: 'Roadmap Tool > Strategic Opportunity Mapping > Opportunity Flag Classification',
    to: 'Roadmap Tool > Strategic Opportunity Mapping > Label Each Opportunity Type'
  },
  {
    from: 'Roadmap Tool > Strategic Opportunity Mapping > Opportunity Propagation and Rollup',
    to: 'Roadmap Tool > Strategic Opportunity Mapping > Roll Opportunities Up to Parent Nodes'
  },
  {
    from: 'Roadmap Tool > Strategic Opportunity Mapping > Opportunity Snapshot Persistence',
    to: 'Roadmap Tool > Strategic Opportunity Mapping > Save Opportunity Results to Disk'
  },
  {
    from: 'Roadmap Tool > Strategic Opportunity Mapping > Opportunity Scan Trigger',
    to: 'Roadmap Tool > Strategic Opportunity Mapping > Button to Start a Scan'
  },
  {
    from: 'Roadmap Tool > Strategic Opportunity Mapping > Opportunity Triage Panel',
    to: 'Roadmap Tool > Strategic Opportunity Mapping > Review and Dismiss Opportunities'
  },
  {
    from: 'Roadmap Tool > Strategic Opportunity Mapping > Opportunity-to-Node Navigation',
    to: 'Roadmap Tool > Strategic Opportunity Mapping > Jump to Node From Opportunity'
  },
  {
    from: 'Roadmap Tool > Strategic Opportunity Mapping > Opportunity Crosslink Detection',
    to: 'Roadmap Tool > Strategic Opportunity Mapping > Find Shared Opportunities Across Branches'
  },
  {
    from: 'Roadmap Tool > Strategic Opportunity Mapping > Opportunity Module Architecture',
    to: 'Roadmap Tool > Strategic Opportunity Mapping > How the Opportunity System Is Built'
  },
  {
    from: 'Roadmap Tool > Strategic Opportunity Mapping > Opportunity Module Architecture > Opportunity Public Facade Module',
    to: 'Roadmap Tool > Strategic Opportunity Mapping > How the Opportunity System Is Built > Opportunity System Entry Point'
  },
  {
    from: 'Roadmap Tool > Strategic Opportunity Mapping > Opportunity Module Architecture > Opportunity Type Contracts Module',
    to: 'Roadmap Tool > Strategic Opportunity Mapping > How the Opportunity System Is Built > Opportunity Data Shapes'
  },
  {
    from: 'Roadmap Tool > Strategic Opportunity Mapping > Opportunity Module Architecture > Opportunity Graph Context Module',
    to: 'Roadmap Tool > Strategic Opportunity Mapping > How the Opportunity System Is Built > Graph Data for Opportunity Scanning'
  },
  {
    from: 'Roadmap Tool > Strategic Opportunity Mapping > Opportunity Module Architecture > Opportunity Scanner Module',
    to: 'Roadmap Tool > Strategic Opportunity Mapping > How the Opportunity System Is Built > The Opportunity Scanner'
  },
  {
    from: 'Roadmap Tool > Strategic Opportunity Mapping > Opportunity Module Architecture > Opportunity Flag Classifier Module',
    to: 'Roadmap Tool > Strategic Opportunity Mapping > How the Opportunity System Is Built > Opportunity Type Labeler'
  },
  {
    from: 'Roadmap Tool > Strategic Opportunity Mapping > Opportunity Module Architecture > Opportunity Propagation Module',
    to: 'Roadmap Tool > Strategic Opportunity Mapping > How the Opportunity System Is Built > Opportunity Rollup Logic'
  },
  {
    from: 'Roadmap Tool > Strategic Opportunity Mapping > Opportunity Module Architecture > Opportunity Crosslink Resolver Module',
    to: 'Roadmap Tool > Strategic Opportunity Mapping > How the Opportunity System Is Built > Crosslink Finder Logic'
  },
  {
    from: 'Roadmap Tool > Strategic Opportunity Mapping > Opportunity Module Architecture > Opportunity Storage And Sanitization Module',
    to: 'Roadmap Tool > Strategic Opportunity Mapping > How the Opportunity System Is Built > Save and Clean Up Opportunities'
  },
  // Task 8: Spell Branch Navigator children
  {
    from: 'Roadmap Tool > Spell Branch Navigator > Axis Engine',
    to: 'Roadmap Tool > Spell Branch Navigator > Spell Filter Logic'
  },
  {
    from: 'Roadmap Tool > Spell Branch Navigator > VSM Drill-Down Navigator',
    to: 'Roadmap Tool > Spell Branch Navigator > Step-by-Step Spell Filter'
  },
  {
    from: 'Roadmap Tool > Spell Branch Navigator > Requirements Component Mapping',
    to: 'Roadmap Tool > Spell Branch Navigator > V/S/M Component Labels'
  },
  // Task 8: Spell Graph Navigation children
  {
    from: 'Roadmap Tool > Spell Graph Navigation > Live Axis Filtering Engine',
    to: 'Roadmap Tool > Spell Graph Navigation > Spell Filter Overlay on Canvas'
  },
  {
    from: 'Roadmap Tool > Spell Graph Navigation > Canvas-Coordinated Node Layout',
    to: 'Roadmap Tool > Spell Graph Navigation > Spell Nodes Positioned on the Graph'
  },
  // Task 8: Node Media Previews children
  {
    from: 'Roadmap Tool > Node Media Previews > Convention-Based Media Scanner',
    to: 'Roadmap Tool > Node Media Previews > Find Captures by File Name'
  },
  {
    from: 'Roadmap Tool > Node Media Previews > Media File Endpoint',
    to: 'Roadmap Tool > Node Media Previews > Serve Capture Files'
  },
  // Task 9: Race Portrait Image Generation — Gemini Session Control
  {
    from: 'Race Portrait Image Generation > Gemini Session Control',
    to: 'Race Portrait Image Generation > AI Session Manager'
  },
  {
    from: 'Race Portrait Image Generation > Gemini Session Control > CDP Endpoint Health Check',
    to: 'Race Portrait Image Generation > AI Session Manager > Check AI Connection Is Alive'
  },
  {
    from: 'Race Portrait Image Generation > Gemini Session Control > Gemini Tab Targeting',
    to: 'Race Portrait Image Generation > AI Session Manager > Find the Right AI Browser Tab'
  },
  {
    from: 'Race Portrait Image Generation > Gemini Session Control > Consent Interstitial Handling',
    to: 'Race Portrait Image Generation > AI Session Manager > Dismiss AI Consent Popups'
  },
  {
    from: 'Race Portrait Image Generation > Gemini Session Control > Per Generation Chat Reset',
    to: 'Race Portrait Image Generation > AI Session Manager > Start Fresh Chat Per Image'
  },
  {
    from: 'Race Portrait Image Generation > Gemini Session Control > New Chat Confirmation Check',
    to: 'Race Portrait Image Generation > AI Session Manager > Confirm New Chat Started'
  },
  {
    from: 'Race Portrait Image Generation > Gemini Session Control > Single Active Run Lock',
    to: 'Race Portrait Image Generation > AI Session Manager > Prevent Two Runs at Once'
  },
  // Task 9: Race Portrait Image Generation — Prompt Construction Engine
  {
    from: 'Race Portrait Image Generation > Prompt Construction Engine',
    to: 'Race Portrait Image Generation > Image Prompt Builder'
  },
  {
    from: 'Race Portrait Image Generation > Prompt Construction Engine > Base Prompt Template Management',
    to: 'Race Portrait Image Generation > Image Prompt Builder > Base Prompt Templates'
  },
  {
    from: 'Race Portrait Image Generation > Prompt Construction Engine > Race Override Registry',
    to: 'Race Portrait Image Generation > Image Prompt Builder > Per-Race Prompt Overrides'
  },
  {
    from: 'Race Portrait Image Generation > Prompt Construction Engine > Gender Variant Prompting',
    to: 'Race Portrait Image Generation > Image Prompt Builder > Gender-Specific Prompts'
  },
  {
    from: 'Race Portrait Image Generation > Prompt Construction Engine > Positive Constraint Rules',
    to: 'Race Portrait Image Generation > Image Prompt Builder > What to Include in Prompts'
  },
  {
    from: 'Race Portrait Image Generation > Prompt Construction Engine > Slice of Life Activity Allocator',
    to: 'Race Portrait Image Generation > Image Prompt Builder > Assign Activities to Characters'
  },
  {
    from: 'Race Portrait Image Generation > Prompt Construction Engine > Activity Uniqueness Normalization',
    to: 'Race Portrait Image Generation > Image Prompt Builder > Prevent Duplicate Activities'
  },
  {
    from: 'Race Portrait Image Generation > Prompt Construction Engine > Prompt Hash Tracking',
    to: 'Race Portrait Image Generation > Image Prompt Builder > Track Which Prompts Were Used'
  },
  // Task 9: Race Portrait Image Generation — Execution Reliability
  {
    from: 'Race Portrait Image Generation > Execution Reliability > Single Session Concurrency Guard',
    to: 'Race Portrait Image Generation > Execution Reliability > One Run at a Time'
  },
  {
    from: 'Race Portrait Image Generation > Execution Reliability > Download Fallback Pipeline',
    to: 'Race Portrait Image Generation > Execution Reliability > Retry Download on Failure'
  },
  {
    from: 'Race Portrait Image Generation > Execution Reliability > Retryable Failure Classification',
    to: 'Race Portrait Image Generation > Execution Reliability > Know When to Retry'
  },
  {
    from: 'Race Portrait Image Generation > Execution Reliability > Timeout and Cooldown Policy',
    to: 'Race Portrait Image Generation > Execution Reliability > Wait Times Between Attempts'
  },
  {
    from: 'Race Portrait Image Generation > Execution Reliability > Bad Request Recovery Path',
    to: 'Race Portrait Image Generation > Execution Reliability > Handle Bad Requests Gracefully'
  },
  {
    from: 'Race Portrait Image Generation > Execution Reliability > Download Artifact Recovery',
    to: 'Race Portrait Image Generation > Execution Reliability > Recover Failed Downloads'
  },
  // Task 9: Race Portrait Image Generation — Quality Gates
  {
    from: 'Race Portrait Image Generation > Quality Gates > Square Output Enforcement',
    to: 'Race Portrait Image Generation > Quality Gates > Require Square Images'
  },
  {
    from: 'Race Portrait Image Generation > Quality Gates > Blank Margin Rejection',
    to: 'Race Portrait Image Generation > Quality Gates > Reject Images With Blank Borders'
  },
  {
    from: 'Race Portrait Image Generation > Quality Gates > Image Decode Validation',
    to: 'Race Portrait Image Generation > Quality Gates > Verify Image Is Readable'
  },
  {
    from: 'Race Portrait Image Generation > Quality Gates > Full Body Framing Check',
    to: 'Race Portrait Image Generation > Quality Gates > Require Full Body in Frame'
  },
  {
    from: 'Race Portrait Image Generation > Quality Gates > Duplicate Byte Hash Rejection',
    to: 'Race Portrait Image Generation > Quality Gates > Reject Duplicate Images'
  },
  {
    from: 'Race Portrait Image Generation > Quality Gates > Arrow Artifact Rejection',
    to: 'Race Portrait Image Generation > Quality Gates > Reject Images With UI Arrows'
  },
  {
    from: 'Race Portrait Image Generation > Quality Gates > Borderless Full Bleed Validation',
    to: 'Race Portrait Image Generation > Quality Gates > Require Edge-to-Edge Image'
  },
  // Task 9: Race Portrait Image Generation — Post Generation Verification
  {
    from: 'Race Portrait Image Generation > Post Generation Verification > Slice of Life Ledger Tracking',
    to: 'Race Portrait Image Generation > Post Generation Verification > Track Activities Per Character'
  },
  {
    from: 'Race Portrait Image Generation > Post Generation Verification > In App Race Image Sync Validation',
    to: 'Race Portrait Image Generation > Post Generation Verification > Verify Images Match In-Game Data'
  },
  {
    from: 'Race Portrait Image Generation > Post Generation Verification > CC Glossary Path Parity Audit',
    to: 'Race Portrait Image Generation > Post Generation Verification > Check Glossary Image Paths Match'
  },
  {
    from: 'Race Portrait Image Generation > Post Generation Verification > Slice of Life Completeness Audit',
    to: 'Race Portrait Image Generation > Post Generation Verification > Check All Activities Are Covered'
  },
  {
    from: 'Race Portrait Image Generation > Post Generation Verification > Duplicate Activity Keeper Decisioning',
    to: 'Race Portrait Image Generation > Post Generation Verification > Decide Which Duplicate to Keep'
  },
  {
    from: 'Race Portrait Image Generation > Post Generation Verification > Verification Evidence Logging',
    to: 'Race Portrait Image Generation > Post Generation Verification > Log Verification Results'
  },
  // Task 9: Race Portrait Image Generation — Backlog Regeneration Orchestration
  {
    from: 'Race Portrait Image Generation > Backlog Regeneration Orchestration',
    to: 'Race Portrait Image Generation > Backlog Regeneration Runner'
  },
  {
    from: 'Race Portrait Image Generation > Backlog Regeneration Orchestration > Category Agnostic Backlog Processing',
    to: 'Race Portrait Image Generation > Backlog Regeneration Runner > Process Any Backlog Category'
  },
  {
    from: 'Race Portrait Image Generation > Backlog Regeneration Orchestration > Targeted Race Gender Runs',
    to: 'Race Portrait Image Generation > Backlog Regeneration Runner > Run Specific Race and Gender Combos'
  },
  {
    from: 'Race Portrait Image Generation > Backlog Regeneration Orchestration > Status Append Per Generation',
    to: 'Race Portrait Image Generation > Backlog Regeneration Runner > Record Status After Each Image'
  },
  {
    from: 'Race Portrait Image Generation > Backlog Regeneration Orchestration > Runbook Auto Update Hooks',
    to: 'Race Portrait Image Generation > Backlog Regeneration Runner > Auto-Update the Run Guide'
  },
  {
    from: 'Race Portrait Image Generation > Backlog Regeneration Orchestration > Post Run Audit Pipeline',
    to: 'Race Portrait Image Generation > Backlog Regeneration Runner > Audit After Each Run'
  },
  // Task 9: Race Portrait Image Generation — Future Capability Expansion
  {
    from: 'Race Portrait Image Generation > Future Capability Expansion > Fail Fast Branch Test Orchestration',
    to: 'Race Portrait Image Generation > Future Capability Expansion > Quick-Fail Branch Test Runner'
  },
  {
    from: 'Race Portrait Image Generation > Future Capability Expansion > Node Test Definition Registry',
    to: 'Race Portrait Image Generation > Future Capability Expansion > Where Node Tests Are Defined'
  },
  {
    from: 'Race Portrait Image Generation > Future Capability Expansion > Fail Fast Branch Test Executor',
    to: 'Race Portrait Image Generation > Future Capability Expansion > Quick-Fail Test Executor'
  },
  {
    from: 'Race Portrait Image Generation > Future Capability Expansion > Test Log Retention Policy',
    to: 'Race Portrait Image Generation > Future Capability Expansion > How Long Test Logs Are Kept'
  },
  {
    from: 'Race Portrait Image Generation > Future Capability Expansion > Roadmap Node Test Badges',
    to: 'Race Portrait Image Generation > Future Capability Expansion > Test Status Badges on Nodes'
  },
  // Task 10: Miscellaneous nodes
  {
    from: 'Merchant Pricing And Economy Integration > Merchant Modal Price Wiring',
    to: 'Merchant Pricing And Economy Integration > Wire Merchant Screen to Economy'
  },
  {
    from: 'URL And History State Synchronization > Initial Mount Guard',
    to: 'URL And History State Synchronization > Prevent Bad History Write on First Load'
  }
];

const ROADMAP_CAPABILITY_RENAME_MAP = new Map(
  ROADMAP_CAPABILITY_RENAME_RULES.map((rule) => [rule.from.toLowerCase(), rule.to] as const)
);

const ROADMAP_RENAMED_TO_PREVIOUS_LABEL_MAP = new Map(
  ROADMAP_CAPABILITY_RENAME_RULES.map((rule) => [rule.to.toLowerCase(), rule.from] as const)
);

const applyRoadmapCapabilityRename = (label: string) =>
  ROADMAP_CAPABILITY_RENAME_MAP.get(label.toLowerCase()) ?? label;

const toStableRoadmapLabel = (label: string) =>
  ROADMAP_RENAMED_TO_PREVIOUS_LABEL_MAP.get(label.toLowerCase()) ?? label;

const LEGACY_STRATEGIC_TO_CAPABILITY_FIRST: Record<string, string> = {
  'Roadmap Tool > Strategic Opportunity Mapping > Opportunity Collection':
    'Roadmap Tool > Strategic Opportunity Mapping > Operator Workflow > Opportunity Collection',
  'Roadmap Tool > Strategic Opportunity Mapping > Opportunity Scan Orchestration':
    'Roadmap Tool > Strategic Opportunity Mapping > Scan Pipeline > Scan Orchestration',
  'Roadmap Tool > Strategic Opportunity Mapping > Opportunity Flag Classification':
    'Roadmap Tool > Strategic Opportunity Mapping > Scan Pipeline > Flag Classification',
  'Roadmap Tool > Strategic Opportunity Mapping > Opportunity Propagation and Rollup':
    'Roadmap Tool > Strategic Opportunity Mapping > Scan Pipeline > Propagation And Rollup',
  'Roadmap Tool > Strategic Opportunity Mapping > Opportunity Snapshot Persistence':
    'Roadmap Tool > Strategic Opportunity Mapping > Data Persistence > Snapshot Persistence',
  'Roadmap Tool > Strategic Opportunity Mapping > Opportunity Scan Trigger':
    'Roadmap Tool > Strategic Opportunity Mapping > Operator Workflow > Scan Trigger',
  'Roadmap Tool > Strategic Opportunity Mapping > Opportunity Triage Panel':
    'Roadmap Tool > Strategic Opportunity Mapping > Operator Workflow > Triage Panel',
  'Roadmap Tool > Strategic Opportunity Mapping > Opportunity-to-Node Navigation':
    'Roadmap Tool > Strategic Opportunity Mapping > Operator Workflow > Node Navigation',
  'Roadmap Tool > Strategic Opportunity Mapping > Opportunity Crosslink Detection':
    'Roadmap Tool > Strategic Opportunity Mapping > Scan Pipeline > Crosslink Detection',
  'Roadmap Tool > Strategic Opportunity Mapping > Opportunity Filters and Sorts':
    'Roadmap Tool > Strategic Opportunity Mapping > Operator Workflow > Filters And Sorts',
  'Roadmap Tool > Strategic Opportunity Mapping > Historical Development Traceability':
    'Roadmap Tool > Strategic Opportunity Mapping > Governance And Expansion > Historical Development Traceability',
  'Roadmap Tool > Strategic Opportunity Mapping > Multi-Product Portfolio Branching (Future)':
    'Roadmap Tool > Strategic Opportunity Mapping > Governance And Expansion > Multi-product Portfolio Branching (future)'
};

// Technical: rewrites classic roadmap labels into capability-first labels.
// Layman: this clones the Roadmap branch but puts implementation modules under
// concrete capabilities (single tree) instead of a separate architecture branch.
const toCapabilityFirstRoadmapLabel = (subfeatureName: string): string | null => {
  if (!subfeatureName.startsWith('Roadmap Tool')) return subfeatureName;

  const mappedStrategic = LEGACY_STRATEGIC_TO_CAPABILITY_FIRST[subfeatureName];
  if (mappedStrategic) return applyRoadmapCapabilityRename(mappedStrategic);

  const modulePrefix = 'Roadmap Tool > Strategic Opportunity Mapping > Opportunity Module Architecture > ';
  const architectureNode = 'Roadmap Tool > Strategic Opportunity Mapping > Opportunity Module Architecture';
  if (subfeatureName === architectureNode) {
    return null;
  }

  if (subfeatureName.startsWith(modulePrefix)) {
    const moduleName = subfeatureName.slice(modulePrefix.length).trim();
    const capabilityParent = CAPABILITY_FIRST_MODULE_PARENT_BY_NAME[moduleName];
    if (!capabilityParent) return null;
    return applyRoadmapCapabilityRename(`Roadmap Tool > Strategic Opportunity Mapping > ${capabilityParent} > ${moduleName}`);
  }

  return applyRoadmapCapabilityRename(subfeatureName.replace(/^Roadmap Tool(?=$| >)/, 'Roadmap Tool'));
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
    feature: 'Roadmap Tool',
    subFeatures: transformedSubFeatures
  };
});

const ROADMAP_CAPABILITY_FIRST_DEV_FEATURE_BUCKET: FeatureBucket = {
  id: 'feature_roadmap_capability_first_dev_tools',
  featureGroup: 'roadmap-capability-first-dev-tools',
  feature: 'Roadmap Tool',
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
      { name: 'Race Portrait Image Generation > AI Session Manager', state: 'active', canonicalPath: 'scripts/workflows/gemini/core/image-gen-mcp.ts' },
      { name: 'Race Portrait Image Generation > AI Session Manager > Check AI Connection Is Alive', state: 'done', canonicalPath: 'scripts/workflows/gemini/core/image-gen-mcp.ts' },
      { name: 'Race Portrait Image Generation > AI Session Manager > Find the Right AI Browser Tab', state: 'done', canonicalPath: 'scripts/workflows/gemini/core/image-gen-mcp.ts' },
      { name: 'Race Portrait Image Generation > AI Session Manager > Dismiss AI Consent Popups', state: 'done', canonicalPath: 'scripts/workflows/gemini/core/image-gen-mcp.ts' },
      { name: 'Race Portrait Image Generation > AI Session Manager > Start Fresh Chat Per Image', state: 'active', canonicalPath: 'scripts/workflows/gemini/core/image-gen-mcp.ts' },
      { name: 'Race Portrait Image Generation > AI Session Manager > Confirm New Chat Started', state: 'active', canonicalPath: 'scripts/workflows/gemini/core/image-gen-mcp.ts' },
      { name: 'Race Portrait Image Generation > AI Session Manager > Prevent Two Runs at Once', state: 'planned', canonicalPath: 'docs/portraits/race_portrait_regen_handoff.md' },
      { name: 'Race Portrait Image Generation > Image Prompt Builder', state: 'active', canonicalPath: 'scripts/workflows/gemini/image-gen/regenerate-race-images-from-backlog.ts' },
      { name: 'Race Portrait Image Generation > Image Prompt Builder > Base Prompt Templates', state: 'active', canonicalPath: 'scripts/workflows/gemini/image-gen/regenerate-race-images-from-backlog.ts' },
      { name: 'Race Portrait Image Generation > Image Prompt Builder > Per-Race Prompt Overrides', state: 'active', canonicalPath: 'scripts/workflows/gemini/image-gen/regenerate-race-images-from-backlog.ts' },
      { name: 'Race Portrait Image Generation > Image Prompt Builder > Gender-Specific Prompts', state: 'active', canonicalPath: 'scripts/workflows/gemini/image-gen/regenerate-race-images-from-backlog.ts' },
      { name: 'Race Portrait Image Generation > Image Prompt Builder > What to Include in Prompts', state: 'active', canonicalPath: 'scripts/workflows/gemini/image-gen/regenerate-race-images-from-backlog.ts' },
      { name: 'Race Portrait Image Generation > Image Prompt Builder > Assign Activities to Characters', state: 'active', canonicalPath: 'scripts/workflows/gemini/image-gen/regenerate-race-images-from-backlog.ts' },
      { name: 'Race Portrait Image Generation > Image Prompt Builder > Prevent Duplicate Activities', state: 'done', canonicalPath: 'scripts/audits/list-slice-of-life-settings.ts' },
      { name: 'Race Portrait Image Generation > Image Prompt Builder > Track Which Prompts Were Used', state: 'planned', canonicalPath: 'docs/portraits/race_portrait_regen_handoff.md' },
      { name: 'Race Portrait Image Generation > Execution Reliability', state: 'active', canonicalPath: 'scripts/workflows/gemini/core/image-gen-mcp.ts' },
      { name: 'Race Portrait Image Generation > Execution Reliability > One Run at a Time', state: 'done', canonicalPath: 'scripts/workflows/gemini/image-gen/regenerate-race-images-from-backlog.ts' },
      { name: 'Race Portrait Image Generation > Execution Reliability > Retry Download on Failure', state: 'done', canonicalPath: 'scripts/workflows/gemini/core/image-gen-mcp.ts' },
      { name: 'Race Portrait Image Generation > Execution Reliability > Know When to Retry', state: 'done', canonicalPath: 'scripts/workflows/gemini/image-gen/regenerate-race-images-from-backlog.ts' },
      { name: 'Race Portrait Image Generation > Execution Reliability > Wait Times Between Attempts', state: 'done', canonicalPath: 'scripts/workflows/gemini/image-gen/regenerate-race-images-from-backlog.ts' },
      { name: 'Race Portrait Image Generation > Execution Reliability > Resume From Last Completed Item', state: 'active', canonicalPath: 'scripts/workflows/gemini/image-gen/regenerate-race-images-from-backlog.ts' },
      { name: 'Race Portrait Image Generation > Execution Reliability > Handle Bad Requests Gracefully', state: 'done', canonicalPath: 'scripts/workflows/gemini/core/image-gen-mcp.ts' },
      { name: 'Race Portrait Image Generation > Execution Reliability > Recover Failed Downloads', state: 'active', canonicalPath: 'scripts/workflows/gemini/core/image-gen-mcp.ts' },
      { name: 'Race Portrait Image Generation > Quality Gates', state: 'active', canonicalPath: 'scripts/workflows/gemini/image-gen/regenerate-race-images-from-backlog.ts' },
      { name: 'Race Portrait Image Generation > Quality Gates > Require Square Images', state: 'done', canonicalPath: 'scripts/audits/check-image-square.py' },
      { name: 'Race Portrait Image Generation > Quality Gates > Reject Images With Blank Borders', state: 'done', canonicalPath: 'scripts/audits/detect-blank-margins.py' },
      { name: 'Race Portrait Image Generation > Quality Gates > Verify Image Is Readable', state: 'active', canonicalPath: 'scripts/workflows/gemini/core/image-gen-mcp.ts' },
      { name: 'Race Portrait Image Generation > Quality Gates > Require Full Body in Frame', state: 'planned', canonicalPath: 'docs/portraits/race_portrait_regen_handoff.md' },
      { name: 'Race Portrait Image Generation > Quality Gates > Reject Duplicate Images', state: 'active', canonicalPath: 'scripts/audits/audit-race-image-bytes.ts' },
      { name: 'Race Portrait Image Generation > Quality Gates > Reject Images With UI Arrows', state: 'planned', canonicalPath: 'docs/portraits/race_portrait_regen_handoff.md' },
      { name: 'Race Portrait Image Generation > Quality Gates > Require Edge-to-Edge Image', state: 'done', canonicalPath: 'scripts/audits/detect-blank-margins.py' },
      { name: 'Race Portrait Image Generation > Post Generation Verification', state: 'active', canonicalPath: 'scripts/audits/verify-cc-glossary-race-sync.ts' },
      { name: 'Race Portrait Image Generation > Post Generation Verification > Track Activities Per Character', state: 'active', canonicalPath: 'scripts/audits/list-slice-of-life-settings.ts' },
      { name: 'Race Portrait Image Generation > Post Generation Verification > Verify Images Match In-Game Data', state: 'done', canonicalPath: 'scripts/audits/verify-cc-glossary-race-sync.ts' },
      { name: 'Race Portrait Image Generation > Post Generation Verification > Check Glossary Image Paths Match', state: 'done', canonicalPath: 'scripts/audits/verify-cc-glossary-race-sync.ts' },
      { name: 'Race Portrait Image Generation > Post Generation Verification > Check All Activities Are Covered', state: 'active', canonicalPath: 'scripts/audits/list-slice-of-life-settings.ts' },
      { name: 'Race Portrait Image Generation > Post Generation Verification > Decide Which Duplicate to Keep', state: 'active', canonicalPath: 'scripts/audits/list-slice-of-life-settings.ts' },
      { name: 'Race Portrait Image Generation > Post Generation Verification > Manual Approval Capture', state: 'active', canonicalPath: 'docs/portraits/race_portrait_regen_handoff.md' },
      { name: 'Race Portrait Image Generation > Post Generation Verification > Log Verification Results', state: 'active', canonicalPath: 'public/assets/images/races/race-image-status.json' },
      { name: 'Race Portrait Image Generation > Backlog Regeneration Runner', state: 'active', canonicalPath: 'docs/portraits/race_portrait_regen_backlog.json' },
      { name: 'Race Portrait Image Generation > Backlog Regeneration Runner > Process Any Backlog Category', state: 'done', canonicalPath: 'docs/portraits/race_portrait_regen_handoff.md' },
      { name: 'Race Portrait Image Generation > Backlog Regeneration Runner > Backlog Parsing and Filtering', state: 'done', canonicalPath: 'scripts/workflows/gemini/image-gen/regenerate-race-images-from-backlog.ts' },
      { name: 'Race Portrait Image Generation > Backlog Regeneration Runner > Run Specific Race and Gender Combos', state: 'done', canonicalPath: 'scripts/workflows/gemini/image-gen/regenerate-race-images-from-backlog.ts' },
      { name: 'Race Portrait Image Generation > Backlog Regeneration Runner > Record Status After Each Image', state: 'done', canonicalPath: 'public/assets/images/races/race-image-status.json' },
      { name: 'Race Portrait Image Generation > Backlog Regeneration Runner > Auto-Update the Run Guide', state: 'active', canonicalPath: 'docs/portraits/race_portrait_regen_handoff.md' },
      { name: 'Race Portrait Image Generation > Backlog Regeneration Runner > Audit After Each Run', state: 'done', canonicalPath: 'scripts/audits/verify-cc-glossary-race-sync.ts' },
      { name: 'Race Portrait Image Generation > Future Capability Expansion', state: 'active', canonicalPath: 'docs/portraits/race_portrait_regen_handoff.md' },
      { name: 'Race Portrait Image Generation > Future Capability Expansion > Quick-Fail Branch Test Runner', state: 'active', canonicalPath: 'devtools/roadmap/scripts/roadmap-engine/generate.ts' },
      { name: 'Race Portrait Image Generation > Future Capability Expansion > Where Node Tests Are Defined', state: 'done', canonicalPath: 'devtools/roadmap/scripts/roadmap-engine/types.ts' },
      { name: 'Race Portrait Image Generation > Future Capability Expansion > Quick-Fail Test Executor', state: 'done', canonicalPath: 'devtools/roadmap/scripts/roadmap-node-test.ts' },
      { name: 'Race Portrait Image Generation > Future Capability Expansion > How Long Test Logs Are Kept', state: 'active', canonicalPath: 'devtools/roadmap/scripts/roadmap-engine/node-test-status.ts' },
      { name: 'Race Portrait Image Generation > Future Capability Expansion > Test Status Badges on Nodes', state: 'planned', canonicalPath: 'devtools/roadmap/src/components/debug/roadmap/RoadmapVisualizer.tsx' }
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
      { name: 'Race Enrichment Pipeline > Planned Enhancements > Automated Promotion Gate to Game Data', state: 'planned', canonicalPath: 'docs/portraits/race_portrait_regen_handoff.md' }
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
  if (!subfeatureName.startsWith('Roadmap Tool')) return null;

  const normalized = toStableRoadmapLabel(subfeatureName);

  // Reverse map for renamed strategic-opportunity labels.
  for (const [legacy, capFirst] of Object.entries(LEGACY_STRATEGIC_TO_CAPABILITY_FIRST)) {
    if (normalized === capFirst) return legacy;
  }

  if (
    normalized === 'Roadmap Tool > Strategic Opportunity Mapping > Scan Pipeline' ||
    normalized === 'Roadmap Tool > Strategic Opportunity Mapping > Operator Workflow' ||
    normalized === 'Roadmap Tool > Strategic Opportunity Mapping > Data Persistence' ||
    normalized === 'Roadmap Tool > Strategic Opportunity Mapping > Governance And Expansion'
  ) {
    return 'Roadmap Tool > Strategic Opportunity Mapping';
  }

  const base = normalized.replace(/^Roadmap Tool(?=$| >)/, 'Roadmap Tool');
  const prefix = 'Roadmap Tool > Strategic Opportunity Mapping > ';
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
  if (featureName.toLowerCase() === 'roadmap tool') {
    return subfeatureName.startsWith('Roadmap Tool');
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

// ============================================================================
// Module Atomization Mapping
// ============================================================================
// Technical: maps roadmap module labels to concrete implementation files and
// falls back to canonical-doc inference for module cards not listed explicitly.
// Layman: this powers the "component files" list so module nodes can be audited
// as real code modules instead of just text labels.
// ============================================================================
const ROADMAP_TOOL_MODULE_IMPLEMENTATION_PATHS: Record<string, string> = {
  'Feature Naming Validation Module': 'devtools/roadmap/scripts/roadmap-orchestrate-one-doc.ts',
  'Worker Packet Schema Validation Module': 'devtools/roadmap/scripts/roadmap-packet-validation.ts',
  'Canvas Pan Navigation Module': 'devtools/roadmap/src/components/debug/roadmap/modules/canvas-pan-navigation.ts',
  'Global Branch Expansion Controls Module': 'devtools/roadmap/src/components/debug/roadmap/modules/global-branch-expansion-controls.ts',
  'Node Detail Panel Module': 'devtools/roadmap/src/components/debug/roadmap/modules/node-detail-panel.ts',
  'Node Position Editing Module': 'devtools/roadmap/src/components/debug/roadmap/modules/node-position-editing.ts',
  'Related Document Launch Module': 'devtools/roadmap/src/components/debug/roadmap/modules/related-document-launch.ts',
  'Panel Scroll Isolation Module': 'devtools/roadmap/src/components/debug/roadmap/modules/panel-scroll-isolation.ts',
  'Related Document Type Badging Module': 'devtools/roadmap/src/components/debug/roadmap/modules/related-document-type-badging.ts',
  'Branch Toggle Per Node Module': 'devtools/roadmap/src/components/debug/roadmap/modules/branch-toggle-per-node.ts',
  'Node Focus And Viewport Containment Module': 'devtools/roadmap/src/components/debug/roadmap/modules/node-focus-and-viewport-containment.ts',
  'Canvas View Reset Module': 'devtools/roadmap/src/components/debug/roadmap/modules/canvas-view-reset.ts',
  'Cursor-centered Wheel Zoom Module': 'devtools/roadmap/src/components/debug/roadmap/modules/cursor-centered-wheel-zoom.ts',
  'Test Metadata Annotation Module': 'devtools/roadmap/scripts/roadmap-server-logic.ts',
  'Roadmap History Traceability Module': 'devtools/roadmap/src/components/debug/roadmap/modules/roadmap-history-traceability.ts',
  'Multi-product Roadmap Branching Module': 'devtools/roadmap/src/components/debug/roadmap/modules/multi-product-roadmap-branching.ts',
  'Opportunity Filtering And Sorting Module': 'devtools/roadmap/src/components/debug/roadmap/modules/opportunity-filtering-and-sorting.ts',
  'Opportunity To Node Navigation Module': 'devtools/roadmap/src/components/debug/roadmap/modules/opportunity-to-node-navigation.ts',
  'Opportunity Scan Initiation Module': 'devtools/roadmap/src/components/debug/roadmap/modules/opportunity-scan-initiation.ts',
  'Opportunity Triage Workspace Module': 'devtools/roadmap/src/components/debug/roadmap/modules/opportunity-triage-workspace.ts'
};

const MODULE_CODE_FILE_SUFFIXES = [
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mts',
  '.cts',
  '.mjs',
  '.cjs',
  '.py'
];

const isRoadmapModuleLabel = (label: string) => label.trim().toLowerCase().endsWith(' module');

const getModuleNameFromLabel = (label: string) =>
  label
    .split('>')
    .map((part) => part.trim())
    .filter(Boolean)
    .pop() ?? '';

const normalizeRoadmapPath = (rawPath: string) => String(rawPath || '').trim().replace(/\\/g, '/');

const isLikelyTestFilePath = (rawPath: string) => {
  const normalized = normalizeRoadmapPath(rawPath).toLowerCase();
  return (
    /(^|\/)[^/]+\.(test|spec)\.[a-z0-9]+$/i.test(normalized) ||
    normalized.endsWith('.test-d.ts')
  );
};

const isLikelyCodeFilePath = (rawPath: string) => {
  const normalized = normalizeRoadmapPath(rawPath).toLowerCase();
  return MODULE_CODE_FILE_SUFFIXES.some((suffix) => normalized.endsWith(suffix));
};

const deriveComponentFiles = (subfeatureName: string, canonicalDocs: string[]): string[] | undefined => {
  if (!isRoadmapModuleLabel(subfeatureName)) return undefined;

  // Prefer explicit module-to-file mappings for renamed/cross-cutting modules.
  const moduleName = getModuleNameFromLabel(subfeatureName);
  const explicitPath = ROADMAP_TOOL_MODULE_IMPLEMENTATION_PATHS[moduleName];
  if (explicitPath) return [explicitPath];

  // Fall back to canonical docs when the module is already represented by one code file.
  const inferredCodeFiles = Array.from(
    new Set(
      canonicalDocs
        .map(normalizeRoadmapPath)
        .filter(Boolean)
        .filter(isLikelyCodeFilePath)
        .filter((docPath) => !isLikelyTestFilePath(docPath))
    )
  ).sort();

  if (inferredCodeFiles.length > 0) {
    return inferredCodeFiles;
  }

  // Last-resort fallback keeps at least one reference so module audits stay observable.
  const fallback = canonicalDocs.map(normalizeRoadmapPath).filter(Boolean);
  return fallback.length > 0 ? [fallback[0]] : undefined;
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
        const componentFiles = deriveComponentFiles(sub.name, canonicalDocs);
        // Technical: keep node ids stable across capability renames by deriving id slug
        // from the pre-rename label when a rename rule exists.
        // Layman: renaming roadmap text should not break saved layout/test history keys.
        const stableIdLabel = toStableRoadmapLabel(sub.name);
        const subId = `sub_${slug(pillarNodeId)}_${slug(stableIdLabel)}`;
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
          componentFiles,
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
