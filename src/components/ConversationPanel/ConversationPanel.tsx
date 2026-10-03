/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/components/ConversationPanel/ConversationPanel.tsx
 * Floating panel for interactive conversations.
 *
 * Every line the player sends passes through the universal intent reader
 * (systems/intent). The reader decides whether the line is ordinary speech, a
 * skill attempt that must be rolled, an escape, or an attack. Only `talk` goes
 * straight to prose.
 *
 * Before this, intent was read ONLY in a hostile opening. Everywhere else, and
 * in every peaceful opening, free text produced prose and nothing else: no
 * check could be attempted, nothing could fail, and no fight could ever start.
 */
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { GameState } from '../../types';
import { AppAction } from '../../state/actionTypes';
import { useConversation } from '../../hooks/useConversation';
import { useDeEscalation } from '../../hooks/useDeEscalation';
import { assetUrl } from '../../config/env';
import { SKILLS_DATA } from '../../data/skills';
import { resolvePlayerIntent } from '../../systems/intent/resolvePlayerIntent';
import type {
    IntentScene,
    IntentSkillInfo,
    PlayerIntent,
    SkillIntent,
} from '../../systems/intent/types';
import { runIntentFlow } from '../../systems/intent/runIntentFlow';
import type { SceneParticipant } from '../../systems/intent/sceneRosterToThreat';
import { computeSkillModifier } from '../../systems/gameEntry/runDeEscalationCheck';
import { battlefieldSourceForState } from '../../systems/gameEntry/battlefieldSourceForState';
import {
    findPreRollBuffOffers,
    buildCheckBoostStatusEffect,
    type PreRollBuffOffer,
} from '../../systems/gameEntry/preRollBuffOffer';
import { spellService } from '../../services/SpellService';
import { handleCastSpell } from '../../hooks/actions/handleResourceActions';
import { generateId } from '../../utils/core/idGenerator';
import { SkillClarificationPane } from '../gameEntry/SkillClarificationPane';
import './ConversationPanel.css';

interface ConversationPanelProps {
    gameState: GameState;
    dispatch: React.Dispatch<AppAction>;
}

/** An attempt waiting on a player decision, with the words that produced it. */
interface PendingAttempt {
    intent: SkillIntent;
    /** The original player line, re-sent once the attempt resolves. */
    text: string;
}

