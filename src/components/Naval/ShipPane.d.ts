import React from 'react';
import { Ship, VoyageState } from '../../types/naval';
interface ShipPaneProps {
    ship: Ship;
    onClose: () => void;
    voyage?: VoyageState | null;
    onAdvanceDay?: () => void;
}
export declare const ShipPane: React.FC<ShipPaneProps>;
export {};
