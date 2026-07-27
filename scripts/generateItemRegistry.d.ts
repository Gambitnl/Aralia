export declare function getIconForType(type: string): string;
export declare function mapWeaponProperties(props: string[]): string[];
export declare function parseItemEffect(markdown: string): any;
/**
 * Convert a single glossary entry into a simplified registry item.
 *
 * This is the mechanical conversion seam (type / slot / damage / value /
 * rarity / attunement heuristics) extracted from the generation loop so it
 * can be exercised directly by acceptance tests (item_categorization IC-G3).
 * Returns `null` for entries without `itemMetadata` (the same entries the
 * generation loop skips).
 */
export declare function convertEntryToItem(data: any): {
    id: string;
    item: Record<string, any>;
} | null;
