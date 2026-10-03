import React from 'react';
import { GuildService } from '../../../types/crime';
/**
 * FenceInterface is the Thieves' Guild selling screen for suspicious goods.
 *
 * It lets the player sell inventory to a fence at a markdown, then dispatches a
 * dedicated fence-sale action so the inventory/gold update and the crime heat
 * consequence stay tied to the same player choice.
 */
interface FenceInterfaceProps {
    service: GuildService;
    onClose: () => void;
}
declare const FenceInterface: React.FC<FenceInterfaceProps>;
export default FenceInterface;
