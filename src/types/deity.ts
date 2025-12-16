
export type Alignment =
  | 'Lawful Good' | 'Neutral Good' | 'Chaotic Good'
  | 'Lawful Neutral' | 'True Neutral' | 'Chaotic Neutral'
  | 'Lawful Evil' | 'Neutral Evil' | 'Chaotic Evil';

export type ActionDomain =
  | 'combat'
  | 'social'
  | 'exploration'
  | 'trade'
  | 'magic'
  | 'stealth';

export interface DeityAction {
  id: string;
  description: string;
  domain: ActionDomain;
  favorChange: number; // Positive for approves, negative for forbids
}

export interface DeityRelationship {
  targetDeityId: string;
  type: 'ally' | 'enemy' | 'rival' | 'parent' | 'child' | 'sibling' | 'servant' | 'master';
  description?: string;
}

export interface DivineBlessing {
  id: string;
  name: string;
  description: string;
  minFavor: number; // Favor required to unlock
  effectType: 'stat_buff' | 'skill_advantage' | 'resistance' | 'divine_intervention';
  effectValue?: any;
}

export interface Deity {
  id: string;
  name: string;
  titles: string[];
  alignment: Alignment | string;
  domains: string[];
  symbol: string;
  description: string;
  source: string;

  // New Mechanical Fields
  relationships?: DeityRelationship[];
  approves: DeityAction[];
  forbids: DeityAction[];
  blessings?: DivineBlessing[];
}

export interface DivineFavor {
  deityId: string;
  favor: number; // -100 to 100
  history: {
    timestamp: number;
    reason: string;
    change: number;
  }[];
}

export interface TempleService {
  id: string;
  name: string;
  description: string;
  costGp: number;
  minFavor?: number;
  effect?: string; // e.g., "Restore 50 HP", "Remove Curse"
}

export interface Temple {
  id: string;
  deityId: string;
  name: string;
  locationId: string; // Links to a world location
  description: string;
  services: TempleService[];
  requirements?: {
    minFavorToEnter?: number;
    publicOnly?: boolean; // If true, requires open display of faith
  };
}
