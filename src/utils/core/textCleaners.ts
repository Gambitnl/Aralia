/**
 * This file provides text sanitization, prompt cleaning, and string manipulation helpers.
 *
 * In an AI-assisted narrative RPG, text received from LLMs, procedural generation,
 * or player input often contains erratic whitespace, Markdown markup, excess quotes,
 * or formatting inconsistencies. This module ensures text is clean, safe, and readable
 * before rendering in the dialogue pane or passing to downstream systems.
 *
 * Called by: AI prompt builders, dialogue system, chronicle logger, glossary search.
 * Depends on: Pure JavaScript regular expressions and string primitives.
 */

// ============================================================================
// Whitespace and Prompt Normalization
// ============================================================================
// Cleans up multi-line prompts, redundant spaces, and irregular line endings.
// ============================================================================

/**
 * Normalizes all whitespace in a string by collapsing multiple consecutive spaces
 * into a single space and trimming leading/trailing whitespace.
 *
 * @param text - The raw input text.
 * @returns Cleaned string with single spaces.
 */
export function normalizeWhitespace(text: string): string {
  if (!text) return '';
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * Cleans a prompt string destined for an AI model or logging service.
 * Normalizes line endings (CRLF -> LF), removes non-printable control characters,
 * collapses 3+ consecutive newlines into 2, and trims whitespace.
 *
 * @param prompt - The raw prompt text.
 * @returns Clean, sanitized prompt string.
 */
export function cleanPrompt(prompt: string): string {
  if (!prompt) return '';

  return prompt
    // Normalize Windows carriage returns
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    // Remove control characters except standard tab and newline
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    // Collapse 3 or more consecutive newlines into at most two
    .replace(/\n{3,}/g, '\n\n')
    // Trim trailing spaces on each individual line
    .split('\n')
    .map(line => line.trimEnd())
    .join('\n')
    .trim();
}

// ============================================================================
// Truncation and Casing Helpers
// ============================================================================
// Handles clean word-boundary truncation and standard title capitalization.
// ============================================================================

/**
 * Truncates text to a maximum length, preferring to break at the nearest word boundary
 * rather than cutting words in half, and attaches an ellipsis.
 *
 * @param text - The full text string.
 * @param maxLength - Maximum permitted character length (including ellipsis).
 * @param ellipsis - String to append when truncated (default: '...').
 * @returns Truncated text string.
 */
export function truncateText(text: string, maxLength: number, ellipsis: string = '...'): string {
  if (!text || maxLength <= 0) return '';
  if (text.length <= maxLength) return text;

  const targetLen = Math.max(0, maxLength - ellipsis.length);
  if (targetLen === 0) return ellipsis.slice(0, maxLength);

  // Substring to target length
  const sub = text.slice(0, targetLen);
  const lastSpace = sub.lastIndexOf(' ');

  // If there is a space near the end (not all the way at the start), break on word boundary
  if (lastSpace > targetLen * 0.5) {
    return `${sub.slice(0, lastSpace)}${ellipsis}`;
  }

  return `${sub}${ellipsis}`;
}

// Minor English words that remain lowercase in titles unless they are the first or last word
const MINOR_WORDS = new Set([
  'a', 'an', 'the', 'and', 'but', 'or', 'for', 'nor', 'on', 'at', 'to', 'from', 'by', 'of', 'in', 'with', 'as', 'into'
]);

/**
 * Converts a string to Title Case, capitalizing major words while keeping minor
 * articles and prepositions in lowercase (unless they start the title).
 *
 * @example
 * toTitleCase("the lord of the rings") // "The Lord of the Rings"
 * toTitleCase("SWORD OF THE MIGHTY") // "Sword of the Mighty"
 *
 * @param text - The raw title or name string.
 * @returns Formatted Title Case string.
 */
export function toTitleCase(text: string): string {
  if (!text) return '';

  const words = text.toLowerCase().split(/\s+/);
  return words
    .map((word, index) => {
      if (word.length === 0) return '';

      // Always capitalize the first word and last word, or words following a colon/dash
      const isFirst = index === 0;
      const isLast = index === words.length - 1;
      const followsPunctuation = index > 0 && /[:\-–—]$/.test(words[index - 1]);

      if (isFirst || isLast || followsPunctuation || !MINOR_WORDS.has(word)) {
        return word.charAt(0).toUpperCase() + word.slice(1);
      }
      return word;
    })
    .join(' ');
}

// ============================================================================
// Markdown and Dialogue Sanitization
// ============================================================================
// Removes Markdown tags from AI output and cleans dialogue quotation marks.
// ============================================================================

/**
 * Strips common Markdown formatting (bold, italics, headers, code fences, links)
 * to produce clean plain-text suitable for audio speech synthesis or compact logs.
 *
 * @param markdown - Text containing Markdown notation.
 * @returns Plain text representation.
 */
export function stripMarkdown(markdown: string): string {
  if (!markdown) return '';

  return markdown
    // Remove code blocks
    .replace(/```[\s\S]*?```/g, '')
    // Remove inline code
    .replace(/`([^`]+)`/g, '$1')
    // Remove image tags ![alt](url) -> alt
    .replace(/!\[(.*?)\]\(.*?\)/g, '$1')
    // Remove markdown links [text](url) -> text
    .replace(/\[(.*?)\]\(.*?\)/g, '$1')
    // Remove bold and italic (***text***, **text**, *text*, ___text___, __text__, _text_)
    .replace(/(\*{1,3}|_{1,3})(.*?)\1/g, '$2')
    // Remove strikethrough ~~text~~
    .replace(/~~(.*?)~~/g, '$1')
    // Remove markdown headers (# Header)
    .replace(/^#{1,6}\s+/gm, '')
    // Remove blockquotes (> Quote)
    .replace(/^>\s+/gm, '')
    // Remove horizontal rules
    .replace(/^[-*_]{3,}\s*$/gm, '')
    .trim();
}

/**
 * Strips matching outer quote characters (standard and typographic smart quotes)
 * from dialogue strings generated by conversational LLMs.
 *
 * @example
 * sanitizeDialogue('"Hold your ground!"') // returns "Hold your ground!"
 * sanitizeDialogue('“A curse upon you!”') // returns "A curse upon you!"
 *
 * @param dialogue - The spoken dialogue string.
 * @returns Dialogue with outer enclosing quotation marks stripped.
 */
export function sanitizeDialogue(dialogue: string): string {
  if (!dialogue) return '';

  let cleaned = dialogue.trim();

  // Quote pairs to check
  const quotePairs: Array<[string, string]> = [
    ['"', '"'],
    ["'", "'"],
    ['“', '”'],
    ['‘', '’'],
    ['«', '»'],
  ];

  for (const [start, end] of quotePairs) {
    if (cleaned.startsWith(start) && cleaned.endsWith(end) && cleaned.length >= 2) {
      cleaned = cleaned.slice(start.length, cleaned.length - end.length).trim();
      break;
    }
  }

  return cleaned;
}

/**
 * Converts any string into a URL and database-safe kebab-case slug.
 *
 * @example
 * slugify("Fireball Spell: Tier 3!") // returns "fireball-spell-tier-3"
 *
 * @param text - The string to slugify.
 * @returns Kebab-case slug.
 */
export function slugify(text: string): string {
  if (!text) return '';

  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove non-word chars
    .replace(/[\s_-]+/g, '-') // Replace spaces and underscores with single hyphen
    .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
}
