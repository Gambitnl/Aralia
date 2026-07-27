import type { PartInstance } from './types';
export interface ClassKit {
    gear: PartInstance[];
    accentHex: string;
    secondaryHex: string;
}
/** Resolve a class id to its gear kit. Throws on unknown ids. */
export declare function kitForClass(classId: string): ClassKit;
