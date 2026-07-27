/**
 * @file src/services/LoreService.ts
 * Service for dynamic term lookup and lore extraction from the glossary.
 */
import { GlossaryEntry } from '../types';
export declare class LoreService {
    /**
     * Minimum length for a glossary term to be eligible for linkification.
     * Single-/two-character terms ("a", "an") are almost always noise in body
     * text and never read as meaningful glossary links.
     */
    private static readonly MIN_TERM_LENGTH;
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
    private static readonly STOP_WORDS;
    /**
     * Whether a glossary term is eligible to be rendered as an inline link.
     * Conservative guard for G15 / X4: skips empty, too-short, and stop-word
     * terms so common words and the indefinite article "a" never become links.
     * Multi-word terms (e.g. "Magic Initiate") are always allowed — they read as
     * proper rules/lore references, not stop-words.
     */
    static isLinkableTerm(term: string): boolean;
    /**
     * Matches a text string against the glossary to find known terms.
     * Returns a list of unique glossary entries found in the text.
     */
    static findTermsInText(text: string, glossary: GlossaryEntry[]): GlossaryEntry[];
    /**
     * Generates a regex pattern that matches any of the given terms as whole words.
     * Stop-words / too-short terms are filtered out so the split-and-linkify pass
     * in the caller can never wrap a common word in a glossary link (G15).
     */
    static getTermsRegex(terms: string[]): RegExp;
    private static escapeRegExp;
}
