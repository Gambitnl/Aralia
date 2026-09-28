import { describe, it, expect } from 'vitest';
import {
  normalizeWhitespace,
  cleanPrompt,
  truncateText,
  toTitleCase,
  stripMarkdown,
  sanitizeDialogue,
  slugify,
} from '../core/textCleaners';

/**
 * This test suite verifies the text sanitization, prompt cleaning, and string formatting utilities.
 *
 * In an AI-assisted narrative RPG, text inputs and outputs need thorough sanitization:
 * stripping Markdown artifacts before audio synthesis, cleaning AI dialogue quotations,
 * normalizing prompt templates, and generating consistent URL/ID slugs.
 *
 * Covers: utils/core/textCleaners.ts
 * Tests: Whitespace normalization, prompt cleaning, word-boundary truncation,
 * title casing, Markdown stripping, dialogue quote cleaning, and slugification.
 */

// ============================================================================
// Whitespace and Prompt Normalization Tests
// ============================================================================
// Verifies prompt cleanup, control character stripping, and newline collapsing.
// ============================================================================

describe('Text Cleaners - Whitespace & Prompts', () => {
  describe('normalizeWhitespace', () => {
    it('should collapse multiple spaces and tabs into a single space', () => {
      expect(normalizeWhitespace('  hello    world \t test  ')).toBe('hello world test');
      expect(normalizeWhitespace('')).toBe('');
    });
  });

  describe('cleanPrompt', () => {
    it('should normalize CRLF line endings to LF and collapse excessive blank lines', () => {
      const rawPrompt = 'System Prompt\r\n\r\n\r\n\r\nUser Request:\r\n  Details here.  \r\n\r\n\r\nEnd.';
      const cleaned = cleanPrompt(rawPrompt);

      expect(cleaned).toBe('System Prompt\n\nUser Request:\n  Details here.\n\nEnd.');
    });

    it('should remove non-printable control characters', () => {
      const rawWithControlChars = 'Action\x00:\x07 Move \x1F North';
      expect(cleanPrompt(rawWithControlChars)).toBe('Action: Move  North');
    });

    it('should handle empty input gracefully', () => {
      expect(cleanPrompt('')).toBe('');
    });
  });
});

// ============================================================================
// Truncation and Casing Tests
// ============================================================================
// Verifies word-boundary truncation and standard English title casing.
// ============================================================================

describe('Text Cleaners - Truncation & Casing', () => {
  describe('truncateText', () => {
    it('should not truncate text that is shorter than maxLength', () => {
      expect(truncateText('Short text', 20)).toBe('Short text');
    });

    it('should truncate at word boundaries when possible and add ellipsis', () => {
      const text = 'The ancient dragon rests upon a mountain of gold coins';
      const truncated = truncateText(text, 25);

      // Should break at "rests" or "dragon", not cut inside a word
      expect(truncated.length).toBeLessThanOrEqual(25);
      expect(truncated.endsWith('...')).toBe(true);
      expect(truncated).toBe('The ancient dragon...');
    });

    it('should handle edge cases like very short maxLength or empty text', () => {
      expect(truncateText('', 10)).toBe('');
      expect(truncateText('Hello World', 3)).toBe('...');
    });
  });

  describe('toTitleCase', () => {
    it('should capitalize major words and keep minor words lowercase', () => {
      expect(toTitleCase('the lord of the rings')).toBe('The Lord of the Rings');
      expect(toTitleCase('SWORD OF THE MIGHTY DRAGON')).toBe('Sword of the Mighty Dragon');
      expect(toTitleCase('chronicles of narnia: the lion and the witch')).toBe(
        'Chronicles of Narnia: The Lion and the Witch'
      );
    });

    it('should always capitalize the first and last word', () => {
      expect(toTitleCase('in the end')).toBe('In the End');
    });
  });
});

// ============================================================================
// Markdown and Dialogue Sanitization Tests
// ============================================================================
// Verifies Markdown stripping and quotation mark cleaning.
// ============================================================================

describe('Text Cleaners - Markdown & Dialogue', () => {
  describe('stripMarkdown', () => {
    it('should strip bold, italics, headers, code fences, and links', () => {
      const markdown = '# Quest Briefing\n\n**Warning**: Travel to `Oakhaven` and find [The Lost Relic](https://example.com).\n\n```ts\nconst x = 1;\n```\n\n> Be careful!';
      const plain = stripMarkdown(markdown);

      expect(plain).not.toContain('#');
      expect(plain).not.toContain('**');
      expect(plain).not.toContain('`');
      expect(plain).not.toContain('```');
      expect(plain).not.toContain('https://example.com');
      expect(plain).toContain('Warning: Travel to Oakhaven and find The Lost Relic.');
      expect(plain).toContain('Be careful!');
    });

    it('should return empty string for empty input', () => {
      expect(stripMarkdown('')).toBe('');
    });
  });

  describe('sanitizeDialogue', () => {
    it('should strip outer standard double and single quotes', () => {
      expect(sanitizeDialogue('"Halt! Who goes there?"')).toBe('Halt! Who goes there?');
      expect(sanitizeDialogue("'I seek the guildmaster.'")).toBe('I seek the guildmaster.');
    });

    it('should strip typographic smart quotes', () => {
      expect(sanitizeDialogue('“A dark omen approaches.”')).toBe('A dark omen approaches.');
      expect(sanitizeDialogue('‘Take this potion.’')).toBe('Take this potion.');
      expect(sanitizeDialogue('«Bienvenue!»')).toBe('Bienvenue!');
    });

    it('should not alter text without outer quotes', () => {
      expect(sanitizeDialogue('No quotes here.')).toBe('No quotes here.');
    });
  });

  describe('slugify', () => {
    it('should convert strings to kebab-case slugs', () => {
      expect(slugify('Fireball: Tier 3 Spell!')).toBe('fireball-tier-3-spell');
      expect(slugify('  Ancient Red Dragon  ')).toBe('ancient-red-dragon');
      expect(slugify('Underdark_Caverns & Chasm')).toBe('underdark-caverns-chasm');
    });

    it('should return empty string for empty input', () => {
      expect(slugify('')).toBe('');
    });
  });
});
