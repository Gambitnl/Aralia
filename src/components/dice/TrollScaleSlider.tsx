/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file TrollScaleSlider.tsx
 * A whimsical scale slider featuring a troll that eats sheep when you
 * increase the value and poops them out when you decrease it.
 */
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface TrollScaleSliderProps {
    value: number;
    min?: number;
    max?: number;
    onChange: (value: number) => void;
}

// Simple SVG sheep
const SheepSVG: React.FC<{ className?: string }> = ({ className }) => (
    <svg viewBox="0 0 32 32" className={className} fill="currentColor">
        {/* Body - fluffy wool */}
        <ellipse cx="16" cy="18" rx="10" ry="8" fill="#f5f5f5" />
        <circle cx="10" cy="16" r="4" fill="#f5f5f5" />
        <circle cx="22" cy="16" r="4" fill="#f5f5f5" />
        <circle cx="12" cy="12" r="3" fill="#f5f5f5" />
        <circle cx="20" cy="12" r="3" fill="#f5f5f5" />
        {/* Head */}
        <ellipse cx="6" cy="16" rx="4" ry="3" fill="#2d2d2d" />
        {/* Ears */}
        <ellipse cx="4" cy="13" rx="2" ry="1" fill="#2d2d2d" />
        <ellipse cx="8" cy="13" rx="2" ry="1" fill="#2d2d2d" />
        {/* Eyes */}
        <circle cx="4" cy="15" r="1" fill="white" />
        <circle cx="7" cy="15" r="1" fill="white" />
        {/* Legs */}
        <rect x="10" y="24" width="2" height="5" rx="1" fill="#2d2d2d" />
        <rect x="14" y="24" width="2" height="5" rx="1" fill="#2d2d2d" />
        <rect x="18" y="24" width="2" height="5" rx="1" fill="#2d2d2d" />
        <rect x="22" y="24" width="2" height="5" rx="1" fill="#2d2d2d" />
    </svg>
);

// Poop SVG (the output when decreasing)
const PoopSVG: React.FC<{ className?: string }> = ({ className }) => (
    <svg viewBox="0 0 32 32" className={className} fill="currentColor">
        {/* Main poop swirl */}
        <ellipse cx="16" cy="26" rx="12" ry="5" fill="#6B4423" />
        <ellipse cx="16" cy="22" rx="10" ry="5" fill="#7B5433" />
        <ellipse cx="16" cy="18" rx="8" ry="4" fill="#8B6443" />
        <ellipse cx="16" cy="14" rx="6" ry="3.5" fill="#7B5433" />
        {/* Top swirl */}
        <ellipse cx="16" cy="10" rx="4" ry="3" fill="#6B4423" />
        <circle cx="16" cy="7" r="2.5" fill="#7B5433" />
        {/* Eyes */}
        <circle cx="13" cy="18" r="2" fill="white" />
        <circle cx="19" cy="18" r="2" fill="white" />
        <circle cx="13" cy="18" r="1" fill="#2d2d2d" />
        <circle cx="19" cy="18" r="1" fill="#2d2d2d" />
        {/* Smile */}
        <path d="M 12 22 Q 16 25 20 22" fill="none" stroke="#4a3015" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
);

