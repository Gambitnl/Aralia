# Idea Board

Verified: 2026-09-22

The Idea Board is a standalone, read-only research browser at
`public/idea-board/index.html`. `records.json` owns the assessments, sources,
exclusions, and revision history. The game does not import it.

## Discovery and evidence

The default constellation groups illustrated research nodes by project or category.
`constellation.mjs` renders the explorer; `constellation.css` styles it.
The original list remains available through **List view**. Record, guide, and
historical revision hash URLs still use `app.mjs` and `lib.mjs`.

`organization.mjs` contains curated categories, projects, project scopes, and
connections. Categories describe concepts. Projects describe potential consumers.
One idea can be relevant to several projects. Each connection has a reason,
evidence reference, and either `recorded` or `suggested` relevance. Neither means
adoption, an implementation dependency, or project ownership.

The initial projects are Aralia, Entity Studio, and D&D Character Generator.
Aralia's browsing tree loads campaigns and non-superseded initiatives directly
from `public/planmap/topics.json`. Every listed initiative belongs under Aralia
for navigation, including standalone projects and agent tooling. Separate project
entries remain available too. Categories and initiatives with no mapped research
remain selectable in the rail with a zero count.
Existing fit connections are preserved; additional cross-category connections
are labeled suggested. Project, category, and initiative headings each filter
at their own level. The independent **By category** lens still groups techniques.
Entity Studio uses its domain document and the explicit references in assessments.
D&D Character Generator is a separate saved project verified in the Codex project
inventory; all its connections are suggestions pending project-specific research.
This is a curated set relevant to the current ideas, not a complete project inventory.

Project mode can display an idea in several groups. The result counter counts
unique records. Category mode places each idea in one main category. Unmapped
records appear under **Unassigned** in either mode. Selecting a project filters
both modes. Search, status, maturity, confidence, and sort remain available.
The inspector always selects a visible result after filtering.

Each tile has **Show across projects**. This temporarily pauses the current
filters and shows only that exact idea ID at every mapped project/scope path,
including other repositories. Unrelated projects and ideas disappear. Recorded
and suggested relevance remain distinct. **Back to previous view** restores the
prior filters, grouping, project selection, and selected idea. Clicking a project
heading instead leaves focus mode and navigates into that project.

## Visual assets

`public/idea-board/assets/` contains generated concept illustrations. These are
not source captures or proof of an external method. Related concepts can share
an illustration. `assets/PROMPTS.md` records the built-in imagegen prompts.
The explorer supports light and dark themes and a stacked mobile layout.

## Verification

Run `node --test scripts/idea-board/organization.test.mjs` for grouping coverage,
scope isolation, unknown records, suggested relationships, and asset references.
Run the existing validator and `validate.test.mjs` for assessment and history
guarantees. Rendered desktop and mobile checks cover grouping, project selection,
search, inspection, filters, list fallback, themes, and deep links.

## Known limits

Mappings are curated, not automatically inferred from repository names or tags.
The current board compares external sources chiefly against Aralia. Separate
project relevance must remain suggested until evidence supports it. Older project
tracker North Star links can be stale; the explorer does not use them as live links.
