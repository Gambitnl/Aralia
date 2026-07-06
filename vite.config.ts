import path from 'path';
import fs from 'fs';
import { defineConfig, loadEnv } from 'vite';
import type { ProxyOptions } from 'vite';
import type { IncomingMessage, ServerResponse } from 'http';
import react from '@vitejs/plugin-react';

import {
  roadmapLauncherManager,
  roadmapManager,
  getRoadmapDevServerStatus,
  ROADMAP_DEV_PORT,
  ROADMAP_DEV_OPEN_PATH
} from './scripts/vite-plugins/roadmapManagers';

import { visualizerManager } from './scripts/vite-plugins/visualizerManager';
import { devHubApiManager } from './scripts/vite-plugins/devHubApiManager';
import { atlasApiManager } from './scripts/vite-plugins/atlasApiManager';

import {
  devHubLauncherManager,
  getDevHubDevServerStatus,
  DEVHUB_DEV_PORT,
  DEVHUB_DEV_OPEN_PATH
} from './scripts/vite-plugins/devHubLauncherManager';

import { codexRunManager, codexChatManager } from './scripts/vite-plugins/codexManagers';

// Lazy wrapper: keeps agentUsageProbe.ts OUT of vite's config-dependency watch
// list, so editing probe recipes doesn't restart the dev server (and kill PTY
// sessions / in-flight probes). See skill: vite-dynamic-import-config-deps.
const agentUsageProbe = () => ({
  name: 'agent-usage-probe-lazy',
  async configureServer(server: unknown) {
    const mod = await import('./scripts/vite-plugins/agentUsageProbe');
    return (mod.agentUsageProbe() as { configureServer: (s: unknown) => void }).configureServer(server);
  },
});

// Same lazy pattern: agent-session tiles plugin stays out of the config watch
// list so editing it doesn't restart the server and kill live agent PTYs.
const agentSessionManager = () => ({
  name: 'agent-session-manager-lazy',
  async configureServer(server: unknown) {
    const mod = await import('./scripts/vite-plugins/agentSessionManager');
    return (mod.agentSessionManager() as { configureServer: (s: unknown) => void }).configureServer(server);
  },
});

// Lazy: PAT-vault status endpoint (/api/pat-status). Lazy so editing the
// credential map doesn't restart the dev server.
const patVaultManager = () => ({
  name: 'pat-vault-manager-lazy',
  async configureServer(server: unknown) {
    const mod = await import('./scripts/vite-plugins/patVaultManager');
    return (mod.patVaultManager() as { configureServer: (s: unknown) => void }).configureServer(server);
  },
});

// Same lazy pattern: the sticky PTY + shell terminals hold live node-pty
// processes and WebSocket servers. Keeping them OUT of the config-dependency
// watch list means editing the manager no longer triggers a full server
// restart (which used to kill the live terminals — and, when a restart raced a
// second config-dep change, crashed the whole dev server with
// ERR_SERVER_ALREADY_LISTEN).
const ptyTerminalManager = () => ({
  name: 'pty-terminal-manager-lazy',
  async configureServer(server: unknown) {
    const mod = await import('./scripts/vite-plugins/ptyTerminalManager');
    return (mod.ptyTerminalManager() as { configureServer: (s: unknown) => void }).configureServer(server);
  },
});
const shellTerminalManager = () => ({
  name: 'shell-terminal-manager-lazy',
  async configureServer(server: unknown) {
    const mod = await import('./scripts/vite-plugins/ptyTerminalManager');
    return (mod.shellTerminalManager() as { configureServer: (s: unknown) => void }).configureServer(server);
  },
});
import { portraitApiManager } from './scripts/vite-plugins/portraitApiManager';
import { sceneApiManager } from './scripts/vite-plugins/sceneApiManager';

import {
  conductorManager,
  scanManager,
  gitStatusManager,
  scriptRegistryManager,
  glossaryIndexManager,
  glossarySpellGateManager,
  traitApprovalManager
} from './scripts/vite-plugins/miscManagers';

