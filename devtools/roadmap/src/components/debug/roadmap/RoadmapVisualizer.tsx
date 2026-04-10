// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 01/03/2026, 01:15:27
 * Dependents: RoadmapVisualizer.tsx
 * Imports: 7 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, useMotionValue } from 'framer-motion';
import type {
  OpportunitySettings as OpportunitySettingsContract,
  RoadmapNode as HealthSignalRoadmapNode
} from '../../../../scripts/roadmap-server-logic';
import { GRID_SIZE, THEME_STORAGE_KEY, nextThemeMode, TRUNK_X } from './constants';
import { SpellGraphOverlay } from '../../../spell-branch/SpellGraphOverlay';
import type { VirtualNodeDetail } from '../../../spell-branch/types';
import { buildRenderGraph } from './graph';
import { OpportunitySettingsForm } from './OpportunitySettingsForm';
import { NodeHealthBadge } from './health-signals/NodeHealthBadge';
import { computeHealthSignals } from './health-signals/compute-health-signals';
import type { HealthSignal } from './health-signals/types';
import { toggleBranchExpansionForNode } from './modules/branch-toggle-per-node';
import { toggleBranchVisibilityForNode } from './modules/branch-visibility-per-node';
import { collapseSiblingBranchesForNode } from './modules/collapse-sibling-branches';
import { expandAllBranches, collapseAllBranches } from './modules/global-branch-expansion-controls';
import { collectHiddenImmediateBranchIds, restoreHiddenBranches } from './modules/restore-hidden-branches';
import { resetCanvasView } from './modules/canvas-view-reset';
import { applyCursorCenteredWheelZoom, MAX_ROADMAP_SCALE } from './modules/cursor-centered-wheel-zoom';
import { startCanvasPanNavigationDrag } from './modules/canvas-pan-navigation';
import {
  type LayoutPositions,
  applyDragDeltaToNodeOverrides,
  collectVisibleDragBranchNodeIds,
  snapDraggedNodeOverridesToGrid
} from './modules/node-position-editing';
import {
  describeRelatedDocType,
  relatedDocTypeBadgeClass
} from './modules/related-document-type-badging';
import { openRelatedDocumentInVSCode } from './modules/related-document-launch';
import { buildSelectedDetailPathLabel, resolveSelectedDetailTitle } from './modules/node-detail-panel';
import {
  type OpportunityViewMode,
  type OpportunityFilterState,
  buildSortedOpportunityRows,
  getFlaggedCountForMode,
  getOpportunityFlagsForMode
} from './modules/opportunity-filtering-and-sorting';
import {
  collectRoadmapNodeIdsForScopeSelection,
  describeRoadmapBranchScopeSelection,
  filterRoadmapDataByScopeSelection,
  normalizeRoadmapBranchScopeSelection,
  ROADMAP_BRANCH_SCOPE_IDS,
  ROADMAP_PRODUCT_VIEWS,
  type RoadmapBranchScopeId,
  type RoadmapProductViewId,
  toRoadmapBranchScopeSelection
} from './modules/multi-product-roadmap-branching';
import {
  type OpportunityScanTrigger,
  loadLatestOpportunityScanPayload,
  runOpportunityScan
} from './modules/opportunity-scan-initiation';
import {
  centerViewportOnOpportunityNode,
  expandTreeForOpportunityNode
} from './modules/opportunity-to-node-navigation';
import { ensureViewportContainsNode } from './modules/node-focus-and-viewport-containment';
import {
  OPPORTUNITY_LABELS,
  opportunitySeverityChipClass,
  type OpportunityFlagType,
  type OpportunitySeverity
} from './modules/opportunity-triage-workspace';
import type { RoadmapHistoryTraceabilityPayload } from './modules/roadmap-history-traceability';
import { loadRoadmapBootstrapData } from './modules/roadmap-bootstrap-loader';
import type { RenderNode, RoadmapData, ThemeMode } from './types';
import { formatLevelCounts } from './utils';

/**
 * Technical:
 * Main React surface for the roadmap tool. It loads roadmap data, builds render graph output,
 * handles pan/zoom/drag interactions, and renders both control chrome and node/detail UI.
 *
 * Layman:
 * This is the actual roadmap screen you interact with. It fetches the roadmap content, shows
 * nodes and connector lines, lets you move around and drag branches, and shows doc details when
 * you click a node.
 */

// ============================================================================
// Local Types
// ============================================================================
// Technical: UI-local state shapes for saved node coordinates and save lifecycle.
// Layman: simple labels for where nodes are and whether saving is idle/saving/saved/error.
// ============================================================================
type NodeRenameState = 'idle' | 'saving' | 'success' | 'error';
type LayoutSaveState = 'idle' | 'saving' | 'saved' | 'error';
type NodeTestRunState = 'idle' | 'running' | 'success' | 'error';
type NodeTestRunResponse = {
  total: number;
  pass: number;
  fail: number;
  results: Array<{ nodeId: string; ok: boolean; message: string }>;
};
type OpportunityFlag = {
  type: OpportunityFlagType;
  severity: OpportunitySeverity;
  reason: string;
  ownerNodeIds: string[];
  propagatedFromNodeIds?: string[];
};
type OpportunityNodeRecord = {
  nodeId: string;
  label: string;
  nodeType: 'root' | 'project' | 'milestone' | 'task';
  status: 'done' | 'active' | 'planned';
  projectId?: string;
  directFlags: OpportunityFlag[];
  propagatedFlags: OpportunityFlag[];
  ownerNodeIds: string[];
};
type OpportunityScanSummary = {
  totalNodes: number;
  flaggedDirectNodes: number;
  flaggedPropagatedNodes: number;
  flagTypeCountsDirect: Record<OpportunityFlagType, number>;
  flagTypeCountsPropagated: Record<OpportunityFlagType, number>;
};
type OpportunityScanPayload = {
  version: '1.0.0';
  scanId: string;
  generatedAt: string;
  trigger: OpportunityScanTrigger;
  summary: OpportunityScanSummary;
  nodes: OpportunityNodeRecord[];
};
type OpportunitySettings = OpportunitySettingsContract & {
  parentModeDefault?: OpportunityViewMode;
};
type NodeContextMenuState = {
  nodeId: string;
  parentId: string | null;
  label: string;
  x: number;
  y: number;
};

const EMPTY_HISTORY_PAYLOAD: RoadmapHistoryTraceabilityPayload = {
  status: 'empty',
  generatedAt: new Date(0).toISOString(),
  request: {
    selectedNodeId: null,
    selectedNodeLabel: null,
    limit: 10
  },
  resolvedPaths: [],
  commits: [],
  pathSummaries: [],
  summary: {
    commitCount: 0,
    uniquePathCount: 0
  }
};

// ============================================================================
// Quick Start Timing
// ============================================================================
// Technical: the onboarding card auto-hides after a short session-only timer,
// unless the user explicitly cancels that timer.
// Layman: Quick Start can quietly get out of the way on its own, but the user
// can stop that countdown if they want the help card to stay open while browsing.
// ============================================================================
const QUICK_START_AUTO_DISMISS_SECONDS = 30;

// Technical: status badge color palette by theme.
// Layman: picks badge colors for Done/Active/Planned on dark/light mode.
const statusChipClass = (status: 'done' | 'active' | 'planned', isDark: boolean) => {
  if (isDark) {
    if (status === 'done') return 'border-emerald-500/60 bg-emerald-500/20 text-emerald-200';
    if (status === 'active') return 'border-amber-500/70 bg-amber-500/20 text-amber-100';
    return 'border-cyan-500/40 bg-cyan-500/10 text-cyan-200';
  }
  if (status === 'done') return 'border-emerald-400 bg-emerald-50 text-emerald-700';
  if (status === 'active') return 'border-amber-400 bg-amber-50 text-amber-700';
  return 'border-blue-300 bg-blue-50 text-blue-700';
};

// Technical: standard button style for top-row controls.
// Layman: gives all toolbar buttons one consistent "glass panel" look.
const glassButtonClass = (isDark: boolean) =>
  isDark
    ? 'bg-slate-900/70 border-cyan-500/30 text-slate-100 hover:bg-slate-800/90 hover:border-cyan-400/60'
    : 'bg-white/80 border-slate-300 text-slate-700 hover:bg-white';

// Technical: selected nodes need a stronger visual read than a plain border so the
// "last clicked / info panel owner" state is obvious even in the busy roadmap scene.
// Layman: this adds the glow treatment for the currently selected node.
const selectedNodeGlowStyle = (isDark: boolean) => ({
  boxShadow: isDark
    ? '0 0 0 1px rgba(34, 211, 238, 0.42), 0 0 24px rgba(34, 211, 238, 0.24)'
    : '0 0 0 1px rgba(79, 70, 229, 0.28), 0 0 20px rgba(79, 70, 229, 0.16)'
});


// Technical: canned demo warning badges used only inside the node-explanation popout.
// Layman: this lets the explainer show what each warning chip looks like without
// requiring the user to hunt for a "perfect example" node in the live roadmap.
const NODE_EXPLANATION_DEMO_SIGNALS: HealthSignal[] = [
  { kind: 'no-test', message: 'This node does not declare a test file yet.' },
  { kind: 'test-not-run', message: 'A test exists for this node, but it has not been run recently.' },
  { kind: 'not-atomized', message: 'This node currently points at multiple implementation files and may need splitting.' },
  { kind: 'density-warning', message: 'This branch level is visually crowded compared to its siblings.' }
];

// ============================================================================
// Layer + Module Appearance Helpers
// ============================================================================
// Technical: deterministic color palettes and helpers for branch depth-level styling
// and module-card highlighting.
// Layman: gives each hierarchy layer a distinct color and makes module cards look
// visually different while still readable in dark/light themes.
// ============================================================================
type BranchLayerTone = {
  border: string;
  background: string;
  hover: string;
  levelLabel: string;
};

const BRANCH_LAYER_TONES_DARK: BranchLayerTone[] = [
  { border: 'border-cyan-500/55', background: 'bg-[#0f243fcc]', hover: 'hover:bg-[#163257d8]', levelLabel: 'text-cyan-300' },
  { border: 'border-emerald-500/55', background: 'bg-[#0f2b29cc]', hover: 'hover:bg-[#1a3a37d8]', levelLabel: 'text-emerald-300' },
  { border: 'border-amber-500/55', background: 'bg-[#312610cc]', hover: 'hover:bg-[#47361cd8]', levelLabel: 'text-amber-300' },
  { border: 'border-violet-500/55', background: 'bg-[#26163bcc]', hover: 'hover:bg-[#352254d8]', levelLabel: 'text-violet-300' },
  { border: 'border-rose-500/55', background: 'bg-[#331826cc]', hover: 'hover:bg-[#4a2236d8]', levelLabel: 'text-rose-300' }
];

const BRANCH_LAYER_TONES_LIGHT: BranchLayerTone[] = [
  { border: 'border-cyan-300', background: 'bg-cyan-50/80', hover: 'hover:bg-cyan-100/90', levelLabel: 'text-cyan-700' },
  { border: 'border-emerald-300', background: 'bg-emerald-50/80', hover: 'hover:bg-emerald-100/90', levelLabel: 'text-emerald-700' },
  { border: 'border-amber-300', background: 'bg-amber-50/80', hover: 'hover:bg-amber-100/90', levelLabel: 'text-amber-700' },
  { border: 'border-violet-300', background: 'bg-violet-50/80', hover: 'hover:bg-violet-100/90', levelLabel: 'text-violet-700' },
  { border: 'border-rose-300', background: 'bg-rose-50/80', hover: 'hover:bg-rose-100/90', levelLabel: 'text-rose-700' }
];

const getBranchLayerTone = (depth: number | undefined, isDark: boolean): BranchLayerTone => {
  const normalizedDepth = Number.isFinite(depth) ? Math.max(1, Number(depth)) : 1;
  const palette = isDark ? BRANCH_LAYER_TONES_DARK : BRANCH_LAYER_TONES_LIGHT;
  return palette[(normalizedDepth - 1) % palette.length];
};

// Technical: keep the load metric compact but still readable in the summary card.
// Layman: short load times show as milliseconds, slower ones as seconds.
const formatRoadmapLoadMetric = (durationMs: number | null) => {
  if (durationMs == null) return '--';
  if (durationMs < 1000) return `${Math.round(durationMs)}ms`;
  return `${(durationMs / 1000).toFixed(durationMs >= 10_000 ? 1 : 2)}s`;
};

const isModuleNodeLabel = (label: string) => label.trim().toLowerCase().endsWith(' module');

const moduleBadgeClass = (isDark: boolean) =>
  isDark
    ? 'border-fuchsia-500/70 bg-fuchsia-900/45 text-fuchsia-100'
    : 'border-fuchsia-300 bg-fuchsia-50 text-fuchsia-700';

// Technical: guards layout payload so only numeric {x,y} entries survive.
// Layman: ignores broken save data so bad coordinates do not crash layout restore.
// Technical: guards label override payload so only non-empty string entries survive.
// Layman: ignore invalid rename entries so bad saved data cannot break node labels.
const sanitizeLabelOverrides = (input: unknown): Record<string, string> => {
  if (!input || typeof input !== 'object') return {};
  const output: Record<string, string> = {};
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (typeof value !== 'string') continue;
    const trimmed = value.trim();
    if (!trimmed) continue;
    output[key] = trimmed;
  }
  return output;
};

// Technical:
// The roadmap uses a large world-space canvas so pan/zoom/drag still works when the user
// moves far away from the initial center.
//
// Layman:
// Think of this like a giant sheet of graph paper. Nodes and lines are drawn on that sheet
// so you can keep moving around without "falling off" the map.
//
// Technical:
// If these values change, grid layer and SVG connector layer must stay in sync or edges can
// appear disconnected.
//
// Layman:
// If someone changes these numbers in only one place, lines may look broken even when data is
// correct.
const CANVAS_MIN = -12000;
const CANVAS_SIZE = 32000;
const CANVAS_OFFSET = -CANVAS_MIN;
const AUTO_SAVE_LAYOUT_STORAGE_KEY = 'roadmap_auto_save_layout_v1';
const QUICK_START_DISMISSED_STORAGE_KEY = 'roadmap_quick_start_dismissed_v1';
const ROADMAP_SCOPE_SELECTION_STORAGE_KEY = 'roadmap_scope_selection_v1';

// ============================================================================
// Main Component
// ============================================================================
// Technical: orchestrates data loading, graph build, interaction state, and rendering.
// Layman: this is the roadmap app itself.
// ============================================================================
interface RoadmapVisualizerProps {
  onOpenSpellBranch?: (choices: import('../../../spell-branch/types').AxisChoice[]) => void;
}

