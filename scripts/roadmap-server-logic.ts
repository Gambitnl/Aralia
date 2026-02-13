import fs from 'fs';
import path from 'path';

const REGISTRY_FILE = 'docs/@DOC-REGISTRY.md';
const DATES_FILE = '.agent/roadmap/file_dates.json';
const TRACKS_DIR = 'conductor/tracks';

export interface RoadmapNode {
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

export interface RoadmapEdge {
  from: string;
  to: string;
}

const DOMAIN_COLORS: Record<string, string> = {
  'spell-system': '#a78bfa',
  'documentation': '#10b981',
  '3d': '#38bdf8',
  'tooling': '#fbbf24',
  'character': '#f87171',
  'world': '#fb923c',
  'default': '#94a3b8'
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

export function generateRoadmapData() {
  const dates = fs.existsSync(DATES_FILE) ? JSON.parse(fs.readFileSync(DATES_FILE, 'utf-8')) : {};
  const registryContent = fs.existsSync(REGISTRY_FILE) ? fs.readFileSync(REGISTRY_FILE, 'utf-8') : '';
  
  const nodes: RoadmapNode[] = [
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
  const edges: RoadmapEdge[] = [];

  if (registryContent) {
    const projectBlocks = registryContent.split(/### Project: /).slice(1);
    let projectY = 250;

    for (const block of projectBlocks) {
      const lines = block.split('
');
      const projectName = lines[0].trim();
      const projectId = projectName.toLowerCase().replace(/ /g, '_').replace(/[^a-z0-9_]/g, '');
      const tagsMatch = block.match(/\*\*Tags\*\*: (.*)/);
      const tags = tagsMatch ? tagsMatch[1].split(',').map(t => t.trim().replace(/`/g, '')) : [];
      const domain = getDomain(tags);

      const projectNode: RoadmapNode = {
        id: projectId,
        label: projectName,
        type: 'project',
        status: 'active',
        initialX: 500,
        initialY: projectY,
        color: DOMAIN_COLORS[domain] || DOMAIN_COLORS.default,
        domain
      };
      nodes.push(projectNode);
      edges.push({ from: 'aralia_chronicles', to: projectId });

      const tableLines = block.split('
').filter(l => l.includes('|') && !l.includes('---'));
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

        const status: RoadmapNode['status'] = statusRaw.includes('completed') || statusRaw.includes('retired') ? 'done' : 
                                     statusRaw.includes('active') || statusRaw.includes('ongoing') ? 'active' : 'planned';
        
        let progress = 0;
        if (status === 'done') progress = 100;
        else if (progressRaw) {
          const pMatch = progressRaw.match(/(\d+)%/);
          if (pMatch) progress = parseInt(pMatch[1]);
        }

        const taskId = `${projectId}_${number.toLowerCase().replace(/~/g, '')}`;
        nodes.push({
          id: taskId,
          label: `${number}: ${label}`,
          type: 'task',
          status,
          initialX: taskX,
          initialY: taskY,
          color: projectNode.color,
          progress,
          link,
          domain,
          completedDate: dates[link] || undefined
        });
        edges.push({ from: projectId, to: taskId });

        taskX += 200;
        if (taskX > 850) {
          taskX = 150;
          taskY += 150;
        }
      }
      projectY = taskY + 200;
    }
  }

  // Add Conductor Tracks
  if (fs.existsSync(TRACKS_DIR)) {
    const tracks = fs.readdirSync(TRACKS_DIR);
    let taskX = 150;
    let taskY = 500; // Offset from registry

    for (const trackFolder of tracks) {
      const metadataPath = path.join(TRACKS_DIR, trackFolder, 'metadata.json');
      if (fs.existsSync(metadataPath)) {
        const meta = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
        const trackId = meta.track_id || trackFolder;
        const status: RoadmapNode['status'] = meta.status === 'completed' ? 'done' : 
                                     meta.status === 'in_progress' || meta.status === 'active' || meta.status === 'new' ? 'active' : 'planned';
        
        const nodeId = `track_${trackId}`;
        // Avoid duplicates if already in registry
        if (nodes.find(n => n.id === nodeId)) continue;

        nodes.push({
          id: nodeId,
          label: `Track: ${trackId.split('_')[0]}`,
          type: 'milestone',
          status,
          initialX: taskX,
          initialY: taskY,
          color: '#38bdf8',
          description: meta.description,
          link: path.join(TRACKS_DIR, trackFolder, 'index.md').replace(/\/g, '/')
        });
        edges.push({ from: 'aralia_chronicles', to: nodeId });

        taskX += 200;
        if (taskX > 850) {
          taskX = 150;
          taskY += 150;
        }
      }
    }
  }

  return { version: '1.2.0', root: 'aralia_chronicles', nodes, edges };
}
