/**
 * ARCHITECTURAL CONTEXT:
 * This modal is a developer productivity tool. It allows swapping the active 
 * party members in real-time without restart. 
 *
 * Recent updates focus on 'Deep Cloning' premade characters. Previously, 
 * swapping a character would reset them to a generic class template. Now, 
 * if a character has a full PlayerCharacter backing (stats/gear/feats), 
 * the editor preserves the entire object, allowing for high-fidelity 
 * combat and quest testing with specific builds.
 *
 * Why it exists:
 * During development and testing, you often need to swap party members, try different
 * class combos, or test with specific character builds. The default "Edit Encounter
 * Party" tool only creates generic template characters. This upgraded version adds
 * the ability to load fully realized "premade characters" from JSON files stored in
 * the repo, so you get real names, races, stats, and spells instead of "Fighter 1".
 *
 * How it connects:
 * - Opened via the Dev Menu's "Edit Encounter Party" button
 * - Uses PartyManager for the editable template rows (name/class/level)
 * - Loads premade characters from public/premade-characters/ via premadeCharacterService
 * - "Save Party" dispatches SET_PARTY_COMPOSITION which rebuilds the game's party
 * - "Save as Premade" (dev only) exports a party member as a downloadable JSON
 *
 * Called by: GameModals.tsx (rendered when isPartyEditorVisible is true)
 * Depends on: PartyManager, premadeCharacterService, WindowFrame, generateId
 * 
 * @file src/components/Party/PartyEditorModal.tsx
 */
import React, { useState, useEffect, useRef } from 'react';
import { PlayerCharacter, TempPartyMember } from '../../types';
import { PartyManager } from '../EncounterGenerator/PartyManager';
import { getDummyParty } from '../../data/dev/dummyCharacter';
import { WindowFrame } from '../ui/WindowFrame';
import { WINDOW_KEYS } from '../../styles/uiIds';
import { generateId } from '../../utils/core/idGenerator';
import {
  loadPremadeManifest,
  loadPremadeCharacter,
  savePremadeCharacter,
  canSavePremadeCharacters,
  PremadeCharacterSummary,
} from '../../services/premadeCharacterService';

// ============================================================================
// Props
// ============================================================================
// The modal receives the current party, an onSave callback to commit changes,
// and the full party array so "Save as Premade" can export real character data.
// ============================================================================

interface PartyEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialParty: PlayerCharacter[];
  onSave: (party: TempPartyMember[]) => void;
  /** Optional callback for saving full PlayerCharacter objects directly.
   *  Used when all party members come from premade/real character data,
   *  skipping the template regeneration that strips custom names and stats. */
  onSaveFullParty?: (party: PlayerCharacter[]) => void;
}

// ============================================================================
// Component
// ============================================================================

