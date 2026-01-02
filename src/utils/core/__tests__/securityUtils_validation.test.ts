import { describe, it, expect } from 'vitest';
import { validateCharacterName } from '../securityUtils';

describe('validateCharacterName', () => {
  it('should accept valid names', () => {
    expect(validateCharacterName('Grog').valid).toBe(true);
    expect(validateCharacterName('Vex\'ahlia').valid).toBe(true);
    expect(validateCharacterName('Jean-Luc').valid).toBe(true);
    expect(validateCharacterName('The Great One').valid).toBe(true);
    expect(validateCharacterName('R2D2').valid).toBe(true);
  });

  it('should accept international characters', () => {
    expect(validateCharacterName('Björn').valid).toBe(true);
    expect(validateCharacterName('Zoë').valid).toBe(true);
    expect(validateCharacterName('Renée').valid).toBe(true);
    expect(validateCharacterName('Façade').valid).toBe(true);
    expect(validateCharacterName('Müller').valid).toBe(true);
  });

  it('should reject empty or whitespace-only names', () => {
    expect(validateCharacterName('').valid).toBe(false);
    expect(validateCharacterName('   ').valid).toBe(false);
    expect(validateCharacterName('   ').error).toBe("Name cannot be empty.");
  });

  it('should reject names that are too short', () => {
    expect(validateCharacterName('A').valid).toBe(false);
    expect(validateCharacterName('A').error).toBe("Name is too short (min 2 characters).");
  });

  it('should reject names that are too long', () => {
    const longName = 'A'.repeat(51);
    expect(validateCharacterName(longName).valid).toBe(false);
    expect(validateCharacterName(longName).error).toBe("Name is too long (max 50 characters).");
  });

  it('should reject invalid characters', () => {
    expect(validateCharacterName('<script>').valid).toBe(false);
    expect(validateCharacterName('Name!').valid).toBe(false); // Exclamation mark not allowed
    expect(validateCharacterName('Name@Home').valid).toBe(false);
    expect(validateCharacterName('Name_Underscore').valid).toBe(false); // Underscore currently not in whitelist
  });

  it('should trim names before validating', () => {
      // "  Bob  " -> "Bob" (length 3, valid)
      expect(validateCharacterName('  Bob  ').valid).toBe(true);
  });
});
