#!/usr/bin/env tsx
/**
 * Inventory script for glossary redirect surfaces.
 *
 * Scans component sources and glossary entry data to classify each place a
 * glossary term is turned into a clickable redirect. Writes a per-surface and
 * per-entry report to docs/tasks/glossary/GLOSSARY_LINK_SURFACES_INVENTORY.md
 * and a JSON sidecar for later tooling.
 *
 * Classifications follow docs/tasks/glossary/NORTH_STAR.md:
 *   - GlossaryPill usage                      => pill redirect
 *   - glossaryTermId present                  => clickable pill
 *   - GlossaryTooltip wrapping a pill         => hover-backed redirect
 *   - [[term]]/{{term}}/<g t="term">          => inline redirect text
 *   - seeAlso arrays in entry data            => footer redirect buttons
 */
export {};
