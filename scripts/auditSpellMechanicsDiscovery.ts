import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * This file creates the manual-review ledger for hidden spell mechanics.
 *
 * The spell pipeline has three layers: canonical prose copied into each reference
 * markdown file, structured markdown fields at the top of that same file, and the
 * runtime JSON loaded by the game. This audit reads all three layers for every spell,
 * points reviewers at prose that may hide mechanics, and writes durable bucket reports
 * so the follow-up template and JSON work can be verified instead of remembered.
 *
 * Called manually by: Codex during the spell mechanics discovery and closure goal.
 * Depends on: docs/spells/reference, public/data/spells, and the existing spell truth reports.
 * Writes: docs/tasks/spells/mechanics-discovery and .agent/roadmap-local/spell-validation.
 */

// ============================================================================
// Paths And Report Shape
// ============================================================================
// This section keeps all generated artifacts in the same spell-validation report
// areas used by the older canonical, structured, JSON, and runtime-template audits.
// ============================================================================

const SCRIPT_FILE = fileURLToPath(import.meta.url);
const SCRIPT_DIR = path.dirname(SCRIPT_FILE);
const REPO_ROOT = path.resolve(SCRIPT_DIR, '..');
const SPELL_REFERENCE_ROOT = path.join(REPO_ROOT, 'docs', 'spells', 'reference');
const SPELL_JSON_ROOT = path.join(REPO_ROOT, 'public', 'data', 'spells');
const REPORT_DIR = path.join(REPO_ROOT, 'docs', 'tasks', 'spells', 'mechanics-discovery');
const BUCKET_REPORT_DIR = path.join(REPORT_DIR, 'buckets');
const REPORT_MD_PATH = path.join(REPORT_DIR, 'SPELL_MECHANICS_DISCOVERY_REPORT.md');
const MANUAL_REVIEW_DIR = path.join(REPORT_DIR, 'manual-review-overrides');
const MANUAL_REVIEW_INDEX_PATH = path.join(MANUAL_REVIEW_DIR, 'index.json');
const LEGACY_MANUAL_REVIEW_PATH = path.join(REPORT_DIR, 'manual-review-overrides.json');
const REPORT_JSON_PATH = path.join(REPO_ROOT, '.agent', 'roadmap-local', 'spell-validation', 'spell-mechanics-discovery.json');
const CANONICAL_SNAPSHOT_HEADING = '## Canonical D&D Beyond Snapshot';
const CANONICAL_FROM_FIVE_ETOOLS_MARKER = '<!-- CANONICAL-FROM-5ETOOLS -->';

type ResolutionStatus =
  | 'needs_manual_review'
  | 'actionable_open'
  | 'closed'
  | 'deferred_flavor'
  | 'special_question';

type BucketId =
  | 'choice_or_mode'
  | 'attack_or_save_modifier'
  | 'reaction_or_opportunity_restriction'
  | 'multi_instance_or_split_targeting'
  | 'target_filter_or_eligibility'
  | 'repeat_save_or_recurring_check'
  | 'sustain_or_recast_action'
  | 'movement_or_repositioning'
  | 'forced_movement'
  | 'terrain_or_surface'
  | 'vision_light_sound'
  | 'illusion_or_disguise'
  | 'sensor_or_remote_perception'
  | 'message_or_communication'
  | 'created_object_or_structure'
  | 'summon_or_controlled_entity'
  | 'ward_alarm_or_trigger'
  | 'travel_or_planar_movement'
  | 'resource_or_consumption'
  | 'social_or_knowledge_effect'
  | 'healing_or_restoration'
  | 'object_stats_or_damageability'
  | 'status_or_state_change'
  | 'damage_reduction_or_prevention'
  | 'environmental_change'
  | 'conditional_ending'
  | 'aftermath_or_memory'
  | 'deferred_descriptive_flavor'
  | 'special_question';

interface BucketDefinition {
  bucketId: BucketId;
  title: string;
  scope: string;
  detectorTerms: string[];
  structuredHints: string[];
  jsonHints: string[];
  defaultStatus: ResolutionStatus;
}

interface MechanicsFinding {
  bucketId: BucketId;
  findingId: string;
  canonicalEvidence: string;
  structuredState: string;
  jsonState: string;
  issue: string;
  closedReason?: string;
  recommendedTemplateChange: string;
  recommendedJsonChange: string;
  resolutionStatus: ResolutionStatus;
}

interface SpellMechanicsRow {
  spellId: string;
  spellName: string;
  level: number;
  markdownPath: string;
  jsonPath: string;
  canonicalSource: 'dndbeyond' | '5etools-partial' | 'missing';
  canonicalText: string;
  structuredLabels: Record<string, string>;
  runtimeSummary: Record<string, unknown>;
  findings: MechanicsFinding[];
  deferredFlavor: MechanicsFinding[];
  specialQuestions: MechanicsFinding[];
}

interface BucketSummary {
  bucketId: BucketId;
  title: string;
  count: number;
  spellIds: string[];
  openCount: number;
  closedCount: number;
  deferredCount: number;
  specialQuestionCount: number;
}

interface MechanicsDiscoveryReport {
  generatedAt: string;
  scannedSpells: number;
  pairedJsonFiles: number;
  bucketSummaries: BucketSummary[];
  rows: SpellMechanicsRow[];
}

interface ManualFindingOverride {
  resolutionStatus?: ResolutionStatus;
  closedReason?: string;
  issue?: string;
  recommendedTemplateChange?: string;
  recommendedJsonChange?: string;
  reviewerNote?: string;
}

interface ManualReviewOverrides {
  generatedFor: string;
  notes: string[];
  findings: Record<string, ManualFindingOverride>;
  manualFindings: Record<string, MechanicsFinding[]>;
}

interface ManualReviewOverrideShard {
  generatedFor?: string;
  notes?: string[];
  findings?: Record<string, ManualFindingOverride>;
  manualFindings?: Record<string, MechanicsFinding[]>;
}

