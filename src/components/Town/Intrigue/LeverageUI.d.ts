import React from 'react';
import { Action, Faction } from '../../../types';
import { Secret } from '../../../types/identity';
interface LeverageUIProps {
    knownSecrets: Secret[];
    factions: Record<string, Faction>;
    factionStandings: Record<string, number>;
    onAction: (action: Action) => void;
    messages: {
        text: string;
        sender: string;
    }[];
}
export declare const LeverageUI: React.FC<LeverageUIProps>;
export {};
