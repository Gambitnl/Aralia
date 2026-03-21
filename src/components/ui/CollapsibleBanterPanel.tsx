/**
 * ARCHITECTURAL CONTEXT:
 * This component is the primary UI interface for the 'Banter System'.
 * It handles the rendering of both ambient NPC-to-NPC banter and directed 
 * NPC-to-Player conversations.
 *
 * Recent updates introduced the 'Player-Directed' mode, which adds visual 
 * urgency (amber color schemes, pulsing tab, and response countdowns) when 
 * an NPC is explicitly waiting for the player to interject or reply.
 *
 * It supports three layout modes: COLLAPSED (side tab), EXPANDED (side drawer), 
 * and FLOATING (detached window).
 *
 * @file src/components/ui/CollapsibleBanterPanel.tsx
 */
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { WindowFrame } from './WindowFrame';
import { UI_ID } from '../../styles/uiIds';
import { BanterMoment, Companion } from '../../types/companions';

export interface BanterHistoryLine {
  speakerId: string;
  speakerName: string;
  text: string;
  /** True when this line was a player-directed NPC opening or escalation. */
  isDirectedAtPlayer?: boolean;
}

interface CollapsibleBanterPanelProps {
  /** Extends the NPC-to-NPC inter-line wait by 60 seconds (gives the player more time to interject). */
  // WHAT CHANGED: Added onExtendNpcDelay and onExtendDeadline props.
  // WHY IT CHANGED: Previously, conversation pacing was strictly controlled 
  // by timers. To improve UX (especially when reading large blocks of AI text), 
  // we added buttons that allow the player to 'halt' the timer and gain an 
  // extra 60 seconds of deliberation/reading time.
  onExtendNpcDelay?: () => void;
  isActive: boolean;
  isWaiting: boolean;
  isGenerating?: boolean;
  generatingSpeakerName?: string | null;
  secondsRemaining: number;
  history: BanterHistoryLine[];
  archivedBanters: BanterMoment[];
  companions: Record<string, Companion>;
  onInterrupt: (message: string) => void;
  onEndBanter: () => void;
  // Player-directed banter additions:
  /** True when the session is in PLAYER_DIRECTED mode. */
  isPlayerDirected?: boolean;
  /** True while waiting for the player to reply to a directed NPC line. */
  isWaitingForPlayerResponse?: boolean;
  /** Countdown seconds for the player response deadline. */
  playerResponseDeadlineSeconds?: number;
  /**
   * When flipped to true the panel expands automatically.
   * Driven by App.tsx when the attention banner's "Open Chat" is clicked.
   */
  forceExpand?: boolean;
  /** Extends the player response deadline by 60 seconds. */
  onExtendDeadline?: () => void;
}

type PanelMode = 'COLLAPSED' | 'EXPANDED' | 'FLOATING';
type Tab = 'LIVE' | 'MEMORIES';

