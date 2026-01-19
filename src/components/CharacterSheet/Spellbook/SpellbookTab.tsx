/**
 * @file SpellbookTab.tsx
 * Tab version of spellbook display for the character sheet.
 * Shows spell slots, abilities, and spell list with casting functionality.
 * 2-column master-detail layout with inline glossary display.
 */
import React, { useState, useContext, useMemo, useEffect } from 'react';
import { PlayerCharacter, Spell, Action } from '../../../types';
import SpellContext from '../../../context/SpellContext';
import { CLASSES_DATA } from '../../../constants';
import { getMaxPreparedSpells } from '../../../utils/character/characterUtils';
import SpellSlotDisplay from './SpellSlotDisplay';
import SpellDetailPane from './SpellDetailPane';

interface SpellbookTabProps {
    character: PlayerCharacter;
    onAction: (action: Action) => void;
}

const SpellbookTab: React.FC<SpellbookTabProps> = ({ character, onAction }) => {
    const [currentLevel, setCurrentLevel] = useState(0);
    const [selectedSpellId, setSelectedSpellId] = useState<string | null>(null);
    const [showAllPossibleSpells, setShowAllPossibleSpells] = useState(false);
    const allSpellsData = useContext(SpellContext);

    // Compute spell lists
    const { spellsToDisplay, knownSpellIds, preparedSpellIds, levels } = useMemo(() => {
        if (!allSpellsData || !character.spellbook) {
            return { spellsToDisplay: [], knownSpellIds: new Set<string>(), preparedSpellIds: new Set<string>(), levels: [0] };
        }

        const { spellbook, spellSlots } = character;
        const maxSpellLevelCharCanCast = Math.max(0, ...Object.keys(spellSlots ?? {}).map(k => parseInt(k.replace('level_', ''))));
        const lvls = Array.from({ length: maxSpellLevelCharCanCast + 1 }, (_, i) => i);

        const classData = CLASSES_DATA[character.class.id];
        const classSpellList = classData?.spellcasting?.spellList
            .map(id => allSpellsData[id])
            .filter((s): s is Spell => !!s) ?? [];

        const known = new Set([
            ...(spellbook.cantrips ?? []),
            ...(spellbook.preparedSpells ?? []),
            ...(spellbook.knownSpells ?? [])
        ]);

        const prepared = new Set(spellbook.preparedSpells ?? []);

        let spells: Spell[] = [];
        if (showAllPossibleSpells) {
            const combinedIds = new Set([
                ...classSpellList.map(s => s.id),
                ...Array.from(known)
            ]);
            spells = Array.from(combinedIds)
                .map(id => allSpellsData[id])
                .filter((s): s is Spell => !!s && s.level === currentLevel);
        } else {
            spells = Array.from(known)
                .map(id => allSpellsData[id])
                .filter((s): s is Spell => !!s && s.level === currentLevel);
        }
        spells.sort((a, b) => a.name.localeCompare(b.name));

        return { spellsToDisplay: spells, knownSpellIds: known, preparedSpellIds: prepared, levels: lvls };
    }, [allSpellsData, character, currentLevel, showAllPossibleSpells]);

    // Auto-select first spell when level changes or list updates
    useEffect(() => {
        if (spellsToDisplay.length > 0 && !spellsToDisplay.find(s => s.id === selectedSpellId)) {
            setSelectedSpellId(spellsToDisplay[0].id);
        }
    }, [spellsToDisplay, selectedSpellId]);

    // Get selected spell from SpellContext
    const selectedSpell = useMemo(() => {
        if (!selectedSpellId || !allSpellsData) return null;
        return allSpellsData[selectedSpellId] || null;
    }, [selectedSpellId, allSpellsData]);

    if (!allSpellsData || !character.spellbook) {
        return (
            <div className="h-full flex items-center justify-center">
                <p className="text-gray-500">No spellbook data available.</p>
            </div>
        );
    }

    const pageTitle = currentLevel === 0 ? "Cantrips" : `Level ${currentLevel} Spells`;

    // Calculate prepared spell count and limit
    const preparedCount = preparedSpellIds.size;
    const maxPrepared = getMaxPreparedSpells(character);
    const isAtPrepLimit = maxPrepared !== null && preparedCount >= maxPrepared;

    return (
        <div className="h-full flex overflow-hidden rounded-lg border border-slate-700/50 bg-slate-900/50">
            {/* Left Column - Spell List */}
            <div className="w-80 flex-shrink-0 border-r border-slate-700 flex flex-col bg-slate-800/30">
                {/* Level Tabs */}
                <div className="p-3 border-b border-slate-700 flex flex-wrap gap-1.5">
                    {levels.map(level => (
                        <button
                            key={level}
                            onClick={() => setCurrentLevel(level)}
                            className={`px-2.5 py-1 rounded text-xs font-semibold transition-all ${currentLevel === level
                                ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/20'
                                : 'bg-slate-700 text-slate-400 hover:bg-slate-600 hover:text-white'
                                }`}
                        >
                            {level === 0 ? 'Cantrips' : `Lvl ${level}`}
                        </button>
                    ))}
                </div>

                {/* Spell List */}
                <div className="flex-1 overflow-y-auto p-3 scrollable-content">
                    <h3 className="text-[10px] uppercase tracking-widest text-amber-400 font-bold mb-3 px-1 opacity-80">
                        {pageTitle}
                    </h3>

                    {spellsToDisplay.length === 0 ? (
                        <p className="text-slate-500 italic text-sm px-1">No spells at this level.</p>
                    ) : (
                        <div className="space-y-1">
                            {spellsToDisplay.map(spell => {
                                const isAlwaysPrepared = character.class.id === 'druid' && spell.id === 'speak-with-animals';
                                const isKnown = knownSpellIds.has(spell.id);
                                const isPrepared = preparedSpellIds.has(spell.id) || isAlwaysPrepared;
                                const isSelected = selectedSpellId === spell.id;

                                return (
                                    <div
                                        key={spell.id}
                                        onClick={() => setSelectedSpellId(spell.id)}
                                        className={`group flex items-center justify-between p-2.5 rounded-lg cursor-pointer transition-all ${isSelected
                                            ? 'bg-purple-500/20 border-l-4 border-purple-500'
                                            : isKnown
                                                ? 'hover:bg-slate-700/50 border-l-4 border-transparent hover:border-slate-600'
                                                : 'opacity-50 hover:opacity-80 hover:bg-slate-700/30 border-l-4 border-transparent grayscale hover:grayscale-0'
                                            }`}
                                    >
                                        <div className="flex items-center gap-2 min-w-0">
                                            <span className={`material-symbols-outlined text-base ${isSelected ? 'text-purple-400' : 'text-slate-500 group-hover:text-purple-400'
                                                }`}>
                                                auto_fix_high
                                            </span>
                                            <span className={`text-sm truncate ${isSelected ? 'text-white font-medium' : 'text-slate-200'
                                                }`}>
                                                {spell.name}
                                            </span>
                                            {isPrepared && (
                                                <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-bold tracking-wider flex-shrink-0">
                                                    {isAlwaysPrepared ? 'Always' : 'Prep'}
                                                </span>
                                            )}
                                            {!isPrepared && isKnown && spell.level > 0 && (
                                                <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-slate-700 text-slate-500 border border-slate-600/50 font-bold tracking-wider flex-shrink-0">
                                                    Unprepared
                                                </span>
                                            )}
                                        </div>
                                        {/* Prepare/Unprepare button - only for leveled spells */}
                                        {spell.level > 0 && isKnown && (
                                            <button
                                                className={`opacity-0 group-hover:opacity-100 px-2 py-0.5 text-[10px] font-bold uppercase rounded transition-all ${isPrepared && !isAlwaysPrepared
                                                    ? 'bg-slate-600 text-slate-200 hover:bg-slate-500'
                                                    : isAtPrepLimit && !isPrepared
                                                        ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                                                        : 'bg-purple-600/80 text-white hover:bg-purple-500'
                                                    }`}
                                                disabled={isAlwaysPrepared || (!isPrepared && isAtPrepLimit)}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onAction({
                                                        type: 'TOGGLE_PREPARED_SPELL',
                                                        label: 'Toggle Spell Prep',
                                                        payload: { characterId: character.id!, spellId: spell.id }
                                                    });
                                                }}
                                            >
                                                {isPrepared ? (isAlwaysPrepared ? '—' : 'Unprep') : 'Prep'}
                                            </button>
                                        )
                                        }
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* Right Column - Spell Details */}
            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Right Header - Spell Slots, Prepared Count & Toggle */}
                <div className="flex items-center justify-between px-6 py-3 border-b border-slate-700 bg-slate-800/20">
                    <div className="flex items-center gap-4">
                        <SpellSlotDisplay spellSlots={character.spellSlots} />
                        {maxPrepared !== null && (
                            <div className="flex items-center gap-1.5">
                                <span className="text-xs text-slate-400">Prepared</span>
                                <span className={`text-sm font-bold ${isAtPrepLimit ? 'text-amber-400' : 'text-purple-400'}`}>
                                    {preparedCount} / {maxPrepared}
                                </span>
                            </div>
                        )}
                    </div>

                    <label className="flex items-center gap-2 cursor-pointer group">
                        <span className="text-sm text-slate-400 group-hover:text-slate-200 transition-colors">
                            Show All Class Spells
                        </span>
                        <div className="relative">
                            <input
                                type="checkbox"
                                checked={showAllPossibleSpells}
                                onChange={() => setShowAllPossibleSpells(!showAllPossibleSpells)}
                                className="sr-only peer"
                            />
                            <div className="w-9 h-5 bg-slate-700 rounded-full peer peer-checked:bg-purple-600 transition-colors" />
                            <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-4" />
                        </div>
                    </label>
                </div>

                {/* Spell Detail Pane */}
                <div className="flex-1 overflow-y-auto p-6 scrollable-content">
                    {selectedSpell ? (
                        <SpellDetailPane spell={selectedSpell} />
                    ) : selectedSpellId ? (
                        <div className="flex flex-col items-center justify-center h-full text-slate-500">
                            <span className="material-symbols-outlined text-4xl mb-2">search_off</span>
                            <p>Spell data not found.</p>
                            <p className="text-sm">ID: {selectedSpellId}</p>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-slate-500">
                            <span className="material-symbols-outlined text-4xl mb-2">touch_app</span>
                            <p>Select a spell to view details</p>
                        </div>
                    )}
                </div>
            </div>
        </div >
    );
};

export default SpellbookTab;
