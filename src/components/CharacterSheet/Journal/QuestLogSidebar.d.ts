/**
 * @file src/components/CharacterSheet/QuestLogSidebar.tsx
 * Quest log sidebar component showing active and completed quests.
 */
import React from 'react';
import { Quest } from '../../../types';
interface QuestLogSidebarProps {
    quests: Quest[];
    onQuestSelect?: (quest: Quest) => void;
    selectedQuestId?: string;
}
export declare const QuestLogSidebar: React.FC<QuestLogSidebarProps>;
export default QuestLogSidebar;
