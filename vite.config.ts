import path from 'path';
import fs from 'fs';
import { defineConfig, loadEnv } from 'vite';
import type { ProxyOptions } from 'vite';
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

import {
  devHubLauncherManager,
  getDevHubDevServerStatus,
  DEVHUB_DEV_PORT,
  DEVHUB_DEV_OPEN_PATH
} from './scripts/vite-plugins/devHubLauncherManager';

import { codexRunManager, codexChatManager } from './scripts/vite-plugins/codexManagers';
import { ptyTerminalManager, shellTerminalManager } from './scripts/vite-plugins/ptyTerminalManager';

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
import { portraitApiManager } from './scripts/vite-plugins/portraitApiManager';

import {
  conductorManager,
  scanManager,
  gitStatusManager,
  scriptRegistryManager,
  glossaryIndexManager,
  glossarySpellGateManager
} from './scripts/vite-plugins/miscManagers';

import { formatProxyTarget } from './scripts/vite-plugins/utils';

/**
 * Helper to add diagnostic hints to Vite proxy errors.
 */
function addProxyDiagnostics(
  route: string,
  config: ProxyOptions,
  hint: string
): ProxyOptions {
  return {
    ...config,
    configure: (proxy, _options) => {
      proxy.on('error', (err, _req, _res) => {
        const target = formatProxyTarget(config.target);
        if (err.message.includes('ECONNREFUSED')) {
          console.error(`\n[proxy] ${route} -> ${target} connection refused.`);
          console.error(`[proxy] Hint: ${hint}\n`);
        }
      });
    }
  };
}

export default defineConfig(async ({ mode, command }) => {
  const env = loadEnv(mode, '.', '');
  const isDevServer = command === 'serve';
  const isRoadmapMode = mode === 'roadmap';
  const isHubMode = mode === 'hub';

  const isRoadmapOnlyDev = isDevServer && isRoadmapMode;
  const isHubOnlyDev = isDevServer && isHubMode;

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
    glossarySpellGateManager(),
    glossaryIndexManager(),
    scriptRegistryManager(),
    portraitApiManager(),
    codexRunManager(),
    codexChatManager(),
    ptyTerminalManager(),
    shellTerminalManager(),
    agentUsageProbe(),
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
    glossarySpellGateManager(),
    glossaryIndexManager(),
    scriptRegistryManager(),
    portraitApiManager(),
    codexRunManager(),
    codexChatManager(),
    ptyTerminalManager(),
    shellTerminalManager(),
    agentUsageProbe(),
    agentSessionManager()
  ];

  const plugins = isRoadmapOnlyDev ? roadmapOnlyPlugins : isHubOnlyDev ? hubOnlyPlugins : mainPlugins;

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

  return {
    base: '/Aralia/',
    server: {
      port,
      strictPort: isRoadmapOnlyDev || isHubOnlyDev,
      host: '0.0.0.0',
      ...(isRoadmapOnlyDev
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
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
    },
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
          ...(includeRoadmapBuildEntries && fs.existsSync(path.resolve(__dirname, 'devtools', 'roadmap', 'roadmap.html'))
            ? { roadmap: path.resolve(__dirname, 'devtools', 'roadmap', 'roadmap.html') }
            : {}),
          ...(includeRoadmapBuildEntries && fs.existsSync(path.resolve(__dirname, 'devtools', 'roadmap', 'roadmap_docs.html'))
            ? { roadmap_docs: path.resolve(__dirname, 'devtools', 'roadmap', 'roadmap_docs.html') }
            : {})
        },
        output: {
          manualChunks: {
            'vendor-react': ['react', 'react-dom', 'framer-motion'],
            'vendor-utils': ['lucide-react', 'marked', 'dompurify', 'uuid', 'zod'],
            'vendor-pixi': ['pixi.js'],
            'vendor-ai': ['@google/genai']
          }
        }
      }
    }
  };
});