export const RoadmapVisualizer: React.FC<RoadmapVisualizerProps> = ({ onOpenSpellBranch }) => {
  // Technical: roadmap source payload and load/error lifecycle.
  // Layman: loaded roadmap data and whether the screen is still loading or failed.
  const [data, setData] = useState<RoadmapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Technical: capture one honest startup timing value for the roadmap screen.
  // Layman: this is the "how many seconds did the roadmap take to show up" metric.
  const loadStartTimeRef = useRef(
    typeof performance !== 'undefined' ? performance.now() : Date.now()
  );
  const [initialLoadDurationMs, setInitialLoadDurationMs] = useState<number | null>(null);

  // Technical: node selection + expansion model for collapsible branches.
  // Layman: which node is selected and which nodes are unfolded right now.
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedVirtualId, setSelectedVirtualId] = useState<string | null>(null);
  const [selectedVirtualDetail, setSelectedVirtualDetail] = useState<VirtualNodeDetail | null>(null);
  const [expandedNodeIds, setExpandedNodeIds] = useState<Set<string>>(() => new Set(['aralia_chronicles']));
  // Technical: branch ids in this set are intentionally removed from the visible
  // render tree until the user explicitly restores them.
  // Layman: these are the child branches that are hidden from view right now.
  const [collapsedBranchNodeIds, setCollapsedBranchNodeIds] = useState<Set<string>>(() => new Set());

  // Technical: visual controls for zoom/theme/crosslink visibility.
  // Layman: UI display toggles for magnification, dark mode, and crosslink lines.
  const [zoomLevel, setZoomLevel] = useState(1);
  const [themeMode, setThemeMode] = useState<ThemeMode>('dark');
  const [showCrosslinks, setShowCrosslinks] = useState(true);
  // Technical: keep product-branch selection as a composable set rather than one
  // exclusive view id so multiple slices can stay visible under one trunk.
  // Layman: this is the real "multi-product branching" state for the roadmap UI.
  const [roadmapScopeSelection, setRoadmapScopeSelection] = useState<Set<RoadmapBranchScopeId>>(
    () => new Set(ROADMAP_BRANCH_SCOPE_IDS)
  );

  // Technical: user-adjusted node coordinates + save state.
  // Layman: remembers moved node positions and whether layout changes are unsaved.
  const [positionOverrides, setPositionOverrides] = useState<LayoutPositions>({});
  const [layoutDirty, setLayoutDirty] = useState(false);
  const [layoutSaveState, setLayoutSaveState] = useState<LayoutSaveState>('idle');
  // Technical: auto-save toggle is separate from manual save on purpose.
  // Layman: user can choose "save only when I press button" or "save automatically."
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(false);
  // Technical: compact top-left menu keeps toolbar actions available without
  // permanently occupying the canvas edge.
  // Layman: one small button opens the full roadmap control drawer when needed.
  const [showToolbarMenu, setShowToolbarMenu] = useState(false);
  // Technical: controls save-help explanatory panel.
  // Layman: opens the little "what does save do?" helper panel.
  const [showLayoutHelp, setShowLayoutHelp] = useState(false);
  // Technical: opens a standalone legend-like modal for node chrome meanings.
  // Layman: this is the popout that explains what the badges, labels, and actions on a node mean.
  const [showNodeExplanation, setShowNodeExplanation] = useState(false);
  // Technical: first-run onboarding panel is visible until the user dismisses it.
  // Layman: brief reminder of how to move around the roadmap without hunting docs.
  const [showQuickStart, setShowQuickStart] = useState(false);
  // Technical: this only cancels the session countdown, not the panel itself.
  // Layman: lets the user keep Quick Start open without dismissing it forever.
  const [quickStartTimerCanceled, setQuickStartTimerCanceled] = useState(false);
  // Technical: countdown display for the session-only auto-dismiss behavior.
  // Layman: shows how many seconds remain before Quick Start hides itself.
  const [quickStartSecondsRemaining, setQuickStartSecondsRemaining] = useState(QUICK_START_AUTO_DISMISS_SECONDS);
  const [vscodeStatus, setVscodeStatus] = useState<string | null>(null);
  const [nodeTestState, setNodeTestState] = useState<NodeTestRunState>('idle');
  const [nodeTestStatus, setNodeTestStatus] = useState<string | null>(null);
  const [isCanvasDragging, setIsCanvasDragging] = useState(false);
  // Technical: tracks dynamic toolbar bottom position to avoid overlapping overlays.
  // Layman: if buttons wrap to a second row, this pushes info panels down so they do not collide.
  const [topControlsBottom, setTopControlsBottom] = useState(58);
  // Technical: compact/mobile layout decisions need the current viewport width.
  // Layman: this lets the roadmap shrink or simplify overlays on smaller screens.
  const [viewportWidth, setViewportWidth] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth : 1280
  );
  // Technical: when false, node clicks only toggle expand/collapse â€” no detail panel opens.
  // Layman: toggle to disable the info card popping open every time you click a node.
  const [infoPanelEnabled, setInfoPanelEnabled] = useState(true);
  // Technical: lightweight right-click menu anchored to the clicked node position.
  // Layman: this is the custom in-app right-click menu for sibling branch actions.
  const [nodeContextMenu, setNodeContextMenu] = useState<NodeContextMenuState | null>(null);

  // Technical: opportunities drawer + scanner states.
  // Layman: controls the collector panel, scan mode, and latest scanner output.
  const [showOpportunities, setShowOpportunities] = useState(false);
  const [opportunityMode, setOpportunityMode] = useState<OpportunityViewMode>('propagated');
  const [opportunityFilters, setOpportunityFilters] = useState<OpportunityFilterState>({
    searchText: '',
    severity: 'all',
    type: 'all',
    sortMode: 'flag-count'
  });
  const [opportunityData, setOpportunityData] = useState<OpportunityScanPayload | null>(null);
  const [opportunitySettings, setOpportunitySettings] = useState<OpportunitySettings | null>(null);
  const [opportunityLoading, setOpportunityLoading] = useState(false);
  const [opportunityStatus, setOpportunityStatus] = useState<string | null>(null);
  const [opportunityError, setOpportunityError] = useState<string | null>(null);
  const [showMediaPreview, setShowMediaPreview] = useState(false);
  // Technical: center-focus request used by opportunity drawer "go to node".
  // Layman: when you jump from the opportunities list, this puts that node in the screen center.
  const [pendingFocusNodeId, setPendingFocusNodeId] = useState<string | null>(null);
  // Technical: containment-focus request used by direct roadmap node clicks.
  // Layman: keeps clicked/expanded branch targets visible so follow-up clicks are possible.
  const [pendingContainNodeId, setPendingContainNodeId] = useState<string | null>(null);

  // Technical: per-node display-name overrides + inline rename workflow state.
  // Layman: lets users rename node labels in UI without changing the node's identity key.
  const [nodeLabelOverrides, setNodeLabelOverrides] = useState<Record<string, string>>({});
  const [renameDraft, setRenameDraft] = useState('');
  const [renameState, setRenameState] = useState<NodeRenameState>('idle');
  const [renameStatus, setRenameStatus] = useState<string | null>(null);
  const [historyPayload, setHistoryPayload] = useState<RoadmapHistoryTraceabilityPayload>(EMPTY_HISTORY_PAYLOAD);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  // Technical: mutable refs + motion values for drag intent and canvas transform.
  // Layman: remembers if the last click was actually a drag, and stores map pan/zoom.
  const dragWasMovementRef = useRef(false);
  const renameSeededNodeIdRef = useRef<string | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const topControlsRef = useRef<HTMLDivElement | null>(null);
  const nodeContextMenuRef = useRef<HTMLDivElement | null>(null);
  const canvasPanX = useMotionValue(0);
  const canvasPanY = useMotionValue(0);
  const canvasScale = useMotionValue(1);
  const isDark = themeMode === 'dark';
  const isCompactViewport = viewportWidth < 640;

  // Technical: map lookup avoids repeated object scans during graph operations.
  // Layman: quick lookup table for moved node positions by id.
  const positionOverrideMap = useMemo(
    () => new Map(Object.entries(positionOverrides).map(([id, pos]) => [id, pos])),
    [positionOverrides]
  );

  // Technical: resolve label override by node id with fallback to generated label.
  // Layman: if you've renamed a node, show that custom name; otherwise show default.
  const labelForNodeId = useCallback((nodeId: string, fallback: string) => {
    const override = nodeLabelOverrides[nodeId];
    if (typeof override !== 'string') return fallback;
    const trimmed = override.trim();
    return trimmed.length > 0 ? trimmed : fallback;
  }, [nodeLabelOverrides]);

  // Technical: summarize the current branch selection for menu labels/footer text.
  // Layman: turns the selected branch scopes into a short human-readable label.
  const roadmapScopeSummary = useMemo(
    () => describeRoadmapBranchScopeSelection(roadmapScopeSelection),
    [roadmapScopeSelection]
  );

  // Technical: preset buttons still matter for fast switching, but they now map
  // into the composable branch-selection state instead of replacing it outright.
  // Layman: the old one-click views still work, they just feed the newer branch system.
  const applyRoadmapViewPreset = useCallback((viewId: RoadmapProductViewId) => {
    setRoadmapScopeSelection(normalizeRoadmapBranchScopeSelection(toRoadmapBranchScopeSelection(viewId)));
    setSelectedNodeId(null);
    setPendingContainNodeId(null);
  }, []);

  // Technical: toggles one branch scope inside the composable selection.
  // Layman: lets the user mix branches like Gameplay + Roadmap Tool instead of
  // being forced into a single exclusive view.
  const toggleRoadmapBranchScope = useCallback((scopeId: RoadmapBranchScopeId) => {
    setRoadmapScopeSelection((previous) => {
      const next = new Set(previous);
      if (next.has(scopeId)) {
        next.delete(scopeId);
      } else {
        next.add(scopeId);
      }
      return normalizeRoadmapBranchScopeSelection(next);
    });
    setSelectedNodeId(null);
    setPendingContainNodeId(null);
  }, []);

  // Technical: opens Quick Start in "count down unless canceled" mode.
  // Layman: whenever the help card is shown intentionally, it gets a fresh 30-second timer.
  const openQuickStartWithFreshTimer = useCallback(() => {
    setQuickStartSecondsRemaining(QUICK_START_AUTO_DISMISS_SECONDS);
    setQuickStartTimerCanceled(false);
    setShowQuickStart(true);
  }, []);

  // Technical: closes Quick Start for the current session only.
  // Layman: this just hides the card right now; it does not mark it as permanently dismissed.
  const closeQuickStartForSession = useCallback(() => {
    setShowQuickStart(false);
  }, []);

  // Technical: closes Quick Start and remembers that choice in browser storage.
  // Layman: this is the "don't keep showing me this on startup" action.
  const dismissQuickStartPermanently = useCallback(() => {
    setShowQuickStart(false);
    try {
      localStorage.setItem(QUICK_START_DISMISSED_STORAGE_KEY, '1');
    } catch {
      // ignore
    }
  }, []);

  // Technical: keeps the top-bar Quick Start button behavior consistent:
  // reopening the panel should restart the countdown unless the user cancels it again.
  // Layman: if you open Quick Start again later, it behaves like a fresh help card.
  const toggleQuickStartPanel = useCallback(() => {
    if (showQuickStart) {
      closeQuickStartForSession();
      return;
    }
    openQuickStartWithFreshTimer();
  }, [closeQuickStartForSession, openQuickStartWithFreshTimer, showQuickStart]);

  // Technical: restore theme preference from browser storage.
  // Layman: remember if this browser last used dark or light mode.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(THEME_STORAGE_KEY) as ThemeMode | null;
      if (saved === 'dark' || saved === 'light') setThemeMode(saved);
    } catch {
      // ignore
    }
  }, []);

  // Technical: restore auto-save preference per browser profile.
  // Layman: keep your auto-save toggle choice between visits.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(AUTO_SAVE_LAYOUT_STORAGE_KEY);
      setAutoSaveEnabled(saved === '1');
    } catch {
      // ignore
    }
  }, []);

  // Technical: show the quick-start card by default unless this browser already
  // dismissed it before.
  // Layman: new users get one inline "how do I use this?" hint without adding
  // another permanent modal or changing roadmap content.
  useEffect(() => {
    try {
      const dismissed = localStorage.getItem(QUICK_START_DISMISSED_STORAGE_KEY);
      if (dismissed === '1') {
        setShowQuickStart(false);
        return;
      }
      openQuickStartWithFreshTimer();
    } catch {
      openQuickStartWithFreshTimer();
    }
  }, [openQuickStartWithFreshTimer]);

  // Technical: restore the user's last branch scope mix.
  // Layman: if you were viewing a custom roadmap branch combination before,
  // reopen the tool and it keeps that same branch mix.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(ROADMAP_SCOPE_SELECTION_STORAGE_KEY);
      if (!saved) return;
      const parsed = JSON.parse(saved);
      if (!Array.isArray(parsed)) return;
      setRoadmapScopeSelection(
        normalizeRoadmapBranchScopeSelection(parsed.filter((value): value is RoadmapBranchScopeId => typeof value === 'string'))
      );
    } catch {
      // ignore
    }
  }, []);

  // Technical: this is a session-only countdown. It should pause entirely when
  // the panel is hidden or the user explicitly cancels the timer.
  // Layman: the help card only auto-disappears while it is visible and still
  // allowed to count down.
  const quickStartVisible = showQuickStart && !showToolbarMenu;

  useEffect(() => {
    if (!quickStartVisible || quickStartTimerCanceled) return;
    if (quickStartSecondsRemaining <= 0) {
      setShowQuickStart(false);
      return;
    }

    const timer = window.setTimeout(() => {
      setQuickStartSecondsRemaining((current) => Math.max(0, current - 1));
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [quickStartSecondsRemaining, quickStartTimerCanceled, quickStartVisible]);

  // Technical: persist auto-save preference whenever it changes.
  // Layman: update browser memory when the auto-save button is toggled.
  useEffect(() => {
    try {
      localStorage.setItem(AUTO_SAVE_LAYOUT_STORAGE_KEY, autoSaveEnabled ? '1' : '0');
    } catch {
      // ignore
    }
  }, [autoSaveEnabled]);

  // Technical: persist the current branch-selection mix so multi-product review
  // sessions survive reloads.
  // Layman: saves your chosen roadmap branch combination in this browser.
  useEffect(() => {
    try {
      localStorage.setItem(
        ROADMAP_SCOPE_SELECTION_STORAGE_KEY,
        JSON.stringify(Array.from(roadmapScopeSelection))
      );
    } catch {
      // ignore
    }
  }, [roadmapScopeSelection]);

  // Technical: observe toolbar height and push floating panels below it.
  // Layman: prevents top controls from overlapping with detail/status cards.
  useEffect(() => {
    if (loading) return;
    const controls = topControlsRef.current;
    if (!controls) return;
    const update = () => {
      const rect = controls.getBoundingClientRect();
      setTopControlsBottom(Math.round(rect.bottom));
      setViewportWidth(window.innerWidth);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(controls);
    window.addEventListener('resize', update);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', update);
    };
  }, [loading]);

  // Technical: close the compact toolbar drawer when the user clicks elsewhere
  // or presses Escape, so the menu behaves like a lightweight overlay instead of
  // becoming a sticky second panel.
  // Layman: if the menu is open, clicking away or pressing Escape closes it.
  useEffect(() => {
    if (!showToolbarMenu) return;

    const handlePointerDown = (event: PointerEvent) => {
      const controls = topControlsRef.current;
      if (!controls) return;
      if (controls.contains(event.target as Node)) return;
      setShowToolbarMenu(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setShowToolbarMenu(false);
    };

    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [showToolbarMenu]);

  // Technical: close the node context menu when the user clicks elsewhere,
  // presses Escape, or resizes the window so the stored screen position is stale.
  // Layman: right-click actions should behave like a temporary menu, not a sticky mode.
  useEffect(() => {
    if (!nodeContextMenu) return;

    const handlePointerDown = (event: PointerEvent) => {
      const menu = nodeContextMenuRef.current;
      if (menu?.contains(event.target as Node)) return;
      setNodeContextMenu(null);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setNodeContextMenu(null);
    };

    const handleViewportChange = () => setNodeContextMenu(null);

    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', handleViewportChange);
    window.addEventListener('scroll', handleViewportChange, true);

    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', handleViewportChange);
      window.removeEventListener('scroll', handleViewportChange, true);
    };
  }, [nodeContextMenu]);

  // Technical: close the compact toolbar drawer on Escape so it behaves like a
  // normal temporary overlay instead of a sticky side mode.
  // Layman: pressing Escape closes the top-left controls menu.
  useEffect(() => {
    if (!showToolbarMenu) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setShowToolbarMenu(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showToolbarMenu]);

  // Technical: the explainer popout should behave like a normal modal and close on Escape.
  // Layman: pressing Escape is the quick "close this help popout" action.
  useEffect(() => {
    if (!showNodeExplanation) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setShowNodeExplanation(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showNodeExplanation]);

  useEffect(() => {
    if (!showMediaPreview) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowMediaPreview(false); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [showMediaPreview]);

  // Technical: lock page scrolling while the node guide modal is open so the
  // roadmap canvas underneath does not keep moving independently of the guide.
  // Layman: when this help popout is open, the background page should stay put.
  useEffect(() => {
    if (!showNodeExplanation) return;
    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
    };
  }, [showNodeExplanation]);

  // Technical: persist current theme mode.
  // Layman: save dark/light choice after each switch.
  useEffect(() => {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, themeMode);
    } catch {
      // ignore
    }
  }, [themeMode]);

  // Technical: initial data bootstrap — fetches graph data, saved positions, and label
  // overrides in parallel via Promise.all, then hydrates component state in one shot.
  // An AbortController ties the fetch lifetime to this effect instance so React
  // StrictMode's unmount + remount cycle cancels the first in-flight batch instead
  // of letting both complete and double-writing state.
  //
  // Layman:
  // On first load, this grabs roadmap nodes/edges, saved positions, and custom
  // labels all at the same time (instead of one after another), then applies them.
  // If the component unmounts before they finish, the requests are cancelled cleanly.
  useEffect(() => {
    const controller = new AbortController();
    const loadData = async () => {
      try {
        const { data, layout, labelOverrides } = await loadRoadmapBootstrapData(controller.signal);
        setData(data);
        setPositionOverrides(layout);
        setNodeLabelOverrides(labelOverrides);
        setLoading(false);
      } catch (loadErr) {
        if (loadErr instanceof Error && loadErr.name === 'AbortError') return;
        console.error(loadErr);
        setError('Roadmap data not found or inaccessible.');
        setLoading(false);
      }
    };
    void loadData();
    return () => controller.abort();
  }, []);

  // Technical: loads local scanner settings (interval, stale threshold, default mode).
  // Layman: asks the roadmap API how opportunities scanning is configured right now.
  const loadOpportunitySettings = useCallback(async () => {
    try {
      const response = await fetch('/Aralia/api/roadmap/opportunities/settings');
      if (!response.ok) throw new Error(`Opportunity settings failed (${response.status})`);
      const payload = (await response.json()) as OpportunitySettings;
      setOpportunitySettings(payload);
      setOpportunityMode(payload.parentModeDefault === 'direct' ? 'direct' : 'propagated');
    } catch (settingsErr) {
      console.error(settingsErr);
      setOpportunityError('Failed to load opportunities settings.');
    }
  }, []);

  // Technical: persists edited opportunity settings from the UI form.
  // Layman: when user clicks Save Settings, send those values to the roadmap API
  // and then reload settings so the drawer reflects the server-confirmed values.
  const handleSaveOpportunitySettings = useCallback(async (updated: OpportunitySettingsContract) => {
    await fetch('/api/roadmap/opportunities/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated)
    });
    void loadOpportunitySettings();
  }, [loadOpportunitySettings]);

  // Technical: reads latest opportunities collector data (or computes it on demand server-side).
  // Layman: this fetches the current flagged-node list that powers the drawer.
  const loadOpportunities = useCallback(async () => {
    try {
      setOpportunityLoading(true);
      setOpportunityError(null);
      const payload = await loadLatestOpportunityScanPayload<OpportunityScanPayload>();
      setOpportunityData(payload);
      setOpportunityStatus(`Loaded opportunities (${payload.summary.flaggedPropagatedNodes} flagged).`);
      setTimeout(() => setOpportunityStatus((prev) => (prev?.startsWith('Loaded opportunities') ? null : prev)), 2000);
    } catch (opErr) {
      console.error(opErr);
      setOpportunityError('Failed to load opportunities.');
    } finally {
      setOpportunityLoading(false);
    }
  }, []);

  // Technical: manually/automatically triggers a fresh opportunities scan.
  // Layman: this runs the scanner now and refreshes the drawer data.
  const scanOpportunities = useCallback(async (trigger: OpportunityScanTrigger) => {
    try {
      setOpportunityLoading(true);
      setOpportunityError(null);
      setOpportunityStatus(trigger === 'manual' ? 'Scanning opportunities...' : 'Auto-scanning opportunities...');
      const payload = await runOpportunityScan<OpportunityScanPayload>(trigger);
      setOpportunityData(payload);
      setOpportunityStatus(
        `${trigger === 'manual' ? 'Scan complete' : 'Auto-scan complete'}: ${payload.summary.flaggedPropagatedNodes} flagged node(s).`
      );
      setTimeout(() => {
        setOpportunityStatus((prev) => (prev && prev.toLowerCase().includes('scan complete') ? null : prev));
      }, 2600);
    } catch (scanErr) {
      const message = scanErr instanceof Error ? scanErr.message : String(scanErr);
      setOpportunityError(`Opportunity scan failed: ${message}`);
      setOpportunityStatus(null);
    } finally {
      setOpportunityLoading(false);
    }
  }, []);

  // Technical: one-time bootstrap for opportunities settings and latest scan payload.
  // Layman: load collector configuration and first result set at startup.
  useEffect(() => {
    void loadOpportunitySettings();
    void loadOpportunities();
  }, [loadOpportunitySettings, loadOpportunities]);

  // Technical: interval auto-scan loop (manual scan still available).
  // Layman: refresh opportunities in the background every configured number of minutes.
  useEffect(() => {
    const minutes = opportunitySettings?.autoScanMinutes ?? 15;
    const intervalMs = Math.max(1, minutes) * 60 * 1000;
    const timer = window.setInterval(() => {
      void scanOpportunities('auto');
    }, intervalMs);
    return () => window.clearInterval(timer);
  }, [opportunitySettings?.autoScanMinutes, scanOpportunities]);

  // Technical: turn source roadmap + expansion state + drag overrides into draw-ready graph.
  // Layman: converts raw data into exact card/line positions that the UI can render.
  const scopedData = useMemo(() => {
    if (!data) return null;
    return filterRoadmapDataByScopeSelection(data, roadmapScopeSelection);
  }, [data, roadmapScopeSelection]);

  const graph = useMemo(() => {
    if (!scopedData) return null;
    return buildRenderGraph(scopedData, expandedNodeIds, positionOverrideMap, collapsedBranchNodeIds);
  }, [scopedData, expandedNodeIds, positionOverrideMap, collapsedBranchNodeIds]);

  // Technical: record the first moment the graph is actually ready to render, not
  // just when the fetch promise resolves. Waiting for the next animation frame gives
  // the summary card a real user-visible startup number instead of a network-only guess.
  // Layman: this measures when the roadmap is genuinely ready on screen.
  useEffect(() => {
    if (loading || !graph || initialLoadDurationMs !== null) return;
    let frameHandle = 0;
    frameHandle = window.requestAnimationFrame(() => {
      const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
      setInitialLoadDurationMs(now - loadStartTimeRef.current);
    });
    return () => window.cancelAnimationFrame(frameHandle);
  }, [graph, initialLoadDurationMs, loading]);

  // Technical: source-node lookup by id for status/test capability checks.
  // Layman: lets us quickly answer "is this underlying roadmap node testable?".
  const roadmapNodeById = useMemo(() => {
    const map = new Map<string, RoadmapData['nodes'][number]>();
    if (!scopedData) return map;
    for (const node of scopedData.nodes) map.set(node.id, node);
    return map;
  }, [scopedData]);

  // Technical: adapts visualizer render nodes into the health-signal shape expected by
  // computeHealthSignals, while reusing any available source-node test metadata.
  // Layman: turns "card data" into the warning-check format used for badge generation.
  const toHealthSignalNode = useCallback((renderNode: RenderNode): HealthSignalRoadmapNode => {
    // Resolve the primary source roadmap node that backs this rendered card.
    const detail = graph?.detailById.get(renderNode.id);
    const primarySourceNodeId = detail?.sourceNodeIds?.[0] ?? renderNode.id;
    const sourceNode = roadmapNodeById.get(primarySourceNodeId) as
      | (RoadmapData['nodes'][number] & {
          testFile?: string;
          lastTestRun?: HealthSignalRoadmapNode['lastTestRun'];
          componentFiles?: string[];
        })
      | undefined;

    // Support both the new health metadata fields and older test status/timestamp fields.
    const normalizedLastTestRun =
      sourceNode?.lastTestRun ??
      (sourceNode?.lastTestedAt
        ? {
            timestamp: sourceNode.lastTestedAt,
            status: sourceNode.testStatus ?? 'unverified'
          }
        : undefined);

    // Map visualizer node kinds onto roadmap node types expected by the shared helper.
    const mappedType: HealthSignalRoadmapNode['type'] =
      renderNode.kind === 'branch' ? 'milestone' : renderNode.kind;

    return {
      id: renderNode.id,
      label: labelForNodeId(renderNode.id, renderNode.label),
      type: mappedType,
      status: renderNode.status,
      testFile: sourceNode?.testFile ?? sourceNode?.testCommand,
      lastTestRun: normalizedLastTestRun,
      componentFiles: sourceNode?.componentFiles
    };
  }, [graph, roadmapNodeById, labelForNodeId]);

  // Technical: fully-expanded graph used for subtree test execution.
  // Layman: this gives us the complete child tree even when UI nodes are currently collapsed.
  const fullGraph = useMemo(() => {
    if (!scopedData) return null;
    // Technical: first pass discovers synthetic render-node ids (branch cards) that do not exist
    // in source node ids; second pass expands those discovered ids so descendants are materialized.
    // Layman: without this second pass, parent-node test buttons can miss child tests because the
    // hidden branch-card ids were never marked as expanded.
    const initialExpandedIds = new Set<string>(scopedData.nodes.map((node) => node.id));
    initialExpandedIds.add('aralia_chronicles');
    const discoveryGraph = buildRenderGraph(scopedData, initialExpandedIds, positionOverrideMap);
    const fullyExpandedIds = new Set<string>([
      ...initialExpandedIds,
      ...discoveryGraph.expandableIds
    ]);
    return buildRenderGraph(scopedData, fullyExpandedIds, positionOverrideMap);
  }, [scopedData, positionOverrideMap]);

  // Technical: full node lookup even when branches are collapsed in the live view.
  // Layman: lets the opportunities drawer target nodes that are currently hidden.
  const fullNodeById = useMemo(() => {
    const map = new Map<string, RenderNode>();
    if (!fullGraph) return map;
    for (const node of fullGraph.nodes) map.set(node.id, node);
    return map;
  }, [fullGraph]);

  // Technical: id-index for quick node lookup (drag, selection, branch traversal).
  // Layman: lets the UI instantly find any visible node by id.
  const nodeById = useMemo(() => {
    const map = new Map<string, RenderNode>();
    if (!graph) return map;
    for (const node of graph.nodes) map.set(node.id, node);
    return map;
  }, [graph]);

  // Technical: adjacency map of parent -> children for subtree operations.
  // Layman: this tells the app which child nodes belong under each parent.
  const childrenByParent = useMemo(() => {
    const map = new Map<string, string[]>();
    if (!graph) return map;
    for (const node of graph.nodes) {
      if (!node.parentId) continue;
      const list = map.get(node.parentId) ?? [];
      list.push(node.id);
      map.set(node.parentId, list);
    }
    return map;
  }, [graph]);

  // Technical: full adjacency map (all branches expanded) for recursive subtree test runs.
  // Layman: this allows parent-node test buttons to run all descendants even if UI is collapsed.
  const allChildrenByParent = useMemo(() => {
    const map = new Map<string, string[]>();
    if (!fullGraph) return map;
    for (const node of fullGraph.nodes) {
      if (!node.parentId) continue;
      const list = map.get(node.parentId) ?? [];
      list.push(node.id);
      map.set(node.parentId, list);
    }
    return map;
  }, [fullGraph]);

  // Technical: set of node IDs that have a media file on disk (flagged by server).
  // Layman: fast lookup for whether the "View Preview" button should appear.
  const hasMediaIds = useMemo(
    () => new Set((data?.nodes ?? []).filter(n => n.hasMedia).map(n => n.id)),
    [data]
  );

  // Technical: selected detail payload + optional crosslink filtering.
  // Layman: node panel content and whether dotted crosslinks should be hidden.
  const selectedDetail = selectedNodeId && graph ? graph.detailById.get(selectedNodeId) || null : null;
  const selectedFullDetail = selectedNodeId && fullGraph ? fullGraph.detailById.get(selectedNodeId) || null : null;
  // Technical: tree node IDs use `branch_${projectId}_${slug}` format, not the raw `sub_pillar_...`
  // IDs from data.nodes. hasMediaIds is keyed by raw IDs. We bridge via sourceNodeIds on the detail
  // (which maps back to the original milestone IDs from the API).
  // Layman: checks whether any underlying data node for the selected card has a captured preview file.
  const mediaNodeId = selectedDetail
    ? ((selectedDetail.sourceNodeIds ?? []).find(id => hasMediaIds.has(id)) ?? null)
    : null;
  const nodeHasMedia = mediaNodeId !== null;
  // Technical: panel rename/title should use the exact same short label source as node cards.
  // Layman: this keeps "Display Name" aligned with what you see on the node itself.
  const selectedRenderNode = selectedNodeId ? nodeById.get(selectedNodeId) || null : null;
  const selectedDetailTitle = resolveSelectedDetailTitle({
    selectedDetail,
    selectedRenderNode,
    labelForNodeId
  });
  // Technical: compute an override-aware path from the visible parent chain.
  // Layman: keeps the "Path" line synced after renaming this node or any parent branch.
  const selectedDetailPathLabel = useMemo(
    () =>
      buildSelectedDetailPathLabel({
        selectedDetail,
        selectedRenderNode,
        nodeById,
        labelForNodeId
      }),
    [selectedDetail, selectedRenderNode, nodeById, labelForNodeId]
  );
  const selectedHistoryPaths = useMemo(() => {
    if (!selectedFullDetail) return [] as string[];
    const pathSet = new Set<string>();
    for (const doc of selectedFullDetail.docs) {
      pathSet.add(doc.canonicalPath || doc.sourcePath);
    }
    for (const sourceNodeId of selectedFullDetail.sourceNodeIds ?? []) {
      const sourceNode = roadmapNodeById.get(sourceNodeId);
      const componentFiles = Array.isArray(sourceNode?.componentFiles) ? sourceNode.componentFiles : [];
      for (const componentFile of componentFiles) pathSet.add(componentFile);
    }
    return Array.from(pathSet);
  }, [selectedFullDetail, roadmapNodeById]);
  const selectedImmediateChildren = useMemo(() => {
    if (!selectedNodeId) return [] as RenderNode[];
    return (allChildrenByParent.get(selectedNodeId) ?? [])
      .map((nodeId) => fullNodeById.get(nodeId))
      .filter((node): node is RenderNode => Boolean(node));
  }, [selectedNodeId, allChildrenByParent, fullNodeById]);
  const hiddenSelectedImmediateChildIds = useMemo(
    () => collectHiddenImmediateBranchIds({
      collapsedBranchNodeIds,
      allChildrenByParent,
      parentId: selectedNodeId
    }),
    [allChildrenByParent, collapsedBranchNodeIds, selectedNodeId]
  );

  const visibleEdges = useMemo(
    () => (graph ? (showCrosslinks ? graph.edges : graph.edges.filter((edge) => !edge.dashed)) : []),
    [graph, showCrosslinks]
  );

  const opportunityRowsBase = useMemo(
    () => buildSortedOpportunityRows(opportunityData, opportunityMode, opportunityFilters),
    [opportunityData, opportunityMode, opportunityFilters]
  );
  const scopedNodeIds = useMemo(
    () => (data ? collectRoadmapNodeIdsForScopeSelection(data, roadmapScopeSelection) : new Set<string>()),
    [data, roadmapScopeSelection]
  );
  const scopedProjectIds = useMemo(
    () => new Set((scopedData?.nodes ?? []).filter((node) => node.type === 'project').map((node) => node.id)),
    [scopedData]
  );
  // Technical: filtered/sorted opportunities rows shown in the collector drawer.
  // Layman: this is the node list you browse when looking for flagged opportunities.
  const opportunityRows = useMemo(() => {
    if (roadmapScopeSummary.label === 'All') return opportunityRowsBase;
    return opportunityRowsBase.filter((row) => {
      if (scopedNodeIds.has(row.nodeId)) return true;
      if (row.ownerNodeIds.some((ownerNodeId) => scopedNodeIds.has(ownerNodeId))) return true;
      if (!row.projectId) return true;
      return scopedProjectIds.has(row.projectId);
    });
  }, [opportunityRowsBase, roadmapScopeSummary.label, scopedNodeIds, scopedProjectIds]);

  // Technical: live flagged-node count for current drawer mode.
  // Layman: used in toolbar badges so you can see collector volume at a glance.
  const hasActiveOpportunityFilters =
    Boolean(opportunityFilters.searchText?.trim()) ||
    opportunityFilters.severity !== 'all' ||
    opportunityFilters.type !== 'all' ||
    opportunityFilters.sortMode !== 'flag-count' ||
    roadmapScopeSummary.label !== 'All';
  const flaggedCountForMode = useMemo(() => {
    if (!opportunityData) return 0;
    if (hasActiveOpportunityFilters) return opportunityRows.length;
    return getFlaggedCountForMode(opportunityData, opportunityMode);
  }, [opportunityData, opportunityMode, opportunityRows.length, hasActiveOpportunityFilters]);

  // Technical: list all descendant render-node ids from the full graph tree.
  // Layman: returns all children/grandchildren/etc under the selected node.
  const collectAllDescendantRenderNodeIds = useCallback((rootRenderId: string) => {
    const out: string[] = [];
    const seen = new Set<string>();
    const stack = [...(allChildrenByParent.get(rootRenderId) ?? [])];
    while (stack.length > 0) {
      const current = stack.pop()!;
      if (seen.has(current)) continue;
      seen.add(current);
      out.push(current);
      const children = allChildrenByParent.get(current) ?? [];
      for (const child of children) stack.push(child);
    }
    return out;
  }, [allChildrenByParent]);

  // Technical: expands parent chain and schedules viewport centering to a target node.
  // Layman: when you click a collector row, this unfolds the branch and jumps the camera there.
  const focusNodeFromOpportunities = useCallback((nodeId: string) => {
    const target = fullNodeById.get(nodeId);
    if (!target) return;

    setExpandedNodeIds((prev) => expandTreeForOpportunityNode(nodeId, fullNodeById, prev));
    setSelectedNodeId(nodeId);
    setPendingFocusNodeId(nodeId);
  }, [fullNodeById]);

  // Technical: centers camera after target node becomes visible in the active graph.
  // Layman: this is what makes "Go to node" actually place the node in the middle of the screen.
  useEffect(() => {
    if (!pendingFocusNodeId) return;
    const node = nodeById.get(pendingFocusNodeId);
    if (!node) return;
    const viewport = viewportRef.current;
    if (!viewport) return;

    centerViewportOnOpportunityNode({
      node,
      viewportRect: viewport.getBoundingClientRect(),
      canvasScale,
      canvasPanX,
      canvasPanY
    });
    setPendingFocusNodeId(null);
  }, [pendingFocusNodeId, nodeById, canvasScale, canvasPanX, canvasPanY]);

  // Technical: gently nudge camera when click targets would otherwise sit outside viewport bounds.
  // Layman: after opening a branch, this keeps the next node on screen instead of requiring manual pan.
  useEffect(() => {
    if (!pendingContainNodeId) return;
    const node = nodeById.get(pendingContainNodeId);
    if (!node) return;
    const viewport = viewportRef.current;
    if (!viewport) return;

    ensureViewportContainsNode({
      node,
      viewportRect: viewport.getBoundingClientRect(),
      canvasScale,
      canvasPanX,
      canvasPanY
    });
    setPendingContainNodeId(null);
  }, [pendingContainNodeId, nodeById, canvasScale, canvasPanX, canvasPanY]);

  // Technical: converts render nodes into runnable source-node ids (done + has test command).
  // Layman: filters down to only nodes that currently support roadmap tests.
  const toRunnableSourceNodeIds = useCallback((renderNodeIds: string[]) => {
    const ids = new Set<string>();
    if (!fullGraph) return [] as string[];
    for (const renderNodeId of renderNodeIds) {
      const detail = fullGraph.detailById.get(renderNodeId);
      const sourceNodeIds = detail?.sourceNodeIds ?? [];
      for (const sourceNodeId of sourceNodeIds) {
        const sourceNode = roadmapNodeById.get(sourceNodeId);
        if (!sourceNode) continue;
        if (sourceNode.status !== 'done') continue;
        if (!sourceNode.testCommand) continue;
        ids.add(sourceNodeId);
      }
    }
    return Array.from(ids).sort((a, b) => a.localeCompare(b));
  }, [fullGraph, roadmapNodeById]);

  // Technical: selected node's direct runnable source-node ids.
  // Layman: these are the tests that can run when you click "Run Node Test".
  const selectedRunnableNodeIds = useMemo(() => {
    if (!selectedFullDetail) return [] as string[];
    const ids = selectedFullDetail.sourceNodeIds ?? [];
    const runnable = ids.filter((id) => {
      const node = roadmapNodeById.get(id);
      return node?.status === 'done' && Boolean(node.testCommand);
    });
    return Array.from(new Set(runnable)).sort((a, b) => a.localeCompare(b));
  }, [selectedFullDetail, roadmapNodeById]);

  // Technical: runnable source-node ids under selected node descendants (excluding self).
  // Layman: these are the tests that run when you click "Run Child Node Tests".
  const selectedChildRunnableNodeIds = useMemo(() => {
    if (!selectedNodeId) return [] as string[];
    const descendantRenderIds = collectAllDescendantRenderNodeIds(selectedNodeId);
    return toRunnableSourceNodeIds(descendantRenderIds);
  }, [selectedNodeId, collectAllDescendantRenderNodeIds, toRunnableSourceNodeIds]);

  // Technical: unified hierarchical run-set for selected node test actions.
  // Layman: "Run Node Test" now runs this node's tests plus all child-component tests.
  const selectedHierarchicalRunnableNodeIds = useMemo(() => {
    const merged = new Set<string>([
      ...selectedRunnableNodeIds,
      ...selectedChildRunnableNodeIds
    ]);
    return Array.from(merged).sort((a, b) => a.localeCompare(b));
  }, [selectedRunnableNodeIds, selectedChildRunnableNodeIds]);

  // Technical: clear stale node-test status text when selection changes.
  // Layman: each node starts with a clean test status line.
  useEffect(() => {
    setNodeTestState('idle');
    setNodeTestStatus(null);
  }, [selectedNodeId]);

  // Technical: load recent git history whenever the selected roadmap detail changes.
  // Layman: selecting a node now also asks "what changed recently around this node's files?".
  useEffect(() => {
    if (!selectedFullDetail) {
      setHistoryPayload(EMPTY_HISTORY_PAYLOAD);
      setHistoryLoading(false);
      setHistoryError(null);
      return;
    }

    if (selectedHistoryPaths.length === 0) {
      setHistoryPayload({
        ...EMPTY_HISTORY_PAYLOAD,
        generatedAt: new Date().toISOString(),
        request: {
          selectedNodeId: selectedFullDetail.id,
          selectedNodeLabel: selectedDetailTitle,
          limit: 10
        }
      });
      setHistoryLoading(false);
      setHistoryError(null);
      return;
    }

    const controller = new AbortController();
    setHistoryLoading(true);
    setHistoryError(null);
    void fetch('/Aralia/api/roadmap/history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        selectedNodeId: selectedFullDetail.id,
        selectedNodeLabel: selectedDetailTitle,
        selectedPaths: selectedHistoryPaths,
        limit: 10
      }),
      signal: controller.signal
    })
      .then(async (response) => {
        const payload = (await response.json()) as RoadmapHistoryTraceabilityPayload & { error?: string };
        if (!response.ok || payload.error) {
          throw new Error(payload.error || `History request failed (${response.status})`);
        }
        setHistoryPayload(payload);
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        setHistoryPayload(EMPTY_HISTORY_PAYLOAD);
        setHistoryError(error instanceof Error ? error.message : String(error));
      })
      .finally(() => {
        if (!controller.signal.aborted) setHistoryLoading(false);
      });

    return () => controller.abort();
  }, [selectedFullDetail, selectedHistoryPaths, selectedDetailTitle]);

  // Technical: keep rename input synced when panel selection changes.
  // Layman: selecting a different node pre-fills rename field with current displayed name.
  useEffect(() => {
    if (!selectedDetail) {
      renameSeededNodeIdRef.current = null;
      setRenameDraft('');
      setRenameState('idle');
      setRenameStatus(null);
      return;
    }

    if (renameSeededNodeIdRef.current === selectedDetail.id) return;
    renameSeededNodeIdRef.current = selectedDetail.id;
    setRenameDraft(selectedDetailTitle);
    setRenameState('idle');
    setRenameStatus(null);
  }, [selectedDetail, selectedDetailTitle]);

  const toggleNode = (nodeId: string) => {
    // Technical: toggles one node id inside expansion set.
    // Layman: fold or unfold this node's children.
    setExpandedNodeIds((prev) => toggleBranchExpansionForNode(prev, nodeId));
  };

  const toggleBranchVisibility = (nodeId: string) => {
    // Technical: switches one branch id between hidden and visible state.
    // Layman: hide one branch completely or bring it back.
    setCollapsedBranchNodeIds((prev) => toggleBranchVisibilityForNode(prev, nodeId));
  };

  // Technical: restore a chosen set of hidden branch ids from the manual-hidden set.
  // Layman: show specific hidden branches again.
  const restoreBranchVisibility = useCallback((nodeIdsToRestore: string[]) => {
    if (nodeIdsToRestore.length === 0) return;
    setCollapsedBranchNodeIds((previous) => restoreHiddenBranches({
      collapsedBranchNodeIds: previous,
      nodeIdsToRestore
    }));
  }, []);

  const collectDragBranch = (rootId: string) => {
    // Technical: drag applies to full visible subtree for root/project/branch nodes.
    // Layman: when you drag a parent, all visible children move with it.
    return collectVisibleDragBranchNodeIds(rootId, nodeById, childrenByParent);
  };

  const onNodePointerDown = (event: React.MouseEvent<HTMLButtonElement>, nodeId: string) => {
    // Technical: left mouse only; suppress default selection/scroll interactions.
    // Layman: only normal left-click drag should move nodes.
    if (event.button !== 0) return;
    if (!nodeById.has(nodeId)) return;
    event.preventDefault();
    event.stopPropagation();
    dragWasMovementRef.current = false;

    const dragIds = collectDragBranch(nodeId);
    let lastX = event.clientX;
    let lastY = event.clientY;

    const onMove = (moveEvent: MouseEvent | PointerEvent) => {
      // Technical: convert screen delta to world delta by dividing by current zoom.
      // Layman: node drag speed stays consistent even when zoomed in/out.
      const scale = Math.max(canvasScale.get(), 0.0001);
      const dx = (moveEvent.clientX - lastX) / scale;
      const dy = (moveEvent.clientY - lastY) / scale;
      if (Math.abs(dx) < 0.0001 && Math.abs(dy) < 0.0001) return;
      dragWasMovementRef.current = true;
      setPositionOverrides((prev) => {
        return applyDragDeltaToNodeOverrides({
          previous: prev,
          dragNodeIds: dragIds,
          nodeById,
          dx,
          dy
        });
      });
      lastX = moveEvent.clientX;
      lastY = moveEvent.clientY;
    };

    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('pointerup', onUp);
      if (!dragWasMovementRef.current) return;
      // Technical: snap all dragged nodes to grid on release for deterministic layouts.
      // Layman: clean "on-grid" placement makes branches readable and repeatable.
      // DEBT: freeform positioning is currently unsupported by design; if introduced later,
      // connector spacing and overlap behavior must be revalidated.
      setPositionOverrides((prev) => {
        return snapDraggedNodeOverridesToGrid(prev, dragIds);
      });
      setLayoutDirty(true);
      setLayoutSaveState('idle');
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('pointerup', onUp);
  };

  const onNodeClick = (nodeId: string, expandable: boolean) => {
    setSelectedVirtualId(null);
    setSelectedVirtualDetail(null);
    // Technical: ignore click-up after drag so node does not accidentally toggle.
    // Layman: dragging should not also count as a click.
    if (dragWasMovementRef.current) {
      dragWasMovementRef.current = false;
      return;
    }
    setNodeContextMenu(null);
    // Technical: opening a collapsed branch should surface the first actionable child in viewport.
    // Layman: when you unfold a branch, we auto-keep its child lane visible for the next click.
    let containTargetId = nodeId;
    const clickedNode = nodeById.get(nodeId);
    const isManuallyCollapsedBranch = Boolean(clickedNode?.kind === 'branch' && clickedNode.collapsed);
    if (expandable && !isManuallyCollapsedBranch) {
      const wasExpanded = Boolean(clickedNode?.expanded);
      toggleNode(nodeId);
      if (!wasExpanded) {
        const firstChildId = allChildrenByParent.get(nodeId)?.[0];
        if (firstChildId) containTargetId = firstChildId;
      }
    }
    if (infoPanelEnabled) setSelectedNodeId(nodeId);
    setPendingContainNodeId(containTargetId);
  };

  const handleVirtualNodeSelect = useCallback((id: string, detail: VirtualNodeDetail) => {
    setSelectedVirtualId(id);
    setSelectedVirtualDetail(detail);
    setSelectedNodeId(null); // clear regular node selection
  }, []);

  // Technical: store the right-click location and node identity so a context menu
  // can offer sibling-branch actions without reusing the browser's default menu.
  // Layman: remember which node was right-clicked and where the mouse was.
  const openNodeContextMenu = useCallback((
    event: React.MouseEvent<HTMLElement>,
    nodeId: string,
    parentId: string | null | undefined,
    label: string
  ) => {
    event.preventDefault();
    event.stopPropagation();
    setSelectedNodeId((current) => (infoPanelEnabled ? nodeId : current));
    setNodeContextMenu({
      nodeId,
      parentId: parentId ?? null,
      label,
      x: event.clientX,
      y: event.clientY
    });
  }, [infoPanelEnabled]);

  // Technical: one dedicated action collapses the clicked node's siblings while
  // explicitly preserving the clicked branch and its own descendant openness state.
  // Layman: close the neighboring branches, but leave the branch you picked alone.
  const collapseSiblingBranchesFromContextMenu = useCallback(() => {
    if (!nodeContextMenu) return;
    setCollapsedBranchNodeIds((previous) => collapseSiblingBranchesForNode({
      collapsedBranchNodeIds: previous,
      allChildrenByParent,
      nodeId: nodeContextMenu.nodeId,
      parentId: nodeContextMenu.parentId
    }));
    setPendingContainNodeId(nodeContextMenu.nodeId);
    if (infoPanelEnabled) setSelectedNodeId(nodeContextMenu.nodeId);
    setNodeContextMenu(null);
  }, [allChildrenByParent, infoPanelEnabled, nodeContextMenu]);
  const restoreHiddenSiblingBranchesFromContextMenu = useCallback((nodeIdsToRestore?: string[]) => {
    if (!nodeContextMenu?.parentId) return;
    const hiddenSiblingIds = collectHiddenImmediateBranchIds({
      collapsedBranchNodeIds,
      allChildrenByParent,
      parentId: nodeContextMenu.parentId,
      excludeNodeId: nodeContextMenu.nodeId
    });
    restoreBranchVisibility(nodeIdsToRestore ?? hiddenSiblingIds);
    setPendingContainNodeId(nodeContextMenu.nodeId);
    setNodeContextMenu(null);
  }, [allChildrenByParent, collapsedBranchNodeIds, nodeContextMenu, restoreBranchVisibility]);
  const restoreHiddenChildBranchesFromContextMenu = useCallback((nodeIdsToRestore?: string[]) => {
    if (!nodeContextMenu) return;
    const hiddenChildIds = collectHiddenImmediateBranchIds({
      collapsedBranchNodeIds,
      allChildrenByParent,
      parentId: nodeContextMenu.nodeId
    });
    restoreBranchVisibility(nodeIdsToRestore ?? hiddenChildIds);
    setPendingContainNodeId(nodeContextMenu.nodeId);
    setNodeContextMenu(null);
  }, [allChildrenByParent, collapsedBranchNodeIds, nodeContextMenu, restoreBranchVisibility]);

  // Technical: single write path for layout persistence (manual + auto-save).
  // Layman: every save route uses this one function, so behavior stays consistent.
  const persistLayout = useCallback(async () => {
    setLayoutSaveState('saving');
    try {
      const response = await fetch('/Aralia/api/roadmap/layout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ positions: positionOverrides })
      });
      if (!response.ok) throw new Error(`Save failed ${response.status}`);
      setLayoutDirty(false);
      setLayoutSaveState('saved');
      setTimeout(() => setLayoutSaveState((prev) => (prev === 'saved' ? 'idle' : prev)), 1500);
    } catch (saveErr) {
      console.error(saveErr);
      setLayoutSaveState('error');
    }
  }, [positionOverrides]);

  useEffect(() => {
    // Technical: debounce auto-save to batch rapid drag updates into one POST.
    // Layman: waits a moment before saving so it does not spam the server.
    if (!autoSaveEnabled) return;
    if (!layoutDirty) return;
    if (layoutSaveState === 'saving') return;
    const timer = window.setTimeout(() => {
      void persistLayout();
    }, 420);
    return () => window.clearTimeout(timer);
  }, [autoSaveEnabled, layoutDirty, layoutSaveState, persistLayout]);

  const saveLayoutNow = () => {
    // Technical: immediate manual save trigger.
    // Layman: "save now" button action.
    void persistLayout();
  };

  const resetNodePositions = () => {
    // Technical: clear all manual offsets so graph returns to computed layout.
    // Layman: put all moved nodes back to default positions.
    setPositionOverrides({});
    setLayoutDirty(true);
    setLayoutSaveState('idle');
  };

  const openInVSCode = async (docPath: string) => {
    // Technical: bridge endpoint that asks local server to open a file path in VS Code.
    // Layman: clicking this opens the selected doc directly in your editor.
    try {
      setVscodeStatus('Opening in VS Code...');
      const result = await openRelatedDocumentInVSCode(docPath);
      if (!result.ok) throw new Error(result.message);
      setVscodeStatus(result.message);
      setTimeout(() => setVscodeStatus((prev) => (prev === result.message ? null : prev)), 1500);
    } catch (vsErr) {
      console.error(vsErr);
      setVscodeStatus('VS Code open failed.');
    }
  };

  // Technical: writes one display-label override entry for the currently selected node id.
  // Layman: saves the renamed title without touching stable node identity keys.
  const saveSelectedNodeLabel = async () => {
    if (!selectedDetail) return;
    const nextLabel = renameDraft.trim();
    if (!nextLabel) {
      setRenameState('error');
      setRenameStatus('Name cannot be empty.');
      return;
    }

    setRenameState('saving');
    setRenameStatus('Saving name...');
    try {
      const response = await fetch('/Aralia/api/roadmap/labels/rename', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodeId: selectedDetail.id, label: nextLabel })
      });
      const payload = (await response.json().catch(() => ({}))) as { overrides?: unknown; error?: string };
      if (!response.ok || payload.error) {
        throw new Error(payload.error || `Rename failed (${response.status})`);
      }
      setNodeLabelOverrides(sanitizeLabelOverrides(payload.overrides));
      setRenameState('success');
      setRenameStatus('Name saved.');
      setTimeout(() => {
        setRenameStatus((prev) => (prev === 'Name saved.' ? null : prev));
        setRenameState((prev) => (prev === 'success' ? 'idle' : prev));
      }, 1600);
    } catch (renameErr) {
      const message = renameErr instanceof Error ? renameErr.message : String(renameErr);
      setRenameState('error');
      setRenameStatus(`Rename failed: ${message}`);
    }
  };

  // Technical: executes roadmap node tests through the dev-server roadmap API.
  // Layman: this sends one or many node ids to the backend and reports pass/fail summary.
  const runRoadmapNodeTests = async (nodeIds: string[], label: string) => {
    if (nodeIds.length === 0) {
      setNodeTestState('error');
      setNodeTestStatus(`${label}: no runnable done-node tests found.`);
      return;
    }

    setNodeTestState('running');
    setNodeTestStatus(`${label}: running ${nodeIds.length} test(s)...`);
    try {
      const response = await fetch('/Aralia/api/roadmap/tests/run-nodes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodeIds })
      });
      const payload = (await response.json()) as NodeTestRunResponse & { error?: string };
      if (!response.ok || payload.error) throw new Error(payload.error || `Test API failed (${response.status})`);

      const failRow = payload.results.find((row) => !row.ok);
      const summary = `${label}: ${payload.pass}/${payload.total} passed${payload.fail > 0 ? `, ${payload.fail} failed` : ''}.`;
      setNodeTestState(payload.fail > 0 ? 'error' : 'success');
      setNodeTestStatus(failRow ? `${summary} First failure: ${failRow.nodeId} (${failRow.message})` : summary);

      // Refresh roadmap data so node test badges reflect newly persisted status/timestamps.
      try {
        const refreshed = await fetch('/Aralia/api/roadmap/data');
        if (refreshed.ok) {
          const refreshedJson = (await refreshed.json()) as RoadmapData;
          setData(refreshedJson);
        }
      } catch {
        // ignore refresh failures; run result already returned.
      }
    } catch (runErr) {
      const message = runErr instanceof Error ? runErr.message : String(runErr);
      setNodeTestState('error');
      setNodeTestStatus(`${label}: failed to run tests (${message}).`);
    }
  };

  const handleWheelZoomCapture = (event: React.WheelEvent<HTMLDivElement> | WheelEvent) => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    // Technical: delegate wheel zoom behavior to dedicated module helper.
    // Layman: this central module handles panel scroll isolation + cursor-centered zoom.
    applyCursorCenteredWheelZoom({
      event,
      viewportElement: viewport,
      canvasScale,
      canvasPanX,
      canvasPanY,
      setZoomLevel
    });
  };

  // Technical: React's wheel capture path can end up passive in this browser stack,
  // which blocks preventDefault and causes mouse-wheel zoom to fall back to normal
  // page scrolling instead of controlled canvas zoom.
  // Layman: this attaches a native non-passive wheel listener so zooming with the
  // mouse wheel actually works and still centers around the cursor.
  useEffect(() => {
    if (loading) return;
    const viewport = viewportRef.current;
    if (!viewport) return;

    const handleNativeWheel = (event: WheelEvent) => {
      handleWheelZoomCapture(event);
    };

    viewport.addEventListener('wheel', handleNativeWheel, { passive: false, capture: true });
    return () => {
      viewport.removeEventListener('wheel', handleNativeWheel, true);
    };
  }, [loading, canvasPanX, canvasPanY, canvasScale, setZoomLevel]);

  // Technical: keep the visible zoom readout sourced from the motion value so
  // wheel, drag, and button-based zoom all report the same truth.
  // Layman: the zoom label now follows the real canvas zoom state directly.
  useEffect(() => {
    setZoomLevel(canvasScale.get());
    const unsubscribe = canvasScale.on('change', (value) => {
      setZoomLevel(value);
    });
    return () => unsubscribe();
  }, [canvasScale]);

  const startCanvasDrag = (event: React.MouseEvent<HTMLElement>) => {
    // Technical: delegate canvas pan drag to dedicated module helper.
    // Layman: this module controls click-drag navigation over empty canvas space.
    startCanvasPanNavigationDrag({
      event,
      canvasPanX,
      canvasPanY,
      setIsCanvasDragging
    });
  };

  // Technical: expand all currently expandable nodes from graph metadata.
  // Layman: open every foldable node in one click.
  const expandAll = () => graph && setExpandedNodeIds(expandAllBranches(graph.expandableIds));
  // Technical: empty expansion set for complete collapse.
  // Layman: close everything so only root stays visible.
  const collapseAll = () => setExpandedNodeIds(collapseAllBranches());
  const resetView = () => {
    // Technical: reset pan/zoom transforms without altering node position overrides.
    // Layman: camera reset only, not node layout reset.
    resetCanvasView({
      canvasPanX,
      canvasPanY,
      canvasScale,
      setZoomLevel
    });
  };

  if (loading) return <div className={`w-full h-screen flex items-center justify-center text-2xl animate-pulse ${isDark ? 'bg-[#050810] text-slate-300' : 'bg-slate-100 text-slate-600'}`}>Rendering roadmap...</div>;
  if (error || !graph) return <div className={`w-full h-screen flex items-center justify-center ${isDark ? 'bg-[#050810] text-red-400' : 'bg-slate-100 text-red-600'}`}>{error || 'Data Error'}</div>;

  const summaryStats = fullGraph?.stats ?? graph.stats;
  const progressTotal = summaryStats.done + summaryStats.active + summaryStats.planned;
  const progressPercent = progressTotal > 0 ? Math.round((summaryStats.done / progressTotal) * 100) : 0;
  // Technical: dynamic top offsets keep floating cards clear of toolbar and help popup.
  // Layman: prevents UI boxes from stacking on top of each other.
  const menuTop = isCompactViewport ? 88 : 72;
  const titleTop = 16;
  // Technical: use numeric widths so the menu and detail drawer can negotiate
  // the same screen lane without overlapping each other.
  // Layman: these boxes now know their real pixel widths, so opening the menu
  // can push or shrink the info panel instead of letting both stack on top.
  const menuPanelWidthPx = Math.min(340, Math.max(220, viewportWidth - 48));
  const leftPanelWidthPx = Math.min(420, Math.max(260, viewportWidth - 24));
  const rightPanelWidthPx = Math.min(430, Math.max(280, viewportWidth - 24));
  const detailPanelBaseWidthPx = Math.min(410, Math.max(300, viewportWidth - 24));
  const menuReservedLanePx = showToolbarMenu && !isCompactViewport ? menuPanelWidthPx + 20 : 0;
  const detailPanelWidthPx = showToolbarMenu && !isCompactViewport
    ? Math.max(320, Math.min(detailPanelBaseWidthPx, viewportWidth - menuReservedLanePx - 48))
    : detailPanelBaseWidthPx;
  const detailPanelLeftPx = showToolbarMenu && !isCompactViewport
    ? Math.min(24 + menuPanelWidthPx + 20, Math.max(24, viewportWidth - detailPanelWidthPx - 24))
    : 24;
  const glanceCardWidth = isCompactViewport ? 190 : 265; 
  // Technical: compact view gets a slimmer onboarding strip so the first mobile screen
  // still shows roadmap content instead of stacking multiple large overlays.
  // Layman: phones get a short help card, not a giant intro box.
  const quickStartPanelHeight = quickStartVisible ? (isCompactViewport ? 74 : 170) : 0; 
  const quickStartPanelTop = topControlsBottom + 8;
  const helpPanelTop = topControlsBottom + 8 + quickStartPanelHeight;
  const helpPanelHeight = showLayoutHelp ? 148 : 0;
  // Technical: the summary card should stay pinned in one stable top-right slot on
  // desktop, even when the left-side menu grows taller. Only compact screens should
  // let left-side overlay height influence this card's top offset.
  // Layman: opening the menu should not shove "At a Glance" downward on desktop.
  const glanceTop = isCompactViewport
    ? Math.max(24, topControlsBottom + 8 + quickStartPanelHeight + helpPanelHeight)
    : 24;
  const rightPanelVisible = showOpportunities || Boolean(selectedDetail);
  // Technical: keep the summary card in one stable top-right lane and move the
  // right-side panels below it when needed, instead of sliding the summary card
  // inward and making the whole layout feel like it jumps.
  // Layman: "At a Glance" should stay put; the info/opportunity panels should
  // respect that card instead of pushing it toward the center of the screen.
  const glancePanelHeight = 132;
  const nodeContextMenuWidth = 248;
  const nodeContextMenuMinLeft = selectedDetail
    ? Math.min(
        Math.max(12, detailPanelLeftPx + detailPanelWidthPx + 16),
        Math.max(12, viewportWidth - nodeContextMenuWidth - 12)
      )
    : 12;
  const nodeContextMenuX = nodeContextMenu
    ? Math.min(
        Math.max(nodeContextMenuMinLeft, nodeContextMenu.x),
        Math.max(nodeContextMenuMinLeft, viewportWidth - nodeContextMenuWidth - 12)
      )
    : 12;
  const nodeContextMenuY = nodeContextMenu
    ? Math.min(Math.max(12, nodeContextMenu.y), Math.max(12, (typeof window !== 'undefined' ? window.innerHeight : 900) - 160))
    : 12;
  const contextMenuSiblingCount = nodeContextMenu?.parentId
    ? Math.max(0, (allChildrenByParent.get(nodeContextMenu.parentId)?.length ?? 0) - 1)
    : 0;
  const canCollapseContextMenuSiblings = contextMenuSiblingCount > 0;
  const hiddenContextMenuSiblingIds = nodeContextMenu?.parentId
    ? collectHiddenImmediateBranchIds({
        collapsedBranchNodeIds,
        allChildrenByParent,
        parentId: nodeContextMenu.parentId,
        excludeNodeId: nodeContextMenu.nodeId
      })
    : [];
  const hiddenContextMenuChildIds = nodeContextMenu
    ? collectHiddenImmediateBranchIds({
        collapsedBranchNodeIds,
        allChildrenByParent,
        parentId: nodeContextMenu.nodeId
      })
    : [];
  const detailTop = Math.max(
    topControlsBottom + 42 + quickStartPanelHeight + helpPanelHeight,
    rightPanelVisible ? glanceTop + glancePanelHeight + 12 : 0
  );
  // Technical: the info-panel-off notice must sit below the compact menu
  // trigger even if the toolbar measurement lags behind the latest render.
  // Layman: this warning banner gets its own row so it cannot cover the menu button.
  const infoPanelNoticeTop = Math.max(topControlsBottom + 16, menuTop + 58);

  return (
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <div
      ref={viewportRef}
      role="application"
      aria-label="Interactive roadmap canvas"
      onMouseDown={(event) => {
        // Technical: only start canvas panning from true blank-space clicks.
        // Layman: clicking controls or nodes should never be mistaken for a drag-the-map action.
        if (event.target !== event.currentTarget) return;
        startCanvasDrag(event);
      }}
      className={`relative w-full h-screen overflow-hidden select-none ${isDark ? 'bg-[#050810] text-slate-100' : 'bg-slate-100 text-slate-800'} ${isCanvasDragging ? 'cursor-grabbing' : 'cursor-move'}`}
    >
      {/* Technical: static title strip centered above the canvas content. */}
      {/* Layman: main heading at the top so the screen always reads as the roadmap tool. */}
      <div className="absolute left-0 w-full text-center z-50 pointer-events-none" style={{ top: titleTop }}>
        <h1 className={`font-semibold tracking-tight ${isDark ? 'text-slate-50' : 'text-slate-800'} ${isCompactViewport ? 'text-[28px]' : 'text-4xl'}`}>Aralia Feature Roadmap</h1>
        <p className={`mt-1 uppercase ${isDark ? 'text-slate-400' : 'text-slate-500'} ${isCompactViewport ? 'text-[10px] tracking-[0.22em]' : 'text-xs tracking-[0.3em]'}`}>Interactive Feature Tree</p>
      </div>

      {/* Technical: compact top-left trigger keeps the roadmap chrome available
          without leaving a full command row permanently open. */}
      {/* Layman: click the small menu button to reveal the same roadmap controls
          in a drawer instead of keeping them spread across the top edge. */}
      <div
        ref={topControlsRef}
        data-wheel-no-zoom="true"
        className="absolute z-[70] pointer-events-auto"
        style={{ top: menuTop, left: 24, width: `${menuPanelWidthPx}px` }}
      >
        <button
          type="button"
          aria-expanded={showToolbarMenu}
          aria-label="Toggle roadmap toolbar menu"
          onClick={() => setShowToolbarMenu((prev) => !prev)}
          className={`flex items-center gap-3 rounded-xl border px-4 py-3 shadow-xl backdrop-blur-md transition-colors ${
            isDark
              ? 'bg-slate-900/86 border-cyan-500/35 text-slate-100 hover:bg-slate-800/92'
              : 'bg-white/92 border-slate-300 text-slate-700 hover:bg-white'
          }`}
        >
          <span className="text-sm font-semibold uppercase tracking-[0.18em]"> 
            {showToolbarMenu ? 'Close Menu' : 'Menu'} 
          </span> 
          <span className={`text-[10px] uppercase tracking-[0.14em] ${isDark ? 'text-cyan-300' : 'text-cyan-700'}`}> 
            Scope {roadmapScopeSummary.label} 
          </span> 
        </button> 

        {showToolbarMenu && (
          <div
            data-wheel-no-zoom="true"
            className={`mt-3 rounded-2xl border p-4 shadow-2xl backdrop-blur-md ${isDark ? 'bg-slate-900/90 border-slate-700/90 text-slate-100' : 'bg-white/96 border-slate-300 text-slate-700'}`}
          >
            {/* Technical: keep all prior toolbar actions inside the compact drawer. */}
            {/* Layman: this panel holds the same controls that used to live in the always-open top row. */}
            {showQuickStart && (
              <div className={`mb-3 rounded-xl border p-3 ${isDark ? 'border-cyan-700/60 bg-cyan-950/25' : 'border-cyan-300 bg-cyan-50/80'}`}>
                <div className={`text-[10px] uppercase tracking-[0.18em] mb-2 ${isDark ? 'text-cyan-300' : 'text-cyan-700'}`}>Quick Start Tips</div>
                <p className="text-xs leading-relaxed">
                  Drag blank canvas space to pan, use the mouse wheel or bottom zoom controls to move in and out, and click nodes for details or branch actions.
                </p>
                <div className={`mt-2 flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.12em] ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                  <span>{quickStartTimerCanceled ? 'Auto-dismiss paused' : `Auto-dismiss in ${quickStartSecondsRemaining}s`}</span>
                  {!quickStartTimerCanceled && (
                    <button
                      type="button"
                      onClick={() => setQuickStartTimerCanceled(true)}
                      className={`rounded px-2 py-1 border ${isDark ? 'border-slate-600 text-slate-200 hover:bg-slate-800' : 'border-slate-300 text-slate-700 hover:bg-slate-100'}`}
                    >
                      Cancel Timer
                    </button>
                  )}
                  <button 
                    type="button" 
                    onClick={closeQuickStartForSession} 
                    className={`rounded px-2 py-1 border ${isDark ? 'border-slate-600 text-slate-200 hover:bg-slate-800' : 'border-slate-300 text-slate-700 hover:bg-slate-100'}`} 
                  > 
                    Hide 
                  </button> 
                  <button 
                    type="button" 
                    onClick={dismissQuickStartPermanently} 
                    className={`rounded px-2 py-1 border ${isDark ? 'border-slate-600 text-slate-200 hover:bg-slate-800' : 'border-slate-300 text-slate-700 hover:bg-slate-100'}`} 
                  > 
                    Dismiss 
                  </button> 
                </div> 
              </div> 
            )} 
            {showLayoutHelp && (
              <div className={`mb-3 rounded-xl border p-3 ${isDark ? 'border-slate-700 bg-slate-950/35' : 'border-slate-300 bg-slate-50/90'}`}>
                <div className={`text-[10px] uppercase tracking-[0.18em] mb-2 ${isDark ? 'text-cyan-300' : 'text-cyan-700'}`}>Layout Save Behavior</div>
                <p className="text-xs leading-relaxed"><strong>Save Layout Now</strong> writes a one-time snapshot of node positions.</p>
                <p className="mt-1 text-xs leading-relaxed"><strong>Auto-save: On</strong> saves position changes automatically after a short delay.</p>
                <p className="mt-1 text-xs leading-relaxed">These controls save layout coordinates only. They do not save roadmap content, status, or docs.</p>
              </div>
            )}
            <div className="flex gap-2 flex-wrap">
              <button type="button" onClick={expandAll} className={`rounded-lg px-4 py-2 text-xs font-semibold border backdrop-blur-md transition-colors ${glassButtonClass(isDark)}`}>Expand All</button>
              <button type="button" onClick={collapseAll} className={`rounded-lg px-4 py-2 text-xs font-semibold border backdrop-blur-md transition-colors ${glassButtonClass(isDark)}`}>Collapse All</button>
              <div className={`flex items-center gap-1 rounded-lg border px-2 py-1 backdrop-blur-md ${isDark ? 'bg-slate-900/70 border-cyan-500/30 text-slate-100' : 'bg-white/80 border-slate-300 text-slate-700'}`}>
                <span className="px-1 text-[10px] font-semibold uppercase tracking-[0.14em]">Preset</span>
                {ROADMAP_PRODUCT_VIEWS.map((view) => (
                  <button
                    key={view.id}
                    type="button"
                    title={view.description}
                    onClick={() => applyRoadmapViewPreset(view.id)}
                    className={`rounded-md px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] transition-colors ${
                      (view.id === 'all' && roadmapScopeSummary.label === 'All') ||
                      (view.id !== 'all' && roadmapScopeSummary.label === view.label)
                        ? isDark
                          ? 'bg-cyan-900/65 text-cyan-100 border border-cyan-400/60'
                          : 'bg-cyan-50 text-cyan-700 border border-cyan-300'
                        : isDark
                          ? 'text-slate-300 hover:bg-slate-800/70'
                          : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {view.label}
                  </button>
                ))}
              </div>
              <div className={`flex items-center gap-1 rounded-lg border px-2 py-1 backdrop-blur-md ${isDark ? 'bg-slate-900/70 border-fuchsia-500/30 text-slate-100' : 'bg-white/80 border-fuchsia-300 text-slate-700'}`}>
                <span className="px-1 text-[10px] font-semibold uppercase tracking-[0.14em]">Branches</span>
                {ROADMAP_BRANCH_SCOPE_IDS.map((scopeId) => {
                  const matchingView = ROADMAP_PRODUCT_VIEWS.find((view) => view.id === scopeId)!;
                  const selected = roadmapScopeSelection.has(scopeId);
                  return (
                    <button
                      key={scopeId}
                      type="button"
                      title={`Toggle ${matchingView.label} branch visibility`}
                      onClick={() => toggleRoadmapBranchScope(scopeId)}
                      className={`rounded-md px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] transition-colors ${
                        selected
                          ? isDark
                            ? 'bg-fuchsia-900/65 text-fuchsia-100 border border-fuchsia-400/60'
                            : 'bg-fuchsia-50 text-fuchsia-700 border border-fuchsia-300'
                          : isDark
                            ? 'text-slate-300 hover:bg-slate-800/70'
                            : 'text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {matchingView.label}
                    </button>
                  );
                })}
              </div>
              <button type="button" onClick={() => setShowCrosslinks((prev) => !prev)} className={`rounded-lg px-4 py-2 text-xs font-semibold border backdrop-blur-md transition-colors ${glassButtonClass(isDark)}`}>Crosslinks: {showCrosslinks ? 'On' : 'Off'}</button>
              <button type="button" onClick={() => { setInfoPanelEnabled((prev) => !prev); setSelectedNodeId(null); }} className={`rounded-lg px-4 py-2 text-xs font-semibold border backdrop-blur-md transition-colors ${infoPanelEnabled ? (isDark ? 'bg-indigo-900/60 border-indigo-400/70 text-indigo-100 hover:bg-indigo-800/70' : 'bg-indigo-50 border-indigo-400 text-indigo-700 hover:bg-indigo-100') : glassButtonClass(isDark)}`}>Info Panel: {infoPanelEnabled ? 'On' : 'Off'}</button>
              <button
                type="button"
                onClick={() => setShowOpportunities((prev) => !prev)}
                className={`rounded-lg px-4 py-2 text-xs font-semibold border backdrop-blur-md transition-colors ${showOpportunities ? (isDark ? 'bg-cyan-900/60 border-cyan-400/70 text-cyan-100 hover:bg-cyan-800/70' : 'bg-cyan-50 border-cyan-400 text-cyan-700 hover:bg-cyan-100') : glassButtonClass(isDark)}`}
              >
                Opportunities ({flaggedCountForMode})
              </button>
              <button
                type="button"
                disabled={opportunityLoading}
                onClick={() => void scanOpportunities('manual')}
                className={`rounded-lg px-4 py-2 text-xs font-semibold border backdrop-blur-md transition-colors ${
                  opportunityLoading
                    ? isDark
                      ? 'bg-slate-800 border-slate-700 text-slate-500 cursor-not-allowed'
                      : 'bg-slate-100 border-slate-300 text-slate-400 cursor-not-allowed'
                    : glassButtonClass(isDark)
                }`}
              >
                {opportunityLoading ? 'Scanning...' : 'Scan Opportunities'}
              </button>
              <button type="button" onClick={saveLayoutNow} className={`rounded-lg px-4 py-2 text-xs font-semibold border backdrop-blur-md transition-colors ${layoutDirty ? (isDark ? 'bg-amber-900/60 border-amber-400/70 text-amber-100 hover:bg-amber-800/70' : 'bg-amber-50 border-amber-400 text-amber-700 hover:bg-amber-100') : glassButtonClass(isDark)}`}>Save Layout Now</button>
              <button type="button" onClick={() => setAutoSaveEnabled((prev) => !prev)} className={`rounded-lg px-4 py-2 text-xs font-semibold border backdrop-blur-md transition-colors ${autoSaveEnabled ? (isDark ? 'bg-emerald-900/60 border-emerald-400/70 text-emerald-100 hover:bg-emerald-800/70' : 'bg-emerald-50 border-emerald-400 text-emerald-700 hover:bg-emerald-100') : glassButtonClass(isDark)}`}>Auto-save: {autoSaveEnabled ? 'On' : 'Off'}</button>
              <button type="button" onClick={toggleQuickStartPanel} className={`rounded-lg px-4 py-2 text-xs font-semibold border backdrop-blur-md transition-colors ${showQuickStart ? (isDark ? 'bg-cyan-900/60 border-cyan-400/70 text-cyan-100 hover:bg-cyan-800/70' : 'bg-cyan-50 border-cyan-400 text-cyan-700 hover:bg-cyan-100') : glassButtonClass(isDark)}`}>Quick Start</button>
              <button
                type="button"
                onClick={() => {
                  setShowNodeExplanation(true);
                  setShowToolbarMenu(false);
                }}
                className={`rounded-lg px-4 py-2 text-xs font-semibold border backdrop-blur-md transition-colors ${glassButtonClass(isDark)}`}
              >
                Node Guide
              </button>
              <button type="button" onClick={() => setShowLayoutHelp((prev) => !prev)} className={`rounded-lg px-4 py-2 text-xs font-semibold border backdrop-blur-md transition-colors ${glassButtonClass(isDark)}`}>Layout Save Help</button>
              <button type="button" onClick={() => setThemeMode((prev) => nextThemeMode(prev))} className={`rounded-lg px-4 py-2 text-xs font-semibold border backdrop-blur-md transition-colors ${glassButtonClass(isDark)}`}>Theme: {isDark ? 'Dark' : 'Light'}</button>
            </div>
            <div className={`mt-3 text-[10px] uppercase tracking-[0.18em] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Branch {roadmapScopeSummary.label} | Layout {layoutSaveState === 'saving' ? 'saving...' : layoutSaveState === 'saved' ? 'saved' : layoutSaveState === 'error' ? 'error' : layoutDirty ? 'unsaved' : 'synced'} | Auto-save {autoSaveEnabled ? 'on' : 'off'}
            </div>
            <div className={`mt-1 text-[10px] leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
              {roadmapScopeSummary.description}
            </div>
            {(opportunityStatus || opportunityError) && (
              <div className={`mt-1 text-[10px] uppercase tracking-[0.14em] ${opportunityError ? (isDark ? 'text-rose-300' : 'text-rose-700') : isDark ? 'text-cyan-300' : 'text-cyan-700'}`}>
                {opportunityError || opportunityStatus}
              </div>
            )}
          </div>
        )}
      </div>

      {quickStartVisible && (
        <>
          {/* Technical: compact onboarding panel for first-visit roadmap discoverability. */}
          {/* Layman: tells the user how to move the canvas, inspect nodes, and find the
              opportunity drawer without forcing them into a full tutorial. */}
          <div
            data-wheel-no-zoom="true"
            className="absolute left-6 z-50 pointer-events-auto"
            style={{ top: quickStartPanelTop, width: `${leftPanelWidthPx}px` }}
          >
            <div className={`rounded-xl border px-4 py-3 shadow-xl backdrop-blur-md ${isDark ? 'bg-slate-900/88 border-cyan-700/60 text-slate-200' : 'bg-white/95 border-cyan-300 text-slate-700'}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
              <div className={`text-[10px] uppercase tracking-[0.2em] mb-2 ${isDark ? 'text-cyan-300' : 'text-blue-700'}`}>Quick Start</div>
                  <p className="text-xs leading-relaxed"> 
                    {isCompactViewport
                      ? 'Pan on blank canvas, open the menu for deeper controls, and tap nodes for branch details.'
                      : 'Drag blank canvas space to pan, use the mouse wheel or bottom zoom controls to move in and out, and click any node to open its details.'} 
                  </p> 
                  {!isCompactViewport && (
                    <>
                      <p className="text-xs leading-relaxed mt-2">
                        Use <strong>Expand All</strong> for a full tree pass, then narrow with <strong>View</strong> or jump into <strong>Opportunities</strong> when you want flagged branches first.
                      </p>
                      <p className="text-xs leading-relaxed mt-2">
                        If the detail card feels noisy during browsing, turn <strong>Info Panel</strong> off and use node clicks only for branch expansion.
                      </p>
                    </>
                  )}
                  <div className={`mt-3 flex items-center gap-2 text-[10px] uppercase tracking-[0.14em] ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                    <span>
                      {quickStartTimerCanceled ? 'Auto-dismiss paused' : `Auto-dismiss in ${quickStartSecondsRemaining}s`}
                    </span>
                    {!quickStartTimerCanceled && (
                      <button
                        type="button"
                        onClick={() => setQuickStartTimerCanceled(true)}
                        className={`rounded px-2 py-1 border ${isDark ? 'border-slate-600 text-slate-200 hover:bg-slate-800' : 'border-slate-300 text-slate-700 hover:bg-slate-100'}`}
                      >
                        Cancel Timer
                      </button>
                    )}
                  </div>
                </div>
                <div className={`flex shrink-0 items-start gap-2 ${isCompactViewport ? 'flex-col' : ''}`}> 
                  <button
                    type="button"
                    aria-label="Hide quick start for now"
                    onClick={closeQuickStartForSession}
                    className={`rounded px-2 py-1 text-[10px] uppercase tracking-[0.12em] border ${isDark ? 'border-slate-600 text-slate-300 hover:bg-slate-800' : 'border-slate-300 text-slate-600 hover:bg-slate-100'}`}
                  >
                    Hide
                  </button>
                  <button
                    type="button"
                    aria-label="Dismiss quick start"
                    onClick={dismissQuickStartPermanently}
                    className={`rounded px-2 py-1 text-[10px] uppercase tracking-[0.12em] border ${isDark ? 'border-slate-600 text-slate-300 hover:bg-slate-800' : 'border-slate-300 text-slate-600 hover:bg-slate-100'}`}
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {showLayoutHelp && (
        <>
          {/* Technical: inline explanation of manual save vs auto-save semantics. */}
          {/* Layman: clear reminder of what those save buttons actually do. */}
        <div
          data-wheel-no-zoom="true"
          className="absolute left-6 z-50 pointer-events-auto"
          style={{ top: helpPanelTop, width: `${leftPanelWidthPx}px` }}
        >
          <div className={`rounded-xl border px-4 py-3 shadow-xl backdrop-blur-md ${isDark ? 'bg-slate-900/88 border-slate-700 text-slate-200' : 'bg-white/95 border-slate-300 text-slate-700'}`}>
            <div className={`text-[10px] uppercase tracking-[0.2em] mb-2 ${isDark ? 'text-cyan-300' : 'text-blue-700'}`}>Layout Save Behavior</div>
            <p className="text-xs leading-relaxed">
              <strong>Save Layout Now</strong> writes a one-time snapshot of current node positions.
            </p>
            <p className="text-xs leading-relaxed mt-1">
              <strong>Auto-save: On</strong> saves position changes automatically shortly after you move nodes.
            </p>
            <p className="text-xs leading-relaxed mt-1">
              These controls save <strong>layout coordinates only</strong>. They do not save roadmap content, status, or docs.
            </p>
          </div>
        </div>
        </>
      )}

      {showNodeExplanation && typeof document !== 'undefined' && createPortal((
        <>
          {/* Technical: full-screen modal that explains node chrome without relying on
              the left-side info panel or a live "find the right example" scavenger hunt. */}
          {/* Layman: this popout is a visual legend for what a roadmap node can show,
              so the owner can learn the UI by looking at one annotated example. */}
          <div
            data-wheel-no-zoom="true"
            className="fixed inset-0 z-[2000] pointer-events-auto"
            style={{ zIndex: 2000 }}
          >
            <button
              type="button"
              aria-label="Close node explanation"
              onClick={() => setShowNodeExplanation(false)}
              className="absolute inset-0 h-full w-full cursor-default bg-black/88 backdrop-blur-md"
            />
            <div className="absolute inset-0 flex items-center justify-center px-4 py-6">
              <div
                role="dialog"
                aria-modal="true"
                aria-label="Roadmap node explanation"
                className={`relative flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border shadow-[0_28px_90px_rgba(0,0,0,0.72)] ${
                  isDark
                    ? 'border-slate-500 bg-slate-900 text-slate-100'
                    : 'border-slate-300 bg-white text-slate-800'
                }`}
                style={{ zIndex: 2001, boxShadow: '0 28px 90px rgba(0, 0, 0, 0.72)' }}
              >
                {/* Technical: use a dedicated header bar so the modal reads like a top-level
                    sheet instead of content painted directly onto the roadmap background. */}
                {/* Layman: this gives the guide a proper frame, a clear title area, and a
                    sticky close action that stays visible while the guide scrolls. */}
                <div
                  className={`z-20 flex items-start justify-between gap-4 border-b px-5 py-4 ${
                    isDark
                      ? 'border-slate-700 bg-slate-900'
                      : 'border-slate-200 bg-white'
                  }`}
                >
                  <div>
                    <div className={`text-[10px] uppercase tracking-[0.2em] ${isDark ? 'text-cyan-300' : 'text-cyan-700'}`}>
                      Node Guide
                    </div>
                    <div className="mt-1 text-lg font-semibold leading-tight">Roadmap node visual legend</div>
                    <div className={`mt-1 text-xs leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      Close with the button here, by clicking the dark backdrop, or by pressing Escape.
                    </div>
                  </div>
                  <button
                    type="button"
                    aria-label="Close node guide"
                    onClick={() => setShowNodeExplanation(false)}
                    className={`shrink-0 rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] ${
                      isDark
                        ? 'border-slate-500 bg-slate-800 text-slate-100 hover:bg-slate-700'
                        : 'border-slate-300 bg-slate-50 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    Close Guide
                  </button>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto">
                  <div className="grid gap-0 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
                  <div className={`border-b p-6 lg:border-b-0 lg:border-r ${isDark ? 'border-slate-700 bg-slate-900' : 'border-slate-200 bg-slate-50'}`}>
                    <h2 className="mt-2 text-2xl font-semibold leading-tight">What a roadmap node can show</h2>
                    <p className={`mt-3 max-w-2xl text-sm leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                      This popout explains the node chrome itself, not the left info panel. The sample below intentionally shows the busiest useful case so you can decode the badges, status pills, action buttons, and hierarchy hints in one place.
                    </p>

                    <div className={`mt-6 rounded-2xl border p-5 ${isDark ? 'border-slate-700 bg-slate-800' : 'border-slate-200 bg-white'}`}>
                      <div className={`text-[10px] uppercase tracking-[0.18em] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                        Sample Branch Node
                      </div>

                      <div className="mt-4 flex justify-center">
                        <div
                          className={`relative w-full max-w-[540px] rounded-xl border px-3 py-2 shadow-sm overflow-hidden ${
                            isDark
                              ? 'border-cyan-400/70 bg-slate-950 ring-1 ring-cyan-400/45'
                              : 'border-cyan-300 bg-cyan-50 ring-1 ring-cyan-300/70'
                          }`}
                          style={selectedNodeGlowStyle(isDark)}
                        >
                          <div className="mb-1 flex items-center justify-between gap-2 pr-16">
                            <div className="flex items-center gap-1.5">
                              <span className={`text-[10px] uppercase border rounded-full px-1.5 py-0.5 font-semibold ${statusChipClass('done', isDark)}`}>done</span>
                              <span className={`text-[10px] uppercase border rounded-full px-1.5 py-0.5 font-semibold ${moduleBadgeClass(isDark)}`}>module</span>
                            </div>
                          </div>
                          <div className="pr-4">
                            <div className={`text-[12px] leading-tight font-semibold break-words ${isDark ? 'text-fuchsia-100' : 'text-fuchsia-800'}`}>
                              Example Branch Node Module
                            </div>
                            <div className={`mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] leading-tight ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                              <span className={isDark ? 'text-cyan-300' : 'text-cyan-700'}>L4</span>
                            </div>
                            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <span
                                  title="Data integrity warning: duplicate node ID detected. Check label casing in generate.ts."
                                  className={`text-[9px] font-bold uppercase tracking-[0.08em] ${isDark ? 'text-amber-400' : 'text-amber-600'}`}
                                >
                                  Warn
                                </span>
                              </div>
                              <button
                                type="button"
                                aria-label="Example solo button"
                                className={`rounded-md border px-2 text-[10px] font-semibold uppercase tracking-[0.08em] ${
                                  isDark
                                    ? 'border-slate-600 bg-slate-900 text-slate-100'
                                    : 'border-slate-300 bg-white text-slate-700'
                                }`}
                              >
                                Solo
                              </button>
                            </div>
                            <div className="mt-1 pr-2">
                              <NodeHealthBadge signals={NODE_EXPLANATION_DEMO_SIGNALS} />
                            </div>
                          </div>
                          <div className={`mt-1 text-[10px] leading-tight font-mono ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                            2 children | 5 descendants
                          </div>
                        </div>
                      </div>

                      <div className={`mt-4 rounded-xl border p-3 text-xs leading-relaxed ${isDark ? 'border-slate-700 bg-slate-950 text-slate-300' : 'border-slate-200 bg-slate-50 text-slate-600'}`}>
                        Left-click still opens or closes the branch. Right-click opens the node action menu for sibling hiding and restore actions. This explainer is here so you do not have to infer those meanings from live nodes.
                      </div>
                    </div>
                  </div>

                  <div className={`p-6 lg:max-h-[90vh] lg:overflow-y-auto ${isDark ? 'bg-slate-900' : 'bg-white'}`}>
                    <div className={`text-[10px] uppercase tracking-[0.2em] ${isDark ? 'text-cyan-300' : 'text-cyan-700'}`}>
                      Meaning
                    </div>
                    <div className="mt-4 grid gap-3">
                      {[
                        ['Status pill', 'Shows whether the node is done, active, or still planned.'],
                        ['Module pill', 'Marks nodes that represent a focused implementation module rather than a broader feature branch.'],
                        ['Selected glow', 'The currently selected node gets a stronger glow around the node itself so the last-clicked branch and info-panel owner stand out immediately without extra text labels crowding the corner.'],
                        ['Warn', 'A data-integrity warning marker. Right now it is mainly used for duplicate-node-id style problems.'],
                        ['L-number', 'The hierarchy depth for the node. Higher numbers mean you are deeper inside the branch tree.'],
                        ['Health badges', 'Short warning chips such as Test, Run, Split, and Dense. Hover them to read the full reason.'],
                        ['Solo / Show All', 'Quick toggle for hiding sibling branches beside this node, then restoring them later.'],
                        ['Level counts row', 'A compact summary of how much child structure exists underneath the node.']
                      ].map(([title, body]) => (
                        <div
                          key={title}
                          className={`rounded-2xl border p-4 ${isDark ? 'border-slate-700 bg-slate-800' : 'border-slate-200 bg-slate-50'}`}
                        >
                          <div className="text-sm font-semibold">{title}</div>
                          <div className={`mt-1 text-sm leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{body}</div>
                        </div>
                      ))}
                    </div>

                    <div className={`mt-4 rounded-2xl border p-4 ${isDark ? 'border-cyan-700/70 bg-slate-800' : 'border-cyan-200 bg-cyan-50'}`}>
                      <div className="text-sm font-semibold">Scope of this popout</div>
                      <div className={`mt-1 text-sm leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                        This modal is only about the node chrome. The left info panel remains the place for node-specific docs, tests, related files, and history traceability.
                      </div>
                    </div>
                  </div>
                </div>
                </div>
              </div>
            </div>
          </div>
        </>
      ), document.body)}

      {/* Technical: aggregate stat widget from render graph metadata. */}
      {/* Layman: at-a-glance counts for done/active/planned and zoom/progress. */}
      <div
        data-wheel-no-zoom="true"
        className="absolute left-0 right-0 z-50 flex justify-end pr-6 pointer-events-none"
        style={{ top: glanceTop }}
      >
        <div
          className={`rounded-xl px-4 py-3 shadow-xl border backdrop-blur-md ${isDark ? 'bg-slate-900/72 border-slate-700/90' : 'bg-white/88 border-slate-300'}`}
          style={{ width: glanceCardWidth }}
        >
          <div className={`text-[10px] uppercase tracking-[0.2em] mb-2 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>At A Glance</div>
          <div className={`mb-2 grid gap-2 ${isCompactViewport ? 'grid-cols-1' : 'grid-cols-3'}`}>
            <div className={`rounded border px-2 py-1.5 ${isDark ? 'bg-emerald-950/40 border-emerald-800' : 'bg-emerald-50 border-emerald-200'}`}><div className={`text-[9px] uppercase ${isDark ? 'text-emerald-300' : 'text-emerald-600'}`}>Done</div><div className={`text-lg leading-none font-bold ${isDark ? 'text-emerald-200' : 'text-emerald-700'}`}>{summaryStats.done}</div></div>
            <div className={`rounded border px-2 py-1.5 ${isDark ? 'bg-amber-950/40 border-amber-800' : 'bg-amber-50 border-amber-200'}`}><div className={`text-[9px] uppercase ${isDark ? 'text-amber-300' : 'text-amber-600'}`}>Active</div><div className={`text-lg leading-none font-bold ${isDark ? 'text-amber-200' : 'text-amber-700'}`}>{summaryStats.active}</div></div>
            <div className={`rounded border px-2 py-1.5 ${isDark ? 'bg-cyan-950/40 border-cyan-700' : 'bg-cyan-50 border-cyan-200'}`}><div className={`text-[9px] uppercase ${isDark ? 'text-cyan-200' : 'text-cyan-700'}`}>Planned</div><div className={`text-lg leading-none font-bold ${isDark ? 'text-cyan-100' : 'text-cyan-700'}`}>{summaryStats.planned}</div></div>
          </div>
          <div className={`flex justify-between text-[10px] uppercase tracking-[0.12em] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}><span>Features {summaryStats.projects}</span><span>Branches {summaryStats.branches}</span></div>
          <div className={`mt-2 flex items-center justify-between gap-3 text-[10px] uppercase tracking-[0.12em] ${isDark ? 'text-cyan-300' : 'text-cyan-700'}`}>
            <span>Zoom {Math.round(zoomLevel * 100)}% | Progress {progressPercent}%</span>
            <span title="Initial roadmap load duration">Load {formatRoadmapLoadMetric(initialLoadDurationMs)}</span>
          </div>
        </div>
      </div>

      {!infoPanelEnabled && !showToolbarMenu && (
        <div
          data-wheel-no-zoom="true"
          className="absolute left-6 z-[65] pointer-events-none"
          style={{ top: infoPanelNoticeTop, width: `${Math.min(menuPanelWidthPx, 300)}px` }}
        >
          <div className={`rounded-xl border px-3 py-2 text-xs leading-relaxed shadow-lg backdrop-blur-md ${isDark ? 'border-amber-500/40 bg-amber-950/30 text-amber-100' : 'border-amber-300 bg-amber-50/95 text-amber-800'}`}>
            Detail panels are currently off. Clicking nodes now only expands/collapses branches.
          </div>
        </div>
      )}

      {nodeContextMenu && (
        <div
          ref={nodeContextMenuRef}
          data-wheel-no-zoom="true"
          className={`absolute pointer-events-auto rounded-2xl border p-3 shadow-2xl backdrop-blur-md ${
            isDark
              ? 'border-slate-700/90 bg-slate-950/95 text-slate-100'
              : 'border-slate-300 bg-white/97 text-slate-700'
          }`}
          style={{ top: nodeContextMenuY, left: nodeContextMenuX, width: `${nodeContextMenuWidth}px`, zIndex: 999 }}
        >
          <div className={`text-[10px] uppercase tracking-[0.16em] ${isDark ? 'text-cyan-300' : 'text-cyan-700'}`}>
            Node Actions
          </div>
          <div className={`mt-1 text-sm font-semibold leading-tight break-words ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>
            {nodeContextMenu.label}
          </div>
          <div className={`mt-1 text-[11px] leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
            Use this menu to reverse-expand sibling or child branches without changing the normal left-click expand behavior.
          </div>
          <div className="mt-3 flex flex-col gap-2">
            <button
              type="button"
              disabled={!canCollapseContextMenuSiblings}
              onClick={collapseSiblingBranchesFromContextMenu}
              className={`rounded-xl border px-3 py-2 text-left text-xs font-semibold transition-colors ${
                canCollapseContextMenuSiblings
                  ? isDark
                    ? 'border-cyan-500/45 bg-cyan-950/35 text-cyan-100 hover:bg-cyan-900/45'
                    : 'border-cyan-300 bg-cyan-50 text-cyan-800 hover:bg-cyan-100'
                  : isDark
                    ? 'border-slate-700 bg-slate-900 text-slate-500 cursor-not-allowed'
                    : 'border-slate-300 bg-slate-100 text-slate-400 cursor-not-allowed'
              }`}
            >
              Collapse sibling branches
            </button>
            {hiddenContextMenuSiblingIds.length > 0 && (
              <div className={`rounded-xl border p-2 ${isDark ? 'border-slate-700 bg-slate-900/55' : 'border-slate-300 bg-slate-50/90'}`}>
                <div className={`text-[10px] uppercase tracking-[0.14em] ${isDark ? 'text-emerald-300' : 'text-emerald-700'}`}>
                  Expand sibling branches
                </div>
                <div className="mt-2 flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => restoreHiddenSiblingBranchesFromContextMenu()}
                    className={`rounded-lg border px-3 py-2 text-left text-xs font-semibold transition-colors ${
                      isDark
                        ? 'border-emerald-500/40 bg-emerald-900/35 text-emerald-100 hover:bg-emerald-800/45'
                        : 'border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                    }`}
                  >
                    Show all hidden siblings
                  </button>
                  {hiddenContextMenuSiblingIds.map((hiddenNodeId) => {
                    const hiddenNode = fullNodeById.get(hiddenNodeId);
                    if (!hiddenNode) return null;
                    return (
                      <button
                        key={hiddenNodeId}
                        type="button"
                        onClick={() => restoreHiddenSiblingBranchesFromContextMenu([hiddenNodeId])}
                        className={`rounded-lg border px-3 py-2 text-left text-xs transition-colors ${
                          isDark
                            ? 'border-slate-600 bg-slate-950/70 text-slate-100 hover:bg-slate-800'
                            : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        Show {labelForNodeId(hiddenNode.id, hiddenNode.label)}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            {hiddenContextMenuChildIds.length > 0 && (
              <div className={`rounded-xl border p-2 ${isDark ? 'border-slate-700 bg-slate-900/55' : 'border-slate-300 bg-slate-50/90'}`}>
                <div className={`text-[10px] uppercase tracking-[0.14em] ${isDark ? 'text-amber-300' : 'text-amber-700'}`}>
                  Expand child branches
                </div>
                <div className="mt-2 flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => restoreHiddenChildBranchesFromContextMenu()}
                    className={`rounded-lg border px-3 py-2 text-left text-xs font-semibold transition-colors ${
                      isDark
                        ? 'border-amber-500/40 bg-amber-900/35 text-amber-100 hover:bg-amber-800/45'
                        : 'border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100'
                    }`}
                  >
                    Show all hidden children
                  </button>
                  {hiddenContextMenuChildIds.map((hiddenNodeId) => {
                    const hiddenNode = fullNodeById.get(hiddenNodeId);
                    if (!hiddenNode) return null;
                    return (
                      <button
                        key={hiddenNodeId}
                        type="button"
                        onClick={() => restoreHiddenChildBranchesFromContextMenu([hiddenNodeId])}
                        className={`rounded-lg border px-3 py-2 text-left text-xs transition-colors ${
                          isDark
                            ? 'border-slate-600 bg-slate-950/70 text-slate-100 hover:bg-slate-800'
                            : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        Show {labelForNodeId(hiddenNode.id, hiddenNode.label)}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            <button
              type="button"
              onClick={() => setNodeContextMenu(null)}
              className={`rounded-xl border px-3 py-2 text-left text-xs font-semibold transition-colors ${
                isDark
                  ? 'border-slate-600 bg-slate-900/80 text-slate-100 hover:bg-slate-800'
                  : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
              }`}
            >
              Close menu
            </button>
          </div>
        </div>
      )}

      {showOpportunities && (
        <>
          {/* Technical: dedicated opportunities collector drawer with mode toggle + scanner controls. */}
          {/* Layman: this panel lists flagged nodes and lets you jump the map camera directly to them. */}
          <motion.aside
            initial={{ x: 420, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            data-wheel-no-zoom="true"
            className={`absolute overflow-y-auto z-[60] rounded-xl p-5 shadow-2xl pointer-events-auto border select-text ${
              isDark
                ? 'bg-[#0f121cdc] border-slate-700/80 backdrop-blur-md'
                : 'bg-white/96 border-slate-300'
            }`}
            style={{ top: detailTop, right: 24, maxHeight: `calc(100vh - ${detailTop + 20}px)`, width: `${rightPanelWidthPx}px`, zIndex: 60 }}
          >
            {/* Technical: explicit width+zIndex inline â€” same reason as node info panel. */}
            <button
              type="button"
              aria-label="Close opportunities panel"
              onClick={() => setShowOpportunities(false)}
              className={`absolute top-3 right-3 w-6 h-6 flex items-center justify-center rounded text-sm font-semibold transition-colors ${isDark ? 'text-slate-400 hover:text-slate-100 hover:bg-slate-700/60' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/60'}`}
            >
              X
            </button>
            <div className="mb-4">
              <div className={`inline-flex text-[10px] uppercase font-semibold border rounded-full px-2 py-0.5 ${isDark ? 'border-cyan-500/60 bg-cyan-900/35 text-cyan-100' : 'border-cyan-300 bg-cyan-50 text-cyan-700'}`}>
                Opportunity Collector
              </div>
              <h2 className={`mt-3 text-2xl font-semibold leading-tight ${isDark ? 'text-slate-50' : 'text-slate-900'}`}>
                Strategic Opportunity Mapping
              </h2>
              <p className={`mt-1 text-[11px] uppercase tracking-[0.16em] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                {flaggedCountForMode} flagged node(s) in {opportunityMode} mode
              </p>
              <p className={`mt-2 text-xs leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                Click any flagged row to center and select that node in the roadmap.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 mb-3">
              <button
                type="button"
                onClick={() => setOpportunityMode('direct')}
                className={`text-[10px] uppercase tracking-[0.12em] px-2 py-1 rounded border ${
                  opportunityMode === 'direct'
                    ? isDark
                      ? 'border-cyan-500/70 bg-cyan-900/45 text-cyan-100'
                      : 'border-cyan-300 bg-cyan-50 text-cyan-700'
                    : isDark
                      ? 'border-slate-700 bg-slate-900/55 text-slate-300 hover:bg-slate-800/70'
                      : 'border-slate-300 bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Direct
              </button>
              <button
                type="button"
                onClick={() => setOpportunityMode('propagated')}
                className={`text-[10px] uppercase tracking-[0.12em] px-2 py-1 rounded border ${
                  opportunityMode === 'propagated'
                    ? isDark
                      ? 'border-cyan-500/70 bg-cyan-900/45 text-cyan-100'
                      : 'border-cyan-300 bg-cyan-50 text-cyan-700'
                    : isDark
                      ? 'border-slate-700 bg-slate-900/55 text-slate-300 hover:bg-slate-800/70'
                      : 'border-slate-300 bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Propagated
              </button>
            </div>

            <div className={`mb-4 rounded border p-3 ${isDark ? 'border-slate-700 bg-slate-900/45' : 'border-slate-300 bg-slate-100/75'}`}>
              <div className={`mb-2 text-[10px] uppercase tracking-[0.14em] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Collector Controls
              </div>
              <div className="grid grid-cols-1 gap-2">
                <input
                  aria-label="Opportunity search"
                  value={opportunityFilters.searchText || ''}
                  onChange={(event) =>
                    setOpportunityFilters((prev) => ({ ...prev, searchText: event.target.value }))
                  }
                  placeholder="Search labels or reasons"
                  className={`rounded border px-2 py-1 text-xs ${isDark ? 'bg-slate-950/60 border-slate-700 text-slate-100' : 'bg-white border-slate-300 text-slate-800'}`}
                />
                <div className="grid grid-cols-3 gap-2">
                  <select
                    aria-label="Opportunity severity filter"
                    value={opportunityFilters.severity || 'all'}
                    onChange={(event) =>
                      setOpportunityFilters((prev) => ({ ...prev, severity: event.target.value as OpportunityFilterState['severity'] }))
                    }
                    className={`rounded border px-2 py-1 text-xs ${isDark ? 'bg-slate-950/60 border-slate-700 text-slate-100' : 'bg-white border-slate-300 text-slate-800'}`}
                  >
                    <option value="all">All Severities</option>
                    <option value="error">Error</option>
                    <option value="warn">Warn</option>
                    <option value="info">Info</option>
                  </select>
                  <select
                    aria-label="Opportunity type filter"
                    value={opportunityFilters.type || 'all'}
                    onChange={(event) =>
                      setOpportunityFilters((prev) => ({ ...prev, type: event.target.value as OpportunityFilterState['type'] }))
                    }
                    className={`rounded border px-2 py-1 text-xs ${isDark ? 'bg-slate-950/60 border-slate-700 text-slate-100' : 'bg-white border-slate-300 text-slate-800'}`}
                  >
                    <option value="all">All Types</option>
                    {Object.entries(OPPORTUNITY_LABELS).map(([type, label]) => (
                      <option key={type} value={type}>{label}</option>
                    ))}
                  </select>
                  <select
                    aria-label="Opportunity sort mode"
                    value={opportunityFilters.sortMode || 'flag-count'}
                    onChange={(event) =>
                      setOpportunityFilters((prev) => ({ ...prev, sortMode: event.target.value as OpportunityFilterState['sortMode'] }))
                    }
                    className={`rounded border px-2 py-1 text-xs ${isDark ? 'bg-slate-950/60 border-slate-700 text-slate-100' : 'bg-white border-slate-300 text-slate-800'}`}
                  >
                    <option value="flag-count">Flag Count</option>
                    <option value="severity">Severity</option>
                    <option value="label">Label</option>
                    <option value="status">Status</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="mb-4 flex gap-2">
              <button
                type="button"
                disabled={opportunityLoading}
                onClick={() => void scanOpportunities('manual')}
                className={`text-[10px] uppercase tracking-[0.12em] px-2 py-1 rounded border ${
                  opportunityLoading
                    ? isDark
                      ? 'border-slate-700 text-slate-500 bg-slate-900/50 cursor-not-allowed'
                      : 'border-slate-300 text-slate-400 bg-slate-100 cursor-not-allowed'
                    : isDark
                      ? 'border-emerald-500/50 bg-emerald-900/35 text-emerald-100 hover:bg-emerald-800/45'
                      : 'border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                }`}
              >
                {opportunityLoading ? 'Scanning...' : 'Scan Now'}
              </button>
              <div className={`text-[10px] uppercase tracking-[0.12em] px-2 py-1 rounded border ${isDark ? 'border-slate-700 bg-slate-900/50 text-slate-300' : 'border-slate-300 bg-slate-100 text-slate-600'}`}>
                Auto {opportunitySettings?.autoScanMinutes ?? 15}m
              </div>
              <div className={`text-[10px] uppercase tracking-[0.12em] px-2 py-1 rounded border ${isDark ? 'border-slate-700 bg-slate-900/50 text-slate-300' : 'border-slate-300 bg-slate-100 text-slate-600'}`}>
                Stale {opportunitySettings?.staleDays ?? 30}d
              </div>
            </div>

            {/* Technical: inline form for editing scanner interval + stale threshold. */}
            {/* Layman: this is where users change opportunities settings and save them. */}
            {opportunitySettings && (
              <div className={`mb-4 rounded border ${isDark ? 'border-slate-700 bg-slate-900/45' : 'border-slate-300 bg-slate-100/75'}`}>
                <OpportunitySettingsForm
                  settings={opportunitySettings}
                  onSave={handleSaveOpportunitySettings}
                />
              </div>
            )}

            {opportunityData && (
              <div className={`mb-3 text-[10px] uppercase tracking-[0.12em] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Last scan {new Date(opportunityData.generatedAt).toLocaleString()}
              </div>
            )}

            {opportunityRows.length === 0 && (
              <div className={`rounded border p-3 text-xs ${isDark ? 'border-slate-700 bg-slate-900/55 text-slate-300' : 'border-slate-300 bg-slate-100 text-slate-600'}`}>
                No nodes are currently flagged in this mode.
              </div>
            )}

            {opportunityRows.length > 0 && (
              <div className="space-y-2 pr-1">
                {opportunityRows.map((row) => {
                  const modeFlags = getOpportunityFlagsForMode(row, opportunityMode);
                  const firstFlag = modeFlags[0];
                  const rowDisplayLabel = labelForNodeId(row.nodeId, row.label);
                  return (
                    <div key={row.nodeId} className={`rounded border p-3 ${isDark ? 'border-slate-700 bg-slate-900/65' : 'border-slate-300 bg-slate-100/95'}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className={`text-[11px] uppercase tracking-[0.11em] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                            {row.status} {row.nodeType}
                          </div>
                          <div className={`text-sm font-semibold leading-tight ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>
                            {rowDisplayLabel}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => focusNodeFromOpportunities(row.nodeId)}
                          className={`text-[10px] uppercase tracking-[0.12em] px-2 py-1 rounded border ${isDark ? 'border-cyan-500/40 bg-cyan-900/35 text-cyan-100 hover:bg-cyan-800/45' : 'border-cyan-300 bg-cyan-50 text-cyan-700 hover:bg-cyan-100'}`}
                        >
                          Go To Node
                        </button>
                      </div>

                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {modeFlags.map((flag, index) => (
                          <span key={`${row.nodeId}:${flag.type}:${index}`} className={`text-[10px] uppercase tracking-[0.09em] border rounded px-1.5 py-0.5 ${opportunitySeverityChipClass(flag.severity, isDark)}`}>
                            {OPPORTUNITY_LABELS[flag.type]}
                          </span>
                        ))}
                      </div>

                      {firstFlag && (
                        <p className={`mt-2 text-xs leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                          {firstFlag.reason}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </motion.aside>
        </>
      )}

      {selectedVirtualDetail && !selectedDetail && (
        <motion.aside
          initial={{ x: -420, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          data-wheel-no-zoom="true"
          className={`absolute left-6 overflow-y-auto z-[60] rounded-xl p-6 shadow-2xl pointer-events-auto border-l-4 select-text ${
            isDark
              ? 'bg-[#0f121cdc] border-l-violet-500 border border-slate-700/80 backdrop-blur-md'
              : 'bg-white/96 border-l-violet-500 border border-slate-300'
          }`}
          style={{
            top: detailTop,
            left: `${detailPanelLeftPx}px`,
            maxHeight: `calc(100vh - ${detailTop + 20}px)`,
            width: `${detailPanelWidthPx}px`,
            zIndex: 60
          }}
        >
          <button
            type="button"
            aria-label="Close virtual node info panel"
            onClick={() => { setSelectedVirtualId(null); setSelectedVirtualDetail(null); }}
            className={`absolute top-3 right-3 w-6 h-6 flex items-center justify-center rounded text-sm font-semibold transition-colors ${isDark ? 'text-slate-400 hover:text-slate-100 hover:bg-slate-700/60' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/60'}`}
            style={{ top: 12, right: 12 }}
          >
            X
          </button>
          <div className="p-4">
            <div className={`text-sm font-semibold mb-1 ${isDark ? 'text-violet-200' : 'text-violet-900'}`}>
              {selectedVirtualDetail.label}
            </div>
            <div className={`text-xs mb-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              {selectedVirtualDetail.spellCount} spell{selectedVirtualDetail.spellCount !== 1 ? 's' : ''} match
            </div>
            {selectedVirtualDetail.choices.length > 0 && (
              <div className={`text-[10px] mb-2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                {selectedVirtualDetail.choices.map((c) => `${c.axisId}: ${c.value}`).join(' › ')}
              </div>
            )}
            {selectedVirtualDetail.kind === 'show-spells' && onOpenSpellBranch && (
              <button
                type="button"
                onClick={() => onOpenSpellBranch(selectedVirtualDetail.choices)}
                className={`text-xs px-3 py-1 rounded border transition-colors ${isDark ? 'border-violet-500 text-violet-300 hover:bg-violet-900/40' : 'border-violet-400 text-violet-700 hover:bg-violet-50'}`}
              >
                Open in Spell Branch →
              </button>
            )}
            {selectedVirtualDetail.kind === 'entry' && selectedVirtualDetail.spellProfile && (
              <div className={`text-xs space-y-1 mt-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                <div><span className="opacity-60">School:</span> {selectedVirtualDetail.spellProfile.school}</div>
                <div><span className="opacity-60">Level:</span> {selectedVirtualDetail.spellProfile.level === 0 ? 'Cantrip' : selectedVirtualDetail.spellProfile.level}</div>
                <div><span className="opacity-60">Cast Time:</span> {selectedVirtualDetail.spellProfile.castingTimeUnit}</div>
                {selectedVirtualDetail.spellProfile.concentration && <div className="opacity-70">Concentration</div>}
                {selectedVirtualDetail.spellProfile.ritual && <div className="opacity-70">Ritual</div>}
              </div>
            )}
          </div>
        </motion.aside>
      )}

      {selectedDetail && (
        <>
          {/* Technical: selected-node detail drawer with docs and external actions. */}
          {/* Layman: info panel that opens when you click a node. */}
        <motion.aside
          initial={{ x: -420, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          data-wheel-no-zoom="true"
          className={`absolute left-6 overflow-y-auto z-[60] rounded-xl p-6 shadow-2xl pointer-events-auto border-l-4 select-text ${
            isDark
              ? 'bg-[#0f121cdc] border-l-amber-500 border border-slate-700/80 backdrop-blur-md'
              : 'bg-white/96 border-l-amber-500 border border-slate-300'
          }`}
          style={{
            top: detailTop,
            left: `${detailPanelLeftPx}px`,
            maxHeight: `calc(100vh - ${detailTop + 20}px)`,
            width: `${detailPanelWidthPx}px`,
            zIndex: 60
          }}
        >
          {/* Technical: explicit width+zIndex inline because Tailwind arbitrary-value classes (w-[410px], z-40)
              produce no CSS output in this build â€” inline styles are the reliable override. */}
          <button
            type="button"
            aria-label="Close info panel"
            onClick={() => setSelectedNodeId(null)}
            className={`absolute top-3 right-3 w-6 h-6 flex items-center justify-center rounded text-sm font-semibold transition-colors ${isDark ? 'text-slate-400 hover:text-slate-100 hover:bg-slate-700/60' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/60'}`}
            style={{ top: 12, right: 12 }}
          >
            X
          </button>
          <div className="mb-5">
            <div className={`inline-flex text-[10px] uppercase font-semibold border rounded-full px-2 py-0.5 ${statusChipClass(selectedDetail.status, isDark)}`}>
              {selectedDetail.status}
            </div>
            <h2 className={`mt-3 text-2xl font-semibold leading-tight ${isDark ? 'text-slate-50' : 'text-slate-900'}`}>{selectedDetailTitle}</h2>
            {selectedDetailPathLabel && (
              <p className={`mt-1 text-[10px] font-mono leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Path: {selectedDetailPathLabel}
              </p>
            )}
            <p className={`mt-1 text-[11px] uppercase tracking-[0.16em] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{selectedDetail.type}</p>
            <div className="mt-3">
              <label htmlFor="roadmap-node-rename" className={`text-[10px] uppercase tracking-[0.14em] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Display Name
              </label>
              <div className="mt-1 flex items-center gap-2">
                <input
                  id="roadmap-node-rename"
                  value={renameDraft}
                  onChange={(event) => setRenameDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      void saveSelectedNodeLabel();
                    }
                  }}
                  className={`flex-1 rounded border px-2 py-1 text-xs ${isDark ? 'bg-slate-900/70 border-slate-700 text-slate-100' : 'bg-white border-slate-300 text-slate-800'}`}
                  placeholder="Rename selected node"
                />
                <button
                  type="button"
                  disabled={renameState === 'saving'}
                  onClick={() => void saveSelectedNodeLabel()}
                  className={`text-[10px] uppercase tracking-[0.12em] px-2 py-1 rounded border ${renameState === 'saving' ? (isDark ? 'border-slate-700 text-slate-500 bg-slate-900/50 cursor-not-allowed' : 'border-slate-300 text-slate-400 bg-slate-100 cursor-not-allowed') : (isDark ? 'border-indigo-500/40 bg-indigo-900/35 text-indigo-100 hover:bg-indigo-800/45' : 'border-indigo-300 bg-indigo-50 text-indigo-700 hover:bg-indigo-100')}`}
                >
                  {renameState === 'saving' ? 'Saving...' : 'Save Name'}
                </button>
              </div>
              <p className={`mt-1 text-[10px] leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Name overrides are display-only and keep node identity keys stable.
              </p>
              {renameStatus && (
                <p className={`mt-1 text-[10px] leading-relaxed ${renameState === 'error' ? (isDark ? 'text-rose-300' : 'text-rose-700') : isDark ? 'text-emerald-300' : 'text-emerald-700'}`}>
                  {renameStatus}
                </p>
              )}
            </div>
            <button
              type="button"
              disabled={selectedDetail.docs.length === 0}
              onClick={() => {
                const firstDoc = selectedDetail.docs[0];
                if (firstDoc) openInVSCode(firstDoc.canonicalPath || firstDoc.sourcePath);
              }}
              className={`mt-3 text-[10px] uppercase tracking-[0.12em] px-2 py-1 rounded border ${
                selectedDetail.docs.length === 0
                  ? isDark
                    ? 'border-slate-700 text-slate-500 bg-slate-900/50 cursor-not-allowed'
                    : 'border-slate-300 text-slate-400 bg-slate-100 cursor-not-allowed'
                  : isDark
                    ? 'border-cyan-500/40 bg-cyan-900/40 text-cyan-100 hover:bg-cyan-800/50'
                    : 'border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100'
              }`}
            >
              Open in VS Code
            </button>
            {nodeHasMedia && (
              <button
                type="button"
                onClick={() => setShowMediaPreview(true)}
                className={`mt-2 text-[10px] uppercase tracking-[0.12em] px-2 py-1 rounded border ${
                  isDark
                    ? 'border-violet-500/40 bg-violet-900/35 text-violet-100 hover:bg-violet-800/45'
                    : 'border-violet-300 bg-violet-50 text-violet-700 hover:bg-violet-100'
                }`}
              >
                View Preview
              </button>
            )}

            <div className="mt-3 grid grid-cols-1 gap-2">
              <button
                type="button"
                disabled={nodeTestState === 'running' || selectedHierarchicalRunnableNodeIds.length === 0}
                onClick={() => void runRoadmapNodeTests(selectedHierarchicalRunnableNodeIds, 'Node Test')}
                className={`text-[10px] uppercase tracking-[0.12em] px-2 py-1 rounded border ${
                  nodeTestState === 'running' || selectedHierarchicalRunnableNodeIds.length === 0
                    ? isDark
                      ? 'border-slate-700 text-slate-500 bg-slate-900/50 cursor-not-allowed'
                      : 'border-slate-300 text-slate-400 bg-slate-100 cursor-not-allowed'
                    : isDark
                      ? 'border-emerald-500/40 bg-emerald-900/35 text-emerald-100 hover:bg-emerald-800/45'
                      : 'border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                }`}
              >
                Run Node Test ({selectedHierarchicalRunnableNodeIds.length})
              </button>
              <button
                type="button"
                disabled={nodeTestState === 'running' || selectedChildRunnableNodeIds.length === 0}
                onClick={() => void runRoadmapNodeTests(selectedChildRunnableNodeIds, 'Child Node Tests')}
                className={`text-[10px] uppercase tracking-[0.12em] px-2 py-1 rounded border ${
                  nodeTestState === 'running' || selectedChildRunnableNodeIds.length === 0
                    ? isDark
                      ? 'border-slate-700 text-slate-500 bg-slate-900/50 cursor-not-allowed'
                      : 'border-slate-300 text-slate-400 bg-slate-100 cursor-not-allowed'
                    : isDark
                      ? 'border-cyan-500/40 bg-cyan-900/35 text-cyan-100 hover:bg-cyan-800/45'
                      : 'border-cyan-300 bg-cyan-50 text-cyan-700 hover:bg-cyan-100'
                }`}
              >
                Run Child Node Tests ({selectedChildRunnableNodeIds.length})
              </button>
            </div>
            {nodeTestStatus && (
              <p className={`mt-2 text-[10px] leading-relaxed ${nodeTestState === 'error' ? 'text-red-400' : isDark ? 'text-emerald-300' : 'text-emerald-700'}`}>
                {nodeTestStatus}
              </p>
            )}
          </div>

          {selectedDetail.description && (
            <p className={`text-sm leading-relaxed mb-5 pb-5 border-b ${isDark ? 'text-slate-300 border-slate-700' : 'text-slate-600 border-slate-300'}`}>{selectedDetail.description}</p>
          )}

          {(selectedImmediateChildren.length > 0 || hiddenSelectedImmediateChildIds.length > 0) && (
            <section className={`mb-5 pb-5 border-b ${isDark ? 'border-slate-700/50' : 'border-slate-300'}`}>
              <div className="flex items-center justify-between gap-2">
                <h3 className={`text-xs uppercase tracking-[0.16em] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  Child Branch Visibility
                </h3>
                <span className={`text-[10px] uppercase tracking-[0.12em] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                  {(allChildrenByParent.get(selectedNodeId ?? '')?.length ?? 0)} child node(s)
                </span>
              </div>
              <p className={`mt-2 text-xs leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                Hide immediate child branches completely or restore them one by one from this panel.
              </p>
              <div className="mt-3 space-y-2">
                {selectedImmediateChildren.map((childNode) => {
                  const isCollapsedChild = collapsedBranchNodeIds.has(childNode.id);
                  return (
                    <div
                      key={childNode.id}
                      className={`flex items-center justify-between gap-3 rounded border px-3 py-2 ${
                        isDark ? 'border-slate-700 bg-slate-900/55' : 'border-slate-300 bg-slate-100/80'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className={`text-[10px] uppercase tracking-[0.12em] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                          {childNode.status} {typeof childNode.depth === 'number' ? `| L${childNode.depth}` : ''}
                        </div>
                        <div className={`mt-1 text-xs font-semibold leading-relaxed break-words ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>
                          {labelForNodeId(childNode.id, childNode.label)}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleBranchVisibility(childNode.id)}
                        className={`shrink-0 rounded border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${
                          isCollapsedChild
                            ? isDark
                              ? 'border-emerald-500/40 bg-emerald-900/35 text-emerald-100 hover:bg-emerald-800/45'
                              : 'border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                            : isDark
                              ? 'border-slate-600 bg-slate-950/70 text-slate-100 hover:bg-slate-800'
                              : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        {isCollapsedChild ? 'Show' : 'Hide'}
                      </button>
                    </div>
                  );
                })}
                {hiddenSelectedImmediateChildIds
                  .filter((hiddenNodeId) => !selectedImmediateChildren.some((childNode) => childNode.id === hiddenNodeId))
                  .map((hiddenNodeId) => {
                    const hiddenNode = fullNodeById.get(hiddenNodeId);
                    if (!hiddenNode) return null;
                    return (
                      <div
                        key={hiddenNode.id}
                        className={`flex items-center justify-between gap-3 rounded border px-3 py-2 ${
                          isDark ? 'border-slate-700 bg-slate-900/35' : 'border-slate-300 bg-slate-100/55'
                        }`}
                      >
                        <div className="min-w-0">
                          <div className={`text-[10px] uppercase tracking-[0.12em] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                            hidden {typeof hiddenNode.depth === 'number' ? `| L${hiddenNode.depth}` : ''}
                          </div>
                          <div className={`mt-1 text-xs font-semibold leading-relaxed break-words ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                            {labelForNodeId(hiddenNode.id, hiddenNode.label)}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => restoreBranchVisibility([hiddenNode.id])}
                          className={`shrink-0 rounded border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${
                            isDark
                              ? 'border-emerald-500/40 bg-emerald-900/35 text-emerald-100 hover:bg-emerald-800/45'
                              : 'border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                          }`}
                        >
                          Show
                        </button>
                      </div>
                    );
                  })}
              </div>
            </section>
          )}

          <section className="mb-5 pb-5 border-b border-slate-700/50">
            <div className="flex items-center justify-between gap-2">
              <h3 className={`text-xs uppercase tracking-[0.16em] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                History Traceability
              </h3>
              {historyLoading && (
                <span className={`text-[10px] uppercase tracking-[0.12em] ${isDark ? 'text-cyan-300' : 'text-cyan-700'}`}>
                  Loading...
                </span>
              )}
            </div>
            {historyError && (
              <p className={`mt-2 text-xs leading-relaxed ${isDark ? 'text-rose-300' : 'text-rose-700'}`}>
                {historyError}
              </p>
            )}
            {!historyError && historyPayload.status === 'empty' && (
              <p className={`mt-2 text-xs leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                {selectedHistoryPaths.length === 0
                  ? 'This node does not currently expose doc or component file anchors for history tracing.'
                  : historyPayload.note || 'No recent git history was found for this node.'}
              </p>
            )}
            {!historyError && historyPayload.status !== 'empty' && (
              <>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <span className={`text-[10px] px-2 py-0.5 rounded border ${isDark ? 'border-cyan-500/40 bg-cyan-950/40 text-cyan-100' : 'border-cyan-300 bg-cyan-50 text-cyan-700'}`}>
                    {historyPayload.summary.commitCount} recent commit(s)
                  </span>
                  <span className={`text-[10px] px-2 py-0.5 rounded border ${isDark ? 'border-slate-700 bg-slate-900/55 text-slate-300' : 'border-slate-300 bg-slate-100 text-slate-600'}`}>
                    {historyPayload.summary.uniquePathCount} file(s)
                  </span>
                </div>
                {historyPayload.pathSummaries.length > 0 && (
                  <div className="mt-3 space-y-1">
                    {historyPayload.pathSummaries.slice(0, 3).map((summary) => (
                      <div key={summary.path} className={`text-xs leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                        <span className={`font-mono ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>{summary.path}</span>
                        <span className="ml-2 opacity-75">{summary.commitCount} commit(s)</span>
                      </div>
                    ))}
                  </div>
                )}
                {historyPayload.commits.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {historyPayload.commits.slice(0, 4).map((commit) => (
                      <div key={commit.hash} className={`rounded border p-2 ${isDark ? 'border-slate-700 bg-slate-900/55' : 'border-slate-300 bg-slate-100/80'}`}>
                        <div className={`text-[10px] uppercase tracking-[0.12em] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                          {commit.shortHash} | {commit.authorName} | {new Date(commit.authoredAt).toLocaleString()}
                        </div>
                        <div className={`mt-1 text-xs font-semibold leading-relaxed ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>
                          {commit.subject}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </section>

          {selectedDetail.relatedFeatures.length > 0 && (
            <section className="mb-5">
              <h3 className={`text-xs uppercase tracking-[0.16em] mb-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Related Features</h3>
              <div className="flex flex-wrap gap-1.5">
                {selectedDetail.relatedFeatures.map((feature) => (
                  <span key={feature} className={`text-[10px] px-2 py-0.5 rounded border ${isDark ? 'border-cyan-500/35 bg-cyan-950/50 text-cyan-200' : 'border-cyan-300 bg-cyan-50 text-cyan-700'}`}>
                    {feature}
                  </span>
                ))}
              </div>
            </section>
          )}

          {selectedDetail.docs.length > 0 && (
            <section className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className={`text-xs uppercase tracking-[0.16em] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Related Docs</h3>
                <button
                  type="button"
                  onClick={() => openInVSCode(selectedDetail.docs[0].canonicalPath || selectedDetail.docs[0].sourcePath)}
                  className={`text-[10px] uppercase tracking-[0.12em] px-2 py-1 rounded border ${isDark ? 'border-cyan-500/40 bg-cyan-900/40 text-cyan-100 hover:bg-cyan-800/50' : 'border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100'}`}
                >
                  Open in VS Code
                </button>
              </div>
              <div className="space-y-2 max-h-[240px] overflow-auto pr-1">
                {selectedDetail.docs.map((doc) => {
                  // Technical: derive doc-type chip data from canonical/source path.
                  // Layman: each list item gets a visible file-type label (MD/TS/JSON/etc.).
                  const effectivePath = doc.canonicalPath || doc.sourcePath;
                  const docType = describeRelatedDocType(effectivePath);
                  return (
                  <div key={doc.sourcePath} className={`w-full rounded border p-2 ${isDark ? 'border-slate-700 bg-slate-900/70' : 'border-slate-200 bg-slate-100'}`}>
                    <div className="mb-1 flex items-center gap-2">
                      <span className={`inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.08em] border rounded px-1.5 py-0.5 font-semibold ${relatedDocTypeBadgeClass(docType.kind, isDark)}`}>
                        <span className="font-bold">{docType.symbol}</span>
                        <span>{docType.label}</span>
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => window.open(doc.href, '_blank')}
                      className={`w-full text-left text-[11px] font-mono break-all ${isDark ? 'text-slate-100 hover:text-cyan-200' : 'text-slate-700 hover:text-blue-700'}`}
                    >
                      {doc.sourcePath}
                    </button>
                    <div className="mt-2 flex justify-end">
                      <button
                        type="button"
                        onClick={() => openInVSCode(doc.canonicalPath || doc.sourcePath)}
                        className={`text-[10px] uppercase tracking-[0.12em] px-2 py-1 rounded border ${isDark ? 'border-cyan-500/40 bg-cyan-900/40 text-cyan-100 hover:bg-cyan-800/50' : 'border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100'}`}
                      >
                        Open in VS Code
                      </button>
                    </div>
                  </div>
                  );
                })}
              </div>
              {vscodeStatus && <div className={`mt-2 text-[10px] uppercase tracking-[0.12em] ${isDark ? 'text-cyan-300' : 'text-blue-700'}`}>{vscodeStatus}</div>}
            </section>
          )}

          {selectedDetail.link && (
            <button
              type="button"
              onClick={() => window.open(`/Aralia/${selectedDetail.link}`, '_blank')}
              className={`w-full mt-2 py-2.5 rounded-lg text-sm font-semibold border transition-colors ${
                isDark
                  ? 'bg-cyan-600/85 hover:bg-cyan-500 border-cyan-400/60 text-slate-900'
                  : 'bg-blue-600 hover:bg-blue-500 border-blue-500 text-white'
              }`}
            >
              Open Specification
            </button>
          )}
        </motion.aside>
        </>
      )}

      {/* Technical: world-space transform wrapper for grid, edges, and nodes. */}
      {/* Layman: everything in the map moves together when you pan/zoom. */}
      <motion.div
        style={{ x: canvasPanX, y: canvasPanY, scale: canvasScale, transformOrigin: '0 0' }}
        className="absolute inset-0 origin-top-left z-10 pointer-events-none"
      >
        {/* Technical: infinite-feel grid background anchored to world coordinates. */}
        {/* Layman: graph-paper background that stays aligned with node snapping. */}
        <div
          className="absolute pointer-events-none"
          style={{
            left: CANVAS_MIN,
            top: CANVAS_MIN,
            width: CANVAS_SIZE,
            height: CANVAS_SIZE,
            backgroundImage: isDark
              ? 'linear-gradient(to right, rgba(29,78,216,0.36) 1px, transparent 1px), linear-gradient(to bottom, rgba(29,78,216,0.36) 1px, transparent 1px)'
              : 'linear-gradient(to right, rgba(148,163,184,0.2) 1px, transparent 1px), linear-gradient(to bottom, rgba(148,163,184,0.2) 1px, transparent 1px)',
            backgroundSize: `${GRID_SIZE}px ${GRID_SIZE}px`
          }}
        />

        {/* Technical: connector rendering layer; uses glow filters and optional dashed crosslinks. */}
        {/* Layman: draws relationship lines between node cards. */}
        <svg
          className="absolute pointer-events-none"
          style={{
            left: CANVAS_MIN,
            top: CANVAS_MIN,
            width: CANVAS_SIZE,
            height: CANVAS_SIZE,
            overflow: 'visible'
          }}
        >
          <defs>
            <filter id="roadmap-edge-glow-cyan" x="-80%" y="-80%" width="260%" height="260%">
              <feGaussianBlur stdDeviation="2.2" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id="roadmap-edge-glow-blue" x="-80%" y="-80%" width="260%" height="260%">
              <feGaussianBlur stdDeviation="1.8" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <g transform={`translate(${CANVAS_OFFSET} ${CANVAS_OFFSET})`}>
            {visibleEdges.map((edge) => {
              // Technical: near-flat links can intermittently disappear when glow filters
              // are applied on a near-zero-height path bbox in some browsers.
              // Layman: almost-horizontal lines sometimes blink out with glow enabled, so
              // for those specific lines we disable glow and slightly boost visibility.
              const edgeFilterId = edge.flat ? undefined : edge.width > 2.2 ? 'roadmap-edge-glow-cyan' : 'roadmap-edge-glow-blue';
              const strokeWidth = edge.flat ? Math.max(edge.width, 2.05) : edge.width;
              const opacity = edge.dashed ? 0.55 : edge.flat ? 0.88 : 0.74;

              return (
                <path
                  key={edge.id}
                  d={edge.path}
                  fill="none"
                  stroke={isDark ? (edge.dashed ? '#94a3b8' : edge.width > 2.2 ? '#22d3ee' : '#3b82f6') : edge.color}
                  strokeWidth={strokeWidth}
                  strokeDasharray={edge.dashed ? '5 7' : undefined}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  filter={edgeFilterId ? `url(#${edgeFilterId})` : undefined}
                  opacity={opacity}
                />
              );
            })}
          </g>
        </svg>

        {graph.nodes.map((node) => {
          // Compare this node against siblings at the same parent level to detect density
          // and compute the full health-signal badge set for this card.
          const siblings = graph.nodes.filter((n) => n.parentId === node.parentId && n.id !== node.id);
          const healthSignals = computeHealthSignals(
            toHealthSignalNode(node),
            siblings.map((sibling) => toHealthSignalNode(sibling)),
            {
              // Branch and project cards summarize child work. Only leaf-like cards should
              // show "missing test" or "not run" warnings, otherwise the whole roadmap
              // looks broken even when the underlying leaf coverage is healthy.
              suppressTestSignals: Boolean(node.hasChildren)
            }
          );

          // Technical: root node has dedicated circular treatment and larger visual weight.
          // Layman: the top-most roadmap node uses a big center style.
          if (node.kind === 'root') {
            // Technical: true when this node's info panel is the one currently open.
            // Layman: glows brighter when its info panel is open.
            const isSelected = infoPanelEnabled && selectedNodeId === node.id;
            const displayLabel = labelForNodeId(node.id, node.label);
            return (
              <motion.button
                key={node.id}
                type="button"
                data-node-id={node.id}
                data-node-kind={node.kind}
                style={{ left: node.x, top: node.y, width: node.width, height: node.height, position: 'absolute' }}
                onMouseDown={(event) => onNodePointerDown(event, node.id)}
                onContextMenu={(event) => openNodeContextMenu(event, node.id, node.parentId, displayLabel)}
                onClick={() => onNodeClick(node.id, Boolean(node.hasChildren))}
                className={`rounded-full border-2 text-white shadow-xl flex items-center justify-center text-center px-4 pointer-events-auto transition-colors ${
                  isSelected
                    ? isDark
                      ? 'border-cyan-300 bg-blue-500 ring-2 ring-cyan-400/60 ring-offset-1 ring-offset-[#090e1a]'
                      : 'border-indigo-500 bg-blue-600 ring-2 ring-indigo-400/60 ring-offset-1 ring-offset-white'
                    : isDark
                      ? 'border-cyan-300/80 bg-blue-600 hover:bg-blue-500'
                      : 'border-blue-500 bg-blue-500 hover:bg-blue-600'
                }`}
              >
                <span className="flex items-center justify-center gap-1">
                  <span className="text-sm font-semibold leading-tight">{displayLabel}</span>
                  <NodeHealthBadge signals={healthSignals} />
                </span>
              </motion.button>
            );
          }

          // Technical: project nodes are the major feature pillars shown as larger
          // rounded cards so they visually relate to branch cards while still
          // reading as a more important hierarchy layer.
          // Layman: big feature category nodes now use the same general card shape
          // as child nodes, just larger and more prominent.
          if (node.kind === 'project') {
            const isExpanded = Boolean(node.expanded);
            const levelCountText = formatLevelCounts(node.descendantLevelCounts ?? []);
            // Technical: true when this node's info panel is the one currently open.
            // Layman: glows with a selection ring when its info panel is open.
            const isSelected = infoPanelEnabled && selectedNodeId === node.id;
            const displayLabel = labelForNodeId(node.id, node.label);
            return (
              <motion.button
                key={node.id}
                type="button"
                data-node-id={node.id}
                data-node-kind={node.kind}
                style={{
                  left: node.x,
                  top: node.y,
                  width: node.width,
                  height: node.height,
                  position: 'absolute',
                  ...(isSelected ? selectedNodeGlowStyle(isDark) : {})
                }}
                onMouseDown={(event) => onNodePointerDown(event, node.id)}
                onContextMenu={(event) => openNodeContextMenu(event, node.id, node.parentId, displayLabel)}
                onClick={() => onNodeClick(node.id, Boolean(node.hasChildren))}
                className={`relative rounded-2xl border-2 pointer-events-auto shadow-lg text-white px-4 py-3 text-left transition-colors overflow-hidden ${
                  isSelected
                    ? isDark
                      ? 'bg-blue-950/78 border-cyan-300 ring-2 ring-cyan-400/60 ring-offset-1 ring-offset-[#090e1a] backdrop-blur-md'
                      : 'bg-blue-600 border-indigo-500 ring-2 ring-indigo-400/60 ring-offset-1 ring-offset-white'
                    : isDark
                      ? isExpanded
                        ? 'bg-blue-950/74 border-cyan-300/80 backdrop-blur-md'
                        : 'bg-blue-900/68 border-blue-300/70 hover:bg-blue-900/80 backdrop-blur-md'
                      : isExpanded
                        ? 'bg-blue-600 border-blue-500'
                        : 'bg-blue-500 border-blue-400 hover:bg-blue-600'
                }`}
              >
                <div className="pr-8 text-[10px] uppercase tracking-[0.14em] opacity-90">Feature</div>
                <div className="mt-1 pr-8">
                  <div className="text-[14px] font-semibold leading-tight">{displayLabel}</div>
                  {levelCountText && <div className="mt-1 text-[9px] leading-tight opacity-90">{levelCountText}</div>}
                </div>
                {healthSignals.length > 0 && (
                  <div className="mt-2 pr-4">
                    <NodeHealthBadge signals={healthSignals} />
                  </div>
                )}
              </motion.button>
            );
          }

          // Technical: branch nodes are rectangular cards for feature/subfeature hierarchy.
          // Layman: the normal cards that represent detailed roadmap items.
          const isExpandable = Boolean(node.hasChildren);
          const isExpanded = Boolean(node.expanded);
          const levelCountText = formatLevelCounts(node.descendantLevelCounts ?? []);
          const hasWarning = Boolean(node.warning);
          const displayLabel = labelForNodeId(node.id, node.label);
          const layerTone = getBranchLayerTone(node.depth, isDark);
          const isModuleNode = isModuleNodeLabel(node.label);
          // Technical: true when this node's info panel is the one currently open.
          // Layman: highlights with a colored border + dot when its info panel is open.
          const isSelected = infoPanelEnabled && selectedNodeId === node.id;
          // Technical: the small corner action is now a true "solo this branch"
          // affordance, and it stays visible once siblings have been hidden so the
          // user can understand why this branch is currently alone.
          // Layman: show the corner action on mobile, on selected cards, or when
          // this branch already has hidden siblings around it.
          const hiddenSiblingIdsForNode = collectHiddenImmediateBranchIds({
            collapsedBranchNodeIds,
            allChildrenByParent,
            parentId: node.parentId,
            excludeNodeId: node.id
          });
          const siblingBranchesHidden = hiddenSiblingIdsForNode.length > 0;
          const shouldRevealBranchVisibilityButton = isCompactViewport || isSelected || hiddenSiblingIdsForNode.length > 0;

          return (
            <motion.div
              key={node.id}
              id={node.id}
              data-node-id={node.id}
              data-node-kind={node.kind}
              data-parent-id={node.parentId || ''}
              data-project-id={node.projectId || ''}
              style={{
                left: node.x,
                top: node.y,
                width: node.width,
                height: node.height,
                position: 'absolute'
              }}
              className="pointer-events-auto group"
            >
              <button
                type="button"
                onMouseDown={(event) => onNodePointerDown(event, node.id)}
                onContextMenu={(event) => openNodeContextMenu(event, node.id, node.parentId, displayLabel)}
                onClick={() => onNodeClick(node.id, isExpandable)}
                style={isSelected ? selectedNodeGlowStyle(isDark) : undefined}
                className={`relative h-full w-full rounded-xl border text-left px-3 py-2 shadow-sm transition-colors overflow-hidden ${
                isSelected
                  ? isDark
                    ? `${layerTone.border} bg-[#0d1f3ccc] hover:bg-[#142440d8] backdrop-blur-md ring-1 ring-cyan-400/30`
                    : `${layerTone.border} bg-indigo-50/60 hover:bg-indigo-50`
                  : hasWarning
                    ? isDark
                      ? 'border-amber-500/70 bg-[#111a2bcc] hover:bg-[#1a2740d8] backdrop-blur-md'
                      : 'border-amber-400 bg-white hover:bg-slate-50'
                    : isDark
                      ? `${layerTone.border} ${layerTone.background} ${layerTone.hover} backdrop-blur-md`
                      : `${layerTone.border} ${layerTone.background} ${layerTone.hover}`
              } ${isModuleNode ? (isDark ? 'border-dashed ring-1 ring-fuchsia-400/30' : 'border-dashed ring-1 ring-fuchsia-300/80') : ''}`}
            >
              <div className="mb-1 flex items-center justify-between gap-2 pr-16">
                <div className="flex items-center gap-1.5">
                  <span className={`text-[10px] uppercase border rounded-full px-1.5 py-0.5 font-semibold ${statusChipClass(node.status, isDark)}`}>{node.status}</span>
                  {isModuleNode && (
                    <span className={`text-[10px] uppercase border rounded-full px-1.5 py-0.5 font-semibold ${moduleBadgeClass(isDark)}`}>
                      module
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 pr-8">
                  {hasWarning && (
                    <span
                      title="Data integrity warning: duplicate node ID detected. Check label casing in generate.ts."
                      className={`text-[10px] font-bold ${isDark ? 'text-amber-400' : 'text-amber-600'}`}
                    >Warn</span>
                  )}
                </div>
              </div>
              <div className="pr-16">
                <div className={`text-[12px] leading-tight font-semibold break-words ${isModuleNode ? (isDark ? 'text-fuchsia-100' : 'text-fuchsia-800') : (isDark ? 'text-slate-100' : 'text-slate-800')}`}>{displayLabel}</div>
                <div className={`mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] leading-tight ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  {typeof node.depth === 'number' && <span className={`${layerTone.levelLabel}`}>L{node.depth}</span>}
                </div>
                {healthSignals.length > 0 && (
                  <div className="mt-1 pr-2">
                    <NodeHealthBadge signals={healthSignals} />
                  </div>
                )}
              </div>
              {levelCountText && <div className={`mt-1 text-[10px] leading-tight font-mono ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{levelCountText}</div>}
              </button>
              {/* Technical: this is the quick "solo this branch" control.
                  Layman: hide the sibling branches next to this one and keep this branch visible. */}
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  if (siblingBranchesHidden) {
                    restoreBranchVisibility(hiddenSiblingIdsForNode);
                  } else {
                    setCollapsedBranchNodeIds((previous) => collapseSiblingBranchesForNode({
                      collapsedBranchNodeIds: previous,
                      allChildrenByParent,
                      nodeId: node.id,
                      parentId: node.parentId
                    }));
                  }
                  setPendingContainNodeId(node.id);
                }}
                aria-label={siblingBranchesHidden ? 'Restore hidden sibling branches for this node' : 'Hide sibling branches and keep this branch visible'}
                className={`absolute right-2 top-2 h-6 min-w-11 rounded-md border px-2 text-[10px] font-semibold uppercase tracking-[0.08em] transition-opacity ${
                  shouldRevealBranchVisibilityButton
                    ? 'opacity-100'
                    : 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100'
                } ${
                  isDark
                    ? 'border-slate-600 bg-slate-950/80 text-slate-100 hover:bg-slate-800'
                    : 'border-slate-300 bg-white/95 text-slate-700 hover:bg-slate-100'
                }`}
                title={siblingBranchesHidden ? 'Show every hidden sibling branch again.' : 'Hide the sibling branches next to this one and keep this branch visible.'}
              >
                {siblingBranchesHidden ? 'Show All' : 'Solo'}
              </button>
            </motion.div>
          );
        })}

        {/* Spell Graph Overlay — live axis-engine-powered subtree for pillar_spells */}
        {(() => {
          const spellsNode = graph.nodes.find((n) => n.id === 'pillar_spells');
          if (!spellsNode || !expandedNodeIds.has('pillar_spells')) return null;
          const rootRender = graph.nodes.find((n) => n.kind === 'root');
          const rootCenterX = rootRender ? rootRender.x + rootRender.width / 2 : TRUNK_X;
          const spellsCenterX = spellsNode.x + spellsNode.width / 2;
          return (
            <SpellGraphOverlay
              spellsProjectNode={spellsNode}
              side={spellsCenterX >= rootCenterX ? 1 : -1}
              isDark={isDark}
              selectedVirtualId={selectedVirtualId}
              onVirtualNodeSelect={handleVirtualNodeSelect}
              onOpenSpellBranch={onOpenSpellBranch ?? (() => {})}
              canvasOffset={CANVAS_OFFSET}
            />
          );
        })()}
      </motion.div>

      {/* Technical: keep the bottom dock present for thumb access, but soften its
          visual weight so it reads like utility chrome instead of a second toolbar.
          Layman: the zoom/reset buttons stay easy to hit, but stop shouting over the map. */}
      <div
        data-wheel-no-zoom="true"
        className="absolute bottom-4 left-0 z-50 flex w-full justify-center px-3 pointer-events-none sm:bottom-6"
      >
        <div
          className={`pointer-events-auto flex items-center gap-2 rounded-full border px-2 py-1.5 shadow-lg backdrop-blur-md ${
            isDark
              ? 'bg-slate-950/62 border-slate-700/70'
              : 'bg-white/72 border-slate-300/90'
          }`}
        >
          {/* Keep zoom controls symmetrical so the user can adjust scale quickly
              without hunting for separate UI pockets on touch devices. */}
          <div
            className={`flex items-center rounded-full border ${
              isDark
                ? 'border-slate-700/70 bg-slate-900/45'
                : 'border-slate-300/90 bg-white/55'
            }`}
          >
            <button
              type="button"
              onClick={() => {
                const current = canvasScale.get();
                const next = Math.max(current / 1.12, 0.35);
                canvasScale.set(next);
                setZoomLevel(next);
              }}
              className={`flex h-10 w-10 items-center justify-center rounded-full text-lg font-semibold transition-colors ${
                isDark
                  ? 'text-slate-100 hover:bg-slate-800/75 hover:text-white'
                  : 'text-slate-800 hover:bg-slate-100/90 hover:text-slate-950'
              }`}
              aria-label="Zoom out roadmap"
            >
              -
            </button>
            <div className={`h-5 w-px ${isDark ? 'bg-slate-700/80' : 'bg-slate-300/90'}`} />
            <button
              type="button"
              onClick={() => {
                const current = canvasScale.get();
                const next = Math.min(current * 1.12, MAX_ROADMAP_SCALE);
                canvasScale.set(next);
                setZoomLevel(next);
              }}
              className={`flex h-10 w-10 items-center justify-center rounded-full text-lg font-semibold transition-colors ${
                isDark
                  ? 'text-slate-100 hover:bg-slate-800/75 hover:text-white'
                  : 'text-slate-800 hover:bg-slate-100/90 hover:text-slate-950'
              }`}
              aria-label="Zoom in roadmap"
            >
              +
            </button>
          </div>
          {/* Shrink the reset button copy on compact screens so the dock stays narrow
              while still exposing one obvious escape hatch back to the default view. */}
          <div className={`h-5 w-px ${isDark ? 'bg-slate-700/80' : 'bg-slate-300/90'}`} />
          <button
            type="button"
            onClick={resetView}
            className={`min-h-10 rounded-full border px-4 text-sm font-semibold transition-colors ${
              isDark
                ? 'border-slate-700/70 bg-slate-900/45 text-slate-100 hover:bg-slate-800/75'
                : 'border-slate-300/90 bg-white/55 text-slate-700 hover:bg-slate-100/90'
            } ${isCompactViewport ? 'min-w-[84px]' : 'min-w-[112px]'}`}
          >
            {isCompactViewport ? 'Reset' : 'Reset View'}
          </button>
          <button
            type="button"
            onClick={resetNodePositions}
            className={`min-h-10 rounded-full border px-4 text-sm font-semibold transition-colors ${
              isDark
                ? 'border-slate-700/70 bg-slate-900/45 text-slate-100 hover:bg-slate-800/75'
                : 'border-slate-300/90 bg-white/55 text-slate-700 hover:bg-slate-100/90'
            } ${isCompactViewport ? 'min-w-[84px]' : 'min-w-[140px]'}`}
          >
            {isCompactViewport ? 'Node Pos' : 'Reset Node Positions'}
          </button>
        </div>
      </div>
      {/* Technical: media preview lightbox — dark overlay + centred image, dismissed by overlay click or Escape. */}
      {/* Layman: the full-size preview that opens when you click "View Preview" on a roadmap node. */}
      {showMediaPreview && mediaNodeId && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Node preview"
          data-wheel-no-zoom="true"
          onClick={() => setShowMediaPreview(false)}
          className="fixed inset-0 z-[200] flex items-center justify-center pointer-events-auto"
          style={{ background: 'rgba(0,0,0,0.78)' }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-w-[90vw] max-h-[90vh] rounded-xl overflow-hidden shadow-2xl"
          >
            <button
              type="button"
              aria-label="Close preview"
              onClick={() => setShowMediaPreview(false)}
              className="absolute top-2 right-2 z-10 w-7 h-7 rounded-full bg-black/60 text-white text-sm flex items-center justify-center hover:bg-black/80"
            >
              ×
            </button>
            <img
              src={`/api/roadmap/media/${mediaNodeId}`}
              alt={`Preview: ${selectedDetailTitle}`}
              className="block max-w-full max-h-[88vh] object-contain"
              onError={() => setShowMediaPreview(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
};

