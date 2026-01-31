import React from 'react';
import { CharacterVisualConfig, CharacterGender } from '../../services/CharacterAssetService';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Z_INDEX } from '../../styles/zIndex';

interface VisualsSelectionProps {
    visuals: CharacterVisualConfig;
    onVisualsChange: (visuals: Partial<CharacterVisualConfig>) => void;
    onNext: () => void;
    onBack: () => void;
}

const VisualsSelection: React.FC<VisualsSelectionProps> = ({
    visuals,
    onVisualsChange,
    onNext,
    onBack,
}) => {
    const skinColors = [1, 2, 3, 4, 5];
    const hairStyles = ['Hair1', 'Hair2', 'Hair3', 'Hair4', 'Hair5'];

    const maleClothing = ['Shirt', 'Blue Shirt v2', 'Green Shirt v2', 'Purple Shirt v2', 'orange Shirt v2'];
    const femaleClothing = ['Corset', 'Blue Corset', 'Green Corset', 'Orange Corset', 'Purple Corset'];

    const clothingOptions = visuals.gender === 'Male' ? maleClothing : femaleClothing;

    const handleGenderChange = (gender: CharacterGender) => {
        onVisualsChange({
            gender,
            hairStyle: 'Hair1', // Reset hair for new gender
            clothing: gender === 'Male' ? 'Shirt' : 'Corset'
        });
    };

    const cyclingUpdate = <K extends keyof CharacterVisualConfig>(
        list: CharacterVisualConfig[K][],
        current: CharacterVisualConfig[K],
        key: K,
        delta: number
    ) => {
        const index = list.indexOf(current);
        const nextIndex = (index + delta + list.length) % list.length;
        onVisualsChange({ [key]: list[nextIndex] } as Partial<CharacterVisualConfig>);
    };

    return (
        <div className="flex flex-col items-center">
            <h2 className="text-2xl font-cinzel text-amber-500 mb-6 uppercase tracking-widest">Customize Appearance</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-12 w-full max-w-4xl px-4">
                {/* Controls Area */}
                <div className="space-y-8 bg-black/40 p-8 rounded-2xl border border-gray-700 shadow-xl">
                    {/* Gender Selection */}
                    <div className="space-y-3">
                        <p className="text-gray-400 uppercase text-xs font-bold tracking-widest">Gender</p>
                        <div className="flex gap-4">
                            {(['Male', 'Female'] as CharacterGender[]).map(g => (
                                <button
                                    key={g}
                                    onClick={() => handleGenderChange(g)}
                                    className={`flex-1 py-3 px-6 rounded-xl border-2 transition-all font-bold ${visuals.gender === g
                                            ? 'bg-amber-500/20 border-amber-500 text-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.3)]'
                                            : 'bg-gray-800 border-gray-700 text-gray-500 hover:border-gray-600 hover:text-gray-300'
                                        }`}
                                >
                                    {g}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Skin Tone Selection */}
                    <div className="space-y-3">
                        <p className="text-gray-400 uppercase text-xs font-bold tracking-widest">Skin Tone</p>
                        <div className="flex justify-between items-center gap-4">
                            <button onClick={() => cyclingUpdate(skinColors, visuals.skinColor, 'skinColor', -1)} className="p-2 hover:bg-gray-700 rounded-full transition-colors text-amber-500">
                                <ChevronLeft />
                            </button>
                            <div className="flex gap-2 justify-center flex-1">
                                {skinColors.map(c => (
                                    <button
                                        key={c}
                                        type="button"
                                        onClick={() => onVisualsChange({ skinColor: c })}
                                        className={`w-8 h-8 rounded-full cursor-pointer border-2 transition-transform hover:scale-110 ${visuals.skinColor === c ? 'border-amber-400 ring-2 ring-amber-500/50' : 'border-black'
                                            }`}
                                        style={{ backgroundColor: getSkinHex(c) }}
                                        aria-label={`Select skin tone ${c}`}
                                    />
                                ))}
                            </div>
                            <button onClick={() => cyclingUpdate(skinColors, visuals.skinColor, 'skinColor', 1)} className="p-2 hover:bg-gray-700 rounded-full transition-colors text-amber-500">
                                <ChevronRight />
                            </button>
                        </div>
                    </div>

                    {/* Hair Style */}
                    <div className="space-y-3">
                        <p className="text-gray-400 uppercase text-xs font-bold tracking-widest">Hair Style</p>
                        <div className="flex justify-between items-center bg-gray-800 border-2 border-gray-700 rounded-xl px-4 py-3">
                            <button onClick={() => cyclingUpdate(hairStyles, visuals.hairStyle, 'hairStyle', -1)} className="p-1 hover:text-amber-500 transition-colors">
                                <ChevronLeft />
                            </button>
                            <span className="font-bold text-gray-200 uppercase tracking-tighter">Style {visuals.hairStyle.replace('Hair', '')}</span>
                            <button onClick={() => cyclingUpdate(hairStyles, visuals.hairStyle, 'hairStyle', 1)} className="p-1 hover:text-amber-500 transition-colors">
                                <ChevronRight />
                            </button>
                        </div>
                    </div>

                    {/* Clothing */}
                    <div className="space-y-3">
                        <p className="text-gray-400 uppercase text-xs font-bold tracking-widest">Outfit</p>
                        <div className="flex justify-between items-center bg-gray-800 border-2 border-gray-700 rounded-xl px-4 py-3">
                            <button onClick={() => cyclingUpdate(clothingOptions, visuals.clothing, 'clothing', -1)} className="p-1 hover:text-amber-500 transition-colors">
                                <ChevronLeft />
                            </button>
                            <span className="font-bold text-gray-200 text-sm whitespace-nowrap overflow-hidden text-ellipsis px-2">
                                {visuals.clothing}
                            </span>
                            <button onClick={() => cyclingUpdate(clothingOptions, visuals.clothing, 'clothing', 1)} className="p-1 hover:text-amber-500 transition-colors">
                                <ChevronRight />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Preview Area */}
                <div className="flex flex-col items-center justify-center space-y-6">
                    <div className="relative w-64 h-80 bg-gradient-to-t from-gray-900 to-gray-800 rounded-3xl border-4 border-amber-500/30 overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)]">
                        {/* Placeholder for real layered preview if we could use the painter here */}
                        <div className="absolute inset-0 flex items-center justify-center select-none opacity-20 group">
                            <div className="text-amber-500 font-cinzel text-center">
                                <div className="text-4xl mb-4">Preview</div>
                                <div className="text-xs uppercase tracking-[0.2em]">Appearance Locked</div>
                            </div>
                        </div>

                        {/* Layered Image Preview */}
                        <LayeredPreview visuals={visuals} />
                    </div>
                    <div className="text-center italic text-gray-400 text-sm max-w-xs">
                        &quot;Your outward form reflects the spirit within. Choose wisely, traveler.&quot;
                    </div>
                </div>
            </div>

            <div className="mt-12 flex gap-6 w-full max-w-lg">
                <button
                    onClick={onBack}
                    className="flex-1 py-4 bg-gray-800 hover:bg-gray-700 border border-gray-600 text-gray-300 font-bold rounded-xl transition-all uppercase tracking-widest"
                >
                    Back
                </button>
                <button
                    onClick={onNext}
                    className="flex-1 py-4 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white font-bold rounded-xl shadow-lg transition-all uppercase tracking-widest"
                >
                    Continue
                </button>
            </div>
        </div>
    );
};

// Simplified HEX approximation for skin tones
const getSkinHex = (color: number) => {
    switch (color) {
        case 1: return '#F9E4D4';
        case 2: return '#E8B490';
        case 3: return '#C68B63';
        case 4: return '#865E42';
        case 5: return '#4F3423';
        default: return '#F9E4D4';
    }
};

const LayeredPreview: React.FC<{ visuals: CharacterVisualConfig }> = ({ visuals }) => {
    // We can't use PIXI easily here without a container, so we'll use <img> layers
    const paths = [
        `/src/assets/images/Character Asset Pack/Character skin colors/${visuals.gender} Skin${visuals.skinColor}.png`,
        `/src/assets/images/Character Asset Pack/${visuals.gender} Hand/${visuals.gender} Skin${visuals.skinColor}.png`,
        `/src/assets/images/Character Asset Pack/${visuals.gender} Clothing/${visuals.clothing}.png`,
        `/src/assets/images/Character Asset Pack/${visuals.gender} Hair/${visuals.gender} ${visuals.hairStyle}.png`,
    ];

    return (
        <div className="absolute inset-0 p-4 flex items-center justify-center">
            <div className="relative w-full h-full">
                {paths.map((path, i) => (
                    <img
                        key={i}
                        src={path}
                        alt=""
                        className="absolute inset-0 w-full h-full object-contain pixelated"
                        style={{ zIndex: Z_INDEX.BASE + i }}
                    />
                ))}
            </div>
        </div>
    );
};

export default VisualsSelection;
