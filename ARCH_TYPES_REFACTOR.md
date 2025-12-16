# Architectural Task: Consolidate Type Definitions

## Status
**Proposed** (Verified in sandbox but reverted as per request)

## The Issue: "Split-Brain" Type Definitions
The codebase currently has two competing sources of truth for core type definitions:
1. `src/types.ts` (Root level): A large file (~1242 lines) containing rich definitions for Feats, Races, Points of Interest, and other game data.
2. `src/types/index.ts` (Module level): A separate file that claims to be the index but has diverged. It contains newer Combat-related types and imports but misses some of the rich data from the root file.

This violates the modular boundary principle and creates ambiguity about which file should be imported.

## The Solution
Consolidate both files into a single authoritative module at `src/types/index.ts`.

### Steps to Execute
1. **Merge Content**: 
   - Take the content of `src/types.ts` (which appears to be the "superset" for most game data) and merge it into `src/types/index.ts`.
   - Ensure `src/types/index.ts` retains its unique imports (e.g., `CombatState` from `./combat`) and exports.
   - Update imports in the content (e.g., `import ... from './services/villageGenerator'` becomes `../services/villageGenerator`).

2. **Delete Redundant File**:
   - Delete `src/types.ts`.

3. **Verification**:
   - Run `pnpm build` to ensure all imports in the application resolve to the new location (most likely they already resolve to `src/types` or `src/types/index`, but checking for any direct `src/types.ts` references is crucial).

## Verification Notes
During the initial attempt (sandbox session), the merge was successfully performed using a script to preserve both sets of definitions. The build passed, confirming that the application structure supports this consolidation.

### Proposed Merge Script (Python)
A script was used to safely inject missing fields from `src/types.ts` into `src/types/index.ts` without losing existing module exports.

```python
# Pseudo-code logic used
content = read('src/types.ts')
content = fix_imports(content) # ./ -> ../
inject(content, 'PlayerCharacter', missing_fields)
inject(content, 'GameState', missing_fields)
write('src/types/index.ts', content)
delete('src/types.ts')
```
