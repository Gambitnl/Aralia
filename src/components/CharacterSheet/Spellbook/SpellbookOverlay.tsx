/**
 * @file SpellbookOverlay.tsx
 * A component for displaying a character's spellbook as a full-screen overlay.
 * Features a 2-column master-detail layout with spell list and inline glossary display.
 */
import React, { useState, useEffect, useContext, useMemo } from 'react';
import { PlayerCharacter, Spell, Action } from '../../../types';
import SpellContext from '../../../context/SpellContext';
import GlossaryContext from '../../../context/GlossaryContext';
import { CLASSES_DATA } from '../../../constants';
import { WindowFrame } from '../../ui/WindowFrame';
import { WINDOW_KEYS } from '../../../styles/uiIds';
import { FullEntryDisplay } from '../../Glossary/FullEntryDisplay';
import { findGlossaryEntryAndPath } from '../../../utils/glossaryUtils';
import SpellSlotDisplay from './SpellSlotDisplay';
import CastSpellControls from './CastSpellControls';
import { getPreparedSpellsAffectingLimit, isRacialSpellLockedForPreparation, getMaxPreparedSpells } from '../../../utils/character/characterUtils';

// Casters that pick spells permanently (no daily preparation step).
const KNOWN_CASTER_CLASS_IDS = ['bard', 'sorcerer', 'warlock', 'ranger'];

interface SpellbookOverlayProps {
  isOpen: boolean;
  character: PlayerCharacter;
  onClose: () => void;
  onAction: (action: Action) => void;
  /** Full party, used by the out-of-combat cast target picker. */
  party?: PlayerCharacter[];
}

