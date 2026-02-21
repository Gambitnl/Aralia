// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 * 
 * Last Sync: 21/02/2026, 18:13:23
 * Dependents: RoadmapVisualizer.tsx, constants.ts, graph.ts, tree.ts, utils.ts
 * Imports: None
 * 
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx scripts/codebase-visualizer-server.ts --sync [this-file-path]
 * See scripts/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * Technical:
 * Shared type contracts for roadmap data loading, tree building, and render output.
 *
 * Layman:
 * This file is the roadmap dictionary. It defines what a node/edge/detail looks like
 * so all roadmap files speak the same data language.
 */

// ============================================================================
// Source Data Shapes
// ============================================================================
// Technical: types returned by roadmap data generation endpoint.
// Layman: the raw roadmap entries before the UI lays them out.
// ============================================================================
export interface RoadmapNode {
  id: string;
  label: string;
  type: 'root' | 'project' | 'milestone' | 'task';
  feature?: string;
  featureCategory?: string;
  status: 'done' | 'active' | 'planned';
  initialX: number;
  initialY: number;
  description?: string;
  link?: string;
  sourceDocs?: string[];
  canonicalDocs?: string[];
}

export interface RoadmapEdge {
  from: string;
  to: string;
  type?: 'containment' | 'sequence';
}

export interface RoadmapData {
  nodes: RoadmapNode[];
  edges: RoadmapEdge[];
}

// ============================================================================
// Detail Panel Doc Shapes
// ============================================================================
// Technical: normalized related-doc record used by detail panel.
// Layman: file link info shown when you click a roadmap card.
// ============================================================================
export interface RelatedDoc {
  sourcePath: string;
  canonicalPath?: string;
  href: string;
}

export interface DetailEntry {
  id: string;
  title: string;
  type: string;
  status: 'done' | 'active' | 'planned';
  description?: string;
  docs: RelatedDoc[];
  link?: string;
  relatedFeatures: string[];
}

// ============================================================================
// Render Graph Shapes
// ============================================================================
// Technical: view-model structures consumed directly by the React visualizer.
// Layman: the "ready to draw" cards/lines/stats for the roadmap screen.
// ============================================================================
export type RenderNodeKind = 'root' | 'project' | 'branch';

export interface RenderNode {
  id: string;
  kind: RenderNodeKind;
  label: string;
  status: 'done' | 'active' | 'planned';
  x: number;
  y: number;
  width: number;
  height: number;
  projectId?: string;
  parentId?: string;
  depth?: number;
  hasChildren?: boolean;
  expanded?: boolean;
  descendantLevelCounts?: Array<{ level: number; count: number }>;
}

export interface RenderEdge {
  id: string;
  path: string;
  dashed?: boolean;
  // Technical: marks links whose endpoints are effectively on the same Y level.
  // Layman: this flags "almost perfectly horizontal" lines, which are the ones
  // most likely to visually disappear when SVG glow filters are applied.
  flat?: boolean;
  color: string;
  width: number;
}

export interface RenderGraph {
  nodes: RenderNode[];
  edges: RenderEdge[];
  detailById: Map<string, DetailEntry>;
  stats: {
    done: number;
    active: number;
    planned: number;
    projects: number;
    branches: number;
  };
  expandableIds: string[];
}

// ============================================================================
// Tree-Building Shape
// ============================================================================
// Technical: intermediate hierarchical structure used while deriving branch nodes.
// Layman: the parent/child branch structure before cards are placed on screen.
// ============================================================================
export type TreeNode = {
  id: string;
  pathKey: string;
  label: string;
  depth: number;
  parentId?: string;
  children: TreeNode[];
  milestones: RoadmapNode[];
  allMilestones: RoadmapNode[];
  status: 'done' | 'active' | 'planned';
};

// Technical: theme mode values used by roadmap UI controls.
// Layman: the two appearance modes the roadmap can be in.
export type ThemeMode = 'light' | 'dark';
