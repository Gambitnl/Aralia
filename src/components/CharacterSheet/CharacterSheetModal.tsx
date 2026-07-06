// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 01/06/2026, 00:46:13
 * Dependents: components/BattleMap/BattleMapDemo.tsx, components/CharacterSheet/index.ts, components/Combat/CombatView.tsx, components/layout/GameModals.tsx
 * Imports: 14 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

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
import { WINDOW_KEYS } from '../../styles/uiIds';
import { canLevelUp } from '../../utils/characterUtils';

/**
 * This file renders the primary window frame containing the interactive D&D character sheet.
 *
 * It implements the tab navigation bar that switches between the Overview (stats, equipment,
 * inventory), Skills, Details, Family, Spellbook, Crafting, and Journal sub-views.
 * It is wrapped in a WindowFrame component to handle dragging, maximizing, and resizing.
 *
 * Called by: GameScreen / Dashboard layout components.
 * Depends on: sub-tabs (SkillsTab, SpellbookTab, CharacterOverview, etc.) and WindowFrame UI container.
 */

// ============================================================================
// Imports & Properties Interface
// ============================================================================
// Collects all required character sub-tabs, utility functions, and defines the
// properties interface passed into the modal window.
// ============================================================================

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
  /** Full party, used by the spellbook's out-of-combat cast target picker. */
  party?: PlayerCharacter[];
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
  party,
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
    <div role="dialog" aria-modal="true" aria-label={character.name}>
      <WindowFrame
        title={character.name}
        storageKey={WINDOW_KEYS.CHARACTER_SHEET}
        onClose={onClose}
        initialMaximized={true}
      >
      <div className="flex flex-col h-full">
        {/* Tab Bar */}
        {/* Main character sheet tab navigation, rendered using a premium serif font for immersive D&D theme. */}
        {/* Narrow WindowFrames use a two-row grid so late tabs like Journal
            remain visible without overlapping the sheet content; wider sheets
            keep a single scrollable tab row. */}
        <div
          className="grid grid-cols-3 items-stretch border-b border-gray-700 bg-gray-800/50 px-2 sm:flex sm:min-h-11 sm:flex-nowrap sm:overflow-x-auto sm:overflow-y-hidden sm:px-4"
          role="tablist"
          aria-label="Character sheet sections"
        >
          <button
            onClick={() => setActiveTab('overview')}
            className={`flex min-h-11 shrink-0 items-center justify-center whitespace-nowrap px-2.5 py-2.5 text-sm font-medium font-cinzel transition-colors sm:justify-start sm:px-4 ${activeTab === 'overview' ? 'border-b-2 border-amber-400 text-amber-300' : 'text-gray-400 hover:text-white'}`}
            role="tab"
            aria-selected={activeTab === 'overview'}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('skills')}
            className={`flex min-h-11 shrink-0 items-center justify-center whitespace-nowrap px-2.5 py-2.5 text-sm font-medium font-cinzel transition-colors sm:justify-start sm:px-4 ${activeTab === 'skills' ? 'border-b-2 border-amber-400 text-amber-300' : 'text-gray-400 hover:text-white'}`}
            role="tab"
            aria-selected={activeTab === 'skills'}
          >
            Skills
          </button>
          <button
            onClick={() => setActiveTab('details')}
            className={`flex min-h-11 shrink-0 items-center justify-center whitespace-nowrap px-2.5 py-2.5 text-sm font-medium font-cinzel transition-colors sm:justify-start sm:px-4 ${activeTab === 'details' ? 'border-b-2 border-amber-400 text-amber-300' : 'text-gray-400 hover:text-white'}`}
            role="tab"
            aria-selected={activeTab === 'details'}
          >
            Details
          </button>
          {hasFamily && (
            <button
              onClick={() => setActiveTab('family')}
              className={`flex min-h-11 shrink-0 items-center justify-center whitespace-nowrap px-2.5 py-2.5 text-sm font-medium font-cinzel transition-colors sm:justify-start sm:px-4 ${activeTab === 'family' ? 'border-b-2 border-amber-400 text-amber-300' : 'text-gray-400 hover:text-white'}`}
              role="tab"
              aria-selected={activeTab === 'family'}
            >
              Family
            </button>
          )}
          {hasSpells && (
            <button
              onClick={() => setActiveTab('spellbook')}
              className={`flex min-h-11 shrink-0 items-center justify-center whitespace-nowrap px-2.5 py-2.5 text-sm font-medium font-cinzel transition-colors sm:justify-start sm:px-4 ${activeTab === 'spellbook' ? 'border-b-2 border-purple-400 text-purple-300' : 'text-gray-400 hover:text-white'}`}
              role="tab"
              aria-selected={activeTab === 'spellbook'}
            >
              Spellbook
            </button>
          )}
          <button
            onClick={() => setActiveTab('crafting')}
            className={`flex min-h-11 shrink-0 items-center justify-center whitespace-nowrap px-2.5 py-2.5 text-sm font-medium font-cinzel transition-colors sm:justify-start sm:px-4 ${activeTab === 'crafting' ? 'border-b-2 border-green-400 text-green-300' : 'text-gray-400 hover:text-white'}`}
            role="tab"
            aria-selected={activeTab === 'crafting'}
          >
            Crafting
          </button>
          <button
            onClick={() => setActiveTab('journal')}
            className={`flex min-h-11 shrink-0 items-center justify-center whitespace-nowrap px-2.5 py-2.5 text-sm font-medium font-cinzel transition-colors sm:justify-start sm:px-4 ${activeTab === 'journal' ? 'border-b-2 border-amber-500 text-amber-400' : 'text-gray-400 hover:text-white'}`}
            role="tab"
            aria-selected={activeTab === 'journal'}
          >
            Journal
          </button>
          {canLevel && (
            <div className="ml-auto flex items-center">
              <button
                onClick={() => setIsLevelUpOpen(true)}
                className="min-h-11 px-3 py-1.5 text-xs font-semibold rounded-full bg-emerald-600/80 hover:bg-emerald-500 text-white"
                aria-label={`Level up ${character.name}`}
              >
                Level Up
              </button>
            </div>
          )}
        </div>

        {/* Main Content Area */}
        {/* Embeds all inner tabs. Formatted to use a classical, highly-readable RPG body serif font (Quattrocento) across all tabs. */}
        <div className="flex-grow overflow-hidden min-h-0 flex flex-col p-4 font-quattrocento font-medium">
          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 gap-y-4 max-lg:overflow-y-auto scrollable-content pr-2 lg:grid-cols-3 lg:gap-x-6 lg:h-full lg:overflow-hidden lg:pr-0">
              {/* Column 1: Core Stats & Features */}
              {/* The core stat stack can be taller than the sheet on normal
                  desktop windows, so it needs its own scroll lane just like
                  equipment and inventory. This keeps lower expandable panels
                  reachable instead of clipping them under the WindowFrame edge. */}
              <div className="max-lg:overflow-visible lg:col-span-1 lg:h-full lg:overflow-y-auto lg:scrollable-content lg:pr-2">
                <CharacterOverview character={character} />
              </div>

              {/* Column 2: Equipment */}
              <div className="space-y-4 p-1 flex flex-col items-center justify-start max-lg:overflow-visible lg:col-span-1 lg:overflow-y-auto lg:scrollable-content lg:h-full">
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
              <div className="space-y-4 p-1 max-lg:overflow-visible lg:col-span-1 lg:overflow-y-auto lg:scrollable-content lg:pr-2 lg:h-full">
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
            <SpellbookTab character={character} onAction={onAction} party={party} />
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
    </div>
  );
};

export default CharacterSheetModal;
