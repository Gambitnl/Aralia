import path from 'path';
import fs from 'fs';
import { SCENE_OUTPUT_DIR, readBody, sanitizePromptText } from './utils';

/**
 * Dev API for the OPENING-SCENARIO VISUAL.
 *
 * POST /api/scenes/generate  { prompt }  -> { url }
 *   Generates a wide scene illustration for the freshly written opening
 *   predicament and returns a locally-served image URL.
 *
 * Built on the SAME image generator the race-image tooling uses
 * (scripts/workflows/gemini/image-gen/image-gen-driver: generateImage +
 * downloadImage), rather than the portrait endpoint's missing
 * `generate-portrait` module.
 *
 * NO canned fallback: if generation fails this returns an honest error and the
 * client surfaces "illustration unavailable" — it never serves a stock image.
 */
export const sceneApiManager = () => ({
  name: 'scene-api-manager',
  configureServer(server: any) {
    server.middlewares.use(async (req: any, res: any, next: any) => {
      const urlPath = (req.url || '').split('?')[0];
      if (urlPath !== '/api/scenes/generate') {
        next();
        return;
      }

      const json = (data: any, status = 200) => {
        res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify(data));
      };

      if (req.method === 'OPTIONS') {
        res.writeHead(204, {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        });
        res.end();
        return;
      }

      if (req.method !== 'POST') {
        json({ error: 'Method not allowed.' }, 405);
        return;
      }

      try {
        const rawBody = await readBody(req);
        const parsed = rawBody ? JSON.parse(rawBody) : {};
        const prompt = sanitizePromptText(String(parsed?.prompt || ''), 1200);
        if (!prompt) {
          json({ error: 'A non-empty prompt is required.' }, 400);
          return;
        }

        // Lazy import: pulls in browser-automation deps only when actually
        // generating. The path is held in a variable so the heavy driver (and its
        // transitive playwright/CDP deps) is not dragged into tsc's project graph
        // — it is resolved by esbuild/tsx at runtime, like the other vite plugins.
        const driverPath = '../workflows/gemini/image-gen/image-gen-driver';
        const driver = await import(/* @vite-ignore */ driverPath) as {
          generateImage: (prompt: string) => Promise<{ success: boolean; message?: string; provider?: string }>;
          downloadImage: (outputPath: string) => Promise<{ success: boolean; path?: string; message?: string }>;
        };

        const genResult = await driver.generateImage(prompt);
        if (!genResult?.success) {
          json({ error: genResult?.message || 'Scene generation failed.' }, 502);
          return;
        }

        if (!fs.existsSync(SCENE_OUTPUT_DIR)) {
          fs.mkdirSync(SCENE_OUTPUT_DIR, { recursive: true });
        }

        const fileName = `opening_${Date.now()}.png`;
        const outputPath = path.join(SCENE_OUTPUT_DIR, fileName);
        const dl = await driver.downloadImage(outputPath);
        if (!dl?.success) {
          json({ error: dl?.message || 'Generated scene could not be saved.' }, 502);
          return;
        }

        json({ url: `assets/images/scenes/generated/${fileName}`, provider: genResult.provider });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        json({ error: message || 'Scene generation failed.' }, 500);
      }
    });
  },
});
