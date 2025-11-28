# Spell System - Data Validation & Tooling Strategy

**Purpose:** Ensure all spell JSON files conform to the TypeScript schema and catch errors at build time, not runtime.

---

## Problem Statement

Without validation:
- ❌ Agents create spell JSONs with missing required fields
- ❌ Typos in field names (e.g., `damageType: "Fier"` instead of `"Fire"`)
- ❌ Wrong data types (e.g., `level: "3"` instead of `level: 3`)
- ❌ Invalid enum values (e.g., `school: "Pyromancy"` instead of `"Evocation"`)
- ❌ Inconsistent structure across 100+ spell files
- ❌ Runtime errors discovered only when spell is cast

---

## Solution: Multi-Layer Validation

### Layer 1: JSON Schema (Build-Time)
### Layer 2: Zod Runtime Validation (Load-Time)
### Layer 3: TypeScript Type Guards (Runtime)
### Layer 4: CLI Tooling (Dev-Time)

---

## Layer 1: JSON Schema Validation

**Location:** `src/systems/spells/schema/spell.schema.json`

Generate JSON Schema from TypeScript types, then validate all spell files at build time.

### Implementation

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "Spell",
  "type": "object",
  "required": ["id", "name", "level", "school", "castingTime", "range", "components", "duration", "targeting", "effects"],
  "properties": {
    "id": {
      "type": "string",
      "pattern": "^[a-z0-9-]+$",
      "description": "Unique identifier (kebab-case)"
    },
    "name": {
      "type": "string",
      "minLength": 1
    },
    "level": {
      "type": "integer",
      "minimum": 0,
      "maximum": 9,
      "description": "0 = Cantrip"
    },
    "school": {
      "type": "string",
      "enum": ["Abjuration", "Conjuration", "Divination", "Enchantment", "Evocation", "Illusion", "Necromancy", "Transmutation"]
    },
    "classes": {
      "type": "array",
      "items": {
        "type": "string",
        "enum": ["Bard", "Cleric", "Druid", "Paladin", "Ranger", "Sorcerer", "Warlock", "Wizard"]
      }
    },
    "castingTime": {
      "type": "object",
      "required": ["value", "unit"],
      "properties": {
        "value": { "type": "integer", "minimum": 1 },
        "unit": {
          "type": "string",
          "enum": ["action", "bonus_action", "reaction", "minute", "hour"]
        },
        "condition": { "type": "string" },
        "combatCost": {
          "type": "object",
          "properties": {
            "type": {
              "enum": ["action", "bonus_action", "reaction"]
            },
            "condition": { "type": "string" }
          }
        },
        "explorationCost": {
          "type": "object",
          "required": ["type", "duration"],
          "properties": {
            "type": {
              "enum": ["minutes", "hours"]
            },
            "duration": { "type": "integer", "minimum": 1 }
          }
        }
      }
    },
    "range": {
      "oneOf": [
        {
          "type": "object",
          "required": ["type"],
          "properties": {
            "type": { "const": "self" }
          }
        },
        {
          "type": "object",
          "required": ["type"],
          "properties": {
            "type": { "const": "touch" }
          }
        },
        {
          "type": "object",
          "required": ["type", "distance"],
          "properties": {
            "type": { "const": "ranged" },
            "distance": { "type": "integer", "minimum": 1 }
          }
        }
      ]
    },
    "components": {
      "type": "object",
      "required": ["verbal", "somatic"],
      "properties": {
        "verbal": { "type": "boolean" },
        "somatic": { "type": "boolean" },
        "material": { "type": "boolean" },
        "materialDescription": { "type": "string" },
        "materialCost": { "type": "integer" },
        "materialConsumed": { "type": "boolean" }
      }
    },
    "duration": {
      "type": "object",
      "required": ["type", "concentration"],
      "properties": {
        "type": {
          "enum": ["instantaneous", "timed", "special"]
        },
        "value": { "type": "integer" },
        "unit": {
          "enum": ["round", "minute", "hour", "day"]
        },
        "concentration": { "type": "boolean" }
      }
    },
    "targeting": {
      "oneOf": [
        {
          "type": "object",
          "required": ["type"],
          "properties": {
            "type": { "const": "self" }
          }
        },
        {
          "type": "object",
          "required": ["type", "range", "validTargets"],
          "properties": {
            "type": { "const": "single" },
            "range": { "type": "integer" },
            "validTargets": {
              "type": "object",
              "required": ["type"],
              "properties": {
                "type": {
                  "enum": ["creatures", "objects", "any", "allies", "enemies"]
                }
              }
            }
          }
        },
        {
          "type": "object",
          "required": ["type", "range", "areaOfEffect"],
          "properties": {
            "type": { "const": "area" },
            "range": { "type": "integer" },
            "areaOfEffect": {
              "type": "object",
              "required": ["shape", "size"],
              "properties": {
                "shape": {
                  "enum": ["Cone", "Cube", "Sphere", "Line", "Cylinder"]
                },
                "size": { "type": "integer", "minimum": 1 }
              }
            }
          }
        }
      ]
    },
    "effects": {
      "type": "array",
      "minItems": 1,
      "items": {
        "oneOf": [
          {
            "type": "object",
            "required": ["type", "subtype", "damage"],
            "properties": {
              "type": { "const": "DAMAGE" },
              "subtype": {
                "enum": ["direct", "area", "over_time", "triggered"]
              },
              "damage": {
                "type": "object",
                "required": ["dice", "type"],
                "properties": {
                  "dice": {
                    "type": "string",
                    "pattern": "^\\d+d\\d+([+-]\\d+)?$"
                  },
                  "type": {
                    "enum": ["Acid", "Bludgeoning", "Cold", "Fire", "Force", "Lightning", "Necrotic", "Piercing", "Poison", "Psychic", "Radiant", "Slashing", "Thunder"]
                  }
                }
              },
              "saveType": {
                "enum": ["Strength", "Dexterity", "Constitution", "Intelligence", "Wisdom", "Charisma"]
              },
              "saveEffect": {
                "enum": ["none", "half", "negate"]
              },
              "scaling": {
                "type": "object",
                "required": ["type"],
                "properties": {
                  "type": {
                    "enum": ["slot_level", "character_level"]
                  },
                  "bonusPerLevel": { "type": "string" }
                }
              }
            }
          },
          {
            "type": "object",
            "required": ["type", "healing"],
            "properties": {
              "type": { "const": "HEALING" },
              "healing": {
                "type": "object",
                "required": ["dice"],
                "properties": {
                  "dice": {
                    "type": "string",
                    "pattern": "^\\d+d\\d+([+-]\\d+)?$"
                  }
                }
              }
            }
          }
        ]
      }
    },
    "arbitrationType": {
      "enum": ["mechanical", "ai_assisted", "ai_dm"]
    },
    "description": {
      "type": "string",
      "minLength": 1
    },
    "higherLevels": {
      "type": "string"
    },
    "tags": {
      "type": "array",
      "items": { "type": "string" }
    }
  }
}
```

### Build Script

```typescript
// scripts/validate-spells.ts
import Ajv from 'ajv'
import * as fs from 'fs'
import * as path from 'path'
import spellSchema from '../src/systems/spells/schema/spell.schema.json'