// Troll SVG (hungry lil' guy)
const TrollSVG: React.FC<{ isEating?: boolean; isPooping?: boolean }> = ({ isEating, isPooping }) => (
    <svg viewBox="0 0 64 80" className="w-16 h-20">
        {/* Body */}
        <ellipse cx="32" cy="55" rx="20" ry="18" fill="#5a7247" />
        {/* Head */}
        <circle cx="32" cy="28" r="18" fill="#6b8a50" />
        {/* Ears */}
        <ellipse cx="14" cy="22" rx="6" ry="10" fill="#6b8a50" />
        <ellipse cx="50" cy="22" rx="6" ry="10" fill="#6b8a50" />
        {/* Nose */}
        <ellipse cx="32" cy="32" rx="6" ry="5" fill="#4a6038" />
        <circle cx="29" cy="32" r="1.5" fill="#2d3d22" />
        <circle cx="35" cy="32" r="1.5" fill="#2d3d22" />
        {/* Eyes */}
        <circle cx="24" cy="24" r="5" fill="white" />
        <circle cx="40" cy="24" r="5" fill="white" />
        <motion.circle
            cx="24" cy="24" r="2.5" fill="#2d2d2d"
            animate={{ scale: isEating ? [1, 1.3, 1] : 1 }}
            transition={{ duration: 0.2 }}
        />
        <motion.circle
            cx="40" cy="24" r="2.5" fill="#2d2d2d"
            animate={{ scale: isEating ? [1, 1.3, 1] : 1 }}
            transition={{ duration: 0.2 }}
        />
        {/* Mouth */}
        <motion.path
            d={isEating
                ? "M 22 40 Q 32 52 42 40" // Open wide
                : "M 24 38 Q 32 44 40 38" // Content smile
            }
            fill="#3d2929"
            stroke="#2d2d2d"
            strokeWidth="1"
            animate={{ d: isEating ? "M 22 40 Q 32 52 42 40" : "M 24 38 Q 32 44 40 38" }}
        />
        {/* Teeth (visible when eating) */}
        {isEating && (
            <>
                <rect x="26" y="40" width="3" height="4" fill="white" rx="1" />
                <rect x="31" y="40" width="3" height="4" fill="white" rx="1" />
                <rect x="36" y="40" width="3" height="4" fill="white" rx="1" />
            </>
        )}
        {/* Arms */}
        <ellipse cx="12" cy="52" rx="6" ry="10" fill="#5a7247" />
        <ellipse cx="52" cy="52" rx="6" ry="10" fill="#5a7247" />
        {/* Belly highlight */}
        <ellipse cx="32" cy="58" rx="12" ry="10" fill="#6b8a50" opacity="0.5" />
        {/* Poop indicator */}
        {isPooping && (
            <motion.g
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
            >
                <text x="28" y="78" fontSize="12">💩</text>
            </motion.g>
        )}
    </svg>
);

// Poop indicator for animation
const PoopIndicator: React.FC = () => (
    <motion.div
        className="absolute -bottom-2 left-1/2 transform -translate-x-1/2"
        initial={{ opacity: 0, scale: 0, y: -10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0, y: 10 }}
    >
        <PoopSVG className="w-6 h-6" />
    </motion.div>
);

