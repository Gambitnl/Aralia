/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file DiceScaleSlider.tsx
 * Simple scale slider with a D20 icon that grows/shrinks based on the value.
 */
import React from 'react';
import { D20SVG } from './DiceSVGs';

interface DiceScaleSliderProps {
    value: number;
    min?: number;
    max?: number;
    onChange: (value: number) => void;
}

export const DiceScaleSlider: React.FC<DiceScaleSliderProps> = ({
    value,
    min = 5,
    max = 20,
    onChange,
}) => {
    const percentage = ((value - min) / (max - min)) * 100;
    // Scale the D20 from 24px at min to 48px at max
    const diceSize = 24 + (percentage / 100) * 24;

    return (
        <div className="flex items-center gap-3">
            {/* Slider */}
            <div className="relative flex-1 min-w-[80px]">
                <input
                    type="range"
                    min={min}
                    max={max}
                    step={1}
                    value={value}
                    onChange={(e) => onChange(Number(e.target.value))}
                    className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer
                        [&::-webkit-slider-thumb]:appearance-none
                        [&::-webkit-slider-thumb]:w-4
                        [&::-webkit-slider-thumb]:h-4
                        [&::-webkit-slider-thumb]:bg-amber-500
                        [&::-webkit-slider-thumb]:rounded-full
                        [&::-webkit-slider-thumb]:cursor-pointer
                        [&::-webkit-slider-thumb]:border-2
                        [&::-webkit-slider-thumb]:border-amber-300
                        [&::-webkit-slider-thumb]:shadow-lg
                        [&::-moz-range-thumb]:w-4
                        [&::-moz-range-thumb]:h-4
                        [&::-moz-range-thumb]:bg-amber-500
                        [&::-moz-range-thumb]:rounded-full
                        [&::-moz-range-thumb]:cursor-pointer
                        [&::-moz-range-thumb]:border-2
                        [&::-moz-range-thumb]:border-amber-300"
                />
                <span className="absolute -top-4 left-1/2 -translate-x-1/2 text-[10px] text-gray-400 font-bold">
                    Scale: {value}
                </span>
            </div>

            {/* D20 that grows with value */}
            <div
                className="flex items-center justify-center transition-all duration-150"
                style={{ width: '48px', height: '48px' }}
            >
                <D20SVG
                    className="text-amber-400 transition-all duration-150"
                    style={{ width: `${diceSize}px`, height: `${diceSize}px` }}
                />
            </div>
        </div>
    );
};

export default DiceScaleSlider;
