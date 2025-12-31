import fs from 'fs'
import path from 'path'

type Result = { file: string; issues: string[] }

const spellsDir = path.join(process.cwd(), 'public', 'data', 'spells')
const requiredTopLevel = ['id', 'name', 'level', 'school', 'classes', 'castingTime', 'range', 'components', 'duration', 'targeting', 'effects']
const requiredEffectFields = ['type', 'trigger', 'condition']
const allowedCastingUnits = new Set(['action', 'bonus_action', 'reaction', 'minute', 'hour'])
// TODO: Many cantrips fail due to casing mismatch (e.g., "Action" vs "action", "Damage" vs "DAMAGE").
// Either update spell JSON files to use lowercase/UPPERCASE consistently, or make validation case-insensitive.
// See: docs/tasks/testing-overhaul/00-MASTER-PLAN.md
const allowedEffectTypes = new Set(['DAMAGE', 'HEALING', 'DEFENSIVE', 'STATUS_CONDITION', 'MOVEMENT', 'SUMMONING', 'TERRAIN', 'UTILITY'])

function main() {
  if (!fs.existsSync(spellsDir)) {
    console.error(`Missing spells directory: ${spellsDir}`)
    process.exit(1)
  }

  const files = fs.readdirSync(spellsDir).filter(f => f.endsWith('.json'))
  const results: Result[] = []

  for (const file of files) {
    const full = path.join(spellsDir, file)
    try {
      const json = JSON.parse(fs.readFileSync(full, 'utf8'))

      // Only check cantrips (level 0)
      if (json.level !== 0) continue;

      const issues: string[] = []

      for (const key of requiredTopLevel) {
        if (!(key in json)) issues.push(`missing top-level field: ${key}`)
      }

      // castingTime.unit casing
      const unit = json.castingTime?.unit
      if (unit && !allowedCastingUnits.has(unit)) {
        issues.push(`castingTime.unit unexpected casing/value: ${unit}`)
      }

      // effects
      if (Array.isArray(json.effects)) {
        // TODO(lint-intent): Replace any with the minimal test shape so the behavior stays explicit.
        json.effects.forEach((e: unknown, idx: number) => {
          for (const key of requiredEffectFields) {
            if (!(key in e)) issues.push(`effects[${idx}] missing ${key}`)
          }
          if (e.type && !allowedEffectTypes.has(e.type)) {
            issues.push(`effects[${idx}].type unexpected casing/value: ${e.type}`)
          }
        })
      } else {
        issues.push('effects not an array')
      }

      if (issues.length > 0) {
        results.push({ file, issues })
      }
    // TODO(lint-intent): Replace any with the minimal test shape so the behavior stays explicit.
    } catch (err: unknown) {
      results.push({ file, issues: [`failed to parse JSON: ${err.message}`] })
    }
  }

  if (results.length === 0) {
    console.log('Spell data smoke: ✅ all level-0 spells passed')
    return
  }

  console.error('Spell data smoke: issues found')
  for (const r of results) {
    console.error(`- ${r.file}:`)
    r.issues.forEach(issue => console.error(`  • ${issue}`))
  }
  process.exit(1)
}

main()
