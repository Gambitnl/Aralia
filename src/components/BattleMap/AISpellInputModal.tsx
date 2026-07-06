// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 12/06/2026, 23:13:57
 * Dependents: components/Combat/CombatView.tsx
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import React, { useEffect, useRef, useState } from 'react';
import { Spell, UtilityEffect } from '../../types/spells';
import { detectSuspiciousInput } from '../../utils/securityUtils';
import { WindowFrame } from '../ui/WindowFrame';
import { WINDOW_KEYS } from '../../styles/uiIds';

/**
 * This modal collects the missing player decision before a spell command runs.
 *
 * It originally served AI-DM spells that need free-form text, and it now also
 * handles structured mode-choice spells such as Blindness/Deafness. CombatView
 * opens this modal through `useAbilitySystem.onRequestInput`; the submitted
 * value is passed back into SpellCommandFactory as `playerInput`.
 */

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
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const modeChoice = spell.modeChoice;
    const perTargetChoice = spell.targeting.perTargetChoice;
    const perTargetChoicePromptTargetName = (spell as Spell & { perTargetChoicePromptTargetName?: string }).perTargetChoicePromptTargetName;
    const controlChoiceOptions = spell.effects.flatMap(effect => {
        // Command-style spells keep their selectable words on the utility
        // effect payload instead of `modeChoice`. Rendering them here lets
        // the same modal handle Command without inventing a second prompt UI.
        if (effect.type !== 'UTILITY') {
            return [];
        }

        return ((effect as UtilityEffect).controlOptions ?? []).map(option => ({
            label: option.name,
            summary: option.details || `Command the target to ${option.effect}.`
        }));
    });
    const choiceOptions = modeChoice?.options.map(option => ({
        label: option.label,
        summary: option.summary || 'Choose this spell mode.'
    })) ?? perTargetChoice?.options.map(option => ({
        label: option,
        summary: perTargetChoice.notes || 'Choose this option for the target.'
    })) ?? controlChoiceOptions;
    const isStructuredChoice = choiceOptions.length > 0;

    useEffect(() => {
        if (isOpen && !isStructuredChoice) {
            inputRef.current?.focus();
        }
    }, [isOpen, isStructuredChoice]);

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
        <WindowFrame
            title={`Cast ${spell.name}`}
            onClose={onCancel}
            storageKey={WINDOW_KEYS.AI_SPELL_INPUT}
            initialMaximized={false}
        >
            <div className="flex flex-col h-full overflow-y-auto scrollable-content p-6">
                <p className="text-gray-300 mb-4 italic">
                    {perTargetChoicePromptTargetName
                        ? `Choose the option for ${perTargetChoicePromptTargetName}. ${perTargetChoice?.notes || ''}`
                        : modeChoice?.notes || perTargetChoice?.notes || spell.aiContext?.prompt || "Describe the specific effect or command for this spell:"}
                </p>

                {isStructuredChoice ? (
                    <div className="space-y-3 mb-6">
                        {choiceOptions.map(option => (
                            <button
                                key={option.label}
                                onClick={() => onSubmit(option.label)}
                                className="w-full text-left bg-gray-900 border border-amber-700/60 hover:border-amber-400 hover:bg-gray-700 rounded p-3 text-gray-100 transition-colors"
                            >
                                <span className="block font-bold text-amber-300">{option.label}</span>
                                <span className="block text-sm text-gray-300 mt-1">{option.summary}</span>
                            </button>
                        ))}
                    </div>
                ) : (
                    <div className="relative mb-6">
                        <textarea
                            ref={inputRef}
                            value={input}
                            onChange={handleChange}
                            maxLength={MAX_INPUT_LENGTH}
                            placeholder={spell.id === 'suggestion' ? 'e.g., "Drop your weapons and flee!"' : 'Describe the desired effect...'}
                            className={`w-full bg-gray-900 border ${error ? 'border-red-500' : 'border-gray-700'} rounded p-3 text-white min-h-[100px] focus:border-amber-500 focus:outline-none`}
                        />
                        <div className="absolute bottom-2 right-2 text-xs text-gray-500">
                            {input.length}/{MAX_INPUT_LENGTH}
                        </div>
                    </div>
                )}

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
                    {!isStructuredChoice && (
                        <button
                            onClick={handleSubmit}
                            disabled={!input.trim() || !!error}
                            className="px-4 py-2 rounded bg-amber-600 hover:bg-amber-500 text-white font-bold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            Confirmed Cast
                        </button>
                    )}
                </div>
            </div>
        </WindowFrame>
    );
};

export default AISpellInputModal;
