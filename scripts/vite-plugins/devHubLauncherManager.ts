import { spawn } from 'child_process';

export const DEVHUB_DEV_PORT = 3030;
export const DEVHUB_DEV_HOST = '127.0.0.1';
export const DEVHUB_DEV_OPEN_PATH = '/Aralia/misc/dev_hub.html';
export const DEVHUB_DEV_HEALTH_URL = `http://${DEVHUB_DEV_HOST}:${DEVHUB_DEV_PORT}/api/health/env`;
export const DEVHUB_DEV_OPEN_URL = `http://${DEVHUB_DEV_HOST}:${DEVHUB_DEV_PORT}${DEVHUB_DEV_OPEN_PATH}`;
export const OPERATOR_DASHBOARD_PORT = 3040;
export const OPERATOR_DASHBOARD_HOST = '127.0.0.1';
export const OPERATOR_DASHBOARD_ROOT = 'F:\\Repos\\Aralia-operator-dashboard';
export const OPERATOR_DASHBOARD_ORIGIN = `http://${OPERATOR_DASHBOARD_HOST}:${OPERATOR_DASHBOARD_PORT}`;
export const OPERATOR_DASHBOARD_HEALTH_URL = `${OPERATOR_DASHBOARD_ORIGIN}/api/health/operator`;

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

export type OperatorDashboardStatus = {
  running: boolean;
  origin: string;
  healthUrl: string;
};

export const getOperatorDashboardStatus = async (): Promise<OperatorDashboardStatus> => {
  try {
    const response = await fetch(OPERATOR_DASHBOARD_HEALTH_URL, { signal: AbortSignal.timeout(1500) });
    return {
      running: response.ok,
      origin: OPERATOR_DASHBOARD_ORIGIN,
      healthUrl: OPERATOR_DASHBOARD_HEALTH_URL
    };
  } catch {
    return {
      running: false,
      origin: OPERATOR_DASHBOARD_ORIGIN,
      healthUrl: OPERATOR_DASHBOARD_HEALTH_URL
    };
  }
};

export const devHubLauncherManager = () => ({
  name: 'devhub-launcher-manager',
  configureServer(server: any) {
    server.middlewares.use(async (req: any, res: any, next: any) => {
      if (req.url !== '/api/devhub/start') {
        if (req.url === '/api/operator-dashboard/status') {
          const status = await getOperatorDashboardStatus();
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(status));
          return;
        }

        if (req.url === '/api/operator-dashboard/start') {
          if (req.method && req.method !== 'GET' && req.method !== 'POST') {
            res.writeHead(405, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Method not allowed.' }));
            return;
          }

          try {
            const current = await getOperatorDashboardStatus();
            if (current.running) {
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ status: 'already-running', ...current }));
              return;
            }

            console.info('[dev] Starting standalone operator dashboard (npm run dev)...');
            const child = spawn('npm', ['run', 'dev'], {
              detached: true,
              stdio: 'ignore',
              shell: true,
              windowsHide: true,
              cwd: OPERATOR_DASHBOARD_ROOT,
              env: {
                ...process.env,
                ARALIA_REPO_ROOT: process.cwd(),
              },
            });
            child.unref();

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              status: 'starting',
              command: 'npm run dev',
              cwd: OPERATOR_DASHBOARD_ROOT,
              origin: OPERATOR_DASHBOARD_ORIGIN,
              healthUrl: OPERATOR_DASHBOARD_HEALTH_URL
            }));
          } catch (error) {
            console.error('[dev] Failed to start operator dashboard:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Failed to start operator dashboard' }));
          }
          return;
        }

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
