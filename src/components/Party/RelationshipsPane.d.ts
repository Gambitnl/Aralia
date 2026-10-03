/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/components/RelationshipsPane.tsx
 * Lists all known companions and their status.
 */
import React from 'react';
import { Companion } from '../../types/companions';
interface RelationshipsPaneProps {
    companions: Record<string, Companion>;
}
export declare const RelationshipsPane: React.FC<RelationshipsPaneProps>;
export {};