const ajv = new Ajv({ allErrors: true })
const validate = ajv.compile(spellSchema)

const spellsDir = path.join(__dirname, '../src/systems/spells/data')
const errors: string[] = []

// Recursively validate all JSON files
function validateDirectory(dir: string) {
  const files = fs.readdirSync(dir)

  for (const file of files) {
    const filePath = path.join(dir, file)
    const stat = fs.statSync(filePath)

    if (stat.isDirectory()) {
      validateDirectory(filePath)
    } else if (file.endsWith('.json')) {
      const spellData = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
      const valid = validate(spellData)

      if (!valid) {
        errors.push(`\n❌ ${filePath}:`)
        validate.errors?.forEach(err => {
          errors.push(`   ${err.instancePath} ${err.message}`)
        })
      } else {
        console.log(`✅ ${filePath}`)
      }
    }
  }
}

validateDirectory(spellsDir)

if (errors.length > 0) {
  console.error('\n🚨 SPELL VALIDATION FAILED:\n')
  errors.forEach(err => console.error(err))
  process.exit(1)
} else {
  console.log('\n✅ All spells validated successfully!')
}
```

### Add to package.json

```json
{
  "scripts": {
    "validate:spells": "tsx scripts/validate-spells.ts",
    "build": "npm run validate:spells && vite build"
  }
}
```

---

## Layer 2: Zod Runtime Validation

**Location:** `src/systems/spells/validation/spellValidator.ts`

Use Zod for runtime validation with better error messages.

```typescript
import { z } from 'zod'

