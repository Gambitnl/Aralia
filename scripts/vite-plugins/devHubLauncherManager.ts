import { spawn } from 'child_process';

export const DEVHUB_DEV_PORT = 3030;
export const DEVHUB_DEV_HOST = '127.0.0.1';
export const DEVHUB_DEV_OPEN_PATH = '/Aralia/misc/dev_hub.html';
export const DEVHUB_DEV_HEALTH_URL = `http://${DEVHUB_DEV_HOST}:${DEVHUB_DEV_PORT}/api/health/env`;
export const DEVHUB_DEV_OPEN_URL = `http://${DEVHUB_DEV_HOST}:${DEVHUB_DEV_PORT}${DEVHUB_DEV_OPEN_PATH}`;

export type DevHubDevServerStatus = {
  running: boolean;
  openUrl: string;
  healthUrl: string;
};

export const getDevHubDevServerStatus = async (): Promise<DevHubDevServerStatus> => {
  try {
    const response = await fetch(DEVHUB_DEV_HEALTH_URL, { signal: AbortSignal.timeout(1500) });
    return {
      running: response.ok,
      openUrl: DEVHUB_DEV_OPEN_URL,
      healthUrl: DEVHUB_DEV_HEALTH_URL
    };
  } catch {
    return {
      running: false,
      openUrl: DEVHUB_DEV_OPEN_URL,
      healthUrl: DEVHUB_DEV_HEALTH_URL
    };
  }
};

export const devHubLauncherManager = () => ({
  name: 'devhub-launcher-manager',
  configureServer(server: any) {
    server.middlewares.use(async (req: any, res: any, next: any) => {
      if (req.url !== '/api/devhub/start') {
        next();
        return;
      }

      if (req.method && req.method !== 'GET' && req.method !== 'POST') {
        res.writeHead(405, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Method not allowed.' }));
        return;
      }

      try {
        const devHubServer = await getDevHubDevServerStatus();
        if (devHubServer.running) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            status: 'already-running',
            port: DEVHUB_DEV_PORT,
            url: devHubServer.openUrl,
            healthUrl: devHubServer.healthUrl
          }));
          return;
        }

        console.info('[dev] Starting isolated devhub server (npm run dev:hub)...');
        const child = spawn('npm', ['run', 'dev:hub'], {
          detached: true,
          stdio: 'ignore',
          shell: true,
          windowsHide: true,
          cwd: process.cwd(),
        });
        child.unref();

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'starting', command: 'npm run dev:hub' }));
      } catch (error) {
        console.error('[dev] Failed to start devhub server:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Failed to start devhub server' }));
      }
    });
  },
});
