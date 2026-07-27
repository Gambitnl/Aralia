interface LabGrassProps {
    seed: number;
    grassEnabled?: boolean;
    flowersEnabled?: boolean;
    grassCount?: number;
    flowerCountPerColor?: number;
    radius?: number;
    avoidCenter?: {
        x: number;
        z: number;
    };
    avoidRadius?: number;
}
declare const LabGrass: ({ seed, grassEnabled, flowersEnabled, grassCount, flowerCountPerColor, radius, avoidCenter, avoidRadius, }: LabGrassProps) => import("react").JSX.Element;
export default LabGrass;
