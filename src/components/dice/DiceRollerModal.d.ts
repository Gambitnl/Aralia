/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file DiceRollerModal.tsx
 * 3D dice roller modal using @3d-dice/dice-box for visual dice rolling.
 * Features dice pool builder with count badges and +/- controls.
 */
import React from 'react';
interface DiceRollerModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialNotation?: string;
    onRollComplete?: (total: number, rolls: Array<{
        die: string;
        value: number;
    }>) => void;
}
export declare const DiceRollerModal: React.FC<DiceRollerModalProps>;
export default DiceRollerModal;
