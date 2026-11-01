# Retained exterior prop revisions

Date: 2026-11-01

Status: Accepted for the bounded woodpile-v1 reader and guarded admission contract. Native correction evidence belongs in the gameplay-flow tracker; this decision does not accept the full building-comfort goal.

## Context

Normal play found generated exterior firewood inside a reached modest home. The generator scattered around building centers without footprints. The same class of intrusion was observed by the gameplay lane inside a temple. Simply deleting or rerolling the pile would lose established property. Its tactical address originally included its coordinates, so a bare position change would also change identity.

The first geometrically clear destination failed the existing terrain gate. A later site passed both that gate and contact checks over the actual rendered woodpile triangles. Clearance alone is insufficient, and a returned pose is not proof that its gate passed.

## Decision

- Keep a correction on the owning observed building source, separate from its immutable plan, household and manifests. Retain the original prop and a frozen revised pose.
- Preserve the original tactical address with `retainedSourceId`. This is object identity, not an ownership or permission grant. Current physical coordinates remain available separately.
- Preserve the accepted art recipe with `retainedRenderRecipe`. Rendering, replay validation and walking envelopes share the versioned six-log geometry. Keep version 1 available when default art changes.
- Pin the qualified nearby prop baseline within 25 meters, not unrelated distant scenery. A changed nearby source requires an explicit migration or renewed qualification. It must not silently remove the accepted correction or reroll property.
- Order multiple corrections by explicit predecessor signatures. Replay and admission preflight operate on copies and reject missing, duplicate or reordered dependencies.
- Recheck the observed foundation, original object, local baseline, building/door/road/neighbour clearance and both nominal and rendered support before accepting or replaying a correction. Retain the existing town tolerances; do not deform terrain to rescue a failed proposal.
- Admit only after the actual mounted single-player body has stopped outside the affected building, beyond the existing three-meter envelope. Recheck world, source, history, character, position and support in the reducer. Never move accepted feet, companions or household members to make admission pass.
- Make an admitted corrected pile physically obstruct walking using envelopes derived from its rendered log vertices. Do not retroactively solidify unadmitted legacy scenery around accepted bodies.
- Reject incompatible later room revisions until a combined source migration is qualified. Keep those unfinished room proposals and original references intact.

Signatures detect source drift and corruption; they are not cryptographic authorization or an ownership system.

## Consequences and remaining work

The first implementation supports model-bound woodpile corrections, ordered replay and deliberate refusals. A new procedural prop source or changed nearby property needs a compatible reader/migration, rather than a fallback to fresh generation.

Prospective footprint-aware generation, other prop models, general legacy collision admission, surrounding land ownership and the complete wealth/family/work/culture/ruler/multiple-floor matrix remain necessary. This correction path does not substitute for making newly generated homes and yards coherent from their first visit.

Evidence and current source/resume decisions stay in [the gameplay tracker](../projects/gameplay-flow/TRACKER.md) and [town/interior architecture](../architecture/domains/town-map.md).
