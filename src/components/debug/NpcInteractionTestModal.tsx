/**
 * @file NpcInteractionTestModal.tsx
 * This component displays a guided test plan for the "Living NPC" system.
 */
import React, { useState, useEffect, useRef } from 'react';
// TODO(lint-intent): 'AnimatePresence' is imported but unused; it hints at a helper/type the module was meant to use.
// TODO(lint-intent): If the planned feature is still relevant, wire it into the data flow or typing in this file.
// TODO(lint-intent): Otherwise drop the import to keep the module surface intentional.
import { motion, AnimatePresence as _AnimatePresence, MotionProps } from 'framer-motion';
import { Action } from '../types';
import { WindowFrame } from '../ui/WindowFrame';

interface NpcInteractionTestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAction: (action: Action) => void;
}

const overlayMotion: MotionProps = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
};

const modalMotion: MotionProps = {
  initial: { y: -30, opacity: 0 },
  animate: { y: 0, opacity: 1 },
  exit: { y: -30, opacity: 0 },
};

const NpcInteractionTestModal: React.FC<NpcInteractionTestModalProps> = ({ isOpen, onClose, onAction }) => {
  const [step, setStep] = useState(1);
  const firstFocusableElementRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStep(1); // Reset to first step when opened
      firstFocusableElementRef.current?.focus();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleTeleportAndClose = () => {
    onAction({ type: 'move', label: 'Teleport to Hermit', targetId: 'ruins_courtyard' });
    onClose();
  };

  const testSteps = [
    {
      title: "Step 1: First Contact",
      action: "To begin the test, click the button below to teleport directly to the 'Old Hermit' in the Ruins Courtyard. Then, click the 'Talk to Old Hermit' button in the Actions pane.",
      verification: "The hermit should give a wary, initial greeting. After you've done this, click 'Next Step' to see how to verify the system state.",
      hasTeleport: true,
    },
    {
      title: "Step 2: Verify Initial Disposition",
      action: "Now, open the 'Dev Menu' and click 'View Gemini Prompt Log'. Find the most recent entry for the 'generateNPCResponse' function.",
      verification: "In the 'Prompt Sent' section, look for the 'Memory Context'. It should say 'Disposition towards player: 0' and 'No specific memories'. This confirms the NPC started with a neutral state. Close the log viewer when you're done.",
    },
    {
      title: "Step 3: Second Contact & Disposition Change",
      action: "Talk to the 'Old Hermit' again.",
      verification: "His response should be slightly different, perhaps acknowledging your return. After he responds, open the Gemini Log Viewer again. The new 'generateNPCResponse' prompt should now show 'Disposition towards player: 1'. This confirms the NPC's opinion of you is changing.",
    },
    {
      title: "Step 4: Generate a Social Check",
      action: "Click the 'Look Around' button. This will ask Gemini to suggest contextual actions. One of them might be a social check like 'Persuade the hermit to reveal a secret'.",
      verification: "If a social check appears, click it. If not, click 'Look Around' again. The game log will show a dice roll against a DC. This is a live test of the social skill system.",
    },
    {
      title: "Step 5: Verify Memory Update",
      action: "After the social check, open the Gemini Log Viewer. Find the 'generateSocialCheckOutcome' entry. Note the 'dispositionChange' value in the response.",
      verification: "Now, talk to the hermit one more time. Open the log again for the new 'generateNPCResponse' call. The 'disposition' in the prompt should be updated by the amount from the skill check, and the 'Known facts' array should now contain a new entry describing the outcome of your social check.",
    },
    {
      title: "Step 6: Test Suspicion (On Failure)",
      action: "This step is opportunistic. Try to perform social checks (especially Deception or Intimidation) until one fails.",
      verification: "When a check fails, a message should appear in the log like 'The Old Hermit seems more suspicious of you now.' On your *next* social check against him, the DC will be higher. This demonstrates the suspicion system influencing gameplay.",
    },
    {
      title: "Test Complete",
      action: "You have successfully tested the core components of the 'Living NPC' system.",
      verification: "NPCs will now remember you, form opinions, and become suspicious based on your actions, creating a more dynamic and reactive world.",
    },
  ];

  const currentStep = testSteps[step - 1];

  return (
    <WindowFrame
      title="NPC System Test Plan"
      onClose={onClose}
      storageKey="npc-test-window"
    >
      <div className="bg-gray-800 p-6 w-full h-full flex flex-col">
        <div className="bg-gray-900/50 p-4 rounded-lg flex-grow overflow-y-auto">
          <h3 className="text-xl font-semibold text-amber-300 mb-2">{currentStep.title}</h3>
          <div className="space-y-3 text-gray-300">
            <div>
              <p className="font-semibold text-sky-400">Action:</p>
              <p className="text-sm">{currentStep.action}</p>
            </div>
            {currentStep.hasTeleport && (
              <div className="pt-2">
                <button
                  onClick={handleTeleportAndClose}
                  className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-semibold py-2 px-4 rounded-lg shadow transition-colors"
                >
                  Teleport to Hermit
                </button>
              </div>
            )}
            <div>
              <p className="font-semibold text-green-400">Verification:</p>
              <p className="text-sm">{currentStep.verification}</p>
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-between items-center shrink-0">
          <button
            onClick={() => setStep(s => Math.max(1, s - 1))}
            disabled={step === 1}
            className="px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white font-semibold rounded-lg shadow disabled:opacity-50"
          >
            Previous Step
          </button>
          <span className="text-sm text-gray-400">Step {step} of {testSteps.length}</span>
          <button
            onClick={() => {
              if (step < testSteps.length) {
                setStep(s => s + 1);
              } else {
                onClose();
              }
            }}
            className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white font-semibold rounded-lg shadow"
          >
            {step < testSteps.length ? 'Next Step' : 'Finish Test'}
          </button>
        </div>

      </div>
    </WindowFrame>
  );
};

export default NpcInteractionTestModal;
