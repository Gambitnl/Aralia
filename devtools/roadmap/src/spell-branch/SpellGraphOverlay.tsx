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
 * Technical: pure layout — assigns x/y to each virtual node using depth-column × leaf-cursor.
 * Layman: places each spell tree card in a column grid; parents centre on their children.
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

  // Assign X by depth (column)
  for (const n of nodeMap.values()) {
    n.x = Math.round(
      projectCenterX + side * (BRANCH_BASE_DISTANCE + (n.depth - 1) * BRANCH_COL_DISTANCE) - BRANCH_WIDTH / 2
    );
  }

  // Count leaves to centre the tree on the project node
  const leafCount = nodes.filter(
    (n) => (childrenOf.get(n.id) ?? []).length === 0
  ).length || 1;
  const totalHeight = leafCount * BRANCH_MIN_HEIGHT + Math.max(0, leafCount - 1) * BRANCH_ROW_GAP;
  let leafCursorY = projectCenterY - totalHeight / 2;

  const visited = new Set<string>();

  function assignY(id: string): { minY: number; maxY: number } {
    if (visited.has(id)) return { minY: 0, maxY: 0 };
    visited.add(id);
    const node = nodeMap.get(id);
    if (!node) return { minY: 0, maxY: 0 };
    const children = (childrenOf.get(id) ?? []).sort();
    if (children.length === 0) {
      node.y = leafCursorY;
      leafCursorY += node.height + BRANCH_ROW_GAP;
      return { minY: node.y, maxY: node.y + node.height };
    }
    let minY = Infinity;
    let maxY = -Infinity;
    for (const childId of children) {
      const range = assignY(childId);
      minY = Math.min(minY, range.minY);
      maxY = Math.max(maxY, range.maxY);
    }
    node.y = Math.round((minY + maxY) / 2 - node.height / 2);
    return { minY: node.y, maxY: node.y + node.height };
  }

  // Walk depth-1 nodes in sorted order
  const depth1Ids = nodes.filter((n) => n.depth === 1).map((n) => n.id).sort();
  for (const id of depth1Ids) assignY(id);

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
  // Technical: each expanded virtual node contributes its children to the list.
  // Layman: walk open nodes and compute what children to show at each level.
  const virtualNodes = useMemo((): VirtualLayoutInputNode[] => {
    if (spells.length === 0) return [];
    const result: VirtualLayoutInputNode[] = [];

    // Depth 1: top-level axis nodes (always visible — caller only renders when Spells is expanded)
    const topResult = computeAxisEngine(spells, []);
    for (const axis of topResult.availableAxes) {
      const id = axisNodeId(axis.axisId);
      const isOpen = expandedIds.has(id);
      result.push({ id, depth: 1, parentId: 'pillar_spells', label: axis.label, hasChildren: true });

      if (!isOpen) continue;

      // Depth 2: value nodes under the open axis
      for (const val of axis.values) {
        const choices: AxisChoice[] = [{ axisId: axis.axisId, value: val.value }];
        const valueId = valueNodeId(choices);
        const isValueOpen = expandedIds.has(valueId);
        result.push({
          id: valueId,
          depth: 2,
          parentId: id,
          label: `${axisValueLabel(axis.axisId, val.value)} [${val.count}]`,
          hasChildren: true,
        });

        if (!isValueOpen) continue;

        const afterResult = computeAxisEngine(spells, choices);

        // Depth 3a: Show Spells node
        const showId = showSpellsNodeId(choices);
        const isShowOpen = expandedIds.has(showId);
        result.push({
          id: showId,
          depth: 3,
          parentId: valueId,
          label: `Show Spells (${afterResult.spellCount})`,
          hasChildren: afterResult.spellCount > 0,
        });

        if (isShowOpen) {
          // Depth 4: spell entry nodes
          for (const spell of afterResult.filteredSpells) {
            result.push({
              id: entryNodeId(choices, spell.id),
              depth: 4,
              parentId: showId,
              label: spell.name,
              hasChildren: false,
            });
          }
        }

        // Depth 3b: remaining discriminating axes
        for (const remainAxis of afterResult.availableAxes) {
          const axId = axisNodeId(remainAxis.axisId, choices);
          const isAxOpen = expandedIds.has(axId);
          result.push({
            id: axId,
            depth: 3,
            parentId: valueId,
            label: remainAxis.label,
            hasChildren: true,
          });

          if (!isAxOpen) continue;

          // Depth 4: values for the remaining axis
          for (const rv of remainAxis.values) {
            const deepChoices: AxisChoice[] = [...choices, { axisId: remainAxis.axisId, value: rv.value }];
            const deepValueId = valueNodeId(deepChoices);
            const isDeepOpen = expandedIds.has(deepValueId);
            result.push({
              id: deepValueId,
              depth: 4,
              parentId: axId,
              label: `${axisValueLabel(remainAxis.axisId, rv.value)} [${rv.count}]`,
              hasChildren: true,
            });

            if (!isDeepOpen) continue;

            const deepResult = computeAxisEngine(spells, deepChoices);
            const deepShowId = showSpellsNodeId(deepChoices);
            const isDeepShowOpen = expandedIds.has(deepShowId);
            result.push({
              id: deepShowId,
              depth: 5,
              parentId: deepValueId,
              label: `Show Spells (${deepResult.spellCount})`,
              hasChildren: deepResult.spellCount > 0,
            });

            if (isDeepShowOpen) {
              for (const spell of deepResult.filteredSpells) {
                result.push({
                  id: entryNodeId(deepChoices, spell.id),
                  depth: 6,
                  parentId: deepShowId,
                  label: spell.name,
                  hasChildren: false,
                });
              }
            }
          }
        }
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
  const edges = useMemo(() => {
    const result: Array<{ id: string; path: string }> = [];
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
      const startX = pCenter.x + edgeSide * (parentNode.width / 2 - 3);
      const endX = nCenter.x - edgeSide * (node.width / 2 - 3);

      result.push({
        id: `virt-edge-${node.id}`,
        path: buildCurvePath(startX, pCenter.y, endX, nCenter.y, edgeSide),
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
    </>
  );
}