// Define Zod schema (mirrors TypeScript types)
const DamageTypeSchema = z.enum([
  'Acid', 'Bludgeoning', 'Cold', 'Fire', 'Force', 'Lightning',
  'Necrotic', 'Piercing', 'Poison', 'Psychic', 'Radiant', 'Slashing', 'Thunder'
])

const SavingThrowSchema = z.enum([
  'Strength', 'Dexterity', 'Constitution', 'Intelligence', 'Wisdom', 'Charisma'
])

const DamageEffectSchema = z.object({
  type: z.literal('DAMAGE'),
  subtype: z.enum(['direct', 'area', 'over_time', 'triggered']),
  damage: z.object({
    dice: z.string().regex(/^\d+d\d+([+-]\d+)?$/, 'Invalid dice format (e.g., 3d6, 1d8+2)'),
    type: DamageTypeSchema
  }),
  saveType: SavingThrowSchema.optional(),
  saveEffect: z.enum(['none', 'half', 'negate']).optional(),
  scaling: z.object({
    type: z.enum(['slot_level', 'character_level']),
    bonusPerLevel: z.string()
  }).optional()
})

const HealingEffectSchema = z.object({
  type: z.literal('HEALING'),
  healing: z.object({
    dice: z.string().regex(/^\d+d\d+([+-]\d+)?$/)
  }),
  scaling: z.object({
    type: z.enum(['slot_level', 'character_level']),
    bonusPerLevel: z.string()
  }).optional()
})

const SpellEffectSchema = z.discriminatedUnion('type', [
  DamageEffectSchema,
  HealingEffectSchema,
  // ... other effect types
])

const SpellSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().min(1),
  level: z.number().int().min(0).max(9),
  school: z.enum(['Abjuration', 'Conjuration', 'Divination', 'Enchantment', 'Evocation', 'Illusion', 'Necromancy', 'Transmutation']),
  classes: z.array(z.enum(['Bard', 'Cleric', 'Druid', 'Paladin', 'Ranger', 'Sorcerer', 'Warlock', 'Wizard'])),
  castingTime: z.object({
    value: z.number().int().positive(),
    unit: z.enum(['action', 'bonus_action', 'reaction', 'minute', 'hour'])
  }),
  // ... all other fields
  targeting: z.discriminatedUnion('type', [
    z.object({ type: z.literal('self') }),
    z.object({
      type: z.literal('single'),
      range: z.number().int().positive(),
      validTargets: z.object({
        type: z.enum(['creatures', 'objects', 'any', 'allies', 'enemies'])
      })
    }),
    z.object({
      type: z.literal('area'),
      range: z.number().int().positive(),
      areaOfEffect: z.object({
        shape: z.enum(['Cone', 'Cube', 'Sphere', 'Line', 'Cylinder']),
        size: z.number().int().positive()
      })
    })
  ]),
  effects: z.array(SpellEffectSchema).min(1),
  arbitrationType: z.enum(['mechanical', 'ai_assisted', 'ai_dm']).optional(),
  description: z.string().min(1),
  higherLevels: z.string().optional(),
  tags: z.array(z.string()).optional()
})

export type ValidatedSpell = z.infer<typeof SpellSchema>

/**
 * Validate a spell object at runtime
 * Throws ZodError with detailed validation errors
 */
export function validateSpell(data: unknown): ValidatedSpell {
  return SpellSchema.parse(data)
}

/**
 * Safe validation that returns errors instead of throwing
 */
export function validateSpellSafe(data: unknown):
  | { success: true; data: ValidatedSpell }
  | { success: false; errors: string[] }
{
  const result = SpellSchema.safeParse(data)

  if (result.success) {
    return { success: true, data: result.data }
  } else {
    return {
      success: false,
      errors: result.error.errors.map(err => `${err.path.join('.')}: ${err.message}`)
    }
  }
}
```

### Usage in Spell Loader

```typescript
// src/systems/spells/data/spellLoader.ts
import { validateSpell } from '../validation/spellValidator'
import type { Spell } from '../types'

/**
 * Load and validate a spell from JSON
 */
export async function loadSpell(spellId: string): Promise<Spell> {
  const spellData = await import(`./cantrips/${spellId}.json`)

  // Runtime validation
  const validatedSpell = validateSpell(spellData.default)

  return validatedSpell as Spell
}

/**
 * Load all spells from a directory with validation
 */
