export interface RoadmapNode {
  id: string;
  label: string;
  type: 'root' | 'project' | 'milestone' | 'task';
  category?: 'trunk' | 'pillar' | 'feature' | 'component' | 'operations' | 'history' | 'unknown';
  sourceKind?: 'registry' | 'track' | 'chronicle' | 'system';
  feature?: string;
  featureCategory?: string;
  status: 'done' | 'active' | 'planned';
  initialX: number;
  initialY: number;
  color: string;
  progress?: number;
  description?: string;
  link?: string;
  domain?: string;
  completedDate?: string;
  priority?: string;
  dependencies?: string[];
  goals?: string[];
  filesImpacted?: string[];
  sourceDocs?: string[];
  canonicalDocs?: string[];
  // Unique per-node test metadata used by roadmap verification tooling.
  // These fields allow the UI (and API later) to know what test to run
  // and what the latest known verification state is for this node.
  testId?: string;
  testCommand?: string;
  testStatus?: 'pass' | 'fail' | 'unverified';
  lastTestedAt?: string;
  lastTestMessage?: string;
  subNodes?: RoadmapNode[];
}

export interface RoadmapEdge {
  from: string;
  to: string;
  type: 'containment' | 'sequence';
}

export interface RoadmapData {
  nodes: RoadmapNode[];
  edges: RoadmapEdge[];
}
