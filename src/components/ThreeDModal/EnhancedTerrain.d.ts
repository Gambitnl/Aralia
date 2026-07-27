import type { Color } from 'three';
interface EnhancedTerrainProps {
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
    biomeId: string;
}
declare const EnhancedTerrain: ({ size, heightSampler, moistureSampler, color, showGrid, gridSizeFt, heightRange, heightColors, biomeId }: EnhancedTerrainProps) => import("react").JSX.Element;
export default EnhancedTerrain;