const PartyEditorModal: React.FC<PartyEditorModalProps> = ({ isOpen, onClose, initialParty, onSave, onSaveFullParty }) => {
  // The editable party rows — lightweight representations with name/class/level
  const [editableParty, setEditableParty] = useState<TempPartyMember[]>([]);

  // Premade characters catalog loaded from the manifest
  const [premadeCharacters, setPremadeCharacters] = useState<PremadeCharacterSummary[]>([]);

  // Whether the premade character picker dropdown is visible
  const [showPremadePicker, setShowPremadePicker] = useState(false);

  // Loading state while fetching a premade character file
  const [isLoadingPremade, setIsLoadingPremade] = useState(false);

  // Tracks which full PlayerCharacter objects are "real" premade characters
  // (as opposed to template-generated ones). Keyed by party member ID.
  const loadedPremadeCharactersRef = useRef<Map<string, PlayerCharacter>>(new Map());

  // Status message shown briefly after actions like saving
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // ============================================================================
  // Initialization
  // ============================================================================
  // When the modal opens, convert the current party into editable rows and
  // load the premade characters manifest. If there's no current party, fall
  // back to the dummy party data.
  // ============================================================================

  useEffect(() => {
    if (isOpen) {
      const initialTempParty = (initialParty.length > 0 ? initialParty : getDummyParty()).map((p, index) => ({
        id: p.id || generateId(),
        name: p.name || `Character ${index + 1}`,
        level: p.level || 1,
        classId: p.class?.id || 'fighter',
      }));
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setEditableParty(initialTempParty);

      // Store references to the real PlayerCharacter objects from the initial party
      // so we can export them as premade characters later
      loadedPremadeCharactersRef.current = new Map();
      initialParty.forEach(p => {
        if (p.id) loadedPremadeCharactersRef.current.set(p.id, p);
      });

      // Load the premade characters manifest
      loadPremadeManifest().then(manifest => {
        setPremadeCharacters(manifest.characters);
      });
    }
  }, [isOpen, initialParty]);

  if (!isOpen) {
    return null;
  }

  // ============================================================================
  // Save Handler
  // ============================================================================
  // When "Save Party" is clicked, we pass the editable rows back to the game.
  // The characterReducer will rebuild full PlayerCharacter objects from these.
  // ============================================================================

  const handleSaveClick = () => {
    // WHAT CHANGED: Added check for full character data.
    // WHY IT CHANGED: Previously, saving always triggered SET_PARTY_COMPOSITION 
    // which regenerated characters from class templates. To support complex 
    // premade characters (with custom gear/stat blocks), we now check if we 
    // have the full object. If we do, we dispatch SET_FULL_PARTY instead.
    const allHaveFullData = editableParty.every(m => loadedPremadeCharactersRef.current.has(m.id));

    if (allHaveFullData && onSaveFullParty) {
      // Build the full party array, syncing names from the editable rows
      // (the user may have renamed characters in the editor)
      const fullParty = editableParty.map(member => {
        const fullChar = { ...loadedPremadeCharactersRef.current.get(member.id)! };
        fullChar.name = member.name;
        fullChar.id = member.id;
        return fullChar;
      });
      onSaveFullParty(fullParty);
    } else {
      // Fall back to template-based generation if any members are missing deep data
      onSave(editableParty);
    }
    onClose();
  };

  // ============================================================================
  // Premade Character Loading
  // ============================================================================
  // When the user picks a premade character from the dropdown, we fetch the full
  // JSON file, add it to the editable party list, and store the full object so
  // it can be exported later.
  // ============================================================================

  const handleLoadPremade = async (summary: PremadeCharacterSummary) => {
    setIsLoadingPremade(true);
    setStatusMessage(null);

    const character = await loadPremadeCharacter(summary.filename);

    if (character) {
      // Give it a fresh ID so it doesn't collide with existing party members
      const newId = generateId();
      character.id = newId;

      // Store the full character data for potential export
      loadedPremadeCharactersRef.current.set(newId, character);

      // Add to the editable party list
      setEditableParty(prev => [...prev, {
        id: newId,
        name: character.name,
        level: character.level || 1,
        classId: character.class?.id || 'fighter',
      }]);

      setStatusMessage(`✓ Loaded ${summary.name}`);
    } else {
      setStatusMessage(`✗ Failed to load ${summary.name}`);
    }

    setIsLoadingPremade(false);
    setShowPremadePicker(false);
  };

  // ============================================================================
  // Premade Character Saving (Dev Mode Only)
  // ============================================================================
  // Exports a party member as a downloadable JSON file. This only works if we
  // have the full PlayerCharacter object (either from the initial party or from
  // a previously loaded premade). Template-only characters can't be exported
  // because they're just name/class/level stubs.
  // ============================================================================

  const handleSavePremade = (memberId: string) => {
    const fullCharacter = loadedPremadeCharactersRef.current.get(memberId);
    if (!fullCharacter) {
      setStatusMessage('✗ Cannot export template-only characters. Load a premade or use the game party first.');
      return;
    }

    // Find the current name from the editable party (user may have renamed it)
    const editableMember = editableParty.find(m => m.id === memberId);
    if (editableMember) {
      fullCharacter.name = editableMember.name;
    }

    savePremadeCharacter(fullCharacter);
    setStatusMessage(`✓ Exported "${fullCharacter.name}" — place the file in public/premade-characters/ and update manifest.json`);
  };

  // Check if saving premade characters is available (dev mode only)
  const showSaveOption = canSavePremadeCharacters();

  return (
    <WindowFrame
      title="Edit Encounter Party"
      onClose={onClose}
      storageKey={WINDOW_KEYS.PARTY_EDITOR}
    >
      <div className="flex flex-col h-full bg-gray-800 p-6">
        {/* ================================================================ */}
        {/* Main party editor — the name/class/level rows                    */}
        {/* ================================================================ */}
        <div className="flex-grow pr-2 h-full overflow-hidden">
          <PartyManager party={editableParty} onPartyChange={setEditableParty} />
        </div>

        {/* ================================================================ */}
        {/* Premade Characters Section                                       */}
        {/* This lets you load fully realized characters from JSON files      */}
        {/* instead of creating generic templates from scratch.               */}
        {/* ================================================================ */}
        <div className="mt-4 pt-4 border-t border-gray-700">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm uppercase tracking-wider text-amber-400 font-bold">
              📦 Premade Characters
            </h3>
            <button
              onClick={() => setShowPremadePicker(!showPremadePicker)}
              disabled={premadeCharacters.length === 0 || isLoadingPremade}
              className="px-3 py-1.5 bg-amber-700 hover:bg-amber-600 text-white text-xs font-semibold rounded-lg shadow transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed"
            >
              {isLoadingPremade ? 'Loading...' : showPremadePicker ? 'Hide Roster' : `Browse (${premadeCharacters.length})`}
            </button>
          </div>

          {/* The premade character picker — shows cards for each available character */}
          {showPremadePicker && premadeCharacters.length > 0 && (
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1 mb-3">
              {premadeCharacters.map((pc) => (
                <button
                  key={pc.filename}
                  onClick={() => handleLoadPremade(pc)}
                  disabled={isLoadingPremade}
                  className="w-full text-left p-3 bg-gray-700/50 hover:bg-gray-600/50 rounded-lg border border-gray-600/50 hover:border-amber-500/50 transition-all group"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-white font-semibold group-hover:text-amber-300 transition-colors">
                        {pc.name}
                      </span>
                      <span className="text-gray-400 text-xs ml-2">
                        Lv.{pc.level} {pc.race} {pc.className}
                      </span>
                    </div>
                    <span className="text-amber-500 text-xs font-mono opacity-0 group-hover:opacity-100 transition-opacity">
                      + Add
                    </span>
                  </div>
                  <p className="text-gray-400 text-xs mt-1 leading-relaxed">
                    {pc.description}
                  </p>
                </button>
              ))}
            </div>
          )}

          {/* No premade characters available message */}
          {premadeCharacters.length === 0 && (
            <p className="text-gray-500 text-xs italic">
              No premade characters found. Add JSON files to public/premade-characters/ and update manifest.json.
            </p>
          )}
        </div>

        {/* ================================================================ */}
        {/* Save as Premade Section (Dev Mode Only)                           */}
        {/* Lets developers export party members as reusable JSON files.      */}
        {/* Only visible when dev tools are enabled.                          */}
        {/* ================================================================ */}
        {showSaveOption && editableParty.length > 0 && (
          <div className="mt-3 pt-3 border-t border-gray-700/50">
            <h4 className="text-xs uppercase tracking-wider text-sky-400 font-bold mb-2">
              💾 Export as Premade (Dev)
            </h4>
            <div className="flex flex-wrap gap-2">
              {editableParty.map((member) => {
                // Only show export button for characters that have full data
                const hasFullData = loadedPremadeCharactersRef.current.has(member.id);
                return (
                  <button
                    key={member.id}
                    onClick={() => handleSavePremade(member.id)}
                    disabled={!hasFullData}
                    title={hasFullData
                      ? `Export ${member.name} as a premade character JSON file`
                      : 'Cannot export template-only characters — only party members with full data can be exported'}
                    className={`px-3 py-1 text-xs rounded-md border transition-colors ${hasFullData
                      ? 'bg-sky-900/30 hover:bg-sky-800/50 text-sky-300 border-sky-700/50 hover:border-sky-500/50 cursor-pointer'
                      : 'bg-gray-800/30 text-gray-600 border-gray-700/30 cursor-not-allowed'
                      }`}
                  >
                    📥 {member.name || 'Unnamed'}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ================================================================ */}
        {/* Status Message — shows brief feedback after actions               */}
        {/* ================================================================ */}
        {statusMessage && (
          <div className={`mt-3 p-2 rounded text-xs font-medium ${statusMessage.startsWith('✓')
            ? 'bg-green-900/30 text-green-300 border border-green-700/30'
            : 'bg-red-900/30 text-red-300 border border-red-700/30'
            }`}>
            {statusMessage}
          </div>
        )}

        {/* ================================================================ */}
        {/* Footer — Save Party and Cancel buttons                           */}
        {/* ================================================================ */}
        <div className="mt-6 pt-4 border-t border-gray-700 flex justify-between items-center">
          <button
            onClick={handleSaveClick}
            disabled={editableParty.length === 0}
            className="px-6 py-2 bg-green-600 hover:bg-green-500 text-white font-semibold rounded-lg shadow disabled:bg-gray-500 disabled:cursor-not-allowed"
          >
            Save Party
          </button>
          <button
            onClick={onClose}
            className="px-6 py-2 bg-sky-600 hover:bg-sky-500 text-white font-semibold rounded-lg shadow"
          >
            Cancel
          </button>
        </div>
      </div>
    </WindowFrame>
  );
};

export default PartyEditorModal;
