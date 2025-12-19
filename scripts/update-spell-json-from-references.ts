import fs from 'fs';
import path from 'path';
import { SpellValidator } from '../src/systems/spells/validation/spellValidator.ts';
import { CLASSES_DATA } from '../src/data/classes/index.ts';

type ReferenceVars = Record<string, string>;

const REFERENCE_ROOT = path.join(process.cwd(), 'docs', 'spells', 'reference');
const SPELLS_ROOT = path.join(process.cwd(), 'public', 'data', 'spells');

const LEVELS_DESC = [9, 8, 7, 6, 5, 4, 3, 2, 1];

const normalizeWhitespace = (input: string) => input.replace(/\s+/g, ' ').trim();

const isNilish = (value: string | undefined | null) => {
  if (value == null) return true;
  const v = String(value).trim().toLowerCase();
  return v === '' || v === 'n/a' || v === 'na' || v === 'none' || v === 'null';
};

const parseBoolean = (raw: string | undefined) => {
  if (raw == null) return undefined;
  const v = raw.trim().toLowerCase();
  if (v === 'true') return true;
  if (v === 'false') return false;
  return undefined;
};

const parseNumber = (raw: string | undefined) => {
  if (raw == null) return undefined;
  if (isNilish(raw)) return undefined;
  const n = Number(String(raw).trim());
  return Number.isFinite(n) ? n : undefined;
};

const normalizeCastingUnit = (raw: string | undefined) => {
  if (raw == null) return undefined;
  const v = normalizeWhitespace(raw).toLowerCase();
  if (v === 'action') return 'action';
  if (v === 'bonus action' || v === 'bonus_action') return 'bonus_action';
  if (v === 'reaction') return 'reaction';
  if (v === 'minute' || v === 'minutes') return 'minute';
  if (v === 'hour' || v === 'hours') return 'hour';
  if (v === 'special') return 'special';
  return undefined;
};

const normalizeCombatCost = (raw: string | undefined) => {
  if (raw == null) return undefined;
  const v = normalizeWhitespace(raw).toLowerCase();
  if (v === 'action') return 'action';
  if (v === 'bonus action' || v === 'bonus_action') return 'bonus_action';
  if (v === 'reaction') return 'reaction';
  return undefined;
};

const normalizeRangeType = (raw: string | undefined) => {
  if (raw == null) return undefined;
  const v = normalizeWhitespace(raw).toLowerCase();
  if (v === 'self') return 'self';
  if (v === 'touch') return 'touch';
  if (v === 'ranged') return 'ranged';
  if (v === 'special' || v === 'sight' || v === 'unlimited') return 'special';
  return undefined;
};

const normalizeDurationType = (raw: string | undefined) => {
  if (raw == null) return undefined;
  const v = normalizeWhitespace(raw).toLowerCase();
  if (v === 'instantaneous') return 'instantaneous';
  if (v === 'timed' || v === 'duration' || v === 'time' || v === 'hours') return 'timed';
  if (v === 'concentration') return 'timed';
  if (v === 'until dispelled' || v === 'until_dispelled') return 'until_dispelled';
  if (v === 'until_dispelled_or_triggered') return 'until_dispelled_or_triggered';
  if (v === 'permanent' || v === 'special') return 'special';
  return undefined;
};

const normalizeDurationUnit = (raw: string | undefined) => {
  if (raw == null) return undefined;
  const v = normalizeWhitespace(raw).toLowerCase();
  if (v === 'round' || v === 'rounds') return 'round';
  if (v === 'minute' || v === 'minutes') return 'minute';
  if (v === 'hour' || v === 'hours') return 'hour';
  if (v === 'day' || v === 'days') return 'day';
  return undefined;
};

const normalizeAoEShape = (raw: string | undefined) => {
  if (raw == null) return undefined;
  const v = normalizeWhitespace(raw).toLowerCase();
  if (v === 'none' || v === 'n/a') return undefined;
  if (v === 'sphere') return 'Sphere';
  if (v === 'circle' || v === 'emanation' || v === 'hemisphere') return 'Sphere';
  if (v === 'cube') return 'Cube';
  if (v === 'cone') return 'Cone';
  if (v === 'cylinder') return 'Cylinder';
  if (v === 'line') return 'Line';
  if (v === 'square') return 'Square';
  if (v === 'wall') return 'Line';
  if (v === 'line, ring') return 'Sphere';
  return undefined;
};

