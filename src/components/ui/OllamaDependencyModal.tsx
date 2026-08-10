// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 09/08/2026, 16:22:21
 * Dependents: components/DesignPreview/steps/PreviewComponents.tsx, components/gameEntry/OpeningSituationGate.tsx, components/layout/GameModals.tsx
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

type GroqProxyCheckState =
  | { status: 'idle' }
  | { status: 'checking' }
  | { status: 'starting' }
  | { status: 'ready' }
  | { status: 'reachable' }
  | { status: 'missing-key' }
  | { status: 'unreachable' }
  | { status: 'start-failed' };

type GroqProxyHealthResult = Extract<
  GroqProxyCheckState,
  { status: 'ready' | 'reachable' | 'missing-key' | 'unreachable' }
>;

interface GroqProxyHealthResponse {
  ok?: boolean;
  keyLoaded?: boolean;
}

// Proxy checks should fail quickly enough to help during setup instead of
// inheriting the much longer generation timeout used for actual model calls.
const GROQ_PROXY_CHECK_TIMEOUT_MS = 3_000;
const GROQ_PROXY_START_CHECK_TIMEOUT_MS = 750;
const GROQ_PROXY_START_POLL_DELAY_MS = 400;
const GROQ_PROXY_START_POLL_ATTEMPTS = 15;
const GROQ_PROXY_START_ENDPOINT = '/__groq/start';

// Both supported proxy hosts expose health beside their `/v1` API mount:
// `http://localhost:8787/v1` becomes `.../health`, while the Vite-integrated
// `/__groq/v1` becomes `/__groq/health` on the current Aralia origin.
const getGroqProxyHealthUrl = (proxyUrl: string): string => {
  const normalizedUrl = proxyUrl.trim().replace(/\/+$/, '');
  return normalizedUrl.endsWith('/v1')
    ? `${normalizedUrl.slice(0, -3)}/health`
    : `${normalizedUrl}/health`;
};

// The dev server will only launch the bundled proxy on an explicit unprivileged
// loopback port. Keeping the same rule in the UI avoids presenting a Start
// button for remote services or for Vite's already-integrated `/__groq/v1` path.
const getStartableGroqProxyPort = (proxyUrl: string): number | null => {
  try {
    const parsedUrl = new URL(proxyUrl.trim());
    const normalizedPath = parsedUrl.pathname.replace(/\/+$/, '');
    const isLoopbackHost = parsedUrl.hostname === 'localhost'
      || parsedUrl.hostname === '127.0.0.1'
      || parsedUrl.hostname === '[::1]';
    const port = Number(parsedUrl.port);

    return parsedUrl.protocol === 'http:'
      && isLoopbackHost
      && normalizedPath === '/v1'
      && Number.isInteger(port)
      && port >= 1_024
      && port <= 65_535
      ? port
      : null;
  } catch {
    return null;
  }
};

