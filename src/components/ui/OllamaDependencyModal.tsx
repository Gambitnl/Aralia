// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 08/07/2026, 01:10:13
 * Dependents: components/DesignPreview/steps/PreviewComponents.tsx, components/layout/GameModals.tsx
 * Imports: 6 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file src/components/ui/OllamaDependencyModal.tsx
 * @component-owner Narrative Team / Core UI
 * @status Stable / Maintained
 *
 * Non-blocking, right-docked side pane that explains the Ollama dependency.
 *
 * Unlike a modal, this does NOT dim or capture the rest of the app: it renders inside a
 * full-screen `pointer-events-none` positioning layer, and only the pane itself re-enables
 * pointer events, so the main UI stays fully interactive while the pane is open.
 *
 * It is an expandable "window frame": a title bar (with collapse/expand + close controls)
 * is always visible; the body collapses to just that bar and expands again on toggle.
 *
 * Called by: src/components/layout/GameModals.tsx
 * Depends on: Button.tsx, Input.tsx, zIndex.ts, uiIds.ts
 */

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from './Button';
import { Checkbox, Input } from './Input';
import { GeminiFallbackSettings } from './GeminiFallbackSettings';
import { Z_INDEX } from '../../styles/zIndex';
import { UI_ID } from '../../styles/uiIds';
import {
  getAiTextProvider,
  setAiTextProvider,
  getGroqApiKey,
  setGroqApiKey,
  getGroqKeyStorage,
  setGroqKeyStorage,
  getGroqProxyUrl,
  setGroqProxyUrl,
  type GroqKeyStorage,
} from '../../services/ai/aiProviderSettings';

interface OllamaDependencyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDontShowAgain: (value: boolean) => void;
  /**
   * Dev Mode exposes operator-only wiring such as the local proxy path.
   * Normal players should only see direct Groq key modes they can set up alone.
   */
  isDevModeEnabled?: boolean;
  /**
   * Optional callback fired after the player switches provider (to Groq or back
   * to Ollama). The host can use this to re-run the availability check / retry
   * the blocked generation. Falls back to onClose when omitted.
   */
  onProviderChanged?: (provider: 'ollama' | 'groq') => void;
}

const shouldUseCompactPane = (): boolean =>
  typeof window !== 'undefined' && (window.innerWidth < 640 || window.innerHeight < 720);