export async function loadAllSpells(): Promise<Spell[]> {
  const spells: Spell[] = []
  const errors: { file: string; errors: string[] }[] = []

  const spellFiles = import.meta.glob('./cantrips/*.json', { eager: false })

  for (const [path, loader] of Object.entries(spellFiles)) {
    try {
      const data = await loader()
      const validated = validateSpell((data as any).default)
      spells.push(validated as Spell)
    } catch (error) {
      if (error instanceof z.ZodError) {
        errors.push({
          file: path,
          errors: error.errors.map(e => `${e.path.join('.')}: ${e.message}`)
        })
      }
    }
  }

  if (errors.length > 0) {
    console.error('🚨 Spell validation errors:', errors)
    // In dev: throw, in prod: skip invalid spells
    if (import.meta.env.DEV) {
      throw new Error(`Failed to load ${errors.length} spells`)
    }
  }

  return spells
}
```

---

## Layer 3: CLI Tooling for Agents

**Location:** `scripts/spell-wizard.ts`

Interactive CLI to help agents create correctly-structured spell files.

```typescript
#!/usr/bin/env node
import prompts from 'prompts'
import * as fs from 'fs'
import * as path from 'path'

interface SpellWizardAnswers {
  id: string
  name: string
  level: number
  school: string
  targetingType: string
  effectType: string
  // ... all other fields
}