// ============================================================================
// Bucket Taxonomy
// ============================================================================
// This section names the mechanics families the user asked us to surface. The
// detector terms are review aids only: they make the corpus easier to inspect,
// but the generated findings still require manual confirmation before closure.
// ============================================================================

const BUCKETS: BucketDefinition[] = [
  {
    bucketId: 'choice_or_mode',
    title: 'Choices And Modes',
    scope: 'Caster or player choices that alter the spell effect.',
    detectorTerms: ['choose', 'choice', 'chosen', 'option', 'one of the following', 'following effects', 'same target or at different ones'],
    structuredHints: ['Choice', 'Option', 'Mode', 'AI Prompt'],
    jsonHints: ['aiContext', 'prompt', 'playerInputRequired'],
    defaultStatus: 'needs_manual_review',
  },
  {
    bucketId: 'attack_or_save_modifier',
    title: 'Attack Rolls, Saves, And Check Modifiers',
    scope: 'Bonuses, penalties, dice, advantage, disadvantage, or minimum/maximum rules that alter d20 rolls.',
    detectorTerms: ['attack roll', 'saving throw', 'ability check', 'subtracts', 'adds', 'bonus', 'penalty', 'advantage', 'disadvantage', '1d4'],
    structuredHints: ['Attack Roll', 'Save', 'Modifier', 'Penalty', 'Bonus'],
    jsonHints: ['ATTACK_ROLL_MODIFIER', 'saveModifiers', 'attackFilter', 'savingThrow', 'savePenalty'],
    defaultStatus: 'needs_manual_review',
  },
  {
    bucketId: 'reaction_or_opportunity_restriction',
    title: 'Reactions And Opportunity Restrictions',
    scope: 'Rules that block, suppress, limit, or grant reactions, especially Opportunity Attack rules that are narrower than all reactions.',
    detectorTerms: ['reaction', 'reactions', 'opportunity attack', 'opportunity attacks', 'can\'t make opportunity', 'cannot make opportunity'],
    structuredHints: ['Reaction', 'Opportunity', 'Condition'],
    jsonHints: ['reaction', 'Opportunity', 'Reactions Suppressed', 'STATUS_CONDITION'],
    defaultStatus: 'needs_manual_review',
  },
  {
    bucketId: 'multi_instance_or_split_targeting',
    title: 'Multi-Instance And Split Targeting',
    scope: 'Effects that create multiple beams, lights, targets, attacks, or secondary target relationships.',
    detectorTerms: ['up to four', 'two beams', 'three beams', 'four beams', 'same target or at different ones', 'separate attack roll', 'second creature', 'different creature', 'secondary target', 'each beam', 'each light'],
    structuredHints: ['Targeting Max', 'Targeting Type', 'Secondary', 'Scaling Rule'],
    jsonHints: ['maxTargets', 'secondary', 'thresholds', 'multi'],
    defaultStatus: 'needs_manual_review',
  },
  {
    bucketId: 'target_filter_or_eligibility',
    title: 'Target Filters And Eligibility',
    scope: 'Rules that include, exclude, or automatically pass/fail based on creature type, worn/carried state, combat state, prior casting, or other target facts.',
    detectorTerms: ['isn\'t a humanoid', 'is not a humanoid', 'humanoid', 'worn or carried', 'being worn or carried', 'if you\'re fighting it', 'if you have cast this spell', 'automatically succeeds', 'automatically fails', 'unoccupied space'],
    structuredHints: ['Valid Targets', 'Target Filter', 'Creature', 'Object'],
    jsonHints: ['validTargets', 'targetFilter', 'creatureTypes', 'excludeCreatureTypes'],
    defaultStatus: 'needs_manual_review',
  },
  {
    bucketId: 'repeat_save_or_recurring_check',
    title: 'Repeated Saves Or Recurring Checks',
    scope: 'Saving throws, checks, or repeated resolution after the initial casting.',
    detectorTerms: ['repeat the saving throw', 'repeats the saving throw', 'at the end of each of its turns', 'at the start of each of its turns', 'must make another saving throw', 'each turn'],
    structuredHints: ['Repeat', 'Recurring', 'Save'],
    jsonHints: ['frequency', 'turn_start', 'turn_end', 'save'],
    defaultStatus: 'needs_manual_review',
  },
  {
    bucketId: 'sustain_or_recast_action',
    title: 'Sustain, Move, Or Recast Actions',
    scope: 'Follow-up actions, bonus actions, or recurring actions used to maintain or reuse spell effects.',
    detectorTerms: ['as a bonus action', 'as an action', 'on subsequent turns', 'on each of your turns', 'you can use your action', 'you can use a bonus action'],
    structuredHints: ['Sustain', 'Trigger', 'Action', 'Combat Cost'],
    jsonHints: ['sustainCost', 'trigger', 'actionType'],
    defaultStatus: 'needs_manual_review',
  },
  {
    bucketId: 'movement_or_repositioning',
    title: 'Movement Or Repositioning',
    scope: 'Movement granted to the caster, target, effect, or created entity.',
    detectorTerms: ['move up to', 'moves up to', 'speed increases', 'walking speed', 'flying speed', 'swimming speed', 'climbing speed', 'hover', 'levitate'],
    structuredHints: ['Movement', 'Speed', 'Move'],
    jsonHints: ['movement', 'speed', 'movementType'],
    defaultStatus: 'needs_manual_review',
  },
  {
    bucketId: 'forced_movement',
    title: 'Forced Movement',
    scope: 'Pushing, pulling, dragging, teleporting unwilling targets, or otherwise moving targets without normal movement.',
    detectorTerms: ['push', 'pull', 'pushed', 'pulled', 'drag', 'knock', 'moved away', 'moved toward'],
    structuredHints: ['Forced Movement', 'Push', 'Pull'],
    jsonHints: ['forcedMovement', 'push', 'pull'],
    defaultStatus: 'needs_manual_review',
  },
  {
    bucketId: 'terrain_or_surface',
    title: 'Terrain And Surfaces',
    scope: 'Difficult terrain, slippery surfaces, growth, hazards, or persistent area surfaces.',
    detectorTerms: ['difficult terrain', 'terrain', 'surface', 'ground', 'floor', 'wall', 'hazard', 'slippery'],
    structuredHints: ['Terrain', 'Surface', 'Area Shape'],
    jsonHints: ['terrain', 'surface', 'areaOfEffect'],
    defaultStatus: 'needs_manual_review',
  },
  {
    bucketId: 'vision_light_sound',
    title: 'Vision, Light, And Sound',
    scope: 'Light, darkness, sound, silence, visibility, hearing, and related sensory mechanics.',
    detectorTerms: ['bright light', 'dim light', 'darkness', 'invisible', 'see', 'visible', 'sound', 'audible', 'silence', 'deafened', 'blinded'],
    structuredHints: ['Light', 'Vision', 'Sound', 'Condition'],
    jsonHints: ['light', 'vision', 'sound', 'Invisible', 'Blinded', 'Deafened'],
    defaultStatus: 'needs_manual_review',
  },
  {
    bucketId: 'illusion_or_disguise',
    title: 'Illusions And Disguises',
    scope: 'Illusory images, sensory deception, appearance changes, and disguise effects.',
    detectorTerms: ['illusion', 'illusory', 'disguise', 'appearance', 'image', 'phantasmal', 'seems', 'appears to'],
    structuredHints: ['Illusion', 'Disguise', 'Utility Type'],
    jsonHints: ['illusion', 'disguise', 'UTILITY'],
    defaultStatus: 'needs_manual_review',
  },
  {
    bucketId: 'sensor_or_remote_perception',
    title: 'Sensors And Remote Perception',
    scope: 'Remote sensors, clairvoyance, divination windows, seeing through objects, and scrying style effects.',
    detectorTerms: ['sensor', 'scry', 'clairvoyance', 'see through', 'hear through', 'remote', 'invisible sensor', 'perceive'],
    structuredHints: ['Sensor', 'Perception', 'Utility Type'],
    jsonHints: ['sensor', 'perception', 'UTILITY'],
    defaultStatus: 'needs_manual_review',
  },
  {
    bucketId: 'message_or_communication',
    title: 'Messages And Communication',
    scope: 'Sending, telepathy, verbal messages, written messages, and magical communication.',
    detectorTerms: ['message', 'communicate', 'telepathy', 'telepathic', 'speak', 'understand', 'language', 'words'],
    structuredHints: ['Communication', 'Language', 'Utility Type'],
    jsonHints: ['communication', 'language', 'UTILITY'],
    defaultStatus: 'needs_manual_review',
  },
  {
    bucketId: 'created_object_or_structure',
    title: 'Created Objects And Structures',
    scope: 'Objects, barriers, shelters, food, water, and structures created or altered by the spell.',
    detectorTerms: ['creates an object', 'create an object', 'created object', 'structure', 'wall', 'shelter', 'food', 'water', 'bridge', 'tower', 'hut'],
    structuredHints: ['Object', 'Structure', 'Wall', 'Utility Type'],
    jsonHints: ['object', 'structure', 'wallStats', 'UTILITY'],
    defaultStatus: 'needs_manual_review',
  },
  {
    bucketId: 'summon_or_controlled_entity',
    title: 'Summons And Controlled Entities',
    scope: 'Creatures, spirits, servants, companions, or other entities called or controlled by a spell.',
    detectorTerms: ['summon', 'summons', 'creature appears', 'spirit', 'servant', 'controlled', 'obeys', 'command'],
    structuredHints: ['Summon', 'Creature', 'Control'],
    jsonHints: ['summon', 'creatureId', 'summonType'],
    defaultStatus: 'needs_manual_review',
  },
  {
    bucketId: 'ward_alarm_or_trigger',
    title: 'Wards, Alarms, And Triggers',
    scope: 'Delayed triggers, alarms, protective wards, glyphs, and conditional activation.',
    detectorTerms: ['alarm', 'ward', 'trigger', 'triggered', 'glyph', 'until triggered', 'when a creature enters', 'when a creature moves'],
    structuredHints: ['Trigger', 'Ward', 'Alarm'],
    jsonHints: ['trigger', 'ward', 'alarm'],
    defaultStatus: 'needs_manual_review',
  },
  {
    bucketId: 'travel_or_planar_movement',
    title: 'Travel And Planar Movement',
    scope: 'Teleportation, planar travel, extradimensional movement, and long-distance transport.',
    detectorTerms: ['teleport', 'teleports', 'plane', 'planar', 'extradimensional', 'transport', 'travel', 'portal'],
    structuredHints: ['Travel', 'Teleport', 'Plane'],
    jsonHints: ['teleport', 'plane', 'travel'],
    defaultStatus: 'needs_manual_review',
  },
  {
    bucketId: 'resource_or_consumption',
    title: 'Resources And Consumption',
    scope: 'Material consumption, costly components, spell-end costs, charges, created resource amounts, and resource limits.',
    detectorTerms: ['consume', 'consumed', 'costs', 'worth', 'gp', 'charges', 'regain hit points', 'cannot regain hit points', 'food', 'water'],
    structuredHints: ['Material Cost', 'Consumed', 'Resource'],
    jsonHints: ['materialCost', 'isConsumed', 'consumption'],
    defaultStatus: 'needs_manual_review',
  },
  {
    bucketId: 'social_or_knowledge_effect',
    title: 'Social And Knowledge Effects',
    scope: 'Charm-like influence, truth, memory, knowledge access, detection, and information gathering.',
    detectorTerms: ['charmed', 'truth', 'lie', 'memory', 'learn', 'know', 'detect', 'identify', 'locate', 'find', 'influence'],
    structuredHints: ['Social', 'Knowledge', 'Condition', 'Utility Type'],
    jsonHints: ['Charmed', 'knowledge', 'detect', 'UTILITY'],
    defaultStatus: 'needs_manual_review',
  },
  {
    bucketId: 'healing_or_restoration',
    title: 'Healing And Restoration',
    scope: 'Hit point recovery, temporary hit points, stabilization, nourishment-based recovery, and removal or restoration of harmful states.',
    detectorTerms: ['regain hit points', 'regains hit points', 'regains 1 hit point', 'restore hit points', 'restores hit points', 'restores 1 hit point', 'healing', 'temporary hit points', 'cure', 'restoration', 'stable'],
    structuredHints: ['Healing', 'Temporary Hit Points', 'Restoration', 'Stable', 'Utility Type'],
    jsonHints: ['HEALING', 'TEMPORARY_HIT_POINTS', 'healing', 'temporaryHitPoints', 'Stable'],
    defaultStatus: 'needs_manual_review',
  },
  {
    bucketId: 'object_stats_or_damageability',
    title: 'Object Stats And Damageability',
    scope: 'AC, hit points, damage thresholds, destructibility, and object durability.',
    detectorTerms: ['ac ', 'armor class', 'hit points', 'hp', 'destroyed', 'damage threshold', 'immune to damage'],
    structuredHints: ['Object AC', 'Object HP', 'Wall'],
    jsonHints: ['wallStats', 'ac', 'hpPerSection', 'objectDescription'],
    defaultStatus: 'needs_manual_review',
  },
  {
    bucketId: 'status_or_state_change',
    title: 'Status And State Changes',
    scope: 'Rules that place a creature, object, or spell target into a named game state that is not already captured by ordinary damage, healing, or targeting.',
    detectorTerms: ['stable', 'becomes stable', 'prone', 'blinded', 'charmed', 'deafened', 'frightened', 'grappled', 'invisible', 'unconscious', 'incapacitated', 'paralyzed', 'petrified', 'restrained', 'stunned', 'dead', 'dying'],
    structuredHints: ['Condition', 'Stable', 'State', 'Status'],
    jsonHints: ['STATUS_CONDITION', 'statusCondition', 'stateChange', 'Stable'],
    defaultStatus: 'needs_manual_review',
  },
  {
    bucketId: 'damage_reduction_or_prevention',
    title: 'Damage Reduction And Prevention',
    scope: 'Damage reductions, prevention, resist-like numeric reductions, once-per-turn damage riders, and chosen damage-type mitigation.',
    detectorTerms: ['reduces the total damage', 'reduce it by', 'damage taken by', 'resistance to', 'immune to damage', 'prevents damage'],
    structuredHints: ['Damage Reduction', 'Damage Type', 'Resistance', 'Utility Type'],
    jsonHints: ['damageReduction', 'damageType', 'resistance', 'DEFENSIVE'],
    defaultStatus: 'needs_manual_review',
  },
  {
    bucketId: 'environmental_change',
    title: 'Environmental Change',
    scope: 'Weather, air, water, fire, plant growth, gravity, temperature, and other world-state changes.',
    detectorTerms: ['weather', 'wind', 'rain', 'storm', 'air', 'water', 'fire', 'plant', 'growth', 'temperature', 'gravity'],
    structuredHints: ['Environment', 'Utility Type'],
    jsonHints: ['environment', 'UTILITY'],
    defaultStatus: 'needs_manual_review',
  },
  {
    bucketId: 'conditional_ending',
    title: 'Conditional Ending',
    scope: 'Rules that end, suppress, or change the spell before normal duration expires.',
    detectorTerms: ['spell ends', 'effect ends', 'ends early', 'if the target', 'if it takes damage', 'breaks', 'until the spell ends', 'until it ends'],
    structuredHints: ['Ending', 'Condition', 'Duration'],
    jsonHints: ['duration', 'condition', 'trigger'],
    defaultStatus: 'needs_manual_review',
  },
  {
    bucketId: 'aftermath_or_memory',
    title: 'Aftermath, Awareness, And Memory',
    scope: 'Effects that happen after a spell ends, including awareness, memory, knowledge of the caster, or lingering consequences.',
    detectorTerms: ['when the spell ends', 'after the spell ends', 'knows it was', 'remembers', 'for the next 24 hours', 'within the past 24 hours', 'lingers'],
    structuredHints: ['Aftermath', 'Memory', 'Knowledge', 'Notes'],
    jsonHints: ['aftermath', 'memory', 'knows', 'description'],
    defaultStatus: 'needs_manual_review',
  },
  {
    bucketId: 'deferred_descriptive_flavor',
    title: 'Deferred Descriptive Flavor',
    scope: 'Purely descriptive prose retained for later review and intentionally excluded from this goal closure.',
    detectorTerms: ['spectral', 'shimmer', 'ethereal', 'harmless sensory', 'color', 'faint'],
    structuredHints: ['Description'],
    jsonHints: ['description'],
    defaultStatus: 'deferred_flavor',
  },
];

