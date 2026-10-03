/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file LockpickingModal.tsx
 * Accessible modal for lockpicking gameplay. Allows players to attempt
 * picking locks using Thieves' Tools or forcing them open with Strength.
 */
import React from 'react';
import { Lock as LockType, LockpickResult, BreakResult } from '../../systems/puzzles/types';
import { PlayerCharacter } from '../../types/character';
import { Item } from '../../types/items';
interface LockpickingModalProps {
    isOpen: boolean;
    onClose: () => void;
    lock: LockType;
    character: PlayerCharacter;
    inventory: Item[];
    onLockpickResult?: (result: LockpickResult) => void;
    onBreakResult?: (result: BreakResult) => void;
}
export declare const LockpickingModal: React.FC<LockpickingModalProps>;
export default LockpickingModal;
