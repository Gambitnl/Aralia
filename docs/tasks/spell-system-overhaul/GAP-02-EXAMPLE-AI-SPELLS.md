# Gap: Curated Example AI Spells

**Priority:** Medium  
**Status:** Open, but the original claim is outdated  
**Last Reverified:** 2026-03-11

## Verified Current State

The repo already contains AI-tagged spell JSON:
- [`public/data/spells/level-0/prestidigitation.json`](../../../public/data/spells/level-0/prestidigitation.json)
- [`public/data/spells/level-2/blindness-deafness.json`](../../../public/data/spells/level-2/blindness-deafness.json)
- [`public/data/spells/level-2/suggestion.json`](../../../public/data/spells/level-2/suggestion.json)

So the old claim that there are no example AI spells is no longer true.

## What The Real Gap Is Now

The current problem is quality and proof-of-life, not total absence.

Examples from the current files:
- `suggestion.json` is marked `ai_dm`, but its prompt is empty and `playerInputRequired` is `false`
- `prestidigitation.json` is also marked `ai_dm` with an empty prompt
- `blindness-deafness.json` uses `ai_assisted` for a player-choice flow, which is useful as a test case but not a clean example of environmental validation

## Why It Still Matters

Without a small set of strong, intentional examples:
- the AI arbitration path is harder to regression-test
- later spell authors do not have trustworthy templates
- the existing AI-tagged spells can give a false sense that the feature is production-ready

## Current Follow-Through

1. Keep the existing AI-tagged spells as evidence that the feature is not purely theoretical.
2. Promote 2-3 curated examples with meaningful prompts and correct input requirements.
3. Use those curated files as proof-of-life test cases for UI wiring and arbitrator behavior.
