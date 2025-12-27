
import { describe, it, expect } from 'vitest';
import { createSkillChallenge, attemptSkillChallenge } from '../skillChallengeSystem';
import { PlayerCharacter } from '../../../types/character';
import { createMockPlayerCharacter } from '../../../utils/factories';

/**
 * Helper to create a test character with specific ability scores.
 */
function createTestCharacter(name: string, str: number, dex: number, int: number): PlayerCharacter {
  const base = createMockPlayerCharacter();

  // Set Ability Scores
  base.abilityScores = {
    ...base.abilityScores,
    Strength: str,
    Dexterity: dex,
    Intelligence: int,
    Wisdom: 10,
    Charisma: 10,
    Constitution: 10
  };

  base.name = name;
  return base;
}

describe('SkillChallengeSystem', () => {
  it('should initialize a challenge correctly', () => {
    const challenge = createSkillChallenge(
      'chase_01',
      'Rooftop Chase',
      'Catch the thief before he escapes',
      3, // Successes
      3, // Failures
      10, // Base DC
      [{ skillName: 'Athletics', description: 'Jump gaps' }],
      'Caught him!',
      'He escaped.'
    );

    expect(challenge.status).toBe('active');
    expect(challenge.currentSuccesses).toBe(0);
    expect(challenge.availableSkills[0].uses).toBe(0);
  });

  it('should track successes', () => {
    const challenge = createSkillChallenge(
      'test_success', 'Test', 'Desc', 2, 3, 5, // Low DC
      [{ skillName: 'Athletics', description: 'Run' }],
      'Win', 'Lose'
    );

    // 18 Strength -> +4 Modifier
    // Roll (1..20) + 4 => Range 5..24.
    // DC 5. Always success.
    const char = createTestCharacter('Hero', 18, 10, 10);

    const result = attemptSkillChallenge(challenge, char, 'Athletics');

    expect(result.success).toBe(true);
    expect(challenge.currentSuccesses).toBe(1);
    expect(challenge.status).toBe('active');
  });

  it('should track failures and end challenge', () => {
    const challenge = createSkillChallenge(
      'test_fail', 'Test', 'Desc', 5, 1, 30, // Impossible DC
      [{ skillName: 'Arcana', description: 'Think' }],
      'Win', 'Lose'
    );

    const char = createTestCharacter('Wizard', 10, 10, 10); // +0 mod

    const result = attemptSkillChallenge(challenge, char, 'Arcana');

    expect(result.success).toBe(false);
    expect(challenge.currentFailures).toBe(1);
    expect(result.challengeStatus).toBe('failure');
    expect(challenge.status).toBe('failure');
    expect(result.message).toContain('CHALLENGE FAILED');
  });

  it('should restrict usage limits', () => {
    const challenge = createSkillChallenge(
      'test_limit', 'Test', 'Desc', 5, 5, 5,
      [{ skillName: 'Athletics', description: 'Run', maxUses: 1 }],
      'Win', 'Lose'
    );
    const char = createTestCharacter('Hero', 18, 10, 10);

    // First use: OK
    attemptSkillChallenge(challenge, char, 'Athletics');
    expect(challenge.availableSkills[0].uses).toBe(1);

    // Second use: Blocked
    const result = attemptSkillChallenge(challenge, char, 'Athletics');
    expect(result.success).toBe(false);
    expect(result.message).toContain('exhausted');
    // Counts shouldn't change on invalid attempt
    expect(challenge.currentSuccesses).toBe(1);
  });
});
