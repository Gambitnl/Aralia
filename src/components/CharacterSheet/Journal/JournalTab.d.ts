/**
 * @file src/components/CharacterSheet/JournalTab.tsx
 * This file builds the Journal tab inside a character sheet.
 *
 * The tab keeps two related records together: a quest list on one side and the
 * party's narrative journal on the other. CharacterSheetModal chooses this tab,
 * then this file passes quest state into QuestLogSidebar and journal entries
 * into JournalSpread so the player can read both without leaving the sheet.
 */
import React from 'react';
import { Quest } from '../../../types';
import { JournalState } from '../../../types/journal';
import './JournalTab.css';
interface JournalTabProps {
    quests: Quest[];
    journal?: JournalState;
}
export declare const JournalTab: React.FC<JournalTabProps>;
export default JournalTab;
