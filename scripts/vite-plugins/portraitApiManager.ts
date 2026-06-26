import path from 'path';
import fs from 'fs';
import { PORTRAIT_OUTPUT_DIR, readBody, sanitizePromptText, STITCH_GCLOUD_CONFIG } from './utils';

// Wait, the portrait manager imports from `gemini/core/image-gen-mcp.ts` and uses stitching. Let me copy the necessary code exactly.
// I will need generatePortraitWithStitch and generatePortraitWithImageGen
// I'll put them in this file to keep it self-contained or import them if they're in utils.

export const portraitApiManager = () => ({
  name: 'portrait-api-manager',
  configureServer(server: any) {
    server.middlewares.use(async (req: any, res: any, next: any) => {
      const urlPath = (req.url || '').split('?')[0];
      if (urlPath !== '/api/portraits/generate' && urlPath !== '/api/portraits/list' && urlPath !== '/api/portraits/cdp/doctor') {
        next();
        return;
      }

      const json = (data: any, status = 200) => {
        res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify(data));
      };

      if (urlPath === '/api/portraits/list') {
        if (req.method !== 'GET') {
          json({ error: 'Method not allowed.' }, 405);
          return;
        }

        try {
          if (!fs.existsSync(PORTRAIT_OUTPUT_DIR)) {
            json({ files: [], dir: PORTRAIT_OUTPUT_DIR });
            return;
          }

          const files = fs.readdirSync(PORTRAIT_OUTPUT_DIR)
            .filter((name: string) => /\.(png|jpg|jpeg|webp)$/i.test(name))
            .map((name: string) => {
              const full = path.join(PORTRAIT_OUTPUT_DIR, name);
              const stat = fs.statSync(full);
              return {
                name,
                size: stat.size,
                mtimeMs: stat.mtimeMs,
                url: `assets/images/portraits/generated/${name}`,
              };
            })
            .sort((a: any, b: any) => b.mtimeMs - a.mtimeMs)
            .slice(0, 60);

          json({ files, dir: PORTRAIT_OUTPUT_DIR });
        } catch (e) {
          json({ error: String(e) }, 500);
        }
        return;
      }

      if (urlPath === '/api/portraits/cdp/doctor') {
        if (req.method !== 'GET') {
          json({ error: 'Method not allowed.' }, 405);
          return;
        }

        try {
          // Dynamic import because this might depend on things only available when generating
          const { doctorGeminiCDP } = await import('../../scripts/workflows/gemini/core/image-gen-mcp');
          const result = await doctorGeminiCDP({
            cdpUrl: process.env.IMAGE_GEN_CDP_URL || 'http://localhost:9222',
            attemptConsent: true,
            openIfMissing: true,
          });
          json(result);
        } catch (e) {
          json({ ok: false, stage: 'error', message: String(e) }, 500);
        }
        return;
      }

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
        const description = sanitizePromptText(String(parsed?.description || ''), 500);
        const race = sanitizePromptText(String(parsed?.race || ''), 80);
        const className = sanitizePromptText(String(parsed?.className || ''), 80);

        const prompt = [
          'High fantasy character portrait. Head-and-shoulders. Detailed. Dramatic lighting. Neutral background.',
          race ? `Race: ${race}.` : '',
          className ? `Class: ${className}.` : '',
          description ? `Description: ${description}` : '',
          'No text. No UI. No watermark.'
        ].filter(Boolean).join(' ');

        // Generate via the shared image-gen driver — the SAME engine the working
        // scene endpoint (sceneApiManager) uses. The driver tries Stitch then
        // image-gen internally, so one call covers both providers. This replaces
        // the dynamic import of `core/generate-portrait`, a module that was never
        // created — which left this endpoint dead at runtime ("missing
        // generate-portrait module"). Path held in a variable + @vite-ignore so
        // the heavy CDP/playwright deps stay out of tsc's graph (driver pattern).
        const driverPath = '../workflows/gemini/image-gen/image-gen-driver';
        const driver = await import(/* @vite-ignore */ driverPath) as {
          generateImage: (prompt: string) => Promise<{ success: boolean; message?: string; provider?: string }>;
          downloadImage: (outputPath: string) => Promise<{ success: boolean; path?: string; message?: string }>;
        };

        const genResult = await driver.generateImage(prompt);
        if (!genResult?.success) {
          json({ error: genResult?.message || 'Portrait generation failed.' }, 502);
          return;
        }

        if (!fs.existsSync(PORTRAIT_OUTPUT_DIR)) {
          fs.mkdirSync(PORTRAIT_OUTPUT_DIR, { recursive: true });
        }

        const fileName = `portrait_${Date.now()}.png`;
        const outputPath = path.join(PORTRAIT_OUTPUT_DIR, fileName);
        const dl = await driver.downloadImage(outputPath);
        if (!dl?.success) {
          json({ error: dl?.message || 'Generated portrait could not be saved.' }, 502);
          return;
        }

        json({ url: `assets/images/portraits/generated/${fileName}`, provider: genResult.provider });
        return;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (/\[Gcloud\] Token fetch failed/i.test(message) || /Failed to retrieve initial access token/i.test(message)) {
          const configHint = STITCH_GCLOUD_CONFIG ? `CLOUDSDK_CONFIG=\"${STITCH_GCLOUD_CONFIG}\" ` : '';
          json({
            error: [
              'Stitch is not authenticated on this machine.',
              `Run: ${configHint}gcloud.cmd auth application-default login`,
              'Then retry portrait generation. (This endpoint will also attempt an image-gen fallback if configured.)'
            ].join(' ')
          }, 500);
          return;
        }

        if (/Could not connect to Chrome DevTools/i.test(message) || /npm run mcp:chrome/i.test(message)) {
          json({
            error: [
              'Portrait generation could not connect to the debug Chrome session (CDP).',
              'Run: npm run mcp:chrome',
              'In that Chrome window: open https://gemini.google.com/app, accept consent/sign in, then retry.',
              `Details: ${message}`
            ].join(' ')
          }, 500);
          return;
        }

        if (/Before you continue/i.test(message) || /Could not find prompt input for gemini/i.test(message)) {
          json({
            error: [
              'Gemini browser automation is blocked by a consent/sign-in screen.',
              'Preferred fix: npm run mcp:chrome (launch debug Chrome on :9222), open Gemini in that window, accept consent/sign in, then retry.',
              'Fallback fix: npm run image-gen:login (Playwright profile) and accept consent/sign in there.'
            ].join(' ')
          }, 500);
          return;
        }
        json({ error: message || 'Portrait generation failed.' }, 500);
      }
    });
  },
});