// ============================================================================
// File Discovery And Markdown Parsing
// ============================================================================
// This section reads spell files without changing them. It deliberately keeps
// parsing strict so the report reflects the actual validator-facing surfaces.
// ============================================================================

function listMarkdownFiles(root: string): string[] {
  const files: string[] = [];

  function walk(currentPath: string): void {
    for (const entry of fs.readdirSync(currentPath, { withFileTypes: true })) {
      const fullPath = path.join(currentPath, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
        continue;
      }

      if (entry.isFile() && entry.name.endsWith('.md')) files.push(fullPath);
    }
  }

  walk(root);
  return files.sort((a, b) => a.localeCompare(b));
}

function levelFromPath(filePath: string): number {
  const match = filePath.match(/[\\/]level-(\d+)[\\/]/);
  return match ? Number(match[1]) : -1;
}

function spellIdFromPath(filePath: string): string {
  return path.basename(filePath, path.extname(filePath));
}

function toRepoPath(filePath: string): string {
  return path.relative(REPO_ROOT, filePath).replace(/\\/g, '/');
}

function parseSpellName(markdown: string, fallback: string): string {
  const heading = markdown.match(/^#\s+(.+?)\s*$/m);
  return heading ? heading[1].trim() : fallback;
}

function extractStructuredBlock(markdown: string): string {
  const canonicalIndex = markdown.indexOf(CANONICAL_SNAPSHOT_HEADING);
  const partialIndex = markdown.indexOf(CANONICAL_FROM_FIVE_ETOOLS_MARKER);
  const indexes = [canonicalIndex, partialIndex].filter((value) => value >= 0);
  const boundary = indexes.length > 0 ? Math.min(...indexes) : -1;
  return boundary >= 0 ? markdown.slice(0, boundary) : markdown;
}

function parseStructuredLabels(markdown: string): Record<string, string> {
  const labels: Record<string, string> = {};
  const structuredBlock = extractStructuredBlock(markdown);

  for (const line of structuredBlock.split(/\r?\n/)) {
    const match = line.match(/^- \*\*(.+?)\*\*:\s*(.*)$/);
    if (!match) continue;
    labels[match[1].trim()] = (match[2] ?? '').trim();
  }

  return labels;
}

function extractDndBeyondCanonicalBlock(markdown: string): string | null {
  const headingIndex = markdown.indexOf(CANONICAL_SNAPSHOT_HEADING);
  if (headingIndex === -1) return null;

  const commentStart = markdown.indexOf('<!--', headingIndex);
  const commentEnd = commentStart === -1 ? -1 : markdown.indexOf('-->', commentStart);
  if (commentStart === -1 || commentEnd === -1) return null;

  return markdown.slice(commentStart + 4, commentEnd).trim();
}

function extractFiveEtoolsCanonicalBlock(markdown: string): string | null {
  const markerIndex = markdown.indexOf(CANONICAL_FROM_FIVE_ETOOLS_MARKER);
  if (markerIndex === -1) return null;

  const commentStart = markdown.indexOf('<!--', markerIndex + CANONICAL_FROM_FIVE_ETOOLS_MARKER.length);
  const commentEnd = commentStart === -1 ? -1 : markdown.indexOf('-->', commentStart);
  if (commentStart === -1 || commentEnd === -1) return null;

  return markdown.slice(commentStart + 4, commentEnd).trim();
}

function extractCanonicalSource(markdown: string): { source: SpellMechanicsRow['canonicalSource']; block: string } {
  const dndBeyondBlock = extractDndBeyondCanonicalBlock(markdown);
  if (dndBeyondBlock) return { source: 'dndbeyond', block: dndBeyondBlock };

  const fiveEtoolsBlock = extractFiveEtoolsCanonicalBlock(markdown);
  if (fiveEtoolsBlock) return { source: '5etools-partial', block: fiveEtoolsBlock };

  return { source: 'missing', block: '' };
}

function extractCanonicalSection(block: string, heading: string): string {
  const lines = block.split(/\r?\n/);
  const out: string[] = [];
  let inSection = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!inSection) {
      if (trimmed === `${heading}:`) inSection = true;
      continue;
    }

    if (/^[A-Z][A-Za-z /-]+:\s*$/.test(trimmed)) break;
    if (/^(?:Spell Tags|Available For|Referenced Rules|Material Component|Capture Method|Legacy Page):/i.test(trimmed)) break;
    out.push(line);
  }

  return out.join('\n').trim();
}

