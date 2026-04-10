/**
 * This file draws the interactive spell-filter tree that branches off the Spells pillar node.
 *
 * When the player opens the Spells pillar on the roadmap canvas, this overlay appears and lets
 * them explore spells by filtering along axes (Class, Level, Casting Time, etc.). Clicking an
 * axis node expands it to show every distinct value for that axis; clicking a value narrows the
 * visible spell count. The tree can be expanded several levels deep (axis → value → sub-axis).
 *
 * Layout is handled entirely by `computeVirtualLayout` (exported for unit testing): it places
 * each virtual node in a depth column, centres sibling groups on their parent, then runs a
 * group-level overlap pass so children from different expanded axes never interleave.
 *
 * Called by: RoadmapVisualizer (renders this component when pillar_spells is expanded)
 * Depends on: axis-engine (builds the filter tree), virtual-node-id (stable IDs),
 *             roadmap utils/constants (shared drawing helpers)
 */
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  BRANCH_WIDTH,
  BRANCH_BASE_DISTANCE,
  BRANCH_COL_DISTANCE,
  BRANCH_ROW_GAP,
  BRANCH_MIN_HEIGHT,
} from '../components/debug/roadmap/constants';
import { buildCurvePath, centerOf } from '../components/debug/roadmap/utils';
import type { RenderNode } from '../components/debug/roadmap/types';
import { computeAxisEngine } from './axis-engine';
import { VSM_COMBINATION_LABELS } from './vsm-tree';
import {
  axisNodeId,
  valueNodeId,
  showSpellsNodeId,
  entryNodeId,
  parseVirtualNodeId,
} from './virtual-node-id';
import type { SpellCanonicalProfile, AxisChoice, AxisId, VirtualNodeDetail } from './types';

// ============================================================================
// Layout types + pure layout function (exported for testing)
// ============================================================================

export interface VirtualLayoutInput {
  nodes: VirtualLayoutInputNode[];
  projectCenterX: number;
  projectCenterY: number;
  side: 1 | -1;
}

export interface VirtualLayoutInputNode {
  id: string;
  depth: number;
  parentId: string;
  label: string;
  hasChildren: boolean;
}

