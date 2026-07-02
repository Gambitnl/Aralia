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

## Missing-Text Backlog: Completed 2026-07-01

An earlier revision of this note listed 19 spell-linked terms as "still missing
real glossary text", with `difficult_terrain.json` called out as a concrete
placeholder. That backlog is executed. All 19 terms were re-verified on
2026-07-01 under `public/data/glossary/entries/rules/` and every one now has an
entry with substantive rule text (no "Canonical rule text has not been
captured yet" placeholders remain; grep-verified):

- `Cone` → `cone_area.json`
- `Cube` → `cube_area.json`
- `curse` → `curse.json`
- `Cylinder` → `cylinder_area.json`
- `Difficult Terrain` → `difficult_terrain.json` (real XPHB text; the old
  placeholder path under `rules/spells/referenced/` no longer exists)
- `Emanation` → `emanation_area.json`
- `Friendly` → `friendly_attitude.json`
- `Half Cover` → `half_cover.json`
- `Heavily Obscured` → `heavily_obscured.json`
- `Hostile` → `hostile_attitude.json`
- `Indifferent` → `indifferent_attitude.json`
- `Lightly Obscured` → `lightly_obscured.json`
- `Line` → `line_area.json`
- `Passive Perception` → `passive_perception.json`
- `possessed` → `possessed.json` (plus parent `possession.json`)
- `Shape-Shifting` → `shape_shifting.json`
- `Stable` → `stable.json`
- `Three-Quarters Cover` → `three_quarters_cover.json`
- `Total Cover` → `total_cover.json`

No terms from that list remain genuinely missing. The AoE-shape entries now
live as top-level `rules/` files; only `sphere_area.json` remains under
`rules/spells/referenced/`.

## Practical Standard (Ongoing)

The glossary-rules coverage standard remains:

1. Use the spell-linked referenced-rule set as the primary relevant audit surface.
2. Keep low-value incidental tooltip labels suppressed.
3. (Executed 2026-07-01) High-value referenced rules have been promoted from
   placeholder entries into real glossary entries with actual rule text; apply
   the same promotion standard to any newly captured referenced rules.
4. Do not use the full `Rules Glossary` category size as proof of canonical rules
   coverage.

<!-- aralia-backlog-walked: {"source":"docs/tasks/backlog-retirement/RETIREMENT_LEDGER.md","path":"docs/tasks/glossary/GLOSSARY_RELEVANT_RULES_TARGET_SET.md","sha256WithoutMarker":"5ac0b8e98c290f4b24bfc97919f0af90ea18cfbabe469485952ae2559c1a12d7","markedAtUtc":"2026-06-25T22:29:38.307Z"} -->
