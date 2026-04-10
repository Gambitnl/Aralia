import fs from 'node:fs';
import path from 'node:path';

/**
 * This script backfills class availability for the spell reference docs that were
 * previously zero-byte placeholders and later regenerated from local JSON.
 *
 * The owner explicitly ruled that the repaired data should separate base class
 * access from subclass/domain-specific access:
 *
 * - `classes` stores only the default base classes
 * - `subClasses` stores subclass/domain-specific access when the source shows it
 * - `subClassesVerification` records that this particular batch has already been
 *   checked against the dedicated official-source review
 *
 * This script applies that split only to the regenerated-batch slice that has
 * already gone through the dedicated verification report.
 *
 * Called manually by: Codex during the spell-truth repair lane
 * Updates: the spell JSON files first, then the matching markdown reference docs
 */

// ============================================================================
// Paths And Verified Source Mapping
// ============================================================================
// This section defines the exact repaired class lists for the regenerated batch.
// The values here come from the dedicated verification report rather than from
// guesswork, so the script can update the repo consistently in one pass.
// ============================================================================

const repoRoot = 'F:\\Repos\\Aralia';
const spellDataRoot = path.join(repoRoot, 'public', 'data', 'spells');
const spellReferenceRoot = path.join(repoRoot, 'docs', 'spells', 'reference');

interface ClassAccess {
  classes: string[];
  subClasses: string[];
}

const regeneratedBatchClasses: Record<string, ClassAccess> = {
  'level-3/catnap': { classes: ['Bard', 'Sorcerer', 'Wizard', 'Artificer'], subClasses: [] },
  'level-4/aura-of-life': {
    classes: ['Cleric', 'Paladin'],
    subClasses: [
      'Cleric - Life Domain',
      'Cleric - Twilight Domain (TCOE)',
      'Druid - Circle of Wildfire (TCOE)',
      'Warlock - The Undying (SCAG)',
    ],
  },
  'level-4/aura-of-purity': {
    classes: ['Cleric', 'Paladin'],
    subClasses: [
      'Cleric - Peace Domain (TCOE)',
      'Paladin - Oath of the Watchers (TCOE)',
    ],
  },
  'level-4/elemental-bane': { classes: ['Druid', 'Warlock', 'Wizard', 'Artificer'], subClasses: [] },
  'level-4/find-greater-steed': { classes: ['Paladin'], subClasses: [] },
  'level-4/galders-speedy-courier': { classes: ['Wizard'], subClasses: [] },
  'level-4/gravity-sinkhole': { classes: ['Wizard'], subClasses: [] },
  'level-4/guardian-of-nature': { classes: ['Druid', 'Ranger'], subClasses: [] },
  'level-4/shadow-of-moil': { classes: ['Warlock'], subClasses: [] },
  'level-4/sickening-radiance': { classes: ['Sorcerer', 'Warlock', 'Wizard'], subClasses: [] },
  'level-4/staggering-smite': {
    classes: ['Paladin'],
    subClasses: ['Warlock - The Hexblade (XGTE)'],
  },
  'level-4/storm-sphere': { classes: ['Sorcerer', 'Wizard'], subClasses: [] },
  'level-4/summon-greater-demon': { classes: ['Warlock', 'Wizard'], subClasses: [] },
  'level-4/vitriolic-sphere': { classes: ['Sorcerer', 'Wizard'], subClasses: [] },
  'level-5/banishing-smite': {
    classes: ['Paladin'],
    subClasses: ['Warlock - The Hexblade (XGTE)'],
  },
  'level-5/bigbys-hand': {
    classes: ['Sorcerer', 'Wizard', 'Artificer'],
    subClasses: ['Warlock - The Fathomless (TCOE)'],
  },
  'level-5/circle-of-power': {
    classes: ['Cleric', 'Paladin', 'Wizard', 'Artificer'],
    subClasses: [
      'Cleric - Twilight Domain (TCOE)',
      'Paladin - Oath of the Crown (SCAG)',
    ],
  },
  'level-5/conjure-volley': { classes: ['Ranger'], subClasses: [] },
  'level-5/control-winds': { classes: ['Druid', 'Sorcerer', 'Wizard'], subClasses: [] },
  'level-5/swift-quiver': { classes: ['Ranger'], subClasses: [] },
  'level-5/temporal-shunt': { classes: ['Wizard'], subClasses: [] },
  'level-6/gravity-fissure': { classes: ['Wizard'], subClasses: [] },
  'level-7/tether-essence': { classes: ['Wizard'], subClasses: [] },
};

