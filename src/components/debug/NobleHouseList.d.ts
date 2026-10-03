/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/components/debug/NobleHouseList.tsx
 * A debug component to visualize the procedural noble houses and their relationships.
 */
import React from 'react';
interface NobleHouseListProps {
    worldSeed: number;
    onClose: () => void;
}
declare const NobleHouseList: React.FC<NobleHouseListProps>;
export default NobleHouseList;
