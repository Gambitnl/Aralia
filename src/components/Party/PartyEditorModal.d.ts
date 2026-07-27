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
import React from 'react';
import { PlayerCharacter, TempPartyMember } from '../../types';
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
declare const PartyEditorModal: React.FC<PartyEditorModalProps>;
export default PartyEditorModal;
