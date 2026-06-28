/**
 * @file src/services/LoreService.ts
 * Service for dynamic term lookup and lore extraction from the glossary.
 */
import { GlossaryEntry } from '../types';

export class LoreService {
  /**
   * Minimum length for a glossary term to be eligible for linkification.
   * Single-/two-character terms ("a", "an") are almost always noise in body
   * text and never read as meaningful glossary links.
   */
  private static readonly MIN_TERM_LENGTH = 3;

  /**
   * Common English stop-words and ubiquitous single words that must never be
   * turned into glossary links — even if a glossary entry happens to be titled
   * (or aliased) with one of them. Over-eager linkification of these ("a",
   * "Action", "Insight") litters body text with spurious clickable links and
   * makes prose look broken. Bias is intentionally conservative: better to
   * under-link than to junk-link common words.
   *
   * Lower-cased; matching is case-insensitive.
   */
  private static readonly STOP_WORDS: ReadonlySet<string> = new Set([
    // Articles / indefinite + definite
    'a', 'an', 'the',
    // Conjunctions
    'and', 'or', 'but', 'nor', 'so', 'yet', 'for',
    // Common prepositions
    'in', 'on', 'at', 'to', 'of', 'by', 'up', 'as', 'is', 'it', 'be',
    'into', 'onto', 'over', 'with', 'from', 'off', 'out', 'per',
    // Pronouns / determiners
    'you', 'your', 'his', 'her', 'its', 'our', 'their', 'this', 'that',
    'these', 'those', 'they', 'them', 'he', 'she', 'we', 'i', 'me', 'my',
    // Ubiquitous filler verbs / words that double as glossary terms but read
    // as plain prose far more often than as a rules reference.
    'are', 'was', 'were', 'has', 'had', 'have', 'do', 'does', 'did',
    'action', 'insight', 'move', 'turn', 'round', 'time', 'day', 'rest',
    'attack', 'check', 'save', 'roll', 'hit', 'use', 'cast',
  ]);

  /**
   * Whether a glossary term is eligible to be rendered as an inline link.
   * Conservative guard for G15 / X4: skips empty, too-short, and stop-word
   * terms so common words and the indefinite article "a" never become links.
   * Multi-word terms (e.g. "Magic Initiate") are always allowed — they read as
   * proper rules/lore references, not stop-words.
   */
  static isLinkableTerm(term: string): boolean {
    const trimmed = term.trim();
    if (trimmed.length === 0) return false;
    // Multi-word terms are inherently specific — always linkable.
    if (/\s/.test(trimmed)) return true;
    if (trimmed.length < this.MIN_TERM_LENGTH) return false;
    if (this.STOP_WORDS.has(trimmed.toLowerCase())) return false;
    return true;
  }

  /**
   * Matches a text string against the glossary to find known terms.
   * Returns a list of unique glossary entries found in the text.
   */
  static findTermsInText(text: string, glossary: GlossaryEntry[]): GlossaryEntry[] {
    if (!glossary || glossary.length === 0) return [];

    const foundEntries: GlossaryEntry[] = [];
    const lowerText = text.toLowerCase();

    for (const entry of glossary) {
      // Check title and aliases, filtering out stop-words / too-short terms so
      // common words never linkify (G15). If every term for an entry is a
      // stop-word, the entry is skipped entirely.
      const termsToMatch = [entry.title.toLowerCase(), ...(entry.aliases?.map(a => a.toLowerCase()) || [])]
        .filter(term => this.isLinkableTerm(term));

      const isMatch = termsToMatch.some(term => {
        // Use escaped word-boundary tokens for precise matching. A single "\b"
        // inside a string is a backspace character, not a regex word boundary.
        const regex = new RegExp(`\\b${this.escapeRegExp(term)}\\b`, 'i');
        return regex.test(lowerText);
      });

      if (isMatch) {
        foundEntries.push(entry);
      }
    }

    return foundEntries;
  }

  /**
   * Generates a regex pattern that matches any of the given terms as whole words.
   * Stop-words / too-short terms are filtered out so the split-and-linkify pass
   * in the caller can never wrap a common word in a glossary link (G15).
   */
  static getTermsRegex(terms: string[]): RegExp {
    const linkable = terms.filter(t => this.isLinkableTerm(t));
    if (linkable.length === 0) return /$^/; // Matches nothing
    const escapedTerms = linkable.map(t => this.escapeRegExp(t));
    return new RegExp(`\\b(${escapedTerms.join('|')})\\b`, 'gi');
  }

  private static escapeRegExp(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
