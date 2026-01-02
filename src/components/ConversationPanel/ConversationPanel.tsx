/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/components/ConversationPanel/ConversationPanel.tsx
 * Floating panel for interactive companion conversations.
 */
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { GameState } from '../../types';
import { AppAction } from '../../state/actionTypes';
import { useConversation } from '../../hooks/useConversation';
import './ConversationPanel.css';

interface ConversationPanelProps {
    gameState: GameState;
    dispatch: React.Dispatch<AppAction>;
}

/**
 * Extracts @mention from text and returns the addressed companion ID.
 */
function extractMention(text: string, participantIds: string[], companions: GameState['companions']): string | null {
    const mentionMatch = text.match(/@(\w+)/i);
    if (!mentionMatch) return null;

    const mentionName = mentionMatch[1].toLowerCase();

    // Find matching participant
    for (const id of participantIds) {
        const companion = companions[id];
        if (companion && companion.identity.name.toLowerCase().includes(mentionName)) {
            return id;
        }
    }

    return null;
}

export const ConversationPanel: React.FC<ConversationPanelProps> = ({ gameState, dispatch }) => {
    const { sendPlayerMessage, endConversation, isPending } = useConversation(gameState, dispatch);

    const conversation = gameState.activeConversation;
    const [inputText, setInputText] = useState('');
    const [showMentionMenu, setShowMentionMenu] = useState(false);
    const [mentionFilter, setMentionFilter] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Get participant names for @mention autocomplete
    const participantOptions = useMemo(() => {
        if (!conversation) return [];
        return conversation.participants.map(id => {
            const companion = gameState.companions[id];
            return companion ? { id, name: companion.identity.name } : { id, name: id };
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
        // Find where the @ starts
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

    // Handle send
    const handleSend = useCallback(async () => {
        if (!inputText.trim() || isPending || !conversation) return;

        const text = inputText.trim();
        setInputText('');
        setShowMentionMenu(false);

        await sendPlayerMessage(text);
    }, [inputText, isPending, conversation, sendPlayerMessage]);

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

    return (
        <div className="conversation-panel">
            <div className="conversation-header">
                <span className="conversation-title">
                    Conversation with {participantOptions.map(p => p.name).join(', ')}
                </span>
                <button
                    className="conversation-close-btn"
                    onClick={handleEndConversation}
                    disabled={isPending}
                    title="End Conversation"
                >
                    ✕
                </button>
            </div>

            <div className="conversation-messages">
                {conversation.messages.map(msg => {
                    const isPlayer = msg.speakerId === 'player';
                    const speakerName = isPlayer
                        ? 'You'
                        : gameState.companions[msg.speakerId]?.identity.name || msg.speakerId;

                    return (
                        <div
                            key={msg.id}
                            className={`conversation-message ${isPlayer ? 'player' : 'companion'}`}
                        >
                            <span className="message-speaker">{speakerName}:</span>
                            <span className="message-text">{msg.text}</span>
                        </div>
                    );
                })}

                {isPending && (
                    <div className="conversation-message companion pending">
                        <span className="message-text">...</span>
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

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
                    disabled={isPending}
                    autoFocus
                />

                <button
                    className="conversation-send-btn"
                    onClick={handleSend}
                    disabled={isPending || !inputText.trim()}
                >
                    Send
                </button>
            </div>
        </div>
    );
};

export default ConversationPanel;
