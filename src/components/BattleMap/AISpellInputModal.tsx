import React, { useState } from 'react';
import { Spell } from '../../types/spells';
import { detectSuspiciousInput } from '../../utils/securityUtils';

interface AISpellInputModalProps {
    spell: Spell;
    onSubmit: (input: string) => void;
    onCancel: () => void;
    isOpen: boolean; // Managed by parent but good to have prop
}

const MAX_INPUT_LENGTH = 500;

const AISpellInputModal: React.FC<AISpellInputModalProps> = ({ spell, onSubmit, onCancel, isOpen }) => {
    const [input, setInput] = useState('');
    const [error, setError] = useState<string | null>(null);

    if (!isOpen) return null;

    const handleSubmit = () => {
        const trimmed = input.trim();

        if (trimmed.length === 0) {
            setError("Input cannot be empty.");
            return;
        }

        if (trimmed.length > MAX_INPUT_LENGTH) {
            setError(`Input exceeds ${MAX_INPUT_LENGTH} characters.`);
            return;
        }

        if (detectSuspiciousInput(trimmed)) {
            setError("Input contains restricted keywords or patterns.");
            return;
        }

        setError(null);
        // Pass raw (trimmed) input. Sanitization happens in the backend/arbitrator layer.
        onSubmit(trimmed);
    };

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const val = e.target.value;
        if (val.length <= MAX_INPUT_LENGTH) {
            setInput(val);
            if (error) setError(null);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
            <div className="bg-gray-800 border-2 border-amber-500 rounded-lg p-6 max-w-lg w-full shadow-2xl">
                <h2 className="text-2xl font-cinzel text-amber-500 mb-4">Cast {spell.name}</h2>

                <p className="text-gray-300 mb-4 italic">
                    {spell.aiContext?.inputPrompt || "Describe the specific effect or command for this spell:"}
                </p>

                <div className="relative mb-6">
                    <textarea
                        value={input}
                        onChange={handleChange}
                        maxLength={MAX_INPUT_LENGTH}
                        placeholder={spell.id === 'suggestion' ? 'e.g., "Drop your weapons and flee!"' : 'Describe the desired effect...'}
                        className={`w-full bg-gray-900 border ${error ? 'border-red-500' : 'border-gray-700'} rounded p-3 text-white min-h-[100px] focus:border-amber-500 focus:outline-none`}
                        autoFocus
                    />
                    <div className="absolute bottom-2 right-2 text-xs text-gray-500">
                        {input.length}/{MAX_INPUT_LENGTH}
                    </div>
                </div>

                {error && (
                    <p className="text-red-400 text-sm mb-4">
                        ⚠️ {error}
                    </p>
                )}

                <div className="flex justify-end gap-3">
                    <button
                        onClick={onCancel}
                        className="px-4 py-2 rounded bg-gray-700 hover:bg-gray-600 text-gray-200 font-bold transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={!input.trim() || !!error}
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