const normalizeTargetingType = (raw: string | undefined, vars: ReferenceVars) => {
  if (raw == null) return undefined;
  const v = normalizeWhitespace(raw).toLowerCase();

  if (v === 'self') return 'self';
  if (v === 'single') return 'single';
  if (v === 'multi') return 'multi';
  if (v === 'point') return 'point';
  if (v === 'touch') return 'melee';

  if (v === 'area') {
    const shape = normalizeAoEShape(vars['Area Shape']);
    const size = parseNumber(vars['Area Size']);
    if (shape && size && size > 0) return 'area';
    return 'multi';
  }

  // Some files use target categories here instead of a targeting type.
  if (v.includes('creature') || v.includes('object')) return 'single';

  if (v === 'n/a') return undefined;
  return undefined;
};

const splitCsvLike = (raw: string) =>
  raw
    .split(',')
    .map(s => normalizeWhitespace(s))
    .filter(Boolean);

const toTitleCase = (raw: string) =>
  raw
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, ch => ch.toUpperCase());

const normalizeCreatureType = (raw: string) => {
  const v = normalizeWhitespace(raw).toLowerCase();
  if (v === 'humanoid' || v === 'humanoids') return 'Humanoid';
  if (v === 'beast' || v === 'beasts') return 'Beast';
  if (v === 'plant' || v === 'plants') return 'Plant';
  return toTitleCase(v);
};

type ParsedTargets = {
  validTargets: Array<'self' | 'creatures' | 'allies' | 'enemies' | 'objects' | 'point' | 'ground'>;
  filter?: { creatureTypes?: string[] };
};

const parseValidTargets = (raw: string | undefined): ParsedTargets => {
  const base: Set<ParsedTargets['validTargets'][number]> = new Set();
  const creatureTypes: Set<string> = new Set();

  const push = (t: ParsedTargets['validTargets'][number]) => base.add(t);
  if (isNilish(raw)) return { validTargets: [] };

  const normalized = normalizeWhitespace(raw!).toLowerCase();
  const tokens = splitCsvLike(normalized.replace(/_/g, ' '));

  for (const tokenRaw of tokens) {
    const token = tokenRaw.trim();
    if (!token) continue;

    if (token === 'self') {
      push('self');
      continue;
    }

    if (token.includes('humanoid')) {
      push('creatures');
      creatureTypes.add('Humanoid');
      continue;
    }
    if (token.includes('beast')) {
      push('creatures');
      creatureTypes.add('Beast');
      continue;
    }
    if (token.includes('plant')) {
      push('creatures');
      creatureTypes.add('Plant');
      continue;
    }

    if (token.includes('willing')) {
      // Best available encoding of "willing" without a dedicated filter.
      push('allies');
      continue;
    }

    if (token.includes('creature') || token.includes('corpse')) {
      push('creatures');
      continue;
    }

    if (token.includes('object') || token.includes('weapon') || token.includes('door') || token.includes('window')) {
      push('objects');
      continue;
    }

    if (token.includes('surface') || token.includes('ground') || token.includes('location')) {
      push('ground');
      continue;
    }

    if (token.includes('point') || token.includes('space')) {
      push('point');
      continue;
    }
  }

  const validTargets = Array.from(base);
  const filter: ParsedTargets['filter'] = creatureTypes.size ? { creatureTypes: Array.from(creatureTypes) } : undefined;
  return { validTargets, filter };
};

const normalizeSaveType = (raw: string | undefined) => {
  if (isNilish(raw)) return undefined;
  const v = normalizeWhitespace(raw!).toLowerCase();
  if (v === 'strength') return 'Strength';
  if (v === 'dexterity') return 'Dexterity';
  if (v === 'constitution') return 'Constitution';
  if (v === 'intelligence') return 'Intelligence';
  if (v === 'wisdom') return 'Wisdom';
  if (v === 'charisma') return 'Charisma';
  return undefined;
};

const normalizeSaveOutcome = (raw: string | undefined) => {
  if (isNilish(raw)) return undefined;
  const v = normalizeWhitespace(raw!).toLowerCase();
  if (v.includes('half')) return 'half';
  if (v === 'none' || v.includes('no effect') || v.includes('negate')) return 'none';
  return undefined;
};

const isSimpleDiceExpression = (raw: string | undefined) => {
  if (isNilish(raw)) return false;
  const v = normalizeWhitespace(raw!);
  return /^\d+d\d+(\s*\+\s*\d+)?$/i.test(v) || /^\d+$/i.test(v);
};

