/**
 * @file src/components/OllamaDependencyModal.tsx
 * Modal that explains the Ollama dependency and offers options when Ollama is not available.
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { Button } from './ui/Button';

interface OllamaDependencyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDontShowAgain: (value: boolean) => void;
}

export const OllamaDependencyModal: React.FC<OllamaDependencyModalProps> = ({
  isOpen,
  onClose,
  onDontShowAgain,
}) => {
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const dialogRef = useFocusTrap<HTMLDivElement>(isOpen, onClose);

  const handleClose = () => {
    if (dontShowAgain) {
      onDontShowAgain(true);
    }
    onClose();
  };

  const handleLearnMore = () => {
    window.open('https://ollama.ai', '_blank');
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60] p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          <motion.div
            ref={dialogRef}
            className="bg-gray-900 border border-amber-500/60 rounded-xl shadow-xl max-w-2xl w-full p-8 text-gray-100 focus:outline-none"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ollama-modal-title"
            tabIndex={-1}
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
          >
            <h2 id="ollama-modal-title" className="text-2xl font-bold text-amber-300 mb-4">
              Ollama Dependency
            </h2>

            <div className="space-y-4 text-sm text-gray-300 leading-relaxed mb-6">
              <p>
                Aralia uses <strong>Ollama</strong>, a local AI service, to power dynamic companion commentary and AI-generated dialogue.
                This enriches the roleplay experience with contextual reactions and banter from your party members.
              </p>

              <div className="bg-gray-800/50 border-l-4 border-amber-500/40 p-4 rounded">
                <h3 className="text-amber-200 font-semibold mb-2">ℹ️ What's Ollama?</h3>
                <p>
                  Ollama is an open-source tool that runs large language models locally on your computer.
                  This means AI features work entirely offline, with no data sent to external servers.
                </p>
              </div>

              <div>
                <h3 className="text-amber-200 font-semibold mb-2">Features requiring Ollama:</h3>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>AI-generated companion reactions to events (loot, crimes, discoveries)</li>
                  <li>Dynamic companion banter and dialogue</li>
                  <li>Character-specific response generation</li>
                </ul>
              </div>

              <div>
                <h3 className="text-amber-200 font-semibold mb-2">Without Ollama:</h3>
                <p>
                  The game will function normally—companions will simply use pre-written dialogue and reactions instead of AI-generated ones.
                  The roleplay experience is fully intact, just without the dynamic AI enhancement.
                </p>
              </div>
            </div>

            {/* Checkbox for "Don't show again" */}
            <label className="flex items-center space-x-2 mb-6 cursor-pointer">
              <input
                type="checkbox"
                checked={dontShowAgain}
                onChange={(e) => setDontShowAgain(e.target.checked)}
                className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-amber-500 cursor-pointer"
              />
              <span className="text-sm text-gray-400">Don't show this again</span>
            </label>

            {/* Action buttons */}
            <div className="flex justify-end space-x-3">
              <Button
                onClick={handleLearnMore}
                variant="secondary"
                size="md"
              >
                Learn More
              </Button>
              <Button
                onClick={handleClose}
                variant="action"
                size="md"
              >
                Continue
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