async function runSpellWizard() {
  console.log('🧙 Spell Creation Wizard\n')

  const answers = await prompts([
    {
      type: 'text',
      name: 'id',
      message: 'Spell ID (kebab-case):',
      validate: (value: string) => /^[a-z0-9-]+$/.test(value) || 'Must be kebab-case (e.g., acid-splash)'
    },
    {
      type: 'text',
      name: 'name',
      message: 'Spell Name:',
      validate: (value: string) => value.length > 0 || 'Name is required'
    },
    {
      type: 'number',
      name: 'level',
      message: 'Spell Level (0-9):',
      validate: (value: number) => (value >= 0 && value <= 9) || 'Must be 0-9'
    },
    {
      type: 'select',
      name: 'school',
      message: 'School of Magic:',
      choices: [
        { title: 'Abjuration', value: 'Abjuration' },
        { title: 'Conjuration', value: 'Conjuration' },
        { title: 'Divination', value: 'Divination' },
        { title: 'Enchantment', value: 'Enchantment' },
        { title: 'Evocation', value: 'Evocation' },
        { title: 'Illusion', value: 'Illusion' },
        { title: 'Necromancy', value: 'Necromancy' },
        { title: 'Transmutation', value: 'Transmutation' }
      ]
    },
    {
      type: 'select',
      name: 'targetingType',
      message: 'Targeting Type:',
      choices: [
        { title: 'Self', value: 'self' },
        { title: 'Single Target', value: 'single' },
        { title: 'Area of Effect', value: 'area' },
        { title: 'Multi-target (Magic Missile)', value: 'multi' }
      ]
    },
    {
      type: 'select',
      name: 'effectType',
      message: 'Primary Effect Type:',
      choices: [
        { title: 'Damage', value: 'DAMAGE' },
        { title: 'Healing', value: 'HEALING' },
        { title: 'Status Condition', value: 'STATUS_CONDITION' },
        { title: 'Movement', value: 'MOVEMENT' },
        { title: 'Summoning', value: 'SUMMONING' },
        { title: 'Terrain', value: 'TERRAIN' },
        { title: 'Utility', value: 'UTILITY' },
        { title: 'Defensive', value: 'DEFENSIVE' }
      ]
    },
    // Classes
    {
      type: 'multiselect',
      name: 'classes',
      message: 'Which classes can learn this spell?',
      choices: [
        { title: 'Bard', value: 'Bard' },
        { title: 'Cleric', value: 'Cleric' },
        { title: 'Druid', value: 'Druid' },
        { title: 'Paladin', value: 'Paladin' },
        { title: 'Ranger', value: 'Ranger' },
        { title: 'Sorcerer', value: 'Sorcerer' },
        { title: 'Warlock', value: 'Warlock' },
        { title: 'Wizard', value: 'Wizard' }
      ]
    },
    // Casting Time
    {
      type: 'select',
      name: 'castingTimeUnit',
      message: 'Casting time:',
      choices: [
        { title: '1 action', value: 'action' },
        { title: '1 bonus action', value: 'bonus_action' },
        { title: 'Reaction', value: 'reaction' },
        { title: 'Minutes', value: 'minute' },
        { title: 'Hours', value: 'hour' }
      ]
    },
    {
      type: (prev) => prev === 'minute' || prev === 'hour' ? 'number' : null,
      name: 'castingTimeValue',
      message: 'How many minutes/hours?',
      initial: 1
    },
    {
      type: (prev, values) => values.castingTimeUnit === 'reaction' ? 'text' : null,
      name: 'reactionCondition',
      message: 'Reaction trigger (e.g., "when you are hit"):',
      initial: 'when triggered'
    },
    // Range
    {
      type: (prev, values) => values.targetingType !== 'self' ? 'number' : null,
      name: 'range',
      message: 'Range in feet:',
      initial: 60
    },
    // Components
    {
      type: 'confirm',
      name: 'verbal',
      message: 'Requires verbal component?',
      initial: true
    },
    {
      type: 'confirm',
      name: 'somatic',
      message: 'Requires somatic component?',
      initial: true
    },
    {
      type: 'confirm',
      name: 'material',
      message: 'Requires material component?',
      initial: false
    },
    {
      type: (prev) => prev ? 'text' : null,
      name: 'materialDescription',
      message: 'Material component description:'
    },
    {
      type: (prev, values) => values.material ? 'number' : null,
      name: 'materialCost',
      message: 'Material cost in GP (0 if not consumed):',
      initial: 0
    },
    // Duration
    {
      type: 'select',
      name: 'durationType',
      message: 'Duration:',
      choices: [
        { title: 'Instantaneous', value: 'instantaneous' },
        { title: 'Timed (rounds/minutes/hours)', value: 'timed' },
        { title: 'Special', value: 'special' }
      ]
    },
    {
      type: (prev) => prev === 'timed' ? 'number' : null,
      name: 'durationValue',
      message: 'Duration value:',
      initial: 1
    },
    {
      type: (prev, values) => values.durationType === 'timed' ? 'select' : null,
      name: 'durationUnit',
      message: 'Duration unit:',
      choices: [
        { title: 'Rounds', value: 'round' },
        { title: 'Minutes', value: 'minute' },
        { title: 'Hours', value: 'hour' },
        { title: 'Days', value: 'day' }
      ]
    },
    {
      type: 'confirm',
      name: 'concentration',
      message: 'Requires concentration?',
      initial: false
    },
    // AoE (if area targeting)
    {
      type: (prev, values) => values.targetingType === 'area' ? 'select' : null,
      name: 'aoeShape',
      message: 'AoE shape:',
      choices: [
        { title: 'Cone', value: 'Cone' },
        { title: 'Cube', value: 'Cube' },
        { title: 'Sphere', value: 'Sphere' },
        { title: 'Line', value: 'Line' },
        { title: 'Cylinder', value: 'Cylinder' }
      ]
    },
    {
      type: (prev, values) => values.targetingType === 'area' ? 'number' : null,
      name: 'aoeSize',
      message: 'AoE size in feet:',
      initial: 20
    },
    // Damage effect details (if DAMAGE)
    {
      type: (prev, values) => values.effectType === 'DAMAGE' ? 'text' : null,
      name: 'damageDice',
      message: 'Damage dice (e.g., 3d6):',
      validate: (v) => /^\d+d\d+$/.test(v) || 'Format: XdY (e.g., 3d6)'
    },
    {
      type: (prev, values) => values.effectType === 'DAMAGE' ? 'select' : null,
      name: 'damageType',
      message: 'Damage type:',
      choices: [
        { title: 'Acid', value: 'Acid' },
        { title: 'Cold', value: 'Cold' },
        { title: 'Fire', value: 'Fire' },
        { title: 'Force', value: 'Force' },
        { title: 'Lightning', value: 'Lightning' },
        { title: 'Necrotic', value: 'Necrotic' },
        { title: 'Poison', value: 'Poison' },
        { title: 'Psychic', value: 'Psychic' },
        { title: 'Radiant', value: 'Radiant' },
        { title: 'Thunder', value: 'Thunder' }
      ]
    },
    {
      type: (prev, values) => values.effectType === 'DAMAGE' ? 'select' : null,
      name: 'saveType',
      message: 'Saving throw (or none):',
      choices: [
        { title: 'None (attack roll)', value: null },
        { title: 'Strength', value: 'Strength' },
        { title: 'Dexterity', value: 'Dexterity' },
        { title: 'Constitution', value: 'Constitution' },
        { title: 'Intelligence', value: 'Intelligence' },
        { title: 'Wisdom', value: 'Wisdom' },
        { title: 'Charisma', value: 'Charisma' }
      ]
    },
    {
      type: (prev, values) => values.saveType ? 'select' : null,
      name: 'saveEffect',
      message: 'On successful save:',
      choices: [
        { title: 'Half damage', value: 'half' },
        { title: 'Negate damage', value: 'negate' }
      ]
    },
    // Healing effect details (if HEALING)
    {
      type: (prev, values) => values.effectType === 'HEALING' ? 'text' : null,
      name: 'healingDice',
      message: 'Healing dice (e.g., 2d8):',
      validate: (v) => /^\d+d\d+$/.test(v) || 'Format: XdY (e.g., 2d8)'
    },
    {
      type: (prev, values) => values.effectType === 'HEALING' ? 'confirm' : null,
      name: 'addSpellcastingMod',
      message: 'Add spellcasting modifier to healing?',
      initial: true
    },
    // Scaling
    {
      type: (prev, values) => values.level > 0 ? 'confirm' : null,
      name: 'hasScaling',
      message: 'Does this spell scale when upcast?',
      initial: true
    },
    {
      type: (prev, values) => values.hasScaling ? 'text' : null,
      name: 'scalingBonus',
      message: 'Bonus per level (e.g., +1d6):',
      initial: '+1d6'
    },
    // Description
    {
      type: 'text',
      name: 'description',
      message: 'Spell description:',
      initial: 'TODO: Add description'
    }
  ])

  // Generate spell JSON
  const spell = {
    id: answers.id,
    name: answers.name,
    level: answers.level,
    school: answers.school,
    classes: answers.classes || [],
    castingTime: {
      value: answers.castingTimeValue || 1,
      unit: answers.castingTimeUnit,
      ...(answers.reactionCondition && { condition: answers.reactionCondition })
    },
    range: answers.targetingType === 'self'
      ? { type: 'self' }
      : { type: 'ranged', distance: answers.range || 60 },
    components: {
      verbal: answers.verbal ?? true,
      somatic: answers.somatic ?? true,
      material: answers.material ?? false,
      ...(answers.materialDescription && { materialDescription: answers.materialDescription }),
      ...(answers.materialCost && { materialCost: answers.materialCost })
    },
    duration: {
      type: answers.durationType,
      ...(answers.durationValue && { value: answers.durationValue }),
      ...(answers.durationUnit && { unit: answers.durationUnit }),
      concentration: answers.concentration ?? false
    },
    targeting: buildTargeting(answers),
    effects: buildEffects(answers),
    description: answers.description || 'TODO: Add description',
    ...(answers.hasScaling && { higherLevels: `When you cast this spell using a spell slot of ${answers.level + 1}th level or higher, the ${answers.effectType === 'DAMAGE' ? 'damage' : 'healing'} increases by ${answers.scalingBonus} for each slot level above ${answers.level}th.` })
  }

  // Validate before saving
  const validation = validateSpellSafe(spell)

  if (!validation.success) {
    console.error('\n❌ Generated spell failed validation:')
    validation.errors.forEach(err => console.error(`  - ${err}`))
    return
  }

  // Save to correct directory
  const dir = answers.level === 0
    ? 'src/systems/spells/data/cantrips'
    : `src/systems/spells/data/level-${answers.level}`

  const filePath = path.join(dir, `${answers.id}.json`)
  fs.writeFileSync(filePath, JSON.stringify(spell, null, 2))

  console.log(`\n✅ Spell created: ${filePath}`)
  console.log('⚠️  Remember to fill in TODO fields!')
}

