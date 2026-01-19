
/**
 * @file GameGuideModal.tsx
 * A modal containing a chatbot powered by Gemini-3-Pro.
 */
// TODO(lint-intent): 'useContext' is imported but unused; it hints at a helper/type the module was meant to use.
// TODO(lint-intent): If the planned feature is still relevant, wire it into the data flow or typing in this file.
// TODO(lint-intent): Otherwise drop the import to keep the module surface intentional.
import React, { useState, useRef, useEffect, useContext as _useContext } from 'react';
import { motion, AnimatePresence, MotionProps } from 'framer-motion';
import { generateGuideResponse } from '../../services/ollamaTextService';
import { generateCharacterFromConfig, CharacterGenerationConfig } from '../../services/characterGenerator';
import { PlayerCharacter, NPCMemory, GoalStatus } from '../../types';
import { AppAction } from '../../state/actionTypes';
import { RACES_DATA, AVAILABLE_CLASSES } from '../../constants';
import { t } from '../../utils/i18n';
import { cleanAIJSON, safeJSONParse } from '../../utils/securityUtils';

interface GameGuideModalProps {
    isOpen: boolean;
    onClose: () => void;
    gameContext: string;
    devModelOverride: string | null;
    onAction?: (action: AppAction) => void;
}

const creationToolsMotion: MotionProps = {
    initial: { height: 0, opacity: 0 },
    animate: { height: 'auto', opacity: 1 },
    exit: { height: 0, opacity: 0 },
};

const responseMotion: MotionProps = {
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
};

const generatedCharacterMotion: MotionProps = {
    initial: { opacity: 0, scale: 0.9 },
    animate: { opacity: 1, scale: 1 },
};

type GuideToolData = {
    tool?: string;
    config?: unknown;
};

const buildGuideMemory = (): NPCMemory => ({
    interactions: [],
    knownFacts: [],
    attitude: 0,
    lastInteractionDate: Date.now(),
    discussedTopics: {},
});

