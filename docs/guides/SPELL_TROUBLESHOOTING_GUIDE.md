# Spell System Troubleshooting Guide

**Last Updated:** 2025-12-13  
**Purpose:** Quick reference for diagnosing and resolving common spell system issues

## Overview

This guide helps developers quickly identify and resolve typical problems encountered when working with the Aralia RPG spell system. Issues are organized by category with diagnostic steps and solutions.

## Validation and Data Issues

### Schema Validation Failures

#### Problem: `npm run validate:spells` fails with schema errors

**Common Error Messages:**
```
"Missing required field: effects"
"Invalid enum value: action"
"Effect missing trigger object"
```

**Diagnostic Steps:**
1. **Check required fields:**
   ```bash
   # Run detailed validation
   npm run validate:spells -- --verbose
   ```

2. **Verify spell structure:**
   - Ensure `effects` array exists with at least one effect
   - Confirm all enum values match approved lists
   - Check that each effect has `trigger` and `condition` objects

3. **Compare with examples:**
   ```bash
   # Check reference implementation
   cat docs/spells/SPELL_JSON_EXAMPLES.md
   ```

**Solutions:**
- Add missing `effects` array with proper structure
- Correct enum values to match schema (lowercase units, Title Case schools)
- Add required `trigger` and `condition` objects to all effects

#### Problem: TypeScript compilation errors

**Common Error Messages:**
```
"Property 'effects' is missing in type"
"Type 'string' is not assignable to type 'SpellSchool'"
```

**Diagnostic Steps:**
1. **Check type definitions:**
   ```bash
   npm run typecheck
   ```

2. **Verify against schema:**
   - Compare spell JSON with `src/types/spells.ts`
   - Check enum definitions match exactly
   - Ensure array/object structures are correct

**Solutions:**
- Update spell data to match TypeScript interfaces
- Use exact enum values from type definitions
- Fix structural mismatches between JSON and types

### File Structure Issues

#### Problem: Spell not appearing in game

**Diagnostic Steps:**
1. **Check file location:**
   ```bash
   # Verify correct directory
   ls public/data/spells/level-{N}/spell-name.json
   ```

2. **Check manifest entry:**
   ```bash
   # Search manifest
   grep "spell-name" public/data/spells_manifest.json
   ```

3. **Verify filename matches ID:**
   ```bash
   # Check ID field vs filename
   cat public/data/spells/level-1/spell-name.json | grep '"id"'
   ```

**Solutions:**
- Move file to correct level directory
- Add entry to `spells_manifest.json`
- Ensure filename exactly matches `id` field

#### Problem: Class access issues

**Common Symptoms:**
- Spell not appearing for expected classes
- Wrong classes can access spell
- Subclass access not working

**Diagnostic Steps:**
1. **Check class normalization:**
   ```bash
   # Verify class list
   cat public/data/spells/level-1/spell-name.json | grep "classes"
   ```

2. **Compare with approved list:**
   - Check against official subclass list in documentation
   - Verify uppercase formatting
   - Confirm subclass format `[BASE] - [SUBCLASS]`

**Solutions:**
- Normalize class names to approved list
- Use correct uppercase/base-subclass format
- Remove invalid or non-existent subclasses

## Integration Issues

### Character Creation Problems

#### Problem: Spell not showing in class spell list

**Diagnostic Steps:**
1. **Check class spell lists:**
   ```bash
   # Search class data files
   grep "spell-name" src/data/classes/*.ts
   ```

2. **Verify spell level requirements:**
   - Check character level vs spell level
   - Confirm class can access that spell level

3. **Test with clean character:**
   - Create new character of appropriate class
   - Navigate to spell selection step

**Solutions:**
- Add spell ID to appropriate class spell lists
- Verify level requirements are met
- Check for typos in spell IDs

#### Problem: Spell selection not working

**Common Error Messages:**
```
"Cannot add spell to character"
"Spell ID not found"
```

**Diagnostic Steps:**
1. **Check console for errors:**
   - Open browser developer tools
   - Look for JavaScript errors during selection

2. **Verify spell data loading:**
   ```bash
   # Check if spell service loads correctly
   console.log(SpellService.getAllSpells())
   ```

3. **Test spell individually:**
   - Try selecting different spells
   - Isolate if issue is specific to one spell

