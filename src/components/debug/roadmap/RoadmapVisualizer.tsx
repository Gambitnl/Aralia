// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 * 
 * Last Sync: 21/02/2026, 10:24:07
 * Dependents: RoadmapVisualizer.tsx
 * Imports: 4 files
 * 
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx scripts/codebase-visualizer-server.ts --sync [this-file-path]
 * See scripts/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, useMotionValue } from 'framer-motion';
import { GRID_SIZE, THEME_STORAGE_KEY, nextThemeMode } from './constants';
import { buildRenderGraph } from './graph';
import type { RenderNode, RoadmapData, ThemeMode } from './types';
import { formatLevelCounts } from './utils';

type LayoutPositions = Record<string, { x: number; y: number }>;
type LayoutSaveState = 'idle' | 'saving' | 'saved' | 'error';

const snapToGrid = (value: number) => Math.round(value / GRID_SIZE) * GRID_SIZE;

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

const glassButtonClass = (isDark: boolean) =>
  isDark
    ? 'bg-slate-900/70 border-cyan-500/30 text-slate-100 hover:bg-slate-800/90 hover:border-cyan-400/60'
    : 'bg-white/80 border-slate-300 text-slate-700 hover:bg-white';

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

const CANVAS_MIN = -12000;
const CANVAS_SIZE = 32000;
const CANVAS_OFFSET = -CANVAS_MIN;

