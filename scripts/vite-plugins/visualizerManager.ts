import { spawn } from 'child_process';

export const visualizerManager = () => ({
  name: 'visualizer-manager',
  configureServer(server: any) {
    server.middlewares.use((req: any, res: any, next: any) => {
      if (req.url === '/api/visualizer/start') {
        console.info('[dev] Starting Codebase Visualizer server...');
        try {
          // Use npx tsx to run the script in the background
          const child = spawn('npx', ['tsx', 'misc/dev_hub/codebase-visualizer/server/index.ts'], {
            detached: true,
            stdio: 'ignore',
            shell: true,
            windowsHide: true,
          });
          child.unref();

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ status: 'starting' }));
        } catch (error) {
          console.error('[dev] Failed to start visualizer:', error);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Failed to start visualizer server' }));
        }
        return;
      }
      next();
    });
  },
});
