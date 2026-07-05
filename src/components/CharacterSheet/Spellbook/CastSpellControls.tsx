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
import React, { useEffect, useState } from 'react';
import { PlayerCharacter, Spell, Action } from '../../../types';
import {
    getOutOfCombatCastability,
    isSpellCastableOutOfCombat,
    spellNeedsPartyTarget,
} from '../../../utils/spells/outOfCombatCasting';

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

const CastSpellControls: React.FC<CastSpellControlsProps> = ({
    spell,
    character,
    party,
    isReadyToCast,
    notReadyReason,
    onAction,
}) => {
    const [pickingTarget, setPickingTarget] = useState(false);

    // Close the picker whenever the selected spell changes.
    useEffect(() => {
        setPickingTarget(false);
    }, [spell.id]);

    // Combat-only spells get a muted note instead of a dead button.
    if (!isSpellCastableOutOfCombat(spell)) {
        return (
            <div
                data-testid="cast-spell-controls"
                className="px-6 py-2 border-b border-slate-700 bg-slate-800/30 text-xs text-slate-500 italic"
            >
                Combat spell — cast it from the battle map.
            </div>
        );
    }

    const castability = getOutOfCombatCastability(character, spell);
    const disabled = !isReadyToCast || !castability.allowed;
    const disabledReason = !isReadyToCast ? notReadyReason : castability.reason;
    const targets = party && party.length > 0 ? party : [character];
    const needsTargetChoice = spellNeedsPartyTarget(spell) && targets.length > 1;

    const cast = (targetCharacterId: string) => {
        setPickingTarget(false);
        onAction({
            type: 'CAST_SPELL',
            label: `Cast ${spell.name}`,
            payload: {
                characterId: character.id!,
                spellLevel: castability.castLevel ?? spell.level,
                spellId: spell.id,
                outOfCombat: { targetCharacterId },
            },
        });
    };

    const handleCastClick = () => {
        if (disabled) return;
        if (needsTargetChoice) {
            setPickingTarget(prev => !prev);
            return;
        }
        cast(character.id!);
    };

    return (
        <div
            data-testid="cast-spell-controls"
            className="px-6 py-2.5 border-b border-slate-700 bg-slate-800/30 flex items-center gap-3 flex-wrap"
        >
            <button
                data-testid="cast-spell-button"
                disabled={disabled}
                onClick={handleCastClick}
                className={`px-3 py-1 text-xs font-bold uppercase tracking-wider rounded transition-all ${disabled
                    ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                    : 'bg-emerald-600 text-white hover:bg-emerald-500 shadow-lg shadow-emerald-500/20'
                    }`}
            >
                Cast {spell.name}
            </button>

            {!disabled && spell.level === 0 && (
                <span className="text-xs text-slate-400">Cantrip — no slot needed</span>
            )}
            {!disabled && spell.level > 0 && castability.castLevel !== null && (
                <span className="text-xs text-slate-400">
                    Uses a level {castability.castLevel} slot
                    {castability.castLevel > spell.level ? ' (upcast)' : ''}
                </span>
            )}
            {disabled && disabledReason && (
                <span data-testid="cast-disabled-reason" className="text-xs text-amber-400">
                    {disabledReason}
                </span>
            )}

            {pickingTarget && (
                <div data-testid="cast-target-picker" className="w-full flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="text-xs text-slate-400">Cast on:</span>
                    {targets.map(member =>
                        member.id ? (
                            <button
                                key={member.id}
                                onClick={() => cast(member.id!)}
                                className="px-2 py-0.5 text-xs rounded bg-slate-700 text-slate-200 hover:bg-purple-600 hover:text-white transition-colors"
                            >
                                {member.name} ({member.hp}/{member.maxHp} HP)
                            </button>
                        ) : null,
                    )}
                </div>
            )}
        </div>
    );
};

export default CastSpellControls;
