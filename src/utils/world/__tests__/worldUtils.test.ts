import { describe, it, expect } from 'vitest';
import { isPlayerFocused, isNpcOccupied } from '../sceneUtils';
import { stripSystemFormatting } from '../dialogueUtils';
import { GamePhase } from '../../../types/core';

describe('sceneUtils', () => {
    describe('isPlayerFocused', () => {
        it('should return true if not in PLAYING phase', () => {
            expect(isPlayerFocused({ phase: GamePhase.LOAD_TRANSITION } as any)).toBe(true);
        });

        it('should return true if dialogue interface is open', () => {
            expect(isPlayerFocused({ phase: GamePhase.PLAYING, isDialogueInterfaceOpen: true } as any)).toBe(true);
        });

        it('should return true if active conversation exists', () => {
            expect(isPlayerFocused({ phase: GamePhase.PLAYING, activeConversation: {} } as any)).toBe(true);
        });

        it('should return true if active ritual exists', () => {
            expect(isPlayerFocused({ phase: GamePhase.PLAYING, activeRitual: {} } as any)).toBe(true);
        });

        it('should return false if idle in PLAYING phase', () => {
            expect(isPlayerFocused({
                phase: GamePhase.PLAYING,
                isDialogueInterfaceOpen: false,
                activeConversation: null,
                activeRitual: null
            } as any)).toBe(false);
        });
    });

    describe('isNpcOccupied', () => {
        it('should return true if NPC is in active conversation', () => {
            const state = { activeConversation: { participants: ['npc1', 'npc2'] } } as any;
            expect(isNpcOccupied(state, 'npc1')).toBe(true);
        });

        it('should return true if NPC is currently in dialogue focus', () => {
            const state = {
                lastInteractedNpcId: 'npc1',
                isDialogueInterfaceOpen: true
            } as any;
            expect(isNpcOccupied(state, 'npc1')).toBe(true);
        });

        it('should return false if NPC is idle', () => {
            const state = {
                activeConversation: null,
                lastInteractedNpcId: 'npc2',
                isDialogueInterfaceOpen: true
            } as any;
            expect(isNpcOccupied(state, 'npc1')).toBe(false);
        });
    });
});

describe('dialogueUtils', () => {
    describe('stripSystemFormatting', () => {
        it('should strip : " prefix and " suffix', () => {
            expect(stripSystemFormatting(': "Hello world"')).toBe('Hello world');
        });

        it('should strip :" prefix (no space)', () => {
            expect(stripSystemFormatting(':"Hello world"')).toBe('Hello world');
        });

        it('should not destroy internal quotes', () => {
            expect(stripSystemFormatting(': "She said, "Hello.""')).toBe('She said, "Hello."');
        });

        it('should handle strings without prefix', () => {
            expect(stripSystemFormatting('Normal text')).toBe('Normal text');
        });

        it('should handle empty or null strings', () => {
            expect(stripSystemFormatting('')).toBe('');
            expect(stripSystemFormatting(null as any)).toBe('');
        });
    });
});
