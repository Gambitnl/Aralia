/**
 * @file src/hooks/actions/handleObservation.ts
 * Handles observation actions like 'look_around' and 'analyze_situation'.
 */
import React from 'react';
import { GameState } from '../../types';
import { AppAction } from '../../state/actionTypes';
import { AddMessageFn, AddGeminiLogFn, GetTileTooltipTextFn } from './actionHandlerTypes';
interface HandleLookAroundProps {
    gameState: GameState;
    dispatch: React.Dispatch<AppAction>;
    addMessage: AddMessageFn;
    addGeminiLog: AddGeminiLogFn;
    generalActionContext: string;
    getTileTooltipText: GetTileTooltipTextFn;
}
export declare function handleLookAround({ gameState, dispatch, addMessage, addGeminiLog, generalActionContext, getTileTooltipText, }: HandleLookAroundProps): Promise<void>;
interface HandleAnalyzeSituationProps {
    gameState: GameState;
    dispatch: React.Dispatch<AppAction>;
    addMessage: AddMessageFn;
    addGeminiLog: AddGeminiLogFn;
    generalActionContext: string;
}
export declare function handleAnalyzeSituation({ gameState, dispatch, addMessage, addGeminiLog, generalActionContext }: HandleAnalyzeSituationProps): Promise<void>;
export {};
