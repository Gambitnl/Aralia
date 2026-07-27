import type { Color } from 'three';
interface TerrainProps {
    size: number;
    heightSampler: (x: number, z: number) => number;
    moistureSampler: (x: number, z: number) => number;
    color: Color;
    showGrid: boolean;
    gridSizeFt?: number;
    heightRange?: {
        min: number;
        max: number;
    };
    heightColors?: {
        low: Color;
        mid: Color;
        high: Color;
    };
}
declare const Terrain: ({ size, heightSampler, moistureSampler, color, showGrid, gridSizeFt, heightRange, heightColors, }: TerrainProps) => import("react").JSX.Element;
export default Terrain;
