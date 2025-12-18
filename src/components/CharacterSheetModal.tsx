
/**
 * @file CharacterSheetModal.tsx
 * This component displays a modal with detailed character information,
 * including stats, skills, spells, an equipment mannequin, and inventory with actions.
 * Inventory display is now handled by the InventoryList component.
 * SkillDetailDisplay is now a separate overlay triggered from this modal.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { PlayerCharacter, Item, EquipmentSlotType, Action, AbilityScoreName } from '../types';
import EquipmentMannequin from './EquipmentMannequin';
import InventoryList from './InventoryList'; 
import SkillDetailDisplay from './CharacterSheet/SkillDetailDisplay';
import SpellbookOverlay from './SpellbookOverlay'; // Import the new SpellbookOverlay component
import { getAbilityModifierValue, getAbilityModifierString, getCharacterRaceDisplayString } from '../utils/characterUtils';
import Tooltip from './Tooltip';
// Glossary modal is nested under the Glossary folder to keep related UI together
import SingleGlossaryEntryModal from './Glossary/SingleGlossaryEntryModal'; // This component handles its own visibility based on termId
import { FEATS_DATA } from '../data/feats/featsData';


interface CharacterSheetModalProps {
  isOpen: boolean;
  character: PlayerCharacter | null;
  inventory: Item[]; 
  gold: number;
  onClose: () => void;
  onAction: (action: Action) => void; 
  onNavigateToGlossary?: (termId: string) => void; // For glossary navigation
}

type SheetTab = 'overview'; // Spellbook is now an overlay, not a tab view

const CharacterSheetModal: React.FC<CharacterSheetModalProps> = ({ 
  isOpen, 
  character, 
  inventory, 
  gold,
  onClose, 
  onAction,
  onNavigateToGlossary 
}) => {
  const [isSkillDetailOverlayOpen, setIsSkillDetailOverlayOpen] = useState(false);
  const [isSpellbookOpen, setIsSpellbookOpen] = useState(false); // State for the spellbook overlay
  const [activeTab, setActiveTab] = useState<SheetTab>('overview');
  const [filterBySlot, setFilterBySlot] = useState<EquipmentSlotType | null>(null); // State for inventory filtering

  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (isSpellbookOpen) {
          setIsSpellbookOpen(false);
        } else if (isSkillDetailOverlayOpen) {
          setIsSkillDetailOverlayOpen(false);
        } else {
          onClose();
        }
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleEsc);
    }
    // Reset to overview tab when modal opens or character changes
    setActiveTab('overview');
    return () => {
      window.removeEventListener('keydown', handleEsc);
    };
  }, [isOpen, onClose, isSkillDetailOverlayOpen, isSpellbookOpen]);

  const handleSlotClick = (slot: EquipmentSlotType, item?: Item) => {
    if (item && character) {
      // If item is equipped, unequip it
      onAction({ type: 'UNEQUIP_ITEM', label: `Unequip ${item.name}`, payload: { slot, characterId: character.id! }});
    } else {
      // If slot is empty, toggle filter mode for that slot
      setFilterBySlot(filterBySlot === slot ? null : slot);
    }
  };
  
  const proficiencies = useMemo(() => {
    if (!character) return { armor: 'None', weapons: 'None', tools: [], languages: [] };

    const armorProfs = character.class.armorProficiencies?.join(', ') || 'None';
    const weaponProfs = character.class.weaponProficiencies?.join(', ') || 'None';
    
    const toolProfs = new Set<string>();
    const langProfs = new Set<string>();

    // Tools from Class Features
    character.class.features?.forEach(f => {
      if (f.id === 'artificer_tool_proficiencies') {
        toolProfs.add("Thieves' Tools");
        toolProfs.add("Tinker's Tools");
        toolProfs.add("Artisan's Tools (Choice)");
      }
    });
    
    // Tools from Race Traits
    character.race.traits?.forEach(t => {
      const lowerTrait = t.toLowerCase();
      if (lowerTrait.includes("tinker's tools")) {
        toolProfs.add("Tinker's Tools");
      }
      if (lowerTrait.includes("artisan's tools")) {
        toolProfs.add("Artisan's Tools (Choice from race)");
      }
    });

    // Languages from Race Traits
    character.race.traits?.forEach(t => {
      if (t.toLowerCase().startsWith('languages:')) {
        langProfs.add(t.substring(10).trim());
      }
    });
    
    // Languages from Class Features
    character.class.features?.forEach(f => {
      if (f.id === 'druidic_feature') {
        langProfs.add("Druidic");
      }
      if (f.id === 'thieves_cant_feature') {
        langProfs.add("Thieves' Cant");
      }
    });
    
    return {
      armor: armorProfs,
      weapons: weaponProfs,
      tools: Array.from(toolProfs),
      languages: Array.from(langProfs),
    };
  }, [character]);


  if (!isOpen || !character) {
    return null;
  }
  
  const hasSpells = character.spellbook && (character.spellbook.cantrips.length > 0 || character.spellbook.preparedSpells.length > 0 || character.spellbook.knownSpells.length > 0);

  const spellcastingAbilityName = character.spellcastingAbility
    ? (character.spellcastingAbility.charAt(0).toUpperCase() + character.spellcastingAbility.slice(1)) as AbilityScoreName
    : null;

  const spellcastingScore: number = spellcastingAbilityName ? (character.finalAbilityScores[spellcastingAbilityName] as number) : 0;
  const spellcastingModifier = getAbilityModifierValue(spellcastingScore);
  const profBonus = character.proficiencyBonus || 2;

  const spellSaveDc = 8 + profBonus + spellcastingModifier;
  const spellAttackModifier = profBonus + spellcastingModifier;
  const spellAttackModifierString = spellAttackModifier >= 0 ? `+${spellAttackModifier}` : `${spellAttackModifier}`;

  const renderOverviewTab = () => (
     <div className="grid grid-cols-1 lg:grid-cols-3 gap-x-6 gap-y-4 h-full overflow-hidden">
        {/* Column 1: Core Stats & Features */}
        <div className="lg:col-span-1 space-y-4 overflow-y-auto scrollable-content p-1 pr-2 h-full">
            <p className="text-lg text-sky-300">{getCharacterRaceDisplayString(character)} {character.class.name}</p>
            
            {/* Vitals */}
            <div className="p-3 bg-gray-700/50 rounded-md border border-gray-600/60">
                <h4 className="text-lg font-semibold text-sky-300 mb-1.5">Vitals</h4>
                <p className="text-sm">Hit Points: <span className="font-semibold text-green-400">{character.hp}</span> / {character.maxHp}</p>
                <p className="text-sm">Armor Class: <span className="font-semibold text-blue-400">{character.armorClass}</span></p>
                <p className="text-sm">Speed: <span className="font-semibold">{character.speed}ft</span></p>
                {character.darkvisionRange > 0 && <p className="text-sm">Darkvision: {character.darkvisionRange}ft</p>}
            </div>

            {/* Spellcasting Stats */}
            {character.spellcastingAbility && spellcastingAbilityName && (
              <div className="p-3 bg-gray-700/50 rounded-md border border-gray-600/60">
                  <h4 className="text-lg font-semibold text-sky-300 mb-1.5">Spellcasting</h4>
                  <div className="text-sm space-y-1">
                      <Tooltip content={`The core ability used for your spells.`}>
                          <p>Ability: <span className="font-semibold text-amber-300">{spellcastingAbilityName}</span></p>
                      </Tooltip>
                      <Tooltip content={`Formula: 8 + Proficiency Bonus (${profBonus}) + ${spellcastingAbilityName.substring(0,3)} Mod (${spellcastingModifier})`}>
                          <p>Save DC: <span className="font-semibold text-blue-400">{spellSaveDc}</span></p>
                      </Tooltip>
                      <Tooltip content={`Formula: Proficiency Bonus (${profBonus}) + ${spellcastingAbilityName.substring(0,3)} Mod (${spellcastingModifier})`}>
                          <p>Attack Mod: <span className="font-semibold text-green-400">{spellAttackModifierString}</span></p>
                      </Tooltip>
                  </div>
              </div>
            )}

            {/* Ability Scores */}
            <div className="p-3 bg-gray-700/50 rounded-md border border-gray-600/60">
                <h4 className="text-lg font-semibold text-sky-300 mb-1.5">Ability Scores</h4>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
                {Object.entries(character.finalAbilityScores).map(([key, value]) => (
                    <p key={key}>{key.substring(0,3)}: <span className="font-semibold text-amber-300">{value as number}</span> ({getAbilityModifierString(value as number)})</p>
                ))}
                </div>
            </div>

            {/* Features & Traits */}
            <div className="p-3 bg-gray-700/50 rounded-md border border-gray-600/60">
                <h4 className="text-lg font-semibold text-sky-300 mb-1.5">Features & Traits</h4>
                <ul className="space-y-2 text-sm text-gray-300">
                    {/* Class Features */}
                    {character.class.features.map(feature => (
                         <li key={feature.id}>
                            <Tooltip content={feature.description}>
                                <span className="font-medium text-amber-200 cursor-help border-b border-dotted border-amber-200/50">{feature.name}</span>
                            </Tooltip>
                        </li>
                    ))}
                    {/* Fighting Style */}
                    {character.selectedFightingStyle && (
                         <li key={character.selectedFightingStyle.id}>
                            <Tooltip content={character.selectedFightingStyle.description}>
                                <span className="font-medium text-amber-200 cursor-help border-b border-dotted border-amber-200/50">Fighting Style: {character.selectedFightingStyle.name}</span>
                            </Tooltip>
                        </li>
                    )}
                    {/* Divine Order (Cleric) */}
                    {character.selectedDivineOrder && (
                         <li><span className="font-medium text-amber-200">Divine Order: {character.selectedDivineOrder}</span></li>
                    )}
                     {/* Primal Order (Druid) */}
                    {character.selectedDruidOrder && (
                         <li><span className="font-medium text-amber-200">Primal Order: {character.selectedDruidOrder}</span></li>
                    )}
                     {/* Warlock Patron */}
                    {character.selectedWarlockPatron && (
                         <li><span className="font-medium text-amber-200">Patron: {character.selectedWarlockPatron}</span></li>
                    )}

                    {/* Feats */}
                    {character.feats && character.feats.length > 0 && character.feats.map(featId => {
                        const feat = FEATS_DATA.find(f => f.id === featId);
                        if (!feat) return null;
                        
                        const featChoice = character.featChoices?.[featId];
                        const selectedASI = featChoice?.selectedAbilityScore;
                        
                        // Build display text with choices
                        let displayText = feat.name;
                        if (selectedASI && feat.benefits?.selectableAbilityScores) {
                            displayText += ` (${selectedASI} +1)`;
                        }
                        
                        return (
                            <li key={featId}>
                                <Tooltip content={feat.description}>
                                    <span className="font-medium text-emerald-200 cursor-help border-b border-dotted border-emerald-200/50">
                                        {displayText}
                                    </span>
                                </Tooltip>
                            </li>
                        );
                    })}

                    {/* Racial Traits - Filter out simple stat modifiers if desired, or show all */}
                    {character.race.traits.map((trait, index) => {
                        // Simple heuristic to get trait name: split by colon
                        const parts = trait.split(':');
                        const traitName = parts[0];
                        const traitDesc = parts.slice(1).join(':').trim();
                        
                        return (
                            <li key={`race-trait-${index}`}>
                                {traitDesc ? (
                                    <Tooltip content={traitDesc}>
                                        <span className="font-medium text-sky-200 cursor-help border-b border-dotted border-sky-200/50">{traitName}</span>
                                    </Tooltip>
                                ) : (
                                    <span className="text-sky-200">{trait}</span>
                                )}
                            </li>
                        );
                    })}
                </ul>
            </div>

            {/* Proficiencies */}
            <div className="p-3 bg-gray-700/50 rounded-md border border-gray-600/60">
              <h4 className="text-lg font-semibold text-sky-300 mb-1.5">Proficiencies</h4>
              <div className="space-y-2 text-sm">
                <div>
                  <p className="font-semibold text-gray-300">Armor:</p>
                  <p className="text-xs text-gray-400 pl-2">{proficiencies.armor}</p>
                </div>
                <div>
                  <p className="font-semibold text-gray-300">Weapons:</p>
                  <p className="text-xs text-gray-400 pl-2">{proficiencies.weapons}</p>
                </div>
                <div>
                  <p className="font-semibold text-gray-300">Tools:</p>
                  {proficiencies.tools.length > 0 ? (
                    <ul className="list-disc list-inside pl-2 text-xs text-gray-400">
                      {proficiencies.tools.map(t => <li key={t}>{t}</li>)}
                    </ul>
                  ) : (
                    <p className="text-xs text-gray-400 pl-2">None</p>
                  )}
                </div>
                <div>
                  <p className="font-semibold text-gray-300">Languages:</p>
                  {proficiencies.languages.length > 0 ? (
                    <ul className="list-disc list-inside pl-2 text-xs text-gray-400">
                      {proficiencies.languages.map(l => <li key={l}>{l}</li>)}
                    </ul>
                  ) : (
                    <p className="text-xs text-gray-400 pl-2">None</p>
                  )}
                </div>
              </div>
            </div>
            
            {/* Skill Details Button */}
            <div className="mt-4">
                <button 
                    onClick={() => setIsSkillDetailOverlayOpen(true)}
                    className="w-full bg-teal-600 hover:bg-teal-500 text-white font-semibold py-2 px-4 rounded-lg shadow transition-colors focus:outline-none focus:ring-2 focus:ring-teal-400"
                >
                    View Skill Details
                </button>
            </div>

        </div>

        {/* Column 2: Equipment */}
        <div className="lg:col-span-1 space-y-4 p-1 flex flex-col items-center justify-start overflow-y-auto scrollable-content h-full">
            <EquipmentMannequin
              character={character}
              onSlotClick={handleSlotClick}
              activeFilterSlot={filterBySlot}
            />
        </div>

        {/* Column 3: Inventory */}
        <div className="lg:col-span-1 space-y-4 overflow-y-auto scrollable-content p-1 pr-2 h-full">
            <InventoryList
              inventory={inventory}
              gold={gold}
              character={character}
              onAction={onAction}
              filterBySlot={filterBySlot}
              onClearFilter={() => setFilterBySlot(null)}
            />
        </div>
     </div>
  );

  return (
    <>
      <motion.div 
          {...{
            initial: { opacity: 0 },
            animate: { opacity: 1 },
            exit: { opacity: 0 },
            transition: { duration: 0.3 },
          } as any}
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"
          aria-modal="true"
          role="dialog"
          aria-labelledby="character-sheet-title"
      >
        <motion.div 
          {...{
            initial: { opacity: 0, scale: 0.95 },
            animate: { opacity: 1, scale: 1 },
            exit: { opacity: 0, scale: 0.95 },
            transition: { duration: 0.2 },
          } as any}
          className="bg-gray-800 p-6 rounded-xl shadow-2xl border border-gray-700 w-full max-w-6xl max-h-[90vh] flex flex-col"
        >
          {/* Header */}
          <div className="flex justify-between items-start mb-4">
            <div>
              <h2 id="character-sheet-title" className="text-3xl font-bold text-amber-400 font-cinzel tracking-wider">
                {character.name}
              </h2>
               {/* Tabs */}
              <div className="mt-2 flex border-b border-gray-600">
                <button
                  onClick={() => setActiveTab('overview')}
                  className={`px-4 py-2 text-sm font-medium transition-colors ${activeTab === 'overview' ? 'border-b-2 border-amber-400 text-amber-300' : 'text-gray-400 hover:text-white'}`}
                  role="tab"
                  aria-selected={activeTab === 'overview'}
                >
                  Overview
                </button>
                {hasSpells && (
                   <button
                    onClick={() => setIsSpellbookOpen(true)}
                    className={`px-4 py-2 text-sm font-medium transition-colors text-gray-400 hover:text-white`}
                    role="tab"
                    aria-selected={false}
                  >
                    Spellbook
                  </button>
                )}
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-200 text-3xl p-1 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-400"
              aria-label="Close character sheet"
            >
              &times;
            </button>
          </div>

          {/* Main Content Area */}
          <div className="flex-grow overflow-hidden min-h-0 flex flex-col">
            {activeTab === 'overview' && renderOverviewTab()}
          </div>
        </motion.div>
      </motion.div>
      
      {/* Spellbook Overlay */}
      {isSpellbookOpen && (
          <SpellbookOverlay 
            isOpen={isSpellbookOpen}
            character={character}
            onClose={() => setIsSpellbookOpen(false)}
            onAction={onAction}
          />
      )}

      {/* Skill Detail Overlay */}
      {character && (
        <SkillDetailDisplay 
          isOpen={isSkillDetailOverlayOpen}
          onClose={() => setIsSkillDetailOverlayOpen(false)}
          character={character}
          onNavigateToGlossary={onNavigateToGlossary} 
        />
      )}
    </>
  );
};

export default CharacterSheetModal;
