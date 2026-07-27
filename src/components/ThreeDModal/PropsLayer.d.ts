import type { Color } from 'three';
interface PropsLayerProps {
    submapSeed: number;
    biomeId: string;
    size: number;
    heightSampler: (x: number, z: number) => number;
    slopeSampler?: (x: number, z: number) => number;
    moistureSampler?: (x: number, z: number) => number;
    featureSampler?: (x: number, z: number) => {
        river: number;
        riverBank: number;
        path: number;
        clearing: number;
    };
    heightRange?: {
        min: number;
        max: number;
    };
    tint: Color;
    spawnCenter?: {
        x: number;
        z: number;
    };
    spawnSafeRadius?: number;
    treeCountMultiplier?: number;
    rockCountMultiplier?: number;
    heroLineEnabled?: boolean;
    heroLineSpacing?: number;
    heroLineOffset?: {
        x: number;
        z: number;
    };
    customTreeOptions?: Record<string, unknown> | null;
    customTreeEnabled?: boolean;
    customTreeOffset?: {
        x: number;
        z: number;
    };
    customTreeScale?: number;
    comparisonTreeOptions?: Record<string, unknown> | null;
    comparisonTreeEnabled?: boolean;
    comparisonTreeOffset?: {
        x: number;
        z: number;
    };
    comparisonTreeScale?: number;
    onCustomTreeStats?: (stats: TreeStats | null) => void;
    onComparisonTreeStats?: (stats: TreeStats | null) => void;
}
export interface TreeStats {
    heightFt: number;
    trunkVertices: number;
    leavesVertices: number;
    trunkTriangles: number;
    leavesTriangles: number;
    totalVertices: number;
    totalTriangles: number;
}
declare const PropsLayer: ({ submapSeed, biomeId, size, heightSampler, slopeSampler, moistureSampler, featureSampler, heightRange, tint, spawnCenter, spawnSafeRadius, treeCountMultiplier, rockCountMultiplier, heroLineEnabled, heroLineSpacing, heroLineOffset, customTreeOptions, customTreeEnabled, customTreeOffset, customTreeScale, comparisonTreeOptions, comparisonTreeEnabled, comparisonTreeOffset, comparisonTreeScale, onCustomTreeStats, onComparisonTreeStats, }: PropsLayerProps) => import("react").JSX.Element;
export default PropsLayer;
