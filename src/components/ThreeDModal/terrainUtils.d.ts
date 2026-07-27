export interface HeightSamplerConfig {
    amplitude: number;
    frequency: number;
    detailAmplitude: number;
    detailFrequency: number;
    /** Fractal parameters (optional). */
    octaves?: number;
    persistence?: number;
    lacunarity?: number;
    /** Domain warp applied to the base coordinates (optional). */
    warpAmplitude?: number;
    warpFrequency?: number;
    /** Ridged noise mixed into the terrain (optional). */
    ridgeStrength?: number;
    ridgeFrequency?: number;
    /** Applies a constant vertical shift, in feet (optional). */
    baseOffset?: number;
    /** Macro feature toggles / tuning. */
    riverEnabled?: boolean;
    riverWidthFt?: number;
    riverDepthFt?: number;
    riverBankHeightFt?: number;
    pathEnabled?: boolean;
    pathWidthFt?: number;
    pathFlattenStrength?: number;
    clearingEnabled?: boolean;
    clearingRadiusFt?: number;
}
export interface MoistureSamplerConfig {
    base: number;
    variance: number;
    frequency: number;
    detailFrequency: number;
    riverBoost?: number;
    pathDrying?: number;
}
type TerrainFeatureMasks = {
    river: number;
    riverBank: number;
    path: number;
    clearing: number;
};
export interface TerrainSamplers {
    heightSampler: (x: number, z: number) => number;
    moistureSampler: (x: number, z: number) => number;
    slopeSampler: (x: number, z: number) => number;
    featureSampler: (x: number, z: number) => TerrainFeatureMasks;
    heightRange: {
        min: number;
        max: number;
    };
}
export declare const createTerrainSamplers: (seed: number, biomeId: string, size: number) => TerrainSamplers;
export declare const createHeightSampler: (seed: number, biomeId: string, size: number) => (x: number, z: number) => number;
export declare const createMoistureSampler: (seed: number, biomeId: string, size: number) => (x: number, z: number) => number;
export declare const createSlopeSampler: (heightSampler: (x: number, z: number) => number, sampleStep?: number) => (x: number, z: number) => number;
export declare const getHeightRangeForBiome: (biomeId: string) => {
    min: number;
    max: number;
};
export {};