export interface VirtualLayoutNode extends VirtualLayoutInputNode {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Technical: pure layout — assigns x/y to each virtual node using parent-anchored centering.
 * Each group of siblings is centred around their parent's Y, so expanding one branch
 * never shifts its siblings.
 * Layman: places each spell tree card beside its parent; only the expanded branch moves.
 */
export function computeVirtualLayout(input: VirtualLayoutInput): VirtualLayoutNode[] {
  const { nodes, projectCenterX, projectCenterY, side } = input;
  if (nodes.length === 0) return [];

  // Build mutable map and children lookup
  const nodeMap = new Map<string, VirtualLayoutNode>(
    nodes.map((n) => [n.id, { ...n, x: 0, y: 0, width: BRANCH_WIDTH, height: BRANCH_MIN_HEIGHT }])
  );
  const childrenOf = new Map<string, string[]>();
  for (const n of nodes) {
    const list = childrenOf.get(n.parentId) ?? [];
    list.push(n.id);
    childrenOf.set(n.parentId, list);
  }

  // Assign X by depth (column) — unchanged
  for (const n of nodeMap.values()) {
    n.x = Math.round(
      projectCenterX + side * (BRANCH_BASE_DISTANCE + (n.depth - 1) * BRANCH_COL_DISTANCE) - BRANCH_WIDTH / 2
    );
  }

  // Group node IDs by depth once to avoid repeated linear scans below.
  const byDepth = new Map<number, string[]>();
  for (const n of nodes) {
    const list = byDepth.get(n.depth) ?? [];
    list.push(n.id);
    byDepth.set(n.depth, list);
  }

  // Place a group of sibling nodes centred around parentCenterY, then recurse into each.
  // Because every level is independently anchored to its parent, expanding one branch
  // cannot displace its siblings at the same depth.
  function placeGroup(ids: string[], parentCenterY: number): void {
    if (ids.length === 0) return;
    const sorted = [...ids].sort();
    const totalHeight =
      sorted.reduce((sum, id) => sum + (nodeMap.get(id)?.height ?? 0), 0) +
      Math.max(0, sorted.length - 1) * BRANCH_ROW_GAP;
    let cursorY = Math.round(parentCenterY - totalHeight / 2);
    for (const id of sorted) {
      const node = nodeMap.get(id);
      if (!node) continue;
      node.y = cursorY;
      cursorY += node.height + BRANCH_ROW_GAP;
      // Children are centred on this node's vertical midpoint
      placeGroup(childrenOf.get(id) ?? [], node.y + node.height / 2);
    }
  }

  // Push a node and all its descendants down by delta to preserve relative positions.
  function pushSubtree(id: string, delta: number): void {
    const node = nodeMap.get(id);
    if (!node) return;
    node.y += delta;
    for (const childId of childrenOf.get(id) ?? []) pushSubtree(childId, delta);
  }

  // Depth-1 nodes are centred on the spell project node.
  placeGroup(byDepth.get(1) ?? [], projectCenterY);

  // Resolve overlaps depth by depth, treating all children of one parent as a unit.
  // Groups are sorted by parent Y and pushed as whole blocks, so siblings always
  // stay together and children from different parents never interleave.
  // Each parent's children are already entirely at `depth` (tree invariant), so no
  // depth filter is needed when reading from childrenOf.
  const depths = [...byDepth.keys()].sort((a, b) => a - b);
  for (const depth of depths) {
    const parentIds = [...new Set((byDepth.get(depth) ?? []).map((id) => nodeMap.get(id)!.parentId))].sort(
      (a, b) => (nodeMap.get(a)?.y ?? projectCenterY) - (nodeMap.get(b)?.y ?? projectCenterY)
    );
    for (let i = 1; i < parentIds.length; i++) {
      const prevIds = childrenOf.get(parentIds[i - 1]) ?? [];
      const currIds = childrenOf.get(parentIds[i]) ?? [];
      if (prevIds.length === 0 || currIds.length === 0) continue;
      const prevBottom = Math.max(...prevIds.map((id) => { const n = nodeMap.get(id)!; return n.y + n.height; }));
      const currTop    = Math.min(...currIds.map((id) => { const n = nodeMap.get(id)!; return n.y; }));
      const gap = prevBottom + BRANCH_ROW_GAP - currTop;
      if (gap > 0) {
        for (const id of currIds) pushSubtree(id, gap);
      }
    }
  }

  return Array.from(nodeMap.values());
}

// ============================================================================
// Label helpers
// ============================================================================
function axisValueLabel(axisId: AxisId, value: string): string {
  if (axisId === 'level') return value === '0' ? 'Cantrip' : `Level ${value}`;
  if (axisId === 'requirements') {
    return VSM_COMBINATION_LABELS[value as keyof typeof VSM_COMBINATION_LABELS] ?? value;
  }
  return value;
}

// ============================================================================
// Props
// ============================================================================
export interface SpellGraphOverlayProps {
  spellsProjectNode: RenderNode;
  side: 1 | -1;
  isDark: boolean;
  selectedVirtualId: string | null;
  onVirtualNodeSelect: (id: string, detail: VirtualNodeDetail) => void;
  onOpenSpellBranch: (choices: AxisChoice[]) => void;
  canvasOffset: number;
}

// ============================================================================
// Main component
// ============================================================================
export function SpellGraphOverlay({
  spellsProjectNode,
  side,
  isDark,
  selectedVirtualId,
  onVirtualNodeSelect,
  onOpenSpellBranch,
  canvasOffset,
}: SpellGraphOverlayProps) {
  const [spells, setSpells] = useState<SpellCanonicalProfile[]>([]);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // Load spell profiles once on mount
  useEffect(() => {
    fetch('/Aralia/api/roadmap/spell-profiles')
      .then((r) => r.json())
      .then((data: SpellCanonicalProfile[]) => setSpells(data))
      .catch(() => {
        // Silent — overlay degrades gracefully if profiles fail to load
      });
  }, []);

  const projectCenter = centerOf(spellsProjectNode);

  const toggleVirtualNode = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // ---- Build the flat visible virtual node list ----
  // Technical: recursive walk — each open value node expands to Show Spells + remaining axes ad infinitum.
  // Layman: drill as deep as you like; every value pick reveals another layer of axes.
  const virtualNodes = useMemo((): VirtualLayoutInputNode[] => {
    if (spells.length === 0) return [];
    const result: VirtualLayoutInputNode[] = [];
    const MAX_DEPTH = 14; // safety cap — 11 axes × 2 levels each + Show Spells headroom

    // Called whenever a value node is open. Emits Show Spells + remaining axes + their values,
    // then recurses for any open deeper value.
    function buildChildren(parentId: string, choices: AxisChoice[], depth: number): void {
      if (depth > MAX_DEPTH) return;
      const { filteredSpells, availableAxes, spellCount } = computeAxisEngine(spells, choices);

      // Show Spells node
      const showId = showSpellsNodeId(choices);
      const isShowOpen = expandedIds.has(showId);
      result.push({ id: showId, depth, parentId, label: `Show Spells (${spellCount})`, hasChildren: spellCount > 0 });
      if (isShowOpen) {
        for (const spell of filteredSpells) {
          result.push({ id: entryNodeId(choices, spell.id), depth: depth + 1, parentId: showId, label: spell.name, hasChildren: false });
        }
      }

      // Remaining discriminating axes
      for (const axis of availableAxes) {
        const axId = axisNodeId(axis.axisId, choices);
        const isAxOpen = expandedIds.has(axId);
        result.push({ id: axId, depth, parentId, label: axis.label, hasChildren: true });
        if (!isAxOpen) continue;

        for (const val of axis.values) {
          const deepChoices: AxisChoice[] = [...choices, { axisId: axis.axisId, value: val.value }];
          const deepValueId = valueNodeId(deepChoices);
          const isDeepOpen = expandedIds.has(deepValueId);
          result.push({
            id: deepValueId, depth: depth + 1, parentId: axId,
            label: `${axisValueLabel(axis.axisId, val.value)} [${val.count}]`,
            hasChildren: true,
          });
          if (isDeepOpen) buildChildren(deepValueId, deepChoices, depth + 2);
        }
      }
    }

    // Depth 1: top-level axis nodes (always visible when Spells is expanded)
    const topResult = computeAxisEngine(spells, []);
    for (const axis of topResult.availableAxes) {
      const id = axisNodeId(axis.axisId);
      const isOpen = expandedIds.has(id);
      result.push({ id, depth: 1, parentId: 'pillar_spells', label: axis.label, hasChildren: true });
      if (!isOpen) continue;

      // Depth 2: value nodes for this axis
      for (const val of axis.values) {
        const choices: AxisChoice[] = [{ axisId: axis.axisId, value: val.value }];
        const valueId = valueNodeId(choices);
        const isValueOpen = expandedIds.has(valueId);
        result.push({
          id: valueId, depth: 2, parentId: id,
          label: `${axisValueLabel(axis.axisId, val.value)} [${val.count}]`,
          hasChildren: true,
        });
        if (isValueOpen) buildChildren(valueId, choices, 3);
      }
    }

    return result;
  }, [spells, expandedIds]);

  // Compute layout positions
  const laid = useMemo(
    () => computeVirtualLayout({ nodes: virtualNodes, projectCenterX: projectCenter.x, projectCenterY: projectCenter.y, side }),
    [virtualNodes, projectCenter.x, projectCenter.y, side]
  );

  const laidById = useMemo(() => new Map(laid.map((n) => [n.id, n])), [laid]);

  // ---- Detail builder ----
  const buildDetail = useCallback(
    (id: string): VirtualNodeDetail | null => {
      const parsed = parseVirtualNodeId(id);
      if (!parsed) return null;
      const { choices } = parsed;
      const engineResult = computeAxisEngine(spells, choices);

      if (parsed.kind === 'axis') {
        const axisState = engineResult.availableAxes.find((a) => a.axisId === parsed.axisId);
        return {
          id,
          kind: 'axis',
          label: axisState?.label ?? parsed.axisId,
          spellCount: engineResult.spellCount,
          choices,
        };
      }
      if (parsed.kind === 'value') {
        const laidNode = laidById.get(id);
        return {
          id,
          kind: 'value',
          label: laidNode?.label ?? id,
          spellCount: engineResult.spellCount,
          choices,
        };
      }
      if (parsed.kind === 'show-spells') {
        return {
          id,
          kind: 'show-spells',
          label: 'Show Spells',
          spellCount: engineResult.spellCount,
          choices,
        };
      }
      if (parsed.kind === 'entry') {
        const profile = spells.find((s) => s.id === parsed.spellId);
        return {
          id,
          kind: 'entry',
          label: profile?.name ?? parsed.spellId,
          spellCount: 1,
          choices,
          spellProfile: profile,
        };
      }
      return null;
    },
    [spells, laidById]
  );

  const handleVirtualClick = useCallback(
    (id: string, hasChildren: boolean) => {
      if (hasChildren) toggleVirtualNode(id);
      const detail = buildDetail(id);
      if (detail) onVirtualNodeSelect(id, detail);
    },
    [toggleVirtualNode, buildDetail, onVirtualNodeSelect]
  );

  // ---- SVG Edges ----
  // Each edge records its path and both endpoint coordinates so the dot-cap layer
  // (rendered above buttons) can place a small filled circle right at the node border.
  const edges = useMemo(() => {
    const result: Array<{ id: string; path: string; sx: number; sy: number; ex: number; ey: number }> = [];
    for (const node of laid) {
      const parentLaid = laidById.get(node.parentId);
      const parentNode: Pick<RenderNode, 'x' | 'y' | 'width' | 'height'> | null = parentLaid
        ? { x: parentLaid.x, y: parentLaid.y, width: parentLaid.width, height: parentLaid.height }
        : node.depth === 1
          ? { x: spellsProjectNode.x, y: spellsProjectNode.y, width: spellsProjectNode.width, height: spellsProjectNode.height }
          : null;
      if (!parentNode) continue;

      const pCenter = centerOf(parentNode as RenderNode);
      const nCenter = centerOf({ x: node.x, y: node.y, width: node.width, height: node.height } as RenderNode);
      const edgeSide: 1 | -1 = nCenter.x >= pCenter.x ? 1 : -1;
      const startX = pCenter.x + edgeSide * (parentNode.width / 2);
      const endX = nCenter.x - edgeSide * (node.width / 2);

      result.push({
        id: `virt-edge-${node.id}`,
        path: buildCurvePath(startX, pCenter.y, endX, nCenter.y, edgeSide),
        sx: startX, sy: pCenter.y,
        ex: endX,   ey: nCenter.y,
      });
    }
    return result;
  }, [laid, laidById, spellsProjectNode]);

  if (laid.length === 0) return null;

  return (
    <>
      {/* SVG edge layer — shares the canvas coordinate space */}
      <svg
        className="absolute pointer-events-none"
        style={{
          left: -canvasOffset,
          top: -canvasOffset,
          width: canvasOffset * 2,
          height: canvasOffset * 2,
          overflow: 'visible',
        }}
      >
        <g transform={`translate(${canvasOffset} ${canvasOffset})`}>
          {edges.map((edge) => (
            <path
              key={edge.id}
              d={edge.path}
              fill="none"
              stroke={isDark ? '#a78bfa' : '#7c3aed'}
              strokeWidth={1.8}
              strokeLinecap="round"
              opacity={0.7}
            />
          ))}
        </g>
      </svg>

      {/* Node layer — absolutely positioned on the canvas */}
      {laid.map((node) => {
        const isSelected = selectedVirtualId === node.id;
        const isShow = node.id.endsWith(':show');
        const isEntry = node.id.includes(':entry:');
        return (
          <button
            key={node.id}
            type="button"
            onClick={() => handleVirtualClick(node.id, node.hasChildren)}
            style={{ left: node.x, top: node.y, width: node.width, height: node.height, position: 'absolute' }}
            className={`rounded-xl border text-left px-3 py-2 text-xs shadow-sm transition-colors pointer-events-auto ${
              isSelected
                ? isDark
                  ? 'border-violet-400 bg-violet-900/60 text-violet-100 ring-1 ring-violet-400/40'
                  : 'border-violet-500 bg-violet-50 text-violet-900'
                : isShow
                  ? isDark
                    ? 'border-violet-500/70 bg-violet-950/60 text-violet-200 hover:bg-violet-900/60'
                    : 'border-violet-400 bg-violet-50 text-violet-800 hover:bg-violet-100'
                  : isEntry
                    ? isDark
                      ? 'border-slate-600/50 bg-slate-900/50 text-slate-300 hover:bg-slate-800/60'
                      : 'border-slate-300 bg-white/80 text-slate-700 hover:bg-slate-50'
                    : isDark
                      ? 'border-violet-700/60 bg-[#1a1030cc] text-violet-100 hover:bg-violet-900/40 backdrop-blur-md'
                      : 'border-violet-300 bg-white text-violet-900 hover:bg-violet-50'
            }`}
          >
            <span className="font-semibold leading-tight line-clamp-2">{node.label}</span>
            {node.hasChildren && (
              <span className="block text-[10px] mt-0.5 opacity-60">
                {expandedIds.has(node.id) ? '▾ expanded' : '▸ expand'}
              </span>
            )}
          </button>
        );
      })}

      {/* Dot-cap layer — renders above buttons so connection dots are visible on node borders */}
      <svg
        className="absolute pointer-events-none"
        style={{
          left: -canvasOffset,
          top: -canvasOffset,
          width: canvasOffset * 2,
          height: canvasOffset * 2,
          overflow: 'visible',
        }}
      >
        <g transform={`translate(${canvasOffset} ${canvasOffset})`}>
          {edges.map((edge) => (
            <React.Fragment key={`cap-${edge.id}`}>
              <circle cx={edge.sx} cy={edge.sy} r={3} fill={isDark ? '#a78bfa' : '#7c3aed'} opacity={0.85} />
              <circle cx={edge.ex} cy={edge.ey} r={3} fill={isDark ? '#a78bfa' : '#7c3aed'} opacity={0.85} />
            </React.Fragment>
          ))}
        </g>
      </svg>
    </>
  );
}
