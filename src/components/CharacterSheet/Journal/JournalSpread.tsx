/**
 * @file src/components/CharacterSheet/JournalSpread.tsx
 * Parchment-styled two-page journal spread with narrative entries and session recaps.
 */
import React from 'react';
import { JournalEntry, JournalEvent } from '../../../types/journal';
import './JournalTab.css';
// GG-378: shared button style and control roles.
import { BTN_FOCUS_VISIBLE } from '../../../styles/buttonStyles';

interface JournalSpreadProps {
    entry: JournalEntry | null;
    onPreviousPage?: () => void;
    onNextPage?: () => void;
    hasPreviousPage?: boolean;
    hasNextPage?: boolean;
}

export const JournalSpread: React.FC<JournalSpreadProps> = ({
    entry,
    onPreviousPage,
    onNextPage,
    hasPreviousPage = false,
    hasNextPage = false,
}) => {
    if (!entry) {
        return (
            <div className="journal-spread journal-parchment">
                <div className="journal-empty-state">
                    <span className="journal-empty-icon">📖</span>
                    <p className="journal-empty-text">Your journal is empty.</p>
                    <p className="journal-empty-hint">Adventures and discoveries will be recorded here as you explore the world.</p>
                </div>
            </div>
        );
    }

    const formatEventIcon = (type: JournalEvent['type']): string => {
        const icons: Record<JournalEvent['type'], string> = {
            combat_victory: '⚔️',
            quest_accepted: '📜',
            quest_completed: '✅',
            quest_failed: '❌',
            item_acquired: '💎',
            location_discovered: '🗺️',
            npc_met: '👤',
            npc_conversation: '💬',
            level_up: '⬆️',
            party_change: '👥',
            rest: '🏕️',
            death: '💀',
            resurrection: '✨',
            merchant_trade: '💰',
            skill_check: '🎲',
            custom: '📝',
        };
        return icons[type] || '📝';
    };

    return (
        <div className="journal-spread journal-parchment">
            {/* Ribbon Bookmark */}
            <div className="journal-ribbon" />

            {/* Left Page - Narrative Entry */}
            <div className="journal-page journal-page-left">
                <div className="journal-page-header">
                    <div className="journal-session-info">
                        <span className="journal-session-label">Session {entry.sessionNumber}</span>
                        <h2 className="journal-page-title">JOURNAL ENTRY</h2>
                    </div>
                    <div className="journal-date-info">
                        <span className="journal-date-year">{entry.gameYear}</span>
                        <span className="journal-date-day">{entry.gameDate}</span>
                    </div>
                </div>

                {/* Narrative Text */}
                <div className="journal-narrative">
                    {entry.narrativeText.split('\n\n').map((paragraph, idx) => (
                        <p key={idx} className="journal-paragraph">{paragraph}</p>
                    ))}
                </div>

                {/* Sketches & Notes Section */}
                {entry.sketchNotes && (
                    <div className="journal-sketches-section">
                        <h4 className="journal-section-title">Sketches & Notes</h4>
                        <div className="journal-notes-content">
                            <p className="journal-handwritten">{entry.sketchNotes}</p>
                        </div>
                    </div>
                )}

                <div className="journal-page-number">PAGE {entry.pageNumber}</div>
            </div>

            {/* Center Binding */}
            <div className="journal-binding" />

            {/* Right Page - Session Recap */}
            <div className="journal-page journal-page-right">
                <div className="journal-recap-header">
                    <h2 className="journal-page-title">SESSION RECAP</h2>
                </div>

                {/* Key Events */}
                <section className="journal-section">
                    <h4 className="journal-section-title">Key Events</h4>
                    <ul className="journal-events-list">
                        {entry.recap.keyEvents.map(event => (
                            <li key={event.id} className="journal-event-item">
                                <span className={`journal-event-icon ${event.isQuestion ? 'text-amber-700' : 'text-green-700'}`}>
                                    {event.isCompleted ? '✓' : event.isQuestion ? '?' : '○'}
                                </span>
                                <span className={`journal-event-text ${event.isQuestion ? 'italic' : ''}`}>
                                    {event.description}
                                </span>
                            </li>
                        ))}
                    </ul>
                </section>

                {/* Spoils of War / Loot */}
                {entry.recap.loot.length > 0 && (
                    <section className="journal-section">
                        <h4 className="journal-section-title">Spoils of War</h4>
                        <div className="journal-loot-grid">
                            {entry.recap.loot.map(loot => (
                                <div key={loot.id} className="journal-loot-item">
                                    <div className={`journal-loot-icon ${loot.type === 'gold' ? 'bg-yellow-600/20' :
                                        loot.type === 'magical_item' ? 'bg-purple-600/20' : 'bg-slate-600/20'
                                        }`}>
                                        <span>{loot.type === 'gold' ? '💰' : loot.type === 'magical_item' ? '✨' : '📦'}</span>
                                    </div>
                                    <span className="journal-loot-name">
                                        {loot.quantity > 1 ? `${loot.quantity}x ` : ''}{loot.name}
                                    </span>
                                    {!loot.isIdentified && (
                                        <span className="journal-loot-unidentified">Unidentified</span>
                                    )}
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {/* Current Objectives */}
                {entry.recap.currentObjectives.length > 0 && (
                    <section className="journal-section">
                        <h4 className="journal-section-title">Current Objectives</h4>
                        <div className="journal-objectives-list">
                            {entry.recap.currentObjectives.map(obj => (
                                <div
                                    key={obj.id}
                                    className={`journal-objective ${obj.priority === 'primary' ? 'journal-objective-primary' : 'journal-objective-secondary'}`}
                                >
                                    <p className="journal-objective-text">{obj.description}</p>
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {/* Auto-logged Events (collapsed summary) */}
                {entry.autoLoggedEvents.length > 0 && (
                    <section className="journal-section journal-auto-events">
                        <h4 className="journal-section-title">Chronicle</h4>
                        <div className="journal-chronicle-list">
                            {entry.autoLoggedEvents.slice(0, 5).map(event => (
                                <div key={event.id} className="journal-chronicle-item">
                                    <span className="journal-chronicle-icon">{formatEventIcon(event.type)}</span>
                                    <span className="journal-chronicle-text">{event.title}</span>
                                </div>
                            ))}
                            {entry.autoLoggedEvents.length > 5 && (
                                <p className="journal-chronicle-more">
                                    +{entry.autoLoggedEvents.length - 5} more events...
                                </p>
                            )}
                        </div>
                    </section>
                )}

                {/* Page Navigation */}
                <div className="journal-page-navigation">
                    <button
                        onClick={onPreviousPage}
                        disabled={!hasPreviousPage}
                        className={`journal-nav-btn ${BTN_FOCUS_VISIBLE}`}
                        aria-label="Previous page"
                    >
                        ◀
                    </button>
                    <span className="journal-page-number-nav">PAGE {entry.pageNumber + 1}</span>
                    <button
                        onClick={onNextPage}
                        disabled={!hasNextPage}
                        className={`journal-nav-btn ${BTN_FOCUS_VISIBLE}`}
                        aria-label="Next page"
                    >
                        ▶
                    </button>
                </div>
            </div>
        </div>
    );
};

export default JournalSpread;
