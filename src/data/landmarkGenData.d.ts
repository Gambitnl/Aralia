/**
 * @file src/data/landmarkGenData.ts
 *
 * Data components for procedural landmark generation.
 * Used by landmarkService to construct unique, varied landmarks.
 */
export interface LandmarkOrigin {
    id: string;
    name: string;
    descriptionPrefix: string[];
    commonBiomes: string[];
    rewardTypes: ('item' | 'gold' | 'xp' | 'health')[];
    minLevel: number;
}
export interface LandmarkType {
    id: string;
    name: string;
    descriptionTemplates: string[];
    baseWeight: number;
}
export interface LandmarkState {
    id: string;
    nameSuffix: string;
    descriptionModifier: string;
    consequenceTypes: ('buff' | 'map_reveal' | 'reputation' | 'damage' | 'debuff')[];
    riskLevel: number;
}
export declare const LANDMARK_ORIGINS: LandmarkOrigin[];
export declare const LANDMARK_TYPES: LandmarkType[];
export declare const LANDMARK_STATES: LandmarkState[];
