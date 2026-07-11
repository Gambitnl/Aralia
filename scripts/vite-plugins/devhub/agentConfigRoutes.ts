import path from 'path';
import fs from 'fs';
import type { DevHubRouteContext } from './routeContext';

export async function handleAgentConfigRoutes(ctx: DevHubRouteContext): Promise<boolean> {
  const { req, json } = ctx;

  if (req.url === '/api/agent/config') {
    try {
      const agentDir = path.resolve(process.cwd(), '.agent');
      const readMdFiles = (sub: string) => {
        const dir = path.join(agentDir, sub);
        if (!fs.existsSync(dir)) return [];
        return fs.readdirSync(dir, { withFileTypes: true })
          .filter((d: any) => d.isFile() && d.name.endsWith('.md'))
          .map((d: any) => {
            const item: any = { name: d.name.replace('.md', ''), path: `.agent/${sub}/${d.name}` };
            try {
              const content = fs.readFileSync(path.join(dir, d.name), 'utf-8');
              const fm = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
              if (fm) {
                const block = fm[1].replace(/\r/g, '');
                const chainMatch = block.match(/^chain:\s*(.+)$/m);
                const viaMatch = block.match(/^chain_via:\s*(.+)$/m);
                const orderMatch = block.match(/^chain_order:\s*(\d+)$/m);
                if (chainMatch) item.chain = chainMatch[1].trim();
                if (viaMatch) item.chainVia = viaMatch[1].trim();
                if (orderMatch) item.chainOrder = parseInt(orderMatch[1], 10);
              }
            } catch (_) { /* ignore read errors */ }
            return item;
          });
      };
      const chainConfigPath = path.join(agentDir, 'tidy-up-chain.json');
      const chainConfig = fs.existsSync(chainConfigPath)
        ? JSON.parse(fs.readFileSync(chainConfigPath, 'utf-8'))
        : { extras: [], skills: [] };
      const skillsInTidyUp: string[] = chainConfig.skills || [];
      const skillsDir = path.join(agentDir, 'skills');
      const skills = fs.existsSync(skillsDir)
        ? fs.readdirSync(skillsDir, { withFileTypes: true })
          .filter((d: any) => d.isDirectory())
          .map((d: any) => {
            const item: any = { name: d.name, path: `.agent/skills/${d.name}/SKILL.md` };
            if (skillsInTidyUp.includes(d.name)) { item.chain = 'tidy-up'; item.chainVia = 'session-ritual'; }
            return item;
          })
        : [];
      const claudeCmdsDir = path.resolve(process.cwd(), '.claude/commands');
      const conductorCommands = fs.existsSync(claudeCmdsDir)
        ? fs.readdirSync(claudeCmdsDir, { withFileTypes: true })
          .filter((d: any) => d.isFile() && d.name.startsWith('conductor-') && d.name.endsWith('.md'))
          .map((d: any) => ({ name: d.name.replace('.md', ''), path: `.claude/commands/${d.name}`, source: 'claude' }))
        : [];
      const allWorkflows = readMdFiles('workflows');
      const trackWorkflows = allWorkflows
        .filter((w: any) => w.name.startsWith('track-'))
        .map((w: any) => ({ ...w, source: 'agent' }));
      const workflows = allWorkflows.filter((w: any) => !w.name.startsWith('track-'));
      const conductor = [...conductorCommands, ...trackWorkflows];
      const chainExtras = (chainConfig.extras || []).map((e: any) => ({
        ...e,
        chain: 'tidy-up',
      }));
      json({ rules: readMdFiles('rules'), skills, workflows: [...workflows, ...chainExtras], conductor });
    } catch (e) {
      json({ error: String(e) }, 500);
    }
    return true;
  }

  return false;
}
