# Improvement Note: Decouple Configuration From UI And Logic

## Status

This is now a preserved completion note.
The configuration layer it describes is materially present, although some of the larger future-facing ambition in the older note remains aspirational rather than completed product behavior.

## Verified Current State

The following configuration surfaces exist in the live repo:

- `src/config/README.md`
- `src/config/submapVisualsConfig.ts`
- `src/config/npcBehaviorConfig.ts`
- `src/config/mapConfig.ts`
- `src/config/characterCreationConfig.ts`

That confirms the main decoupling work landed:

- configuration now has a dedicated home under `src/config`
- map and character-creation constants are no longer only ad hoc local values in the files this note originally targeted
- the repo has a real configuration lane rather than just a proposed one

## What This Means

- the note should no longer be read as a live refactor plan
- it is best preserved as a record of an architectural improvement that already happened
- future work should extend the existing config layer rather than re-proposing its creation

## Historical Drift To Note

The older note bundled real completed refactor work with bigger future possibilities such as dynamic themes, difficulty packs, or live-loaded configuration.
Those future possibilities may still be interesting, but they were not verified as already implemented in the current pass.

So the accurate split is:

- config extraction: completed
- broader dynamic-config productization: still aspirational

## Preserved Value

This note still explains a meaningful architectural direction:

- tuneable parameters should live in focused config modules
- UI and hooks should import config rather than hardcoding it locally
- future config work should build on the existing `src/config` layer instead of bypassing it
