# 12. Retain physically observed building sources in saved town state

Date: 2026-10-31

## Status

Accepted for observed-source capture and coherent retained-source readers under the active building-comfort goal. A bounded frozen structural circulation correction is also accepted for the inspected left-return inn family. The modest shared-hall household revision has a qualified native capacity/property/continuity path for Nell; overall comfort remains unfinished. General structural migration, future household evolution and representative building acceptance remain unfinished.

## Context

Normal desktop inn play exposes cramped guest circulation, a narrow bed/chest approach and a wealthy household with more residents than beds. Improving those plans must preserve established people, possessions, references and accepted player positions.

TownSim already owns building histories, door states and future evolution candidates. Its folded history stores event outcomes and selected style/structural targets, but not a complete frozen floor/furnishing plan. `blueprintForPlot` reconstructs through current generation rules. Generic Worldforge deltas likewise describe mutations over a regenerated base; they do not currently preserve the established blueprint and owned manifests.

Legacy source drift has already occurred under GF-G93. A newly reconstructed plan cannot honestly be called the historical original merely because it is deterministic today.

## Decision

Extend the existing `TownSimState` with optional `buildingSources`, keyed by its existing canonical plot IDs. Each version 1 record is explicitly an **observed** source: full blueprint, named household when present, exact container manifests and owners, workplace scope, source world/burg/plot/cell, observation time, accepted feet and site transform. Old saves may omit the field.

Capture follows successful ordinary physical furnishing reach. The mounted worker and inspection producer must agree on the exact blueprint signature. The signature detects source drift; it is not cryptographic proof or an access token. Workers predating that signature remain inspectable but cannot establish this observation.

The town reducer rechecks current world, cell, history and accepted XYZ. An absent height cannot be guessed. It copies the record into JSON-owned data and preserves all existing town/player state. The first record is never replaced by a later inspection or changed generator. A migration is a separate transaction.

Capture grants no items, permission, rest, movement, meeting or fictional renovation. It does not add a parallel roadmap or persistence database. It records no claim that this was the world's first-ever plan or household.

A bounded furniture correction may append a versioned `furnishingRepair` over the immutable observation. The bedside-storage-clearance-v1 recipe preserves room/bed/door/container references, household and owned contents; it records exact chest movements rather than recapturing a new household. Readers verify and replay that proposal. Admission waits for fresh, acknowledged, stationary feet outside a three-metre building margin. Multi-person parties defer until all body positions have an admission contract. This does not admit structural repartitioning or invent a renovation in world history.

A bounded structural correction may append a versioned frozen `circulationRepair` over the same immutable observation and any prior furniture correction. The first recipe adds a public inn landing/hall while preserving original room/bed/container/owner joins, entry, stairs and site origin; door-state mappings retain old keys and refuse conflicts. Admission applies the same fresh acknowledged stationary outside-position and single-person boundary, validates the current mounted foundation and preflights production history projection. The complete admitted plan is stored and read directly, so future recipes cannot silently reapply a different structural layout. Unsupported histories and families defer. Retained masonry patches remain on their actual surface when an extension encloses an old outer wall. No fictional renovation, replacement household or player relocation follows. This does not admit arbitrary future structural events or multi-person migration.

A bounded household correction may append an optional frozen householdRevision containing its explicit original furnishing/room/door joins and remapped owned manifests. The first implemented recipe reclaims the reached modest cottage's redundant corridor as shared family space, keeps the shell/history and supplies individual beds plus kitchen seating. Old observations and door keys remain; a removed shared opening is archived rather than reassigned. Unknown town source revisions, changed observation history, conflicting destination door states, affected paid references and unqualified party positions refuse admission. Live caches use the frozen plan identity. This contract is implemented and source-tested, with Nell-specific normal source selection, coherent immutable application adoption, native revised-home traversal/examination and full reload qualified below. Other household/source families and overall interior comfort remain unaccepted. No fictional construction, player relocation or ownership grant follows.

## Consequences and unfinished work

- Exact observed foundations survive saves without relying on future generator recipes. Storage grows by one complete record per physically inspected building; untouched buildings incur no capture cost.
- Streaming, occupancy, examination, goods and ordinary plan/service readers now consume the retained source when present. Unobserved buildings retain their existing generation path. Changed generator candidates cannot replace the observed foundation.
- Future life and building events remain live intent. Compatible condition events replay over the retained foundation. New structural masses currently surface an explicit migration refusal and retain their journal intent; compaction defers rather than silently rebuilding. This is an interim boundary: structural migration and future household transition admission still need implementation.
- Existing door, bed, container and owner references, possessions, privacy and accepted XYZ need explicit migration checks. A source mismatch must remain visible; silently moving the player or replacing established people is prohibited by the user goal.
- Unknown historical baselines remain unknown. GF-G93 and representative building acceptance stay open until their separate evidence requirements are met.

Implementation and native receipts belong in [the gameplay tracker](../projects/gameplay-flow/TRACKER.md) and [town/interiors domain](../architecture/domains/town-map.md).

## Bounded native household evidence

Verified:2026-10-31. Nell's independent historical-load gate qualifies town850revision2 before ordinary saved-game loading on immutable fresh-source-02. The acknowledged unchanged outside pose admits the frozen shared-hall cottage; original observation/household/owned goods and old door keys remain. Normal new entry/door toggles/all10furnishing examinations and08:15:19→08:16:30fullreload retain31groups/exactinteriorXYZ, with private bed/container rules intact. This accepts the bounded revision's native capacity/property/continuity path. It does not accept overall comfort: exterior firewood intrudes into the hall, camera orbit is constrained, and actual NPC passing/seating/sleep/internal leaves and representative households remain open. Future prop/source repairs must preserve their own stable delta/loot identities and the now-accepted interior player position.
