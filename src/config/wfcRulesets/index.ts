/**
 * @file src/config/wfcRulesets/index.ts
 * Lightweight WFC rulesets for submap generation.
 * These rule definitions are intentionally compact to keep bundle size small while allowing visual variety.
 */

export interface WfcNeighborRules {
  up: string[];
  down: string[];
  left: string[];
  right: string[];
}

export interface WfcTileDefinition {
  id: string;
  weight: number;
  neighbors: WfcNeighborRules;
  biomeHint?: string;
}

export interface WfcRuleset {
  id: string;
  tiles: WfcTileDefinition[];
  fallbackTileId: string;
}

const temperateRuleset: WfcRuleset = {
  id: 'temperate',
  fallbackTileId: 'grass',
  tiles: [
    {
      id: 'grass',
      weight: 6,
      biomeHint: 'plains',
      neighbors: {
        up: ['grass', 'path', 'water', 'rock'],
        down: ['grass', 'path', 'water', 'rock'],
        left: ['grass', 'path', 'water', 'rock'],
        right: ['grass', 'path', 'water', 'rock'],
      },
    },
    {
      id: 'path',
      weight: 2,
      biomeHint: 'plains',
      neighbors: {
        up: ['grass', 'path', 'rock'],
        down: ['grass', 'path', 'rock'],
        left: ['grass', 'path', 'rock'],
        right: ['grass', 'path', 'rock'],
      },
    },
    {
      id: 'water',
      weight: 1,
      biomeHint: 'swamp',
      neighbors: {
        up: ['grass', 'water'],
        down: ['grass', 'water'],
        left: ['grass', 'water'],
        right: ['grass', 'water'],
      },
    },
    {
      id: 'rock',
      weight: 1,
      biomeHint: 'mountain',
      neighbors: {
        up: ['grass', 'path', 'rock'],
        down: ['grass', 'path', 'rock'],
        left: ['grass', 'path', 'rock'],
        right: ['grass', 'path', 'rock'],
      },
    },
  ],
};

const cavernRuleset: WfcRuleset = {
  id: 'cavern',
  fallbackTileId: 'wall',
  tiles: [
    {
      id: 'wall',
      weight: 5,
      biomeHint: 'cave',
      neighbors: {
        up: ['wall', 'floor'],
        down: ['wall', 'floor'],
        left: ['wall', 'floor'],
        right: ['wall', 'floor'],
      },
    },
    {
      id: 'floor',
      weight: 4,
      biomeHint: 'dungeon',
      neighbors: {
        up: ['wall', 'floor'],
        down: ['wall', 'floor'],
        left: ['wall', 'floor'],
        right: ['wall', 'floor'],
      },
    },
    {
      id: 'ore',
      weight: 1,
      biomeHint: 'cave',
      neighbors: {
        up: ['floor', 'wall'],
        down: ['floor', 'wall'],
        left: ['floor', 'wall'],
        right: ['floor', 'wall'],
      },
    },
  ],
};

export const WFC_RULESETS: Record<string, WfcRuleset> = {
  temperate: temperateRuleset,
  cavern: cavernRuleset,
};
