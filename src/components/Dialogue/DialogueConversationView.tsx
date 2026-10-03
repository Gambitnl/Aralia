// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 10/08/2026, 13:30:19
 * Dependents: components/DesignPreview/steps/PreviewDialogue.tsx, components/Dialogue/DialogueInterface.tsx
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * This file renders the shared body of Aralia's topic-based NPC conversation.
 *
 * The in-game DialogueInterface and the Design Preview both use this view so
 * the portrait, response, topic choices, invite action, and exit control stay
 * visually identical. DialogueInterface still owns game rules and AI calls;
 * this file only presents the state and forwards the player's choices.
 *
 * Called by: DialogueInterface.tsx and DesignPreview/steps/PreviewDialogue.tsx
 * Depends on: dialogue topic and outcome types, plus the project's icon set
 */
import React from 'react';
import { Handshake, UserRound } from 'lucide-react';
import type { ConversationTopic } from '../../types/dialogue';
import type { ProcessTopicResult } from '../../services/dialogueService';
import { BTN_BASE } from '../../styles/buttonStyles';

// ============================================================================
// Shared Conversation Contract
// ============================================================================
// Callers supply resolved dialogue state and callbacks. Keeping game decisions
// outside this view lets the production modal and deterministic preview share
// one presentation without giving the preview access to reducer side effects.
// ============================================================================
export interface DialogueConversationViewProps {
    npcDescription: string;
    currentResponse: string | null;
    isThinking: boolean;
    topicResult?: ProcessTopicResult | null;
    topics: ConversationTopic[];
    onTopicSelect: (topic: ConversationTopic) => void;
    onInvite?: () => void;
    onEndConversation: () => void;
}

// ============================================================================
// Topic Label Helpers
// ============================================================================
// Skill checks keep their compact game notation beside the topic label. The
// skill type is currently an object, but the defensive string branch preserves
// compatibility with older saved or generated topic data.
// ============================================================================
function getSkillCheckLabel(topic: ConversationTopic): string | null {
    if (!topic.skillCheck) return null;

    const skillName = typeof topic.skillCheck.skill === 'string'
        ? topic.skillCheck.skill
        : topic.skillCheck.skill.name;

    return `${skillName} (DC ${topic.skillCheck.dc})`;
}

