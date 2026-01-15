/**
 * @file src/components/CharacterSheet/JournalTab.tsx
 * Main Journal tab component combining quest log sidebar and parchment journal spread.
 */
import React, { useState, useMemo } from 'react';
import { Quest } from '../../../types';
import { JournalEntry, JournalState, createInitialJournalState } from '../../../types/journal';
import { QuestLogSidebar } from './QuestLogSidebar';
import { JournalSpread } from './JournalSpread';
import './JournalTab.css';

interface JournalTabProps {
    quests: Quest[];
    journal?: JournalState;
}

/**
 * Creates a mock journal entry for demonstration when no entries exist.
 */
function createMockEntry(): JournalEntry {
    return {
        id: 'mock-entry-1',
        sessionNumber: 1,
        gameDate: 'The 14th of Kythorn',
        gameYear: 'Year 1492 DR',
        pageNumber: 1,
        narrativeText: `The adventure begins! Our party has gathered at the crossroads, each member carrying their own secrets and ambitions.

The air was thick with anticipation as we set out into the unknown. What trials await us? Only time will tell.

For now, we rest and prepare for what lies ahead.`,
        sketchNotes: 'Remember to stock up on supplies before heading into the wilderness.',
        recap: {
            sessionNumber: 1,
            keyEvents: [
                { id: 'event-1', description: 'Party formed at the crossroads', isCompleted: true },
                { id: 'event-2', description: 'Gathered initial supplies', isCompleted: true },
                { id: 'event-3', description: 'What lies beyond the forest edge?', isCompleted: false, isQuestion: true },
            ],
            loot: [],
            currentObjectives: [
                { id: 'obj-1', description: 'Explore the surrounding area', priority: 'primary' },
                { id: 'obj-2', description: 'Find shelter before nightfall', priority: 'secondary' },
            ],
            notes: '',
        },
        autoLoggedEvents: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
    };
}

export const JournalTab: React.FC<JournalTabProps> = ({
    quests,
    journal,
}) => {
    const [selectedQuestId, setSelectedQuestId] = useState<string | undefined>();
    const [currentEntryIndex, setCurrentEntryIndex] = useState(0);

    // Use journal state or create mock for empty state
    const journalState = journal ?? createInitialJournalState();

    // Get entries or show mock when empty
    const entries = useMemo(() => {
        if (journalState.entries.length > 0) {
            return journalState.entries;
        }
        // Return a mock entry for demonstration
        return [createMockEntry()];
    }, [journalState.entries]);

    const currentEntry = entries[currentEntryIndex] || null;

    const handleQuestSelect = (quest: Quest) => {
        setSelectedQuestId(quest.id);
    };

    const handlePreviousPage = () => {
        if (currentEntryIndex > 0) {
            setCurrentEntryIndex(currentEntryIndex - 1);
        }
    };

    const handleNextPage = () => {
        if (currentEntryIndex < entries.length - 1) {
            setCurrentEntryIndex(currentEntryIndex + 1);
        }
    };

    return (
        <div className="flex h-full overflow-hidden">
            {/* Quest Log Sidebar */}
            <QuestLogSidebar
                quests={quests}
                onQuestSelect={handleQuestSelect}
                selectedQuestId={selectedQuestId}
            />

            {/* Journal Content Area */}
            <div className="flex-1 bg-slate-900 p-6 overflow-y-auto flex items-start justify-center">
                <JournalSpread
                    entry={currentEntry}
                    onPreviousPage={handlePreviousPage}
                    onNextPage={handleNextPage}
                    hasPreviousPage={currentEntryIndex > 0}
                    hasNextPage={currentEntryIndex < entries.length - 1}
                />
            </div>
        </div>
    );
};

export default JournalTab;
