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

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 29/10/2026, 17:15:11
 * Dependents: components/CharacterSheet/Spellbook/SpellbookOverlay.tsx, components/CharacterSheet/Spellbook/SpellbookTab.tsx
 * Imports: 6 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import React, { useEffect, useState } from 'react';
import { PlayerCharacter, Spell, Action, type Item } from '../../../types';
import {useOptionalGameState} from '../../../state/GameContext';
import {containedWaterGallons,waterCapacityGallons,GALLONS_PER_WATER_DAY} from '../../../systems/travel/containedWater';
import {CONTAINED_WATER_SPELL_ID,prepareContainedWaterCast} from '../../../systems/gameplay/containedWaterCasting';
import {generateId} from '../../../utils/core/idGenerator';
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

    const castability = getOutOfCombatCastability(character, spell);
    if (spell.id===CONTAINED_WATER_SPELL_ID) return <ContainedWaterControls spell={spell} character={character}
        isReadyToCast={isReadyToCast} notReadyReason={notReadyReason} onAction={onAction}/>;

    // Reactions explain their missing trigger; attack/save spells retain the
    // battle-map instruction. Neither offers an unconditional downtime cast.
    if (!isSpellCastableOutOfCombat(spell)) {
        return (
            <div
                data-testid="cast-spell-controls"
                className="px-6 py-2 border-b border-slate-700 bg-slate-800/30 text-sm text-slate-300"
            >
                {castability.reason ?? 'Combat spell — cast it from the battle map.'}
            </div>
        );
    }

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

/** Container selection is explicit: rain and fog need world-area targeting,
 * while contained modes change only the reviewed vessel already carried. */
function ContainedWaterControls({spell,character,isReadyToCast,notReadyReason,onAction}:CastSpellControlsProps) {
    const context=useOptionalGameState();
    const [mode,setMode]=useState<'create'|'destroy'>('create');
    const [selection,setSelection]=useState<{index:number;sourceItem:Item}|null>(null);
    const [submittedId,setSubmittedId]=useState<string|null>(null);
    const state=context?.state,castability=getOutOfCombatCastability(character,spell);
    useEffect(()=>{
        // Adopt only our own successful cast receipt. Another inventory change
        // must not silently retarget the player's still-open vessel quote.
        const receiptIndex=submittedId?state?.inventory.findIndex(item=>item.containedWater?.lastCastId===submittedId)??-1:-1;
        if (receiptIndex>=0&&state) {
            setSelection({index:receiptIndex,sourceItem:state.inventory[receiptIndex]});setSubmittedId(null);
        }
    },[state?.inventory,selection,submittedId]);
    const vessels=state?.inventory.map((item,i)=>({item,index:i,capacity:waterCapacityGallons(item)})).filter(v=>v.capacity>0)??[];
    const index=selection?.index??null,source=selection?.sourceItem;
    const payload=source&&index!==null?{characterId:character.id!,spellId:spell.id,spellLevel:castability.castLevel??spell.level,
        outOfCombat:{targetCharacterId:character.id!,water:{mode,inventoryIndex:index,sourceItem:source,castId:'review'}}}:null;
    const offer=state&&payload?prepareContainedWaterCast(state,payload):null;
    const error=!isReadyToCast?notReadyReason:!castability.allowed?castability.reason:offer&&'error'in offer?offer.error:undefined;
    return <section aria-label="Contained water casting" className="border-b border-slate-700 bg-slate-800/30 px-6 py-4 text-sm text-slate-200">
        <p className="font-semibold">Choose what to do with water</p>
        <div className="my-3 flex flex-wrap gap-3">
            <button className={`rounded border px-3 py-2 ${mode==='create'?'border-emerald-300 bg-emerald-900 text-white':'border-slate-500'}`} aria-pressed={mode==='create'} onClick={()=>setMode('create')}>Create contained water</button>
            <button className={`rounded border px-3 py-2 ${mode==='destroy'?'border-emerald-300 bg-emerald-900 text-white':'border-slate-500'}`} aria-pressed={mode==='destroy'} onClick={()=>setMode('destroy')}>Destroy contained water</button>
        </div>
        <p className="mb-3 text-slate-300">Rain and fog require an area in the world; this panel selects a carried vessel.</p>
        <label className="block">Open vessel
            <select className="ml-3 min-h-11 rounded bg-slate-900 px-3 text-white" value={index??''} onChange={e=>{
                const i=e.target.value===''?null:Number(e.target.value);setSubmittedId(null);
                setSelection(i===null||!state?.inventory[i]?null:{index:i,sourceItem:state.inventory[i]});
            }}>
                <option value="">Choose a vessel</option>
                {vessels.map(v=><option key={v.index} value={v.index}>{v.item.name}{(v.item.quantity??1)>1?` (one of ${v.item.quantity})`:''} — {containedWaterGallons(v.item).toFixed(2)} / {v.capacity.toFixed(2)} gallons</option>)}
            </select>
        </label>
        {!vessels.length&&<p className="mt-2 text-amber-200">No separately carried vessel has a known liquid capacity.</p>}
        {source&&<p className="mt-3" aria-live="polite">Contains {containedWaterGallons(source).toFixed(2)} gallons ({(containedWaterGallons(source)/GALLONS_PER_WATER_DAY).toFixed(2)} water-days). The vessel stays yours.</p>}
        {offer&&!('error'in offer)&&<p className="mt-2">{mode==='create'?'Create':'Destroy'} {offer.gallons.toFixed(2)} gallons in this vessel. Uses one level {castability.castLevel} slot.</p>}
        {/* This is a preview of another cast, not a receipt for the last one.
            The saved log and actual slot pips report the completed action. */}
        {error&&<p className="mt-2 text-amber-200">{error.replace(' No spell slot was spent.','')}</p>}
        <button className="mt-3 rounded bg-emerald-700 px-4 py-2 font-semibold disabled:opacity-50" disabled={!payload||!offer||Boolean(error)}
            onClick={()=>{if(!payload||!state||'error'in prepareContainedWaterCast(state,payload))return;
                const castId=generateId();setSubmittedId(castId);
                onAction({type:'CAST_SPELL',label:`${mode==='create'?'Create':'Destroy'} contained water`,payload:{...payload,
                    outOfCombat:{...payload.outOfCombat,water:{...payload.outOfCombat.water,castId}}}});
            }}>{mode==='create'?'Create water in selected vessel':'Destroy water in selected vessel'}</button>
    </section>;
}
