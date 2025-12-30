
import { MagicSchool } from './spells';
// TODO(lint-intent): 'Location' is imported but unused; it hints at a helper/type the module was meant to use.
// TODO(lint-intent): If the planned feature is still relevant, wire it into the data flow or typing in this file.
// TODO(lint-intent): Otherwise drop the import to keep the module surface intentional.
import { Location as _Location } from './index';

export type TimeFlowRate = 'normal' | 'fast' | 'slow' | 'erratic' | 'timeless';

export type PlanarValence = 'positive' | 'negative' | 'neutral' | 'chaotic';

export type PlanarTraitType =
  | 'gravity'
  | 'magic'
  | 'time'
  | 'memory'
  | 'alignment'
  | 'environmental';

export interface PlanarTrait {
  id: string;
  name: string;
  description: string;
  type: PlanarTraitType;
  mechanics?: string; // Description of mechanical effect
}

export interface MagicModifier {
  school?: MagicSchool;
  effect: 'empowered' | 'impeded' | 'wild' | 'nullified';
  description: string;
}

export interface RestModifier {
  shortRestAllowed: boolean;
  longRestAllowed: boolean;
  effects: string[]; // e.g., "No healing", "Nightmares"
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
  psychicDamagePerMinute?: number; // For hostile planes
  onPlaneExit?: string; // Mechanical description of exit effects (e.g., Memory Loss)
}

export interface PlanarHazard {
  name: string;
  description: string;
  saveDC: number;
  damage?: string; // e.g., "1d6 fire"
  effect?: string; // Status effect
}

export interface Plane {
  id: string;
  name: string;
  description: string;
  traits: PlanarTrait[];
  natives: string[]; // Creature types or specific creature IDs
  hazards: PlanarHazard[];
  emotionalValence: PlanarValence;
  timeFlow: TimeFlowRate;
  effects?: PlanarEffect;
  atmosphereDescription: string;
  alignment?: string; // Added for authentic D&D cosmology
}

export interface PortalRequirement {
  type: 'item' | 'time' | 'spell' | 'condition';
  value: string; // "Moonstone Key", "Full Moon", "Plane Shift", "Bloodied"
  description: string;
}

export interface Portal {
  id: string;
  originLocationId: string;
  destinationPlaneId: string;
  destinationLocationCoordinates?: { x: number; y: number };
  activationRequirements: PortalRequirement[];
  stability: 'permanent' | 'temporary' | 'unstable';
  isActive: boolean;
}
