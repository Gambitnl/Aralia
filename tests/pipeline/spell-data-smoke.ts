// This file validates all spell data files to ensure they have the correct structure and values.
// It's a "smoke test" - a quick check to catch obvious data problems before they cause issues in the game.

import fs from 'fs'
import path from 'path'

// Type definition: Each result contains a file name and a list of issues found in that file
type Result = { file: string; issues: string[] }

// Build the path to the spells directory (public/data/spells)
const spellsDir = path.join(process.cwd(), 'public', 'data', 'spells')

// Define which fields every spell JSON file must have at the top level
const requiredTopLevel = ['id', 'name', 'level', 'school', 'classes', 'castingTime', 'range', 'components', 'duration', 'targeting', 'effects']

// Define which fields every effect object must have
const requiredEffectFields = ['type', 'trigger', 'condition']

// Define the valid casting time units (must be lowercase)
const allowedCastingUnits = new Set(['action', 'bonus_action', 'reaction', 'minute', 'hour'])

// Define the valid effect types (must be UPPERCASE)
const allowedEffectTypes = new Set(['DAMAGE', 'HEALING', 'DEFENSIVE', 'STATUS_CONDITION', 'MOVEMENT', 'SUMMONING', 'TERRAIN', 'UTILITY'])

function main() {
  // First, verify that the spells directory exists
  if (!fs.existsSync(spellsDir)) {
    console.error(`Missing spells directory: ${spellsDir}`)
    process.exit(1) // Exit with error code 1 if directory is missing
  }

  // This array will store all the problems we find across all spell files
  const results: Result[] = []

  // Helper function: Recursively search through directories to find all spell JSON files
  // This is needed because spells are organized in subdirectories (level-0, level-1, etc.)
  const findSpellFiles = (dir: string): string[] => {
    // Read all entries (files and folders) in this directory
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    const files: string[] = []

    // Loop through each entry
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)

      // If it's a directory, recursively search inside it
      if (entry.isDirectory()) {
        files.push(...findSpellFiles(fullPath))
      }
      // If it's a JSON file, add it to our list
      else if (entry.name.endsWith('.json')) {
        files.push(fullPath)
      }
    }
    return files
  }

  // Get all spell JSON files from the spells directory and its subdirectories
  const spellFiles = findSpellFiles(spellsDir)

  // Loop through every spell file we found
  for (const full of spellFiles) {
    // Get just the relative path (e.g., "level-0/fire-bolt.json") for cleaner error messages
    const file = path.relative(spellsDir, full)

    try {
      // Read and parse the JSON file
      const json = JSON.parse(fs.readFileSync(full, 'utf8'))

      // Track any problems we find in this specific file
      const issues: string[] = []

      // Check 1: Verify all required top-level fields are present
      for (const key of requiredTopLevel) {
        if (!(key in json)) issues.push(`missing top-level field: ${key}`)
      }

      // Check 2: Verify castingTime.unit has valid casing/value
      // The "?." is optional chaining - it safely accesses unit even if castingTime is missing
      const unit = json.castingTime?.unit
      if (unit && !allowedCastingUnits.has(unit)) {
        issues.push(`castingTime.unit unexpected casing/value: ${unit}`)
      }

      // Check 3: Verify the effects array and its contents
      if (Array.isArray(json.effects)) {
        // Loop through each effect in the effects array
        // TODO(lint-intent): Replace any with the minimal test shape so the behavior stays explicit.
        json.effects.forEach((e: unknown, idx: number) => {
          // Check that each effect has all required fields
          for (const key of requiredEffectFields) {
            if (!(key in e)) issues.push(`effects[${idx}] missing ${key}`)
          }
          // Check that the effect type is one of the allowed values
          if (e.type && !allowedEffectTypes.has(e.type)) {
            issues.push(`effects[${idx}].type unexpected casing/value: ${e.type}`)
          }
        })
      } else {
        // If effects is not an array, that's a problem
        issues.push('effects not an array')
      }

      // If we found any issues, add them to the results
      if (issues.length > 0) {
        results.push({ file, issues })
      }

    // TODO(lint-intent): Replace any with the minimal test shape so the behavior stays explicit.
    } catch (err: unknown) {
      // If the JSON file couldn't be parsed, record that as an issue
      results.push({ file, issues: [`failed to parse JSON: ${err.message}`] })
    }
  }

  // Report the results
  if (results.length === 0) {
    // Success! All spells passed validation
    console.log(`Spell data smoke: ✅ all ${spellFiles.length} spells passed`)
    return
  }

  // If we found issues, print them out
  console.error('Spell data smoke: issues found')
  for (const r of results) {
    console.error(`- ${r.file}:`)
    r.issues.forEach(issue => console.error(`  • ${issue}`))
  }

  // Exit with error code 1 to signal the test failed
  process.exit(1)
}

// Run the main function when this script is executed
main()