export const CollapsibleBanterPanel: React.FC<CollapsibleBanterPanelProps> = ({
  isActive,
  isWaiting,
  isGenerating = false,
  generatingSpeakerName = null,
  secondsRemaining,
  history,
  archivedBanters,
  companions,
  onInterrupt,
  onEndBanter,
  isPlayerDirected = false,
  isWaitingForPlayerResponse = false,
  playerResponseDeadlineSeconds = 0,
  forceExpand = false,
  onExtendDeadline,
  onExtendNpcDelay,
}) => {
  const [mode, setMode] = useState<PanelMode>('COLLAPSED');
  const [activeTab, setActiveTab] = useState<Tab>('LIVE');
  const [selectedMomentId, setSelectedMomentId] = useState<string | null>(null);
  const [playerMessage, setPlayerMessage] = useState('');

  // Auto-collapse when banter ends; auto-switch to Live tab when it starts
  useEffect(() => {
    if (!isActive) {
      setMode('COLLAPSED');
    } else {
      setActiveTab('LIVE');
    }
  }, [isActive]);

  // Expand when the attention banner's "Open Chat" fires.
  // Only promote COLLAPSED → EXPANDED; leave FLOATING alone (it's already open).
  useEffect(() => {
    if (forceExpand && isActive && mode === 'COLLAPSED') {
      setMode('EXPANDED');
    }
  }, [forceExpand, isActive, mode]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (playerMessage.trim()) {
      onInterrupt(playerMessage.trim());
      setPlayerMessage('');
    }
  };

  /**
   * Resolves a speaker's display name.
   * Priority: saved speakerName → 'You' for player → companion state → formatted ID.
   */
  const resolveSpeakerName = (id: string, savedName?: string): string => {
    if (savedName) return savedName;
    if (id === 'player') return 'You';
    const companion = companions[id];
    if (companion?.identity?.name) return companion.identity.name;
    return id.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
  };

  // ─── Renderers ──────────────────────────────────────────────────────────────

  const renderChatContent = () => (
    <div className="flex flex-col h-full">
      {/* Player response countdown banner */}
      {/* WHAT CHANGED: Added countdown banner and extension button. */}
      {/* WHY IT CHANGED: Provides clear feedback that the AI is waiting for 
          player input, and allows the player to delay the timeout if they 
          need more time to type a thoughtful response. */}
      {isActive && isPlayerDirected && isWaitingForPlayerResponse && playerResponseDeadlineSeconds > 0 && (
        <div className={`mb-2 flex items-center justify-between px-3 py-1.5 rounded text-xs border
          ${playerResponseDeadlineSeconds <= 30
            ? 'bg-amber-800/40 border-amber-400/70 text-amber-300'
            : 'bg-amber-900/30 border-amber-500/50 text-amber-400'
          }`}
        >
          <span className="flex items-center gap-1">
            <span>💬</span>
            <span className="font-medium">{generatingSpeakerName || 'Companion'} spoke to you</span>
          </span>
          <div className="flex items-center gap-2">
            <span className={`tabular-nums font-semibold ${playerResponseDeadlineSeconds <= 30 ? 'animate-pulse' : ''}`}>
              ⏱ {playerResponseDeadlineSeconds}s
            </span>
            {onExtendDeadline && (
              <button
                onClick={onExtendDeadline}
                className="px-1.5 py-0.5 bg-amber-800/60 hover:bg-amber-700/60 border border-amber-600/50 text-amber-300 text-[10px] font-semibold rounded transition-colors"
                title="Extend reply window by 1 minute"
              >
                +1 min
              </button>
            )}
          </div>
        </div>
      )}

      {/* History Area */}
      <div className="flex-grow overflow-y-auto mb-4 space-y-3 p-2 custom-scrollbar">
        {history.length === 0 && (
          <div className="text-gray-500 text-sm italic text-center mt-4">Conversation starting...</div>
        )}
        {history.map((line, idx) => {
          const isPlayer = line.speakerId === 'player';
          const isDirected = line.isDirectedAtPlayer;
          return (
            <div key={idx} className={`flex flex-col ${isPlayer ? 'items-end' : 'items-start'}`}>
              <span className={`text-xs mb-0.5 px-1 ${isDirected ? 'text-amber-400/90' : 'text-amber-500/70'}`}>
                {line.speakerName}
                {isDirected && !isPlayer && (
                  <span className="ml-1 text-[10px] text-amber-400/60 italic">→ you</span>
                )}
              </span>
              <div className={`
                px-3 py-2 rounded-lg max-w-[90%] text-sm
                ${isPlayer
                  ? 'bg-amber-900/30 text-amber-100 border border-amber-700/30'
                  : isDirected
                    ? 'bg-amber-900/20 text-gray-200 border-l-2 border-amber-500/70 border-t border-r border-b border-amber-700/20'
                    : 'bg-gray-700/50 text-gray-200 border border-gray-600/30'
                }
              `}>
                {line.text}
              </div>
            </div>
          );
        })}
        {isGenerating && (
          <div className="flex flex-col items-start animate-in fade-in duration-500">
            <div className="text-xs text-amber-500/50 italic px-2 mb-1 flex items-center gap-1.5">
              <div className="flex gap-0.5">
                <span className="w-1 h-1 bg-amber-500/50 rounded-full animate-bounce [animation-delay:-0.3s]" />
                <span className="w-1 h-1 bg-amber-500/50 rounded-full animate-bounce [animation-delay:-0.15s]" />
                <span className="w-1 h-1 bg-amber-500/50 rounded-full animate-bounce" />
              </div>
              {generatingSpeakerName ? `${generatingSpeakerName} is responding...` : 'A companion is responding...'}
            </div>
          </div>
        )}
        {isActive && isWaiting && secondsRemaining > 0 && !isGenerating && !isWaitingForPlayerResponse && (
          <div className="flex items-center justify-between px-3 py-1.5 rounded text-xs border bg-gray-800/40 border-gray-600/40 text-gray-400">
            <span className="flex items-center gap-1">
              <span>💬</span>
              <span className="font-medium italic">Interject before next line</span>
            </span>
            <div className="flex items-center gap-2">
              <span className={`tabular-nums font-semibold ${secondsRemaining <= 10 ? 'animate-pulse text-gray-300' : ''}`}>
                ⏱ {secondsRemaining}s
              </span>
              {/* WHAT CHANGED: Added +1 min extension button. */}
              {/* WHY IT CHANGED: Ambient banter used to move very fast, making 
                  it hard for players to 'jump in'. This button allows them 
                  to freeze the conversation state while they compose an 
                  interjection. */}
              {onExtendNpcDelay && (
                <button
                  onClick={onExtendNpcDelay}
                  className="px-1.5 py-0.5 bg-gray-700/60 hover:bg-gray-600/60 border border-gray-500/50 text-gray-300 text-[10px] font-semibold rounded transition-colors"
                  title="Delay next NPC line by 1 minute"
                >
                  +1 min
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Input Area */}
      {isActive && (
        <form onSubmit={handleSubmit} className="flex gap-2 mt-auto">
          <input
            type="text"
            value={playerMessage}
            onChange={(e) => setPlayerMessage(e.target.value)}
            placeholder={isWaitingForPlayerResponse ? 'Reply to them...' : 'Type your reply...'}
            className={`flex-grow px-3 py-2 bg-gray-900/50 border rounded text-gray-200 placeholder-gray-500 text-sm focus:outline-none
              ${isWaitingForPlayerResponse
                ? 'border-amber-500/70 focus:border-amber-400'
                : 'border-gray-600 focus:border-amber-500'
              }`}
            autoFocus={isWaitingForPlayerResponse}
          />
          <button
            type="submit"
            disabled={!playerMessage.trim()}
            className="px-3 py-2 bg-amber-600 hover:bg-amber-500 disabled:bg-gray-700 disabled:text-gray-500 text-white text-sm font-semibold rounded transition-colors"
          >
            Send
          </button>
        </form>
      )}
      {!isActive && (
        <div className="mt-auto text-center text-gray-500 text-xs italic p-2 border-t border-gray-800">
          Conversation ended.
        </div>
      )}
    </div>
  );

  const renderMemoriesContent = () => {
    if (selectedMomentId) {
      const moment = archivedBanters.find(m => m.id === selectedMomentId);
      if (!moment) return <div>Moment not found</div>;
      return (
        <div className="flex flex-col h-full">
          <button
            onClick={() => setSelectedMomentId(null)}
            className="mb-2 text-xs text-amber-500 hover:text-amber-400 flex items-center gap-1"
          >
            ← Back to List
          </button>
          <div className="flex-grow overflow-y-auto space-y-3 p-2 custom-scrollbar">
            <div className="text-xs text-gray-500 mb-4 text-center">
              {new Date(moment.timestamp).toLocaleString()} • {moment.locationId}
            </div>
            {moment.lines.map((line, idx) => (
              <div key={idx} className={`flex flex-col ${line.speakerId === 'player' ? 'items-end' : 'items-start'}`}>
                <span className="text-xs text-amber-500/70 mb-0.5 px-1">
                  {resolveSpeakerName(line.speakerId, line.speakerName)}
                </span>
                <div className={`
                  px-3 py-2 rounded-lg max-w-[90%] text-sm
                  ${line.speakerId === 'player'
                    ? 'bg-amber-900/30 text-amber-100 border border-amber-700/30'
                    : 'bg-gray-700/50 text-gray-200 border border-gray-600/30'
                  }
                `}>
                  {line.text}
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    return (
      <div className="flex flex-col h-full overflow-y-auto custom-scrollbar">
        {(!archivedBanters || archivedBanters.length === 0) && (
          <div className="text-gray-500 text-sm italic text-center mt-8">No memories archived yet.</div>
        )}
        <div className="space-y-2">
          {archivedBanters?.map(moment => (
            <button
              key={moment.id}
              onClick={() => setSelectedMomentId(moment.id)}
              className="w-full text-left p-3 rounded bg-gray-800 hover:bg-gray-700 border border-gray-700 transition-colors"
            >
              <div className="flex justify-between items-start mb-1">
                <span className="text-amber-500 text-xs font-medium">
                  {new Date(moment.timestamp).toLocaleDateString()}
                </span>
                <span className="text-gray-500 text-[10px]">{moment.locationId}</span>
              </div>
              <div className="text-gray-300 text-sm line-clamp-2">
                <span className="text-amber-500/80 mr-1">
                  {resolveSpeakerName(moment.lines[0]?.speakerId, moment.lines[0]?.speakerName)}:
                </span>
                {moment.lines[0]?.text || '...'}
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  };

  const renderContent = () => (
    <>
      {/* Tabs */}
      <div className="flex border-b border-gray-700 mb-2">
        <button
          onClick={() => { setActiveTab('LIVE'); setSelectedMomentId(null); }}
          className={`flex-1 py-2 text-sm font-medium transition-colors ${activeTab === 'LIVE' ? 'text-amber-400 border-b-2 border-amber-400' : 'text-gray-500 hover:text-gray-300'}`}
        >
          Live Chat{' '}
          {isActive && (
            <span className={`ml-1 w-2 h-2 inline-block rounded-full ${isPlayerDirected && isWaitingForPlayerResponse ? 'bg-amber-400 animate-pulse' : 'bg-green-500 animate-pulse'}`} />
          )}
        </button>
        <button
          onClick={() => setActiveTab('MEMORIES')}
          className={`flex-1 py-2 text-sm font-medium transition-colors ${activeTab === 'MEMORIES' ? 'text-amber-400 border-b-2 border-amber-400' : 'text-gray-500 hover:text-gray-300'}`}
        >
          Memories
        </button>
      </div>

      <div className="flex-grow overflow-hidden relative">
        {activeTab === 'LIVE' ? renderChatContent() : renderMemoriesContent()}
      </div>
    </>
  );

  // ─── Mode: FLOATING WINDOW ────────────────────────────────────────────────
  if (mode === 'FLOATING') {
    return (
      <WindowFrame
        title="Conversation"
        onClose={() => setMode('COLLAPSED')}
        headerActions={
          <button
            onClick={() => setMode('EXPANDED')}
            className="p-1 hover:bg-gray-700 rounded text-gray-400 hover:text-white"
            title="Dock to side"
          >
            ⇲
          </button>
        }
      >
        <div className="p-4 h-full bg-gray-800 flex flex-col">
          {renderContent()}
        </div>
      </WindowFrame>
    );
  }

  // ─── Mode: SIDE PANEL (EXPANDED) ──────────────────────────────────────────
  if (mode === 'EXPANDED') {
    return (
      <motion.div
        id={UI_ID.BANTER_PANEL_EXPANDED}
        data-testid={UI_ID.BANTER_PANEL_EXPANDED}
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        className={`fixed right-0 top-1/4 bottom-1/4 w-96 bg-gray-800 shadow-2xl z-[var(--z-index-content-overlay-medium)] flex flex-col
          ${isPlayerDirected && isWaitingForPlayerResponse
            ? 'border-l border-y border-amber-500/70'
            : 'border-l border-amber-500/50'
          }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 bg-gray-900/80 border-b border-gray-700 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-amber-400">💬</span>
            <span className="text-gray-200 font-medium text-sm">
              {isPlayerDirected && isWaitingForPlayerResponse
                ? `${generatingSpeakerName || 'Companion'} speaks to you`
                : 'Conversation'}
            </span>
          </div>
          <div className="flex gap-1">
            <button onClick={() => setMode('FLOATING')} className="p-1 hover:bg-gray-700 rounded text-gray-400 hover:text-white" title="Pop out">⇱</button>
            <button onClick={() => setMode('COLLAPSED')} className="p-1 hover:bg-gray-700 rounded text-gray-400 hover:text-white" title="Collapse">→</button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-grow p-4 overflow-hidden flex flex-col">
          {renderContent()}
        </div>
      </motion.div>
    );
  }

  // ─── Mode: COLLAPSED TAB ──────────────────────────────────────────────────
  const isNudging = isActive && isPlayerDirected && isWaitingForPlayerResponse;

  return (
    <motion.div
      id={UI_ID.BANTER_PANEL_COLLAPSED}
      data-testid={UI_ID.BANTER_PANEL_COLLAPSED}
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      className="fixed right-0 top-1/3 z-[var(--z-index-content-overlay-medium)]"
    >
      <button
        onClick={() => setMode('EXPANDED')}
        className={`flex items-center gap-2 pl-3 pr-2 py-3 bg-gray-800 border-l border-y rounded-l-xl shadow-lg hover:bg-gray-700 transition-all group
          ${isNudging
            ? 'border-amber-400/80 shadow-amber-500/30 ring-2 ring-amber-400/50 animate-pulse'
            : 'border-amber-500/30'
          }`}
      >
        <span className="text-amber-400 text-lg group-hover:scale-110 transition-transform">💬</span>
        <div className="flex flex-col items-start">
          <span className="text-xs font-bold text-gray-300 uppercase tracking-wider">Chat</span>
          {isNudging && (
            <span className="text-[10px] text-amber-300 font-medium whitespace-nowrap">
              {generatingSpeakerName || 'Companion'} asks you!
            </span>
          )}
          {isActive && isGenerating && !isNudging && (
            <span className="text-[10px] text-green-500 animate-pulse">Responding...</span>
          )}
          {isActive && isWaiting && secondsRemaining > 0 && !isGenerating && !isNudging && (
            <span className="text-[10px] text-amber-500 tabular-nums">{secondsRemaining}s</span>
          )}
          {!isActive && (
            <span className="text-[10px] text-gray-500">History</span>
          )}
        </div>
        {/* Pulsing response countdown badge on the tab */}
        {isNudging && playerResponseDeadlineSeconds > 0 && (
          <span className={`ml-1 text-[10px] tabular-nums font-semibold px-1 py-0.5 rounded
            ${playerResponseDeadlineSeconds <= 30 ? 'bg-amber-500 text-gray-900' : 'bg-amber-900/60 text-amber-300'}`}
          >
            {playerResponseDeadlineSeconds}s
          </span>
        )}
      </button>
    </motion.div>
  );
};
