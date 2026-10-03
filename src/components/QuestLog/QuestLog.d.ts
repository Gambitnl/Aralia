import React from 'react';
import { Quest } from '../../types';
interface QuestLogProps {
    isOpen: boolean;
    onClose: () => void;
    quests: Quest[];
}
declare const QuestLog: React.FC<QuestLogProps>;
export default QuestLog;
