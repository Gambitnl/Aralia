export interface Blessing {
  id: string;
  name: string;
  description: string;
  minFavor: number;
  effectType: 'stat_boost' | 'ability' | 'passive';
  effectValue: any; // Flexible for now
}

export interface Transgression {
  id: string;
  description: string;
  severity: 'minor' | 'major' | 'unforgivable';
  favorPenalty: number;
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
  // Relationships/Opinions could go here later
}

export interface DivineFavor {
  deityId: string;
  value: number; // -100 to 100
  status: 'exalted' | 'favored' | 'neutral' | 'disfavored' | 'anathema';
  history: {
    date: number; // Timestamp
    reason: string;
    change: number;
  }[];
}

export interface ReligionState {
  knownDeities: string[]; // IDs of deities discovered
  favor: Record<string, DivineFavor>; // Map deityId to favor tracking
}
