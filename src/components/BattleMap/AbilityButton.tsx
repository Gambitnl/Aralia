// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 11/07/2026, 23:22:49
 * Dependents: components/BattleMap/AbilityPalette.tsx
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file AbilityButton.tsx
 * A dedicated component for displaying a single ability button in the palette.
 */
import React, { useMemo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Crosshair } from 'lucide-react';
import { Ability } from '../../types/combat';
import Tooltip from '../Tooltip';
import { getAbilityIconVisual } from '../../utils/visuals/combatIconVisuals';

interface AbilityButtonProps {
    ability: Ability;
    onSelect: () => void;
    isDisabled: boolean;
    isSelected?: boolean;
}

// Combat ability ranges are stored in grid tiles. The tooltip also shows the
// D&D-style feet equivalent so melee restrictions are visible before targeting.
const formatAbilityRange = (range: number): string => {
    if (range === 0) return 'Self';
    const tileLabel = range === 1 ? 'tile' : 'tiles';
    return `${range} ${tileLabel} (${range * 5} ft)`;
};

const formatGrantedActionCost = (type: string): string => {
    if (type === 'bonus_action') return 'Bonus Action';
    return type.charAt(0).toUpperCase() + type.slice(1);
};

const AbilityButton: React.FC<AbilityButtonProps> = ({ ability, onSelect, isDisabled, isSelected = false }) => {
    const shouldReduceMotion = useReducedMotion();
    const isOnCooldown = (ability.currentCooldown || 0) > 0;
    const isExhausted = ability.maxUses !== undefined && (ability.usesRemaining ?? ability.maxUses) <= 0;
    const usesLabel = ability.maxUses !== undefined
      ? `${ability.usesRemaining ?? ability.maxUses}/${ability.maxUses}`
      : null;
    const costText = ability.cost.type.charAt(0).toUpperCase() + ability.cost.type.slice(1);
    const rangeText = formatAbilityRange(ability.range);
    const hasWeaponProficiencyWarning = Boolean(ability.weapon && ability.isProficient === false);
    const weaponProficiencyWarning = 'No proficiency bonus or weapon mastery on this attack.';
    const grantedActions = ability.grantedActions ?? [];

    const costColors: Record<string, string> = {
        action: 'bg-rose-600',
        bonus: 'bg-amber-500',
        reaction: 'bg-sky-600',
        free: 'bg-emerald-600',
        'movement-only': 'bg-teal-600',
    };
    
    const costBadgeColor = costColors[ability.cost.type] || 'bg-gray-500';

    // Resolve visuals from the combat icon pack. The helper understands
    // native attacks, movement buttons, spell buttons, and generated follow-up
    // actions so this component can stay focused on rendering the tile.
    const visual = useMemo(() => {
        return getAbilityIconVisual(ability);
    }, [ability]);

    // Apply primary color from visual spec if it's not transparent/default, to give hint of school.
    // Do not override border color if disabled, to ensure the gray disabled state is visible.
    // An armed ability uses the shared sky targeting color instead of its
    // school accent, so the command tile and map HUD read as one interaction.
    const customStyle = (!isDisabled && !isSelected && visual.primaryColor !== 'transparent')
        ? { borderColor: visual.primaryColor }
        : {};

    const tooltipContent = (
        <div className="space-y-1">
            <div className="font-bold text-amber-300 border-b border-gray-600 pb-1 mb-1">{ability.name}</div>
            {ability.spell && (
                <div className="text-[10px] text-sky-300 italic mb-1">
                    {ability.spell.school} {ability.spell.level === 0 ? 'Cantrip' : `Level ${ability.spell.level} Spell`}
                </div>
            )}
            <div className="text-gray-200 leading-tight">{ability.description}</div>
            {hasWeaponProficiencyWarning ? (
                <div className="rounded border border-amber-500/60 bg-amber-950/60 px-2 py-1 text-[10px] font-semibold leading-tight text-amber-200">
                    {weaponProficiencyWarning}
                </div>
            ) : null}
            {grantedActions.length > 0 ? (
                <div className="rounded border border-cyan-500/50 bg-cyan-950/50 px-2 py-1 text-[10px] leading-tight text-cyan-100">
                    <div className="font-semibold text-cyan-200">Grants later action:</div>
                    <ul className="mt-1 space-y-0.5">
                        {grantedActions.map((action, index) => (
                            <li key={`${action.action}-${index}`}>
                                {formatGrantedActionCost(action.type)}: {action.action}
                                {action.frequency ? ` (${action.frequency.replace('_', ' ')})` : ''}
                            </li>
                        ))}
                    </ul>
                </div>
            ) : null}
            <div className="pt-1 mt-1 border-t border-gray-700/50 flex flex-col gap-0.5">
                <div className="flex justify-between text-[10px]">
                    <span className="text-gray-400">Range:</span>
                    <span className="text-amber-200 font-medium">{rangeText}</span>
                </div>
                {ability.cost.movementCost ? (
                    <div className="flex justify-between text-[10px]">
                        <span className="text-gray-400">Movement:</span>
                        <span className="text-teal-300 font-medium">{ability.cost.movementCost} ft</span>
                    </div>
                ) : null}
                {ability.cost.spellSlotLevel ? (
                    <div className="flex justify-between text-[10px]">
                        <span className="text-gray-400">Slot:</span>
                        <span className="text-sky-300 font-medium">Level {ability.cost.spellSlotLevel}</span>
                    </div>
                ) : null}
                {isOnCooldown ? (
                    <div className="flex justify-between text-[10px]">
                        <span className="text-gray-400">Cooldown:</span>
                        <span className="text-red-400 font-medium">{ability.currentCooldown} turns</span>
                    </div>
                ) : null}
                {usesLabel ? (
                    <div className="flex justify-between text-[10px]">
                        <span className="text-gray-400">Uses:</span>
                        <span className={isExhausted ? 'text-red-400 font-medium' : 'text-emerald-300 font-medium'}>{usesLabel}</span>
                    </div>
                ) : null}
            </div>
        </div>
    );

    const grantedActionLabel = grantedActions.length > 0
        ? `, grants ${grantedActions.map(action => `${formatGrantedActionCost(action.type)} ${action.action}`).join(', ')}`
        : '';
    const accessibleLabel = `${visual.label}, ${costText} cost, range ${rangeText}${grantedActionLabel}${hasWeaponProficiencyWarning ? `, warning: ${weaponProficiencyWarning}` : ''}${isOnCooldown ? `, ${ability.currentCooldown} turn cooldown` : ''}${isExhausted ? ', depleted' : usesLabel ? `, ${usesLabel} uses` : ''}`;

    // The armed tile stays visibly connected to the targeting HUD on the map.
    // Keeping the button itself as the pressed control also gives keyboard and
    // screen-reader players the same state that sighted players see in the ring.
    const button = (
        <motion.button
                onClick={onSelect}
                disabled={isDisabled}
                aria-label={accessibleLabel}
                aria-disabled={isDisabled}
                aria-pressed={isSelected}
                style={customStyle}
                whileHover={isDisabled ? undefined : { scale: shouldReduceMotion ? 1 : 1.05 }}
                whileTap={isDisabled ? undefined : { scale: shouldReduceMotion ? 1 : 0.95 }}
                transition={{ duration: 0.1 }}
                className={`relative w-16 h-[4.5rem] rounded-lg flex flex-col items-center justify-center p-1 text-white border-2 outline-none focus-visible:ring-2 focus-visible:ring-sky-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900
                    ${isDisabled
                        ? 'bg-slate-800/50 border-slate-600 cursor-not-allowed opacity-60'
                        : isSelected
                            ? 'border-sky-300 bg-sky-950/90 ring-2 ring-sky-400/80 shadow-[0_0_18px_rgba(56,189,248,0.5)] cursor-pointer'
                            : hasWeaponProficiencyWarning
                                ? 'bg-amber-950 hover:bg-amber-900 border-amber-400 cursor-pointer'
                                : 'bg-slate-800 hover:bg-slate-700 border-slate-600 cursor-pointer'}
                `}
            >
                <span className="text-2xl flex-grow flex items-center drop-shadow-md">
                    {visual.src ? (
                        <img src={visual.src} alt="" className="w-9 h-9 object-contain" />
                    ) : (
                        visual.fallbackContent
                    )}
                </span>
                {/* The ability NAME on the face — colored glyphs alone are
                    unreadable at a glance; the tooltip keeps the full text. */}
                <span className="w-full truncate text-center text-[9px] font-semibold leading-tight text-slate-200">
                    {ability.name}
                </span>

                {/* Cost Badge */}
                <div className={`absolute -top-1 -right-1 px-1.5 py-0.5 text-[10px] font-bold rounded-full shadow-md ${costBadgeColor}`}>
                    {costText}
                </div>

                {/* A crosshair is a compact, language-independent signal that
                    this exact ability owns the target picker. Clicking the
                    pressed tile again is handled by the palette as cancel. */}
                {isSelected ? (
                    <div
                        aria-hidden="true"
                        className="absolute -left-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full border border-sky-100 bg-sky-500 text-slate-950 shadow-md"
                    >
                        <Crosshair size={12} strokeWidth={3} />
                    </div>
                ) : null}

                {/* Spells like Minor Illusion and Wall of Light grant later
                    actions after the initial cast. Mark those abilities in the
                    palette so players can see that the spell creates follow-up
                    choices even before the dedicated secondary-action buttons
                    are wired. */}
                {grantedActions.length > 0 ? (
                    <div
                        aria-hidden="true"
                        className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border border-cyan-200 bg-cyan-500 text-[10px] font-black text-black shadow-md"
                    >
                        +
                    </div>
                ) : null}

                {/* Non-proficient weapon attacks are usable, but players need a visible combat warning before selecting them. */}
                {hasWeaponProficiencyWarning ? (
                    <div
                        aria-hidden="true"
                        className="absolute -bottom-1 -left-1 flex h-5 w-5 items-center justify-center rounded-full border border-amber-200 bg-amber-500 text-[12px] font-black text-black shadow-md"
                    >
                        !
                    </div>
                ) : null}

                {isOnCooldown && (
                    <div className="absolute inset-0 bg-black/70 flex items-center justify-center text-amber-400 font-bold text-lg rounded-md">
                        {ability.currentCooldown}
                    </div>
                )}
                {isExhausted && !isOnCooldown && (
                    <div className="absolute inset-0 bg-black/70 flex items-center justify-center text-red-400 font-bold text-xs rounded-md">
                        0/{ability.maxUses}
                    </div>
                )}
            </motion.button>
    );

    // Selecting an ability can leave the pointer resting on its tile. Unmount
    // that hover tooltip once armed because the map HUD now owns the details;
    // otherwise two floating explanations compete over the battlefield.
    return isSelected ? button : <Tooltip content={tooltipContent}>{button}</Tooltip>;
};

export default AbilityButton;
