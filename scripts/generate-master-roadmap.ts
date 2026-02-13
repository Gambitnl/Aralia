import fs from 'fs';
import path from 'path';

const REGISTRY_FILE = 'docs/@DOC-REGISTRY.md';
const DATES_FILE = '.agent/roadmap/file_dates.json';
const TRACKS_DIR = 'conductor/tracks';
const OUTPUT_FILE = '.agent/roadmap/roadmap.json';

interface Node {
  id: string;
  label: string;
  type: 'root' | 'project' | 'milestone' | 'task';
  status: 'done' | 'active' | 'planned';
  initialX: number;
  initialY: number;
  color: string;
  progress?: number;
  description?: string;
  link?: string;
  domain?: string;
  completedDate?: string;
}

interface Edge {
  from: string;
  to: string;
}

const DOMAIN_COLORS: Record<string, string> = {
  'spell-system': '#a78bfa', // Purple
  'documentation': '#10b981', // Green
  '3d': '#38bdf8', // Sky Blue
  'tooling': '#fbbf24', // Amber
  'character': '#f87171', // Red
  'world': '#fb923c', // Orange
  'default': '#94a3b8' // Slate
};

function getDomain(tags: string[]): string {
  if (tags.includes('spell-system') || tags.includes('migration')) return 'spell-system';
  if (tags.includes('documentation') || tags.includes('cleanup')) return 'documentation';
  if (tags.includes('3d') || tags.includes('exploration')) return '3d';
  if (tags.includes('tooling') || tags.includes('roadmap')) return 'tooling';
  if (tags.includes('character')) return 'character';
  if (tags.includes('world')) return 'world';
  return 'default';
}