const normalizeDamageType = (raw: string | undefined) => {
  if (isNilish(raw)) return undefined;
  const v = normalizeWhitespace(raw!);
  if (v.toLowerCase() === 'peircing') return 'Piercing';
  if (v.toLowerCase() === 'temphp') return undefined;
  if (v.toLowerCase() === 'healing') return undefined;
  if (v.toLowerCase() === 'none') return undefined;
  return v;
};

const parseHigherLevelScalingBonus = (raw: string | undefined) => {
  if (isNilish(raw)) return undefined;
  const text = raw!;
  const m = /increases by\s+(\+\s*)?(\d+d\d+)\s+for each spell slot level above/i.exec(text);
  if (m) return `+${m[2]}`;
  const m2 = /damage increases by\s+(\d+d\d+)\s+for each slot level above/i.exec(text);
  if (m2) return `+${m2[1]}`;
  return undefined;
};

const effectDurationFromSpellDuration = (vars: ReferenceVars) => {
  const type = normalizeDurationType(vars['Duration Type']);
  const value = parseNumber(vars['Duration Value']);
  const unit = normalizeDurationUnit(vars['Duration Unit']);

  if (type !== 'timed' || !value || !unit) return { type: 'special' as const };
  if (unit === 'round') return { type: 'rounds' as const, value };
  if (unit === 'minute') return { type: 'minutes' as const, value };
  if (unit === 'hour') return { type: 'minutes' as const, value: value * 60 };
  if (unit === 'day') return { type: 'minutes' as const, value: value * 24 * 60 };
  return { type: 'special' as const };
};

const shouldRegenerateEffects = (spell: any) => {
  if (spell?.legacy === true) return true;
  const tags: unknown = spell?.tags;
  if (Array.isArray(tags) && tags.includes('legacy')) return true;
  if (!Array.isArray(spell?.effects)) return true;
  if (spell.effects.length === 1 && spell.effects[0]?.type === 'UTILITY' && spell.effects[0]?.utilityType === 'other') {
    return true;
  }
  return false;
};

const buildEffectsFromReference = (vars: ReferenceVars) => {
  const effectTypeRaw = vars['Effect Type'] ?? '';
  const effectTypes = splitCsvLike(effectTypeRaw).map(s => s.toUpperCase());

  const saveType = normalizeSaveType(vars['Save Stat']);
  const saveOutcome = normalizeSaveOutcome(vars['Save Outcome']);
  const attackRoll = isNilish(vars['Attack Roll']) ? undefined : normalizeWhitespace(vars['Attack Roll']).toLowerCase();

  const baseTrigger = { type: 'immediate' as const };

  const effects: any[] = [];

  const makeCondition = () => {
    if (saveType) {
      return {
        type: 'save' as const,
        saveType,
        saveEffect: (saveOutcome ?? 'none') as 'none' | 'half' | 'negates_condition',
      };
    }
    if (attackRoll === 'melee' || attackRoll === 'ranged') {
      return { type: 'hit' as const };
    }
    return { type: 'always' as const };
  };

  const hasDamage = effectTypes.includes('DAMAGE') || !isNilish(vars['Damage Dice']) || !isNilish(vars['Damage Flat']);
  if (hasDamage) {
    const damageDice = isNilish(vars['Damage Dice']) ? undefined : normalizeWhitespace(vars['Damage Dice']);
    const damageFlat = parseNumber(vars['Damage Flat']);
    const damageType = normalizeDamageType(vars['Damage Type']);

    const dice = isSimpleDiceExpression(damageDice)
      ? damageDice
      : Number.isFinite(damageFlat)
        ? String(damageFlat)
        : undefined;

    if (dice && damageType) {
      const scalingBonus = parseHigherLevelScalingBonus(vars['Higher Levels']);
      const primary: any = {
        type: 'DAMAGE',
        trigger: baseTrigger,
        condition: makeCondition(),
        damage: { dice, type: damageType },
      };
      if (scalingBonus) {
        primary.scaling = { type: 'slot_level', bonusPerLevel: scalingBonus };
      }
      effects.push(primary);

      const secondaryDice = vars['Secondary Damage Dice'];
      const secondaryType = normalizeDamageType(vars['Secondary Damage Type']);
      if (isSimpleDiceExpression(secondaryDice) && secondaryType) {
        effects.push({
          type: 'DAMAGE',
          trigger: { type: 'after_primary' as const },
          condition: makeCondition(),
          damage: { dice: normalizeWhitespace(secondaryDice), type: secondaryType },
        });
      }
    }
  }

  const hasHealing = effectTypes.includes('HEALING') || !isNilish(vars['Healing Dice']);
  if (hasHealing) {
    const healingDice = isNilish(vars['Healing Dice']) ? undefined : normalizeWhitespace(vars['Healing Dice']);
    if (healingDice && (isSimpleDiceExpression(healingDice) || /^\d+d\d+\s*\+\s*\w+/i.test(healingDice) || /^\d+d\d+\s*\+\s*\d+/i.test(healingDice) || /^\d+$/i.test(healingDice))) {
      effects.push({
        type: 'HEALING',
        trigger: baseTrigger,
        condition: { type: 'always' as const },
        healing: { dice: healingDice },
      });
    }
  }

  const conditionList = vars['Conditions Applied'];
  if (!isNilish(conditionList)) {
    const duration = effectDurationFromSpellDuration(vars);
    const names = splitCsvLike(conditionList!).map(s => toTitleCase(s));
    for (const name of names) {
      effects.push({
        type: 'STATUS_CONDITION',
        trigger: baseTrigger,
        condition: saveType ? { type: 'save', saveType, saveEffect: 'negates_condition' } : { type: 'always' },
        statusCondition: {
          name,
          duration,
        },
      });
    }
  }

  if (!effects.length) {
    const utilityTypeRaw = isNilish(vars['Utility Type']) ? 'other' : normalizeWhitespace(vars['Utility Type']).toLowerCase();
    const utilityType =
      utilityTypeRaw === 'creation' ? 'creation'
        : utilityTypeRaw === 'information' ? 'information'
          : utilityTypeRaw === 'communication' ? 'communication'
            : utilityTypeRaw === 'scouting' ? 'sensory'
              : utilityTypeRaw === 'illusion' ? 'sensory'
                : utilityTypeRaw === 'environmental_control' ? 'control'
                  : utilityTypeRaw === 'warding' ? 'control'
                    : 'other';
    const desc = isNilish(vars['Description']) ? 'See description.' : String(vars['Description']);
    effects.push({
      type: 'UTILITY',
      trigger: baseTrigger,
      condition: { type: 'always' as const },
      utilityType,
      description: desc,
    });
  }

  return effects;
};

