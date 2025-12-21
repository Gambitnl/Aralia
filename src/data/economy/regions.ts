import { RegionalEconomy } from '../../types/economy';

export const REGIONAL_ECONOMIES: Record<string, RegionalEconomy> = {
  'region_capital': {
    id: 'region_capital',
    name: 'The Royal Capital',
    exports: ['luxury', 'jewelry', 'processed_food', 'magic_item'],
    imports: ['raw_materials', 'food', 'iron', 'wood'],
    wealthLevel: 80
  },
  'region_coast': {
    id: 'region_coast',
    name: 'Coastal Cities',
    exports: ['fish', 'salt', 'dye', 'silk'],
    imports: ['weapon', 'armor', 'luxury', 'wood'],
    wealthLevel: 60
  },
  'region_mountains': {
    id: 'region_mountains',
    name: 'Iron Peaks',
    exports: ['iron', 'gold', 'gem', 'stone', 'weapon'],
    imports: ['food', 'cloth', 'medicine', 'luxury'],
    wealthLevel: 50
  },
  'region_desert': {
    id: 'region_desert',
    name: 'Sun-Scorched Sands',
    exports: ['spice', 'glass', 'artifact'],
    imports: ['water', 'food', 'wood', 'metal'],
    wealthLevel: 40
  },
  'region_farmlands': {
    id: 'region_farmlands',
    name: 'Golden Fields',
    exports: ['food', 'livestock', 'cloth', 'leather'],
    imports: ['iron', 'tool', 'magic_item', 'luxury'],
    wealthLevel: 30
  },
  'region_plains': {
    id: 'region_plains',
    name: 'Great Plains',
    exports: ['livestock', 'grain', 'leather'],
    imports: ['wood', 'stone', 'metal'],
    wealthLevel: 35
  },
  'region_riverlands': {
    id: 'region_riverlands',
    name: 'River Valley',
    exports: ['wood', 'clay', 'herb', 'medicine'],
    imports: ['iron', 'salt', 'tool'],
    wealthLevel: 45
  },
  'region_forest': {
    id: 'region_forest',
    name: 'Deep Woods',
    exports: ['wood', 'herb', 'fur', 'game'],
    imports: ['metal', 'processed_food', 'salt'],
    wealthLevel: 25
  }
};
