import { BiomeType } from '../../../types/realmsmith';
export interface BiomeColors {
    grassHue: number;
    waterColor: string;
    waterDeepColor: string;
    roofOverride: string | null;
    wallOverride: string | null;
}
export declare function getBiomeColors(biome: BiomeType): BiomeColors;