// ============================================================================
// JSON Repair
// ============================================================================
// This section updates the source-of-truth spell JSON files. The markdown should
// mirror these values, so the JSON changes happen first and the docs follow.
// ============================================================================

function updateSpellJson(levelFolder: string, spellId: string, classAccess: ClassAccess) {
  const jsonPath = path.join(spellDataRoot, levelFolder, `${spellId}.json`);
  const rawJson = fs.readFileSync(jsonPath, 'utf8');
  const parsed = JSON.parse(rawJson);

  // Replace the placeholder or empty class list with the verified base-class surface.
  parsed.classes = classAccess.classes;

  // Preserve subclass/domain-derived access separately so it does not get flattened
  // into the base class list. We keep the field present even when empty so the
  // repaired batch has a consistent explicit structure.
  parsed.subClasses = classAccess.subClasses;

  // Mark this field as verified because this script only operates on the narrow
  // batch that already went through the dedicated official-source review.
  parsed.subClassesVerification = 'verified';

  fs.writeFileSync(jsonPath, `${JSON.stringify(parsed, null, 2)}\n`, 'utf8');
}

// ============================================================================
// Markdown Repair
// ============================================================================
// This section keeps the human-facing spell reference docs aligned with the newly
// verified JSON values. It only replaces the structured Classes line and leaves
// the rest of the reference file intact.
// ============================================================================

function updateSpellMarkdown(levelFolder: string, spellId: string, classAccess: ClassAccess) {
  const markdownPath = path.join(spellReferenceRoot, levelFolder, `${spellId}.md`);
  const rawMarkdown = fs.readFileSync(markdownPath, 'utf8');
  const classesLine = `- **Classes**: ${classAccess.classes.join(', ')}`;
  const subClassesLine = `- **Sub-Classes**: ${classAccess.subClasses.length > 0 ? classAccess.subClasses.join(', ') : 'None'}`;

  // Replace the structured Classes field in place so the reference doc mirrors
  // the repaired JSON without reformatting unrelated spell fields.
  let updatedMarkdown = rawMarkdown.replace(
    /^- \*\*Classes\*\*:.*$/m,
    classesLine,
  );

  // Keep subclass/domain-derived access in its own field so the human-facing docs
  // mirror the same split that now exists in the JSON data.
  if (/^- \*\*Sub-Classes\*\*:.*$/m.test(updatedMarkdown)) {
    updatedMarkdown = updatedMarkdown.replace(/^- \*\*Sub-Classes\*\*:.*$/m, subClassesLine);
  } else {
    updatedMarkdown = updatedMarkdown.replace(classesLine, `${classesLine}\n- **Sub-Classes**: ${classAccess.subClasses.length > 0 ? classAccess.subClasses.join(', ') : 'None'}`);
  }

  fs.writeFileSync(markdownPath, updatedMarkdown, 'utf8');
}

// ============================================================================
// Execution
// ============================================================================
// This section applies the verified class backfill across the regenerated batch.
// It is intentionally narrow in scope so the ruling is enforced only where the
// evidence has already been gathered and documented.
// ============================================================================

for (const [key, classAccess] of Object.entries(regeneratedBatchClasses)) {
  const [levelFolder, spellId] = key.split('/');

  // Update the JSON source of truth first.
  updateSpellJson(levelFolder, spellId, classAccess);

  // Then update the matching markdown reference doc to mirror the JSON.
  updateSpellMarkdown(levelFolder, spellId, classAccess);

  console.log(`Backfilled classes for ${levelFolder}/${spellId}`);
}
