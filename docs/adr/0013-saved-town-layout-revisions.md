# 13. Record canonical town layout revisions in existing saved town state

Date: 2026-10-31

## Status

Accepted for new-town registration and explicit revision-aware readers. Historical source admission, complete consumer propagation and intentional relayout remain unfinished. This decision does not admit any existing campaign to changed geometry.

## Context

The approved town-look rules expand streets and lots. Rebuilding an established town with those rules can change plot identities, named households, work locations and the ground supporting the player. Physically observed building sources preserve individual interiors, but they are not a complete town layout or population migration.

The earlier Stamstad layout can be reconstructed through a retained generator reader. Its normalized plan, artifact and founding roster match the protected browser capture. That does not establish which revision every older save used, nor qualify current terrain, household generation or physical admission.

## Decision

Add optional `layoutRevision` to the existing `TownSimState`. Canonical registration records the selected revision before simulating the town's backstory. Revision 2 is the current default and retains the approved town-look direction. Revision 1 is an explicit reader for the retained earlier layout. Unsupported revisions refuse through the canonical reader.

Future changes to those canonical streets, lots or founding population inputs need an explicit revision and a qualified reader or migration for saved towns. Reusing the same number after changing its layout would defeat this contract. The field does not automatically version other generation systems.

An absent field means unresolved historical source. It does not mean revision 1 or the current revision. Existing towns are not assigned a value merely by registering again. A later source-admission transaction must establish the source and preserve people, families, home/work/institution joins, goods, access, observations and physical support.

Growth hydration uses a known saved revision. When that revision is absent, registration preserves the old town instead of deriving new growth geometry from today's lots. History compaction likewise keeps the complete chronological history until its source is resolved. Daily life remains active; this defers a storage optimization rather than discarding migration intent or replacing history.

The existing read-only town-life worker projection carries known revisions from TownSim. Ground town plans and water/deck geometry use the same selection. Merchant generation reads that selection while preserving existing stock and identities. This projection is derived data, not another authority or population database.

Known revisions also select map plans and personalities, building choices and visits, furnishing inspection, discovery, library collections, business attendance, lodging offers and reserved-bed checks. Rest fallback generation includes the town selection and observed building sources; its cache separates those geometry fingerprints. These readers do not assign missing revisions or authorize a migration.

Routine reports use the selected founding roster and the existing saved person-identity checks. Residents known to be dead or not yet born do not produce movement reports. Existing unversioned towns defer those reports until admission resolves their source, preserving life history without inventing new journal memories. This gate does not stop their daily simulation.

Local/Atlas readers consume a read-only projection of the existing town selection. Cache keys distinguish earlier layouts without responding to unrelated daily life. Current live cartographer receipts retain their identity when appropriate; selected older towns reconstruct through their revision before saved-focus validation. This projection adds no second persisted authority.

## Consequences and unfinished work

- New canonical town registrations retain an explicit layout identity through daily advancement and JSON serialization.
- Layout identity is narrower than a complete generation version: shared terrain, architectural, household and interior rules still need coherent source qualification.
- Known selections now reach directions, institution statements, religion, crier profiles, Local generation/cache and saved Atlas restoration. These readers do not establish historical source admission.
- Unversioned ground and merchant callers retain their prior default behavior at this stage. A known field alone does not make an old campaign safe to reload under current sources.
- Unversioned histories can grow until admission is implemented. No retention shortcut may erase the events needed to qualify their original source.
- Intentional adoption of the approved newer layout remains part of the goal. The retained reader is a staging tool, not permanent acceptance of unchanged towns.
- Native traversal, interaction, permissions and full save/reload proof remain separate from pure generation and serialization checks.

Current behavior and measured evidence belong in the [town domain](../architecture/domains/town-map.md), [gameplay tracker](../projects/gameplay-flow/TRACKER.md) and [open gaps](../projects/gameplay-flow/GAPS.md).
