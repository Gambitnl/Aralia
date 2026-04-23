# Glossary Link Surfaces Plan

This note tracks the different ways the glossary currently turns a term into a
clickable redirect, what each one looks like in code and in the UI, how we can
query for them with a script, and how we should present them in design preview.

The goal is not to collapse every link style into one implementation right now.
The goal is to inventory the existing shapes first so we can decide what should
stay distinct and what should eventually share a common primitive.

## Current Surface Types

### 1. Pill redirects

Code path:
- `src/components/Glossary/GlossaryPill.tsx`
- `src/components/Glossary/GlossaryTooltip.tsx`
- `src/components/Glossary/SpellCardTemplate.tsx`

What it looks like:
- rounded chip / pill
- clickable when the pill knows a glossary term id
- tooltip-backed when the pill points to a real glossary entry
- plain, non-clickable pill when the data only needs the visual label

Where it shows up:
- spell conditions
- attack-roll rider chips
- spell-specific status markers
- spatial details
- spell tags
- available-for class chips
- referenced rule chips

What makes it different:
- this is the compact metadata surface
- it is visually distinct from normal prose links
- it is the most reusable of the current glossary link styles

### 2. Inline redirect text

Code path:
- `src/components/Glossary/GlossaryContentRenderer.tsx`
- `src/components/Glossary/GlossaryTraitTable.tsx`
- `src/components/Glossary/GlossarySummaryTable.tsx`
- `src/components/Glossary/GlossarySpellsOfTheMarkTable.tsx`

What it looks like:
- normal prose with inline clickable term text
- can appear inside sentences, table cells, or longer descriptions
- uses shorthand parsing for `[[term]]`, `[[term|Display]]`, `{{term}}`,
  `{{term|Display}}`, and `<g t="...">Text</g>`

Where it shows up:
- entry lore / markdown body
- summary tables
- trait tables
- spells-of-the-mark tables
- spell descriptions that contain referenced rules

What makes it different:
- this is prose-first navigation
- the link is embedded in text instead of being a separate chip
- it is the main surface for rule explanations and in-paragraph redirects

### 3. Footer redirect buttons

Code path:
- `src/components/Glossary/GlossaryEntryTemplate.tsx`

What it looks like:
- button-like chips in the `See Also:` footer row
- visually close to pills, but implemented separately
- always placed at the bottom of the non-spell glossary card

Where it shows up:
- glossary entry footers
- cross-reference navigation

What makes it different:
- this is a footer-only navigation surface
- it is not currently using the shared pill component
- it is functionally a redirect, but it is styled and rendered separately

### Supporting behavior, not a separate surface

Code path:
- `src/components/Glossary/GlossaryTooltip.tsx`

What it does:
- gives pills hover help
- keeps click navigation on the trigger chip itself
- makes the pill feel like a real glossary entry rather than a dead label

What it is not:
- it is not its own link type
- it is the behavior that powers the pill redirect surface

## Query Plan

We need a scriptable inventory so future work can answer, per entry:

- which redirect surfaces exist
- which ones are clickable
- which component path renders them
- whether the surface is shared or one-off

### Proposed inventory script

Create a script that scans both the component source and the glossary data:

- `src/components/Glossary/**/*.tsx`
- `public/data/glossary/**/*.json`
- any glossary markdown or helper source that feeds those renderers

Suggested output:
- `docs/tasks/glossary/GLOSSARY_LINK_SURFACES_INVENTORY.md`
- optional JSON export for later tooling

### Detection rules

The script should classify entries using plain signals:

- `GlossaryPill` usage => pill redirect
- `glossaryTermId` present => clickable pill
- `GlossaryTooltip` wrapping a pill => hover-backed redirect
- `GlossaryContentRenderer` with `[[...]]`, `{{...}}`, or `<g t="...">`
  => inline redirect text
- `seeAlso` arrays in entry data => footer redirect buttons

### Practical query examples

The first-pass query can be done with text search, then upgraded to a script:

- `rg -n "GlossaryPill|GlossaryTooltip|GlossaryContentRenderer|seeAlso|data-term-id" src docs`
- `rg -n "\\[\\[|\\{\\{|<g t=" src docs public/data`

Those are good for discovery, but the durable solution should be a script that
emits a per-entry inventory rather than relying on manual grep output.

## Visualization Plan

The design preview should show all redirect surfaces side-by-side in one place.
The cleanest host is the existing spell glossary preview because it already
loads the real glossary provider and the real glossary entry renderer.

Current preview host:
- `src/components/DesignPreview/steps/PreviewSpellGlossary.tsx`
- `src/components/DesignPreview/DesignPreviewPage.tsx`

### Proposed preview entry

Add a dedicated preview entry or subpanel called something like:

- `Glossary Redirect Surfaces`

It should render:

- a clickable pill example
- a plain pill fallback
- an inline prose redirect example
- a footer `See Also` example
- a missing/unknown term example if we want to show the failure mode

### What the preview should show

Each sample should display:

- surface name
- visual example
- code path
- query rule
- whether it is shared or one-off

That makes the preview useful as a design reference and as a debugging aid.

## Design Preview Entry Decision

Preferred first implementation:

1. keep the existing `spell_glossary` preview as the host
2. add a dedicated `Glossary Redirect Surfaces` section inside it
3. if the surface catalog grows, split it into its own preview step later

Why this is the safest order:

- it reuses the existing glossary provider boundary
- it keeps the preview close to the real production component tree
- it avoids creating a parallel mock glossary just for visuals

## What This Plan Is Trying To Prevent

- mixing prose links and chip links as if they were the same UI
- losing the footer `See Also` pattern because it is implemented separately
- adding another one-off navigation style without documenting how it differs
- hiding the clickable redirect options from design preview reviewers

## Next Work

1. Generate the inventory script and its first report.
2. Add the design-preview section for redirect surfaces.
3. Decide whether the footer buttons should stay separate or be moved onto the
   shared pill path later.
4. Decide whether inline redirect text should eventually share the same tooltip
   vocabulary as pills.

