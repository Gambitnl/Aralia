import path from 'path';
import fs from 'fs';
import { buildDocUsage } from '../docUsage/buildDocUsage';
import type { DevHubRouteContext } from './routeContext';

let _docUsageCache: { generatedAt: string; payload: unknown } | null = null;

export async function handleDocsRoutes(ctx: DevHubRouteContext): Promise<boolean> {
  const { req, json, parsedUrl, urlPath } = ctx;

  if (urlPath === '/api/docs/usage') {
    try {
      const refresh = /[?&]refresh=1\b/.test(req.url || '');
      if (refresh || !_docUsageCache) {
        const payload = buildDocUsage(process.cwd());
        _docUsageCache = { generatedAt: payload.generatedAt, payload };
      }
      json(_docUsageCache.payload);
    } catch (e) {
      json({ error: String(e) }, 500);
    }
    return true;
  }

  if (urlPath === '/api/docs/list') {
    try {
      const rootDir = process.cwd();
      const results: any[] = [];
      
      const scan = (dir: string) => {
        const list = fs.readdirSync(dir, { withFileTypes: true });
        for (const file of list) {
          const fullPath = path.join(dir, file.name);
          const relPath = path.relative(rootDir, fullPath).replace(/\\/g, '/');
          
          if (file.isDirectory()) {
            if (
              file.name === 'node_modules' ||
              file.name === '.git' ||
              file.name === 'dist' ||
              file.name === 'public' ||
              file.name === '.tmp' ||
              file.name === 'vendor' ||
              file.name === '.gemini' ||
              file.name === '.jules' ||
              file.name === '.antigravitycli' ||
              file.name === '.claude' ||
              file.name === '.cursor' ||
              file.name === '.codex' ||
              file.name === '.symphony' ||
              file.name === 'artifacts'
            ) {
              continue;
            }
            scan(fullPath);
          } else if (file.isFile() && file.name.endsWith('.md')) {
            try {
              const content = fs.readFileSync(fullPath, 'utf-8');
              const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
              const metadata: any = {
                title: file.name.replace('.md', ''),
                category: 'other',
                status: 'not started',
                lastReviewed: '',
                notes: ''
              };
              
              if (fmMatch) {
                const block = fmMatch[1].replace(/\r/g, '');
                const titleMatch = block.match(/^title:\s*\"?([^\"]+)\"?$/m);
                const catMatch = block.match(/^category:\s*(.+)$/m);
                const statusMatch = block.match(/^status:\s*(.+)$/m);
                const reviewedMatch = block.match(/^lastReviewed:\s*(.+)$/m);
                const notesMatch = block.match(/^notes:\s*(.+)$/m);
                
                if (titleMatch) metadata.title = titleMatch[1].trim();
                if (catMatch) metadata.category = catMatch[1].trim();
                if (statusMatch) metadata.status = statusMatch[1].trim();
                if (reviewedMatch) metadata.lastReviewed = reviewedMatch[1].trim();
                if (notesMatch) metadata.notes = notesMatch[1].trim();
              } else {
                if (relPath.startsWith('docs/tasks/')) {
                  metadata.category = 'work-item';
                } else if (relPath.startsWith('docs/guides/')) {
                  metadata.category = 'workflow';
                } else if (relPath.startsWith('docs/archive/')) {
                  metadata.category = 'archive';
                } else if (relPath.startsWith('docs/registry/')) {
                  metadata.category = 'registry';
                } else if (relPath.includes('README.md')) {
                  metadata.category = 'index';
                }
              }
              
              const stats = fs.statSync(fullPath);
              results.push({
                path: relPath,
                name: file.name,
                size: stats.size,
                mtime: stats.mtime,
                metadata
              });
            } catch (_) {
              results.push({
                path: relPath,
                name: file.name,
                size: 0,
                metadata: { title: file.name.replace('.md', ''), category: 'other', status: 'not started' }
              });
            }
          }
        }
      };
      
      scan(rootDir);
      json({ files: results });
    } catch (e) {
      json({ error: String(e) }, 500);
    }
    return true;
  }

  if (urlPath === '/api/docs/read') {
    try {
      const relPath = parsedUrl.searchParams.get('path');
      if (!relPath || !relPath.endsWith('.md')) {
        json({ error: 'Invalid path' }, 400);
        return true;
      }
      const safePath = path.resolve(process.cwd(), relPath);
      if (!safePath.startsWith(process.cwd())) {
        json({ error: 'Access denied' }, 403);
        return true;
      }
      if (!fs.existsSync(safePath)) {
        json({ error: 'File not found' }, 404);
        return true;
      }
      const raw = fs.readFileSync(safePath, 'utf-8');
      const fmMatch = raw.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n)?([\s\S]*)$/);
      const metadata: any = {
        title: path.basename(relPath, '.md'),
        category: 'other',
        status: 'not started',
        lastReviewed: '',
        notes: ''
      };
      let body = raw;
      
      if (fmMatch) {
        body = fmMatch[2];
        const block = fmMatch[1].replace(/\r/g, '');
        const titleMatch = block.match(/^title:\s*\"?([^\"]+)\"?$/m);
        const catMatch = block.match(/^category:\s*(.+)$/m);
        const statusMatch = block.match(/^status:\s*(.+)$/m);
        const reviewedMatch = block.match(/^lastReviewed:\s*(.+)$/m);
        const notesMatch = block.match(/^notes:\s*(.+)$/m);
        
        if (titleMatch) metadata.title = titleMatch[1].trim();
        if (catMatch) metadata.category = catMatch[1].trim();
        if (statusMatch) metadata.status = statusMatch[1].trim();
        if (reviewedMatch) metadata.lastReviewed = reviewedMatch[1].trim();
        if (notesMatch) metadata.notes = notesMatch[1].trim();
      }
      
      json({ path: relPath, metadata, body });
    } catch (e) {
      json({ error: String(e) }, 500);
    }
    return true;
  }

  if (urlPath === '/api/docs/write' && req.method === 'POST') {
    let bodyAccumulator = '';
    req.on('data', (chunk: any) => { bodyAccumulator += chunk; });
    req.on('end', () => {
      try {
        const data = JSON.parse(bodyAccumulator);
        const { path: relPath, metadata, body } = data;
        
        if (!relPath || !relPath.endsWith('.md')) {
          json({ error: 'Invalid path' }, 400);
          return;
        }
        const safePath = path.resolve(process.cwd(), relPath);
        if (!safePath.startsWith(process.cwd())) {
          json({ error: 'Access denied' }, 403);
          return;
        }
        
        const frontmatterLines = [
          '---',
          `title: "${metadata.title || path.basename(relPath, '.md')}"`,
          `category: "${metadata.category || 'other'}"`,
          `status: "${metadata.status || 'not started'}"`,
          `lastReviewed: "${metadata.lastReviewed || ''}"`,
          `notes: "${(metadata.notes || '')
            .replace(/\\/g, '\\\\')
            .replace(/\"/g, '\\"')}"`,
          '---',
          ''
        ];
        const fullContent = frontmatterLines.join('\n') + body;
        
        fs.writeFileSync(safePath, fullContent, 'utf-8');
        
        try {
          const ledgerPath = path.resolve(process.cwd(), 'docs/registry/@DOC-REVIEW-LEDGER.md');
          if (fs.existsSync(ledgerPath)) {
            let ledgerContent = fs.readFileSync(ledgerPath, 'utf-8');
            const escapedPath = relPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const rowRegex = new RegExp(`\\|\\s*\`?${escapedPath}\`?\\s*\\|`, 'i');
            if (rowRegex.test(ledgerContent)) {
              const lines = ledgerContent.split(/\r?\n/);
              const updatedLines = lines.map(line => {
                if (rowRegex.test(line)) {
                  return `| \`${relPath}\` | \`${metadata.category}\` | \`${metadata.status}\` | \`updated\` | ${metadata.notes || 'Updated via Doc Library Tool.'} |`;
                }
                return line;
              });
              fs.writeFileSync(ledgerPath, updatedLines.join('\n'), 'utf-8');
            } else {
              ledgerContent += `\n| \`${relPath}\` | \`${metadata.category}\` | \`${metadata.status}\` | \`keep in place\` | ${metadata.notes || 'Registered via Doc Library Tool.'} |`;
              fs.writeFileSync(ledgerPath, ledgerContent, 'utf-8');
            }
          }
        } catch (e) {
          console.warn('[Doc Library] Ledger sync failed:', e);
        }
        
        json({ success: true });
      } catch (e) {
        json({ error: String(e) }, 500);
      }
    });
    return true;
  }

  if (urlPath === '/api/docs/delete' && req.method === 'POST') {
    let bodyAccumulator = '';
    req.on('data', (chunk: any) => { bodyAccumulator += chunk; });
    req.on('end', () => {
      try {
        const data = JSON.parse(bodyAccumulator);
        const { path: relPath, action, justification } = data;
        
        if (!relPath || !relPath.endsWith('.md')) {
          json({ error: 'Invalid path' }, 400);
          return;
        }
        const safePath = path.resolve(process.cwd(), relPath);
        if (!safePath.startsWith(process.cwd())) {
          json({ error: 'Access denied' }, 403);
          return;
        }
        if (!fs.existsSync(safePath)) {
          json({ error: 'File not found' }, 404);
          return;
        }
        
        try {
          const ledgerPath = path.resolve(process.cwd(), 'docs/registry/@DOC-REVIEW-LEDGER.md');
          if (fs.existsSync(ledgerPath)) {
            let ledgerContent = fs.readFileSync(ledgerPath, 'utf-8');
            const escapedPath = relPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const rowRegex = new RegExp(`\\|\\s*\`?${escapedPath}\`?\\s*\\|`, 'i');
            const disp = action === 'retire' ? 'retire' : 'delete';
            if (rowRegex.test(ledgerContent)) {
              const lines = ledgerContent.split(/\r?\n/);
              const updatedLines = lines.map(line => {
                if (rowRegex.test(line)) {
                  return `| \`${relPath}\` | \`deleted\` | \`archived\` | \`${disp}\` | Justification: ${justification || 'Deleted via Doc Library Tool.'} |`;
                }
                return line;
              });
              fs.writeFileSync(ledgerPath, updatedLines.join('\n'), 'utf-8');
            } else {
              ledgerContent += `\n| \`${relPath}\` | \`deleted\` | \`archived\` | \`${disp}\` | Justification: ${justification || 'Deleted via Doc Library Tool.'} |`;
              fs.writeFileSync(ledgerPath, ledgerContent, 'utf-8');
            }
          }
        } catch (e) {
          console.warn('[Doc Library] Ledger delete-sync failed:', e);
        }
        
        if (action === 'retire') {
          const dirName = path.dirname(safePath);
          const baseName = path.basename(safePath, '.md');
          const retiredPath = path.join(dirName, `${baseName}~.md`);
          
          fs.renameSync(safePath, retiredPath);
          
          try {
            let content = fs.readFileSync(retiredPath, 'utf-8');
            const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n)?([\s\S]*)$/);
            if (fmMatch) {
              let block = fmMatch[1].replace(/\r/g, '');
              if (block.match(/^status:\s*(.+)$/m)) {
                block = block.replace(/^status:\s*(.+)$/m, 'status: "archived"');
              } else {
                block += '\nstatus: "archived"';
              }
              const fullContent = `---\n${block}\n---\n${fmMatch[2]}`;
              fs.writeFileSync(retiredPath, fullContent, 'utf-8');
            }
          } catch (_) {}
          
          json({ success: true, action: 'retired', newPath: path.relative(process.cwd(), retiredPath).replace(/\\/g, '/') });
        } else {
          fs.unlinkSync(safePath);
          json({ success: true, action: 'deleted' });
        }
      } catch (e) {
        json({ error: String(e) }, 500);
      }
    });
    return true;
  }

  return false;
}
