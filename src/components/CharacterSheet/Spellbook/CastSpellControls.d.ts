/**
 * @file CastSpellControls.tsx
 * Out-of-combat "Cast" affordance for the spellbook (tab and overlay).
 *
 * Renders a Cast button for the selected spell when it is sensibly castable
 * outside combat (healing, buffs, utility — not attack/save combat spells),
 * with a minimal party-member target picker for ally-targeted spells.
 * Dispatches CAST_SPELL with an `outOfCombat` payload; the handler in
 * hooks/actions/handleResourceActions.ts deducts the slot and applies effects.
 */
import React from 'react';
import { PlayerCharacter, Spell, Action } from '../../../types';
interface CastSpellControlsProps {
    spell: Spell;
    character: PlayerCharacter;
    /** Full party for the target picker; falls back to the caster alone. */
    party?: PlayerCharacter[];
    /** Whether the caster has the spell ready (prepared/known/cantrip). */
    isReadyToCast: boolean;
    /** Player-facing reason when not ready (e.g. "Not prepared."). */
    notReadyReason?: string;
    onAction: (action: Action) => void;
}
declare const CastSpellControls: React.FC<CastSpellControlsProps>;
export default CastSpellControls;
