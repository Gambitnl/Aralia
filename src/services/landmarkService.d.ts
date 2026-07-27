import { DiscoveryReward, DiscoveryConsequence } from '../types/exploration';
export interface GeneratedLandmark {
    id: string;
    name: string;
    description: string;
    type: string;
    rewards: DiscoveryReward[];
    consequences: DiscoveryConsequence[];
}
/**
 * Generates a landmark for a given world location if one exists.
 * This is deterministic based on world seed and coordinates.
 *
 * Uses a combinatorial approach (Origin + Type + State) to generate varied content.
 */
export declare function generateLandmark(worldSeed: number, coordinates: {
    x: number;
    y: number;
}, biomeId: string): GeneratedLandmark | null;
