/**
 * @file src/data/dev/dummyCharacter.ts
 * Defines the dummy character data for development and testing purposes.
 */
import { PlayerCharacter, Item } from '../../types';
export declare function getDummyInitialInventory(allItems: Record<string, Item>): Item[];
export declare const initialInventoryForDummyCharacter: Item[];
/**
 * Lazily initializes and returns the dummy party data.
 */
export declare function getDummyParty(): PlayerCharacter[];
export declare const USE_DUMMY_CHARACTER_FOR_DEV: boolean;
