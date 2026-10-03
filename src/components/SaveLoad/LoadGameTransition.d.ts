/**
 * @file LoadGameTransition.tsx
 * A component that displays a brief "Welcome Back" message after loading a game.
 */
import React from 'react';
import { PlayerCharacter } from '../../types';
interface LoadGameTransitionProps {
    character: PlayerCharacter;
}
declare const LoadGameTransition: React.FC<LoadGameTransitionProps>;
export default LoadGameTransition;
