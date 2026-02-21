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

export type ThemeMode = 'light' | 'dark';
