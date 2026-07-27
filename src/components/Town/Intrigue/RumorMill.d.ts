/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/components/Town/Intrigue/RumorMill.tsx
 * UI component for the "Rumor Mill" - the intrigue interface within Taverns.
 * Allows players to buy gossip, secrets, and leads.
 */
import React from 'react';
import { Action, Item } from '../../../types';
interface RumorMillProps {
    merchantName: string;
    playerGold: number;
    playerInventory: Item[];
    onAction: (action: Action) => void;
}
export declare const RumorMill: React.FC<RumorMillProps>;
export {};
