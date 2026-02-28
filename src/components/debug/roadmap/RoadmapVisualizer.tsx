// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 28/02/2026, 16:54:28
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
import { motion, useMotionValue } from 'framer-motion';
import type {
  OpportunitySettings as OpportunitySettingsContract,
  RoadmapNode as HealthSignalRoadmapNode
} from '../../../../scripts/roadmap-server-logic';
import { GRID_SIZE, THEME_STORAGE_KEY, nextThemeMode } from './constants';
import { buildRenderGraph } from './graph';
import { OpportunitySettingsForm } from './OpportunitySettingsForm';
import { NodeHealthBadge } from './health-signals/NodeHealthBadge';
import { computeHealthSignals } from './health-signals/compute-health-signals';
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
type LayoutPositions = Record<string, { x: number; y: number }>;
type LayoutSaveState = 'idle' | 'saving' | 'saved' | 'error';
type RelatedDocKind = 'markdown' | 'typescript' | 'javascript' | 'json' | 'config' | 'text' | 'other';
type NodeTestRunState = 'idle' | 'running' | 'success' | 'error';
type NodeTestRunResponse = {
  total: number;
  pass: number;
  fail: number;
  results: Array<{ nodeId: string; ok: boolean; message: string }>;
};
type OpportunityViewMode = 'direct' | 'propagated';
type OpportunityFlagType =
  | 'missing_test'
  | 'failing_test'
  | 'planned_stale'
  | 'missing_docs_link'
  | 'crosslink_opportunity';
type OpportunitySeverity = 'info' | 'warn' | 'error';
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
  trigger: 'manual' | 'auto' | 'on-demand';
  summary: OpportunityScanSummary;
  nodes: OpportunityNodeRecord[];
};
type OpportunitySettings = OpportunitySettingsContract & {
  parentModeDefault?: OpportunityViewMode;
};

// Technical: keeps node coordinates aligned to grid.
// Layman: snaps dragged nodes to neat grid positions instead of messy pixels.
const snapToGrid = (value: number) => Math.round(value / GRID_SIZE) * GRID_SIZE;

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

// Technical: compact chip color palette for opportunity severities.
// Layman: gives each opportunity row a visual "how urgent is this" marker.
const opportunitySeverityChipClass = (severity: OpportunitySeverity, isDark: boolean) => {
  if (isDark) {
    if (severity === 'error') return 'border-rose-500/70 bg-rose-900/45 text-rose-100';
    if (severity === 'warn') return 'border-amber-500/70 bg-amber-900/45 text-amber-100';
    return 'border-cyan-500/60 bg-cyan-900/40 text-cyan-100';
  }
  if (severity === 'error') return 'border-rose-300 bg-rose-50 text-rose-700';
  if (severity === 'warn') return 'border-amber-300 bg-amber-50 text-amber-700';
  return 'border-cyan-300 bg-cyan-50 text-cyan-700';
};

// Technical: friendly labels for the fixed opportunity flag families.
// Layman: converts scanner keys into readable names in the drawer.
const OPPORTUNITY_LABELS: Record<OpportunityFlagType, string> = {
  missing_test: 'Missing Test',
  failing_test: 'Failing Test',
  planned_stale: 'Planned Stale',
  missing_docs_link: 'Missing Docs Link',
  crosslink_opportunity: 'Crosslink Opportunity'
};

// Technical: maps file extensions to compact labels + coarse type groups so related-doc
// entries can show quick visual type hints without opening each file.
// Layman: this gives each related doc a small "what kind of file is this?" badge like
// MD, TS, JSON, etc., plus a tiny symbol so the list is easier to scan quickly.
const describeRelatedDocType = (rawPath: string): { label: string; kind: RelatedDocKind; symbol: string } => {
  const normalized = rawPath.split('?')[0].split('#')[0].trim().toLowerCase();
  const parts = normalized.split('.');
  const ext = parts.length > 1 ? parts[parts.length - 1] : '';

  if (ext === 'md' || ext === 'mdx') return { label: 'MD', kind: 'markdown', symbol: '#' };
  if (ext === 'ts' || ext === 'tsx') return { label: ext.toUpperCase(), kind: 'typescript', symbol: '</>' };
  if (ext === 'js' || ext === 'jsx' || ext === 'mjs' || ext === 'cjs') return { label: ext.toUpperCase(), kind: 'javascript', symbol: 'JS' };
  if (ext === 'json') return { label: 'JSON', kind: 'json', symbol: '{}' };
  if (ext === 'yml' || ext === 'yaml' || ext === 'toml' || ext === 'ini' || ext === 'env') return { label: ext.toUpperCase(), kind: 'config', symbol: '=' };
  if (ext === 'txt') return { label: 'TXT', kind: 'text', symbol: 'T' };
  if (!ext) return { label: 'FILE', kind: 'other', symbol: 'F' };
  return { label: ext.slice(0, 6).toUpperCase(), kind: 'other', symbol: 'F' };
};