function extractReferencedRules(block: string): string {
  return extractCanonicalSection(block, 'Referenced Rules');
}

function buildCanonicalText(markdown: string, block: string): string {
  const rulesText = extractCanonicalSection(block, 'Rules Text');
  const higherLevels = extractCanonicalSection(block, 'At Higher Levels') || extractCanonicalSection(block, 'Higher Levels');
  const referencedRules = extractReferencedRules(block);

  // Partial 5etools blocks intentionally lack prose, so the structured description
  // is the only available review text for mechanics until a better source is added.
  if (!rulesText && markdown.includes(CANONICAL_FROM_FIVE_ETOOLS_MARKER)) {
    const labels = parseStructuredLabels(markdown);
    return [labels.Description, labels['Higher Levels'], referencedRules].filter(Boolean).join('\n\n').trim();
  }

  return [rulesText, higherLevels, referencedRules].filter(Boolean).join('\n\n').trim();
}

// ============================================================================
// Runtime JSON Summaries
// ============================================================================
// This section compresses runtime JSON into enough shape for the discovery report.
// Full JSON remains in the spell file; the report needs only the fields most likely
// to prove whether a mechanic was modeled or flattened.
// ============================================================================

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readJsonRecord(filePath: string): Record<string, unknown> | null {
  if (!fs.existsSync(filePath)) return null;
  const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
  return isRecord(parsed) ? parsed : null;
}