// Health checks never send the browser's Groq key or a generation prompt. A
// shorter timeout can be supplied while polling a newly launched process.
const checkGroqProxyHealth = async (
  proxyUrl: string,
  timeoutMs = GROQ_PROXY_CHECK_TIMEOUT_MS,
): Promise<GroqProxyHealthResult> => {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(getGroqProxyHealthUrl(proxyUrl), {
      method: 'GET',
      signal: controller.signal,
    });
    if (!response.ok) return { status: 'unreachable' };

    const health = await response.json() as GroqProxyHealthResponse;
    return health.keyLoaded === true
      ? { status: 'ready' }
      : health.keyLoaded === false
        ? { status: 'missing-key' }
        : { status: 'reachable' };
  } catch {
    // A refused port, CORS rejection, or timeout all mean the current browser
    // cannot use this proxy URL, which is the player-facing fact that matters.
    return { status: 'unreachable' };
  } finally {
    window.clearTimeout(timeoutId);
  }
};

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
  // This state reports whether Aralia can reach the selected local proxy and
  // whether that proxy has loaded its server-side Groq credential.
  const [groqProxyCheck, setGroqProxyCheck] = useState<GroqProxyCheckState>({ status: 'idle' });
  const [currentProvider, setCurrentProvider] = useState<'ollama' | 'groq'>(() =>
    typeof window !== 'undefined' ? getAiTextProvider() : 'ollama'
  );
  // The long Ollama explainer is grouped in one bordered container that folds.
  // Default it OPEN when Ollama is active (the player likely needs the setup
  // steps) and CLOSED when Groq is on (the whole block is then just noise).
  const [isOllamaInfoOpen, setIsOllamaInfoOpen] = useState<boolean>(() =>
    typeof window === 'undefined' || getAiTextProvider() !== 'groq'
  );

  // Keep the local view of provider/key/mode in sync whenever the pane
  // (re)opens, in case a setting changed elsewhere while it was closed.
  useEffect(() => {
    if (!isOpen) return;
    const storedKeyMode = getGroqKeyStorage();
    setCurrentProvider(getAiTextProvider());
    setIsOllamaInfoOpen(getAiTextProvider() !== 'groq');
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
    setGroqProxyCheck({ status: 'idle' });
  };

  // Ask the proxy's dedicated health route whether it is reachable. This does
  // not send a prompt or a credential from the browser, and it distinguishes a
  // running proxy with no loaded key from a port that Aralia cannot reach at all.
  const handleCheckGroqProxy = async () => {
    setGroqProxyCheck({ status: 'checking' });
    setGroqProxyCheck(await checkGroqProxyHealth(groqProxyUrlInput));
  };

  // Ask the local Vite server to launch the repository's fixed proxy script,
  // then poll health until the new process is ready. The browser supplies only
  // the loopback URL; it never supplies a command, executable, path, or key.
  const handleStartGroqProxy = async () => {
    if (getStartableGroqProxyPort(groqProxyUrlInput) === null) return;
    setGroqProxyCheck({ status: 'starting' });

    try {
      // Avoid spawning a duplicate process when the configured proxy is already
      // healthy but the operator has not pressed Check yet.
      const currentHealth = await checkGroqProxyHealth(
        groqProxyUrlInput,
        GROQ_PROXY_START_CHECK_TIMEOUT_MS,
      );
      if (currentHealth.status !== 'unreachable') {
        setGroqProxyCheck(currentHealth);
        return;
      }

      const response = await fetch(GROQ_PROXY_START_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proxyUrl: groqProxyUrlInput.trim() }),
      });
      if (!response.ok) throw new Error('proxy start request failed');

      for (let attempt = 0; attempt < GROQ_PROXY_START_POLL_ATTEMPTS; attempt += 1) {
        const health = await checkGroqProxyHealth(
          groqProxyUrlInput,
          GROQ_PROXY_START_CHECK_TIMEOUT_MS,
        );
        if (health.status !== 'unreachable') {
          setGroqProxyCheck(health);
          return;
        }
        if (attempt < GROQ_PROXY_START_POLL_ATTEMPTS - 1) {
          await new Promise<void>((resolve) => {
            window.setTimeout(resolve, GROQ_PROXY_START_POLL_DELAY_MS);
          });
        }
      }

      setGroqProxyCheck({ status: 'start-failed' });
    } catch {
      setGroqProxyCheck({ status: 'start-failed' });
    }
  };

  const startableGroqProxyPort = getStartableGroqProxyPort(groqProxyUrlInput);

  // In proxy mode there is no key in the browser: only a reachable proxy URL is
  // required. Otherwise a key must be present. This gates the "Use Groq" button.
  const canActivateGroq =
    groqKeyStorage === 'proxy' ? groqProxyUrlInput.trim().length > 0 : groqKeyInput.trim().length > 0;

  // Plain-language label for how the active Groq key is handled, shown in the
  // top status banner so the player sees which mode is live at a glance.
  const groqModeLabel =
    groqKeyStorage === 'proxy' ? 'local proxy'
      : groqKeyStorage === 'session' ? 'session key'
        : 'saved key';

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
                      {/* Currently-active provider — the first thing the player sees, so the
                          pane reflects what's actually powering AI text instead of always
                          reading "Ollama required". Flips to a positive Groq state when set. */}
                      <div
                        data-testid="active-provider-banner"
                        className={`flex items-start gap-2 rounded p-3 border-l-4 ${
                          currentProvider === 'groq'
                            ? 'bg-sky-500/10 border-sky-400/70 text-sky-100'
                            : 'bg-gray-800/60 border-gray-500/50 text-gray-200'
                        }`}
                      >
                        <span aria-hidden="true" className="leading-none text-base">
                          {currentProvider === 'groq' ? '☁️' : '🖥️'}
                        </span>
                        <span className="min-w-0">
                          <strong>Currently active:</strong>{' '}
                          {currentProvider === 'groq' ? (
                            <>Groq cloud ({groqModeLabel}) — Ollama isn't needed while this is on.</>
                          ) : (
                            <>Ollama (local model) — the default.</>
                          )}
                        </span>
                      </div>

                      {/* The whole Ollama explainer lives in ONE bordered container
                          that collapses. When Groq is active this block is just noise,
                          so it folds away (default-collapsed for Groq, open for Ollama). */}
                      <div
                        data-testid="ollama-info-container"
                        className="rounded-lg border border-amber-500/30 overflow-hidden"
                      >
                        <button
                          type="button"
                          onClick={() => setIsOllamaInfoOpen((o) => !o)}
                          aria-expanded={isOllamaInfoOpen}
                          aria-controls="ollama-info-body"
                          data-testid="ollama-info-toggle"
                          className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left bg-amber-500/5 hover:bg-amber-500/10 transition-colors"
                        >
                          <span className="font-semibold text-amber-200">
                            About Ollama — what it is and how to start it
                          </span>
                          <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className={`shrink-0 text-amber-300 transition-transform duration-300 ${isOllamaInfoOpen ? 'rotate-180' : ''}`}
                            aria-hidden="true"
                          >
                            <polyline points="6 9 12 15 18 9" />
                          </svg>
                        </button>

                        {/* Conditionally render the explainer: mounted when open, gone
                            when collapsed. Simple and always correct. Animated collapses all
                            proved brittle in this exact layout (grid 0fr floors at
                            min-content; framer auto-height stalls at ~1px; a max-height
                            transition never settles to 0 here), so the toggle snaps. The
                            chevron rotation is the affordance. */}
                        {isOllamaInfoOpen && (
                              <div id="ollama-info-body" className="space-y-4 p-4 border-t border-amber-500/20">
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
                              </div>
                        )}
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
                        <>
                          <Input
                            type="text"
                            label="Local proxy URL"
                            placeholder="http://localhost:8787/v1"
                            value={groqProxyUrlInput}
                            data-testid="groq-proxy-url-input"
                            onChange={(e) => {
                              setGroqProxyUrlInput(e.target.value);
                              setGroqProxyCheck({ status: 'idle' });
                            }}
                            autoComplete="off"
                          />
                          {/* A model request is too slow and expensive for setup
                              diagnostics. The health check gives an immediate,
                              credential-safe answer about this exact proxy URL. */}
                          <div className="mt-3 rounded border border-gray-600/70 bg-gray-900/50 p-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <Button
                                onClick={handleCheckGroqProxy}
                                variant="secondary"
                                size="sm"
                                className="min-h-11"
                                disabled={groqProxyCheck.status === 'checking' || groqProxyCheck.status === 'starting'}
                                data-testid="groq-proxy-check-button"
                              >
                                {groqProxyCheck.status === 'checking' ? 'Checking proxy…' : 'Check proxy'}
                              </Button>
                              {startableGroqProxyPort !== null && (
                                <Button
                                  onClick={handleStartGroqProxy}
                                  variant="action"
                                  size="sm"
                                  className="min-h-11"
                                  disabled={groqProxyCheck.status === 'checking' || groqProxyCheck.status === 'starting'}
                                  data-testid="groq-proxy-start-button"
                                >
                                  {groqProxyCheck.status === 'starting' ? 'Starting proxy…' : 'Start proxy'}
                                </Button>
                              )}
                              <p
                                role="status"
                                aria-live="polite"
                                data-testid="groq-proxy-check-status"
                                className={`text-xs leading-relaxed ${
                                  groqProxyCheck.status === 'ready' || groqProxyCheck.status === 'reachable'
                                    ? 'text-emerald-300'
                                    : groqProxyCheck.status === 'idle'
                                      || groqProxyCheck.status === 'checking'
                                      || groqProxyCheck.status === 'starting'
                                      ? 'text-gray-400'
                                      : 'text-red-300'
                                }`}
                              >
                                {groqProxyCheck.status === 'idle' && 'Check whether Aralia can reach this proxy.'}
                                {groqProxyCheck.status === 'checking' && 'Contacting the proxy health endpoint…'}
                                {groqProxyCheck.status === 'starting' && 'Starting the bundled proxy and waiting for its health endpoint…'}
                                {groqProxyCheck.status === 'ready' && 'Proxy is running and its Groq credential is loaded.'}
                                {groqProxyCheck.status === 'reachable' && 'Proxy is running and responding.'}
                                {groqProxyCheck.status === 'missing-key' && 'Proxy is running, but no Groq credential is loaded.'}
                                {groqProxyCheck.status === 'unreachable' && 'Proxy is not reachable from Aralia at this URL.'}
                                {groqProxyCheck.status === 'start-failed' && 'The proxy process could not be started or did not become reachable.'}
                              </p>
                            </div>
                          </div>
                        </>
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
