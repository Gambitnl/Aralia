/**
 * @file DiscoveryLogPane.tsx
 * This component displays the player's discovery journal in a modal.
 * It allows browsing, filtering, and searching of discovered entries.
 */
import React from 'react';
import { GameState, DiscoveryEntry, NPC } from '../../types';
interface DiscoveryLogPaneProps {
    isOpen: boolean;
    entries: DiscoveryEntry[];
    unreadCount: number;
    onClose: () => void;
    onMarkRead: (entryId: string) => void;
    onMarkAllRead: () => void;
    npcMemory: GameState['npcMemory'];
    allNpcs: Record<string, NPC>;
}
declare const DiscoveryLogPane: React.FC<DiscoveryLogPaneProps>;
export default DiscoveryLogPane;
