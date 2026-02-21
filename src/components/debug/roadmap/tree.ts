// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 * 
 * Last Sync: 20/02/2026, 00:50:38
 * Dependents: graph.ts
 * Imports: 2 files
 * 
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx scripts/codebase-visualizer-server.ts --sync [this-file-path]
 * See scripts/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type { RoadmapData, RoadmapNode, TreeNode } from './types';
import { compareNodes, mergeStatus, slugify, stripFeaturePrefix } from './utils';

export function buildProjectTrees(data: RoadmapData, projectNodes: RoadmapNode[]) {
  const nodesById = new Map(data.nodes.map((node) => [node.id, node]));
  const containmentEdges = data.edges.filter((edge) => (edge.type || 'containment') === 'containment');

  const milestonesByProject = new Map<string, RoadmapNode[]>();
  for (const edge of containmentEdges) {
    const from = nodesById.get(edge.from);
    const to = nodesById.get(edge.to);
    if (!from || !to) continue;
    if (from.type !== 'project' || to.type !== 'milestone') continue;

    const arr = milestonesByProject.get(from.id) ?? [];
    arr.push(to);
    milestonesByProject.set(from.id, arr);
  }

  const trees = new Map<string, { roots: TreeNode[]; byPath: Map<string, TreeNode> }>();

  for (const project of projectNodes) {
    const roots: TreeNode[] = [];
    const byPath = new Map<string, TreeNode>();

    const milestones = (milestonesByProject.get(project.id) ?? []).sort(compareNodes);
    for (const milestone of milestones) {
      const shortLabel = stripFeaturePrefix(milestone.label, project.label);
      const parts = shortLabel
        .split('>')
        .map((part) => part.trim())
        .filter(Boolean);

      const segments = parts.length > 0 ? parts : [shortLabel || milestone.label || milestone.id];

      let parent: TreeNode | undefined;
      for (let i = 0; i < segments.length; i++) {
        const depth = i + 1;
        const pathKey = segments.slice(0, depth).join(' > ');
        const existing = byPath.get(pathKey);

        if (existing) {
          parent = existing;
          continue;
        }

        const node: TreeNode = {
          id: `branch_${project.id}_${slugify(pathKey) || `d${depth}`}`,
          pathKey,
          label: segments[i],
          depth,
          parentId: parent?.id,
          children: [],
          milestones: [],
          allMilestones: [],
          status: 'planned'
        };

        if (parent) parent.children.push(node);
        else roots.push(node);

        byPath.set(pathKey, node);
        parent = node;
      }

      if (parent) parent.milestones.push(milestone);
    }

    const computeMeta = (node: TreeNode): { status: 'done' | 'active' | 'planned'; milestones: RoadmapNode[] } => {
      const childStatuses: Array<'done' | 'active' | 'planned'> = [];
      const allMilestones = [...node.milestones];

      for (const child of node.children) {
        const meta = computeMeta(child);
        childStatuses.push(meta.status);
        allMilestones.push(...meta.milestones);
      }

      const milestoneStatuses = node.milestones.map((m) => m.status);
      const combined = [...milestoneStatuses, ...childStatuses];
      node.status = mergeStatus(combined.length > 0 ? combined : ['planned']);
      node.allMilestones = allMilestones;
      return { status: node.status, milestones: allMilestones };
    };

    for (const root of roots) computeMeta(root);

    trees.set(project.id, { roots, byPath });
  }

  return trees;
}
