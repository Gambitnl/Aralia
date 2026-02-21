// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 * 
 * Last Sync: 21/02/2026, 18:13:25
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

/**
 * Technical:
 * Builds per-project tree structures from flat milestone nodes + containment edges.
 *
 * Layman:
 * This file takes a flat list of roadmap items and rebuilds it into nested branches
 * (parent -> child -> grandchild) so the UI can show expandable subfeature columns.
 */

export function buildProjectTrees(data: RoadmapData, projectNodes: RoadmapNode[]) {
  // Technical: fast lookup map for resolving edge endpoints.
  // Layman: quick way to find a node by id while reading edges.
  const nodesById = new Map(data.nodes.map((node) => [node.id, node]));
  // Technical: only containment edges define the project->milestone hierarchy.
  // Layman: we only use "belongs to" links for tree building.
  const containmentEdges = data.edges.filter((edge) => (edge.type || 'containment') === 'containment');

  // Technical: group milestone nodes under their owning project id.
  // Layman: collect each project's roadmap cards into one bucket.
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

  // Technical: output map keyed by project id.
  // Layman: final nested branch trees for each major feature.
  const trees = new Map<string, { roots: TreeNode[]; byPath: Map<string, TreeNode> }>();

  for (const project of projectNodes) {
    const roots: TreeNode[] = [];
    const byPath = new Map<string, TreeNode>();

    const milestones = (milestonesByProject.get(project.id) ?? []).sort(compareNodes);
    for (const milestone of milestones) {
      // Technical: normalize labels into "path segments" split by ">".
      // Layman: convert text like "World Map > Visuals > Layers" into branch levels.
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
          // Technical: reuse existing branch node when path already created.
          // Layman: if this branch already exists, do not create a duplicate card.
          parent = existing;
          continue;
        }

        // Technical: create missing tree node for this depth segment.
        // Layman: make a new branch level where the path did not exist yet.
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

      // Technical: attach milestone leaf to deepest resolved branch.
      // Layman: place this roadmap item under its final sub-branch.
      if (parent) parent.milestones.push(milestone);
    }

    // Technical: post-order traversal computes status + aggregated milestone list.
    // Layman: after building the tree, walk upward so each parent knows the
    // overall progress and all items inside it.
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

    // Technical: finalize metadata for every root branch.
    // Layman: finish each top branch so UI can show counts/status correctly.
    for (const root of roots) computeMeta(root);

    trees.set(project.id, { roots, byPath });
  }

  return trees;
}
