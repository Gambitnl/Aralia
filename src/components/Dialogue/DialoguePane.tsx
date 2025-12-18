
import React, { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, MessageSquare, Brain, Lock, CheckCircle, AlertTriangle } from 'lucide-react';
import { NPC, GameState, DialogueSession } from '../../types';
import { ConversationTopic } from '../../types/dialogue';
import { getAvailableTopics, processTopicSelection, getTopic } from '../../services/dialogueService';
import { useGameState } from '../../state/GameContext'; // CORRECTED IMPORT
import { Button } from '../ui/Button';

interface DialoguePaneProps {
  isOpen: boolean;
  onClose: () => void;
  session: DialogueSession | null;
  npc?: NPC;
}

export const DialoguePane: React.FC<DialoguePaneProps> = ({
  isOpen,
  onClose,
  session,
  npc
}) => {
  const { state, dispatch } = useGameState(); // CORRECTED HOOK
  const [lastResponse, setLastResponse] = useState<string | null>(state.lastNpcResponse);
  const [isProcessing, setIsProcessing] = useState(false);

  // Derive available topics
  const topics = useMemo(() => {
    if (!session || !npc) return [];
    return getAvailableTopics(state, session.npcId, session, npc);
  }, [state, session, npc]);

  useEffect(() => {
      if (isOpen && state.lastNpcResponse) {
          setLastResponse(state.lastNpcResponse);
      }
  }, [isOpen, state.lastNpcResponse]);

  if (!isOpen || !session || !npc) return null;

  const handleTopicSelect = async (topicId: string) => {
    setIsProcessing(true);

    // Process the topic selection logic (skill checks, unlocks, etc.)
    // In a full Redux pattern, this might be a thunk. Here we call the service and dispatch updates.
    try {
        const result = processTopicSelection(topicId, state, session, 0, npc);

        // Dispatch updates based on result
        if (result.dispositionChange) {
            dispatch({ type: 'UPDATE_NPC_DISPOSITION', payload: { npcId: npc.id, amount: result.dispositionChange } });
        }

        if (result.unlocks.length > 0) {
            // Unlocks are handled by adding them to discovery log or implicit state
            // Currently dialogueService checks discoveryLog for 'topic_unlocked' flags.
            // We need to add these flags.
            result.unlocks.forEach(unlockedId => {
                 dispatch({
                     type: 'ADD_DISCOVERY_ENTRY',
                     payload: {
                         id: crypto.randomUUID(),
                         type: 'Lore Uncovered', // Or generic system event
                         title: 'New Topic Unlocked',
                         content: `Learned about a new topic.`,
                         source: { type: 'NPC', id: npc.id, name: npc.name },
                         flags: [{ key: 'topic_unlocked', value: unlockedId }],
                         timestamp: Date.now(),
                         isRead: true
                     }
                 });
            });
        }

        // Update the session state (discussed topics)
        // We need to create a new session object to trigger re-renders if using strict equality,
        // but since discussedTopicIds is mutated in processTopicSelection (which is naughty), we copy it.
        const updatedSession = {
            ...session,
            discussedTopicIds: [...session.discussedTopicIds] // Ensure new reference for array
        };

        dispatch({ type: 'UPDATE_DIALOGUE_STATE', payload: { session: updatedSession } });

        // Update the response display
        // If we want to use Gemini to flesh out the response, we would do it here.
        // For now, we use the static prompt/response from the result.
        const responseText = result.responsePrompt; // This is actually the Player Prompt usually?
        // Wait, processTopicSelection returns `responsePrompt` which is `topic.playerPrompt`.
        // Real NPC response should ideally come from `npc.knowledgeProfile.customResponse` or generated.
        // The service logic puts `playerPrompt` into `responsePrompt`.
        // Let's assume for this framework level we display it as the "outcome".

        setLastResponse(responseText);
        dispatch({ type: 'SET_LAST_NPC_INTERACTION', payload: { npcId: npc.id, response: responseText } });

    } catch (e) {
        console.error("Error processing topic:", e);
    } finally {
        setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-4xl bg-gray-900 border border-gray-700 rounded-lg shadow-2xl overflow-hidden flex flex-col h-[80vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-800 bg-gray-900/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-indigo-900 flex items-center justify-center text-indigo-200 font-serif text-lg border border-indigo-700">
              {npc.name.charAt(0)}
            </div>
            <div>
              <h2 className="text-xl font-serif text-gray-100">{npc.name}</h2>
              <p className="text-xs text-gray-400 capitalize">{npc.role}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-800 rounded-full text-gray-400 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Main Content Area */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left: NPC Response / History */}
          <div className="flex-1 p-6 border-r border-gray-800 overflow-y-auto bg-gradient-to-b from-gray-900 to-gray-800/50">
             {lastResponse ? (
                 <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    key={lastResponse} // Re-animate on change
                    className="bg-gray-800/50 p-6 rounded-lg border border-gray-700/50 relative"
                 >
                     <div className="absolute -left-3 top-6 w-3 h-3 bg-gray-800/50 border-l border-t border-gray-700/50 transform -rotate-45" />
                     <p className="text-lg text-gray-200 font-serif leading-relaxed italic">
                         "{lastResponse}"
                     </p>
                 </motion.div>
             ) : (
                 <div className="flex items-center justify-center h-full text-gray-500 italic">
                     {npc.name} is waiting for you to speak.
                 </div>
             )}
          </div>

          {/* Right: Topic Selection */}
          <div className="w-1/3 min-w-[300px] bg-gray-900 flex flex-col">
            <div className="p-3 border-b border-gray-800 bg-gray-800/30">
                <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider flex items-center gap-2">
                    <MessageSquare size={14} />
                    Topics
                </h3>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-2">
                {topics.length === 0 ? (
                    <div className="text-center p-8 text-gray-500 text-sm">
                        No available topics to discuss.
                    </div>
                ) : (
                    topics.map(topic => (
                        <button
                            key={topic.id}
                            onClick={() => handleTopicSelect(topic.id)}
                            disabled={isProcessing}
                            className="w-full text-left p-3 rounded bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-gray-500 transition-all group relative"
                        >
                            <div className="flex justify-between items-start">
                                <span className="text-gray-200 text-sm font-medium group-hover:text-white">
                                    {topic.label}
                                </span>
                                {topic.skillCheck && (
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded border ml-2 shrink-0 ${
                                        isSkillCheckLikely(topic.skillCheck.dc)
                                        ? 'bg-green-900/30 text-green-400 border-green-800'
                                        : 'bg-red-900/30 text-red-400 border-red-800'
                                    }`}>
                                        {topic.skillCheck.skill.substring(0,3).toUpperCase()} {topic.skillCheck.dc}
                                    </span>
                                )}
                            </div>
                            <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                                "{topic.playerPrompt}"
                            </p>
                        </button>
                    ))
                )}
            </div>

            <div className="p-4 border-t border-gray-800">
                <Button variant="secondary" onClick={onClose} className="w-full">
                    End Conversation
                </Button>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

// Helper for UI hint on difficulty (mock logic, real logic would check player stats)
function isSkillCheckLikely(dc: number): boolean {
    return dc <= 12;
}
