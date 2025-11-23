/**
 * @file LoadGameTransition.tsx
 * A component that displays a brief "Welcome Back" message after loading a game.
 */
import React from 'react';
import { motion } from 'framer-motion';
import { PlayerCharacter } from '../types';

interface LoadGameTransitionProps {
  character: PlayerCharacter; // The character from the loaded save
}

const LoadGameTransition: React.FC<LoadGameTransitionProps> = ({ character }) => {
  return (
    <motion.div
      {...{
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0, transition: { duration: 0.5 } }, // Fade out
        transition: { duration: 0.3 }
      } as any}
      className="fixed inset-0 bg-gray-900 flex items-center justify-center z-[100]"
      aria-live="polite"
      aria-label={`Welcome back, ${character.name}`}
    >
      <motion.div
        {...{
          initial: { y: 20, opacity: 0 },
          animate: { y: 0, opacity: 1, transition: { delay: 0.2, duration: 0.5 } }
        } as any}
        className="text-center"
      >
        <h1 className="text-4xl md:text-5xl font-cinzel text-amber-400 mb-4">
          Welcome Back, {character.name}
        </h1>
        <p className="text-lg text-gray-300">Your adventure continues...</p>
      </motion.div>
    </motion.div>
  );
};

export default LoadGameTransition;