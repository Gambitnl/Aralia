/**
 * @file src/components/CharacterSheet/JournalTab.tsx
 * This file builds the Journal tab inside a character sheet.
 *
 * The tab keeps two related records together: a quest list on one side and the
 * party's narrative journal on the other. CharacterSheetModal chooses this tab,
 * then this file passes quest state into QuestLogSidebar and journal entries
 * into JournalSpread so the player can read both without leaving the sheet.
 */
import React, { useState, useMemo } from 'react';
import { Quest } from '../../../types';
import { JournalEntry, JournalState, createInitialJournalState } from '../../../types/journal';
import { QuestLogSidebar } from './QuestLogSidebar';
import { JournalSpread } from './JournalSpread';
import './JournalTab.css';

// ============================================================================
// Component Contract
// ============================================================================
// These props are the character sheet's journal payload. Quests power the left
// log column, while journal state powers the page spread on the right.
// ============================================================================
interface JournalTabProps {
    quests: Quest[];
    journal?: JournalState;
}

/**
 * Creates a starter journal entry when the save has no real journal pages yet.
 *
 * This preserves the journal feature as a visible in-progress system instead of
 * showing a blank panel to the player.
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

// ============================================================================
// Journal Tab
// ============================================================================
// This section decides which journal entry is selected and lays out the quest
// list beside the page spread. The named wrapper classes are important because
// the CSS switches this from a desktop two-column view to a stacked phone view.
// ============================================================================
export const JournalTab: React.FC<JournalTabProps> = ({
    quests,
    journal,
}) => {
    // Track the selected quest and page locally so the sheet can be browsed
    // without mutating the saved game until a real journal action occurs.
    const [selectedQuestId, setSelectedQuestId] = useState<string | undefined>();
    const [currentEntryIndex, setCurrentEntryIndex] = useState(0);

    // Use real journal state when available, otherwise fall back to an empty
    // state object so later logic can read the same shape every time.
    const journalState = journal ?? createInitialJournalState();

    // Keep the journal readable before the first real entry is written by
    // showing a starter page that explains the campaign's beginning.
    const entries = useMemo(() => {
        if (journalState.entries.length > 0) {
            return journalState.entries;
        }
        return [createMockEntry()];
    }, [journalState.entries]);

    const currentEntry = entries[currentEntryIndex] || null;

    // Remember which quest the player touched so the sidebar can mark it as
    // selected without taking over the journal page spread.
    const handleQuestSelect = (quest: Quest) => {
        setSelectedQuestId(quest.id);
    };

    // Move one page back when the journal has older entries.
    const handlePreviousPage = () => {
        if (currentEntryIndex > 0) {
            setCurrentEntryIndex(currentEntryIndex - 1);
        }
    };

    // Move one page forward when the journal has newer entries.
    const handleNextPage = () => {
        if (currentEntryIndex < entries.length - 1) {
            setCurrentEntryIndex(currentEntryIndex + 1);
        }
    };

    return (
        <div className="journal-tab-shell flex h-full overflow-hidden">
            <div className="journal-tab-quest-column">
                <QuestLogSidebar
                    quests={quests}
                    onQuestSelect={handleQuestSelect}
                    selectedQuestId={selectedQuestId}
                />
            </div>

            <div className="journal-tab-content-column flex-1 bg-slate-900 p-6 overflow-y-auto flex items-start justify-center">
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
