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
  priority?: string;
  dependencies?: string[];
  goals?: string[];
  filesImpacted?: string[];
  subNodes?: RoadmapNode[];
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

function extractMetadataFromMd(filePath: string) {
  try {
    const fullPath = path.resolve(process.cwd(), filePath);
    if (!fs.existsSync(fullPath)) return {};
    const content = fs.readFileSync(fullPath, 'utf-8');
    
    // Extract first paragraph as description
    const lines = content.split('\n');
    let description = '';
    let goals: string[] = [];
    let files: string[] = [];

    // Find first non-title, non-bold paragraph
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line && !line.startsWith('#') && !line.startsWith('**') && !description) {
        description = line;
      }
      if (line.startsWith('- [ ]') || line.startsWith('- [x]')) {
        goals.push(line.replace(/- \[[ x]\]\s*/, ''));
      }
      // Look for file paths (src/...)
      const fileMatches = line.match(/(?:`|^| )(src\/[a-zA-Z0-9_\/.-]+)/g);
      if (fileMatches) {
        fileMatches.forEach(m => files.push(m.trim().replace(/`/g, '')));
      }
    }

    return {
      description: description.substring(0, 200),
      goals: goals.slice(0, 5),
      filesImpacted: Array.from(new Set(files)).slice(0, 8)
    };
  } catch (e) {
    return {};
  }
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
      // Only parse until the next major section (##)
      const cleanBlock = block.split('\n##')[0];
      const lines = cleanBlock.split('\n');
      const projectName = lines[0].trim();
      const projectId = projectName.toLowerCase().replace(/ /g, '_').replace(/[^a-z0-9_]/g, '');
      const tagsMatch = cleanBlock.match(/\*\*Tags\*\*: (.*)/);
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
      
      if (!nodes.find(n => n.id === projectId)) {
        nodes.push(projectNode);
        edges.push({ from: 'aralia_chronicles', to: projectId });
      }

      const tableLines = cleanBlock.split('\n').filter(l => l.includes('|') && !l.includes('---'));
      
      // Milestone Grouping Logic:
      // If we have a massive amount of tasks (like Spells), group them.
      const isSpellProject = domain === 'spell-system';
      const milestoneBatches: Record<string, RoadmapNode[]> = {};

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
        const priority = cells[4];
        const dependencies = cells[5] ? cells[5].split(',').map(d => d.trim()).filter(d => d !== '-') : [];

        const status: RoadmapNode['status'] = statusRaw.includes('completed') || statusRaw.includes('retired') ? 'done' : 
                                     statusRaw.includes('active') || statusRaw.includes('ongoing') ? 'active' : 'planned';
        
        let progress = 0;
        if (status === 'done') progress = 100;
        else if (progressRaw) {
          const pMatch = progressRaw.match(/(\d+)%/);
          if (pMatch) progress = parseInt(pMatch[1]);
        }

        let taskId = `${projectId}_${number.toLowerCase().replace(/~/g, '').replace(/[^a-z0-9_]/g, '')}`;
        if (nodes.find(n => n.id === taskId)) {
          taskId = `${taskId}_${Math.random().toString(36).substring(2, 5)}`;
        }

        const mdMeta = link ? extractMetadataFromMd(link) : {};

        const taskNode: RoadmapNode = {
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
          priority,
          dependencies,
          completedDate: dates[link] || undefined,
          ...mdMeta
        };
          status,
          initialX: taskX,
          initialY: taskY,
          color: projectNode.color,
          progress,
          link,
          domain,
          completedDate: dates[link] || undefined
        };

        if (isSpellProject && (label.toLowerCase().includes('migrate') || label.toLowerCase().includes('extract'))) {
          // Group batch tasks into a single Milestone for performance
          const batchName = label.split('(')[0].trim();
          if (!milestoneBatches[batchName]) {
            milestoneBatches[batchName] = [];
          }
          milestoneBatches[batchName].push(taskNode);
        } else {
          nodes.push(taskNode);
          edges.push({ from: projectId, to: taskId });
          taskX += 200;
          if (taskX > 850) {
            taskX = 150;
            taskY += 150;
          }
        }
      }

      // Add Grouped Milestones
      for (const [batchName, subNodes] of Object.entries(milestoneBatches)) {
        const milestoneId = `${projectId}_milestone_${batchName.toLowerCase().replace(/ /g, '_')}`;
        const totalProgress = Math.round(subNodes.reduce((acc, n) => acc + (n.progress || 0), 0) / subNodes.length);
        const status = totalProgress === 100 ? 'done' : totalProgress > 0 ? 'active' : 'planned';

        nodes.push({
          id: milestoneId,
          label: batchName,
          type: 'milestone',
          status,
          initialX: taskX,
          initialY: taskY,
          color: projectNode.color,
          progress: totalProgress,
          domain,
          subNodes
        });
        edges.push({ from: projectId, to: milestoneId });

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
          link: path.join(TRACKS_DIR, trackFolder, 'index.md').replace(/\\/g, '/')
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
