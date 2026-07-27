import type { BufferGeometry, Material } from 'three';
interface PropFieldProps {
    count: number;
    size: number;
    seed: number;
    minScale: number;
    maxScale: number;
    heightSampler: (x: number, z: number) => number;
    /** Optional weighting function. Return [0,1] where 0 is "never place". */
    placementWeight?: (x: number, z: number, scale: number) => number;
    /** Candidate retries per instance before giving up and placing anyway. */
    maxAttemptsPerInstance?: number;
    geometry: BufferGeometry;
    material: Material;
    yOffset?: number;
    spawnRadius?: number;
    avoidCenter?: {
        x: number;
        z: number;
    };
    avoidRadius?: number;
    avoidBuffer?: number;
}
declare const PropField: ({ count, size, seed, minScale, maxScale, heightSampler, placementWeight, maxAttemptsPerInstance, geometry, material, yOffset, spawnRadius, avoidCenter, avoidRadius, avoidBuffer, }: PropFieldProps) => import("react").JSX.Element;
export default PropField;
