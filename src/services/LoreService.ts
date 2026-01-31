/**
 * @file src/services/LoreService.ts
 * Service for dynamic term lookup and lore extraction from the glossary.
 */
import { GlossaryEntry } from '../types';

export class LoreService {
  /**
   * Matches a text string against the glossary to find known terms.
   * Returns a list of unique glossary entries found in the text.
   */
  static findTermsInText(text: string, glossary: GlossaryEntry[]): GlossaryEntry[] {
    if (!glossary || glossary.length === 0) return [];

    const foundEntries: GlossaryEntry[] = [];
    const lowerText = text.toLowerCase();

    for (const entry of glossary) {
      // Check title and aliases
      const termsToMatch = [entry.title.toLowerCase(), ...(entry.aliases?.map(a => a.toLowerCase()) || [])];
      
      const isMatch = termsToMatch.some(term => {
        // Use word boundary regex for precise matching
        const regex = new RegExp(`\b${this.escapeRegExp(term)}\b`, 'i');
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
   */
  static getTermsRegex(terms: string[]): RegExp {
    if (terms.length === 0) return /$^/; // Matches nothing
    const escapedTerms = terms.map(t => this.escapeRegExp(t));
    return new RegExp(`\b(${escapedTerms.join('|')})\b`, 'gi');
  }

  private static escapeRegExp(string: string): string {
    return string.replace(/[.*+?^${}()|[\\]/g, '\\$&');
  }
}
