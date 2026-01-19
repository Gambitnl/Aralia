
/**
 * @file CharacterSheetModal.tsx
 * This component displays a modal with detailed character information,
 * including stats, skills, spells, an equipment mannequin, and inventory with actions.
 * Now wrapped in WindowFrame for resizing/dragging capabilities.
 */
import React, { useEffect, useState } from 'react';
import { PlayerCharacter, Item, EquipmentSlotType, Action, Quest, LevelUpChoices } from '../../types';
import { JournalState } from '../../types/journal';
import { Companion } from '../../types/companions';
import { WindowFrame } from '../ui/WindowFrame';
import { canLevelUp } from '../../utils/characterUtils';

// Tab components from subfolders
import { CharacterOverview, EquipmentMannequin, InventoryList } from './Overview';
import { SkillsTab } from './Skills';
import { CharacterDetailsTab } from './Details';
import { FamilyTreeTab } from './Family';
import { SpellbookTab } from './Spellbook';
import { CraftingTab } from './Crafting';
import { JournalTab } from './Journal';
import LevelUpModal from './LevelUpModal';

interface CharacterSheetModalProps {
  isOpen: boolean;
  character: PlayerCharacter | null;
  companion?: Companion | null;
  inventory: Item[];
  gold: number;
  onClose: () => void;
  onAction: (action: Action) => void;
  onNavigateToGlossary?: (termId: string) => void;
  quests?: Quest[];
  journal?: JournalState;
}

type SheetTab = 'overview' | 'skills' | 'details' | 'family' | 'spellbook' | 'crafting' | 'journal';

