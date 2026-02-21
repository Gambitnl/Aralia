// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 * 
 * Last Sync: 21/02/2026, 18:13:29
 * Dependents: RoadmapVisualizer.tsx
 * Imports: 4 files
 * 
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx scripts/codebase-visualizer-server.ts --sync [this-file-path]
 * See scripts/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import {
  BRANCH_WIDTH,
  BRANCH_BASE_DISTANCE,
  BRANCH_COL_DISTANCE,
  BRANCH_ROW_GAP,
  PROJECT_SIZE,
  ROOT_SIZE,
  ROOT_Y,
  TRUNK_X
} from './constants';
import { buildProjectTrees } from './tree';
import type { DetailEntry, RenderEdge, RenderGraph, RenderNode, RoadmapData, RoadmapNode, TreeNode } from './types';
import {
  buildCurvePath,
  centerOf,
  collectDescendantDepthCounts,
  collectProjectDepthCounts,
  collectRelatedDocs,
  compareNodes,
  estimateBranchHeight,
  snapToGrid,
  toLevelCountArray
} from './utils';

/**
 * Technical:
 * This module transforms canonical roadmap data into a render graph (RenderNode + RenderEdge),
 * including resolved positions, connector paths, detail payloads, and expandability metadata.
 *
 * Layman:
 * This file is the roadmap screen arranger. It decides what cards show up, where they sit,
 * which lines connect them, and what info appears when you click a card.
 */
type PositionOverrideMap = Map<string, { x: number; y: number }>;

// Technical: identifies links whose endpoints are effectively on one horizontal level.
// Layman: catches "visually flat" connectors that are prone to glow-filter render glitches.
const isNearlyFlatEdge = (startY: number, endY: number) => Math.abs(startY - endY) < 0.5;

// ============================================================================
// Position Helper
// ============================================================================
// Technical: resolves a node's active position from user overrides with safe fallbacks.
// Layman: if you moved a card before, use that saved spot; otherwise use auto layout.
// ============================================================================
const getNodePosition = (id: string, fallbackX: number, fallbackY: number, overrides?: PositionOverrideMap) => {
  const override = overrides?.get(id);
  if (!override) return { x: fallbackX, y: fallbackY };
  return {
    x: Number.isFinite(override.x) ? override.x : fallbackX,
    y: Number.isFinite(override.y) ? override.y : fallbackY
  };
};

// ============================================================================
// Crosslink Doc Helpers
// ============================================================================
// Technical: normalizes doc paths so overlap checks are stable and case-insensitive.
// Layman: if two cards mention the same docs, we can draw a dotted "related" line.
// ============================================================================
const docsToKeySet = (entry: DetailEntry | undefined) =>
  new Set(
    (entry?.docs ?? [])
      .map((doc) => (doc.canonicalPath || doc.sourcePath || '').trim().toLowerCase())
      .filter(Boolean)
  );

const hasAnyDocOverlap = (a: Set<string>, b: Set<string>) => {
  if (a.size === 0 || b.size === 0) return false;
  for (const value of a) {
    if (b.has(value)) return true;
  }
  return false;
};

// ============================================================================
// Cross Edge Helper
// ============================================================================
// Technical: appends a deduplicated dashed relationship edge between two visible nodes.
// Layman: draws the thinner dotted "also related to" line (not the main tree line).
// ============================================================================
const addCrossEdge = (
  renderEdges: RenderEdge[],
  dedupe: Set<string>,
  edgeId: string,
  from: RenderNode,
  to: RenderNode
) => {
  if (from.id === to.id) return;
  if (dedupe.has(edgeId)) return;
  dedupe.add(edgeId);

  const start = centerOf(from);
  const end = centerOf(to);
  const side: 1 | -1 = end.x >= start.x ? 1 : -1;
  const flat = isNearlyFlatEdge(start.y, end.y);

  const startX = start.x + side * (from.width / 2 - 3);
  const endX = end.x - side * (to.width / 2 - 3);

  renderEdges.push({
    id: edgeId,
    path: buildCurvePath(startX, start.y, endX, end.y, side),
    color: '#94a3b8',
    width: 1.2,
    flat,
    dashed: true
  });
};

