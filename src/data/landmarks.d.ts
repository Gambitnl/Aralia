export interface LandmarkRewardTemplate {
    type: 'item' | 'xp' | 'health' | 'gold';
    resourceId?: string;
    amountRange: [number, number];
    chance: number;
    descriptionTemplate: string;
}
export interface LandmarkConsequenceTemplate {
    type: 'buff' | 'map_reveal' | 'reputation' | 'damage' | 'debuff';
    targetId?: string;
    duration?: number;
    value?: number;
    chance: number;
    descriptionTemplate: string;
}
export interface LandmarkTemplate {
    id: string;
    nameTemplate: string[];
    descriptionTemplate: string[];
    biomes: string[];
    weight: number;
    possibleRewards?: LandmarkRewardTemplate[];
    possibleConsequences?: LandmarkConsequenceTemplate[];
}
export declare const LANDMARK_TEMPLATES: LandmarkTemplate[];
