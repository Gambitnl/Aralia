import { Location } from './world';

export interface DeityAction {
  trigger?: string; // Optional because sometimes it's just a description
  description: string;
  favorChange: number;
}

export interface DeityRelationship {
  targetDeityId: string;
  type: 'ally' | 'enemy' | 'rival' | 'neutral';
}

export interface Deity {
  id: string;
  name: string;
  titles: string[];
  alignment: string;
  domains: string[];
  symbol: string;
  description: string;
  commandments: string[];
  favoredWeapon: string;
  approves: DeityAction[];
  forbids: DeityAction[];
  relationships: DeityRelationship[];
}

export interface DivineFavor {
  deityId: string;
  value: number; // -100 to 100
  status: 'exalted' | 'favored' | 'neutral' | 'disfavored' | 'anathema';
  lastPrayerTime?: number;
  // History is essential for the UI
  history: {
    timestamp: number;
    reason: string;
    change: number;
  }[];
  // Track active blessings
  blessings: Blessing[];
  // Track transgressions
  transgressions: Transgression[];
}

export interface Temple extends Location {
  type: 'temple';
  deityId: string;
  services: (string | TempleService)[]; // Can be ID or object
}

export interface TempleService {
  id: string;
  name: string;
  description: string;
  costGp: number;
  minFavor?: number;
  effect: string; // e.g. "restore_hp_full", "grant_blessing_X"
}

export interface Blessing {
  id: string;
  name: string;
  description: string;
  effectType: 'stat_boost' | 'ability' | 'passive' | 'buff';
  effectValue?: any;
  durationHours?: number;
}

export interface Transgression {
  id: string;
  description: string;
  severity: 'minor' | 'major' | 'unforgivable';
  favorPenalty: number;
  timestamp: number;
}

export interface ReligionState {
  knownDeities: string[]; // IDs of deities discovered
  favor: Record<string, DivineFavor>; // Map deityId to favor tracking
}