const GameGuideModal: React.FC<GameGuideModalProps> = ({ isOpen, onClose, gameContext, devModelOverride, onAction }) => {
    const [query, setQuery] = useState('');
    const [response, setResponse] = useState<string | null>(null);
    const [generatedCharacter, setGeneratedCharacter] = useState<PlayerCharacter | null>(null);
    const [loading, setLoading] = useState(false);

    const [showCreationTools, setShowCreationTools] = useState(false);
    const [quickRace, setQuickRace] = useState(Object.keys(RACES_DATA)[0]);
    const [quickClass, setQuickClass] = useState(AVAILABLE_CLASSES[0].id);

    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const handleEsc = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onClose();
        };
        if (isOpen) {
            window.addEventListener('keydown', handleEsc);
            inputRef.current?.focus();
        }
        return () => window.removeEventListener('keydown', handleEsc);
    }, [isOpen, onClose]);

    const performGuideQuery = async (userQuery: string) => {
        if (!userQuery.trim() || loading) return;

        setLoading(true);
        setResponse(null);
        setGeneratedCharacter(null);

        try {
            const playerPromptContext = `${gameContext}\nPlayer request: ${userQuery}`;
            const result = await generateGuideResponse(
                buildGuideMemory(),
                GoalStatus.Active,
                playerPromptContext
            );

            if (result.data?.text) {
                const responseText = result.data.text;

                // Use centralized cleanAIJSON to extract JSON content if present, or just clean it
                // The previous regex logic was: .match(/```json\n([\s\S]*?)\n```/)
                // cleanAIJSON handles finding and stripping the block.

                // Check if there is a JSON block first to decide if we should try parsing
                // Use case-insensitive matching for robustness
                const hasJsonBlock = /```json/i.test(responseText);

                if (hasJsonBlock) {
                    const cleanedJson = cleanAIJSON(responseText);
                    // Use safeJSONParse to avoid crashes
                    // TODO(lint-intent): The any on this value hides the intended shape of this data.
                    // TODO(lint-intent): Define a real interface/union (even partial) and push it through callers so behavior is explicit.
                    // TODO(lint-intent): If the shape is still unknown, document the source schema and tighten types incrementally.
                    const toolData = safeJSONParse<GuideToolData | null>(cleanedJson);

                    if (toolData && toolData.tool === 'create_character' && toolData.config) {
                        const character = generateCharacterFromConfig(toolData.config as CharacterGenerationConfig);
                        if (character) {
                            setGeneratedCharacter(character);
                            setResponse(t('game_guide.recruit_prompt', { name: character.name }));
                        } else {
                            setResponse(t('game_guide.error_invalid_config'));
                        }
                    } else {
                        // If parsing failed or data was invalid/not a tool call, show original text
                        // Note: if safeJSONParse returns null, toolData is null, we fall here
                        setResponse(responseText);
                    }
                } else {
                    setResponse(responseText);
                }
            } else {
                setResponse(t('game_guide.error_connection'));
            }
        // TODO(lint-intent): Capture and surface error details here if the guide needs richer diagnostics.
        // TODO(lint-intent): Consider logging the failure to telemetry when expanding the guide workflow.
        } catch {
            setResponse(t('game_guide.error_general'));
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        performGuideQuery(query);
    };

    const handleQuickGenerate = () => {
        const raceName = RACES_DATA[quickRace]?.name || "Human";
        const className = AVAILABLE_CLASSES.find(c => c.id === quickClass)?.name || "Fighter";
        const prompt = `Create a Level 1 ${raceName} ${className}.`;
        setQuery(prompt);
        performGuideQuery(prompt);
    };

    const handleAddCharacter = () => {
        if (generatedCharacter && onAction) {
            onAction({ type: 'ADD_GENERATED_CHARACTER', payload: generatedCharacter });
            onClose();
        }
    };

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[70] p-4"
            aria-modal="true"
            role="dialog"
            aria-labelledby="game-guide-title"
        >
            <div className="bg-gray-800 p-6 rounded-xl shadow-2xl border border-blue-500/50 w-full max-w-lg flex flex-col max-h-[90vh]">
                <div className="flex justify-between items-center mb-4">
                    <h2 id="game-guide-title" className="text-2xl font-bold text-blue-300 font-cinzel">
                        {t('game_guide.title')}
                    </h2>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-white text-3xl"
                        aria-label="Close guide"
                    >
                        &times;
                    </button>
                </div>

                <div className="mb-4 text-sm text-gray-300">
                    <p>{t('game_guide.intro')}</p>
                    <button
                        onClick={() => setShowCreationTools(!showCreationTools)}
                        className="text-sky-400 text-xs hover:underline mt-2 flex items-center gap-1"
                    >
                        {showCreationTools ? t('game_guide.toggle_tools_hide') : t('game_guide.toggle_tools_show')}
                    </button>
                </div>

                <AnimatePresence>
                    {showCreationTools && (
                        <motion.div
                            {...creationToolsMotion}
                            className="mb-4 overflow-hidden bg-gray-900/50 p-3 rounded-lg border border-gray-700"
                        >
                            <h3 className="text-xs font-bold text-gray-400 uppercase mb-2">{t('game_guide.quick_creator_title')}</h3>
                            <div className="grid grid-cols-2 gap-2 mb-3">
                                <div>
                                    <label className="block text-[10px] text-gray-500 mb-1">{t('game_guide.label_race')}</label>
                                    <select
                                        value={quickRace}
                                        onChange={(e) => setQuickRace(e.target.value)}
                                        className="w-full bg-gray-800 border border-gray-600 text-white text-xs rounded p-1 focus:ring-1 focus:ring-blue-500 outline-none"
                                    >
                                        {Object.values(RACES_DATA).sort((a, b) => a.name.localeCompare(b.name)).map(race => (
                                            <option key={race.id} value={race.id}>{race.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[10px] text-gray-500 mb-1">{t('game_guide.label_class')}</label>
                                    <select
                                        value={quickClass}
                                        onChange={(e) => setQuickClass(e.target.value)}
                                        className="w-full bg-gray-800 border border-gray-600 text-white text-xs rounded p-1 focus:ring-1 focus:ring-blue-500 outline-none"
                                    >
                                        {AVAILABLE_CLASSES.sort((a, b) => a.name.localeCompare(b.name)).map(cls => (
                                            <option key={cls.id} value={cls.id}>{cls.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <button
                                onClick={handleQuickGenerate}
                                disabled={loading}
                                className="w-full bg-purple-700 hover:bg-purple-600 text-white text-xs font-bold py-2 rounded shadow-sm transition-colors disabled:bg-gray-600"
                            >
                                {t('game_guide.button_generate')}
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>

                <form onSubmit={handleSubmit} className="mb-4">
                    <div className="flex gap-2">
                        <input
                            ref={inputRef}
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder={t('game_guide.placeholder_query')}
                            className="flex-grow px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                        <button
                            type="submit"
                            disabled={loading || !query.trim()}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 text-white font-semibold rounded-lg transition-colors"
                        >
                            {loading ? t('game_guide.button_thinking') : t('game_guide.button_ask')}
                        </button>
                    </div>
                </form>

                {loading && (
                    <div className="flex justify-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-400"></div>
                    </div>
                )}

                {response && (
                    <motion.div
                        {...responseMotion}
                        className="p-4 bg-gray-900/50 border border-gray-700 rounded-lg max-h-60 overflow-y-auto scrollable-content"
                    >
                        <p className="text-gray-200 whitespace-pre-wrap">{response}</p>
                    </motion.div>
                )}

                {generatedCharacter && (
                    <motion.div
                        {...generatedCharacterMotion}
                        className="mt-4 p-4 bg-gray-700 rounded-lg border border-gray-600"
                    >
                        <h3 className="text-lg font-bold text-amber-400 mb-2">{generatedCharacter.name}</h3>
                        <div className="text-sm text-gray-300 grid grid-cols-2 gap-2 mb-3">
                            <p>{t('game_guide.character_label_race')} <span className="text-white">{generatedCharacter.race.name}</span></p>
                            <p>{t('game_guide.character_label_class')} <span className="text-white">{generatedCharacter.class.name}</span></p>
                            <p>{t('game_guide.character_label_hp')} <span className="text-green-400">{generatedCharacter.maxHp}</span></p>
                            <p>{t('game_guide.character_label_ac')} <span className="text-blue-400">{generatedCharacter.armorClass}</span></p>
                        </div>
                        {onAction ? (
                            <button
                                onClick={handleAddCharacter}
                                className="w-full bg-green-600 hover:bg-green-500 text-white py-2 rounded font-bold shadow-md transition-colors"
                            >
                                {t('game_guide.button_add_party')}
                            </button>
                        ) : (
                            <p className="text-xs text-red-400 italic">{t('game_guide.error_handler_missing')}</p>
                        )}
                    </motion.div>
                )}
            </div>
        </div>
    );
};

export default GameGuideModal;
