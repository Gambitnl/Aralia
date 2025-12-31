
import { RegionalEconomy } from '../../types/economy';

export const REGIONAL_ECONOMIES: Record<string, RegionalEconomy> = {
  region_capital: {
    id: 'region_capital',
    name: 'Royal Capital',
    exports: ['luxury', 'clothing', 'book', 'magic_reagents'],
    imports: ['food', 'material', 'iron', 'wood'],
    wealthLevel: 100 // +100% price tolerance? No, wealthLevel logic is separate
  },
  region_coast: {
    id: 'region_coast',
    name: 'Coastal Cities',
    exports: ['food', 'fish', 'salt', 'pearls'],
    imports: ['iron', 'weapon', 'wood', 'luxury'],
    wealthLevel: 80
  },
  region_mountains: {
    id: 'region_mountains',
    name: 'Iron Peaks',
    exports: ['iron', 'stone', 'weapon', 'gem'],
    imports: ['food', 'clothing', 'wood', 'medicine'],
    wealthLevel: 60
  }
};
