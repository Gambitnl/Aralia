
import { describe, it, expect } from 'vitest';
import { createEmptyMemory, addInteraction, decayMemories, getRelevantMemories, learnFact } from '../memoryUtils';
import { MemoryImportance, Interaction, Fact } from '../../../types/memory';

describe('memoryUtils', () => {
    it('creates an empty memory', () => {
        const memory = createEmptyMemory();
        expect(memory.interactions).toEqual([]);
        expect(memory.knownFacts).toEqual([]);
        expect(memory.attitude).toBe(0);
    });

    it('adds an interaction and updates attitude', () => {
        let memory = createEmptyMemory();
        const interaction: Omit<Interaction, 'id'> = {
            date: 100,
            type: 'dialogue',
            summary: 'Talked nicely',
            attitudeChange: 5,
            significance: MemoryImportance.Standard
        };

        memory = addInteraction(memory, interaction);

        expect(memory.interactions).toHaveLength(1);
        expect(memory.interactions[0].summary).toBe('Talked nicely');
        expect(memory.attitude).toBe(5);
        expect(memory.interactions[0].id).toBeDefined();
    });

    it('decays memories based on significance', () => {
        let memory = createEmptyMemory();
        const now = 1000000000;
        const DAY = 24 * 60 * 60 * 1000;

        const recentTrivial: Omit<Interaction, 'id'> = { date: now, type: 'dialogue', summary: 'Hi', attitudeChange: 0, significance: MemoryImportance.Trivial };
        const oldTrivial: Omit<Interaction, 'id'> = { date: now - 2 * DAY, type: 'dialogue', summary: 'Old Hi', attitudeChange: 0, significance: MemoryImportance.Trivial };
        const oldMajor: Omit<Interaction, 'id'> = { date: now - 60 * DAY, type: 'dialogue', summary: 'Major Event', attitudeChange: 10, significance: MemoryImportance.Major };

        memory = addInteraction(memory, recentTrivial);
        memory = addInteraction(memory, oldTrivial);
        memory = addInteraction(memory, oldMajor);

        expect(memory.interactions).toHaveLength(3);

        memory = decayMemories(memory, now);

        expect(memory.interactions).toHaveLength(2);
        expect(memory.interactions.find(i => i.summary === 'Old Hi')).toBeUndefined();
        expect(memory.interactions.find(i => i.summary === 'Hi')).toBeDefined();
        expect(memory.interactions.find(i => i.summary === 'Major Event')).toBeDefined();
    });

    it('retrieves relevant memories', () => {
        let memory = createEmptyMemory();
        memory = addInteraction(memory, { date: 1, type: 'theft', summary: 'Stole a pie', attitudeChange: -5, significance: MemoryImportance.Minor });
        memory = addInteraction(memory, { date: 2, type: 'combat', summary: 'Fought a dragon', attitudeChange: 20, significance: MemoryImportance.Major });

        const relevant = getRelevantMemories(memory, ['dragon']);
        expect(relevant[0].summary).toBe('Fought a dragon');

        const all = getRelevantMemories(memory, [], 1);
        expect(all[0].summary).toBe('Fought a dragon'); // Highest significance first
    });

    it('learns facts and updates confidence', () => {
        let memory = createEmptyMemory();
        const fact: Fact = {
            id: 'fact1',
            dateLearned: 100,
            confidence: 0.5,
            significance: MemoryImportance.Standard,
            source: 'gossip'
        };

        memory = learnFact(memory, fact);
        expect(memory.knownFacts[0].confidence).toBe(0.5);

        const betterFact: Fact = {
            ...fact,
            confidence: 0.9,
            source: 'witnessed'
        };

        memory = learnFact(memory, betterFact);
        expect(memory.knownFacts).toHaveLength(1);
        expect(memory.knownFacts[0].confidence).toBe(0.9);
        expect(memory.knownFacts[0].source).toBe('witnessed');
    });
});