function buildTargeting(answers: SpellWizardAnswers) {
  if (answers.targetingType === 'self') {
    return { type: 'self' }
  }

  if (answers.targetingType === 'single') {
    return {
      type: 'single',
      range: answers.range || 60,
      validTargets: { type: 'creatures' },
      lineOfSight: true
    }
  }

  if (answers.targetingType === 'multi') {
    return {
      type: 'multi',
      range: answers.range || 120,
      maxTargets: 3,  // Default for Magic Missile-like spells
      validTargets: { type: 'creatures' },
      lineOfSight: true
    }
  }

  if (answers.targetingType === 'area') {
    return {
      type: 'area',
      range: answers.range || 150,
      areaOfEffect: {
        shape: answers.aoeShape || 'Sphere',
        size: answers.aoeSize || 20
      },
      validTargets: { type: 'creatures' },
      lineOfSight: true
    }
  }

  // Default to self
  return { type: 'self' }
}

function buildEffects(answers: SpellWizardAnswers) {
  const effects = []

  if (answers.effectType === 'DAMAGE') {
    effects.push({
      type: 'DAMAGE',
      subtype: 'direct',
      damage: {
        dice: answers.damageDice || '1d6',
        type: answers.damageType || 'Force'
      },
      ...(answers.saveType && { saveType: answers.saveType }),
      ...(answers.saveEffect && { saveEffect: answers.saveEffect }),
      ...(answers.hasScaling && {
        scaling: {
          type: 'slot_level',
          bonusPerLevel: answers.scalingBonus || '+1d6'
        }
      })
    })
  }

  if (answers.effectType === 'HEALING') {
    effects.push({
      type: 'HEALING',
      healing: {
        dice: answers.healingDice || '2d8',
        addModifier: answers.addSpellcastingMod ?? true,
        modifierStat: 'spellcastingAbility'
      },
      ...(answers.hasScaling && {
        scaling: {
          type: 'slot_level',
          bonusPerLevel: answers.scalingBonus || '+1d8'
        }
      })
    })
  }

  if (answers.effectType === 'STATUS_CONDITION') {
    effects.push({
      type: 'STATUS_CONDITION',
      condition: {
        name: 'custom',
        customName: 'TODO: Specify condition name',
        duration: { type: 'rounds', value: 1 }
      }
    })
  }

  // Stubs for other effect types
  if (answers.effectType === 'MOVEMENT') {
    effects.push({
      type: 'MOVEMENT',
      movementType: 'teleport',
      distance: 30
    })
  }

  if (answers.effectType === 'SUMMONING') {
    effects.push({
      type: 'SUMMONING',
      creatureType: 'TODO: Specify creature',
      duration: { type: 'minutes', value: 10 }
    })
  }

  if (answers.effectType === 'TERRAIN') {
    effects.push({
      type: 'TERRAIN',
      terrainType: 'difficult',
      duration: { type: 'minutes', value: 1 }
    })
  }

  if (answers.effectType === 'UTILITY') {
    effects.push({
      type: 'UTILITY',
      utilityType: 'detect'
    })
  }

  if (answers.effectType === 'DEFENSIVE') {
    effects.push({
      type: 'DEFENSIVE',
      defensiveType: 'ac_bonus'
    })
  }

  return effects
}

