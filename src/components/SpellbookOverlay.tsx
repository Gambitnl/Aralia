/**
 * @file SpellbookOverlay.tsx
 * A component for displaying a character's spellbook as a full-screen overlay.
 */
import React, { useState, useEffect, useContext, useMemo } from 'react';
import { PlayerCharacter, Spell, Action, AbilityScoreName, LimitedUseAbility, ResourceVial } from '../types';
import SpellContext from '../context/SpellContext';
import { CLASSES_DATA } from '../constants';
import Tooltip from './Tooltip';
import { getAbilityModifierValue } from '../utils/characterUtils';
import SingleGlossaryEntryModal from './Glossary/SingleGlossaryEntryModal';

interface SpellbookOverlayProps {
  isOpen: boolean;
  character: PlayerCharacter;
  onClose: () => void;
  onAction: (action: Action) => void;
}

const renderSpellSlots = (level: number, { current, max }: { current: number, max: number }) => {
  if (max === 0) return null;
  const slots = [];
  for (let i = 0; i < max; i++) {
    slots.push(
      <div 
        key={i} 
        className={`spell-slot-dot ${i < current ? 'available' : 'used'}`}
      />
    );
  }
  return (
    <div className="spell-slot-row">
      <span className="spell-slot-level-label">Level {level}</span>
      <div className="spell-slot-dots">{slots}</div>
      <span className="spell-slot-counter">({current}/{max})</span>
    </div>
  );
};

const resolveMaxValue = (char: PlayerCharacter, ability: LimitedUseAbility): number => {
    if (typeof ability.max === 'number') return ability.max;
    // This is a simplified version. A full implementation would check specific ability modifiers.
    if (ability.max === 'proficiency_bonus') return char.proficiencyBonus || 2;
    return 1;
};


const LeftPage: React.FC<{
    character: PlayerCharacter,
    onAction: (action: Action) => void,
    showAllSpells: boolean,
    onToggleShowAll: () => void,
}> = ({ character, onAction, showAllSpells, onToggleShowAll }) => {

  const { spellSlots, limitedUses } = character;

  return (
    <div className="spellbook-page spellbook-page-left scrollable-content">
      <h2 className="spell-level-header">Resources</h2>
      
      {spellSlots && (
        <div className="resource-container">
          <h3 className="resource-header">Spell Slots</h3>
          <div className="space-y-2">
            {Object.entries(spellSlots)
              .map(([key, value]) => ({ level: parseInt(key.replace('level_', ''), 10), ...(value as ResourceVial) }))
              .filter(slot => slot.max > 0)
              .sort((a, b) => a.level - b.level)
              .map(slot => renderSpellSlots(slot.level, slot))}
          </div>
        </div>
      )}
      
      {limitedUses && Object.keys(limitedUses).length > 0 && (
         <div className="resource-container">
          <h3 className="resource-header">Abilities</h3>
          <div className="space-y-1">
            {Object.values(limitedUses).map((ability: LimitedUseAbility) => (
                <div key={ability.name} className="limited-use-entry">
                    <span className="limited-use-name">{ability.name}</span>
                    <span className="limited-use-counter">{ability.current} / {resolveMaxValue(character, ability)}</span>
                </div>
            ))}
          </div>
        </div>
      )}

      <div className="toggle-spells-container">
          <label className="toggle-spells-label">
              <span>All Class Spells</span>
              <div className="toggle-switch">
                <input type="checkbox" checked={showAllSpells} onChange={onToggleShowAll} />
                <span className="toggle-slider"></span>
              </div>
          </label>
      </div>
      
      <div className="rest-buttons">
         <button onClick={() => onAction({ type: 'SHORT_REST', label: 'Take Short Rest' })} className="spellbook-action-button">Short Rest</button>
         <button onClick={() => onAction({ type: 'LONG_REST', label: 'Take Long Rest' })} className="spellbook-action-button">Long Rest</button>
      </div>

    </div>
  );
};

