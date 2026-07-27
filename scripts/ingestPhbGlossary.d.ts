/**
 * This script turns supported 2024 PHB records from the vendored 5eTools data
 * into Aralia glossary entries.
 *
 * The item-metadata boundary is intentionally defensive because the vendor JSON
 * is external input: valid 5eTools fields become the existing glossary metadata
 * shape, while malformed or unknown values are ignored instead of leaking into
 * generated UI data. The rest of the file owns markdown conversion, entry-file
 * emission, and the final link-repair pass for those generated entries.
 *
 * Called by: the PHB glossary ingest command and its focused Vitest coverage.
 * Depends on: vendored 5eTools JSON, GlossaryEntry's shared UI contract, and
 * the glossary term-link repair helpers.
 */
import type { GlossaryEntry } from '../src/types/ui';
type ItemMetadata = NonNullable<GlossaryEntry['itemMetadata']>;
export declare function buildItemMetadata(item: unknown, typeMap: Readonly<Record<string, string>>): ItemMetadata | null;
export {};