**Solutions:**
- Fix spell data structure issues
- Address service loading problems
- Correct any JavaScript runtime errors

### Combat System Issues

#### Problem: Spell not appearing in combat abilities

**Diagnostic Steps:**
1. **Check character spellbook:**
   ```javascript
   // In browser console
   console.log(currentCharacter.spellbook)
   ```

2. **Verify spell slot availability:**
   - Check if character has available spell slots
   - Confirm spell level vs slot level compatibility

3. **Test spell availability logic:**
   ```javascript
   // Check spell availability calculation
   console.log(isSpellAvailable(spell, character))
   ```

**Solutions:**
- Ensure spell is in character's known spells
- Verify spell slots are available
- Fix availability calculation logic

#### Problem: Spell casting fails silently

**Diagnostic Steps:**
1. **Enable debug logging:**
   ```javascript
   // Add temporary console logs
   console.log('Casting spell:', spellId)
   console.log('Character state:', character)
   ```

2. **Check ability system:**
   ```javascript
   // Verify ability creation
   console.log(createAbilityFromSpell(spell, character))
   ```

3. **Monitor network requests:**
   - Check for failed API calls
   - Verify Gemini integration if applicable

**Solutions:**
- Add proper error handling and user feedback
- Fix ability creation failures
- Address network/API connectivity issues

#### Problem: Spell effects not applying correctly

**Common Issues:**
- Damage calculations incorrect
- Status conditions not applying
- Duration tracking problems
- Target selection issues

**Diagnostic Steps:**
1. **Check effect execution:**
   ```javascript
   // Add logging to effect handlers
   console.log('Executing effect:', effect)
   console.log('Targets:', targets)
   ```

2. **Verify game state updates:**
   ```javascript
   // Monitor state changes
   console.log('Before effect:', gameState)
   // ... effect execution ...
   console.log('After effect:', gameState)
   ```

3. **Test with simple effects:**
   - Try basic damage spells first
   - Gradually test more complex effects
   - Isolate problematic components

**Solutions:**
- Fix effect handler logic
- Correct target selection algorithms
- Address state update mechanisms
- Implement proper duration tracking

## Performance Issues

### Slow Spell Loading

#### Problem: Long delays when accessing spells

**Diagnostic Steps:**
1. **Profile loading times:**
   ```javascript
   console.time('Spell Loading')
   // Spell loading code
   console.timeEnd('Spell Loading')
   ```

2. **Check bundle size:**
   ```bash
   npm run build
   # Check dist/ for spell-related asset sizes
   ```

3. **Monitor network requests:**
   - Use browser network tab
   - Identify slow-loading resources
   - Check for unnecessary requests

**Solutions:**
- Implement lazy loading for spell data
- Optimize JSON file sizes
- Add caching mechanisms
- Reduce redundant data fetching

### Memory Leaks

#### Problem: Memory usage grows during spell usage

**Diagnostic Steps:**
1. **Monitor memory consumption:**
   ```javascript
   // Periodic memory checks
   setInterval(() => {
     console.log('Memory usage:', performance.memory)
   }, 5000)
   ```

2. **Check for circular references:**
   - Review spell data structures
   - Look for retained references
   - Verify cleanup on component unmount

3. **Profile memory usage:**
   - Use browser memory profiler
   - Take heap snapshots
   - Compare before/after spell usage

**Solutions:**
- Implement proper cleanup in useEffect hooks
- Break circular references in data structures
- Use WeakMap for cache implementations
- Add memory leak detection in development

## User Interface Issues

### Spellbook Display Problems

#### Problem: Spells not displaying correctly

**Common Issues:**
- Missing spell information
- Incorrect formatting
- Layout problems
- Search/filter not working

**Diagnostic Steps:**
1. **Check rendered data:**
   ```javascript
   // Inspect component props
   console.log('Spellbook props:', this.props)
   ```

2. **Verify data flow:**
   - Trace data from spell service to component
   - Check for data transformation issues
   - Verify filtering/sorting logic

3. **Test with sample data:**
   - Use known good spell data
   - Test edge cases (empty lists, single items)
   - Check responsive design

**Solutions:**
- Fix data mapping and transformation
- Correct component rendering logic
- Implement proper error boundaries
- Add loading and empty states

### Targeting System Issues

#### Problem: Spell targeting not working correctly

