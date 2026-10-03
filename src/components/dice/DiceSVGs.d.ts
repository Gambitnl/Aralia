/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file DiceSVGs.tsx
 * SVG icon components for D&D polyhedral dice (d4, d6, d8, d10, d12, d20, d100).
 * Icons from game-icons.net under CC BY 3.0 license.
 * Attribution: Skoll and Delapouite (https://game-icons.net)
 */
import React from 'react';
interface DiceSVGProps {
    className?: string;
    /** Optional fill color, defaults to currentColor */
    fill?: string;
    /** Optional inline styles */
    style?: React.CSSProperties;
}
/**
 * D4 - Tetrahedron (4-sided pyramid)
 * @author Skoll - game-icons.net
 */
export declare const D4SVG: React.FC<DiceSVGProps>;
/**
 * D6 - Cube (standard 6-sided die)
 * @author Delapouite - game-icons.net
 */
export declare const D6SVG: React.FC<DiceSVGProps>;
/**
 * D8 - Octahedron (8-sided die)
 * @author Delapouite - game-icons.net
 */
export declare const D8SVG: React.FC<DiceSVGProps>;
/**
 * D10 - Decahedron (10-sided die)
 * @author Skoll - game-icons.net
 */
export declare const D10SVG: React.FC<DiceSVGProps>;
/**
 * D12 - Dodecahedron (12-sided die)
 * @author Skoll - game-icons.net
 */
export declare const D12SVG: React.FC<DiceSVGProps>;
/**
 * D20 - Icosahedron (20-sided die) - The iconic D&D die
 * @author Delapouite - game-icons.net
 */
export declare const D20SVG: React.FC<DiceSVGProps>;
/**
 * D100 - Percentile die (modified D10 with "00" marking)
 * Based on D10 by Skoll - game-icons.net
 */
export declare const D100SVG: React.FC<DiceSVGProps>;
/**
 * Map of die type to SVG component
 */
export declare const DiceSVGMap: Record<string, React.FC<DiceSVGProps>>;
/**
 * Generic Dice component that renders the appropriate SVG based on die type
 */
export declare const DiceSVG: React.FC<DiceSVGProps & {
    die: string;
}>;
export default DiceSVG;
