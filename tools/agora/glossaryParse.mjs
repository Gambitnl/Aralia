// tools/agora/glossaryParse.mjs
// The GLOSSARY.md parser, as one reusable function.
//
// Extracted verbatim from glossary-to-json.mjs so the daemon's GET /glossary and
// any CLI caller derive the SAME term list: same entry scan, same date match,
// same path extraction, same tag keywords. Change the rules here and every
// consumer changes with them — there is no second copy.
//
// Pure: takes markdown text, returns entries. No fs, no paths, no I/O.

import fs from 'node:fs';

// Tag rules, in the order they are tested. Keyword hits are OR'd; an entry that
// matches nothing at all gets 'general'.
const TAG_RULES = [
  ['water', /\b(water|river|sea|pool|lake|stream|flow|doorstep|reach|sky bucket|notebook|window)\b/],
  ['ground', /\b(ground|terrain|voxel|rock|soil|plate|height|far shells?|clump|shell)\b/],
  ['combat', /\b(combat|battle|fight|spell|damage|scars|chronicle|parity|forge|battlefield|arena)\b/],
  ['towns', /\b(town|burg|street|street|building|household|lot|blueprint|overlay|dwelling|household)\b/],
  ['vegetation', /\b(forest|tree|plant|clump|vegetation|thicket|seedling|den|scrub)\b/],
  ['maps', /\b(map|atlas|region|grid|cell|patch|window|topology|node|edge|topic|feature|tile)\b/],
  ['fleet', /\b(agent|fleet|agora|board|wave|packet|task|coordinator|orchestrat|callsign|lane|pact|wake|adapter|activation)\b/],
];

// The tag vocabulary the glossary page filters by, in display order.
export const GLOSSARY_TAGS = [...TAG_RULES.map(([tag]) => tag), 'general'];

/**
 * Parse GLOSSARY.md markdown into glossary entries.
 *
 * An entry is a line starting `**Term** — definition`, whose definition may run
 * across following lines until a blank line before the next entry, the next
 * entry itself, or a `##` heading.
 *
 * @param {string} content raw GLOSSARY.md text
 * @returns {Array<{term:string,definition:string,dateAdded:string|null,paths:string[],tags:string[]}>}
 */
export function parseGlossary(content) {
  const entries = [];
  const lines = content.split('\n');
  let i = 0;

  while (i < lines.length) {
    const line = lines[i].trim();

    // Look for bold term at line start
    if (line.startsWith('**') && line.includes('**') && line.includes('—')) {
      // Extract the term and definition from this line
      const boldMatch = line.match(/^\*\*([^*]+)\*\*\s*—\s*(.*)/);
      if (boldMatch) {
        const term = boldMatch[1].trim();
        let definition = boldMatch[2];

        // Continue reading definition lines until blank line or next entry
        i++;
        while (i < lines.length) {
          const nextLine = lines[i];
          // Stop if we hit another entry or blank line followed by a section
          if (nextLine.trim() === '') {
            // Check if next non-empty line is a new entry
            let j = i + 1;
            while (j < lines.length && lines[j].trim() === '') j++;
            if (j < lines.length) {
              const maybeNextEntry = lines[j].trim();
              if (maybeNextEntry.startsWith('**') && maybeNextEntry.includes('**') && maybeNextEntry.includes('—')) {
                i = j - 1; // Will be incremented at end of loop
                break;
              } else if (maybeNextEntry.startsWith('##')) {
                i = j - 1;
                break;
              }
            }
            i++;
            continue;
          }
          if (nextLine.trim().startsWith('**') && nextLine.includes('—')) {
            break;
          }
          if (nextLine.trim().startsWith('##')) {
            break;
          }
          // Append to definition
          if (definition && !definition.endsWith(' ')) definition += ' ';
          definition += nextLine.trim();
          i++;
        }

        // Parse date (YYYY-MM-DD) from definition
        const dateMatch = definition.match(/\((\d{4})-(\d{2})-(\d{2})\)/);
        const dateAdded = dateMatch ? `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}` : null;

        // Extract file paths (src/... or tools/...)
        const pathMatches = definition.match(/(?:src|tools)\/[^\s)]+/g) || [];
        const paths = [...new Set(pathMatches)]; // Deduplicate

        // Derive tags from keywords
        const tags = new Set();
        const text = (term + ' ' + definition).toLowerCase();
        for (const [tag, pattern] of TAG_RULES) {
          if (pattern.test(text)) tags.add(tag);
        }

        // If no tags, add general
        if (tags.size === 0) tags.add('general');

        entries.push({
          term,
          definition: definition.trim(),
          dateAdded,
          paths,
          tags: Array.from(tags).sort(),
        });
      }
      i++;
    } else {
      i++;
    }
  }

  return entries;
}

/**
 * Read GLOSSARY.md from disk and parse it. Throws if the file is unreadable —
 * the caller decides what an unreadable glossary means (the daemon answers 500).
 *
 * @param {string} file absolute path to GLOSSARY.md
 */
export function parseGlossaryFile(file) {
  return parseGlossary(fs.readFileSync(file, 'utf-8'));
}
