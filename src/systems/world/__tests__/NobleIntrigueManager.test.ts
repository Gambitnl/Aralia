
import { describe, it, expect } from 'vitest';
import { generateNobleIntrigue } from '../NobleIntrigueManager';
import { createMockGameState, createMockFaction } from '../../../utils/factories';
import { SeededRandom } from '../../../utils/seededRandom';

// Mock SeededRandom to control outcomes
// We need to extend or mock the class used in the SUT.
// Since we import the class directly, we can use vi.spyOn regarding the instance methods if we had access to the instance,
// but inside generateNobleIntrigue, it uses the passed instance. So we can pass a mock.

const createMockRng = (values: number[]) => {
    let index = 0;
    return {
        next: () => {
            const val = index < values.length ? values[index] : 0.5;
            index++;
            return val;
        },
        // TODO(lint-intent): Replace any with the minimal test shape so the behavior stays explicit.
        pick: (arr: unknown[]) => arr[0], // Simplified pick
        // TODO(lint-intent): 'max' is unused in this test; use it in the assertion path or remove it.
        nextInt: (min: number, _max: number) => min
    } as unknown as SeededRandom;
};

describe('NobleIntrigueManager', () => {
  it('should generate an alliance proposal between compatible factions', () => {
    const houseA = createMockFaction({
      id: 'house_a',
      type: 'NOBLE_HOUSE',
      name: 'House A',
      values: ['honor', 'duty'],
      hates: ['treachery']
    });

    const houseB = createMockFaction({
      id: 'house_b',
      type: 'NOBLE_HOUSE',
      name: 'House B',
      values: ['honor', 'justice'],
      hates: ['cowardice']
    });

    const state = createMockGameState({
      factions: {
        house_a: houseA,
        house_b: houseB
      }
    });

    // Mock RNG
    // 1. Pick Initiator (keys sorted typically? or just array order). We'll assume first is picked via our mock pick.
    // 2. Roll for action selection. We want low value to pick first available action (ALLIANCE)
    const rng = createMockRng([0.1]);
    // We override pick in the mock to just return house_a (if it's the first key)
    // Actually, generateNobleIntrigue calls rng.pick(factionIds).
    // Let's force pick to return house_a
    // TODO(lint-intent): 'arr' is unused in this test; use it in the assertion path or remove it.
    rng.pick = <T>(_arr: T[]): T => {
        // Assume arr of strings for factionIds
        return 'house_a' as unknown as T;
    };

    const result = generateNobleIntrigue(state, rng);

    expect(result.logs.length).toBeGreaterThan(0);
    const logText = result.logs[0].text;
    expect(logText).toContain('Intrigue:');
    expect(logText).toContain('publicly praised'); // Alliance text

    // Check if relationships improved
    const newRelationA = result.state.factions.house_a.relationships.house_b;
    expect(newRelationA).toBeGreaterThan(0);
  });

  it('should generate a diplomatic insult between conflicting factions', () => {
    const houseA = createMockFaction({
      id: 'house_a',
      type: 'NOBLE_HOUSE',
      name: 'House A',
      values: ['honor'],
      hates: ['treachery']
    });

    const houseB = createMockFaction({
      id: 'house_b',
      type: 'NOBLE_HOUSE',
      name: 'House B',
      values: ['treachery'], // House A hates this
      hates: ['honor']
    });

    const state = createMockGameState({
      factions: {
        house_a: houseA,
        house_b: houseB
      }
    });

    const rng = createMockRng([0.1]);
    // TODO(lint-intent): 'arr' is unused in this test; use it in the assertion path or remove it.
    rng.pick = <T>(_arr: T[]): T => 'house_a' as unknown as T;

    const result = generateNobleIntrigue(state, rng);

    expect(result.logs.length).toBeGreaterThan(0);
    expect(result.logs[0].text).toContain('publicly denounced'); // Insult text

    // Check relations worsened
    const newRelationA = result.state.factions.house_a.relationships.house_b;
    expect(newRelationA).toBeLessThan(0);
  });

  it('should not generate intrigue if only one noble house exists', () => {
    const houseA = createMockFaction({
      id: 'house_a',
      type: 'NOBLE_HOUSE'
    });

    const guild = createMockFaction({
        id: 'guild_a',
        type: 'GUILD'
    });

    const state = createMockGameState({
      factions: {
        house_a: houseA,
        guild_a: guild
      }
    });

    const rng = new SeededRandom(1);
    const result = generateNobleIntrigue(state, rng);

    expect(result.logs).toHaveLength(0);
    expect(result.state).toBe(state);
  });

  it('should generate a scandal exposure for ambitious factions against enemies', () => {
    const houseA = createMockFaction({
      id: 'house_a',
      type: 'NOBLE_HOUSE',
      name: 'House A',
      values: ['ambition', 'knowledge'], // Traits for scandal
      hates: ['corruption'],
      relationships: {}
    });

    const houseB = createMockFaction({
      id: 'house_b',
      type: 'NOBLE_HOUSE',
      name: 'House B',
      values: ['corruption'],
      power: 50,
      relationships: {}
    });

    const state = createMockGameState({
      factions: {
        house_a: houseA,
        house_b: houseB
      }
    });

    // Mock RNG:
    // We need to trigger the SCANDAL_EXPOSURE path.
    // In this setup, we have Insult (due to hate) and Scandal (due to hate + ambition).
    // We want to pick Scandal.
    // The code weights them. Insult: 20 + 30 = 50. Scandal: 15.
    // To pick Scandal (which is likely 2nd in list or at least present), we need the RNG to land in its range.
    // Since we don't know exact order, we can just ensure we mock enough next calls or force pick.
    // However, easier: Since we removed the loop, we must rely on a targeted roll.
    // Or we can just ensure ONLY Scandal is possible by removing the Hate trigger?
    // No, Hate is required for Scandal in current logic ("hatedValues.length > 0").

    // So we have both. We need to rig the roll.
    // Total weight approx 65. Scandal is 15.
    // Let's assume Insult is first. We need a roll > 50.
    // Let's try passing 0.9 to `next()` used for selection.

    const rng = createMockRng([0.9, 0.5, 0.5]);
    // TODO(lint-intent): 'arr' is unused in this test; use it in the assertion path or remove it.
    rng.pick = <T>(_arr: T[]): T => 'house_a' as unknown as T;

    const result = generateNobleIntrigue(state, rng);

    // If we picked Insult, this test fails. But let's see.
    // If it fails, we adjust the mock value.
    if (!result.logs[0].text.includes('exposed a scandal')) {
         // Try a different value if order was swapped or logic differs
         // Actually, let's just assert one OR the other if we can't control order perfectly without inspecting implementation details.
         // But better to be deterministic.
         // The implementation pushes Insult then Scandal.
         // So Insult (0-50), Scandal (50-65).
         // 0.9 * 65 = 58.5. Should pick Scandal.
    }

    expect(result.logs[0].text).toContain('exposed a scandal');

    // Verify consequences:
    // 1. Relationship worsens (-25)
    expect(result.state.factions.house_a.relationships.house_b).toBeLessThan(-20);

    // 2. Target loses power
    expect(result.state.factions.house_b.power).toBeLessThan(50);
  });

  it('should generate a power play when strong rival bullies weak rival', () => {
    const houseA = createMockFaction({
      id: 'house_a',
      type: 'NOBLE_HOUSE',
      name: 'House A',
      power: 80,
      rivals: ['house_b'],
      values: ['power'],
      relationships: {}
    });

    const houseB = createMockFaction({
      id: 'house_b',
      type: 'NOBLE_HOUSE',
      name: 'House B',
      power: 40, // Much weaker
      rivals: ['house_a'],
      relationships: {}
    });

    const state = createMockGameState({
      factions: {
        house_a: houseA,
        house_b: houseB
      }
    });

    // Only Power Play should be available (no shared values, no hates defined)
    const rng = createMockRng([0.1]);
    // TODO(lint-intent): 'arr' is unused in this test; use it in the assertion path or remove it.
    rng.pick = <T>(_arr: T[]): T => 'house_a' as unknown as T;

    const result = generateNobleIntrigue(state, rng);

    expect(result.logs.length).toBeGreaterThan(0);
    expect(result.logs[0].text).toContain('seize assets'); // Power play text

    // Verify consequences:
    // 1. Relationship worsens
    expect(result.state.factions.house_a.relationships.house_b).toBeLessThan(0);

    // 2. Initiator gains power, Target loses power
    expect(result.state.factions.house_a.power).toBeGreaterThan(80);
    expect(result.state.factions.house_b.power).toBeLessThan(40);
  });
});