const parseReferenceVars = (markdown: string): ReferenceVars => {
  const vars: ReferenceVars = {};
  const lines = markdown.split(/\r?\n/);
  let started = false;

  for (const line of lines) {
    const match = /^\-\s+\*\*([^*]+)\*\*:\s*(.*)$/.exec(line);
    if (!match) {
      if (started && line.trim() === '---') break;
      continue;
    }

    started = true;
    const key = match[1].trim();
    const value = (match[2] ?? '').trim();
    vars[key] = value;

    if (key === 'Status') break;
  }

  return vars;
};

const parseReferenceTitle = (markdown: string) => {
  const lines = markdown.split(/\r?\n/);
  for (const line of lines) {
    const m = /^#\s+(.+)\s*$/.exec(line);
    if (m) return m[1].trim();
  }
  return undefined;
};

const updateSpellFromReference = (spell: any, vars: ReferenceVars) => {
  // Identity + metadata
  if (!isNilish(vars['School'])) spell.school = toTitleCase(vars['School']);
  if (!isNilish(vars['Source'])) spell.source = vars['Source'];
  const ritual = parseBoolean(vars['Ritual']);
  if (ritual != null) spell.ritual = ritual;

  if (!isNilish(vars['Classes'])) {
    const raw = vars['Classes'];
    const normalized = normalizeWhitespace(String(raw)).toLowerCase();
    if (normalized === 'all') {
      spell.classes = Object.values(CLASSES_DATA).map(c => c.name);
    } else {
      spell.classes = splitCsvLike(String(raw)).map(s => s.trim()).filter(Boolean);
    }
  }

  // Casting time
  const castingValue = parseNumber(vars['Casting Time Value']);
  const castingUnit = normalizeCastingUnit(vars['Casting Time Unit']);
  if (castingValue != null && castingUnit) {
    spell.castingTime = spell.castingTime ?? {};
    spell.castingTime.value = castingValue;
    spell.castingTime.unit = castingUnit;

    if (castingUnit === 'minute' || castingUnit === 'hour') {
      spell.castingTime.explorationCost = { value: castingValue, unit: castingUnit };
    } else {
      delete spell.castingTime.explorationCost;
    }

    const combatCost = normalizeCombatCost(vars['Combat Cost']);
    if (combatCost) {
      spell.castingTime.combatCost = { type: combatCost };
      const reactionTrigger = vars['Reaction Trigger'];
      if (combatCost === 'reaction' && !isNilish(reactionTrigger)) {
        spell.castingTime.combatCost.condition = reactionTrigger;
      }
    } else {
      delete spell.castingTime.combatCost;
    }
  }

  // Range
  const rangeType = normalizeRangeType(vars['Range Type']);
  const rangeDistance = parseNumber(vars['Range Distance']);
  const rangeUnit = isNilish(vars['Range Unit']) ? undefined : normalizeWhitespace(vars['Range Unit']).toLowerCase();

  if (rangeType) {
    spell.range = spell.range ?? {};
    spell.range.type = rangeType;

    if (rangeType === 'ranged' && rangeDistance != null) {
      let distanceFeet = rangeDistance;
      if (rangeUnit === 'mile' || rangeUnit === 'miles') distanceFeet = rangeDistance * 5280;
      spell.range.distance = distanceFeet;
    } else {
      delete spell.range.distance;
    }
  }

  // Components
  const verbal = parseBoolean(vars['Verbal']);
  const somatic = parseBoolean(vars['Somatic']);
  const material = parseBoolean(vars['Material']);
  if (verbal != null || somatic !=null || material != null) {
    spell.components = spell.components ?? {};
    if (verbal != null) spell.components.verbal = verbal;
    if (somatic != null) spell.components.somatic = somatic;
    if (material != null) spell.components.material = material;

    if (material) {
      if (!isNilish(vars['Material Description'])) spell.components.materialDescription = vars['Material Description'];
      const cost = parseNumber(vars['Material Cost GP']);
      if (cost != null && cost > 0) spell.components.materialCost = cost;
      else delete spell.components.materialCost;
      const consumed = parseBoolean(vars['Consumed']);
      if (consumed != null) spell.components.isConsumed = consumed;
    } else {
      delete spell.components.materialDescription;
      delete spell.components.materialCost;
      delete spell.components.isConsumed;
    }
  }

  // Duration
  const durationType = normalizeDurationType(vars['Duration Type']);
  const durationValue = parseNumber(vars['Duration Value']);
  const durationUnit = normalizeDurationUnit(vars['Duration Unit']);
  const concentration = parseBoolean(vars['Concentration']);
  if (durationType) {
    spell.duration = spell.duration ?? {};
    spell.duration.type = durationType;
    spell.duration.concentration = concentration ?? false;

    if (durationType === 'timed' && durationValue != null && durationUnit) {
      spell.duration.value = durationValue;
      spell.duration.unit = durationUnit;
    } else {
      delete spell.duration.value;
      delete spell.duration.unit;
    }
  }

  // Targeting
  const targetingType = normalizeTargetingType(vars['Targeting Type'], vars);
  const { validTargets, filter } = parseValidTargets(vars['Valid Targets']);
  const lineOfSight = parseBoolean(vars['Line of Sight']);
  const maxTargets = parseNumber(vars['Targeting Max']);
  const areaShape = normalizeAoEShape(vars['Area Shape']);
  const areaSize = parseNumber(vars['Area Size']);
  const areaHeight = parseNumber(vars['Area Height']);

  spell.targeting = spell.targeting ?? {};
  if (targetingType) spell.targeting.type = targetingType;
  if (lineOfSight != null) spell.targeting.lineOfSight = lineOfSight;

  // Range is specified in feet for targeting
  if (spell.range?.type === 'ranged' && typeof spell.range?.distance === 'number') {
    spell.targeting.range = spell.range.distance;
  } else if (spell.range?.type === 'touch') {
    spell.targeting.range = 0;
  } else if (spell.range?.type === 'self') {
    delete spell.targeting.range;
  }

  if (maxTargets != null) spell.targeting.maxTargets = maxTargets;
  else delete spell.targeting.maxTargets;

  if (validTargets.length) {
    spell.targeting.validTargets = validTargets;
  } else if (spell.targeting.type === 'self') {
    spell.targeting.validTargets = ['self'];
  } else {
    // Keep existing if reference gives no usable target hint.
    spell.targeting.validTargets = Array.isArray(spell.targeting.validTargets) ? spell.targeting.validTargets : ['creatures'];
  }

  if (filter?.creatureTypes?.length) {
    spell.targeting.filter = spell.targeting.filter ?? {};
    spell.targeting.filter.creatureTypes = filter.creatureTypes;
  } else if (spell.targeting?.filter?.creatureTypes) {
    delete spell.targeting.filter.creatureTypes;
    if (Object.keys(spell.targeting.filter).length === 0) delete spell.targeting.filter;
  }

  if (areaShape && areaSize != null && areaSize > 0) {
    spell.targeting.areaOfEffect = { shape: areaShape, size: areaSize };
    if (areaHeight != null && areaHeight > 0) spell.targeting.areaOfEffect.height = areaHeight;
  } else {
    delete spell.targeting.areaOfEffect;
  }

  // Description / Higher Levels
  if (!isNilish(vars['Description'])) spell.description = vars['Description'];
  if (!isNilish(vars['Higher Levels']) && String(vars['Higher Levels']).trim().toLowerCase() !== 'none') {
    spell.higherLevels = vars['Higher Levels'];
  } else {
    delete spell.higherLevels;
  }

  // Mark complete
  const status = isNilish(vars['Status']) ? undefined : normalizeWhitespace(vars['Status']).toLowerCase();
  if (status === 'complete') {
    spell.legacy = false;
    if (Array.isArray(spell.tags)) spell.tags = spell.tags.filter((t: any) => t !== 'legacy');
  }

  // Effects (conservative: only regenerate when clearly still legacy/placeholder)
  if (shouldRegenerateEffects(spell)) {
    spell.effects = buildEffectsFromReference(vars);
  }
};