export const ConversationPanel: React.FC<ConversationPanelProps> = ({ gameState, dispatch }) => {
    const { sendPlayerMessage, endConversation, isInteractionLocked } = useConversation(gameState, dispatch);

    const conversation = gameState.activeConversation;
    const isPlayerTurn = conversation?.isPlayerTurn ?? false;
    const [inputText, setInputText] = useState('');
    const [showMentionMenu, setShowMentionMenu] = useState(false);
    const [mentionFilter, setMentionFilter] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const threat = gameState.gameEntry?.situation?.threat;
    const pc = gameState.party[0];
    const { rollCheckDice } = useDeEscalation();
    const [intentError, setIntentError] = useState<string | null>(null);
    /** True while the reader judges the line. The input locks so one line cannot be sent twice. */
    const [isReadingIntent, setIsReadingIntent] = useState(false);
    const [pendingClarification, setPendingClarification] = useState<
        { candidateSkills: string[]; text: string } | null
    >(null);
    // §3.5 pre-roll buff offer: a skill intent pauses here when the party head
    // knows a castable check-boost spell that isn't already active.
    const [pendingBuffOffer, setPendingBuffOffer] = useState<
        { attempt: PendingAttempt; offers: PreRollBuffOffer[] } | null
    >(null);
    // After an accepted cast we wait for the applied effect to be visible on the
    // re-rendered character before rolling, so the check reads fresh state.
    const [awaitRollAfterCast, setAwaitRollAfterCast] = useState<
        { attempt: PendingAttempt; effectId: string } | null
    >(null);

    const skillInfos = useMemo<IntentSkillInfo[]>(
        () =>
            Object.values(SKILLS_DATA).map((s) => ({
                name: s.name,
                ability: s.ability,
                proficient: (pc?.skills ?? []).some(
                    (k) => k.name.toLowerCase() === s.name.toLowerCase(),
                ),
                modifier: pc ? computeSkillModifier(pc, s.ability, s.name) : 0,
            })),
        [pc],
    );

    /**
     * The non-companion people in the scene, with a role the roster mapper can
     * read. Companions are excluded: the party does not become the enemy when a
     * fight starts.
     */
    const sceneParticipants = useMemo<SceneParticipant[]>(() => {
        if (!conversation) return [];
        const situationNpcs = gameState.gameEntry?.situation?.npcs ?? [];
        return (conversation.npcParticipants ?? [])
            .filter((p) => !gameState.companions[p.id])
            .map((p) => ({
                name: p.name,
                // The opening situation states a role outright. Otherwise the
                // personality string is the only description available, and it
                // reads well enough for keyword matching.
                role: situationNpcs.find((n) => n.id === p.id)?.role ?? p.personality ?? '',
            }));
    }, [conversation, gameState.gameEntry?.situation?.npcs, gameState.companions]);

    /**
     * Where a fight started HERE would be fought. An authored threat carries its
     * own receipt; a scene that turns needs one stamped from live state, or the
     * battle opens on the "Battlefield source missing" boundary instead of the
     * ground the player is standing on (observed live).
     */
    const battlefieldSource = useMemo(
        () => battlefieldSourceForState(
            gameState,
            gameState.startTownName ?? gameState.currentLocationId ?? 'this place',
        ),
        [gameState],
    );

    const scene = useMemo<IntentScene>(
        () => ({
            tension: threat?.tension ?? gameState.gameEntry?.situation?.predicament ?? '',
            hostile: !!threat,
            participants: sceneParticipants.map((p) => p.name),
        }),
        [threat, gameState.gameEntry?.situation?.predicament, sceneParticipants],
    );

    /**
     * Resolve one attempt: roll it, report the number, and either continue the
     * conversation with the result attached or hand over to combat.
     *
     * `text` is the player's original line. It is sent AFTER the roll so the
     * transcript reads words → result → reply, and so the prose model answers
     * what actually happened.
     */
    const resolveAttempt = useCallback(
        async (intent: PlayerIntent, text: string) => {
            if (!pc) return;
            setIntentError(null);
            try {
                const result = await runIntentFlow({
                    intent,
                    character: pc,
                    dispatch,
                    rollCheckDice,
                    threat,
                    participants: sceneParticipants,
                    tension: scene.tension,
                    battlefieldSource,
                    // One battlefield source exists: the GroundWorld. A fight
                    // started from the 2D view mounts it rather than inventing
                    // a second source for 2D (Remy's call, 2026-08-16).
                    ensureGroundMounted: () =>
                        dispatch({ type: 'SET_WORLD_VIEW_MODE', payload: '3d' }),
                });

                if (result.outcome === 'combat') {
                    // The conversation is over; a prose reply would be wasted and
                    // would arrive on top of the battle map.
                    if (result.note) {
                        dispatch({
                            type: 'ADD_CONVERSATION_MESSAGE',
                            payload: {
                                id: generateId(),
                                speakerId: 'narrator',
                                text: result.note,
                                timestamp: Date.now(),
                            },
                        });
                    }
                    return;
                }

                await sendPlayerMessage(text, result.note);
            } catch (e) {
                setIntentError(
                    e instanceof Error ? e.message : 'Something went wrong resolving that — try again.',
                );
            }
        },
        [pc, dispatch, rollCheckDice, threat, sceneParticipants, scene.tension, battlefieldSource, sendPlayerMessage],
    );

    /**
     * A skill attempt first checks for a castable pre-roll buff. The offer is
     * optional enrichment: any failure while LOOKING for offers must not block
     * the check the player asked for, so this falls through to the plain roll.
     */
    const rollWithBuffOffer = useCallback(
        async (attempt: PendingAttempt) => {
            if (!pc) return;
            try {
                const ids = [...new Set([
                    ...(pc.spellbook?.cantrips ?? []),
                    ...(pc.spellbook?.preparedSpells ?? []),
                    ...(pc.spellbook?.knownSpells ?? []),
                ])];
                const spells = (await Promise.all(
                    ids.map((id) => spellService.getSpellDetails(id).catch(() => null)),
                )).filter((s): s is NonNullable<typeof s> => !!s);
                const offers = findPreRollBuffOffers({
                    character: pc,
                    skillName: attempt.intent.skill,
                    spells,
                });
                if (offers.length > 0) {
                    setPendingBuffOffer({ attempt, offers });
                    return;
                }
            } catch {
                // fall through to the roll
            }
            await resolveAttempt(attempt.intent, attempt.text);
        },
        [pc, resolveAttempt],
    );

    // Accepted offer: consume the slot through the real cast path, persist the
    // effect, log the cast, then roll once the updated character is visible.
    const handleCastBuff = useCallback(
        async (offer: PreRollBuffOffer) => {
            if (!pc || !pendingBuffOffer) return;
            const { attempt } = pendingBuffOffer;
            setPendingBuffOffer(null);
            try {
                const spell = await spellService.getSpellDetails(offer.spellId);
                if (!spell) throw new Error(`${offer.spellName} could not be loaded.`);
                await handleCastSpell(
                    dispatch,
                    { characterId: pc.id, spellLevel: offer.castAtLevel, spellId: offer.spellId },
                    gameState,
                    (text) => dispatch({
                        type: 'ADD_CONVERSATION_MESSAGE',
                        payload: { id: generateId(), speakerId: 'narrator', text, timestamp: Date.now() },
                    }),
                );
                const effect = buildCheckBoostStatusEffect({
                    spell,
                    skillName: attempt.intent.skill,
                    casterId: pc.id,
                });
                dispatch({ type: 'APPLY_CHARACTER_STATUS_EFFECT', payload: { characterId: pc.id, statusEffect: effect } });
                dispatch({
                    type: 'ADD_CONVERSATION_MESSAGE',
                    payload: {
                        id: generateId(),
                        speakerId: 'narrator',
                        text: `${pc.name} casts ${offer.spellName} — ${offer.kind === 'advantage' ? 'advantage' : `+${offer.bonusDice}`} on the coming ${attempt.intent.skill} attempt.`,
                        timestamp: Date.now(),
                    },
                });
                setAwaitRollAfterCast({ attempt, effectId: effect.id });
            } catch (e) {
                setIntentError(e instanceof Error ? e.message : `Casting ${offer.spellName} failed.`);
            }
        },
        [pc, pendingBuffOffer, dispatch, gameState],
    );

    // Roll only after the freshly-applied effect is readable on the character,
    // so getActiveCheckBoosts inside the flow sees the new buff.
    useEffect(() => {
        if (!awaitRollAfterCast || !pc) return;
        if (!(pc.statusEffects ?? []).some((e) => e.id === awaitRollAfterCast.effectId)) return;
        const { attempt } = awaitRollAfterCast;
        setAwaitRollAfterCast(null);
        void resolveAttempt(attempt.intent, attempt.text);
    }, [awaitRollAfterCast, pc, resolveAttempt]);

    // Get participant names for @mention autocomplete
    const participantOptions = useMemo(() => {
        if (!conversation) return [];
        const npcParticipants = conversation.npcParticipants ?? [];
        return conversation.participants.map(id => {
            const companion = gameState.companions[id];
            if (companion) return { id, name: companion.identity.name };
            const situational = npcParticipants.find(p => p.id === id);
            return situational ? { id, name: situational.name } : { id, name: id };
        });
    }, [conversation, gameState.companions]);

    // Filtered participants for autocomplete
    const filteredParticipants = useMemo(() => {
        if (!mentionFilter) return participantOptions;
        const filter = mentionFilter.toLowerCase();
        return participantOptions.filter(p => p.name.toLowerCase().includes(filter));
    }, [participantOptions, mentionFilter]);

    // Scroll to bottom when new messages arrive
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [conversation?.messages]);

    // Handle input change - detect @mention
    const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setInputText(value);

        // Check for @ trigger
        const cursorPos = e.target.selectionStart || 0;
        const textBeforeCursor = value.slice(0, cursorPos);
        const atMatch = textBeforeCursor.match(/@(\w*)$/);

        if (atMatch) {
            setShowMentionMenu(true);
            setMentionFilter(atMatch[1]);
        } else {
            setShowMentionMenu(false);
            setMentionFilter('');
        }
    }, []);

    // Insert mention into input
    const insertMention = useCallback((name: string) => {
        const cursorPos = inputRef.current?.selectionStart || inputText.length;
        const textBeforeCursor = inputText.slice(0, cursorPos);
        const atIndex = textBeforeCursor.lastIndexOf('@');

        if (atIndex >= 0) {
            const newText = inputText.slice(0, atIndex) + '@' + name + ' ' + inputText.slice(cursorPos);
            setInputText(newText);
        }

        setShowMentionMenu(false);
        setMentionFilter('');
        inputRef.current?.focus();
    }, [inputText]);

    /**
     * Shared submit path: free-text Send and suggested-reply chips both land
     * here, so a chip click behaves exactly like typing the line and sending.
     *
     * The reader runs on EVERY line. Without a player character there is nothing
     * to roll against, so those conversations stay pure prose.
     */
    const submitPlayerText = useCallback(async (raw: string) => {
        const text = raw.trim();
        if (!text || isInteractionLocked || isReadingIntent || !conversation || !isPlayerTurn) return;

        setInputText('');
        setShowMentionMenu(false);
        setIntentError(null);

        if (!pc) {
            await sendPlayerMessage(text);
            return;
        }

        setIsReadingIntent(true);
        try {
            const intent = await resolvePlayerIntent(text, scene, skillInfos);

            if (intent.kind === 'talk') {
                await sendPlayerMessage(text);
                return;
            }
            if (intent.kind === 'ambiguous') {
                setPendingClarification({ candidateSkills: intent.candidateSkills, text });
                return;
            }
            if (intent.kind === 'attack') {
                await resolveAttempt(intent, text);
                return;
            }
            await rollWithBuffOffer({ intent, text });
        } catch (e) {
            setIntentError(
                e instanceof Error ? e.message : 'Could not read your intent — try rephrasing.',
            );
        } finally {
            setIsReadingIntent(false);
        }
    }, [
        isInteractionLocked, isReadingIntent, conversation, isPlayerTurn, pc, scene, skillInfos,
        sendPlayerMessage, resolveAttempt, rollWithBuffOffer,
    ]);

    // Handle send
    const handleSend = useCallback(async () => {
        await submitPlayerText(inputText);
    }, [inputText, submitPlayerText]);

    // Handle key press
    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        } else if (e.key === 'Escape') {
            setShowMentionMenu(false);
        }
    }, [handleSend]);

    // Handle end conversation
    const handleEndConversation = useCallback(async () => {
        await endConversation();
    }, [endConversation]);

    if (!conversation) return null;

    const inputLocked = isInteractionLocked || isReadingIntent || !isPlayerTurn;

    return (
        <div className="conversation-panel">
            <div className="conversation-header">
                <span className="conversation-title">
                    Conversation with {participantOptions.map(p => p.name).join(', ')}
                </span>
                <button
                    className="conversation-close-btn"
                    onClick={handleEndConversation}
                    disabled={isInteractionLocked}
                    title="End Conversation"
                    aria-label="End conversation"
                >
                    ✕
                </button>
            </div>

            {threat && (
                <div
                    data-testid="hostile-banner"
                    className="border border-red-500/50 bg-red-900/20 text-red-200 text-xs rounded px-3 py-1 mb-2"
                >
                    The situation is tense.
                </div>
            )}

            <div className="conversation-messages">
                {conversation.kind === 'situation' && gameState.gameEntry?.sceneImage
                    && gameState.gameEntry.sceneImage.status !== 'idle' && (() => {
                    const scene = gameState.gameEntry.sceneImage;
                    return (
                        <div className="conversation-scene" aria-busy={scene.status === 'generating'}>
                            {scene.status === 'ready' && scene.url && (
                                <img
                                    className="conversation-scene-img"
                                    src={assetUrl(scene.url)}
                                    alt="Establishing illustration of the opening scene"
                                />
                            )}
                            {scene.status === 'generating' && (
                                <div className="conversation-scene-note">Painting the scene…</div>
                            )}
                            {scene.status === 'error' && (
                                <div className="conversation-scene-note">Scene illustration unavailable.</div>
                            )}
                        </div>
                    );
                })()}

                {conversation.messages.map(msg => {
                    const isPlayer = msg.speakerId === 'player';
                    const speakerName = isPlayer
                        ? 'You'
                        : gameState.companions[msg.speakerId]?.identity.name
                            || (conversation.npcParticipants ?? []).find(p => p.id === msg.speakerId)?.name
                            || (msg.speakerId === 'narrator' ? '' : msg.speakerId);

                    return (
                        <div
                            key={msg.id}
                            className={`conversation-message ${isPlayer ? 'player' : 'companion'}`}
                        >
                            {speakerName && <span className="message-speaker">{speakerName}:</span>}
                            <span className="message-text">{msg.text}</span>
                        </div>
                    );
                })}

                {isReadingIntent && (
                    <div data-testid="reading-intent" className="conversation-message companion pending">
                        <span className="message-text">Reading your intent…</span>
                    </div>
                )}

                {isInteractionLocked && (
                    <div className="conversation-message companion pending">
                        <span className="message-text">...</span>
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* Suggested replies live OUTSIDE the input row: the input container
                is a flex ROW, so as a child this block collapsed into a narrow
                side column and pushed the Attack button off-screen (verified
                live). As a sibling it wraps naturally at full panel width. */}
            {(gameState.gameEntry?.situation?.suggestedReplies ?? []).length > 0 && (
                <div className="flex flex-wrap gap-1 px-4 pt-2">
                    {(gameState.gameEntry?.situation?.suggestedReplies ?? []).map((reply, i) => (
                        <button
                            key={`${i}-${reply}`}
                            type="button"
                            data-testid="reply-chip"
                            onClick={() => void submitPlayerText(reply)}
                            disabled={inputLocked}
                            // Suggested replies are real submissions, not tags; keep
                            // them full-height so they remain reliable in the
                            // opening scene overlay.
                            className="inline-flex min-h-11 items-center rounded-lg border border-gray-600 bg-gray-800 px-3 py-2 text-left text-xs text-gray-200 hover:bg-gray-700 disabled:opacity-50"
                        >
                            {reply}
                        </button>
                    ))}
                </div>
            )}

            {/* §3.5 pre-roll buff offer: pause between intent and roll while the
                player decides whether to cast a boosting spell first. */}
            {pendingBuffOffer && (
                <div data-testid="buff-offer" className="px-4 pt-2">
                    <div className="text-xs text-amber-300 mb-1">
                        Steady yourself before the {pendingBuffOffer.attempt.intent.skill} attempt?
                    </div>
                    <div className="flex flex-col gap-1">
                        {pendingBuffOffer.offers.map((offer) => (
                            <button
                                key={offer.spellId}
                                type="button"
                                data-testid={`buff-cast-${offer.spellId}`}
                                onClick={() => void handleCastBuff(offer)}
                                className="min-h-11 w-full rounded border border-amber-500/40 bg-amber-900/20 px-3 py-2 text-left text-xs text-amber-100 hover:bg-amber-900/40"
                            >
                                Cast {offer.spellName} — {offer.kind === 'advantage' ? 'advantage' : `+${offer.bonusDice}`} ({offer.costLabel})
                            </button>
                        ))}
                        <button
                            type="button"
                            data-testid="buff-skip"
                            onClick={() => {
                                const { attempt } = pendingBuffOffer;
                                setPendingBuffOffer(null);
                                void resolveAttempt(attempt.intent, attempt.text);
                            }}
                            className="min-h-11 w-full rounded border border-gray-600 bg-gray-800 px-3 py-2 text-left text-xs text-gray-300 hover:bg-gray-700"
                        >
                            Just roll
                        </button>
                    </div>
                </div>
            )}

            <div className="conversation-input-container">
                {showMentionMenu && filteredParticipants.length > 0 && (
                    <div className="mention-autocomplete">
                        {filteredParticipants.map(p => (
                            <button
                                key={p.id}
                                className="mention-option"
                                onClick={() => insertMention(p.name)}
                            >
                                @{p.name}
                            </button>
                        ))}
                    </div>
                )}

                <input
                    ref={inputRef}
                    type="text"
                    className="conversation-input"
                    placeholder={`Type a message... (use @ to address)`}
                    value={inputText}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                    disabled={inputLocked}
                    autoFocus
                />

                <button
                    className="conversation-send-btn"
                    onClick={handleSend}
                    disabled={inputLocked || !inputText.trim()}
                >
                    Send
                </button>
            </div>

            {intentError && (
                <div data-testid="intent-error" className="text-red-400 text-xs px-4 pb-2">
                    {intentError}
                </div>
            )}

            {threat && pc && (
                <div className="px-4 pb-3">
                    <button
                        type="button"
                        data-testid="opening-attack"
                        onClick={() => void resolveAttempt({ kind: 'attack' }, '')}
                        className="min-h-11 w-full rounded bg-red-800 px-3 py-2 text-sm font-semibold text-red-100 hover:bg-red-700"
                    >
                        ⚔ Attack
                    </button>
                </div>
            )}

            {pendingClarification && pc && (
                <SkillClarificationPane
                    candidates={skillInfos.filter((s) => pendingClarification.candidateSkills.includes(s.name))}
                    onPick={(s) => {
                        const { text } = pendingClarification;
                        setPendingClarification(null);
                        void rollWithBuffOffer({
                            intent: {
                                kind: 'skill',
                                skill: s.name,
                                ability: s.ability,
                                // The player resolved the ambiguity themselves, so the
                                // scene's own difficulty applies: the authored DC in a
                                // standoff, the middle band anywhere else.
                                dc: threat?.deEscalationDC ?? 13,
                                stakes: 'moderate',
                                rationale: '',
                            },
                            text,
                        });
                    }}
                    onCancel={() => setPendingClarification(null)}
                />
            )}
        </div>
    );
};

export default ConversationPanel;
