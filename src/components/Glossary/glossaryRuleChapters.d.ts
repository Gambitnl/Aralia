/**
 * This file adds a chapter-oriented navigation layer above the existing rules corpus.
 *
 * Why it exists:
 * The owner wants the rules side of the glossary to feel more like a browsable handbook
 * chapter than a flat dictionary bucket. The actual rule entries should stay intact, but
 * the sidebar needs a curated parent -> child -> subchild structure for "Rules Glossary"
 * and "Spellcasting Mechanics" so related concepts unfold together.
 *
 * What it preserves:
 * - individual glossary entry files remain the real rule content
 * - search still works against the real leaf entries
 * - existing non-rule categories keep their current structure
 *
 * What remains intentionally best-effort:
 * - not every rule has a perfect thematic home yet
 * - unmatched rules are preserved in a fallback chapter instead of being dropped
 */
import { GlossaryEntry } from '../../types';
export declare function buildGlossaryDisplayIndex(glossaryEntries: GlossaryEntry[] | null): GlossaryEntry[];
/**
 * Find the first actual leaf entry that can display content.
 *
 * Why it exists:
 * Chapter wrappers intentionally do not have file content of their own. The
 * glossary therefore needs a way to skip those wrappers when it chooses a
 * default selection on first open or after a search.
 */
export declare function findFirstSelectableGlossaryEntry(entries: GlossaryEntry[]): GlossaryEntry | null;
