import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const batchDir = path.join(root, 'docs', 'tasks', 'item-icons');
const equipmentDir = path.join(root, 'public', 'data', 'glossary', 'entries', 'equipment');
const outputDir = path.join(root, 'public', 'assets', 'icons', 'items');
const checklistPattern = /^- \[ \] `([^`]+)` \(Name: (.*), Type: ([^)]+)\)$/;

const palettes = {
  weapon: ['#a6b4c8', '#334155', '#f59e0b', '#7c2d12'],
  armor: ['#cbd5e1', '#475569', '#60a5fa', '#1e3a8a'],
  accessory: ['#f9a8d4', '#7e22ce', '#facc15', '#312e81'],
  consumable: ['#ef4444', '#7f1d1d', '#fca5a5', '#16a34a'],
  treasure: ['#fbbf24', '#78350f', '#fde68a', '#0f766e'],
  tool: ['#94a3b8', '#44403c', '#f97316', '#1f2937'],
  default: ['#93c5fd', '#1e3a8a', '#f8fafc', '#14b8a6'],
};

function hashText(text) {
  let hash = 2166136261;
  for (const char of text) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function escapeXml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function parseBatchItems() {
  if (!fs.existsSync(batchDir)) return [];

  const batchFiles = fs
    .readdirSync(batchDir)
    .filter((file) => /^BATCH-\d+-ITEMS\.md$/.test(file))
    .sort();

  const items = [];
  for (const file of batchFiles) {
    const fullPath = path.join(batchDir, file);
    const lines = fs.readFileSync(fullPath, 'utf8').split(/\r?\n/);
    for (const line of lines) {
      const match = line.match(checklistPattern);
      if (match) {
        items.push({
          id: match[1],
          name: match[2],
          type: match[3],
          batch: file.replace('-ITEMS.md', ''),
        });
      }
    }
  }

  return items;
}

function classifyItemType(name, metadataType = '') {
  const text = `${name} ${metadataType}`.toLowerCase();
  if (text.includes('weapon') || text.includes('sword') || text.includes('bow') || text.includes('staff') || text.includes('wand') || text.includes('rod')) return 'weapon';
  if (text.includes('armor') || text.includes('shield') || text.includes('mail')) return 'armor';
  if (text.includes('potion') || text.includes('poison') || text.includes('elixir')) return 'consumable';
  if (text.includes('ring') || text.includes('amulet') || text.includes('cloak') || text.includes('boots') || text.includes('gloves')) return 'accessory';
  if (text.includes('tools') || text.includes('kit') || text.includes('supplies') || text.includes('utensils')) return 'tool';
  return 'treasure';
}

function parseEquipmentItems() {
  if (!fs.existsSync(equipmentDir)) return [];

  return fs
    .readdirSync(equipmentDir)
    .filter((file) => file.endsWith('.json'))
    .sort()
    .map((file) => {
      const data = JSON.parse(fs.readFileSync(path.join(equipmentDir, file), 'utf8'));
      return {
        id: data.id,
        name: data.title,
        type: classifyItemType(data.title, data.itemMetadata?.type),
        batch: 'equipment-json',
      };
    })
    .filter((item) => item.id && item.name);
}

function iconFamily(name, type) {
  const joined = `${name} ${type}`.toLowerCase();
  if (joined.includes('potion') || joined.includes('elixir') || joined.includes('vial')) return 'vessel';
  if (joined.includes('sword') || joined.includes('blade') || joined.includes('axe') || joined.includes('mace')) return 'blade';
  if (joined.includes('bow') || joined.includes('arrow')) return 'bow';
  if (joined.includes('armor') || joined.includes('mail') || joined.includes('shield')) return 'shield';
  if (joined.includes('ring') || joined.includes('amulet') || joined.includes('necklace')) return 'jewel';
  if (joined.includes('scroll') || joined.includes('book') || joined.includes('tome')) return 'paper';
  if (joined.includes('gem') || joined.includes('diamond') || joined.includes('ruby') || joined.includes('emerald')) return 'gem';
  if (joined.includes('ship') || joined.includes('boat') || joined.includes('airship')) return 'vehicle';
  return 'relic';
}

function buildMotif(family, h, colors) {
  const turn = h % 9;
  const rotate = -14 + ((h >>> 4) % 29);
  const sparkleX = 5 + ((h >>> 8) % 14);
  const sparkleY = 4 + ((h >>> 12) % 13);

  if (family === 'blade') {
    return `
  <g transform="rotate(${rotate} 12 12)">
    <path d="M13.2 2.8 18.9 8.5 8.4 19 5 20.1 6.1 16.7 16.6 6.2Z" fill="${colors[0]}" stroke="${colors[1]}" stroke-width="0.7"/>
    <path d="M15.9 5.4 18.4 7.9 9.1 17.2 7.6 17.7 8.1 16.2Z" fill="${colors[2]}" opacity="0.58"/>
    <path d="M5.2 14.7 9.3 18.8" stroke="${colors[3]}" stroke-width="1.5" stroke-linecap="round"/>
  </g>`;
  }

  if (family === 'bow') {
    return `
  <path d="M8.2 3.1c5.6 3.3 5.6 14.5 0 17.8" fill="none" stroke="${colors[0]}" stroke-width="2.1" stroke-linecap="round"/>
  <path d="M8.6 3.7c2.1 4.6 2.1 12.1 0 16.6" fill="none" stroke="${colors[2]}" stroke-width="0.9" stroke-linecap="round"/>
  <path d="M8.8 12h10.3" stroke="${colors[1]}" stroke-width="1.1" stroke-linecap="round"/>
  <path d="m17.3 9.7 3.1 2.3-3.1 2.3Z" fill="${colors[3]}"/>`;
  }

  if (family === 'shield') {
    return `
  <path d="M12 2.8 19 5.6v5.2c0 4.5-2.8 7.9-7 10.4-4.2-2.5-7-5.9-7-10.4V5.6Z" fill="${colors[1]}" stroke="${colors[0]}" stroke-width="0.8"/>
  <path d="M12 4.6 17.1 6.6v4.2c0 3-1.8 5.4-5.1 7.8Z" fill="${colors[0]}" opacity="0.62"/>
  <path d="M8 10.3h8M12 6.2v11" stroke="${colors[2]}" stroke-width="0.8" opacity="0.78"/>`;
  }

  if (family === 'vessel') {
    return `
  <path d="M9 3.4h6v2.3l-1.2 1.4v2.1l3.5 6.7c1.1 2.2-.4 4.7-2.9 4.7H9.6c-2.5 0-4-2.5-2.9-4.7l3.5-6.7V7.1L9 5.7Z" fill="${colors[0]}" stroke="${colors[1]}" stroke-width="0.75"/>
  <path d="M8.2 15.3h7.6l.8 1.6c.5 1-.2 2.2-1.4 2.2H8.8c-1.2 0-1.9-1.2-1.4-2.2Z" fill="${colors[2]}" opacity="0.76"/>
  <path d="M10.1 4.4h3.8" stroke="${colors[3]}" stroke-width="1.4" stroke-linecap="round"/>`;
  }

  if (family === 'jewel') {
    return `
  <circle cx="12" cy="12" r="6.3" fill="none" stroke="${colors[0]}" stroke-width="2"/>
  <path d="M12 5.8 16.8 12 12 18.2 7.2 12Z" fill="${colors[2]}" stroke="${colors[1]}" stroke-width="0.7"/>
  <path d="M9.5 12h5M12 8.3v7.4" stroke="${colors[3]}" stroke-width="0.65" opacity="0.8"/>`;
  }

  if (family === 'paper') {
    return `
  <path d="M7 3.4h8.4L18 6v14.6H7Z" fill="${colors[0]}" stroke="${colors[1]}" stroke-width="0.75"/>
  <path d="M15.2 3.8V6.4h2.4" fill="none" stroke="${colors[2]}" stroke-width="0.75"/>
  <path d="M9 9.2h6M9 12h5.2M9 14.8h6" stroke="${colors[3]}" stroke-width="0.75" stroke-linecap="round"/>`;
  }

  if (family === 'gem') {
    return `
  <path d="M7.1 5.5h9.8l3 4.2L12 20.2 4.1 9.7Z" fill="${colors[2]}" stroke="${colors[1]}" stroke-width="0.75"/>
  <path d="M7.1 5.5 12 20.2 16.9 5.5M4.1 9.7h15.8" stroke="${colors[0]}" stroke-width="0.65" opacity="0.72"/>
  <path d="M8.3 7.1h3.1" stroke="#ffffff" stroke-width="0.8" opacity="0.7" stroke-linecap="round"/>`;
  }

  if (family === 'vehicle') {
    return `
  <path d="M4.2 14.8h15.6l-2.3 3.8H7.2Z" fill="${colors[1]}" stroke="${colors[0]}" stroke-width="0.75"/>
  <path d="M8.2 5.2 16.8 8.4v6.4H8.2Z" fill="${colors[0]}" opacity="0.68"/>
  <path d="M10 6.5v8.1M13.2 7.5v7.1M6.2 18.9h11.6" stroke="${colors[2]}" stroke-width="0.75"/>`;
  }

  return `
  <path d="M12 ${3.2 + turn * 0.08} 18.6 7.1v9.8L12 20.8 5.4 16.9V7.1Z" fill="${colors[1]}" stroke="${colors[0]}" stroke-width="0.75"/>
  <path d="M12 5.1v15.7M5.8 7.4 12 11l6.2-3.6" stroke="${colors[2]}" stroke-width="0.65" opacity="0.68"/>
  <circle cx="12" cy="12" r="${2.4 + (turn % 3) * 0.35}" fill="${colors[3]}" opacity="0.55"/>`;
}

function buildSvg(item) {
  const h = hashText(`${item.id}:${item.name}:${item.type}`);
  const palette = palettes[item.type.toLowerCase()] || palettes.default;
  const colors = palette.map((color, index) => {
    if (index === 0) return color;
    return palette[(index + (h % palette.length)) % palette.length];
  });
  const family = iconFamily(item.name, item.type);
  const motif = buildMotif(family, h, colors);
  const accent = 3 + ((h >>> 20) % 6);
  const title = escapeXml(item.name);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" role="img" aria-label="${title}">
  <title>${title}</title>
  <defs>
    <radialGradient id="g" cx="35%" cy="25%" r="75%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.42"/>
      <stop offset="45%" stop-color="${colors[0]}" stop-opacity="0.26"/>
      <stop offset="100%" stop-color="${colors[1]}" stop-opacity="0.86"/>
    </radialGradient>
  </defs>
  <rect x="2.1" y="2.1" width="19.8" height="19.8" rx="5.2" fill="url(#g)" stroke="${colors[0]}" stroke-width="0.7"/>
  <circle cx="${accent + 3}" cy="${23 - accent}" r="2.8" fill="${colors[2]}" opacity="0.22"/>
${motif}
  <path d="M5.1 5.3c2.1-1.2 4.2-1.6 6.3-1.2" fill="none" stroke="#ffffff" stroke-width="0.65" stroke-linecap="round" opacity="0.48"/>
  <circle cx="${5 + ((h >>> 8) % 14)}" cy="${4 + ((h >>> 12) % 13)}" r="0.8" fill="#ffffff" opacity="0.72"/>
</svg>
`;
}

fs.mkdirSync(outputDir, { recursive: true });

const itemsFromBatches = parseBatchItems();
const items = itemsFromBatches.length > 0 ? itemsFromBatches : parseEquipmentItems();
if (items.length === 0) {
  throw new Error('No item icon source found in batch docs or equipment JSON entries.');
}
const seen = new Set();
for (const item of items) {
  if (seen.has(item.id)) {
    throw new Error(`Duplicate item id in item icon batches: ${item.id}`);
  }
  seen.add(item.id);
  fs.writeFileSync(path.join(outputDir, `${item.id}.svg`), buildSvg(item));
}

console.log(`Generated ${items.length} item SVGs in ${path.relative(root, outputDir)}`);