const RightPage: React.FC<{
    level: number;
    character: PlayerCharacter;
    allSpellsData: Record<string, Spell>;
    showAllSpells: boolean;
    onAction: (action: Action) => void;
    setInfoSpellId: (id: string | null) => void;
}> = ({ level, character, allSpellsData, showAllSpells, onAction, setInfoSpellId }) => {
    const { spellbook, spellSlots } = character;
    if (!spellbook) return null;
    
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

    let spellsToDisplay: Spell[] = [];

    if (showAllSpells) {
        // Show ALL class spells + any known racial spells
        const combinedIds = new Set([
            ...classSpellList.map(s => s.id),
            ...Array.from(knownSpellIds)
        ]);
        spellsToDisplay = Array.from(combinedIds)
            .map(id => allSpellsData[id])
            .filter((s): s is Spell => !!s && s.level === level);
    } else {
        // Show ONLY known spells (including racial ones that aren't in class list)
        spellsToDisplay = Array.from(knownSpellIds)
            .map(id => allSpellsData[id])
            .filter((s): s is Spell => !!s && s.level === level);
    }

    spellsToDisplay.sort((a,b) => a.name.localeCompare(b.name));

    const pageTitle = level === 0 ? "Cantrips" : `Level ${level} Spells`;

    const canCast = (spell: Spell) => spell.level === 0 || (spellSlots?.[`level_${spell.level}` as keyof typeof spellSlots]?.current ?? 0) > 0;
    
    return (
        <div className="spellbook-page spellbook-page-right scrollable-content">
            <h2 className="spell-level-header">{pageTitle}</h2>
            <div className="spell-grid">
                {spellsToDisplay.map(spell => {
                    const isAlwaysPrepared = character.class.id === 'druid' && spell.id === 'speak-with-animals';
                    const isKnown = knownSpellIds.has(spell.id);
                    const isPrepared = preparedSpellIds.has(spell.id) || isAlwaysPrepared;
                    const isCastable = isKnown && canCast(spell);

                    return (
                        <div key={spell.id} className={`spell-entry ${isKnown ? 'known' : 'unknown'}`}>
                            <div className="spell-entry-info">
                                <div className="icon">🪄</div>
                                <Tooltip content={spell.description}>
                                    <span className="name cursor-help">{spell.name}</span>
                                </Tooltip>
                            </div>
                            <div className="spell-entry-buttons">
                                <button className="spellbook-action-button" disabled={!isCastable} onClick={() => onAction({ type: 'CAST_SPELL', label: `Cast ${spell.name}`, payload: { characterId: character.id!, spellId: spell.id, spellLevel: spell.level } })}>
                                    Cast
                                </button>
                                {spell.level > 0 && (
                                    <button className="spellbook-action-button" disabled={isAlwaysPrepared} onClick={() => onAction({ type: 'TOGGLE_PREPARED_SPELL', label: 'Toggle Spell Prep', payload: { characterId: character.id!, spellId: spell.id }})}>
                                        {isPrepared ? (isAlwaysPrepared ? 'Always' : 'Unprep') : 'Prep'}
                                    </button>
                                )}
                                <button className="spellbook-action-button" onClick={() => setInfoSpellId(spell.id)}>
                                    Info
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};


const SpellbookOverlay: React.FC<SpellbookOverlayProps> = ({ isOpen, character, onClose, onAction }) => {
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [infoSpellId, setInfoSpellId] = useState<string | null>(null);
  const [showAllPossibleSpells, setShowAllPossibleSpells] = useState(false);
  const allSpellsData = useContext(SpellContext);

  useEffect(() => {
    if (isOpen) {
      setCurrentPageIndex(0);
      setShowAllPossibleSpells(false);
    }
  }, [isOpen]);
  
  if (!isOpen || !allSpellsData || !character.spellbook) {
    return null;
  }
  
  const classSpellList = CLASSES_DATA[character.class.id]?.spellcasting?.spellList ?? [];
  const maxSpellLevelCharCanCast = Math.max(0, ...Object.keys(character.spellSlots ?? {}).map(k => parseInt(k.replace('level_',''))));
  const pages = Array.from({ length: maxSpellLevelCharCanCast + 1 }, (_, i) => i);

  const handlePageTurn = (direction: 'next' | 'prev') => {
    setCurrentPageIndex(prev => {
      const newIndex = direction === 'next' ? prev + 1 : prev - 1;
      return Math.max(0, Math.min(newIndex, pages.length - 1));
    });
  };
  
  const currentLevel = pages[currentPageIndex];

  return (
    <>
      <div className="spellbook-overlay" onClick={onClose}>
        <div className="spellbook-container" onClick={(e) => e.stopPropagation()}>
          <LeftPage 
            character={character} 
            onAction={onAction}
            showAllSpells={showAllPossibleSpells}
            onToggleShowAll={() => setShowAllPossibleSpells(prev => !prev)}
          />
          <RightPage 
            level={currentLevel}
            character={character}
            allSpellsData={allSpellsData}
            showAllSpells={showAllPossibleSpells}
            onAction={onAction}
            setInfoSpellId={setInfoSpellId}
          />

          <div className="spellbook-pagination">
              <button className="pagination-button" onClick={() => handlePageTurn('prev')} disabled={currentPageIndex === 0}>
                  &#x276E;
              </button>
              <span className="page-number">Page {currentPageIndex + 1} of {pages.length}</span>
              <button className="pagination-button" onClick={() => handlePageTurn('next')} disabled={currentPageIndex === pages.length - 1}>
                  &#x276F;
              </button>
          </div>
           <button className="spellbook-close-button" onClick={onClose} aria-label="Close Spellbook">&times;</button>
        </div>
      </div>
      <SingleGlossaryEntryModal 
        isOpen={!!infoSpellId}
        initialTermId={infoSpellId}
        onClose={() => setInfoSpellId(null)}
      />
    </>
  );
};

export default SpellbookOverlay;