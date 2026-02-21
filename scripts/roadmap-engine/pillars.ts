export type MainPillarId =
  | 'ui-player-surfaces'
  | 'character-systems'
  | 'world-exploration'
  | 'combat-systems'
  | 'social-party-systems'
  | 'narrative-quest-systems'
  | 'economy-progression'
  | 'content-reference'
  | 'data-persistence-determinism'
  | 'technical-foundation-tooling';

export type MainPillar = {
  id: MainPillarId;
  label: string;
  summary: string;
  keywords: string[];
};

export const MAIN_PILLARS: MainPillar[] = [
  {
    id: 'ui-player-surfaces',
    label: 'UI & Player Surfaces',
    summary: 'Main menu, HUD, character sheet, glossary entry points, and player-facing interactions.',
    keywords: ['ui', 'menu', 'hud', 'sheet', 'overlay', 'panel', 'screen']
  },
  {
    id: 'character-systems',
    label: 'Character Systems',
    summary: 'Character creation, progression, classes, feats, and character data behavior.',
    keywords: ['character', 'class', 'feat', 'race', 'progression', 'level', 'build']
  },
  {
    id: 'world-exploration',
    label: 'World Exploration',
    summary: 'World map navigation, travel loops, discovery, and submap anchoring.',
    keywords: ['world', 'exploration', 'map', 'travel', 'submap', 'biome', 'encounter', 'atlas']
  },
  {
    id: 'combat-systems',
    label: 'Combat Systems',
    summary: 'Action economy, spell/weapon rules, damage pipeline, and combat resolution.',
    keywords: ['combat', 'spell', 'weapon', 'action', 'damage', 'resistance', 'targeting']
  },
  {
    id: 'social-party-systems',
    label: 'Social & Party Systems',
    summary: 'Companions, social interactions, party behavior, and relationship loops.',
    keywords: ['social', 'party', 'companion', 'banter', 'relationship', 'faction', 'reputation']
  },
  {
    id: 'narrative-quest-systems',
    label: 'Narrative & Quest Systems',
    summary: 'Quest lifecycle, branching outcomes, journals, and narrative event flow.',
    keywords: ['quest', 'narrative', 'journal', 'story', 'dialogue', 'event']
  },
  {
    id: 'economy-progression',
    label: 'Economy & Progression',
    summary: 'XP, rewards, loot, crafting foundations, and economic loops.',
    keywords: ['economy', 'xp', 'reward', 'loot', 'craft', 'vendor', 'market', 'currency']
  },
  {
    id: 'content-reference',
    label: 'Content Reference (Glossary/Compendium)',
    summary: 'Reference entries, discoverable knowledge, and searchable compendium content.',
    keywords: ['glossary', 'compendium', 'reference', 'bestiary', 'entry', 'index']
  },
  {
    id: 'data-persistence-determinism',
    label: 'Data, Persistence & Determinism',
    summary: 'Save/load, seed lifecycle, deterministic generation contracts, and migration safety.',
    keywords: ['save', 'load', 'seed', 'deterministic', 'persistence', 'state', 'migration', 'autosave']
  },
  {
    id: 'technical-foundation-tooling',
    label: 'Technical Foundation & Tooling',
    summary: 'Roadmap tooling, tests, automation, architecture support, and internal pipelines.',
    keywords: ['roadmap', 'tool', 'testing', 'test', 'automation', 'architecture', 'registry', 'pipeline', 'docs']
  }
];
