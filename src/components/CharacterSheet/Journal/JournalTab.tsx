/**
 * @file src/components/CharacterSheet/JournalTab.tsx
 * This file builds the Journal tab inside a character sheet.
 *
 * The tab keeps two related records together: a quest list on one side and the
 * party's narrative journal on the other. CharacterSheetModal chooses this tab,
 * then this file passes quest state into QuestLogSidebar and journal entries
 * into JournalSpread so the player can read both without leaving the sheet.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 31/10/2026, 15:20:52
 * Dependents: components/CharacterSheet/Journal/index.ts
 * Imports: 5 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import React, { useState } from 'react';
import { Quest } from '../../../types';
import { JournalState, createInitialJournalState } from '../../../types/journal';
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

    // An empty saved journal has no campaign account to display. Reuse the
    // spread's empty state; authored pages and quest records keep their identity.
    const entries = journalState.entries;

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
