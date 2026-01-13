
/**
 * @file CharacterSheetModal.tsx
 * This component displays a modal with detailed character information,
 * including stats, skills, spells, an equipment mannequin, and inventory with actions.
 * Inventory display is now handled by the InventoryList component.
 * SkillDetailDisplay is now a separate overlay triggered from this modal.
 */
import React, { useEffect, useState } from 'react';
import { motion, MotionProps } from 'framer-motion';
import { PlayerCharacter, Item, EquipmentSlotType, Action } from '../../types';
import EquipmentMannequin from './EquipmentMannequin';
import InventoryList from './InventoryList';
import SkillDetailDisplay from './SkillDetailDisplay';
import SpellbookOverlay from './SpellbookOverlay'; // Import the new SpellbookOverlay component
import CharacterOverview from './CharacterOverview'; // Import the extracted component
import CharacterDetailsTab from './CharacterDetailsTab';
import FamilyTreeTab from './FamilyTreeTab';
import { Companion } from '../../types/companions';
// Glossary modal is nested under the Glossary folder to keep related UI together


interface CharacterSheetModalProps {
  isOpen: boolean;
  character: PlayerCharacter | null;
  companion?: Companion | null;
  inventory: Item[];
  gold: number;
  onClose: () => void;
  onAction: (action: Action) => void;
  onNavigateToGlossary?: (termId: string) => void; // For glossary navigation
}

type SheetTab = 'overview' | 'details' | 'family';

const overlayMotion: MotionProps = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0.3 },
};

const sheetMotion: MotionProps = {
  initial: { opacity: 0, scale: 0.95 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.95 },
  transition: { duration: 0.2 },
};

const CharacterSheetModal: React.FC<CharacterSheetModalProps> = ({
  isOpen,
  character,
  companion,
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
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActiveTab('overview');
    return () => {
      window.removeEventListener('keydown', handleEsc);
    };
  }, [isOpen, onClose, isSkillDetailOverlayOpen, isSpellbookOpen]);

  const handleSlotClick = (slot: EquipmentSlotType, item?: Item) => {
    if (item && character) {
      // If item is equipped, unequip it
      onAction({ type: 'UNEQUIP_ITEM', label: `Unequip ${item.name}`, payload: { slot, characterId: character.id! } });
    } else {
      // If slot is empty, toggle filter mode for that slot
      setFilterBySlot(filterBySlot === slot ? null : slot);
    }
  };

  if (!isOpen || !character) {
    return null;
  }

  const hasSpells = character.spellbook && (character.spellbook.cantrips.length > 0 || character.spellbook.preparedSpells.length > 0 || character.spellbook.knownSpells.length > 0);

  return (
    <>
      <motion.div
        {...overlayMotion}
        className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"
        aria-modal="true"
        role="dialog"
        aria-labelledby="character-sheet-title"
      >
        <motion.div
          {...sheetMotion}
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
                <button
                  onClick={() => setActiveTab('details')}
                  className={`px-4 py-2 text-sm font-medium transition-colors ${activeTab === 'details' ? 'border-b-2 border-amber-400 text-amber-300' : 'text-gray-400 hover:text-white'}`}
                  role="tab"
                  aria-selected={activeTab === 'details'}
                >
                  Details
                </button>
                {character.richNpcData?.family && character.richNpcData.family.length > 0 && (
                  <button
                    onClick={() => setActiveTab('family')}
                    className={`px-4 py-2 text-sm font-medium transition-colors ${activeTab === 'family' ? 'border-b-2 border-amber-400 text-amber-300' : 'text-gray-400 hover:text-white'}`}
                    role="tab"
                    aria-selected={activeTab === 'family'}
                  >
                    Family
                  </button>
                )}
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
            {activeTab === 'overview' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-x-6 gap-y-4 h-full overflow-hidden">
                {/* Column 1: Core Stats & Features (Extracted to CharacterOverview) */}
                <div className="lg:col-span-1 h-full overflow-hidden">
                  <CharacterOverview
                    character={character}
                    onOpenSkillDetails={() => setIsSkillDetailOverlayOpen(true)}
                  />
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
            {activeTab === 'details' && (
              <CharacterDetailsTab character={character} companion={companion} />
            )}
            {activeTab === 'family' && (
              <FamilyTreeTab character={character} />
            )}
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