const main = async () => {
  const args = new Set(process.argv.slice(2));
  const dryRun = args.has('--dry-run');
  const onlyLevelArg = process.argv.find(a => a.startsWith('--level='));
  const onlyLevel = onlyLevelArg ? Number(onlyLevelArg.split('=')[1]) : undefined;

  const levels = Number.isFinite(onlyLevel) ? [onlyLevel!] : LEVELS_DESC;

  let updated = 0;
  let skippedMissingSpell = 0;
  let failedValidation = 0;

  for (const level of levels) {
    const refDir = path.join(REFERENCE_ROOT, `level-${level}`);
    if (!fs.existsSync(refDir)) continue;

    const refFiles = fs.readdirSync(refDir).filter(f => f.endsWith('.md')).sort();
    for (const fileName of refFiles) {
      const id = path.basename(fileName, '.md');
      const spellPath = path.join(SPELLS_ROOT, `level-${level}`, `${id}.json`);
      const refMd = fs.readFileSync(path.join(refDir, fileName), 'utf8');
      const title = parseReferenceTitle(refMd);
      const vars = parseReferenceVars(refMd);

      let spell: any;
      if (fs.existsSync(spellPath)) {
        const spellRaw = fs.readFileSync(spellPath, 'utf8');
        spell = JSON.parse(spellRaw);
      } else {
        skippedMissingSpell++;
        console.warn(`[missing] ${id} (level ${level}): creating ${path.relative(process.cwd(), spellPath)}`);

        spell = {
          id,
          name: title ?? toTitleCase(id.replace(/-/g, ' ')),
          level,
          school: 'Evocation',
          classes: [],
          ritual: false,
          castingTime: { value: 1, unit: 'action', combatCost: { type: 'action' } },
          range: { type: 'ranged', distance: 0 },
          components: { verbal: true, somatic: true, material: false },
          duration: { type: 'instantaneous', concentration: false },
          targeting: { type: 'single', range: 0, validTargets: ['creatures'], lineOfSight: true },
          effects: [
            {
              type: 'UTILITY',
              trigger: { type: 'immediate' },
              condition: { type: 'always' },
              utilityType: 'other',
              description: 'See description.',
            },
          ],
          description: title ?? '',
        };
      }

      if (title && !spell.name) spell.name = title;

      updateSpellFromReference(spell, vars);

      const validation = SpellValidator.safeParse(spell);
      if (!validation.success) {
        failedValidation++;
        console.warn(`[invalid] ${id} (level ${level})`);
        console.warn(validation.error.issues.map(i => `  - ${i.path.join('.')}: ${i.message}`).join('\n'));
        continue;
      }

      if (!dryRun) {
        fs.mkdirSync(path.dirname(spellPath), { recursive: true });
        fs.writeFileSync(spellPath, JSON.stringify(spell, null, 2) + '\n', 'utf8');
      }
      updated++;
    }
  }

  console.log(
    `Done. Updated: ${updated}. Missing spell json: ${skippedMissingSpell}. Validation failures: ${failedValidation}.` +
    (dryRun ? ' (dry-run)' : '')
  );
};

main().catch(err => {
  console.error(err);
  process.exitCode = 1;
});
