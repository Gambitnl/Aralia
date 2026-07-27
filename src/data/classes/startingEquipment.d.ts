/**
 * @file src/data/classes/startingEquipment.ts
 * 2024 Player's Handbook class starting-equipment packages (the "Option A" gear
 * bundle each class begins with, rather than the roll-for-gold alternative).
 *
 * Each entry lists item ids (resolved against ALL_ITEMS by buildStartingLoadout),
 * their quantities, and whether the item should start EQUIPPED. Exactly one melee/
 * ranged weapon and, where relevant, one body armor + one shield are marked
 * `equip: true` so a fresh character walks out of creation ready to fight rather
 * than naked at AC 10.
 *
 * `gold` is the coin the package includes on top of the gear.
 *
 * Item ids must exist in ALL_ITEMS (weapons in WEAPONS_DATA, armor/gear in
 * data/items). buildStartingLoadout warns in dev if one fails to resolve.
 */
export interface StartingEquipmentEntry {
    id: string;
    quantity?: number;
    /** Start this item equipped (armor → its slot, weapon → MainHand). */
    equip?: boolean;
}
export interface ClassStartingEquipment {
    items: StartingEquipmentEntry[];
    /** Coin the package grants, in gold pieces. */
    gold: number;
}
export declare const CLASS_STARTING_EQUIPMENT: Record<string, ClassStartingEquipment>;
