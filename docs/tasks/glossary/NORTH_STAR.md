# Glossary North Star

Status: active
Last updated: 2026-06-25

## Purpose and Scope

This planning area keeps glossary terminology strategy and glossary-link behavior
as a compact cold-start reference for future continuity.

In scope:
- Preserve planning context for glossary term coverage and priority.
- Track glossary-link surface definitions (pill, inline, footer) and validation
  evidence.
- Document dependencies between glossary planning docs, PHB audit work, and
  glossary runtime consumption.

Out of scope:
- Runtime code changes or schema rewrites.
- Item combat/economy mechanics redesign.

## Implemented State

- Core task docs are present in this folder:
  - `GLOSSARY_LINK_SURFACES_INVENTORY.md`
  - `GLOSSARY_LINK_SURFACES_INVENTORY.json`
  - `GLOSSARY_RELEVANT_RULES_TARGET_SET.md`
  - `DND_BEYOND_RULES_GLOSSARY_FIRST_PASS_AUDIT.md`
  - `TRACKER.md`
  - `GAPS.md`
- The project is registered in `docs/projects/PROJECT_TRACKER.md`.
- Dependency links are already established to:
  - `docs/projects/phb2024_glossary_audit/NORTH_STAR.md`
  - `docs/projects/glossary-ui/NORTH_STAR.md`
  - `docs/projects/item_categorization/NORTH_STAR.md`

## Planned State

- Keep the terminology governance note current when PHB audit, item taxonomy, or
  glossary UI ownership changes.
- Keep `TRACKER.md` and `GAPS.md` as the operational handoff path for all
  planning updates.
- Re-check glossary link surface evidence against current preview/runtime
  behavior on the next pass.

## File Map

- `NORTH_STAR.md`: This summary and handoff.
- `TRACKER.md`: Active queue, status, and next checks.
- `GAPS.md`: Durable unresolved items and escalation routes.
- `GLOSSARY_LINK_SURFACES_INVENTORY.md/json`: generated inventory for
  glossary redirect surfaces.
- `GLOSSARY_RELEVANT_RULES_TARGET_SET.md`: relevance filter for PHB 2024 rules.
- `DND_BEYOND_RULES_GLOSSARY_FIRST_PASS_AUDIT.md`: manual audit criteria and
  first-pass judgments.

## Integrations

- Glossary runtime evidence is implemented in `src/components/Glossary/*` and
  generated bundle/index pipeline files under `public/data/glossary/*`.
- Source term onboarding from PHB work is documented in `docs/projects/phb2024_glossary_audit`.
- Glossary grouping behavior depends on item categorization assumptions owned in
  `docs/projects/item_categorization`.
- Link-surface capture is coordinated by glossary UI preview and glossary
  rendering components that consume `GlossaryContentRenderer`, `GlossarySidebar`,
  and link marker paths.

## Terminology Governance

`docs/tasks/glossary` owns inclusion, exclusion, and section-placement decisions
for broad glossary terminology planning. Use the relevant-rules target set and
the first-pass D&D Beyond audit as evidence, but do not treat either file as a
standalone execution queue.

`docs/projects/phb2024_glossary_audit` is reference-only after the 2026-06-10
D24 decision; it should not receive new forward iteration work. Remaining PHB
glossary scope-overlap questions route here, while item metadata and equipment
taxonomy decisions route to `docs/projects/item_categorization`.

`docs/projects/glossary-ui` owns rendered glossary UI behavior, link rendering,
modal/search behavior, and rebuild-pipeline proof. Runtime glossary changes
should enter through that project unless the work is only terminology policy or
audit-scope clarification.

## Glossary Link Surface Taxonomy

The glossary currently has three durable redirect surface families:

- Pill redirects: compact chip-like metadata links rendered through
  `GlossaryPill` and tooltip-backed by `GlossaryTooltip` when a real term id is
  present.
- Inline redirect text: prose-first links rendered by `GlossaryContentRenderer`
  from `[[term]]`, `[[term|Display]]`, `{{term}}`, `{{term|Display}}`, and
  `<g t="...">Text</g>` markers.
- Footer redirect buttons: `See Also` cross-reference chips rendered by
  `GlossaryEntryTemplate` from `seeAlso` arrays.

`GlossaryTooltip` is supporting behavior, not its own link surface. The
inventory script records all four signals so preview and audit work can still
distinguish visual families, shared primitives, one-off implementations, and
hover behavior.

## Gaps and Uncertainties

- Complex PHB 2024 rule tables still need a rendered Glossary UI inspection
  after ingestion; this remains tracked in `GAPS.md` G3.
- The scope of glossary term inclusion is now routed here for terminology
  policy, while PHB audit history and item taxonomy decisions stay with their
  named owner surfaces.

## Resume Path

1. Read this file.
2. Read `TRACKER.md`.
3. Read `GAPS.md`.
4. Confirm term governance evidence against `docs/projects/PROJECT_TRACKER.md`
   and the two owning project folders above.

<!-- aralia-backlog-walked: {"source":"docs/tasks/backlog-retirement/RETIREMENT_LEDGER.md","path":"docs/tasks/glossary/NORTH_STAR.md","sha256WithoutMarker":"665d720175b8119901b91db209b4cedc02071f69bf710dd31446ced201dc1c84","markedAtUtc":"2026-06-25T22:29:38.302Z"} -->