// Technical: color tokens for doc-type badge chips.
// Layman: keeps file-type badges visually distinct but still readable in dark/light theme.
const relatedDocTypeBadgeClass = (kind: RelatedDocKind, isDark: boolean) => {
  if (isDark) {
    if (kind === 'markdown') return 'border-emerald-500/50 bg-emerald-900/40 text-emerald-200';
    if (kind === 'typescript') return 'border-blue-500/50 bg-blue-900/45 text-blue-100';
    if (kind === 'javascript') return 'border-amber-500/55 bg-amber-900/40 text-amber-100';
    if (kind === 'json') return 'border-violet-500/50 bg-violet-900/40 text-violet-100';
    if (kind === 'config') return 'border-cyan-500/50 bg-cyan-900/40 text-cyan-100';
    if (kind === 'text') return 'border-slate-500/50 bg-slate-800/80 text-slate-200';
    return 'border-slate-600/60 bg-slate-900/70 text-slate-200';
  }

  if (kind === 'markdown') return 'border-emerald-300 bg-emerald-50 text-emerald-700';
  if (kind === 'typescript') return 'border-blue-300 bg-blue-50 text-blue-700';
  if (kind === 'javascript') return 'border-amber-300 bg-amber-50 text-amber-700';
  if (kind === 'json') return 'border-violet-300 bg-violet-50 text-violet-700';
  if (kind === 'config') return 'border-cyan-300 bg-cyan-50 text-cyan-700';
  if (kind === 'text') return 'border-slate-300 bg-slate-100 text-slate-700';
  return 'border-slate-300 bg-slate-100 text-slate-700';
};

