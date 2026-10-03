/**
 * @file LeverageSystem.intelLead.test.ts
 * agora-0437: the 'information' goal yields a real vulnerability drawn from the
 * kind of secret that cornered the target, not one fixed West Wing sentence.
 */
import { describe, it, expect } from 'vitest';
import { LeverageSystem, type LeverageAttempt } from '../LeverageSystem';
import type { Secret } from '../../../types/identity';

function secretWith(tags: Secret['tags'], overrides: Partial<Secret> = {}): Secret {
  return {
    id: 'sec_1',
    subjectId: 'faction_1',
    content: 'Something damaging.',
    verified: true,
    value: 9,
    knownBy: [],
    tags,
    ...overrides,
  };
}

// A powerless, friendly target: resistance is 30 - 5 * secret.value, so every
// secret value used below sits at or under 20. Seed 63886's first roll is 50,
// which clears all of them and is far above the backfire band.
const WEAK_TARGET = { id: 'faction_1', name: 'House Vale', power: 0, reputation: 100 };
const ATTEMPT: LeverageAttempt = { secretId: 'sec_1', targetId: 'faction_1', goal: 'information' };

function informationResult(secret: Secret, seed = 63886) {
  return new LeverageSystem(seed).applyLeverage(ATTEMPT, secret, WEAK_TARGET);
}

describe('LeverageSystem — information leads (agora-0437)', () => {
  it('no longer returns the West Wing placeholder', () => {
    const result = informationResult(secretWith(['criminal']));

    expect(result.outcome).toBe('success');
    expect(result.rewards?.intel).toBeDefined();
    expect(result.rewards?.intel).not.toContain('West Wing');
  });

  it('names the target in the lead', () => {
    const result = informationResult(secretWith(['financial']));

    expect(result.rewards?.intel).toContain('House Vale');
  });

  it('draws the lead from the pool matching the secret tag', () => {
    const criminal = informationResult(secretWith(['criminal']));
    const financial = informationResult(secretWith(['financial']));

    expect(criminal.rewards?.intel).not.toEqual(financial.rewards?.intel);
  });

  it('grades confidence by how damaging and how provable the secret is', () => {
    expect(informationResult(secretWith(['political'])).rewards?.intel)
      .toContain('Hard intelligence');
    expect(informationResult(secretWith(['political'], { value: 5, verified: false })).rewards?.intel)
      .toContain('A solid lead');
    expect(informationResult(secretWith(['political'], { value: 2, verified: false })).rewards?.intel)
      .toContain('A whisper');
  });

  it('surfaces the lead in the message, the only text the player sees', () => {
    const result = informationResult(secretWith(['supernatural']));

    expect(result.message).toContain(result.rewards!.intel!);
  });

  it('grants no intel for a tagless secret instead of inventing one', () => {
    const result = informationResult(secretWith([]));

    expect(result.outcome).toBe('success');
    expect(result.rewards?.intel).toBeUndefined();
    expect(result.message).toContain('nothing you can act on');
  });

  it('is deterministic for the same seed', () => {
    const a = informationResult(secretWith(['magical']), 63900);
    const b = informationResult(secretWith(['magical']), 63900);

    expect(a.rewards?.intel).toEqual(b.rewards?.intel);
  });
});
