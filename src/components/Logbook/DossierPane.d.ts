/**
 * @file DossierPane.tsx
 * This component displays the player's "Dossier" (formerly Logbook),
 * showing details about NPCs they have met and their relationships.
 *
 * The logbook modal opens this pane when the player wants to review social
 * memory: who they have met, what those people want, and what facts each NPC
 * remembers. It keeps long NPC lists paged so the game can grow without making
 * the dossier unusable, and it preserves a split-pane reading layout on wide
 * screens while giving cramped windows a single scroll path.
 */
import React from 'react';
import { GameState, NPC } from '../../types';
interface DossierPaneProps {
    isOpen: boolean;
    onClose: () => void;
    metNpcIds: string[];
    npcMemory: GameState['npcMemory'];
    allNpcs: Record<string, NPC>;
}
declare const DossierPane: React.FC<DossierPaneProps>;
export default DossierPane;
