/**
 * Migration script: Convert glossary entry files from Markdown (+ YAML frontmatter) to JSON.
 *
 * - Input:  public/data/glossary/entries/**\/*.md
 * - Output: public/data/glossary/entries/**\/*.json
 * - Deletes the original .md files after successful conversion.
 *
 * Notes:
 * - Spell entries are ignored; spells are manifest-driven in the glossary now.
 */
export {};
