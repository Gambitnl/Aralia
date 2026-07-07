import type { RoomPurpose } from './blueprintTypes';

export interface TradeRoomDemand {
  purpose: RoomPurpose;
  /** Room must own a street-facing (min-y) outer edge. */
  streetFacing?: boolean;
  /** Room prefers adjacency to this purpose. */
  adjacentTo?: RoomPurpose;
}

const TABLE: Record<string, TradeRoomDemand[]> = {
  blacksmith:        [{ purpose: 'forge', streetFacing: true }],
  shopkeeper:        [{ purpose: 'shopfront', streetFacing: true },
                      { purpose: 'stockroom', adjacentTo: 'shopfront' }],
  innkeeper:         [{ purpose: 'kitchen' }, { purpose: 'guest-room' }],
  taverner:          [{ purpose: 'brewhouse', adjacentTo: 'kitchen' }, { purpose: 'cellar' }],
  'master artisan':  [{ purpose: 'workshop', streetFacing: true }],
  'town official':   [{ purpose: 'study' }],
  merchant:          [{ purpose: 'counting-room' }],
};

/** Demanded rooms per trade when worksAtHome. Unknown trade → [] (a
 *  labourer/farmer home has no trade room in town — legitimate, not fallback). */
export const tradeRoomsFor = (trade: string): TradeRoomDemand[] => TABLE[trade] ?? [];
