export interface VoxelWorkerRequest {
    id: number;
    type: 'generate';
    gridSize: number;
    isoLevel: number;
    size: number;
    data: Float32Array;
    dna: any;
}
export interface ScatterPoint {
    type: 'tree' | 'rock' | 'grass';
    position: [number, number, number];
    scale: number;
    rotation: [number, number, number];
    variantIdx: number;
}
export interface VoxelWorkerResponse {
    id: number;
    vertices: Float32Array;
    normals: Float32Array;
    scatter: ScatterPoint[];
}
