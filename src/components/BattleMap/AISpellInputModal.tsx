import React, { useState } from 'react';
import { Spell } from '../../types/spells';

interface AISpellInputModalProps {
    spell: Spell;
    onSubmit: (input: string) => void;
    onCancel: () => void;
    isOpen: boolean; // Managed by parent but good to have prop
}

const AISpellInputModal: React.FC<AISpellInputModalProps> = ({ spell, onSubmit, onCancel, isOpen }) => {
    const [input, setInput] = useState('');

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
            <div className="bg-gray-800 border-2 border-amber-500 rounded-lg p-6 max-w-lg w-full shadow-2xl">
                <h2 className="text-2xl font-cinzel text-amber-500 mb-4">Cast {spell.name}</h2>

                <p className="text-gray-300 mb-4 italic">
                    {spell.aiContext?.inputPrompt || "Describe the specific effect or command for this spell:"}
                </p>

                <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={spell.id === 'suggestion' ? 'e.g., "Drop your weapons and flee!"' : 'Describe the desired effect...'}
                    className="w-full bg-gray-900 border border-gray-700 rounded p-3 text-white mb-6 min-h-[100px] focus:border-amber-500 focus:outline-none"
                    autoFocus
                />

                <div className="flex justify-end gap-3">
                    <button
                        onClick={onCancel}
                        className="px-4 py-2 rounded bg-gray-700 hover:bg-gray-600 text-gray-200 font-bold transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={() => onSubmit(input)}
                        disabled={!input.trim()}
                        className="px-4 py-2 rounded bg-amber-600 hover:bg-amber-500 text-white font-bold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        Confirmed Cast
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AISpellInputModal;