import { formatProxyTarget } from './scripts/vite-plugins/utils';

/**
 * Helper to add diagnostic hints to Vite proxy errors.
 *
 * The main game treats Ollama as an optional local dependency at startup. When
 * the startup heartbeat asks for `/api/ollama/tags` and Ollama is not running,
 * the proxy should answer with an empty model list instead of a browser-visible
 * 500. Generation and chat requests still fail loudly so real AI work does not
 * look successful when the local service is offline.
 */
function addProxyDiagnostics(
  route: string,
  config: ProxyOptions,
  hint: string
): ProxyOptions {
  return {
    ...config,
    configure: (proxy, _options) => {
      proxy.on('error', (err, req: IncomingMessage, res: ServerResponse) => {
        const target = formatProxyTarget(config.target);
        if (err.message.includes('ECONNREFUSED')) {
          console.error(`\n[proxy] ${route} -> ${target} connection refused.`);
          console.error(`[proxy] Hint: ${hint}\n`);
        }

        // Let the startup dependency check fail softly. This keeps the browser
        // console from reporting an internal server error for an optional local
        // service, while the client still sees "no models available" and opens
        // the existing Ollama dependency modal.
        if (route === '/api/ollama' && req.url === '/tags' && !res.headersSent) {
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ models: [] }));
          return;
        }
      });
    }
  };
}

const PLANMAP_DEV_PORT = 5183;

// Dedicated "planmap" dev server: a lean static server (no React, no app
// plugins) that serves public/planmap through Vite's built-in static + /@fs
// bridge — so the map, its spec links, and the glossary all keep working — and
// redirects the app root to the plan-map so the preview panel lands there.
const planmapRedirect = () => ({
  name: 'planmap-redirect',
  configureServer(server: { middlewares: { use: (fn: (req: { url?: string }, res: ServerResponse, next: () => void) => void) => void } }) {
    server.middlewares.use((req, res, next) => {
      const p = (req.url || '').split('?')[0];
      if (p === '/' || p === '/Aralia' || p === '/Aralia/') {
        res.statusCode = 302;
        res.setHeader('Location', '/Aralia/planmap/index.html');
        res.end();
        return;
      }
      next();
    });
  },
});

