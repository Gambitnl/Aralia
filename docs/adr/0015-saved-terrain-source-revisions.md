# 0015: Preserve independently qualified terrain sources in saves

Date: 2026-11-02

Status: Implemented; original Kodok native admission and 35-group full-reload continuity verified.

## Decision

Store `worldforgeTerrainRevision` separately from a town's `layoutRevision`.
New worlds use terrain revision 2. Retain revision 1 from the recovered original
Region generator for worlds whose independent source and physical checks qualify
it. An absent field in an old save is unknown, not a revision inferred from its
age or town reader. This preserves the narrower town-layout boundary in ADR 0013.

Before mounting a qualifying historical town, try supported terrain sources
independently. Require one complete match across the original town identities,
businesses, observations and exact supported dry feet. Refuse ambiguous or
unsupported results. Never replace a known terrain or town identity with another
reader, lower a body, or regenerate people and progress to make a candidate fit.

The load transaction adds source metadata only. Storage changes still require
an ordinary save. Ground workers, regional and local maps, travel queries and
rest queries use the same explicit source; caches include it in their identity.
Legacy constant river widths do not invent missing hydraulic slope samples.

## Evidence and limits

Encrypted local recovery snapshot
`ed0e7ebe2ff41e00b50d8722b80d462319777ffa48982aebfaacfaf9d3bac973`
contains the original Region source, SHA256
`70cebe4e50ed32bb1dd3e8e3c0fb610d696fcfe0ea689b2f56f58eb5338333cf`.
Its raw heightfields and all ten recorded Kodok walking endpoints reproduce
exactly with the current final-ground builder and explicit town reader 4.
The rejected current recipe is 6.6718275622496215 meters below the saved bank.
This evidence identifies source reconstruction; native rendered admission,
ordinary save and full reload remain separate requirements. The original Kodok campaign now passes those native gates: 35 checked groups, exact feet, saved message prefix and nonrolling saves survive the normal metadata save and full reload. This does not accept the full travel loop.

This decision does not freeze the complete world pipeline or qualify every
historical interior, party, bridge, wilderness save or water boundary. Missing
evidence must remain an explicit refusal or owning project gap.
