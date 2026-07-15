# Code Modularization Audit — Absorbed Spec

Status: active  
Last routed: 2026-06-08  
Focus: Discovery and routing of modularization candidates to owning projects

## Scope Boundaries

**In scope:** Rank large files by refactor value and risk; identify owners before creating work; add gaps for split candidates; preserve comments and behavior.

**Out of scope:** Delete old systems; split generated files without generator policy; broad lint cleanup; move gameplay without owner routing.

## Must Preserve

1. Generated files remain generated unless generator or sharding policy changes.
2. Gameplay logic embedded in large files must route to owning projects before any movement.
3. Existing TODO references mentioning modularization keep durable path references current when code moves.

## Completed Routing

**Waves 1-3 (2026-06-08 complete):**
- CMA-G1–G7: Candidates routed to specific owner projects (roadmap, glossary, design-preview, providers, combat, battle-map, data)
- CMA-G8–G13: Second-tranche candidates (character-creator, saveload, spells, glossary, companions, crafting)
- CMA-G14–G19: Third-tranche candidates (3D modal, battle-map, submap, layout, combat, scripts-audits)
- CMA-G20: Type-barrel scoring signal (keep as routing/scoring, avoid broad type churn)

All gaps now carry owner-local GAPS.md stub rows. No implementation started.

## Next Work

Only write split plans after:
1. Owning project accepts the candidate (GAPS.md row changes from `not_started` to `accepted`/`active`)
2. Owning project is not review-gated
3. Preservation/test boundary is explicit

Monitor owner GAPS.md rows for status changes from `not_started` to `accepted`.
