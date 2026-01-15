/**
 * @file SpellbookTab.tsx
 * Tab version of spellbook display for the character sheet.
 * Shows spell slots, abilities, and spell list with casting functionality.
 */
import React, { useState, useContext } from 'react';
import { PlayerCharacter, Spell, Action, LimitedUseAbility } from '../../../types';
import SpellContext from '../../../context/SpellContext';
import { CLASSES_DATA } from '../../../constants';
import Tooltip from '../../ui/Tooltip';
import SingleGlossaryEntryModal from '../../Glossary/SingleGlossaryEntryModal';

interface SpellbookTabProps {
    character: PlayerCharacter;
    onAction: (action: Action) => void;
}

const resolveMaxValue = (char: PlayerCharacter, ability: LimitedUseAbility): number => {
    if (typeof ability.max === 'number') return ability.max;
    if (ability.max === 'proficiency_bonus') return char.proficiencyBonus || 2;
    return 1;
};

const SpellbookTab: React.FC<SpellbookTabProps> = ({ character, onAction }) => {
    const [currentLevel, setCurrentLevel] = useState(0);
    const [showAllPossibleSpells, setShowAllPossibleSpells] = useState(false);
    const [infoSpellId, setInfoSpellId] = useState<string | null>(null);
    const allSpellsData = useContext(SpellContext);

    if (!allSpellsData || !character.spellbook) {
        return (
            <div className="h-full flex items-center justify-center">
                <p className="text-gray-500">No spellbook data available.</p>
            </div>
        );
    }

    const { spellbook, spellSlots, limitedUses } = character;
    const limitedUseAbilities = limitedUses ? Object.values(limitedUses) : [];
    const maxSpellLevelCharCanCast = Math.max(0, ...Object.keys(spellSlots ?? {}).map(k => parseInt(k.replace('level_', ''))));
    const levels = Array.from({ length: maxSpellLevelCharCanCast + 1 }, (_, i) => i);

    const classData = CLASSES_DATA[character.class.id];
    const classSpellList = classData?.spellcasting?.spellList
        .map(id => allSpellsData[id])
        .filter((s): s is Spell => !!s) ?? [];

    const knownSpellIds = new Set([
        ...(spellbook.cantrips ?? []),
        ...(spellbook.preparedSpells ?? []),
        ...(spellbook.knownSpells ?? [])
    ]);

    const preparedSpellIds = new Set(spellbook.preparedSpells ?? []);

    // Get spells for current level
    let spellsToDisplay: Spell[] = [];
    if (showAllPossibleSpells) {
        const combinedIds = new Set([
            ...classSpellList.map(s => s.id),
            ...Array.from(knownSpellIds)
        ]);
        spellsToDisplay = Array.from(combinedIds)
            .map(id => allSpellsData[id])
            .filter((s): s is Spell => !!s && s.level === currentLevel);
    } else {
        spellsToDisplay = Array.from(knownSpellIds)
            .map(id => allSpellsData[id])
            .filter((s): s is Spell => !!s && s.level === currentLevel);
    }
    spellsToDisplay.sort((a, b) => a.name.localeCompare(b.name));

    const canCast = (spell: Spell) => spell.level === 0 || (spellSlots?.[`level_${spell.level}` as keyof typeof spellSlots]?.current ?? 0) > 0;

    const pageTitle = currentLevel === 0 ? "Cantrips" : `Level ${currentLevel} Spells`;

    return (
        <>
            <div className="h-full flex gap-4 overflow-hidden">
                {/* Left Panel - Resources */}
                <div className="w-64 flex-shrink-0 bg-gray-800/50 rounded-lg p-4 overflow-y-auto scrollable-content">
                    <h3 className="text-lg font-semibold text-amber-400 mb-4">Resources</h3>

                    {/* Spell Slots */}
                    {spellSlots && Object.keys(spellSlots).length > 0 && (
                        <div className="mb-6">
                            <h4 className="text-sm font-medium text-gray-400 mb-2">Spell Slots</h4>
                            <div className="space-y-2">
                                {Object.entries(spellSlots).map(([key, slot]) => {
                                    if (slot.max === 0) return null;
                                    const level = key.replace('level_', '');
                                    return (
                                        <div key={key} className="flex items-center justify-between text-sm">
                                            <span className="text-gray-300">Level {level}</span>
                                            <span className="text-purple-300">{slot.current} / {slot.max}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Limited Use Abilities */}
                    {limitedUseAbilities.length > 0 && (
                        <div className="mb-6">
                            <h4 className="text-sm font-medium text-gray-400 mb-2">Abilities</h4>
                            <div className="space-y-2">
                                {limitedUseAbilities.map((ability: LimitedUseAbility) => (
                                    <div key={ability.name} className="flex items-center justify-between text-sm">
                                        <span className="text-gray-300 truncate">{ability.name}</span>
                                        <span className="text-amber-300">{ability.current} / {resolveMaxValue(character, ability)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Toggle All Spells */}
                    <div className="mb-4">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={showAllPossibleSpells}
                                onChange={() => setShowAllPossibleSpells(!showAllPossibleSpells)}
                                className="rounded"
                            />
                            <span className="text-sm text-gray-300">Show All Class Spells</span>
                        </label>
                    </div>

                    {/* Rest Buttons */}
                    <div className="space-y-2">
                        <button
                            onClick={() => onAction({ type: 'SHORT_REST', label: 'Take Short Rest' })}
                            className="w-full px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm text-white transition-colors"
                        >
                            Short Rest
                        </button>
                        <button
                            onClick={() => onAction({ type: 'LONG_REST', label: 'Take Long Rest' })}
                            className="w-full px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm text-white transition-colors"
                        >
                            Long Rest
                        </button>
                    </div>
                </div>

                {/* Right Panel - Spells */}
                <div className="flex-1 flex flex-col overflow-hidden">
                    {/* Level Tabs */}
                    <div className="flex gap-1 mb-4 overflow-x-auto pb-2">
                        {levels.map(level => (
                            <button
                                key={level}
                                onClick={() => setCurrentLevel(level)}
                                className={`px-3 py-1.5 text-sm rounded-lg transition-colors whitespace-nowrap ${currentLevel === level
                                    ? 'bg-purple-600 text-white'
                                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                    }`}
                            >
                                {level === 0 ? 'Cantrips' : `Level ${level}`}
                            </button>
                        ))}
                    </div>

                    {/* Spell List */}
                    <div className="flex-1 overflow-y-auto scrollable-content">
                        <h3 className="text-lg font-semibold text-purple-300 mb-3">{pageTitle}</h3>

                        {spellsToDisplay.length === 0 ? (
                            <p className="text-gray-500 italic">No spells at this level.</p>
                        ) : (
                            <div className="grid gap-2">
                                {spellsToDisplay.map(spell => {
                                    const isAlwaysPrepared = character.class.id === 'druid' && spell.id === 'speak-with-animals';
                                    const isKnown = knownSpellIds.has(spell.id);
                                    const isPrepared = preparedSpellIds.has(spell.id) || isAlwaysPrepared;
                                    const isCastable = isKnown && canCast(spell);

                                    return (
                                        <div
                                            key={spell.id}
                                            className={`flex items-center justify-between p-3 rounded-lg border ${isKnown
                                                ? 'bg-gray-800/50 border-gray-700'
                                                : 'bg-gray-800/20 border-gray-800 opacity-60'
                                                }`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <span className="text-lg">🪄</span>
                                                <div>
                                                    <Tooltip content={spell.description}>
                                                        <span className="text-white font-medium cursor-help">{spell.name}</span>
                                                    </Tooltip>
                                                    {isPrepared && (
                                                        <span className="ml-2 text-xs px-1.5 py-0.5 bg-green-900/50 text-green-400 rounded">
                                                            {isAlwaysPrepared ? 'Always' : 'Prepared'}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex gap-2">
                                                <button
                                                    className="px-3 py-1 bg-purple-600 hover:bg-purple-500 disabled:bg-gray-700 disabled:text-gray-500 text-white text-sm rounded transition-colors"
                                                    disabled={!isCastable}
                                                    onClick={() => onAction({
                                                        type: 'CAST_SPELL',
                                                        label: `Cast ${spell.name}`,
                                                        payload: { characterId: character.id!, spellId: spell.id, spellLevel: spell.level }
                                                    })}
                                                >
                                                    Cast
                                                </button>
                                                {spell.level > 0 && (
                                                    <button
                                                        className="px-3 py-1 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white text-sm rounded transition-colors"
                                                        disabled={isAlwaysPrepared}
                                                        onClick={() => onAction({
                                                            type: 'TOGGLE_PREPARED_SPELL',
                                                            label: 'Toggle Spell Prep',
                                                            payload: { characterId: character.id!, spellId: spell.id }
                                                        })}
                                                    >
                                                        {isPrepared ? 'Unprep' : 'Prep'}
                                                    </button>
                                                )}
                                                <button
                                                    className="px-3 py-1 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded transition-colors"
                                                    onClick={() => setInfoSpellId(spell.id)}
                                                >
                                                    Info
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Spell Info Modal */}
            <SingleGlossaryEntryModal
                isOpen={!!infoSpellId}
                initialTermId={infoSpellId}
                onClose={() => setInfoSpellId(null)}
            />
        </>
    );
};

export default SpellbookTab;