// Technical: guards layout payload so only numeric {x,y} entries survive.
// Layman: ignores broken save data so bad coordinates do not crash layout restore.
const sanitizeLayoutPositions = (input: unknown): LayoutPositions => {
  if (!input || typeof input !== 'object') return {};
  const output: LayoutPositions = {};
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (!value || typeof value !== 'object') continue;
    const x = Number((value as { x?: unknown }).x);
    const y = Number((value as { y?: unknown }).y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    output[key] = { x, y };
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

// ============================================================================
// Main Component
// ============================================================================
// Technical: orchestrates data loading, graph build, interaction state, and rendering.
// Layman: this is the roadmap app itself.
// ============================================================================
export const RoadmapVisualizer: React.FC = () => {
  // Technical: roadmap source payload and load/error lifecycle.
  // Layman: loaded roadmap data and whether the screen is still loading or failed.
  const [data, setData] = useState<RoadmapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Technical: node selection + expansion model for collapsible branches.
  // Layman: which node is selected and which nodes are unfolded right now.
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [expandedNodeIds, setExpandedNodeIds] = useState<Set<string>>(() => new Set(['aralia_chronicles']));

  // Technical: visual controls for zoom/theme/crosslink visibility.
  // Layman: UI display toggles for magnification, dark mode, and crosslink lines.
  const [zoomLevel, setZoomLevel] = useState(1);
  const [themeMode, setThemeMode] = useState<ThemeMode>('dark');
  const [showCrosslinks, setShowCrosslinks] = useState(true);

  // Technical: user-adjusted node coordinates + save state.
  // Layman: remembers moved node positions and whether layout changes are unsaved.
  const [positionOverrides, setPositionOverrides] = useState<LayoutPositions>({});
  const [layoutDirty, setLayoutDirty] = useState(false);
  const [layoutSaveState, setLayoutSaveState] = useState<LayoutSaveState>('idle');
  // Technical: auto-save toggle is separate from manual save on purpose.
  // Layman: user can choose "save only when I press button" or "save automatically."
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(false);
  // Technical: controls save-help explanatory panel.
  // Layman: opens the little "what does save do?" helper panel.
  const [showLayoutHelp, setShowLayoutHelp] = useState(false);
  const [vscodeStatus, setVscodeStatus] = useState<string | null>(null);
  const [nodeTestState, setNodeTestState] = useState<NodeTestRunState>('idle');
  const [nodeTestStatus, setNodeTestStatus] = useState<string | null>(null);
  const [isCanvasDragging, setIsCanvasDragging] = useState(false);
  // Technical: tracks dynamic toolbar bottom position to avoid overlapping overlays.
  // Layman: if buttons wrap to a second row, this pushes info panels down so they do not collide.
  const [topControlsBottom, setTopControlsBottom] = useState(58);
  // Technical: when false, node clicks only toggle expand/collapse — no detail panel opens.
  // Layman: toggle to disable the info card popping open every time you click a node.
  const [infoPanelEnabled, setInfoPanelEnabled] = useState(true);

  // Technical: opportunities drawer + scanner states.
  // Layman: controls the collector panel, scan mode, and latest scanner output.
  const [showOpportunities, setShowOpportunities] = useState(false);
  const [opportunityMode, setOpportunityMode] = useState<OpportunityViewMode>('propagated');
  const [opportunityData, setOpportunityData] = useState<OpportunityScanPayload | null>(null);
  const [opportunitySettings, setOpportunitySettings] = useState<OpportunitySettings | null>(null);
  const [opportunityLoading, setOpportunityLoading] = useState(false);
  const [opportunityStatus, setOpportunityStatus] = useState<string | null>(null);
  const [opportunityError, setOpportunityError] = useState<string | null>(null);
  const [pendingFocusNodeId, setPendingFocusNodeId] = useState<string | null>(null);

  // Technical: mutable refs + motion values for drag intent and canvas transform.
  // Layman: remembers if the last click was actually a drag, and stores map pan/zoom.
  const dragWasMovementRef = useRef(false);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const topControlsRef = useRef<HTMLDivElement | null>(null);
  const canvasPanX = useMotionValue(0);
  const canvasPanY = useMotionValue(0);
  const canvasScale = useMotionValue(1);
  const isDark = themeMode === 'dark';

  // Technical: map lookup avoids repeated object scans during graph operations.
  // Layman: quick lookup table for moved node positions by id.
  const positionOverrideMap = useMemo(
    () => new Map(Object.entries(positionOverrides).map(([id, pos]) => [id, pos])),
    [positionOverrides]
  );

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

  // Technical: persist auto-save preference whenever it changes.
  // Layman: update browser memory when the auto-save button is toggled.
  useEffect(() => {
    try {
      localStorage.setItem(AUTO_SAVE_LAYOUT_STORAGE_KEY, autoSaveEnabled ? '1' : '0');
    } catch {
      // ignore
    }
  }, [autoSaveEnabled]);

  // Technical: observe toolbar height and push floating panels below it.
  // Layman: prevents top controls from overlapping with detail/status cards.
  useEffect(() => {
    const controls = topControlsRef.current;
    if (!controls) return;
    const update = () => {
      const rect = controls.getBoundingClientRect();
      setTopControlsBottom(Math.round(rect.bottom));
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(controls);
    window.addEventListener('resize', update);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', update);
    };
  }, []);

  // Technical: persist current theme mode.
  // Layman: save dark/light choice after each switch.
  useEffect(() => {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, themeMode);
    } catch {
      // ignore
    }
  }, [themeMode]);

  // Technical: initial data bootstrap:
  // 1) fetch roadmap content, 2) fetch saved layout, 3) hydrate state.
  //
  // Layman:
  // On first load, this grabs roadmap nodes/edges and then applies your saved node positions.
  useEffect(() => {
    const loadData = async () => {
      try {
        const response = await fetch('/Aralia/api/roadmap/data');
        if (!response.ok) throw new Error('Failed to load roadmap data');
        const json = (await response.json()) as RoadmapData;

        let loadedLayout: LayoutPositions = {};
        try {
          const layoutResponse = await fetch('/Aralia/api/roadmap/layout');
          if (layoutResponse.ok) {
            const layoutJson = (await layoutResponse.json()) as { positions?: unknown };
            loadedLayout = sanitizeLayoutPositions(layoutJson.positions);
          }
        } catch {
          // optional during transition
        }

        setData(json);
        setPositionOverrides(loadedLayout);
        setLoading(false);
      } catch (loadErr) {
        console.error(loadErr);
        setError('Roadmap data not found or inaccessible.');
        setLoading(false);
      }
    };
    loadData();
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
      const response = await fetch('/Aralia/api/roadmap/opportunities');
      if (!response.ok) throw new Error(`Opportunity load failed (${response.status})`);
      const payload = (await response.json()) as OpportunityScanPayload;
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
  const scanOpportunities = useCallback(async (trigger: 'manual' | 'auto') => {
    try {
      setOpportunityLoading(true);
      setOpportunityError(null);
      setOpportunityStatus(trigger === 'manual' ? 'Scanning opportunities...' : 'Auto-scanning opportunities...');
      const response = await fetch('/Aralia/api/roadmap/opportunities/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trigger })
      });
      const payload = (await response.json()) as OpportunityScanPayload & { error?: string };
      if (!response.ok || payload.error) throw new Error(payload.error || `Opportunity scan failed (${response.status})`);
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
  const graph = useMemo(() => {
    if (!data) return null;
    return buildRenderGraph(data, expandedNodeIds, positionOverrideMap);
  }, [data, expandedNodeIds, positionOverrideMap]);

  // Technical: source-node lookup by id for status/test capability checks.
  // Layman: lets us quickly answer "is this underlying roadmap node testable?".
  const roadmapNodeById = useMemo(() => {
    const map = new Map<string, RoadmapData['nodes'][number]>();
    if (!data) return map;
    for (const node of data.nodes) map.set(node.id, node);
    return map;
  }, [data]);

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
      label: renderNode.label,
      type: mappedType,
      status: renderNode.status,
      testFile: sourceNode?.testFile ?? sourceNode?.testCommand,
      lastTestRun: normalizedLastTestRun,
      componentFiles: sourceNode?.componentFiles
    };
  }, [graph, roadmapNodeById]);

  // Technical: fully-expanded graph used for subtree test execution.
  // Layman: this gives us the complete child tree even when UI nodes are currently collapsed.
  const fullGraph = useMemo(() => {
    if (!data) return null;
    // Technical: first pass discovers synthetic render-node ids (branch cards) that do not exist
    // in source node ids; second pass expands those discovered ids so descendants are materialized.
    // Layman: without this second pass, parent-node test buttons can miss child tests because the
    // hidden branch-card ids were never marked as expanded.
    const initialExpandedIds = new Set<string>(data.nodes.map((node) => node.id));
    initialExpandedIds.add('aralia_chronicles');
    const discoveryGraph = buildRenderGraph(data, initialExpandedIds, positionOverrideMap);
    const fullyExpandedIds = new Set<string>([
      ...initialExpandedIds,
      ...discoveryGraph.expandableIds
    ]);
    return buildRenderGraph(data, fullyExpandedIds, positionOverrideMap);
  }, [data, positionOverrideMap]);

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

  // Technical: selected detail payload + optional crosslink filtering.
  // Layman: node panel content and whether dotted crosslinks should be hidden.
  const selectedDetail = selectedNodeId && graph ? graph.detailById.get(selectedNodeId) || null : null;
  const selectedFullDetail = selectedNodeId && fullGraph ? fullGraph.detailById.get(selectedNodeId) || null : null;
  const visibleEdges = useMemo(
    () => (graph ? (showCrosslinks ? graph.edges : graph.edges.filter((edge) => !edge.dashed)) : []),
    [graph, showCrosslinks]
  );

  // Technical: helper that returns direct or propagated flags based on drawer mode.
  // Layman: switches the collector list between "just this node" and "include child issues".
  const getOpportunityFlagsForMode = useCallback(
    (record: OpportunityNodeRecord) => (opportunityMode === 'direct' ? record.directFlags : record.propagatedFlags),
    [opportunityMode]
  );

  // Technical: filtered/sorted opportunities rows shown in the collector drawer.
  // Layman: this is the node list you browse when looking for flagged opportunities.
  const opportunityRows = useMemo(() => {
    if (!opportunityData) return [] as OpportunityNodeRecord[];
    const rows = opportunityData.nodes
      .filter((record) => getOpportunityFlagsForMode(record).length > 0)
      .sort((a, b) => {
        const aCount = getOpportunityFlagsForMode(a).length;
        const bCount = getOpportunityFlagsForMode(b).length;
        if (aCount !== bCount) return bCount - aCount;
        return a.label.localeCompare(b.label);
      });
    return rows;
  }, [opportunityData, getOpportunityFlagsForMode]);

  // Technical: live flagged-node count for current drawer mode.
  // Layman: used in toolbar badges so you can see collector volume at a glance.
  const flaggedCountForMode = useMemo(() => {
    if (!opportunityData) return 0;
    return opportunityMode === 'direct'
      ? opportunityData.summary.flaggedDirectNodes
      : opportunityData.summary.flaggedPropagatedNodes;
  }, [opportunityData, opportunityMode]);

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

    const ancestors: string[] = [];
    let cursor: RenderNode | undefined = target;
    while (cursor?.parentId) {
      ancestors.push(cursor.parentId);
      cursor = fullNodeById.get(cursor.parentId);
    }

    setExpandedNodeIds((prev) => {
      const next = new Set(prev);
      next.add('aralia_chronicles');
      for (const ancestorId of ancestors) next.add(ancestorId);
      return next;
    });
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

    const rect = viewport.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const scale = canvasScale.get();
    const nodeCenterX = node.x + node.width / 2;
    const nodeCenterY = node.y + node.height / 2;

    canvasPanX.set(centerX - nodeCenterX * scale);
    canvasPanY.set(centerY - nodeCenterY * scale);
    setPendingFocusNodeId(null);
  }, [pendingFocusNodeId, nodeById, canvasScale, canvasPanX, canvasPanY]);

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

  const toggleNode = (nodeId: string) => {
    // Technical: toggles one node id inside expansion set.
    // Layman: fold or unfold this node's children.
    setExpandedNodeIds((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  };

  const collectDragBranch = (rootId: string) => {
    // Technical: drag applies to full visible subtree for root/project/branch nodes.
    // Layman: when you drag a parent, all visible children move with it.
    const start = nodeById.get(rootId);
    if (!start) return [rootId];
    if (!(start.kind === 'project' || start.kind === 'branch' || start.kind === 'root')) return [rootId];
    const out = [rootId];
    const seen = new Set(out);
    const stack = [rootId];
    while (stack.length > 0) {
      const current = stack.pop()!;
      const children = childrenByParent.get(current) ?? [];
      for (const childId of children) {
        if (seen.has(childId)) continue;
        seen.add(childId);
        out.push(childId);
        stack.push(childId);
      }
    }
    return out;
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
        const next = { ...prev };
        for (const id of dragIds) {
          const fallback = nodeById.get(id);
          if (!fallback) continue;
          const base = next[id] ?? { x: fallback.x, y: fallback.y };
          next[id] = { x: base.x + dx, y: base.y + dy };
        }
        return next;
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
        const next = { ...prev };
        for (const id of dragIds) {
          if (!next[id]) continue;
          next[id] = { x: snapToGrid(next[id].x), y: snapToGrid(next[id].y) };
        }
        return next;
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
    // Technical: ignore click-up after drag so node does not accidentally toggle.
    // Layman: dragging should not also count as a click.
    if (dragWasMovementRef.current) {
      dragWasMovementRef.current = false;
      return;
    }
    if (expandable) toggleNode(nodeId);
    if (infoPanelEnabled) setSelectedNodeId(nodeId);
  };

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
      const response = await fetch('/Aralia/api/roadmap/open-in-vscode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: docPath })
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(payload.error || `VS Code open failed ${response.status}`);
      setVscodeStatus('Opened in VS Code.');
      setTimeout(() => setVscodeStatus((prev) => (prev === 'Opened in VS Code.' ? null : prev)), 1500);
    } catch (vsErr) {
      console.error(vsErr);
      setVscodeStatus('VS Code open failed.');
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

  const handleWheelZoomCapture = (event: React.WheelEvent<HTMLDivElement>) => {
    // Technical: if wheel input comes from a panel region marked as "no canvas zoom",
    // skip zoom handling so native scroll behavior can run for that panel/list.
    // Layman: when your cursor is over the node details panel (like the docs list),
    // mouse wheel should scroll that panel, not zoom the whole roadmap.
    const target = event.target as HTMLElement | null;
    if (target?.closest('[data-wheel-no-zoom="true"]')) return;

    // Technical: intercept wheel globally for canvas zoom control.
    // Layman: mouse wheel zooms roadmap instead of scrolling page.
    event.preventDefault();
    const currentScale = canvasScale.get();
    const factor = event.deltaY < 0 ? 1.12 : 1 / 1.12;
    const nextScale = Math.min(Math.max(currentScale * factor, 0.35), 2.6);
    if (Math.abs(nextScale - currentScale) < 0.00001) return;
    // Technical: cursor-centric zoom preserves world point under pointer while scaling.
    // Layman: zoom happens around your mouse position, not random center drift.
    const rect = event.currentTarget.getBoundingClientRect();
    const cx = event.clientX - rect.left;
    const cy = event.clientY - rect.top;
    const px = canvasPanX.get();
    const py = canvasPanY.get();
    canvasPanX.set(cx - (cx - px) * (nextScale / currentScale));
    canvasPanY.set(cy - (cy - py) * (nextScale / currentScale));
    canvasScale.set(nextScale);
    setZoomLevel(nextScale);
  };

  const startCanvasDrag = (event: React.MouseEvent<HTMLButtonElement>) => {
    // Technical: background pan layer drag for world-space navigation.
    // Layman: click-and-drag empty canvas to move around the roadmap.
    if (event.button !== 0) return;
    event.preventDefault();
    let lastX = event.clientX;
    let lastY = event.clientY;
    setIsCanvasDragging(true);

    const onMove = (moveEvent: MouseEvent) => {
      const dx = moveEvent.clientX - lastX;
      const dy = moveEvent.clientY - lastY;
      if (Math.abs(dx) < 0.0001 && Math.abs(dy) < 0.0001) return;
      canvasPanX.set(canvasPanX.get() + dx);
      canvasPanY.set(canvasPanY.get() + dy);
      lastX = moveEvent.clientX;
      lastY = moveEvent.clientY;
    };

    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      setIsCanvasDragging(false);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  // Technical: expand all currently expandable nodes from graph metadata.
  // Layman: open every foldable node in one click.
  const expandAll = () => graph && setExpandedNodeIds(new Set(graph.expandableIds));
  // Technical: empty expansion set for complete collapse.
  // Layman: close everything so only root stays visible.
  const collapseAll = () => setExpandedNodeIds(new Set());
  const resetView = () => {
    // Technical: reset pan/zoom transforms without altering node position overrides.
    // Layman: camera reset only, not node layout reset.
    canvasPanX.set(0);
    canvasPanY.set(0);
    canvasScale.set(1);
    setZoomLevel(1);
  };

  if (loading) return <div className={`w-full h-screen flex items-center justify-center text-2xl animate-pulse ${isDark ? 'bg-[#050810] text-slate-300' : 'bg-slate-100 text-slate-600'}`}>Rendering roadmap...</div>;
  if (error || !graph) return <div className={`w-full h-screen flex items-center justify-center ${isDark ? 'bg-[#050810] text-red-400' : 'bg-slate-100 text-red-600'}`}>{error || 'Data Error'}</div>;

  const progressTotal = graph.stats.done + graph.stats.active + graph.stats.planned;
  const progressPercent = progressTotal > 0 ? Math.round((graph.stats.done / progressTotal) * 100) : 0;
  // Technical: dynamic top offsets keep floating cards clear of toolbar and help popup.
  // Layman: prevents UI boxes from stacking on top of each other.
  const helpPanelTop = topControlsBottom + 8;
  const helpPanelHeight = showLayoutHelp ? 148 : 0;
  const detailTop = topControlsBottom + 42 + helpPanelHeight;
  const glanceTop = Math.max(24, topControlsBottom + 8 + helpPanelHeight);

  return (
    <div ref={viewportRef} onWheelCapture={handleWheelZoomCapture} className={`relative w-full h-screen overflow-hidden select-none ${isDark ? 'bg-[#050810] text-slate-100' : 'bg-slate-100 text-slate-800'}`}>
      {/* Technical: static title strip centered above the canvas content. */}
      {/* Layman: main heading at the top so the screen always reads as the roadmap tool. */}
      <div className="absolute top-5 left-0 w-full text-center z-30 pointer-events-none">
        <h1 className={`text-4xl font-semibold tracking-tight ${isDark ? 'text-slate-50' : 'text-slate-800'}`}>Aralia Feature Roadmap</h1>
        <p className={`text-xs uppercase tracking-[0.3em] mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Interactive Feature Tree</p>
      </div>

      {/* Technical: top-left controls for expand/collapse/crosslinks/save/layout/theme. */}
      {/* Layman: command buttons row for how the roadmap behaves. */}
      <div ref={topControlsRef} className="absolute top-6 left-6 z-30 pointer-events-auto max-w-[840px]">
        {/* Technical: keep action buttons and layout-status text in one stacking context.
            This prevents the status text from being overdrawn when controls wrap to multiple rows. */}
        {/* Layman: when buttons spill to a second line, the save-status text now always stays
            underneath them instead of being overlapped by those overflow buttons. */}
        <div className="flex gap-2 flex-wrap">
          <button type="button" onClick={expandAll} className={`rounded-lg px-4 py-2 text-xs font-semibold border backdrop-blur-md transition-colors ${glassButtonClass(isDark)}`}>Expand All</button>
          <button type="button" onClick={collapseAll} className={`rounded-lg px-4 py-2 text-xs font-semibold border backdrop-blur-md transition-colors ${glassButtonClass(isDark)}`}>Collapse All</button>
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
          <button type="button" onClick={() => setShowLayoutHelp((prev) => !prev)} className={`rounded-lg px-4 py-2 text-xs font-semibold border backdrop-blur-md transition-colors ${glassButtonClass(isDark)}`}>Layout Save Help</button>
          <button type="button" onClick={resetNodePositions} className={`rounded-lg px-4 py-2 text-xs font-semibold border backdrop-blur-md transition-colors ${glassButtonClass(isDark)}`}>Reset Node Positions</button>
          <button type="button" onClick={() => setThemeMode((prev) => nextThemeMode(prev))} className={`rounded-lg px-4 py-2 text-xs font-semibold border backdrop-blur-md transition-colors ${glassButtonClass(isDark)}`}>Theme: {isDark ? 'Dark' : 'Light'}</button>
        </div>
        <div className={`mt-2 text-[10px] uppercase tracking-[0.18em] pointer-events-none ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
          Layout {layoutSaveState === 'saving' ? 'saving...' : layoutSaveState === 'saved' ? 'saved' : layoutSaveState === 'error' ? 'error' : layoutDirty ? 'unsaved' : 'synced'} | Auto-save {autoSaveEnabled ? 'on' : 'off'}
        </div>
        {(opportunityStatus || opportunityError) && (
          <div className={`mt-1 text-[10px] uppercase tracking-[0.14em] ${opportunityError ? (isDark ? 'text-rose-300' : 'text-rose-700') : isDark ? 'text-cyan-300' : 'text-cyan-700'}`}>
            {opportunityError || opportunityStatus}
          </div>
        )}
      </div>

      {showLayoutHelp && (
        <>
          {/* Technical: inline explanation of manual save vs auto-save semantics. */}
          {/* Layman: clear reminder of what those save buttons actually do. */}
        <div className="absolute left-6 z-30 pointer-events-auto w-[420px]" style={{ top: helpPanelTop }}>
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

      {/* Technical: aggregate stat widget from render graph metadata. */}
      {/* Layman: at-a-glance counts for done/active/planned and zoom/progress. */}
      <div className="absolute right-6 z-30 pointer-events-none" style={{ top: glanceTop }}>
        <div className={`rounded-xl px-4 py-3 shadow-xl min-w-[265px] border backdrop-blur-md ${isDark ? 'bg-slate-900/72 border-slate-700/90' : 'bg-white/88 border-slate-300'}`}>
          <div className={`text-[10px] uppercase tracking-[0.2em] mb-2 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>At A Glance</div>
          <div className="grid grid-cols-3 gap-2 mb-2">
            <div className={`rounded border px-2 py-1.5 ${isDark ? 'bg-emerald-950/40 border-emerald-800' : 'bg-emerald-50 border-emerald-200'}`}><div className={`text-[9px] uppercase ${isDark ? 'text-emerald-300' : 'text-emerald-600'}`}>Done</div><div className={`text-lg leading-none font-bold ${isDark ? 'text-emerald-200' : 'text-emerald-700'}`}>{graph.stats.done}</div></div>
            <div className={`rounded border px-2 py-1.5 ${isDark ? 'bg-amber-950/40 border-amber-800' : 'bg-amber-50 border-amber-200'}`}><div className={`text-[9px] uppercase ${isDark ? 'text-amber-300' : 'text-amber-600'}`}>Active</div><div className={`text-lg leading-none font-bold ${isDark ? 'text-amber-200' : 'text-amber-700'}`}>{graph.stats.active}</div></div>
            <div className={`rounded border px-2 py-1.5 ${isDark ? 'bg-cyan-950/40 border-cyan-700' : 'bg-cyan-50 border-cyan-200'}`}><div className={`text-[9px] uppercase ${isDark ? 'text-cyan-200' : 'text-cyan-700'}`}>Planned</div><div className={`text-lg leading-none font-bold ${isDark ? 'text-cyan-100' : 'text-cyan-700'}`}>{graph.stats.planned}</div></div>
          </div>
          <div className={`flex justify-between text-[10px] uppercase tracking-[0.12em] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}><span>Features {graph.stats.projects}</span><span>Branches {graph.stats.branches}</span></div>
          <div className={`mt-2 text-[10px] uppercase tracking-[0.12em] ${isDark ? 'text-cyan-300' : 'text-cyan-700'}`}>Zoom {Math.round(zoomLevel * 100)}% | Progress {progressPercent}%</div>
        </div>
      </div>

      {showOpportunities && (
        <>
          {/* Technical: dedicated opportunities collector drawer with mode toggle + scanner controls. */}
          {/* Layman: this panel lists flagged nodes and lets you jump the map camera directly to them. */}
          <motion.aside
            initial={{ x: 420, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            data-wheel-no-zoom="true"
            className={`absolute right-6 overflow-y-auto w-[430px] z-40 rounded-xl p-5 shadow-2xl pointer-events-auto border ${
              isDark
                ? 'bg-[#0f121cdc] border-slate-700/80 backdrop-blur-md'
                : 'bg-white/96 border-slate-300'
            }`}
            style={{ top: detailTop, maxHeight: `calc(100vh - ${detailTop + 20}px)` }}
          >
            <button type="button" onClick={() => setShowOpportunities(false)} className={`absolute top-4 right-4 ${isDark ? 'text-slate-400 hover:text-slate-100' : 'text-slate-500 hover:text-slate-800'}`}>
              x
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
                  const modeFlags = getOpportunityFlagsForMode(row);
                  const firstFlag = modeFlags[0];
                  return (
                    <div key={row.nodeId} className={`rounded border p-3 ${isDark ? 'border-slate-700 bg-slate-900/65' : 'border-slate-300 bg-slate-100/95'}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className={`text-[11px] uppercase tracking-[0.11em] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                            {row.status} {row.nodeType}
                          </div>
                          <div className={`text-sm font-semibold leading-tight ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>
                            {row.label}
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

      {selectedDetail && (
        <>
          {/* Technical: selected-node detail drawer with docs and external actions. */}
          {/* Layman: info panel that opens when you click a node. */}
        <motion.aside
          initial={{ x: -420, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          data-wheel-no-zoom="true"
          className={`absolute left-6 overflow-y-auto w-[410px] z-40 rounded-xl p-6 shadow-2xl pointer-events-auto border-l-4 ${
            isDark
              ? 'bg-[#0f121cdc] border-l-amber-500 border border-slate-700/80 backdrop-blur-md'
              : 'bg-white/96 border-l-amber-500 border border-slate-300'
          }`}
          style={{ top: detailTop, maxHeight: `calc(100vh - ${detailTop + 20}px)` }}
        >
          <button type="button" onClick={() => setSelectedNodeId(null)} className={`absolute top-4 right-4 ${isDark ? 'text-slate-400 hover:text-slate-100' : 'text-slate-500 hover:text-slate-800'}`}>
            x
          </button>
          <div className="mb-5">
            <div className={`inline-flex text-[10px] uppercase font-semibold border rounded-full px-2 py-0.5 ${statusChipClass(selectedDetail.status, isDark)}`}>
              {selectedDetail.status}
            </div>
            <h2 className={`mt-3 text-2xl font-semibold leading-tight ${isDark ? 'text-slate-50' : 'text-slate-900'}`}>{selectedDetail.title}</h2>
            <p className={`mt-1 text-[11px] uppercase tracking-[0.16em] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{selectedDetail.type}</p>
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

      {/* Technical: full-screen transparent interaction layer used only for panning. */}
      {/* Layman: drag empty space to move the whole roadmap view. */}
      <button
        type="button"
        aria-label="Pan roadmap canvas"
        onMouseDown={startCanvasDrag}
        className={`absolute inset-0 z-10 pointer-events-auto select-none ${isCanvasDragging ? 'cursor-grabbing' : 'cursor-move'}`}
      />

      {/* Technical: world-space transform wrapper for grid, edges, and nodes. */}
      {/* Layman: everything in the map moves together when you pan/zoom. */}
      <motion.div style={{ x: canvasPanX, y: canvasPanY, scale: canvasScale }} className="absolute inset-0 origin-top-left z-20 pointer-events-none">
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
            siblings.map((sibling) => toHealthSignalNode(sibling))
          );

          // Technical: root node has dedicated circular treatment and larger visual weight.
          // Layman: the top-most roadmap node uses a big center style.
          if (node.kind === 'root') {
            // Technical: true when this node's info panel is the one currently open.
            // Layman: glows brighter when its info panel is open.
            const isSelected = infoPanelEnabled && selectedNodeId === node.id;
            return (
              <motion.button
                key={node.id}
                type="button"
                data-node-id={node.id}
                data-node-kind={node.kind}
                style={{ left: node.x, top: node.y, width: node.width, height: node.height, position: 'absolute' }}
                onMouseDown={(event) => onNodePointerDown(event, node.id)}
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
                  <span className="text-sm font-semibold leading-tight">{node.label}</span>
                  <NodeHealthBadge signals={healthSignals} />
                </span>
              </motion.button>
            );
          }

          // Technical: project nodes are the major feature pillars shown as medium circles.
          // Layman: big feature category nodes (like World Exploration, UI, etc.).
          if (node.kind === 'project') {
            const isExpanded = Boolean(node.expanded);
            const levelCountText = formatLevelCounts(node.descendantLevelCounts ?? []);
            // Technical: true when this node's info panel is the one currently open.
            // Layman: glows with a selection ring when its info panel is open.
            const isSelected = infoPanelEnabled && selectedNodeId === node.id;
            return (
              <motion.button
                key={node.id}
                type="button"
                data-node-id={node.id}
                data-node-kind={node.kind}
                style={{ left: node.x, top: node.y, width: node.width, height: node.height, position: 'absolute' }}
                onMouseDown={(event) => onNodePointerDown(event, node.id)}
                onClick={() => onNodeClick(node.id, Boolean(node.hasChildren))}
                className={`rounded-full border-2 pointer-events-auto shadow-lg text-white px-3 text-center transition-colors ${
                  isSelected
                    ? isDark
                      ? 'bg-blue-500 border-cyan-300 ring-2 ring-cyan-400/60 ring-offset-1 ring-offset-[#090e1a]'
                      : 'bg-blue-600 border-indigo-500 ring-2 ring-indigo-400/60 ring-offset-1 ring-offset-white'
                    : isDark
                      ? isExpanded
                        ? 'bg-blue-600 border-cyan-300/80'
                        : 'bg-blue-500 border-blue-300/70 hover:bg-blue-600'
                      : isExpanded
                        ? 'bg-blue-600 border-blue-500'
                        : 'bg-blue-500 border-blue-400 hover:bg-blue-600'
                }`}
              >
                <div className="text-[10px] uppercase tracking-[0.12em] opacity-90">Feature</div>
                <div className="mt-0.5 flex items-center justify-center gap-1">
                  <div className="text-[12px] font-semibold leading-tight">{node.label}</div>
                  <NodeHealthBadge signals={healthSignals} />
                </div>
                <div className="text-[10px] mt-1 opacity-90">{isExpanded ? 'Open' : 'Closed'}</div>
                {levelCountText && <div className="text-[9px] mt-0.5 leading-tight opacity-90">{levelCountText}</div>}
              </motion.button>
            );
          }

          // Technical: branch nodes are rectangular cards for feature/subfeature hierarchy.
          // Layman: the normal cards that represent detailed roadmap items.
          const isExpandable = Boolean(node.hasChildren);
          const isExpanded = Boolean(node.expanded);
          const levelCountText = formatLevelCounts(node.descendantLevelCounts ?? []);
          const hasWarning = Boolean(node.warning);
          // Technical: true when this node's info panel is the one currently open.
          // Layman: highlights with a colored border + dot when its info panel is open.
          const isSelected = infoPanelEnabled && selectedNodeId === node.id;

          return (
            <motion.button
              key={node.id}
              type="button"
              id={node.id}
              data-node-id={node.id}
              data-node-kind={node.kind}
              data-parent-id={node.parentId || ''}
              data-project-id={node.projectId || ''}
              style={{ left: node.x, top: node.y, width: node.width, height: node.height, position: 'absolute' }}
              onMouseDown={(event) => onNodePointerDown(event, node.id)}
              onClick={() => onNodeClick(node.id, isExpandable)}
              className={`pointer-events-auto rounded-xl border text-left px-3 py-2 shadow-sm transition-colors overflow-hidden ${
                isSelected
                  ? isDark
                    ? 'border-cyan-400/90 bg-[#0d1f3ccc] hover:bg-[#142440d8] backdrop-blur-md ring-1 ring-cyan-400/30'
                    : 'border-indigo-400 bg-indigo-50/60 hover:bg-indigo-50'
                  : hasWarning
                    ? isDark
                      ? 'border-amber-500/70 bg-[#111a2bcc] hover:bg-[#1a2740d8] backdrop-blur-md'
                      : 'border-amber-400 bg-white hover:bg-slate-50'
                    : isDark
                      ? 'border-slate-700 bg-[#111a2bcc] hover:bg-[#1a2740d8] backdrop-blur-md'
                      : 'border-slate-300 bg-white hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className={`text-[10px] uppercase border rounded-full px-1.5 py-0.5 font-semibold ${statusChipClass(node.status, isDark)}`}>{node.status}</span>
                <div className="flex items-center gap-1.5">
                  {isSelected && (
                    <span
                      title="Info panel open"
                      className={`text-[8px] leading-none ${isDark ? 'text-cyan-400' : 'text-indigo-500'}`}
                    >●</span>
                  )}
                  {hasWarning && (
                    <span
                      title="Data integrity warning: duplicate node ID detected. Check label casing in generate.ts."
                      className={`text-[10px] font-bold ${isDark ? 'text-amber-400' : 'text-amber-600'}`}
                    >⚠</span>
                  )}
                  {typeof node.depth === 'number' && <span className={`text-[10px] uppercase tracking-[0.08em] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>L{node.depth}</span>}
                  {isExpandable && <span className={`text-[10px] uppercase tracking-[0.08em] font-semibold ${isDark ? 'text-cyan-300' : 'text-blue-700'}`}>{isExpanded ? '-' : '+'}</span>}
                </div>
              </div>
              <div className="flex items-start justify-between gap-2">
                <div className={`flex-1 text-[12px] leading-tight font-semibold break-words ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>{node.label}</div>
                <NodeHealthBadge signals={healthSignals} />
              </div>
              {levelCountText && <div className={`mt-1 text-[10px] leading-tight font-mono ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{levelCountText}</div>}
            </motion.button>
          );
        })}
      </motion.div>

      {/* Technical: bottom dock for zoom controls + camera reset action. */}
      {/* Layman: quick controls to zoom in/out and reset the map view. */}
      <div className="absolute bottom-10 left-0 w-full flex justify-center gap-3 z-30 pointer-events-auto">
        <div className={`flex rounded-full p-1 shadow-xl border backdrop-blur-md ${isDark ? 'bg-slate-900/82 border-slate-700/90' : 'bg-white/90 border-slate-300'}`}>
          <button type="button" onClick={() => { const current = canvasScale.get(); const next = Math.max(current / 1.12, 0.35); canvasScale.set(next); setZoomLevel(next); }} className={`w-10 h-10 flex items-center justify-center text-xl font-semibold ${isDark ? 'text-slate-100 hover:text-white' : 'text-slate-800 hover:text-slate-950'}`}>-</button>
          <div className={`w-[1px] my-2 ${isDark ? 'bg-slate-700' : 'bg-slate-300'}`} />
          <button type="button" onClick={() => { const current = canvasScale.get(); const next = Math.min(current * 1.12, 2.6); canvasScale.set(next); setZoomLevel(next); }} className={`w-10 h-10 flex items-center justify-center text-xl font-semibold ${isDark ? 'text-slate-100 hover:text-white' : 'text-slate-800 hover:text-slate-950'}`}>+</button>
        </div>
        <button type="button" onClick={resetView} className={`font-semibold py-3 px-8 rounded-full shadow-xl border backdrop-blur-md ${isDark ? 'bg-slate-900/82 hover:bg-slate-800 border-slate-700 text-slate-100' : 'bg-white/90 hover:bg-white border-slate-300 text-slate-700'}`}>Reset View</button>
      </div>
    </div>
  );
};