export default defineConfig(async ({ mode, command }) => {
  const env = loadEnv(mode, '.', '');
  const isDevServer = command === 'serve';
  const isRoadmapMode = mode === 'roadmap';
  const isHubMode = mode === 'hub';
  const isPlanmapMode = mode === 'planmap';

  const isRoadmapOnlyDev = isDevServer && isRoadmapMode;
  const isHubOnlyDev = isDevServer && isHubMode;
  const isPlanmapOnlyDev = isDevServer && isPlanmapMode;

  const roadmapServer = isRoadmapOnlyDev ? await getRoadmapDevServerStatus() : null;
  const devHubServer = isHubOnlyDev ? await getDevHubDevServerStatus() : null;

  const ollamaTarget = 'http://localhost:11434/api';
  const imageTarget = 'http://localhost:3001';

  const mainDevRoadmapWatchIgnored = [
    // CRASH FIX (2026-06-12): chokidar holds one OS handle per watched file.
    // The .agent tree is agent working-state (captures, logs, probe caches,
    // trackers) that NOTHING served by vite imports, yet it's written
    // constantly during agent/orchestration work. Watching it accumulated
    // ~1 handle per file with no upper bound across a session, exhausting the
    // process handle budget and killing the dev server silently in ~30-60 min.
    // Empirically verified: writing 400 files into .agent added exactly 401
    // handles. Ignore the whole transient tree (supersets the roadmap globs
    // below) plus the vendored .tmp source. Source under src/ is unaffected.
    '**/.agent/**',
    '**/.tmp/**',
    '**/.agent/roadmap/**',
    '**/.agent/roadmap-local/**',
    '**/devtools/roadmap/**'
  ];

  // The main app gets the tools it needs.
  // Roadmap mode gets only Roadmap + React.
  // Hub mode gets Dev Hub + React + tools.
  const mainPlugins = [
    react(),
    visualizerManager(),
    roadmapManager(),
    roadmapLauncherManager(),
    devHubLauncherManager(),
    conductorManager(),
    scanManager(),
    gitStatusManager(),
    devHubApiManager(),
    atlasApiManager(),
    glossarySpellGateManager(),
    glossaryIndexManager(),
    traitApprovalManager(),
    scriptRegistryManager(),
    portraitApiManager(),
    sceneApiManager(),
    codexRunManager(),
    codexChatManager(),
    ptyTerminalManager(),
    shellTerminalManager(),
    agentUsageProbe(),
    patVaultManager(),
    agentSessionManager()
  ];
  const roadmapOnlyPlugins = [react(), roadmapManager()];
  const hubOnlyPlugins = [
    react(),
    visualizerManager(),
    roadmapLauncherManager(),
    devHubLauncherManager(),
    conductorManager(),
    scanManager(),
    gitStatusManager(),
    devHubApiManager(),
    atlasApiManager(),
    glossarySpellGateManager(),
    glossaryIndexManager(),
    traitApprovalManager(),
    scriptRegistryManager(),
    portraitApiManager(),
    sceneApiManager(),
    codexRunManager(),
    codexChatManager(),
    ptyTerminalManager(),
    shellTerminalManager(),
    agentUsageProbe(),
    patVaultManager(),
    agentSessionManager()
  ];

  const planmapOnlyPlugins = [planmapRedirect()];
  const plugins = isRoadmapOnlyDev ? roadmapOnlyPlugins
    : isHubOnlyDev ? hubOnlyPlugins
    : isPlanmapOnlyDev ? planmapOnlyPlugins
    : mainPlugins;

  const includeRoadmapBuildEntries = isRoadmapMode;

  if (isDevServer) {
    if (isRoadmapOnlyDev) {
      if (roadmapServer?.running) {
        console.info(`[dev] Roadmap server already active on port ${ROADMAP_DEV_PORT}.`);
        console.info(`[dev] Open: ${roadmapServer.openUrl}`);
        setTimeout(() => process.exit(0), 0);
      }
      console.info('[dev] Mode: roadmap-only (isolated from main app HMR).');
      console.info(`[dev] Roadmap server port: ${ROADMAP_DEV_PORT}`);
      console.info(`[dev] Open: ${ROADMAP_DEV_OPEN_PATH}`);
    } else if (isHubOnlyDev) {
      if (devHubServer?.running) {
        console.info(`[dev] DevHub server already active on port ${DEVHUB_DEV_PORT}.`);
        console.info(`[dev] Open: ${devHubServer.openUrl}`);
        setTimeout(() => process.exit(0), 0);
      }
      console.info('[dev] Mode: hub-only (isolated from main app HMR).');
      console.info(`[dev] DevHub server port: ${DEVHUB_DEV_PORT}`);
      console.info(`[dev] Open: ${DEVHUB_DEV_OPEN_PATH}`);
    } else if (isPlanmapOnlyDev) {
      console.info('[dev] Mode: planmap-only (static plan-map, no app HMR).');
      console.info(`[dev] Planmap server port: ${PLANMAP_DEV_PORT}`);
      console.info('[dev] Open: /Aralia/planmap/index.html (root redirects here)');
    } else {
      console.info('[dev] Mode: main-app (roadmap APIs and roadmap watch paths are disabled).');
      console.info('[dev] Proxy routes:');
      console.info('[dev] /api/ollama -> ' + ollamaTarget + ' (Ollama server)');
      console.info('[dev] /api/image-gen -> ' + imageTarget + ' (image server)');
      console.info('[dev] /generated -> ' + imageTarget + ' (image server)');
    }
  }

  let port = 3000;
  if (isRoadmapOnlyDev) port = ROADMAP_DEV_PORT;
  if (isHubOnlyDev) port = DEVHUB_DEV_PORT;
  if (isPlanmapOnlyDev) port = PLANMAP_DEV_PORT;

  return {
    base: '/Aralia/',
    server: {
      port,
      strictPort: isRoadmapOnlyDev || isHubOnlyDev || isPlanmapOnlyDev,
      host: '0.0.0.0',
      // The planmap server is static — don't warm the React entry (no react
      // plugin in that mode, so transforming index.tsx would just error).
      ...(isPlanmapOnlyDev ? {} : { warmup: { clientFiles: ['./index.tsx', './src/App.tsx'] } }),
      ...(isRoadmapOnlyDev || isPlanmapOnlyDev
        ? {}
        : {
            watch: {
              ignored: mainDevRoadmapWatchIgnored
            },
            proxy: {
              '/api/ollama': addProxyDiagnostics(
                '/api/ollama',
                {
                  target: ollamaTarget,
                  changeOrigin: true,
                  rewrite: (path) => path.replace(/^\/api\/ollama/, ''),
                },
                'Start Ollama (ollama serve) or update the target in vite.config.ts.'
              ),
              '/api/image-gen': addProxyDiagnostics(
                '/api/image-gen',
                {
                  target: imageTarget,
                  changeOrigin: true,
                },
                'Start the image server on port 3001 or update the target in vite.config.ts.'
              ),
              '/generated': addProxyDiagnostics(
                '/generated',
                {
                  target: imageTarget,
                  changeOrigin: true,
                },
                'Start the image server on port 3001 or update the target in vite.config.ts.'
              )
            }
          })
    },
    plugins,
    // SECURITY: do NOT inject the Gemini API key into the client bundle. GitHub Pages is a
    // public static host, so anything `define`d here is extractable from the shipped JS
    // (a real leak happened this way). The browser reads the key only from
    // `import.meta.env.VITE_GEMINI_API_KEY` (set locally via .env for dev); the public
    // build ships no key and simply gates AI features off. See src/config/env.ts getApiKey().
    resolve: {
      dedupe: ['three', '@react-three/fiber', '@react-three/drei'],
      alias: {
        '@': path.resolve(__dirname, 'src'),
      }
    },
    optimizeDeps: {
      include: [
        'three',
        '@react-three/fiber',
        '@react-three/drei',
        '@react-three/postprocessing',
      ],
      // three's TSL BloomNode example imports `PostProcessingUtils`, which the
      // installed three build does not export, so esbuild can't pre-bundle it and
      // the whole dep-optimize pass fails (taking the combat chunk down with it).
      // It is only reached via a lazy dynamic import inside the WebGPU battle-map
      // scene, so excluding it from pre-bundling lets it load on demand without
      // poisoning optimization. Remove once three's TSL display modules match the
      // installed core build.
      exclude: [
        'three/examples/jsm/tsl/display/BloomNode.js',
      ],
    },
    build: {
      rollupOptions: {
        input: {
          main: path.resolve(__dirname, 'index.html'),
          ...(fs.existsSync(path.resolve(__dirname, 'misc', 'design.html'))
            ? { design: path.resolve(__dirname, 'misc', 'design.html') }
            : {}),
          ...(fs.existsSync(path.resolve(__dirname, 'misc', 'dev_hub.html'))
            ? { dev_hub: path.resolve(__dirname, 'misc', 'dev_hub.html') }
            : {}),
          ...(fs.existsSync(path.resolve(__dirname, 'misc', 'url_directory.html'))
            && fs.existsSync(path.resolve(__dirname, 'src', 'url-directory-entry.ts'))
            ? { url_directory: path.resolve(__dirname, 'misc', 'url_directory.html') }
            : {}),
          ...(fs.existsSync(path.resolve(__dirname, 'misc', 'spell_data_validation.html'))
            ? { spell_data_validation: path.resolve(__dirname, 'misc', 'spell_data_validation.html') }
            : {}),
          ...(fs.existsSync(path.resolve(__dirname, 'misc', 'spell_pipeline_atlas.html'))
            ? { spell_pipeline_atlas: path.resolve(__dirname, 'misc', 'spell_pipeline_atlas.html') }
            : {}),
          ...(fs.existsSync(path.resolve(__dirname, 'misc', 'agent_docs.html'))
            && fs.existsSync(path.resolve(__dirname, 'src', 'agent-docs-entry.tsx'))
            ? { agent_docs: path.resolve(__dirname, 'misc', 'agent_docs.html') }
            : {}),
          ...(fs.existsSync(path.resolve(__dirname, 'misc', 'md_library.html'))
            && fs.existsSync(path.resolve(__dirname, 'src', 'md-library-entry.tsx'))
            ? { md_library: path.resolve(__dirname, 'misc', 'md_library.html') }
            : {}),
          ...(fs.existsSync(path.resolve(__dirname, 'misc', 'aralia_atlas.html'))
            && fs.existsSync(path.resolve(__dirname, 'src', 'atlas-entry.tsx'))
            ? { aralia_atlas: path.resolve(__dirname, 'misc', 'aralia_atlas.html') }
            : {}),
          ...(includeRoadmapBuildEntries && fs.existsSync(path.resolve(__dirname, 'devtools', 'roadmap', 'roadmap.html'))
            ? { roadmap: path.resolve(__dirname, 'devtools', 'roadmap', 'roadmap.html') }
            : {}),
          ...(includeRoadmapBuildEntries && fs.existsSync(path.resolve(__dirname, 'devtools', 'roadmap', 'roadmap_docs.html'))
            ? { roadmap_docs: path.resolve(__dirname, 'devtools', 'roadmap', 'roadmap_docs.html') }
            : {})
        },
        output: {
          manualChunks(id) {
            // Isolate Vite's __vitePreload helper into its own ~1KB chunk.
            // Otherwise Rollup parks it inside whichever vendor chunk it likes
            // (here: vendor-react-three, which statically pulls vendor-three).
            // Every lazy chunk imports the helper, so a heavy host chunk gets
            // dragged onto the eager critical path — ~1MB of three.js the menu
            // never renders. Keeping the helper standalone breaks that edge.
            if (id.includes('vite/preload-helper')) {
              return 'vendor-preload-helper';
            }
            if (id.includes('node_modules')) {
              if (id.includes('react-dom') || id.includes('react/') || id.includes('scheduler')) {
                return 'vendor-react';
              }
              if (id.includes('framer-motion')) {
                return 'vendor-framer-motion';
              }
              if (id.includes('lucide-react')) {
                return 'vendor-lucide';
              }
              if (id.includes('pixi.js') || id.includes('@pixi') || id.includes('mini-signals') || id.includes('ismobilejs') || id.includes('earcut')) {
                return 'vendor-pixi';
              }
              if (id.includes('@google/genai')) {
                return 'vendor-ai';
              }
              if (id.includes('zod')) {
                return 'vendor-zod';
              }
              if (id.includes('marked') || id.includes('dompurify') || id.includes('uuid')) {
                return 'vendor-markdown-utils';
              }
              // Heavy 3D libraries are ONLY reached through lazy-loaded 3D
              // components (Scene3D, World3DWrapper, BattleMap3D, dice, etc).
              // They must each get their own chunk so they are NOT glued into
              // a shared "vendor-others" bucket — otherwise a single eager
              // import that lands in that bucket forces the menu to preload
              // megabytes of 3D engine code it never renders (LCP killer).
              if (id.includes('@babylonjs')) {
                return 'vendor-babylon';
              }
              if (id.includes('@takram')) {
                return 'vendor-takram';
              }
              if (id.includes('@3d-dice')) {
                return 'vendor-dice';
              }
              if (id.includes('@dgreenheck') || id.includes('ez-tree')) {
                return 'vendor-eztree';
              }
              if (id.includes('postprocessing')) {
                return 'vendor-postprocessing';
              }
              if (id.includes('@react-three')) {
                return 'vendor-react-three';
              }
              // three core must come AFTER the @react-three/postprocessing
              // checks above so those keep their own chunks.
              if (id.includes('/three/') || id.includes('three-stdlib') || id.includes('/three-')) {
                return 'vendor-three';
              }
              return 'vendor-others';
            }
          }
        }
      }
    }
  };
});