runSpellWizard()
```

### Add to package.json

```json
{
  "scripts": {
    "spell:new": "tsx scripts/spell-wizard.ts",
    "spell:validate": "tsx scripts/validate-spells.ts"
  }
}
```

---

## Layer 4: Template Files

**Location:** `src/systems/spells/data/templates/`

Provide ready-to-use templates for common spell patterns.

### Template: Direct Damage Spell

```json
{
  "id": "TEMPLATE-damage-spell",
  "name": "Template: Direct Damage Spell",
  "level": 1,
  "school": "Evocation",
  "classes": ["Wizard", "Sorcerer"],
  "castingTime": {
    "value": 1,
    "unit": "action"
  },
  "range": {
    "type": "ranged",
    "distance": 120
  },
  "components": {
    "verbal": true,
    "somatic": true,
    "material": false
  },
  "duration": {
    "type": "instantaneous",
    "concentration": false
  },
  "targeting": {
    "type": "single",
    "range": 120,
    "validTargets": {
      "type": "creatures"
    },
    "lineOfSight": true
  },
  "effects": [
    {
      "type": "DAMAGE",
      "subtype": "direct",
      "damage": {
        "dice": "3d6",
        "type": "Fire"
      },
      "saveType": null,
      "saveEffect": "none",
      "scaling": {
        "type": "slot_level",
        "bonusPerLevel": "+1d6"
      }
    }
  ],
  "arbitrationType": "mechanical",
  "description": "TODO: Describe the spell effect",
  "higherLevels": "When you cast this spell using a spell slot of 2nd level or higher, the damage increases by 1d6 for each slot level above 1st."
}
```

### Template: Area Save Spell

```json
{
  "id": "TEMPLATE-area-save-spell",
  "name": "Template: Area Save Spell",
  "level": 3,
  "school": "Evocation",
  "classes": ["Wizard", "Sorcerer"],
  "castingTime": {
    "value": 1,
    "unit": "action"
  },
  "range": {
    "type": "ranged",
    "distance": 150
  },
  "components": {
    "verbal": true,
    "somatic": true,
    "material": true,
    "materialDescription": "TODO: Material components"
  },
  "duration": {
    "type": "instantaneous",
    "concentration": false
  },
  "targeting": {
    "type": "area",
    "range": 150,
    "areaOfEffect": {
      "shape": "Sphere",
      "size": 20
    },
    "validTargets": {
      "type": "creatures"
    },
    "lineOfSight": true
  },
  "effects": [
    {
      "type": "DAMAGE",
      "subtype": "area",
      "damage": {
        "dice": "8d6",
        "type": "Fire"
      },
      "saveType": "Dexterity",
      "saveEffect": "half",
      "scaling": {
        "type": "slot_level",
        "bonusPerLevel": "+1d6"
      }
    }
  ],
  "arbitrationType": "mechanical",
  "description": "TODO: Describe the spell effect",
  "higherLevels": "When you cast this spell using a spell slot of 4th level or higher, the damage increases by 1d6 for each slot level above 3rd."
}
```

### Template: Healing Spell

```json
{
  "id": "TEMPLATE-healing-spell",
  "name": "Template: Healing Spell",
  "level": 1,
  "school": "Evocation",
  "classes": ["Cleric", "Paladin"],
  "castingTime": {
    "value": 1,
    "unit": "action"
  },
  "range": {
    "type": "touch"
  },
  "components": {
    "verbal": true,
    "somatic": true,
    "material": false
  },
  "duration": {
    "type": "instantaneous",
    "concentration": false
  },
  "targeting": {
    "type": "single",
    "range": 5,
    "validTargets": {
      "type": "creatures"
    }
  },
  "effects": [
    {
      "type": "HEALING",
      "healing": {
        "dice": "1d8",
        "addModifier": true,
        "modifierStat": "spellcastingAbility"
      },
      "scaling": {
        "type": "slot_level",
        "bonusPerLevel": "+1d8"
      }
    }
  ],
  "arbitrationType": "mechanical",
  "description": "TODO: Describe the spell effect",
  "higherLevels": "When you cast this spell using a spell slot of 2nd level or higher, the healing increases by 1d8 for each slot level above 1st."
}
```

---

## Agent Workflow

### Creating a New Spell

```bash
# Option 1: Use wizard (recommended for beginners)
npm run spell:new