**Common Issues:**
- Incorrect range display
- Invalid target selection allowed
- Area of effect visualization problems
- Line of sight checking failures

**Diagnostic Steps:**
1. **Check targeting data:**
   ```javascript
   console.log('Spell targeting:', spell.targeting)
   console.log('Character position:', character.position)
   ```

2. **Verify grid calculations:**
   - Test range calculations
   - Check AoE coverage algorithms
   - Validate line of sight logic

3. **Test edge cases:**
   - Maximum range scenarios
   - Corner positions
   - Multiple target situations

**Solutions:**
- Fix range calculation formulas
- Correct AoE coverage algorithms
- Implement proper validation
- Add visual feedback for targeting

## Debugging Tools and Techniques

### Console Debugging

```javascript
// Essential debugging utilities
const debugSpell = (spellId) => {
  const spell = SpellService.getSpellById(spellId)
  console.group(`Spell Debug: ${spellId}`)
  console.log('Raw data:', spell)
  console.log('Validation:', SpellValidator.safeParse(spell))
  console.log('Effects:', spell.effects)
  console.groupEnd()
}

// Usage
debugSpell('fire-bolt')
```

### Browser Developer Tools

#### Network Tab
- Monitor API calls for spell data
- Check for failed requests
- Analyze loading performance

#### Console Tab
- Enable verbose logging
- Monitor error messages
- Test spell functionality interactively

#### React DevTools
- Inspect component props and state
- Trace re-renders
- Monitor context values

### Automated Testing

```bash
# Run specific spell tests
npm run test -- src/hooks/__tests__/useSpellGateChecks.test.ts

# Validate specific spell data
npx tsx scripts/validate-single-spell.ts fire-bolt

# Check integration
npm run test:integration -- spells
```

## Common Resolution Patterns

### Quick Fixes Template

```markdown
## Issue: [Problem Description]

**Symptoms:** [Observable behaviors]

**Root Cause:** [Underlying issue]

**Quick Fix:**
1. [Step 1]
2. [Step 2]
3. [Step 3]

**Verification:**
- [ ] Test passes
- [ ] No regressions
- [ ] User feedback positive

**Prevention:**
- [ ] Add validation
- [ ] Update documentation
- [ ] Create test case
```

### Escalation Path

1. **Level 1 - Self Resolution:** Use this guide and documentation
2. **Level 2 - Peer Review:** Request code review from team members
3. **Level 3 - Lead Developer:** Escalate to project lead for complex issues
4. **Level 4 - Community Support:** Post in discussion forums for wider input

## Prevention Best Practices

### Before Making Changes
- [ ] Run full validation suite
- [ ] Check related documentation
- [ ] Consider impact on existing functionality
- [ ] Plan testing approach

### During Development
- [ ] Commit frequently with descriptive messages
- [ ] Test iteratively as you build
- [ ] Document assumptions and decisions
- [ ] Seek feedback on complex changes

### After Implementation
- [ ] Run complete test suite
- [ ] Update relevant documentation
- [ ] Add to regression test coverage
- [ ] Monitor for issues in development

## Emergency Procedures

### Critical System Failure
If the entire spell system becomes non-functional:

1. **Immediate rollback:**
   ```bash
   git checkout HEAD~1 -- src/systems/spells/
   ```

2. **Isolate the issue:**
   - Identify last working commit
   - Narrow down problematic changes
   - Create minimal reproduction case

3. **Restore functionality:**
   - Revert breaking changes
   - Implement fix incrementally
   - Verify each step thoroughly

### Data Corruption
If spell data becomes corrupted:

1. **Backup current state:**
   ```bash
   cp -r public/data/spells/ ~/spells-backup-$(date +%s)/
   ```

2. **Restore from version control:**
   ```bash
   git checkout HEAD -- public/data/spells/
   ```

3. **Validate restoration:**
   ```bash
   npm run validate:spells
   npm run build
   ```

## Contributing Improvements

When you encounter and resolve issues:

1. **Document the solution** in this guide
2. **Add preventive measures** to development workflow
3. **Create automated tests** to catch similar issues
4. **Share knowledge** with other contributors

---

**Last Updated Issues Resolved:**
- 2025-12-13: Added comprehensive validation troubleshooting
- 2025-12-13: Expanded combat system debugging section
- 2025-12-13: Added performance optimization guidance

**Next Review Due:** 2026-03-13