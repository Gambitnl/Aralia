// scripts/jules/prompt-template.mjs
//
// Builds the per-batch Jules prompt for the spell-icon pipeline.
//
// One batch == one Jules session == ~10 spells. For EACH spell Jules produces
// 9 SVGs: 3 distinct concepts, each drafted (v1) then improved twice (v2, v3).
//
// This module exports buildPrompt(batch) where `batch` is a manifest batch
// object: { index, spells: [{ id, name, school, level, jsonPath }, ...] }.
//
// The prompt is plain text/markdown. It hardcodes the school colour map and the
// exact output paths, and forbids any non-SVG output (no code, no registry edits).
//
// Zero deps.

// School -> dominant hex. Hardcoded hex, NOT currentColor. Keep in sync with the
// design spec (docs/superpowers/specs/2026-07-13-jules-spell-icons-design.md) and
// PreviewIcons.tsx school scheme.
export const SCHOOL_COLORS = {
  evocation: '#F87171',
  abjuration: '#60A5FA',
  divination: '#2DD4BF',
  conjuration: '#818CF8',
  illusion: '#C084FC',
  transmutation: '#FBBF24',
  necromancy: '#34D399',
  none: '#94A3B8',
};

/** Resolve a spell's dominant hex from its school string. */
export function colorForSchool(school) {
  const key = (school || '').trim().toLowerCase();
  return SCHOOL_COLORS[key] || SCHOOL_COLORS.none;
}

const SCHOOL_TABLE = [
  ['Evocation', SCHOOL_COLORS.evocation],
  ['Abjuration', SCHOOL_COLORS.abjuration],
  ['Divination', SCHOOL_COLORS.divination],
  ['Conjuration', SCHOOL_COLORS.conjuration],
  ['Illusion', SCHOOL_COLORS.illusion],
  ['Transmutation', SCHOOL_COLORS.transmutation],
  ['Necromancy', SCHOOL_COLORS.necromancy],
  ['(no school)', SCHOOL_COLORS.none],
]
  .map(([name, hex]) => `  - ${name}: ${hex}`)
  .join('\n');

/**
 * Build the full Jules prompt for one batch.
 * @param {{index:number, spells:Array<{id:string,name:string,school:string,level:number|null,jsonPath:string}>}} batch
 * @returns {string}
 */
export function buildPrompt(batch) {
  const spellLines = batch.spells
    .map((s) => {
      const hex = colorForSchool(s.school);
      const school = s.school || '(no school)';
      return `  - id: ${s.id}
    name: ${s.name}
    school: ${school}
    dominantColor: ${hex}
    spellJson: ${s.jsonPath}
    outputFolder: public/assets/icons/spells/${s.id}/`;
    })
    .join('\n');

  return `# Task: generate arcane spell icons (SVG only)

You are producing decorative SVG spell icons for a tabletop RPG design preview.
Work ONLY with the files described below. Do not touch anything else.

## Absolute rules (read first)

- Output ONLY \`.svg\` files, and ONLY inside each spell's own output folder:
  \`public/assets/icons/spells/{spell-id}/\`.
- Do NOT edit, create, or delete any other file. No code changes, no TypeScript,
  no registry edits, no README, no index, no manifest, no config, no package.json.
- Do NOT run build tooling or install dependencies.
- Every SVG must be well-formed, self-contained, and standalone: no external
  files, no \`<script>\`, no external hrefs, no remote fonts.

## What to make, per spell

For EACH spell listed below, create exactly NINE SVG files:

- 3 DISTINCT concepts. A concept is a genuinely different visual idea for the
  spell. The three concepts must look clearly different from one another so a
  reviewer has real choices (e.g. for a fire spell: a flame, an arcane sigil, a
  scorched rune-circle).
- 3 versions of each concept: v1 is your first draft; v2 improves v1; v3 improves
  v2 further. Each version should be a real refinement, not a recolour.

Method for each spell:
1. Read the spell's JSON at the given \`spellJson\` path. Use its \`name\`,
   \`school\`, and \`description\` (and \`higherLevels\`/\`tags\` if helpful) to
   understand what it depicts.
2. Choose concept 1, draft \`c1-v1\`, improve to \`c1-v2\`, improve to \`c1-v3\`.
3. Repeat for a second distinct concept: \`c2-v1\`, \`c2-v2\`, \`c2-v3\`.
4. Repeat for a third distinct concept: \`c3-v1\`, \`c3-v2\`, \`c3-v3\`.

## Output file paths

Write the nine files for a spell into its output folder using these exact names:

\`\`\`
public/assets/icons/spells/{spell-id}/c1-v1.svg
public/assets/icons/spells/{spell-id}/c1-v2.svg
public/assets/icons/spells/{spell-id}/c1-v3.svg
public/assets/icons/spells/{spell-id}/c2-v1.svg
public/assets/icons/spells/{spell-id}/c2-v2.svg
public/assets/icons/spells/{spell-id}/c2-v3.svg
public/assets/icons/spells/{spell-id}/c3-v1.svg
public/assets/icons/spells/{spell-id}/c3-v2.svg
public/assets/icons/spells/{spell-id}/c3-v3.svg
\`\`\`

\`c\` is the concept number (1-3); \`v\` is the version (1-3).

## Icon style

- Canvas: every SVG must start with \`<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">\`.
- Look: radial gradients for depth, a soft glow filter (a \`feGaussianBlur\` +
  \`feMerge\` glow), and an "arcane circle" feel: a dark circular field with a
  faint runic ring, tick marks, and a central motif. Think of a magical seal.
- Reference (a hand-made Fire Bolt icon in this repo, for tone only): it uses a
  \`radialGradient\` dark-space background inside \`<circle cx="50" cy="50" r="47">\`,
  a soft multi-blur glow \`filter\`, faint concentric rune rings with dashed
  strokes and cross ticks, and a glowing central subject. Match that richness.
  Do not copy it literally; each spell should look like itself.
- Colour: use the spell's \`dominantColor\` (its school hue) as the main colour.
  Shade it with darker and lighter tones for depth. Use hardcoded hex values.
  Do NOT use \`currentColor\`.

## School colour map (hardcoded hex, use the spell's school)

${SCHOOL_TABLE}

## Spells in THIS batch (batch ${batch.index})

${spellLines}

## Done criteria

- Nine valid SVG files exist for every spell above, in the correct folders with
  the correct names.
- No other files were changed.
- Commit the new SVG files. Do not open a pull request.
`;
}

// Allow: node scripts/jules/prompt-template.mjs [batchIndex]
// Prints the prompt for the given batch from the default manifest, for eyeballing.
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('prompt-template.mjs')) {
  const run = async () => {
    const { readFile } = await import('node:fs/promises');
    const path = (await import('node:path')).default;
    const { fileURLToPath } = await import('node:url');
    const here = path.dirname(fileURLToPath(import.meta.url));
    const repoRoot = path.resolve(here, '..', '..');
    const manifestPath = path.join(repoRoot, '.agent', 'scratch', 'jules-icons', 'manifest.json');
    const idx = Number(process.argv[2] || 0);
    try {
      const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
      const batch = manifest.batches[idx];
      if (!batch) {
        console.error(`no batch ${idx} (manifest has ${manifest.batches.length})`);
        process.exit(1);
      }
      process.stdout.write(buildPrompt(batch));
    } catch (e) {
      console.error(`could not load manifest at ${manifestPath}: ${e.message}`);
      console.error('run: node scripts/jules/manifest.mjs first');
      process.exit(1);
    }
  };
  run();
}