# Option 2: Copy template
cp src/systems/spells/data/templates/TEMPLATE-damage-spell.json \
   src/systems/spells/data/level-1/magic-missile.json

# Edit the file, then validate
npm run spell:validate

# If validation passes, commit
git add src/systems/spells/data/level-1/magic-missile.json
git commit -m "feat: add Magic Missile spell definition"
```

### Pre-Commit Hook

```bash
# .husky/pre-commit
#!/bin/sh
npm run spell:validate
```

---

## VSCode Integration

**Location:** `.vscode/settings.json`

```json
{
  "json.schemas": [
    {
      "fileMatch": ["src/systems/spells/data/**/*.json"],
      "url": "./src/systems/spells/schema/spell.schema.json"
    }
  ]
}
```

This enables:
- ✅ Autocomplete for spell fields
- ✅ Inline validation errors
- ✅ Hover tooltips for field descriptions

---

## Summary: Four-Layer Defense

| Layer | When | Catches | Tool |
|-------|------|---------|------|
| **JSON Schema** | Build time | Schema violations, typos | Ajv |
| **Zod Validation** | Load time | Runtime type mismatches | Zod |
| **TypeScript Types** | Compile time | Type errors in code | TSC |
| **CLI Wizard** | Dev time | Missing fields, wrong format | Prompts |

---

## Agent Checklist

When creating spell files, agents MUST:
- [ ] Use `npm run spell:new` wizard OR copy a template
- [ ] Fill in all TODO fields
- [ ] Run `npm run spell:validate` before committing
- [ ] Ensure VSCode shows no schema errors (red squiggles)
- [ ] Test loading the spell in-game
- [ ] Verify spell executes without runtime errors

---

## Future Enhancements

1. **Auto-generate spells from SRD data** - Scrape D&D Beyond and generate JSON
2. **Spell diff tool** - Compare two spell versions
3. **Spell migration tool** - Convert legacy format to new format
4. **Spell linter** - Check for common mistakes (e.g., damage too high for level)

---

**Next Steps:**
1. Agent Alpha creates JSON Schema + Zod validators
2. Add validation to build pipeline
3. Create templates for 8 common spell patterns
4. Build CLI wizard tool
5. Agents use tools to create spell files

**Last Updated:** November 28, 2025
