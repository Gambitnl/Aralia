import type { Color } from 'three';
interface TextureSplattingProps {
    size: number;
    heightSampler: (x: number, z: number) => number;
    moistureSampler: (x: number, z: number) => number;
    slopeSampler?: (x: number, z: number) => number;
    featureSampler?: (x: number, z: number) => {
        path: number;
        river: number;
        clearing: number;
    };
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
    textureScale?: number;
}
declare const TextureSplatting: ({ size, heightSampler, moistureSampler, slopeSampler, featureSampler, color, showGrid, gridSizeFt, heightRange, heightColors, biomeId, textureScale }: TextureSplattingProps) => import("react").JSX.Element;
export default TextureSplatting;
