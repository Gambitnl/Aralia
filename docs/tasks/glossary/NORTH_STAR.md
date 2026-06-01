# Glossary North Star

Status: active
Last updated: 2026-05-31

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
  - `GLOSSARY_LINK_SURFACES_PLAN.md`
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

- Add a terminology governance note that names who owns final inclusion,
  exclusion, and section placement decisions.
- Keep `TRACKER.md` and `GAPS.md` as the operational handoff path for all
  planning updates.
- Re-check glossary link surface evidence against current preview/runtime
  behavior on the next pass.

## File Map

- `NORTH_STAR.md`: This summary and handoff.
- `TRACKER.md`: Active queue, status, and next checks.
- `GAPS.md`: Durable unresolved items and escalation routes.
- `GLOSSARY_LINK_SURFACES_PLAN.md` + `GLOSSARY_LINK_SURFACES_INVENTORY.md/json`:
  canonical link-surface taxonomy and generated inventory.
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

## Gaps and Uncertainties

- No explicit terminology-governance artifact exists yet for this project area.
  The tracker row still points to governance work but does not provide a single
  owning document.
- The scope of glossary term inclusion is still partly split between PHB-2024
  and in-surface rule decisions; a one-line decision record is still needed.

## Resume Path

1. Read this file.
2. Read `TRACKER.md`.
3. Read `GAPS.md`.
4. Confirm term governance evidence against `docs/projects/PROJECT_TRACKER.md`
   and the two owning project folders above.
