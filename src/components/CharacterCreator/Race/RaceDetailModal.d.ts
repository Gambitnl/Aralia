/**
 * @file RaceDetailModal.tsx
 * This component displays detailed information about a single race in a modal.
 * It's used by RaceSelection.tsx and features an updated layout and collapsible trait sections.
 */
import React from 'react';
export interface RaceForModal {
    id: string;
    name: string;
    image?: string;
    description: string;
    baseTraits: {
        type?: string;
        size?: string;
        speed?: number;
        darkvision?: number;
    };
    feats: {
        name: string;
        description: string;
    }[];
    furtherChoicesNote?: string;
}
interface RaceDetailModalProps {
    race: RaceForModal;
    onSelect: (raceId: string) => void;
    onClose: () => void;
}
declare const RaceDetailModal: React.FC<RaceDetailModalProps>;
export default RaceDetailModal;