export const RoadmapVisualizer: React.FC = () => {
  const [data, setData] = useState<RoadmapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [expandedNodeIds, setExpandedNodeIds] = useState<Set<string>>(new Set());
  const [zoomLevel, setZoomLevel] = useState(1);
  const [themeMode, setThemeMode] = useState<ThemeMode>('dark');
  const [showCrosslinks, setShowCrosslinks] = useState(true);
  const [positionOverrides, setPositionOverrides] = useState<LayoutPositions>({});
  const [layoutDirty, setLayoutDirty] = useState(false);
  const [layoutSaveState, setLayoutSaveState] = useState<LayoutSaveState>('idle');
  const [vscodeStatus, setVscodeStatus] = useState<string | null>(null);
  const [isCanvasDragging, setIsCanvasDragging] = useState(false);

  const dragWasMovementRef = useRef(false);
  const canvasPanX = useMotionValue(0);
  const canvasPanY = useMotionValue(0);
  const canvasScale = useMotionValue(1);
  const isDark = themeMode === 'dark';

  const positionOverrideMap = useMemo(
    () => new Map(Object.entries(positionOverrides).map(([id, pos]) => [id, pos])),
    [positionOverrides]
  );

  useEffect(() => {
    try {
      const saved = localStorage.getItem(THEME_STORAGE_KEY) as ThemeMode | null;
      if (saved === 'dark' || saved === 'light') setThemeMode(saved);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, themeMode);
    } catch {
      // ignore
    }
  }, [themeMode]);

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

  const graph = useMemo(() => {
    if (!data) return null;
    return buildRenderGraph(data, expandedNodeIds, positionOverrideMap);
  }, [data, expandedNodeIds, positionOverrideMap]);

  const nodeById = useMemo(() => {
    const map = new Map<string, RenderNode>();
    if (!graph) return map;
    for (const node of graph.nodes) map.set(node.id, node);
    return map;
  }, [graph]);

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

  const selectedDetail = selectedNodeId && graph ? graph.detailById.get(selectedNodeId) || null : null;
  const visibleEdges = useMemo(
    () => (graph ? (showCrosslinks ? graph.edges : graph.edges.filter((edge) => !edge.dashed)) : []),
    [graph, showCrosslinks]
  );

  const toggleNode = (nodeId: string) => {
    setExpandedNodeIds((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  };

  const collectDragBranch = (rootId: string) => {
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
    if (event.button !== 0) return;
    if (!nodeById.has(nodeId)) return;
    event.preventDefault();
    event.stopPropagation();
    dragWasMovementRef.current = false;

    const dragIds = collectDragBranch(nodeId);
    let lastX = event.clientX;
    let lastY = event.clientY;

    const onMove = (moveEvent: MouseEvent | PointerEvent) => {
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
    if (dragWasMovementRef.current) {
      dragWasMovementRef.current = false;
      return;
    }
    if (expandable) toggleNode(nodeId);
    setSelectedNodeId(nodeId);
  };

  const saveLayout = async () => {
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
  };

  const resetNodePositions = () => {
    setPositionOverrides({});
    setLayoutDirty(true);
    setLayoutSaveState('idle');
  };

  const openInVSCode = async (docPath: string) => {
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

  const handleWheelZoomCapture = (event: React.WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    const currentScale = canvasScale.get();
    const factor = event.deltaY < 0 ? 1.12 : 1 / 1.12;
    const nextScale = Math.min(Math.max(currentScale * factor, 0.35), 2.6);
    if (Math.abs(nextScale - currentScale) < 0.00001) return;
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

  const startCanvasDrag = (event: React.MouseEvent<HTMLDivElement>) => {
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

  const expandAll = () => graph && setExpandedNodeIds(new Set(graph.expandableIds));
  const collapseAll = () => setExpandedNodeIds(new Set());
  const resetView = () => {
    canvasPanX.set(0);
    canvasPanY.set(0);
    canvasScale.set(1);
    setZoomLevel(1);
  };

  if (loading) return <div className={`w-full h-screen flex items-center justify-center text-2xl animate-pulse ${isDark ? 'bg-[#050810] text-slate-300' : 'bg-slate-100 text-slate-600'}`}>Rendering roadmap...</div>;
  if (error || !graph) return <div className={`w-full h-screen flex items-center justify-center ${isDark ? 'bg-[#050810] text-red-400' : 'bg-slate-100 text-red-600'}`}>{error || 'Data Error'}</div>;

  const progressTotal = graph.stats.done + graph.stats.active + graph.stats.planned;
  const progressPercent = progressTotal > 0 ? Math.round((graph.stats.done / progressTotal) * 100) : 0;

  return (
    <div onWheelCapture={handleWheelZoomCapture} className={`relative w-full h-screen overflow-hidden select-none ${isDark ? 'bg-[#050810] text-slate-100' : 'bg-slate-100 text-slate-800'}`}>
      <div className="absolute top-5 left-0 w-full text-center z-30 pointer-events-none">
        <h1 className={`text-4xl font-semibold tracking-tight ${isDark ? 'text-slate-50' : 'text-slate-800'}`}>Aralia Feature Roadmap</h1>
        <p className={`text-xs uppercase tracking-[0.3em] mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Interactive Feature Tree</p>
      </div>

      <div className="absolute top-6 left-6 z-30 pointer-events-auto flex gap-2 flex-wrap max-w-[840px]">
        <button type="button" onClick={expandAll} className={`rounded-lg px-4 py-2 text-xs font-semibold border backdrop-blur-md transition-colors ${glassButtonClass(isDark)}`}>Expand All</button>
        <button type="button" onClick={collapseAll} className={`rounded-lg px-4 py-2 text-xs font-semibold border backdrop-blur-md transition-colors ${glassButtonClass(isDark)}`}>Collapse All</button>
        <button type="button" onClick={() => setShowCrosslinks((prev) => !prev)} className={`rounded-lg px-4 py-2 text-xs font-semibold border backdrop-blur-md transition-colors ${glassButtonClass(isDark)}`}>Crosslinks: {showCrosslinks ? 'On' : 'Off'}</button>
        <button type="button" onClick={saveLayout} className={`rounded-lg px-4 py-2 text-xs font-semibold border backdrop-blur-md transition-colors ${layoutDirty ? (isDark ? 'bg-amber-900/60 border-amber-400/70 text-amber-100 hover:bg-amber-800/70' : 'bg-amber-50 border-amber-400 text-amber-700 hover:bg-amber-100') : glassButtonClass(isDark)}`}>Save Layout</button>
        <button type="button" onClick={resetNodePositions} className={`rounded-lg px-4 py-2 text-xs font-semibold border backdrop-blur-md transition-colors ${glassButtonClass(isDark)}`}>Reset Node Positions</button>
        <button type="button" onClick={() => setThemeMode((prev) => nextThemeMode(prev))} className={`rounded-lg px-4 py-2 text-xs font-semibold border backdrop-blur-md transition-colors ${glassButtonClass(isDark)}`}>Theme: {isDark ? 'Dark' : 'Light'}</button>
      </div>

      <div className="absolute top-[76px] left-6 z-30 pointer-events-none">
        <div className={`text-[10px] uppercase tracking-[0.18em] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
          Layout {layoutSaveState === 'saving' ? 'saving...' : layoutSaveState === 'saved' ? 'saved' : layoutSaveState === 'error' ? 'error' : layoutDirty ? 'unsaved' : 'synced'}
        </div>
      </div>

      <div className="absolute top-6 right-6 z-30 pointer-events-none">
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

      {selectedDetail && (
        <motion.aside
          initial={{ x: -420, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          className={`absolute left-6 top-[112px] max-h-[calc(100vh-140px)] overflow-y-auto w-[410px] z-40 rounded-xl p-6 shadow-2xl pointer-events-auto border-l-4 ${
            isDark
              ? 'bg-[#0f121cdc] border-l-amber-500 border border-slate-700/80 backdrop-blur-md'
              : 'bg-white/96 border-l-amber-500 border border-slate-300'
          }`}
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
                {selectedDetail.docs.map((doc) => (
                  <div key={doc.sourcePath} className={`w-full rounded border p-2 ${isDark ? 'border-slate-700 bg-slate-900/70' : 'border-slate-200 bg-slate-100'}`}>
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
                ))}
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
      )}

      <button
        type="button"
        aria-label="Pan roadmap canvas"
        onMouseDown={startCanvasDrag}
        className={`absolute inset-0 z-10 pointer-events-auto select-none ${isCanvasDragging ? 'cursor-grabbing' : 'cursor-move'}`}
      />

      <motion.div style={{ x: canvasPanX, y: canvasPanY, scale: canvasScale }} className="absolute inset-0 origin-top-left z-20 pointer-events-none">
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
            {visibleEdges.map((edge) => (
              <path
                key={edge.id}
                d={edge.path}
                fill="none"
                stroke={isDark ? (edge.dashed ? '#94a3b8' : edge.width > 2.2 ? '#22d3ee' : '#3b82f6') : edge.color}
                strokeWidth={edge.width}
                strokeDasharray={edge.dashed ? '5 7' : undefined}
                strokeLinecap="round"
                strokeLinejoin="round"
                filter={`url(#${edge.width > 2.2 ? 'roadmap-edge-glow-cyan' : 'roadmap-edge-glow-blue'})`}
                opacity={edge.dashed ? 0.55 : 0.74}
              />
            ))}
          </g>
        </svg>

        {graph.nodes.map((node) => {
          if (node.kind === 'root') {
            return (
              <motion.button
                key={node.id}
                type="button"
                data-node-id={node.id}
                data-node-kind={node.kind}
                style={{ left: node.x, top: node.y, width: node.width, height: node.height, position: 'absolute' }}
                onMouseDown={(event) => onNodePointerDown(event, node.id)}
                onClick={() => onNodeClick(node.id, false)}
                className={`rounded-full border-2 text-white shadow-xl flex items-center justify-center text-center px-4 pointer-events-auto transition-colors ${
                  isDark
                    ? 'border-cyan-300/80 bg-blue-600 hover:bg-blue-500'
                    : 'border-blue-500 bg-blue-500 hover:bg-blue-600'
                }`}
              >
                <span className="text-sm font-semibold leading-tight">{node.label}</span>
              </motion.button>
            );
          }

          if (node.kind === 'project') {
            const isExpanded = Boolean(node.expanded);
            const levelCountText = formatLevelCounts(node.descendantLevelCounts ?? []);
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
                  isDark
                    ? isExpanded
                      ? 'bg-blue-600 border-cyan-300/80'
                      : 'bg-blue-500 border-blue-300/70 hover:bg-blue-600'
                    : isExpanded
                      ? 'bg-blue-600 border-blue-500'
                      : 'bg-blue-500 border-blue-400 hover:bg-blue-600'
                }`}
              >
                <div className="text-[10px] uppercase tracking-[0.12em] opacity-90">Feature</div>
                <div className="text-[12px] font-semibold leading-tight mt-0.5">{node.label}</div>
                <div className="text-[10px] mt-1 opacity-90">{isExpanded ? 'Open' : 'Closed'}</div>
                {levelCountText && <div className="text-[9px] mt-0.5 leading-tight opacity-90">{levelCountText}</div>}
              </motion.button>
            );
          }

          const isExpandable = Boolean(node.hasChildren);
          const isExpanded = Boolean(node.expanded);
          const levelCountText = formatLevelCounts(node.descendantLevelCounts ?? []);

          return (
            <motion.button
              key={node.id}
              type="button"
              data-node-id={node.id}
              data-node-kind={node.kind}
              data-parent-id={node.parentId || ''}
              data-project-id={node.projectId || ''}
              style={{ left: node.x, top: node.y, width: node.width, height: node.height, position: 'absolute' }}
              onMouseDown={(event) => onNodePointerDown(event, node.id)}
              onClick={() => onNodeClick(node.id, isExpandable)}
              className={`pointer-events-auto rounded-xl border text-left px-3 py-2 shadow-sm transition-colors overflow-hidden ${
                isDark
                  ? 'border-slate-700 bg-[#111a2bcc] hover:bg-[#1a2740d8] backdrop-blur-md'
                  : 'border-slate-300 bg-white hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className={`text-[10px] uppercase border rounded-full px-1.5 py-0.5 font-semibold ${statusChipClass(node.status, isDark)}`}>{node.status}</span>
                <div className="flex items-center gap-1.5">
                  {typeof node.depth === 'number' && <span className={`text-[10px] uppercase tracking-[0.08em] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>L{node.depth}</span>}
                  {isExpandable && <span className={`text-[10px] uppercase tracking-[0.08em] font-semibold ${isDark ? 'text-cyan-300' : 'text-blue-700'}`}>{isExpanded ? '-' : '+'}</span>}
                </div>
              </div>
              <div className={`text-[12px] leading-tight font-semibold break-words ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>{node.label}</div>
              {levelCountText && <div className={`mt-1 text-[10px] leading-tight font-mono ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{levelCountText}</div>}
            </motion.button>
          );
        })}
      </motion.div>

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