function main() {
  const dates = JSON.parse(fs.readFileSync(DATES_FILE, 'utf-8'));
  const registryContent = fs.readFileSync(REGISTRY_FILE, 'utf-8');
  
  const nodes: Node[] = [
    {
      id: 'aralia_chronicles',
      label: 'Aralia Chronicles',
      type: 'root',
      status: 'active',
      initialX: 500,
      initialY: 100,
      color: '#fbbf24',
      description: 'The master knowledge tree of Aralia RPG development.'
    }
  ];
  const edges: Edge[] = [];

  // Parse Registry
  // Split by project headers instead of just ---
  const projectBlocks = registryContent.split(/### Project: /).slice(1);
  let currentProjectNode: Node | null = null;
  let projectY = 250;

  for (const block of projectBlocks) {
    const lines = block.split('\n');
    const projectName = lines[0].trim();
    const projectId = projectName.toLowerCase().replace(/ /g, '_').replace(/[^a-z0-9_]/g, '');
    const tagsMatch = block.match(/\*\*Tags\*\*: (.*)/);
    const tags = tagsMatch ? tagsMatch[1].split(',').map(t => t.trim().replace(/`/g, '')) : [];
    const domain = getDomain(tags);

    currentProjectNode = {
      id: projectId,
      label: projectName,
      type: 'project',
      status: 'active',
      initialX: 500,
      initialY: projectY,
      color: DOMAIN_COLORS[domain] || DOMAIN_COLORS.default,
      domain
    };
    nodes.push(currentProjectNode);
    edges.push({ from: 'aralia_chronicles', to: projectId });

    // Parse Tables
    const tableLines = block.split('\n').filter(l => l.includes('|') && !l.includes('---'));
    let taskX = 150;
    let taskY = projectY + 100;

    for (const line of tableLines) {
      if (line.includes('Number') || line.includes('Document')) continue;
      
      const cells = line.split('|').map(c => c.trim()).filter(Boolean);
      if (cells.length < 3) continue;

      const number = cells[0].replace(/\[|\]/g, '').split('(')[0].trim();
      const docLinkMatch = cells[1].match(/\[(.*)\]\((.*)\)/);
      const label = docLinkMatch ? docLinkMatch[1] : cells[1];
      const linkRaw = docLinkMatch ? docLinkMatch[2] : '';
      const link = linkRaw.startsWith('.') ? linkRaw.replace('./', 'docs/') : linkRaw;
      const statusRaw = cells[2].toLowerCase();
      const progressRaw = cells[3];

      const status: Node['status'] = statusRaw.includes('completed') || statusRaw.includes('retired') ? 'done' : 
                                   statusRaw.includes('active') || statusRaw.includes('ongoing') ? 'active' : 'planned';
      
      let progress = 0;
      if (status === 'done') progress = 100;
      else if (progressRaw) {
        const pMatch = progressRaw.match(/(\d+)%/);
        if (pMatch) progress = parseInt(pMatch[1]);
      }

      const taskId = `${projectId}_${number.toLowerCase().replace(/~/g, '')}`;
      const taskNode: Node = {
        id: taskId,
        label: `${number}: ${label}`,
        type: 'task',
        status,
        initialX: taskX,
        initialY: taskY,
        color: currentProjectNode.color,
        progress,
        link,
        domain,
        completedDate: dates[link] || undefined
      };

      nodes.push(taskNode);
      edges.push({ from: projectId, to: taskId });

      taskX += 200;
      if (taskX > 850) {
        taskX = 150;
        taskY += 150;
      }
    }
    
    projectY = taskY + 200;
  }

  // Parse Retired Documents
  const retiredSection = registryContent.split('## Retired Documents')[1];
  if (retiredSection) {
    const tableLines = retiredSection.split('\n').filter(l => l.includes('|') && !l.includes('---'));
    let taskX = 150;
    let taskY = projectY + 100;
    
    for (const line of tableLines) {
      if (line.includes('Number') || line.includes('Document')) continue;
      const cells = line.split('|').map(c => c.trim()).filter(Boolean);
      if (cells.length < 3) continue;

      const number = cells[0].trim();
      const docLinkMatch = cells[1].match(/\[(.*)\]\((.*)\)/);
      const label = docLinkMatch ? docLinkMatch[1] : cells[1];
      const linkRaw = docLinkMatch ? docLinkMatch[2] : '';
      const link = linkRaw.startsWith('.') ? linkRaw.replace('./', 'docs/') : linkRaw;
      const projectName = cells[2];
      const projectId = projectName.toLowerCase().replace(/ /g, '_').replace(/[^a-z0-9_]/g, '');

      const taskId = `retired_${projectId}_${number.toLowerCase().replace(/~/g, '')}`;
      const taskNode: Node = {
        id: taskId,
        label: `${number} (Retired): ${label}`,
        type: 'task',
        status: 'done',
        initialX: taskX,
        initialY: taskY,
        color: '#64748b', // Faded color for retired
        progress: 100,
        link,
        completedDate: dates[link] || undefined
      };

      nodes.push(taskNode);
      // Try to connect to existing project if it exists
      if (nodes.find(n => n.id === projectId)) {
        edges.push({ from: projectId, to: taskId });
      } else {
        edges.push({ from: 'aralia_chronicles', to: taskId });
      }

      taskX += 200;
      if (taskX > 850) {
        taskX = 150;
        taskY += 150;
      }
    }
    projectY = taskY + 200;
  }

  // Parse Conductor Tracks
  if (fs.existsSync(TRACKS_DIR)) {
    const tracks = fs.readdirSync(TRACKS_DIR);
    let taskX = 150;
    let taskY = projectY + 100;

    for (const trackFolder of tracks) {
      const metadataPath = path.join(TRACKS_DIR, trackFolder, 'metadata.json');
      if (fs.existsSync(metadataPath)) {
        const meta = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
        const trackId = meta.track_id || trackFolder;
        const status: Node['status'] = meta.status === 'completed' ? 'done' : 
                                     meta.status === 'in_progress' ? 'active' : 'planned';
        
        const node: Node = {
          id: `track_${trackId}`,
          label: `Track: ${trackId.split('_')[0]}`,
          type: 'milestone',
          status,
          initialX: taskX,
          initialY: taskY,
          color: '#38bdf8',
          description: meta.description,
          link: path.join(TRACKS_DIR, trackFolder, 'index.md').replace(/\\/g, '/')
        };
        nodes.push(node);
        edges.push({ from: 'aralia_chronicles', to: node.id });

        taskX += 200;
        if (taskX > 850) {
          taskX = 150;
          taskY += 150;
        }
      }
    }
  }

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify({ version: '1.1.0', root: 'aralia_chronicles', nodes, edges }, null, 2));
  console.log(`Generated roadmap with ${nodes.length} nodes and ${edges.length} edges.`);
}

main();
