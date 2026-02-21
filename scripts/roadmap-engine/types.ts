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
  subNodes?: RoadmapNode[];
}

export interface RoadmapEdge {
  from: string;
  to: string;
  type: 'containment' | 'sequence';
}