export const OllamaDependencyModal: React.FC<OllamaDependencyModalProps> = ({
  isOpen,
  onClose,
  onDontShowAgain,
  isDevModeEnabled = false,
  onProviderChanged,
}) => {
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(() => shouldUseCompactPane());

  // Groq cloud-provider controls. The key is user-entered and stored ONLY in
  // localStorage (via aiProviderSettings) — never in the bundle. We seed the
  // field from any previously-stored key so switching back and forth is easy.
  const [groqKeyInput, setGroqKeyInput] = useState<string>(() =>
    typeof window !== 'undefined' ? getGroqApiKey() : ''
  );
  // How the key is handled — the player's explicit choice of the security
  // trade-off (persistent vs session-only vs never-in-browser proxy).
  const [groqKeyStorage, setGroqKeyStorageState] = useState<GroqKeyStorage>(() =>
    typeof window !== 'undefined' ? getGroqKeyStorage() : 'local'
  );
  const [groqProxyUrlInput, setGroqProxyUrlInput] = useState<string>(() =>
    typeof window !== 'undefined' ? getGroqProxyUrl() : ''
  );
  const [currentProvider, setCurrentProvider] = useState<'ollama' | 'groq'>(() =>
    typeof window !== 'undefined' ? getAiTextProvider() : 'ollama'
  );

  // Keep the local view of provider/key/mode in sync whenever the pane
  // (re)opens, in case a setting changed elsewhere while it was closed.
  useEffect(() => {
    if (!isOpen) return;
    const storedKeyMode = getGroqKeyStorage();
    setCurrentProvider(getAiTextProvider());
    // Local proxy depends on a separately installed local router and operator
    // credentials. If Dev Mode is off, move back to the player-setup path so a
    // hidden proxy choice cannot stay active without an explanation.
    if (!isDevModeEnabled && storedKeyMode === 'proxy') {
      setGroqKeyStorage('local');
      setGroqKeyStorageState('local');
    } else {
      setGroqKeyStorageState(storedKeyMode);
    }
    setGroqKeyInput(getGroqApiKey());
    setGroqProxyUrlInput(getGroqProxyUrl());
  }, [isOpen, isDevModeEnabled]);

  // Switching mode persists the choice immediately, then re-reads the key from
  // whichever store the new mode selects (proxy carries no key, so it clears).
  const handleSelectKeyStorage = (mode: GroqKeyStorage) => {
    setGroqKeyStorage(mode);
    setGroqKeyStorageState(mode);
    setGroqKeyInput(getGroqApiKey());
  };

  // In proxy mode there is no key in the browser: only a reachable proxy URL is
  // required. Otherwise a key must be present. This gates the "Use Groq" button.
  const canActivateGroq =
    groqKeyStorage === 'proxy' ? groqProxyUrlInput.trim().length > 0 : groqKeyInput.trim().length > 0;

  const handleUseGroq = () => {
    if (!canActivateGroq) return; // The button is disabled otherwise; guard anyway.
    if (groqKeyStorage === 'proxy') {
      setGroqProxyUrl(groqProxyUrlInput.trim());
    } else {
      setGroqApiKey(groqKeyInput.trim());
    }
    setAiTextProvider('groq');
    setCurrentProvider('groq');
    if (onProviderChanged) {
      onProviderChanged('groq');
    } else {
      onClose();
    }
  };

  const handleUseOllama = () => {
    setAiTextProvider('ollama');
    setCurrentProvider('ollama');
    if (onProviderChanged) {
      onProviderChanged('ollama');
    }
  };

  // The pane starts in the top-right corner and stays anchored there while collapsing.
  // This avoids an intermediate jump from center-right to top-right when the user minimizes it.
  const positioningClass = 'items-start justify-end';

  // The expanded pane keeps the original readable width. The collapsed pane uses a fixed
  // compact width so the still-animating body text cannot stretch the frame while it exits.
  const paneWidthClass = isCollapsed ? 'w-64 max-w-[calc(100vw-2rem)]' : 'w-full max-w-md';

  // The title bar is slightly tighter in the collapsed state so the remaining tab is compact
  // while preserving the same expand and close controls for recovery.
  const titleBarClass = isCollapsed ? 'px-3 py-2' : 'px-5 py-3';
  const titleHeadingClass = isCollapsed
    ? 'min-w-0 flex-1 truncate text-base font-bold text-amber-300'
    : 'min-w-0 basis-full text-lg font-bold text-amber-300 sm:basis-auto sm:flex-1 sm:truncate';

  // Collapse should feel deliberate without letting the frame sweep across the play area.
  // A shared duration keeps the body and arrow from finishing at different moments.
  const collapseAnimationDurationSeconds = 0.4;

  const handleClose = () => {
    if (dontShowAgain) {
      onDontShowAgain(true);
    }
    onClose();
  };

  const handleLearnMore = () => {
    window.open('https://ollama.ai', '_blank');
  };

  // Escape closes the pane (non-trapping — focus is never locked to the pane).
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, dontShowAgain]);

  useEffect(() => {
    if (!isOpen) return;

    const collapseForCompactViewport = () => {
      if (shouldUseCompactPane()) {
        setIsCollapsed(true);
      }
    };

    // In phone-width or short desktop windows, the expanded non-modal pane can cover
    // menu controls. Start compact there, but still let the player expand it deliberately.
    collapseForCompactViewport();
    window.addEventListener('resize', collapseForCompactViewport);
    return () => window.removeEventListener('resize', collapseForCompactViewport);
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        // Full-screen positioning layer — transparent and click-through, so the pane never
        // blocks the main UI. Only the pane below re-enables pointer events.
        <div
          id={UI_ID.OLLAMA_DEPENDENCY_MODAL}
          data-testid={UI_ID.OLLAMA_DEPENDENCY_MODAL}
          className={`fixed inset-0 flex ${positioningClass} p-4 pointer-events-none z-[${Z_INDEX.MODAL_BACKGROUND}]`}
        >
          <motion.aside
            className={`pointer-events-auto bg-gray-900 border border-amber-500/60 rounded-xl shadow-2xl ${paneWidthClass} text-gray-100 focus:outline-none flex flex-col max-h-[calc(100vh-2rem)] overflow-hidden`}
            role="region"
            aria-labelledby="ollama-modal-title"
            tabIndex={-1}
            initial={{ x: 48, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 48, opacity: 0 }}
            transition={{ duration: collapseAnimationDurationSeconds, ease: 'easeOut' }}
          >
            {/* Window-frame title bar — always visible; click to collapse/expand. */}
            <div
              className={`flex flex-wrap items-center justify-between gap-2 ${titleBarClass} border-b border-amber-500/20 bg-gray-900/80 cursor-pointer select-none shrink-0`}
              onClick={() => setIsCollapsed((c) => !c)}
              role="button"
              aria-expanded={!isCollapsed}
              aria-controls="ollama-pane-body"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setIsCollapsed((c) => !c);
                }
              }}
            >
              <h2 id="ollama-modal-title" className={titleHeadingClass}>
                Ollama Dependency
              </h2>
              <div className="ml-auto flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  aria-label={isCollapsed ? 'Expand pane' : 'Collapse pane'}
                  title={isCollapsed ? 'Expand' : 'Collapse'}
                  className="flex h-11 w-11 items-center justify-center rounded text-gray-400 hover:text-amber-200 hover:bg-gray-800 transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsCollapsed((c) => !c);
                  }}
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className={`transition-transform duration-[400ms] ${isCollapsed ? '' : 'rotate-180'}`}
                    aria-hidden="true"
                  >
                    <polyline points="18 15 12 9 6 15" />
                  </svg>
                </button>
                <button
                  type="button"
                  aria-label="Close pane"
                  title="Close"
                  className="flex h-11 w-11 items-center justify-center rounded text-gray-400 hover:text-amber-200 hover:bg-gray-800 transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleClose();
                  }}
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Collapsible body */}
            <AnimatePresence initial={false}>
              {!isCollapsed && (
                <motion.div
                  id="ollama-pane-body"
                  key="ollama-pane-body"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: collapseAnimationDurationSeconds, ease: 'easeOut' }}
                  className="min-h-0 flex-1 flex flex-col overflow-hidden"
                >
                  {/* The explanation and preference control are the only scrolling content.
                      The footer below stays visible so players can always dismiss the pane. */}
                  <div data-testid="ollama-pane-scroll" className="min-h-0 flex-1 overflow-y-auto p-5 pb-4">
                    <div className="space-y-4 text-sm text-gray-300 leading-relaxed mb-6">
                      <p>
                        Aralia uses <strong>Ollama</strong>, a local AI service, to write dialogue and scenes on the fly.
                        Several core parts of the game <strong>do not work</strong> without it — Ollama is not optional for those.
                      </p>

                      <div className="bg-gray-800/50 border-l-4 border-amber-500/40 p-4 rounded">
                        <h3 className="text-amber-200 font-semibold mb-2">ℹ️ What's Ollama?</h3>
                        <p>
                          Ollama is an open-source tool that runs large language models locally on your computer.
                          This means AI features work entirely offline, with no data sent to external servers.
                        </p>
                      </div>

                      <div>
                        <h3 className="text-red-300 font-semibold mb-2">Without Ollama, these DON'T work:</h3>
                        <ul className="list-disc list-inside space-y-1 ml-2">
                          <li>The opening scene of a new game (it will stop and ask you to start Ollama)</li>
                          <li>Talking to NPCs — their replies are generated live</li>
                          <li>Live conversations with your companions</li>
                        </ul>
                      </div>

                      <div>
                        <h3 className="text-amber-200 font-semibold mb-2">What still works without it:</h3>
                        <p>
                          Companions still react to events (loot, crimes, discoveries) using pre-written lines — just not
                          freshly-written ones. Everything mechanical (combat, travel, inventory, leveling) is unaffected.
                        </p>
                      </div>

                      <div>
                        <h3 className="text-amber-200 font-semibold mb-2">To start Ollama:</h3>
                        <ol className="list-decimal list-inside space-y-1 ml-2">
                          <li>Install it from <span className="text-amber-300">ollama.ai</span> (see Learn More below).</li>
                          <li>Pull a model once, e.g. <code className="bg-gray-800 px-1 rounded">ollama pull llama3</code>.</li>
                          <li>Make sure it is running (it serves on <code className="bg-gray-800 px-1 rounded">localhost:11434</code>), then retry.</li>
                        </ol>
                      </div>

                      {/* Cloud alternative: let players who don't want a local model
                          supply their own Google Gemini credential instead. */}
                      <GeminiFallbackSettings />
                    </div>

                    {/* --- Groq cloud provider toggle --------------------------------
                        A deliberate provider CHOICE (not silent fallback): the
                        player pastes their own Groq API key, which is stored only
                        in this browser's localStorage, and switches all AI text
                        generation to Groq's cloud. A "switch back to Ollama" path
                        is always offered. */}
                    <div
                      data-testid="groq-provider-section"
                      className="mb-6 bg-gray-800/50 border-l-4 border-sky-500/50 p-4 rounded"
                    >
                      <h3 className="text-sky-200 font-semibold mb-2">☁️ Use Groq cloud instead</h3>
                      <p className="text-sm text-gray-300 leading-relaxed mb-3">
                        No local Ollama? Run the game's AI text on <strong>Groq</strong>'s fast cloud
                        models. Choose how your key is handled below, then switch — you can go back to
                        Ollama anytime.
                      </p>
                      {/* This official Groq Console link gives players a direct path
                          to create or manage the key they need for local/session mode. */}
                      <a
                        href="https://console.groq.com/keys"
                        target="_blank"
                        rel="noreferrer"
                        className="mb-3 inline-flex text-sm font-semibold text-sky-200 underline decoration-sky-400/60 underline-offset-4 hover:text-sky-100"
                      >
                        Get a Groq API key
                      </a>

                      {/* Key-handling mode selector. Each option is a real
                          security trade-off the player picks, with a one-line
                          plain-English safety note. */}
                      <fieldset data-testid="groq-key-mode" className="mb-3">
                        <legend className="text-xs font-semibold text-sky-200 mb-1">How to handle your key</legend>
                        <div className="flex flex-col gap-1">
                          {([
                            {
                              mode: 'local' as const,
                              title: 'Persistent',
                              note: 'Saved in this browser; stays after you close the tab — but readable if the app is ever compromised (XSS).',
                            },
                            {
                              mode: 'session' as const,
                              title: 'Session-only',
                              note: 'Kept only until you close the tab, then wiped. Smaller theft window; nothing left on disk.',
                            },
                            {
                              mode: 'proxy' as const,
                              title: 'Local proxy',
                              note: 'Key never enters the browser — a local proxy holds it and adds it server-side. Safest.',
                            },
                            // The proxy row is developer/operator-only because
                            // it requires a separate localhost router and host
                            // credential setup that normal players will not have.
                          ].filter(({ mode }) => isDevModeEnabled || mode !== 'proxy')).map(({ mode, title, note }) => (
                            <label
                              key={mode}
                              className={`flex items-start gap-2 rounded p-2 cursor-pointer border ${
                                groqKeyStorage === mode
                                  ? 'border-sky-500/60 bg-sky-500/10'
                                  : 'border-transparent hover:bg-gray-800/60'
                              }`}
                            >
                              <input
                                type="radio"
                                name="groq-key-mode"
                                value={mode}
                                checked={groqKeyStorage === mode}
                                onChange={() => handleSelectKeyStorage(mode)}
                                data-testid={`groq-key-mode-${mode}`}
                                className="mt-1 accent-sky-500"
                              />
                              <span className="min-w-0">
                                <span className="block text-sm font-medium text-gray-100">{title}</span>
                                <span className="block text-xs text-gray-400 leading-snug">{note}</span>
                              </span>
                            </label>
                          ))}
                        </div>
                      </fieldset>

                      {groqKeyStorage === 'proxy' ? (
                        <Input
                          type="text"
                          label="Local proxy URL"
                          placeholder="http://localhost:8787/v1"
                          value={groqProxyUrlInput}
                          data-testid="groq-proxy-url-input"
                          onChange={(e) => setGroqProxyUrlInput(e.target.value)}
                          autoComplete="off"
                        />
                      ) : (
                        <Input
                          type="password"
                          label="Groq API key"
                          placeholder="gsk_..."
                          value={groqKeyInput}
                          data-testid="groq-api-key-input"
                          onChange={(e) => setGroqKeyInput(e.target.value)}
                          autoComplete="off"
                        />
                      )}
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <Button
                          onClick={handleUseGroq}
                          variant="action"
                          size="sm"
                          className="min-h-11"
                          disabled={!canActivateGroq}
                          data-testid="groq-use-button"
                        >
                          {currentProvider === 'groq' ? 'Save key & retry' : 'Use Groq cloud'}
                        </Button>
                        {currentProvider === 'groq' && (
                          <Button
                            onClick={handleUseOllama}
                            variant="secondary"
                            size="sm"
                            className="min-h-11"
                            data-testid="groq-switch-back-button"
                          >
                            Switch back to Ollama
                          </Button>
                        )}
                      </div>
                      {currentProvider === 'groq' && (
                        <p className="mt-2 text-xs text-sky-300" data-testid="groq-active-indicator">
                          AI text is currently set to Groq cloud.
                        </p>
                      )}
                    </div>

                    {/* Reusable premium Checkbox primitive for tracking user preference */}
                    <div className="mb-6">
                      <Checkbox
                        label="Don't show this again"
                        checked={dontShowAgain}
                        onChange={(e) => setDontShowAgain(e.target.checked)}
                      />
                    </div>

                  </div>

                  {/* Action footer stays outside the scroll area so short viewports
                      never hide the dismissal buttons below the pane edge. */}
                  <div data-testid="ollama-pane-footer" className="shrink-0 border-t border-amber-500/20 bg-gray-900/95 p-4 flex justify-end space-x-3">
                    <Button onClick={handleLearnMore} variant="secondary" size="md" className="min-h-11">
                      Learn More
                    </Button>
                    <Button onClick={handleClose} variant="action" size="md" className="min-h-11">
                      Continue
                    </Button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
};