function createRuntimeSummary(json: Record<string, unknown> | null): Record<string, unknown> {
  if (!json) return {};

  return {
    attackType: json.attackType,
    range: json.range,
    duration: json.duration,
    targeting: json.targeting,
    effects: json.effects,
    aiContext: json.aiContext,
    tags: json.tags,
    description: json.description,
    higherLevels: json.higherLevels,
  };
}

function stringifyForSearch(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value === null || value === undefined) return '';
  return JSON.stringify(value);
}

function summarizeStructuredState(labels: Record<string, string>, bucket: BucketDefinition): string {
  const hits = Object.entries(labels)
    .filter(([label, value]) => {
      const combined = `${label} ${value}`.toLowerCase();
      return bucket.structuredHints.some((hint) => combined.includes(hint.toLowerCase()));
    })
    .map(([label, value]) => `${label}: ${value}`);

  return hits.length > 0 ? hits.slice(0, 8).join(' | ') : 'No obvious structured field for this bucket was found.';
}

function summarizeJsonState(runtimeSummary: Record<string, unknown>, bucket: BucketDefinition): string {
  const serialized = stringifyForSearch(runtimeSummary).toLowerCase();
  const hits = bucket.jsonHints.filter((hint) => serialized.includes(hint.toLowerCase()));
  return hits.length > 0
    ? `Runtime JSON contains related hints: ${hits.join(', ')}.`
    : 'No obvious runtime JSON field for this bucket was found.';
}

