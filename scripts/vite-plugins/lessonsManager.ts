/**
 * Lessons Manager — serves the learned-lessons registry for misc/lessons.html.
 *
 *   GET /api/lessons → { lessons: [...] }  from .agent/orchestration/lessons.json
 *
 * Split out of the retired patVaultManager: the PAT vault moved to the Aralia
 * operator dashboard, but this endpoint stayed behind because lessons.html reads
 * it. It touches no credentials — only the local lessons JSON.
 */
import * as fs from 'fs';
import * as path from 'path';

export const lessonsManager = () => ({
  name: 'lessons-manager',
  configureServer(server: { middlewares: { use: (h: (req: any, res: any, next: any) => void) => void } }) {
    server.middlewares.use((req: any, res: any, next: any) => {
      const urlPath = (req.url || '').split('?')[0];
      if (urlPath !== '/api/lessons') { next(); return; }
      res.setHeader('Content-Type', 'application/json');
      try {
        const raw = fs.readFileSync(path.join(process.cwd(), '.agent', 'orchestration', 'lessons.json'), 'utf8');
        const data = JSON.parse(raw);
        res.end(JSON.stringify({ lessons: data.lessons || [] }));
      } catch (e) {
        res.statusCode = 500;
        res.end(JSON.stringify({ lessons: [], error: (e as Error).message }));
      }
    });
  },
});