const CharacterSheetModal: React.FC<CharacterSheetModalProps> = ({
  isOpen,
  character,
  companion,
  inventory,
  gold,
  onClose,
  onAction,
  onNavigateToGlossary,
  quests = [],
  journal,
}) => {
  const [activeTab, setActiveTab] = useState<SheetTab>('overview');
  const [filterBySlot, setFilterBySlot] = useState<EquipmentSlotType | null>(null);
  const [isLevelUpOpen, setIsLevelUpOpen] = useState(false);

  useEffect(() => {
    // Reset to overview tab when modal opens or character changes
    setActiveTab('overview');
    // Close any level-up flow when switching characters.
    setIsLevelUpOpen(false);
  }, [isOpen, character?.id]);

  const handleSlotClick = (slot: EquipmentSlotType, item?: Item) => {
    if (item && character) {
      onAction({ type: 'UNEQUIP_ITEM', label: `Unequip ${item.name}`, payload: { slot, characterId: character.id! } });
    } else {
      setFilterBySlot(filterBySlot === slot ? null : slot);
    }
  };

  if (!isOpen || !character) {
    return null;
  }

  const hasSpells = character.spellbook && (
    character.spellbook.cantrips.length > 0 ||
    character.spellbook.preparedSpells.length > 0 ||
    character.spellbook.knownSpells.length > 0
  );
  const hasFamily = character.richNpcData?.family && character.richNpcData.family.length > 0;
  const canLevel = !!character.id && canLevelUp(character);

  const handleLevelUpConfirm = (choices: LevelUpChoices) => {
    if (!character.id) return;
    // Use the generic character choice action so reducer logic stays centralized.
    onAction({
      type: 'UPDATE_CHARACTER_CHOICE',
      label: 'Level Up',
      payload: {
        characterId: character.id,
        choiceType: 'level_up',
        choiceId: 'level_up',
        secondaryValue: { choices },
      },
    });
  };

  return (
    <WindowFrame
      title={character.name}
      storageKey="character-sheet"
      onClose={onClose}
      initialMaximized={true}
    >
      <div className="flex flex-col h-full">
        {/* Tab Bar */}
        <div className="flex border-b border-gray-700 bg-gray-800/50 px-4">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-2.5 text-sm font-medium transition-colors ${activeTab === 'overview' ? 'border-b-2 border-amber-400 text-amber-300' : 'text-gray-400 hover:text-white'}`}
            role="tab"
            aria-selected={activeTab === 'overview'}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('skills')}
            className={`px-4 py-2.5 text-sm font-medium transition-colors ${activeTab === 'skills' ? 'border-b-2 border-amber-400 text-amber-300' : 'text-gray-400 hover:text-white'}`}
            role="tab"
            aria-selected={activeTab === 'skills'}
          >
            Skills
          </button>
          <button
            onClick={() => setActiveTab('details')}
            className={`px-4 py-2.5 text-sm font-medium transition-colors ${activeTab === 'details' ? 'border-b-2 border-amber-400 text-amber-300' : 'text-gray-400 hover:text-white'}`}
            role="tab"
            aria-selected={activeTab === 'details'}
          >
            Details
          </button>
          {hasFamily && (
            <button
              onClick={() => setActiveTab('family')}
              className={`px-4 py-2.5 text-sm font-medium transition-colors ${activeTab === 'family' ? 'border-b-2 border-amber-400 text-amber-300' : 'text-gray-400 hover:text-white'}`}
              role="tab"
              aria-selected={activeTab === 'family'}
            >
              Family
            </button>
          )}
          {hasSpells && (
            <button
              onClick={() => setActiveTab('spellbook')}
              className={`px-4 py-2.5 text-sm font-medium transition-colors ${activeTab === 'spellbook' ? 'border-b-2 border-purple-400 text-purple-300' : 'text-gray-400 hover:text-white'}`}
              role="tab"
              aria-selected={activeTab === 'spellbook'}
            >
              Spellbook
            </button>
          )}
          <button
            onClick={() => setActiveTab('crafting')}
            className={`px-4 py-2.5 text-sm font-medium transition-colors ${activeTab === 'crafting' ? 'border-b-2 border-green-400 text-green-300' : 'text-gray-400 hover:text-white'}`}
            role="tab"
            aria-selected={activeTab === 'crafting'}
          >
            Crafting
          </button>
          <button
            onClick={() => setActiveTab('journal')}
            className={`px-4 py-2.5 text-sm font-medium transition-colors ${activeTab === 'journal' ? 'border-b-2 border-amber-500 text-amber-400' : 'text-gray-400 hover:text-white'}`}
            role="tab"
            aria-selected={activeTab === 'journal'}
          >
            Journal
          </button>
          {canLevel && (
            <div className="ml-auto flex items-center">
              <button
                onClick={() => setIsLevelUpOpen(true)}
                className="px-3 py-1.5 text-xs font-semibold rounded-full bg-emerald-600/80 hover:bg-emerald-500 text-white"
                aria-label={`Level up ${character.name}`}
              >
                Level Up
              </button>
            </div>
          )}
        </div>

        {/* Main Content Area */}
        <div className="flex-grow overflow-hidden min-h-0 flex flex-col p-4">
          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-x-6 gap-y-4 h-full overflow-hidden">
              {/* Column 1: Core Stats & Features */}
              <div className="lg:col-span-1 h-full overflow-hidden">
                <CharacterOverview character={character} />
              </div>

              {/* Column 2: Equipment */}
              <div className="lg:col-span-1 space-y-4 p-1 flex flex-col items-center justify-start overflow-y-auto scrollable-content h-full">
                <EquipmentMannequin
                  character={character}
                  onSlotClick={handleSlotClick}
                  activeFilterSlot={filterBySlot}
                  onAutoEquip={() => onAction({
                    type: 'AUTO_EQUIP',
                    label: 'Auto-Equip Best Gear',
                    payload: { characterId: character.id! }
                  })}
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
          )}
          {activeTab === 'skills' && (
            <SkillsTab character={character} onNavigateToGlossary={onNavigateToGlossary} />
          )}
          {activeTab === 'details' && (
            <CharacterDetailsTab character={character} companion={companion} />
          )}
          {activeTab === 'family' && (
            <FamilyTreeTab character={character} />
          )}
          {activeTab === 'spellbook' && (
            <SpellbookTab character={character} onAction={onAction} />
          )}
          {activeTab === 'crafting' && (
            <CraftingTab />
          )}
          {activeTab === 'journal' && (
            <JournalTab quests={quests} journal={journal} />
          )}
        </div>
      </div>

      {/* Level up flow is nested here so it can reuse the active character context. */}
      <LevelUpModal
        isOpen={isLevelUpOpen}
        character={character}
        onClose={() => setIsLevelUpOpen(false)}
        onConfirm={handleLevelUpConfirm}
      />
    </WindowFrame>
  );
};

export default CharacterSheetModal;