// ============================================================================
// Main Graph Build
// ============================================================================
// Technical: buildRenderGraph is the pure transform from data + UI state to render state.
// Layman: this is the main assembly line for what you currently see on the roadmap.
// ============================================================================
export const buildRenderGraph = (
  data: RoadmapData,
  expandedNodeIds: Set<string>,
  positionOverrides?: PositionOverrideMap
): RenderGraph => {
  // Technical: root + project nodes are the anchor layer for the full tree layout.
  // Layman: the top node and big feature nodes are the backbone for everything else.
  const rootNode = data.nodes.find((node) => node.type === 'root');
  const projectNodes = data.nodes
    .filter((node) => node.type === 'project')
    .sort((a, b) => a.initialY - b.initialY || a.initialX - b.initialX || compareNodes(a, b));
  const trees = buildProjectTrees(data, projectNodes);

  // Technical: these collections become the final render payload.
  // Layman: these are the lists/maps the UI uses to draw nodes, lines, and details.
  const renderNodes: RenderNode[] = [];
  const renderEdges: RenderEdge[] = [];
  const detailById = new Map<string, DetailEntry>();
  const expandableIds = new Set<string>();
  const milestoneToRenderNodeId = new Map<string, string>();

  const rootBaseX = snapToGrid(TRUNK_X - ROOT_SIZE / 2);
  const rootBaseY = snapToGrid(ROOT_Y);
  const rootPos = getNodePosition(rootNode?.id || 'aralia_chronicles', rootBaseX, rootBaseY, positionOverrides);
  // Technical: root expansion state gates project/branch node materialization.
  // Layman: the top "Aralia Game Roadmap" bubble is a real open/close switch.
  const rootHasChildren = projectNodes.length > 0;
  const rootExpanded = rootHasChildren ? expandedNodeIds.has(rootNode?.id || 'aralia_chronicles') : false;

  // Technical: root render node is unconditional; deeper layers are conditional.
  // Layman: we always show the top bubble first, then reveal lower layers when opened.
  const rootRender: RenderNode = {
    id: rootNode?.id || 'aralia_chronicles',
    kind: 'root',
    label: rootNode?.label || 'Aralia Game Roadmap',
    status: rootNode?.status || 'active',
    x: rootPos.x,
    y: rootPos.y,
    width: ROOT_SIZE,
    height: ROOT_SIZE,
    hasChildren: rootHasChildren,
    expanded: rootExpanded,
    descendantLevelCounts: rootHasChildren ? [{ level: 1, count: projectNodes.length }] : []
  };
  renderNodes.push(rootRender);
  if (rootHasChildren) expandableIds.add(rootRender.id);
  const rootCenter = centerOf(rootRender);
  detailById.set(rootRender.id, {
    id: rootRender.id,
    title: rootRender.label,
    type: 'root',
    status: rootRender.status,
    description: rootNode?.description,
    docs: [],
    relatedFeatures: []
  });

  const projectRenderById = new Map<string, RenderNode>();
  const projectSideById = new Map<string, 1 | -1>();
  const rightQueue: RoadmapNode[] = [];
  const leftQueue: RoadmapNode[] = [];
  projectNodes.forEach((project, index) => {
    if (index % 2 === 0) rightQueue.push(project);
    else leftQueue.push(project);
  });
  const projectPositions = new Map<string, { x: number; y: number; side: 1 | -1 }>();
  const fanYStart = snapToGrid(rootRender.y + ROOT_SIZE + 84);
  const fanRowGap = 164;
  const fanXOffset = 420;

  // Technical: project nodes are distributed into deterministic left/right fan lanes.
  // Layman: major feature circles use fixed lanes so they do not jump around on reload.
  if (projectNodes.length === 1) {
    const only = projectNodes[0];
    projectPositions.set(only.id, {
      x: snapToGrid(rootCenter.x - PROJECT_SIZE / 2),
      y: fanYStart,
      side: 1
    });
  } else {
    rightQueue.forEach((project, rowIndex) => {
      projectPositions.set(project.id, {
        x: snapToGrid(rootCenter.x + fanXOffset - PROJECT_SIZE / 2),
        y: snapToGrid(fanYStart + rowIndex * fanRowGap),
        side: 1
      });
    });
    leftQueue.forEach((project, rowIndex) => {
      projectPositions.set(project.id, {
        x: snapToGrid(rootCenter.x - fanXOffset - PROJECT_SIZE / 2),
        y: snapToGrid(fanYStart + rowIndex * fanRowGap),
        side: -1
      });
    });
  }

  // Technical: populate detailById regardless of visibility so detail resolution is stable.
  // Layman: we still prepare panel text even when sections are folded closed.
  projectNodes.forEach((project) => {
    const projectRoots = trees.get(project.id)?.roots ?? [];
    const projectLevelCounts = toLevelCountArray(collectProjectDepthCounts(projectRoots));
    if (projectRoots.length > 0) expandableIds.add(project.id);
    // Technical: collect expandability metadata independent of current visibility.
    // Layman: "Expand All" should still know hidden children exist.
    const collectTreeExpandables = (node: TreeNode) => {
      if (node.children.length > 0) expandableIds.add(node.id);
      for (const child of node.children) collectTreeExpandables(child);
    };
    for (const root of projectRoots) collectTreeExpandables(root);

    detailById.set(project.id, {
      id: project.id,
      title: project.label,
      type: 'feature',
      status: project.status,
      description: project.description,
      docs: collectRelatedDocs(trees.get(project.id)?.roots.flatMap((root) => root.allMilestones) ?? []),
      link: project.link,
      relatedFeatures: []
    });

    // Technical: skip visual project nodes when root is collapsed; keep metadata intact.
    // Layman: folded root means "hide", not "erase."
    if (!rootExpanded) return;

    const plannedPosition = projectPositions.get(project.id) || { x: snapToGrid(TRUNK_X - PROJECT_SIZE / 2), y: fanYStart, side: 1 as const };
    const projectBaseX = plannedPosition.x;
    const projectBaseY = plannedPosition.y;
    const projectPos = getNodePosition(project.id, projectBaseX, projectBaseY, positionOverrides);
    const effectiveSide: 1 | -1 = projectPos.x + PROJECT_SIZE / 2 >= rootCenter.x ? 1 : -1;

    const projectRender: RenderNode = {
      id: project.id,
      kind: 'project',
      label: project.label,
      status: project.status,
      x: projectPos.x,
      y: projectPos.y,
      width: PROJECT_SIZE,
      height: PROJECT_SIZE,
      hasChildren: projectRoots.length > 0,
      expanded: expandedNodeIds.has(project.id),
      descendantLevelCounts: projectLevelCounts
    };
    renderNodes.push(projectRender);
    projectRenderById.set(project.id, projectRender);
    projectSideById.set(project.id, effectiveSide);
  });

  // Technical: root->project edges are emitted only when project nodes are materialized.
  // Layman: only draw lines to circles that are actually on screen.
  if (rootExpanded) {
    projectNodes.forEach((project, index) => {
      const targetNode = projectRenderById.get(project.id);
      if (!targetNode) return;
      const target = centerOf(targetNode);
      const side: 1 | -1 = target.x >= rootCenter.x ? 1 : -1;
      const startX = rootCenter.x + side * (rootRender.width / 2 - 3);
      const endX = target.x - side * (targetNode.width / 2 - 3);
      const flat = isNearlyFlatEdge(rootCenter.y, target.y);

      renderEdges.push({
        id: `root_project_${project.id}`,
        path: buildCurvePath(startX, rootCenter.y, endX, target.y, side),
        color: '#0ea5e9',
        flat,
        width: index === 0 ? 2.5 : 2.1
      });
    });
  }

  const branchRenderById = new Map<string, RenderNode>();

  // Technical: branch tree materialization requires expanded root and expanded project.
  // Layman: deep cards appear only when parent layers are opened.
  if (rootExpanded) projectNodes.forEach((project) => {
    const projectRender = projectRenderById.get(project.id);
    const tree = trees.get(project.id);
    if (!projectRender || !tree) return;

    const projectExpanded = expandedNodeIds.has(project.id);
    if (!projectExpanded) return;

    const side: 1 | -1 = projectSideById.get(project.id) ?? 1;
    const projectCenter = centerOf(projectRender);

    const byDepth = new Map<number, TreeNode[]>();
    const parentVisible = new Set<string>();
    const treeNodeById = new Map<string, TreeNode>();

    const collectVisible = (node: TreeNode) => {
      treeNodeById.set(node.id, node);
      const list = byDepth.get(node.depth) ?? [];
      list.push(node);
      byDepth.set(node.depth, list);

      const nodeExpanded = expandedNodeIds.has(node.id);
      // Technical: visibility walk is expansion-gated at each node.
      // Layman: closed parent card means hidden children.
      if (node.children.length > 0 && nodeExpanded) {
        for (const child of node.children) {
          parentVisible.add(child.id);
          collectVisible(child);
        }
      }
    };

    for (const root of tree.roots) {
      parentVisible.add(root.id);
      collectVisible(root);
    }

    for (const [depth, nodesAtDepthRaw] of Array.from(byDepth.entries()).sort((a, b) => a[0] - b[0])) {
      const nodesAtDepth = nodesAtDepthRaw
        .filter((node) => parentVisible.has(node.id))
        .sort((a, b) => {
          const aParentKey = a.parentId ? (treeNodeById.get(a.parentId)?.pathKey || '') : '';
          const bParentKey = b.parentId ? (treeNodeById.get(b.parentId)?.pathKey || '') : '';
          if (aParentKey !== bParentKey) return aParentKey.localeCompare(bParentKey);
          return a.pathKey.localeCompare(b.pathKey);
        });

      const count = nodesAtDepth.length;
      const heights = nodesAtDepth.map((node) => estimateBranchHeight(node.label));
      // Technical: depth column Y extents are centered around project center.
      // Layman: keep child columns balanced so the branch doesn't lean awkwardly.
      const totalHeight = heights.reduce((sum, h) => sum + h, 0) + Math.max(0, count - 1) * BRANCH_ROW_GAP;
      let cursorY = snapToGrid(projectCenter.y - totalHeight / 2);

      nodesAtDepth.forEach((treeNode, index) => {
        const nodeHeight = heights[index];
        const branchBaseX = snapToGrid(projectCenter.x + side * (BRANCH_BASE_DISTANCE + (depth - 1) * BRANCH_COL_DISTANCE) - BRANCH_WIDTH / 2);
        const branchBaseY = cursorY;
        const branchPos = getNodePosition(treeNode.id, branchBaseX, branchBaseY, positionOverrides);

        const renderNode: RenderNode = {
          id: treeNode.id,
          kind: 'branch',
          label: treeNode.label,
          status: treeNode.status,
          x: branchPos.x,
          y: branchPos.y,
          width: BRANCH_WIDTH,
          height: nodeHeight,
          projectId: project.id,
          parentId: treeNode.parentId || project.id,
          depth,
          hasChildren: treeNode.children.length > 0,
          expanded: expandedNodeIds.has(treeNode.id),
          descendantLevelCounts: toLevelCountArray(collectDescendantDepthCounts(treeNode))
        };

        renderNodes.push(renderNode);
        branchRenderById.set(renderNode.id, renderNode);
        if (renderNode.hasChildren) expandableIds.add(renderNode.id);

        for (const milestone of treeNode.milestones) {
          milestoneToRenderNodeId.set(milestone.id, renderNode.id);
        }

        detailById.set(renderNode.id, {
          id: renderNode.id,
          title: `${project.label}: ${treeNode.pathKey}`,
          type: `subfeature L${depth}`,
          status: treeNode.status,
          description: treeNode.milestones[0]?.description,
          docs: collectRelatedDocs(treeNode.allMilestones),
          link: treeNode.milestones[0]?.link,
          relatedFeatures: [project.label]
        });

        // Technical: advance Y cursor by node height + row gap.
        // Layman: place the next card below the previous card.
        cursorY = snapToGrid(cursorY + nodeHeight + BRANCH_ROW_GAP);
      });
    }
  });

  // Technical: parent grouping enables sibling connector fan-out offsets.
  // Layman: this prevents sibling lines from stacking on top of each other.
  const branchesByParentId = new Map<string, RenderNode[]>();
  for (const branch of Array.from(branchRenderById.values())) {
    if (!branch.parentId) continue;
    const list = branchesByParentId.get(branch.parentId) ?? [];
    list.push(branch);
    branchesByParentId.set(branch.parentId, list);
  }

  for (const [parentId, branches] of branchesByParentId.entries()) {
    const parent = branchRenderById.get(parentId) || projectRenderById.get(parentId);
    if (!parent) continue;

    const parentCenter = centerOf(parent);
    const sortedBranches = [...branches].sort((a, b) => {
      const ay = centerOf(a).y;
      const by = centerOf(b).y;
      if (ay !== by) return ay - by;
      return a.id.localeCompare(b.id);
    });

    const siblingCount = sortedBranches.length;
    // Technical: fanStep applies a small vertical offset per sibling edge so equal-origin
    // connectors do not visually collapse into one line.
    // Layman: if multiple children leave the same parent, we slightly spread the lines so
    // they stay readable. If card sizing changes, this spacing may need retuning.
    const fanStep = siblingCount > 1 ? Math.min(16, Math.max(6, 30 / siblingCount)) : 0;

    sortedBranches.forEach((branch, index) => {
      const end = centerOf(branch);
      const side: 1 | -1 = end.x >= parentCenter.x ? 1 : -1;
      const fanOffsetY = siblingCount > 1 ? (index - (siblingCount - 1) / 2) * fanStep : 0;

      const startX = parentCenter.x + side * (parent.width / 2 - 3);
      const startY = parentCenter.y + fanOffsetY;
      const endX = end.x - side * (branch.width / 2 - 3);
      const flat = isNearlyFlatEdge(startY, end.y);

      renderEdges.push({
        id: `edge_${parent.id}_${branch.id}`,
        path: buildCurvePath(startX, startY, endX, end.y, side),
        color: '#3b82f6',
        flat,
        width: 1.85
      });
    });
  }

  // Technical: visible-node lookup constrains crosslinks to currently rendered nodes.
  // Layman: dotted links are calculated only between cards you can currently see.
  const visibleNodeById = new Map<string, RenderNode>();
  for (const project of projectRenderById.values()) visibleNodeById.set(project.id, project);
  for (const branch of branchRenderById.values()) visibleNodeById.set(branch.id, branch);
  visibleNodeById.set(rootRender.id, rootRender);

  const resolveRenderNode = (rawId: string) => {
    // Technical: sequence edges may target raw milestone ids; this remaps them to
    // the branch node id currently visible in the rendered tree.
    // Layman: some links point to source ids, so we translate them to the card id shown now.
    const direct = visibleNodeById.get(rawId);
    if (direct) return direct;
    const mappedMilestone = milestoneToRenderNodeId.get(rawId);
    if (mappedMilestone) return visibleNodeById.get(mappedMilestone);
    return undefined;
  };

  const crossEdgeDedupe = new Set<string>();

  // Technical: phase 1 crosslinks = explicit sequence edges from source data.
  // Same-project sequence edges are skipped to avoid duplicate visual noise.
  // Layman: first we draw the intentional dependency lines.
  for (const edge of data.edges) {
    if (edge.type !== 'sequence') continue;
    const fromNode = resolveRenderNode(edge.from);
    const toNode = resolveRenderNode(edge.to);
    if (!fromNode || !toNode) continue;
    if (fromNode.id === toNode.id) continue;
    if (fromNode.projectId && toNode.projectId && fromNode.projectId === toNode.projectId) continue;
    const key = `sequence_${edge.from}_${edge.to}`;
    addCrossEdge(renderEdges, crossEdgeDedupe, key, fromNode, toNode);
  }

  // Technical: phase 2 crosslinks = inferred links from doc-path overlap, capped by limit.
  // Layman: then we add "likely related" dotted lines, but with a limit to avoid spaghetti.
  const branchNodes = Array.from(branchRenderById.values());
  let inferredCount = 0;
  const inferredLimit = 16;
  for (let i = 0; i < branchNodes.length; i++) {
    if (inferredCount >= inferredLimit) break;
    const a = branchNodes[i];
    const aDocs = docsToKeySet(detailById.get(a.id));
    if (aDocs.size === 0) continue;

    for (let j = i + 1; j < branchNodes.length; j++) {
      if (inferredCount >= inferredLimit) break;
      const b = branchNodes[j];
      if (a.parentId === b.id || b.parentId === a.id) continue;
      if (a.projectId && b.projectId && a.projectId === b.projectId) continue;

      const bDocs = docsToKeySet(detailById.get(b.id));
      if (!hasAnyDocOverlap(aDocs, bDocs)) continue;

      const key = `inferred_${[a.id, b.id].sort().join('__')}`;
      addCrossEdge(renderEdges, crossEdgeDedupe, key, a, b);
      inferredCount += 1;
    }
  }

  // Technical: phase 3 fallback inserts one dashed edge if none exist.
  // Layman: if no dotted links were created, we add one minimal example.
  if (!renderEdges.some((edge) => edge.dashed)) {
    const projectList = Array.from(projectRenderById.values());
    if (projectList.length >= 2) {
      addCrossEdge(renderEdges, crossEdgeDedupe, `fallback_${projectList[0].id}_${projectList[1].id}`, projectList[0], projectList[1]);
    }
  }

  // Technical: stats are derived from current renderNodes only (view-state aware).
  // Layman: the widget counts show what's visible now, not a hidden total.
  const stats = {
    done: renderNodes.filter((node) => node.status === 'done').length,
    active: renderNodes.filter((node) => node.status === 'active').length,
    planned: renderNodes.filter((node) => node.status === 'planned').length,
    projects: renderNodes.filter((node) => node.kind === 'project').length,
    branches: renderNodes.filter((node) => node.kind === 'branch').length
  };

  return {
    nodes: renderNodes,
    edges: renderEdges,
    detailById,
    stats,
    expandableIds: Array.from(expandableIds)
  };
};
