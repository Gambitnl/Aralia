# Glossary Relevant Rules Target Set

This note narrows the glossary-rules audit surface so Aralia does not treat every
rule-adjacent entry as equally important.

The D&D Beyond 2024 Rules Glossary is a useful source surface, but the local
`Rules Glossary` category also contains many broader repo-local entries such as
equipment items, service listings, crafting entries, and other rule-adjacent
content that should not be used as the main coverage metric for spell/rules
glossary completeness.

## What Counts As Relevant

For Aralia's spell-truth and gameplay glossary work, the relevant rules target
set should prioritize:

- actions and combat actions
- conditions and condition-adjacent state
- D20 test terms
- attack/save terms
- concentration, duration, range, and spell-effect terms
- movement and terrain terms
- cover, visibility, light, and obscuration terms
- area-of-effect geometry terms
- attitudes or target-state terms that are directly referenced by spells
- other rules explicitly referenced by captured canonical spell snapshots

## What Should Not Drive The Coverage Metric

These may still be valid local glossary entries, but they should not be treated
as primary proof that the D&D Beyond rules glossary is "covered":

- equipment catalog entries
- services and lifestyle entries
- crafting item entries
- low-value marketplace-adjacent terminology
- incidental tooltip captures that do not materially help spell or gameplay interpretation

Examples already present in the current `Rules Glossary` index that are too
broad or too incidental to use as the main metric:

- `acid_item`
- `adventuring_equipment`
- `adventuring_gear`
- many `equipment/*` descendants

## Current Useful Target Surface

The cleanest currently observable target set is the spell-linked rule surface
already captured in:

- [spell_referenced_rules_enrichment.json](F:\Repos\Aralia\public\data\glossary\entries\rules\spells\spell_referenced_rules_enrichment.json)

That file currently records:

- `33` referenced rules captured
- `8` suppressed raw references already judged too incidental / low-value

This makes the spell-linked referenced-rule set a better practical audit surface
than the raw `Rules Glossary (219)` count.

## Spell-Linked Relevant Rules With Real Local Rule Text

These already have meaningful glossary descriptions in the enrichment layer or
their generated referenced-rule entries:

- `Attack Action`
- `Attack Rolls`
- `Attunement`
- `Bonus Action`
- `Bright Light`
- `Concentration`
- `D20 Tests`
- `Darkness`
- `Dim Light`
- `Spell Duration Rules`
- `Spell Effects (Targets, Saves, Attacks)`
- `Spell Range Rules`
- `Sphere`
- `Temporary Hit Points`

## Spell-Linked Relevant Rules Still Missing Real Glossary Text

These are represented, but still incomplete because the local glossary surface
does not yet provide a real captured rule description:

- `Cone`
- `Cube`
- `curse`
- `Cylinder`
- `Difficult Terrain`
- `Emanation`
- `Friendly`
- `Half Cover`
- `Heavily Obscured`
- `Hostile`
- `Indifferent`
- `Lightly Obscured`
- `Line`
- `Passive Perception`
- `possessed`
- `Shape-Shifting`
- `Stable`
- `Three-Quarters Cover`
- `Total Cover`

## Concrete Placeholder Example

This file exists, but it is still only a placeholder:

- [difficult_terrain.json](F:\Repos\Aralia\public\data\glossary\entries\rules\spells\referenced\difficult_terrain.json)

It currently says:

- `Canonical rule text has not been captured yet.`

So `Difficult Terrain` is present in navigation terms, but not yet complete as a
real glossary rule.

## Practical Next Standard

The next glossary-rules coverage standard should be:

1. Use the spell-linked referenced-rule set as the primary relevant audit surface.
2. Keep low-value incidental tooltip labels suppressed.
3. Promote missing high-value referenced rules from placeholder entries into real
   glossary entries with actual rule text.
4. Do not use the full `Rules Glossary` category size as proof of canonical rules
   coverage.
