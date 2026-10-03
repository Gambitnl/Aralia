/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file TrollScaleSlider.tsx
 * A whimsical scale slider featuring a troll that eats sheep when you
 * increase the value and poops them out when you decrease it.
 */
import React from 'react';
interface TrollScaleSliderProps {
    value: number;
    min?: number;
    max?: number;
    onChange: (value: number) => void;
}
export declare const TrollScaleSlider: React.FC<TrollScaleSliderProps>;
export default TrollScaleSlider;
