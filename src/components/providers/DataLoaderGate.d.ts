import React from 'react';
interface DataLoaderGateProps {
    children: React.ReactNode;
}
/**
 * A gate that blocks rendering of its children until core data (spells, glossary)
 * has been fully loaded into their respective contexts.
 * This is used to ensure the game or character creator doesn't crash on missing data,
 * without blocking the initial Main Menu load.
 */
export declare const DataLoaderGate: React.FC<DataLoaderGateProps>;
export {};