// ============================================================================
// Shared In-Game Conversation Body
// ============================================================================
// Wide windows place NPC identity beside the response and topic list. Narrow
// windows collapse identity into a compact top band, preserving readable topic
// buttons and a permanently reachable End Conversation action.
// ============================================================================
export const DialogueConversationView: React.FC<DialogueConversationViewProps> = ({
    npcDescription,
    currentResponse,
    isThinking,
    topicResult,
    topics,
    onTopicSelect,
    onInvite,
    onEndConversation,
}) => (
    <div
        className="flex h-full min-h-0 flex-col overflow-hidden bg-gray-900 md:flex-row"
        data-testid="dialogue-conversation-view"
    >
        {/* NPC identity remains deliberately quiet so the spoken response and
            player choices retain the strongest hierarchy in the modal. */}
        <aside className="flex max-h-[24%] shrink-0 flex-row items-center gap-3 overflow-y-auto border-b border-gray-700 bg-gray-950/35 p-3 md:max-h-none md:w-1/3 md:flex-col md:justify-center md:gap-4 md:border-b-0 md:border-r md:p-6">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-2 border-amber-700/50 bg-gray-800 text-amber-300 shadow-inner md:h-32 md:w-32">
                <UserRound className="h-8 w-8 md:h-16 md:w-16" aria-hidden="true" />
            </div>
            <p className="min-w-0 text-left text-xs italic leading-relaxed text-gray-400 md:max-w-xs md:text-center md:text-sm">
                {npcDescription}
            </p>
        </aside>

        {/* The conversation lane reserves separate regions for the NPC reply,
            scrollable topics, and persistent exit action. */}
        <div className="flex min-h-0 flex-1 flex-col md:w-2/3">
            <section className="max-h-[34%] shrink-0 overflow-y-auto p-3 md:max-h-[40%] md:p-6" aria-live="polite">
                <div className="rounded-lg border border-amber-800/30 bg-gray-950/60 p-4 shadow-inner md:p-6">
                    <p className="text-base leading-relaxed text-gray-200 md:text-lg">
                        {isThinking ? (
                            <span className="animate-pulse text-gray-500">Thinking...</span>
                        ) : (
                            currentResponse
                        )}
                    </p>
                </div>

                {/* Mechanical feedback stays close to the reply it explains. */}
                {topicResult && topicResult.status !== 'neutral' && (
                    <div className={`mt-4 text-sm font-bold ${topicResult.status === 'success' ? 'text-green-400' : 'text-red-400'}`}>
                        [{topicResult.status.toUpperCase()}]
                        {topicResult.dispositionChange
                            ? ` Disposition ${topicResult.dispositionChange > 0 ? '+' : ''}${topicResult.dispositionChange}`
                            : ''}
                    </div>
                )}
            </section>

            {/* Topic choices take the remaining room and scroll independently,
                matching the behavior of the production dialogue modal. */}
            <section className="min-h-0 flex-1 overflow-y-auto border-t border-gray-700 bg-gray-950/45 p-3 md:p-4" aria-label="Conversation topics">
                <h3 className="mb-3 text-xs font-bold uppercase tracking-[0.16em] text-gray-500">Topics</h3>
                <div className="grid grid-cols-1 gap-2">
                    {topics.map((topic) => {
                        const skillCheckLabel = getSkillCheckLabel(topic);

                        return (
                            <button
                                key={topic.id}
                                type="button"
                                onClick={() => onTopicSelect(topic)}
                                disabled={isThinking}
                                className={`${BTN_BASE} group flex min-h-11 w-full items-center justify-between gap-3 border border-gray-700 bg-gray-800 px-3 py-2.5 text-left shadow-none hover:border-amber-700/60 hover:bg-gray-700 focus:ring-amber-500/70 disabled:cursor-wait md:px-4 md:py-3`}
                            >
                                <span className="font-medium text-gray-300 group-hover:text-amber-100">
                                    {topic.label}
                                </span>
                                {skillCheckLabel && (
                                    <span className="shrink-0 rounded border border-gray-700 bg-gray-950 px-2 py-1 text-xs text-gray-500">
                                        {skillCheckLabel}
                                    </span>
                                )}
                            </button>
                        );
                    })}

                    {/* Recruitment uses the same control rhythm as topics, but
                        amber emphasis distinguishes its lasting consequence. */}
                    {onInvite && (
                        <button
                            type="button"
                            data-testid="dialogue-invite-to-party"
                            onClick={onInvite}
                            disabled={isThinking}
                            className={`${BTN_BASE} group flex min-h-11 w-full items-center justify-between gap-3 border border-amber-800/40 bg-amber-950/10 px-3 py-2.5 text-left shadow-none hover:border-amber-600/60 hover:bg-amber-900/20 focus:ring-amber-500/70 disabled:cursor-wait md:px-4 md:py-3`}
                        >
                            <span className="font-medium text-amber-200 group-hover:text-amber-100">Invite to party</span>
                            <Handshake className="h-5 w-5 text-amber-400" aria-hidden="true" />
                        </button>
                    )}
                </div>
            </section>

            {/* The exit remains outside every scrolling region so resizing or a
                long topic list can never trap the player in dialogue. */}
            <footer className="shrink-0 border-t border-gray-700 bg-gray-950/75 p-3">
                <button
                    type="button"
                    data-testid="dialogue-end-conversation"
                    onClick={onEndConversation}
                    className={`${BTN_BASE} min-h-11 w-full border border-transparent px-3 py-2.5 text-left text-gray-400 shadow-none hover:border-red-900/40 hover:bg-red-900/20 hover:text-red-300 focus:ring-red-500/60`}
                >
                    End Conversation
                </button>
            </footer>
        </div>
    </div>
);

export default DialogueConversationView;