export const TrollScaleSlider: React.FC<TrollScaleSliderProps> = ({
    value,
    min = 5,
    max = 20,
    onChange,
}) => {
    const [isEating, setIsEating] = useState(false);
    const [isPooping, setIsPooping] = useState(false);
    const [flyingSheep, setFlyingSheep] = useState<{ id: number; direction: 'in' | 'out' }[]>([]);
    const prevValueRef = useRef(value);
    const sheepIdRef = useRef(0);

    useEffect(() => {
        const diff = value - prevValueRef.current;

        if (diff > 0) {
            // Increasing = troll eats sheep
            setIsEating(true);
            setFlyingSheep(prev => [...prev, { id: sheepIdRef.current++, direction: 'in' }]);
            setTimeout(() => setIsEating(false), 300);
        } else if (diff < 0) {
            // Decreasing = troll poops sheep
            setIsPooping(true);
            setFlyingSheep(prev => [...prev, { id: sheepIdRef.current++, direction: 'out' }]);
            setTimeout(() => setIsPooping(false), 300);
        }

        prevValueRef.current = value;
    }, [value]);

    // Clean up old flying sheep
    useEffect(() => {
        if (flyingSheep.length > 0) {
            const timer = setTimeout(() => {
                setFlyingSheep(prev => prev.slice(1));
            }, 600);
            return () => clearTimeout(timer);
        }
    }, [flyingSheep]);

    const percentage = ((value - min) / (max - min)) * 100;

    // Button handlers for discrete +/- control
    const handleIncrement = () => {
        if (value < max) {
            onChange(value + 1);
        }
    };

    const handleDecrement = () => {
        if (value > min) {
            onChange(value - 1);
        }
    };

    return (
        <div className="relative flex gap-2 h-full min-h-[120px]">
            {/* Vertical slider column */}
            <div className="flex flex-col items-center gap-1">
                {/* Increment button (sheep = feed troll = bigger dice) - TOP */}
                <button
                    onClick={handleIncrement}
                    disabled={value >= max}
                    className="relative w-10 h-10 flex items-center justify-center bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:opacity-50 rounded-lg border border-gray-600 transition-colors group"
                    title="Increase dice size"
                >
                    <span className="absolute -top-1 -right-1 text-xs font-bold text-green-400 group-hover:text-green-300">+</span>
                    <SheepSVG className="w-6 h-6" />
                </button>

                {/* Vertical slider track */}
                <div className="relative w-8 flex-1 min-h-[60px]">
                    {/* Track background */}
                    <div className="absolute left-1/2 -translate-x-1/2 top-0 bottom-0 w-3 bg-gray-700 rounded-full overflow-hidden">
                        {/* Filled portion (grass) - grows from bottom */}
                        <div
                            className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-green-700 to-green-500 transition-all duration-100"
                            style={{ height: `${percentage}%` }}
                        />
                    </div>

                    {/* Slider input (invisible but functional) - rotated for vertical */}
                    <input
                        type="range"
                        min={min}
                        max={max}
                        step={1}
                        value={value}
                        onChange={(e) => onChange(Number(e.target.value))}
                        className="absolute left-1/2 top-1/2 h-8 opacity-0 cursor-pointer z-[var(--z-index-content-overlay-low)] origin-center -rotate-90 -translate-x-1/2 -translate-y-1/2"
                        style={{ width: '100px' }}
                    />

                    {/* Slider thumb */}
                    <div
                        className="absolute left-1/2 -translate-x-1/2 transition-all duration-100 pointer-events-none"
                        style={{ bottom: `calc(${percentage}% - 10px)` }}
                    >
                        <div className="w-5 h-5 bg-amber-500 rounded-full border-2 border-amber-300 shadow-lg flex items-center justify-center">
                            <span className="text-[10px] font-bold text-amber-900">{value}</span>
                        </div>
                    </div>

                </div>

                {/* Decrement button (poop = shrink dice) - BOTTOM */}
                <button
                    onClick={handleDecrement}
                    disabled={value <= min}
                    className="relative w-10 h-10 flex items-center justify-center bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:opacity-50 rounded-lg border border-gray-600 transition-colors group"
                    title="Decrease dice size"
                >
                    <span className="absolute -bottom-1 -right-1 text-xs font-bold text-red-400 group-hover:text-red-300">−</span>
                    <PoopSVG className="w-6 h-6" />
                </button>
            </div>

            {/* Troll (next to slider) */}
            <div className="relative flex flex-col items-center justify-center">
                <TrollSVG isEating={isEating} isPooping={isPooping} />
                <AnimatePresence>
                    {isPooping && <PoopIndicator />}
                </AnimatePresence>
            </div>

            {/* Flying sheep/poop animations - positioned absolutely over entire component */}
            <AnimatePresence>
                {flyingSheep.map(sheep => (
                    <motion.div
                        key={sheep.id}
                        className="absolute pointer-events-none z-[var(--z-index-submap-overlay)]"
                        initial={{
                            // Start at sheep button (top-left) or troll mouth (right)
                            x: sheep.direction === 'in' ? 20 : 70,
                            y: sheep.direction === 'in' ? 5 : 30,
                            opacity: 1,
                            scale: 1,
                            rotate: 0,
                        }}
                        animate={{
                            // End at troll mouth (right) or poop button (bottom-left)
                            x: sheep.direction === 'in' ? [20, 45, 70] : [70, 35, 20],
                            y: sheep.direction === 'in' ? [5, -15, 30] : [30, 50, 100],
                            opacity: [1, 1, 0],
                            scale: sheep.direction === 'in' ? [1, 1.2, 0.5] : [0.5, 1, 1.2],
                            rotate: sheep.direction === 'in' ? [0, -20, 15] : [0, 180, 360],
                        }}
                        transition={{
                            duration: 0.6,
                            ease: 'easeOut',
                            times: [0, 0.5, 1],
                        }}
                    >
                        {sheep.direction === 'in' ? (
                            <SheepSVG className="w-6 h-6 text-white drop-shadow-lg" />
                        ) : (
                            <PoopSVG className="w-5 h-5 drop-shadow-lg" />
                        )}
                    </motion.div>
                ))}
            </AnimatePresence>
        </div>
    );
};

export default TrollScaleSlider;