// ============================================================================
// Finding Detection
// ============================================================================
// This section creates review candidates. It does not claim a bucket is truly
// missing until a human or agent reads the evidence and changes the status.
// ============================================================================

function findEvidenceSentences(canonicalText: string, terms: string[]): string[] {
  const sentences = canonicalText
    .replace(/\r/g, '')
    .split(/(?<=[.!?])\s+|\n+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

  const lowerTerms = terms.map((term) => term.toLowerCase());
  return sentences
    .filter((sentence) => {
      const lower = sentence.toLowerCase();
      return lowerTerms.some((term) => lower.includes(term));
    })
    .slice(0, 5);
}

function createFinding(
  spellId: string,
  bucket: BucketDefinition,
  canonicalEvidence: string,
  labels: Record<string, string>,
  runtimeSummary: Record<string, unknown>,
): MechanicsFinding {
  const structuredState = summarizeStructuredState(labels, bucket);
  const jsonState = summarizeJsonState(runtimeSummary, bucket);
  const hasStructuredHint = !structuredState.startsWith('No obvious');
  const hasJsonHint = !jsonState.startsWith('No obvious');

  return {
    bucketId: bucket.bucketId,
    findingId: `${spellId}::${bucket.bucketId}`,
    canonicalEvidence,
    structuredState,
    jsonState,
    issue: hasStructuredHint && hasJsonHint
      ? 'Canonical prose contains this mechanic family; review whether the existing structured and JSON fields preserve the full rule instead of flattening it.'
      : 'Canonical prose contains this mechanic family, but at least one downstream layer has no obvious matching field in the current summary.',
    recommendedTemplateChange: 'Manual review required. If the current template cannot express the mechanic without prose, add or split structured fields for this bucket and include an explicit not_applicable sentinel.',
    recommendedJsonChange: 'Manual review required. If runtime JSON cannot express the mechanic as data, add or split JSON fields and propagate sentinel values across the corpus.',
    resolutionStatus: bucket.defaultStatus,
  };
}

function detectFindings(
  spellId: string,
  canonicalText: string,
  labels: Record<string, string>,
  runtimeSummary: Record<string, unknown>,
): MechanicsFinding[] {
  const findings: MechanicsFinding[] = [];

  for (const bucket of BUCKETS) {
    const evidence = findEvidenceSentences(canonicalText, bucket.detectorTerms);
    if (evidence.length === 0) continue;

    findings.push(createFinding(spellId, bucket, evidence.join(' / '), labels, runtimeSummary));
  }

  return findings;
}

function createEmptyManualReviewOverrides(): ManualReviewOverrides {
  return {
    generatedFor: 'spell-mechanics-discovery',
    notes: [
      'Keys are finding ids in the form spell-id::bucket_id.',
      'Use resolutionStatus=closed when structured markdown and JSON already preserve the canonical mechanic.',
      'Use resolutionStatus=actionable_open when a template or data change is needed.',
      'Use resolutionStatus=deferred_flavor for descriptive-only prose intentionally outside this goal.',
      'Use resolutionStatus=special_question only when user judgment is needed before encoding the mechanic.',
      'Manual review overrides are split by spell level under this folder so one growing file does not become the work surface for the whole corpus.',
    ],
    findings: {},
    manualFindings: {},
  };
}

function parseManualReviewShard(filePath: string): ManualReviewOverrideShard {
  // Windows PowerShell 5.1 can write UTF-8 JSON files with a leading byte-order
  // mark. The review shards are human-maintained operational data, so the audit
  // accepts that harmless file encoding marker instead of failing before it can
  // evaluate the actual spell mechanics content.
  const rawJson = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
  const parsed = JSON.parse(rawJson) as unknown;
  if (!isRecord(parsed)) {
    throw new Error(`Manual review override shard has an invalid shape: ${filePath}`);
  }

  if (parsed.findings !== undefined && !isRecord(parsed.findings)) {
    throw new Error(`Manual review override shard has invalid findings: ${filePath}`);
  }

  if (parsed.manualFindings !== undefined && !isRecord(parsed.manualFindings)) {
    throw new Error(`Manual review override shard has invalid manualFindings: ${filePath}`);
  }

  return parsed as unknown as ManualReviewOverrideShard;
}

function mergeManualReviewShard(overrides: ManualReviewOverrides, shard: ManualReviewOverrideShard): void {
  // The split files are ownership boundaries only. They all merge back into the
  // same shape the detector has always consumed, so report generation and gates
  // do not depend on which shard a spell came from.
  if (shard.findings) Object.assign(overrides.findings, shard.findings);
  if (shard.manualFindings) {
    for (const [spellId, findings] of Object.entries(shard.manualFindings)) {
      const normalizedFindings = Array.isArray(findings)
        ? findings
        : isRecord(findings) && 'bucketId' in findings && 'findingId' in findings
          ? [findings as unknown as MechanicsFinding]
          : isRecord(findings)
            ? (Object.values(findings) as MechanicsFinding[])
            : [];

      // Some spells have enough manually discovered mechanics that one spell can
      // make a shard hard to review. When that happens, multiple shard files may
      // intentionally contribute findings for the same spell, and those arrays
      // should be joined back together instead of one file replacing another.
      overrides.manualFindings[spellId] = [
        ...(overrides.manualFindings[spellId] ?? []),
        ...normalizedFindings,
      ];
    }
  }
}

function loadManualReviewOverridesFromDirectory(): ManualReviewOverrides {
  const overrides = createEmptyManualReviewOverrides();
  const index = fs.existsSync(MANUAL_REVIEW_INDEX_PATH)
    ? parseManualReviewShard(MANUAL_REVIEW_INDEX_PATH)
    : {};

  overrides.generatedFor = index.generatedFor ?? overrides.generatedFor;
  overrides.notes = index.notes ?? overrides.notes;

  for (const entry of fs.readdirSync(MANUAL_REVIEW_DIR, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.json') || entry.name === 'index.json') continue;
    mergeManualReviewShard(overrides, parseManualReviewShard(path.join(MANUAL_REVIEW_DIR, entry.name)));
  }

  return overrides;
}

function loadManualReviewOverrides(): ManualReviewOverrides {
  // The generated report is disposable, but manual review decisions are not.
  // Current work is stored as level-sized shards. The legacy single-file fallback
  // remains so older checkouts still run before they are migrated.
  if (fs.existsSync(MANUAL_REVIEW_DIR)) return loadManualReviewOverridesFromDirectory();

  if (!fs.existsSync(LEGACY_MANUAL_REVIEW_PATH)) return createEmptyManualReviewOverrides();

  const parsed = parseManualReviewShard(LEGACY_MANUAL_REVIEW_PATH);
  const overrides = createEmptyManualReviewOverrides();
  overrides.generatedFor = parsed.generatedFor ?? overrides.generatedFor;
  overrides.notes = parsed.notes ?? overrides.notes;
  mergeManualReviewShard(overrides, parsed);
  return overrides;
}

function writeManualReviewOverridesIfMissing(overrides: ManualReviewOverrides): void {
  if (fs.existsSync(MANUAL_REVIEW_DIR) || fs.existsSync(LEGACY_MANUAL_REVIEW_PATH)) return;
  fs.mkdirSync(MANUAL_REVIEW_DIR, { recursive: true });
  fs.writeFileSync(MANUAL_REVIEW_INDEX_PATH, `${JSON.stringify({
    generatedFor: overrides.generatedFor,
    notes: overrides.notes,
  }, null, 2)}\n`);
}

function applyManualOverrides(findings: MechanicsFinding[], overrides: ManualReviewOverrides): MechanicsFinding[] {
  return findings.map((finding) => {
    const override = overrides.findings[finding.findingId];
    if (!override) return finding;

    return {
      ...finding,
      resolutionStatus: override.resolutionStatus ?? finding.resolutionStatus,
      // Closure reasons are separate from the problem statement so generated
      // bucket reports can explain why a row was closed without erasing the
      // original mechanical issue that prompted the review.
      closedReason: override.closedReason ?? finding.closedReason,
      issue: override.issue ?? finding.issue,
      recommendedTemplateChange: override.recommendedTemplateChange ?? finding.recommendedTemplateChange,
      recommendedJsonChange: override.recommendedJsonChange ?? finding.recommendedJsonChange,
    };
  });
}

function appendManualFindings(spellId: string, findings: MechanicsFinding[], overrides: ManualReviewOverrides): MechanicsFinding[] {
  // Some mechanics are only visible after an actual read of the spell prose.
  // Manual findings let the ledger record those without weakening the detector
  // into a huge false-positive net.
  return [...findings, ...(overrides.manualFindings[spellId] ?? [])];
}

// ============================================================================
// Report Writers
// ============================================================================
// This section writes both a compact master report and per-bucket Markdown files.
// The JSON report is the source for later propagation scripts and completion gates.
// ============================================================================

function buildBucketSummaries(rows: SpellMechanicsRow[]): BucketSummary[] {
  const summaries = new Map<BucketId, BucketSummary>();

  for (const bucket of BUCKETS) {
    summaries.set(bucket.bucketId, {
      bucketId: bucket.bucketId,
      title: bucket.title,
      count: 0,
      spellIds: [],
      openCount: 0,
      closedCount: 0,
      deferredCount: 0,
      specialQuestionCount: 0,
    });
  }

  for (const row of rows) {
    for (const finding of [...row.findings, ...row.deferredFlavor, ...row.specialQuestions]) {
      const summary = summaries.get(finding.bucketId);
      if (!summary) continue;

      summary.count += 1;
      if (!summary.spellIds.includes(row.spellId)) summary.spellIds.push(row.spellId);
      if (finding.resolutionStatus === 'closed') summary.closedCount += 1;
      else if (finding.resolutionStatus === 'deferred_flavor') summary.deferredCount += 1;
      else if (finding.resolutionStatus === 'special_question') summary.specialQuestionCount += 1;
      else summary.openCount += 1;
    }
  }

  return [...summaries.values()].filter((summary) => summary.count > 0);
}

function writeJsonReport(report: MechanicsDiscoveryReport): void {
  fs.mkdirSync(path.dirname(REPORT_JSON_PATH), { recursive: true });
  fs.writeFileSync(REPORT_JSON_PATH, `${JSON.stringify(report, null, 2)}\n`);
}

function writeMasterMarkdownReport(report: MechanicsDiscoveryReport): void {
  fs.mkdirSync(REPORT_DIR, { recursive: true });

  const lines: string[] = [];
  lines.push('# Spell Mechanics Discovery Report');
  lines.push('');
  lines.push(`Generated: ${report.generatedAt}`);
  lines.push(`Spells scanned: ${report.scannedSpells}`);
  lines.push(`Spells with runtime JSON: ${report.pairedJsonFiles}`);
  lines.push('');
  lines.push('This report is the control surface for the full manual mechanics pass. Detector rows are review candidates, not proof by themselves; closure requires reading the canonical prose and confirming the structured and JSON layers preserve the mechanic.');
  lines.push('');
  lines.push('## Bucket Summary');
  lines.push('');
  lines.push('| bucket | total | open | closed | deferred | special questions | sample spells |');
  lines.push('| --- | ---: | ---: | ---: | ---: | ---: | --- |');

  for (const summary of report.bucketSummaries) {
    lines.push(`| \`${summary.bucketId}\` | ${summary.count} | ${summary.openCount} | ${summary.closedCount} | ${summary.deferredCount} | ${summary.specialQuestionCount} | ${summary.spellIds.slice(0, 10).join(', ')} |`);
  }

  lines.push('');
  lines.push('## Spell Ledger');
  lines.push('');
  lines.push('| spell | level | findings | deferred flavor | special questions |');
  lines.push('| --- | ---: | ---: | ---: | ---: |');

  for (const row of report.rows) {
    lines.push(`| \`${row.spellId}\` | ${row.level} | ${row.findings.length} | ${row.deferredFlavor.length} | ${row.specialQuestions.length} |`);
  }

  fs.writeFileSync(REPORT_MD_PATH, `${lines.join('\n')}\n`);
}

function writeBucketReports(report: MechanicsDiscoveryReport): void {
  fs.mkdirSync(BUCKET_REPORT_DIR, { recursive: true });

  for (const summary of report.bucketSummaries) {
    const bucket = BUCKETS.find((entry) => entry.bucketId === summary.bucketId);
    const lines: string[] = [];
    lines.push(`# ${bucket?.title ?? summary.bucketId}`);
    lines.push('');
    lines.push(`Bucket id: \`${summary.bucketId}\``);
    lines.push(`Total findings: ${summary.count}`);
    lines.push(`Open findings: ${summary.openCount}`);
    lines.push(`Closed findings: ${summary.closedCount}`);
    lines.push(`Deferred flavor findings: ${summary.deferredCount}`);
    lines.push(`Special questions: ${summary.specialQuestionCount}`);
    lines.push('');
    lines.push(bucket?.scope ?? 'No bucket scope recorded.');
    lines.push('');
    lines.push('| finding id | status | closed reason | canonical evidence | structured state | json state |');
    lines.push('| --- | --- | --- | --- | --- | --- |');

    for (const row of report.rows) {
      const findings = [...row.findings, ...row.deferredFlavor, ...row.specialQuestions]
        .filter((finding) => finding.bucketId === summary.bucketId);

      for (const finding of findings) {
        // Closed findings stay in the bucket reports so we can prove they were
        // reviewed, but only closed rows get a closure reason to avoid implying
        // open work has already been resolved.
        const closedReason = finding.resolutionStatus === 'closed' ? (finding.closedReason ?? finding.issue) : '';
        lines.push(`| \`${finding.findingId}\` | \`${finding.resolutionStatus}\` | ${escapeMarkdownTable(closedReason)} | ${escapeMarkdownTable(finding.canonicalEvidence)} | ${escapeMarkdownTable(finding.structuredState)} | ${escapeMarkdownTable(finding.jsonState)} |`);
      }
    }

    fs.writeFileSync(path.join(BUCKET_REPORT_DIR, `${summary.bucketId}.md`), `${lines.join('\n')}\n`);
  }
}

function escapeMarkdownTable(value: string): string {
  // Escape backslashes before Markdown pipes so command/schema text stays
  // literal in generated bucket tables.
  return value.replace(/\\/g, '\\\\').replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>');
}

// ============================================================================
// Main Audit Flow
// ============================================================================
// This section ties the corpus loader, detector pass, and report writers together.
// Follow-up scripts will use the JSON output as the authoritative review ledger.
// ============================================================================

function buildSpellRow(markdownPath: string, overrides: ManualReviewOverrides): SpellMechanicsRow {
  const markdown = fs.readFileSync(markdownPath, 'utf8');
  const spellId = spellIdFromPath(markdownPath);
  const level = levelFromPath(markdownPath);
  const spellName = parseSpellName(markdown, spellId);
  const labels = parseStructuredLabels(markdown);
  const canonical = extractCanonicalSource(markdown);
  const canonicalText = buildCanonicalText(markdown, canonical.block);
  const jsonPath = path.join(SPELL_JSON_ROOT, `level-${level}`, `${spellId}.json`);
  const runtimeJson = readJsonRecord(jsonPath);
  const runtimeSummary = createRuntimeSummary(runtimeJson);
  const detected = appendManualFindings(
    spellId,
    applyManualOverrides(detectFindings(spellId, canonicalText, labels, runtimeSummary), overrides),
    overrides,
  );
  const deferredFlavor = detected.filter((finding) => finding.resolutionStatus === 'deferred_flavor');
  const specialQuestions = detected.filter((finding) => finding.resolutionStatus === 'special_question');
  const findings = detected.filter((finding) => finding.resolutionStatus !== 'deferred_flavor' && finding.resolutionStatus !== 'special_question');

  return {
    spellId,
    spellName,
    level,
    markdownPath: toRepoPath(markdownPath),
    jsonPath: fs.existsSync(jsonPath) ? toRepoPath(jsonPath) : '',
    canonicalSource: canonical.source,
    canonicalText,
    structuredLabels: labels,
    runtimeSummary,
    findings,
    deferredFlavor,
    specialQuestions,
  };
}

function main(): void {
  const overrides = loadManualReviewOverrides();
  writeManualReviewOverridesIfMissing(overrides);
  const rows = listMarkdownFiles(SPELL_REFERENCE_ROOT).map((markdownPath) => buildSpellRow(markdownPath, overrides));
  const report: MechanicsDiscoveryReport = {
    generatedAt: new Date().toISOString(),
    scannedSpells: rows.length,
    pairedJsonFiles: rows.filter((row) => row.jsonPath.length > 0).length,
    bucketSummaries: buildBucketSummaries(rows),
    rows,
  };

  writeJsonReport(report);
  writeMasterMarkdownReport(report);
  writeBucketReports(report);

  console.log(`Spell mechanics discovery report written to ${REPORT_MD_PATH}`);
  console.log(`Machine-readable report written to ${REPORT_JSON_PATH}`);
  const manualReviewSource = fs.existsSync(MANUAL_REVIEW_DIR) ? MANUAL_REVIEW_DIR : LEGACY_MANUAL_REVIEW_PATH;
  console.log(`Manual review overrides read from ${manualReviewSource}`);
  console.log(`Spells scanned: ${report.scannedSpells}`);
  console.log(`Spells with runtime JSON: ${report.pairedJsonFiles}`);
  console.log(`Buckets with findings: ${report.bucketSummaries.length}`);
}

main();
