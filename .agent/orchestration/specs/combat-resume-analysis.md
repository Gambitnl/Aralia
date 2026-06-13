# Spec: Combat-Resume Architecture Analysis (READ-ONLY + one output file)

Do not edit any source files. Your only write is the output file at the end.

## Problem
Mid-combat saves silently resume on the exploration surface. Known facts:
- `saveLoadService.loadGame` forces `phase = PLAYING` (~line 354 of `src/services/saveLoadService.ts`)
- Combat runtime (turn manager, initiative, battle map state) is hook-local and never serialized
- `useAutoSave.isGameplayPhase` allows autosave during COMBAT and BATTLE_MAP_DEMO phases

## Questions (investigate the actual code)
1. How large is the combat runtime state really? Enumerate concretely what would need
   serializing (inspect combat hooks/components under `src/components/Combat`, `src/hooks`).
2. Option A — full combat serialization: list concrete risks and effort drivers.
3. Option B — pre-combat checkpoint + "combat does not save" rule: exactly which code
   points change (autosave eligibility, load-time messaging, checkpoint write before
   combat entry)?
4. RECOMMEND one option for a solo-dev RPG and outline the minimal implementation as a
   numbered step list with file paths. Be concrete; cite file:line for every claim.

## Output
Write the full analysis to `.agent/orchestration/combat-resume-analysis-opus.md`,
then reply with exactly: DONE_ANALYSIS
