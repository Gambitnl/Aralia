/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file DiceScaleSlider.tsx
 * Simple scale slider with a D20 icon that grows/shrinks based on the value.
 */
import React from 'react';
interface DiceScaleSliderProps {
    value: number;
    min?: number;
    max?: number;
    onChange: (value: number) => void;
}
export declare const DiceScaleSlider: React.FC<DiceScaleSliderProps>;
export default DiceScaleSlider;
