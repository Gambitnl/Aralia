export interface RoadmapNode {
    id: string;
    label: string;
    type: 'root' | 'project' | 'milestone' | 'task';
    status: 'done' | 'active' | 'planned';
    initialX: number;
    initialY: number;
    color: string;
    progress?: number;
    description?: string;
    link?: string;
    domain?: string;
    completedDate?: string;
}
export interface RoadmapEdge {
    from: string;
    to: string;
}
export declare function generateRoadmapData(): {
    version: string;
    root: string;
    nodes: RoadmapNode[];
    edges: RoadmapEdge[];
};
