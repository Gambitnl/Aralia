
import { describe, it, expect } from 'vitest';
import { generateNobleIntrigue } from '../NobleIntrigueManager';
import { createMockGameState, createMockFaction } from '../../../utils/factories';
import { SeededRandom } from '../../../utils/seededRandom';

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

    // Mock RNG to pick House A as initiator (0 index of keys) and then pick the alliance action
    const rng = new SeededRandom(12345);

    // We can't easily force specific paths with SeededRandom unless we know the implementation details or mock it.
    // However, since they have shared values ('honor'), an Alliance Proposal should be heavily weighted.

    // Let's run it multiple times to ensure we get a result and it's valid
    let result = generateNobleIntrigue(state, rng);
    let attempts = 0;

    while (result.logs.length === 0 && attempts < 10) {
       result = generateNobleIntrigue(state, rng);
       attempts++;
    }

    expect(result.logs.length).toBeGreaterThan(0);
    const logText = result.logs[0].text;
    expect(logText).toContain('Intrigue:');

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

    const rng = new SeededRandom(67890);
    let result = generateNobleIntrigue(state, rng);
    let attempts = 0;
    while (result.logs.length === 0 && attempts < 10) {
        result = generateNobleIntrigue(state, rng);
        attempts++;
    }

    expect(result.logs.length).toBeGreaterThan(0);

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
    // House A hates corruption (House B has it).
    // House A has 'ambition', so Scandal is possible alongside Insult.
    const rng = new SeededRandom(111);

    // We loop until we get a scandal
    let result = generateNobleIntrigue(state, rng);
    let attempts = 0;
    let foundScandal = false;

    while (attempts < 50) {
        result = generateNobleIntrigue(state, rng);
        if (result.logs.length > 0 && result.logs[0].text.includes('exposed a scandal')) {
            foundScandal = true;
            break;
        }
        attempts++;
    }

    expect(foundScandal).toBe(true);

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

    const rng = new SeededRandom(222);

    // We loop until we get a power play
    let result = generateNobleIntrigue(state, rng);
    let attempts = 0;
    let foundPowerPlay = false;

    while (attempts < 50) {
        result = generateNobleIntrigue(state, rng);
        if (result.logs.length > 0 && result.logs[0].text.includes('seize assets')) {
            foundPowerPlay = true;
            break;
        }
        attempts++;
    }

    expect(foundPowerPlay).toBe(true);

    // Verify consequences:
    // 1. Relationship worsens
    expect(result.state.factions.house_a.relationships.house_b).toBeLessThan(0);

    // 2. Initiator gains power, Target loses power
    expect(result.state.factions.house_a.power).toBeGreaterThan(80);
    expect(result.state.factions.house_b.power).toBeLessThan(40);
  });
});
