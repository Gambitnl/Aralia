import type { RoomPurpose } from './blueprintTypes';
export interface TradeRoomDemand {
    purpose: RoomPurpose;
    /** Room must own a street-facing (min-y) outer edge. */
    streetFacing?: boolean;
    /** Room prefers adjacency to this purpose. */
    adjacentTo?: RoomPurpose;
}
/** Demanded rooms per trade when worksAtHome. Unknown trade → [] (a
 *  labourer/farmer home has no trade room in town — legitimate, not fallback). */
export declare const tradeRoomsFor: (trade: string) => TradeRoomDemand[];