const SpellbookOverlay: React.FC<SpellbookOverlayProps> = ({ isOpen, character, onClose, onAction, party }) => {
  const [currentLevel, setCurrentLevel] = useState(0);
  const [selectedSpellId, setSelectedSpellId] = useState<string | null>(null);
  const [showAllPossibleSpells, setShowAllPossibleSpells] = useState(false);
  const allSpellsData = useContext(SpellContext);
  const glossaryEntries = useContext(GlossaryContext);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setCurrentLevel(0);
      setSelectedSpellId(null);
      setShowAllPossibleSpells(false);
    }
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleEsc);
    }
    return () => {
      window.removeEventListener('keydown', handleEsc);
    };
  }, [isOpen, onClose]);

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

  // Auto-select first spell when level changes
  useEffect(() => {
    if (spellsToDisplay.length > 0 && !spellsToDisplay.find(s => s.id === selectedSpellId)) {
      setSelectedSpellId(spellsToDisplay[0].id);
    }
  }, [spellsToDisplay, selectedSpellId]);

  // Get glossary entry for selected spell
  const selectedSpellEntry = useMemo(() => {
    if (!selectedSpellId || !glossaryEntries) return null;
    const { entry } = findGlossaryEntryAndPath(selectedSpellId, glossaryEntries);
    return entry;
  }, [selectedSpellId, glossaryEntries]);

  // Full spell record (with effects) for the out-of-combat cast controls.
  const selectedSpell = useMemo(() => {
    if (!selectedSpellId || !allSpellsData) return null;
    return allSpellsData[selectedSpellId] || null;
  }, [selectedSpellId, allSpellsData]);

  // Readiness gate for the out-of-combat Cast button: cantrips must be known;
  // leveled spells must be prepared (or simply known for known-spell casters).
  const castReadiness = useMemo(() => {
    if (!selectedSpell) return { ready: false as const, reason: undefined as string | undefined };
    if (selectedSpell.level === 0) {
      return knownSpellIds.has(selectedSpell.id)
        ? { ready: true as const, reason: undefined }
        : { ready: false as const, reason: 'Not a known cantrip.' };
    }
    const isKnownCaster = KNOWN_CASTER_CLASS_IDS.includes(character.class.id.toLowerCase());
    const alwaysPrepared =
      isRacialSpellLockedForPreparation(character, selectedSpell.id) ||
      (character.class.id === 'druid' && selectedSpell.id === 'speak-with-animals');
    const ready = isKnownCaster
      ? knownSpellIds.has(selectedSpell.id)
      : preparedSpellIds.has(selectedSpell.id) || alwaysPrepared;
    return ready
      ? { ready: true as const, reason: undefined }
      : { ready: false as const, reason: isKnownCaster ? 'Not a known spell.' : 'Not prepared.' };
  }, [selectedSpell, character, knownSpellIds, preparedSpellIds]);

  if (!isOpen || !allSpellsData || !character.spellbook) {
    return null;
  }

  const pageTitle = currentLevel === 0 ? "Cantrips" : `Level ${currentLevel} Spells`;
  const preparedCount = getPreparedSpellsAffectingLimit(character).size;
  const maxPrepared = getMaxPreparedSpells(character);
  const isAtPrepLimit = maxPrepared !== null && preparedCount >= maxPrepared;

  return (
    <WindowFrame
      title="Spellbook"
      onClose={onClose}
      storageKey={WINDOW_KEYS.SPELLBOOK_OVERLAY}
      initialMaximized={false}
    >
      <div className="flex flex-col h-full">
        {/* Main Content */}
        <div className="flex-1 min-h-0 flex overflow-hidden">
          {/* Left Column - Spell List */}
          <div className="w-80 flex-shrink-0 border-r border-slate-700 flex flex-col bg-slate-800/30">
            {/* Level Tabs */}
            <div className="p-3 border-b border-slate-700 flex flex-wrap gap-1.5">
              {levels.map(level => (
                <button
                  key={level}
                  onClick={() => setCurrentLevel(level)}
                  className={`px-2.5 py-1 rounded text-xs font-medium transition-all ${currentLevel === level
                      ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/20'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600 hover:text-white'
                    }`}
                >
                  {level === 0 ? 'Cantrips' : `Lvl ${level}`}
                </button>
              ))}
            </div>

            {/* Spell List */}
            <div className="flex-1 overflow-y-auto p-3 scrollable-content">
              <h3 className="text-[10px] uppercase tracking-widest text-amber-400 font-bold mb-3 px-1">
                {pageTitle}
              </h3>

              {spellsToDisplay.length === 0 ? (
                <p className="text-slate-400 italic text-sm px-1">No spells at this level.</p>
              ) : (
                <div className="space-y-1">
                    {spellsToDisplay.map(spell => {
                    const isAlwaysPrepared = character.class.id === 'druid' && spell.id === 'speak-with-animals';
                    const isRacialAlwaysPrepared = isRacialSpellLockedForPreparation(character, spell.id);
                    const isKnown = knownSpellIds.has(spell.id);
                    const isPrepared = preparedSpellIds.has(spell.id) || isAlwaysPrepared || isRacialAlwaysPrepared;
                    const isLocked = isAlwaysPrepared || isRacialAlwaysPrepared;
                    const isSelected = selectedSpellId === spell.id;

                    return (
                      <div
                        key={spell.id}
                        onClick={() => setSelectedSpellId(spell.id)}
                        className={`group flex items-center justify-between p-2.5 rounded-lg cursor-pointer transition-all ${isSelected
                            ? 'bg-purple-500/20 border-l-4 border-purple-500'
                            : isKnown
                              ? 'hover:bg-slate-700/50 border-l-4 border-transparent'
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
                              {isAlwaysPrepared || isRacialAlwaysPrepared ? 'Always' : 'Prep'}
                                </span>
                            )}
                        </div>

                        {/* Prepare/Unprepare button - only for leveled spells */}
                        {spell.level > 0 && isKnown && (
                          <button
                            className={`opacity-0 group-hover:opacity-100 px-2 py-0.5 text-[10px] font-bold uppercase rounded transition-all ${isPrepared && !isLocked
                                ? 'bg-slate-600 text-slate-200 hover:bg-slate-500'
                                : isAtPrepLimit && !isPrepared
                                  ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                                  : 'bg-purple-600/80 text-white hover:bg-purple-500'
                              }`}
                            disabled={isLocked || (!isPrepared && isAtPrepLimit)}
                            onClick={(e) => {
                              e.stopPropagation();
                              onAction({
                                type: 'TOGGLE_PREPARED_SPELL',
                                label: 'Toggle Spell Prep',
                                payload: { characterId: character.id!, spellId: spell.id }
                              });
                            }}
                          >
                            {isPrepared ? (isLocked ? '—' : 'Unprep') : 'Prep'}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Right Column - Spell Details */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Right Header - Spell Slots & Toggle */}
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

            {/* Out-of-combat casting bar for the selected spell */}
            {selectedSpell && (
              <CastSpellControls
                spell={selectedSpell}
                character={character}
                party={party}
                isReadyToCast={castReadiness.ready}
                notReadyReason={castReadiness.reason}
                onAction={onAction}
              />
            )}

            {/* Spell Detail Pane */}
            <div className="flex-1 overflow-y-auto p-6 scrollable-content">
              {selectedSpellEntry ? (
                <FullEntryDisplay
                  entry={selectedSpellEntry}
                  onNavigate={(termId) => setSelectedSpellId(termId)}
                />
              ) : selectedSpellId ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-400">
                  <span className="material-symbols-outlined text-4xl mb-2">search_off</span>
                  <p>Spell details not found in glossary.</p>
                  <p className="text-sm">ID: {selectedSpellId}</p>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-slate-400">
                  <span className="material-symbols-outlined text-4xl mb-2">touch_app</span>
                  <p>Select a spell to view details</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </WindowFrame>
  );
};

export default SpellbookOverlay;
