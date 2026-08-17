/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/components/BattleMap/CombatCommandToolbar.tsx
 *
 * The Move / Attack command pair.
 *
 * It used to float over the top-left of the battle map, on the combat overlay
 * layer, away from every other thing the player does on their turn. It now
 * lives in the ACTIONS panel beside the action economy it spends, so the whole
 * turn reads in one place (Remy, 2026-08-16).
 *
 * Presentational only. It owns no state and assumes no position: the parent
 * decides where it sits, which is what let it move out of the map without a
 * rewrite. The battle map still owns the modes; this reports and sets them.
 */
import React from 'react';
import { Footprints, Swords } from 'lucide-react';
import type { Ability } from '../../types/combat';

export interface CombatCommandToolbarProps {
    /** Current battle-map interaction mode. */
    actionMode: 'move' | 'ability' | null;
    /** Switch to movement. Cancels any half-armed attack first. */
    onMove: () => void;
    /** Arm the quick attack, or cancel it when it is already armed. */
    onAttack: () => void;
    /**
     * The character's best ready direct attack, or null when none is. Null
     * disables the button rather than arming a movement or utility ability.
     */
    quickAttack: Ability | null;
    /** True while `quickAttack` is the armed targeting ability. */
    quickAttackIsArmed: boolean;
}

export const CombatCommandToolbar: React.FC<CombatCommandToolbarProps> = ({
    actionMode,
    onMove,
    onAttack,
    quickAttack,
    quickAttackIsArmed,
}) => (
    <div
        data-testid="battle-map-command-toolbar"
        className="flex gap-2"
        role="group"
        aria-label="Battle map commands"
    >
        <button
            onClick={onMove}
            type="button"
            aria-pressed={actionMode === 'move'}
            aria-label="Move on the battle map"
            className={`inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded px-3 text-xs font-semibold transition-colors ${
                actionMode === 'move'
                    ? 'bg-blue-600 text-white ring-2 ring-blue-300'
                    : 'bg-gray-600 hover:bg-gray-500'
            }`}
        >
            <Footprints size={14} aria-hidden="true" />
            <span>Move</span>
        </button>
        <button
            onClick={onAttack}
            type="button"
            disabled={!quickAttack}
            aria-pressed={quickAttackIsArmed}
            aria-label={
                quickAttack ? `Attack with ${quickAttack.name}` : 'No direct attack available'
            }
            title={
                quickAttack
                    ? `Attack with ${quickAttack.name}`
                    : 'No direct action attack is ready'
            }
            className={`inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded px-3 text-xs font-semibold transition-colors ${
                !quickAttack
                    ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                    : quickAttackIsArmed
                        ? 'bg-red-600 text-white ring-2 ring-red-300'
                        : 'bg-gray-600 hover:bg-gray-500'
            }`}
        >
            <Swords size={14} aria-hidden="true" />
            <span>Attack</span>
        </button>
    </div>
);

export default CombatCommandToolbar;
