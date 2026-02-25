import { MagicSchool } from './spells';
export type TimeFlowRate = 'normal' | 'fast' | 'slow' | 'erratic' | 'timeless';
export type PlanarValence = 'positive' | 'negative' | 'neutral' | 'chaotic';
export type PlanarTraitType = 'gravity' | 'magic' | 'time' | 'memory' | 'alignment' | 'environmental';
export interface PlanarTrait {
    id: string;
    name: string;
    description: string;
    type: PlanarTraitType;
    mechanics?: string;
}
export interface MagicModifier {
    school?: MagicSchool;
    effect: 'empowered' | 'impeded' | 'wild' | 'nullified';
    description: string;
}
export interface RestModifier {
    shortRestAllowed: boolean;
    longRestAllowed: boolean;
    effects: string[];
}
export interface MortalityRule {
    deathSavingThrows: 'normal' | 'disadvantage' | 'advantage' | 'instant_death';
    resurrectionPossible: boolean;
    ghosts: boolean;
}
export interface PlanarEffect {
    affectsMagic?: MagicModifier[];
    affectsRest?: RestModifier;
    affectsMortality?: MortalityRule;
    psychicDamagePerMinute?: number;
    onPlaneExit?: string;
}
export interface PlanarHazard {
    name: string;
    description: string;
    saveDC: number;
    damage?: string;
    effect?: string;
}
export interface Plane {
    id: string;
    name: string;
    description: string;
    traits: PlanarTrait[];
    natives: string[];
    hazards: PlanarHazard[];
    emotionalValence: PlanarValence;
    timeFlow: TimeFlowRate;
    effects?: PlanarEffect;
    atmosphereDescription: string;
    alignment?: string;
}
export interface PortalRequirement {
    type: 'item' | 'time' | 'spell' | 'condition';
    value: string;
    description: string;
}
export interface Portal {
    id: string;
    originLocationId: string;
    destinationPlaneId: string;
    destinationLocationCoordinates?: {
        x: number;
        y: number;
    };
    activationRequirements: PortalRequirement[];
    stability: 'permanent' | 'temporary' | 'unstable';
    isActive: boolean;
}
