/**
 * @file StateViewer.tsx
 * A collapsible state inspector for debugging game state.
 */
import React from 'react';
import { GameState } from '../../types';
interface StateViewerProps {
    state: GameState;
}
declare const StateViewer: React.FC<StateViewerProps>;
export default StateViewer;
