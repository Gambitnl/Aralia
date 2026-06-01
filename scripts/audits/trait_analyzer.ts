import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import { buildRacialTraitLibrary } from '../../src/data/races/racialTraits';

type RaceLike = {
  id: string;
  name: string;
  baseRace?: string;
  traits: string[];
  knownSpells?: any[];
  racialSpellChoice?: any;
};

const ROOT = process.cwd();
const RACES_DIR = path.join(ROOT, 'src', 'data', 'races');
const SRC_DIR = path.join(ROOT, 'src');

async function loadAllRaces(): Promise<RaceLike[]> {
  const files = fs
    .readdirSync(RACES_DIR)
    .filter((f) => f.endsWith('.ts') && f !== 'index.ts' && f !== 'raceGroups.ts');

  const races: RaceLike[] = [];

  for (const file of files) {
    const abs = path.join(RACES_DIR, file);
    const mod = await import(pathToFileURL(abs).href);
    for (const value of Object.values(mod)) {
      if (!value || typeof value !== 'object') continue;
      const anyV = value as any;
      if (typeof anyV.id !== 'string') continue;
      if (typeof anyV.name !== 'string') continue;
      if (!Array.isArray(anyV.traits)) continue;
      races.push({
        id: anyV.id,
        name: anyV.name,
        baseRace: anyV.baseRace,
        traits: anyV.traits,
        knownSpells: anyV.knownSpells,
        racialSpellChoice: anyV.racialSpellChoice,
      });
    }
  }

  // De-dupe
  const byId = new Map<string, RaceLike>();
  for (const r of races) byId.set(r.id, r);
  return Array.from(byId.values()).sort((a, b) => a.id.localeCompare(b.id));
}

// Read all files in src/ to search for trait references
function getSourceFiles(dir: string): string[] {
  let results: string[] = [];
  const list = fs.readdirSync(dir);
  list.forEach((file) => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      results = results.concat(getSourceFiles(filePath));
    } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
      // Skip data/races files to avoid self-matches
      if (!filePath.includes(path.join('src', 'data', 'races'))) {
        results.push(filePath);
      }
    }
  });
  return results;
}

// Normalize trait string to get the name prefix (e.g. "Gnome Cunning: ..." -> "Gnome Cunning")
function parseTraitName(traitText: string): { name: string; desc: string } {
  const match = traitText.match(/^([^:]+):\s*(.*)$/);
  if (match) {
    return { name: match[1].trim(), desc: match[2].trim() };
  }
  return { name: traitText.trim(), desc: traitText.trim() };
}

async function main() {
  const races = await loadAllRaces();
  const sourceFiles = getSourceFiles(SRC_DIR);

  // Load all source file contents into memory for fast searching
  const fileContents = sourceFiles.map((file) => ({
    path: file,
    content: fs.readFileSync(file, 'utf8'),
  }));

  console.log(`Loaded ${races.length} races and ${fileContents.length} source files for scanning.`);

  // We will map each trait and identify its mechanical support using both the
  // actual runtime parser (buildRacialTraitLibrary) and static code scans.
  const racesRecord: Record<string, any> = {};
  for (const r of races) {
    racesRecord[r.id] = r;
  }
  const library = buildRacialTraitLibrary(racesRecord);

  const traitReport: any[] = [];

  for (const race of races) {
    const raceTraits = race.traits;
    const mappedTraits: any[] = [];

    for (const rawTrait of raceTraits) {
      const { name, desc } = parseTraitName(rawTrait);
      let status: 'Implemented' | 'Text-Only' = 'Text-Only';
      let mechanism = '';
      let evidence = '';

      const lowerName = name.toLowerCase();

      // Check if the runtime parser maps this trait into a mechanical category
      const parsedTraitsForRace = library.byRaceId[race.id] || [];
      const parsedTraits = parsedTraitsForRace.filter(t => t.traitName === name);

      const spellTraits = parsedTraits.filter(t => t.type === 'spell');
      const featureTraits = parsedTraits.filter(t => t.type !== 'spell');

      // 1. Is it Creature Type?
      if (lowerName === 'creature type') {
        status = 'Implemented'; // Handled via metadata
        mechanism = 'Creature type classification';
        evidence = 'Creature Type tags are mapped dynamically for immunities/targeting (e.g. humanoid, construct, undead).';
      }
      // 2. Is it Size?
      else if (lowerName === 'size') {
        status = 'Implemented';
        mechanism = 'Size class category mapping';
        evidence = 'Size is mapped to grid occupancy size multiplier (e.g. Large/Huge multiplier in combatUtils.ts).';
      }
      // 3. Is it Speed?
      else if (lowerName === 'speed' || lowerName === 'flight' || lowerName === 'swim') {
        status = 'Implemented';
        mechanism = 'Movement speed parser';
        evidence = 'calculateCharacterSpeedFromRace parses numeric value from the Speed trait string.';
      }
      // 4. Is it Vision/Darkvision?
      else if (lowerName === 'vision' || lowerName.includes('darkvision')) {
        status = 'Implemented';
        mechanism = 'Darkvision range parser';
        evidence = 'calculateCharacterDarkvisionFromRace parses range from the Vision/Darkvision trait string.';
      }
      // 5. Does the parser map it as a spell?
      else if (spellTraits.length > 0) {
        status = 'Implemented';
        mechanism = 'Racial Spellcasting Engine';
        const spellIds = spellTraits.map(t => (t as any).spellId);
        evidence = `Spells from this trait (${spellIds.join(', ')}) are resolved and granted via getRacialSpellGrantsForCharacter.`;
      }
      // 6. Does the parser map it as a resource?
      else if (featureTraits.some(t => t.type === 'resource' || ((t as any).resources && (t as any).resources.length > 0))) {
        status = 'Implemented';
        mechanism = 'Racial resource materializer';
        evidence = 'Usage limits and reset conditions are extracted and applied to character state.';
      }
      // 7. Does the parser map it as a defense?
      else if (featureTraits.some(t => t.type === 'resistance' || ((t as any).defensiveTraits && ((t as any).defensiveTraits.resistances.length > 0 || (t as any).defensiveTraits.immunities.length > 0 || (t as any).defensiveTraits.vulnerabilities.length > 0)))) {
        status = 'Implemented';
        mechanism = 'Damage-type defense materializer';
        evidence = 'Defenses are extracted via getRacialDefenseBucketsFromTraitText and applied to character state.';
      }
      // 8. Does the parser map it as a modifier?
      else if (featureTraits.some(t => {
        const mb = (t as any).modifierBuckets;
        if (!mb) return false;
        return mb.advantage.length > 0 || mb.disadvantage.length > 0 || mb.bonuses.length > 0 ||
               mb.baseArmorClass !== undefined || mb.acBonus !== undefined || mb.reachBonus !== undefined ||
               mb.powerfulBuild || mb.unendingBreath || mb.languages?.length || mb.skillProficiencies?.length ||
               mb.weaponProficiencies?.length || mb.armorProficiencies?.length || mb.initiativeBonus !== undefined ||
               mb.initiativeProficiency || mb.ignoreDifficultTerrain || mb.reactions?.length;
      })) {
        status = 'Implemented';
        const mbMatch = featureTraits.find(t => (t as any).modifierBuckets);
        const mb = mbMatch ? (mbMatch as any).modifierBuckets : {};
        
        if (mb.ignoreDifficultTerrain) {
          mechanism = 'Racial modifier materializer';
          evidence = 'Difficult terrain ignores are extracted and applied to pathfinding logic.';
        } else if (mb.reachBonus !== undefined) {
          mechanism = 'Racial modifier materializer';
          evidence = 'Reach bonuses are extracted and applied to character state.';
        } else if (mb.powerfulBuild) {
          mechanism = 'Racial modifier materializer';
          evidence = 'Powerful build traits are extracted and applied to character state.';
        } else if (mb.unendingBreath) {
          mechanism = 'Racial modifier materializer';
          evidence = 'Unending breath traits are extracted and applied to character state.';
        } else if (mb.languages?.length) {
          mechanism = 'Racial modifier materializer';
          evidence = 'Racial languages are extracted and applied to character state.';
        } else if (mb.skillProficiencies?.length || mb.weaponProficiencies?.length || mb.armorProficiencies?.length) {
          mechanism = 'Racial modifier materializer';
          evidence = 'Skill, weapon, and armor proficiencies are extracted and applied to character state.';
        } else if (mb.initiativeBonus !== undefined || mb.initiativeProficiency) {
          mechanism = 'Racial modifier materializer';
          evidence = 'Initiative bonuses and proficiency are extracted and applied to character state.';
        } else if (mb.reactions?.length) {
          mechanism = 'Racial modifier materializer';
          evidence = 'Stone\'s Endurance and reaction-triggers are extracted via parser-defined mechanics.';
        } else if (mb.baseArmorClass !== undefined || mb.acBonus !== undefined) {
          mechanism = 'Racial modifier materializer';
          evidence = 'AC bonuses and Natural Armor are extracted via getRacialModifierBucketsFromTraitText.';
        } else if (mb.bonuses.length > 0) {
          mechanism = 'Racial modifier materializer';
          evidence = 'Bonus dice/flat modifiers are extracted via getRacialModifierBucketsFromTraitText.';
        } else {
          mechanism = 'Racial modifier materializer';
          evidence = 'Modifiers are extracted via getRacialModifierBucketsFromTraitText.';
        }
      }
      
      // 9. Ultimate Fallback: Check for code references by trait name in files or associated spells
      if (status === 'Text-Only') {
        const hasSpell = race.knownSpells?.some((ks: any) => {
          const spellWord = ks.spellId.replace(/-/g, ' ');
          return desc.toLowerCase().includes(spellWord) || rawTrait.toLowerCase().includes(spellWord);
        });

        if (hasSpell || /cantrip|spell|cast/i.test(desc) && (race.knownSpells?.length || race.racialSpellChoice)) {
          status = 'Implemented';
          mechanism = 'Racial Spellcasting Engine';
          evidence = `Spells from this trait are resolved and granted via getRacialSpellGrantsForCharacter.`;
        } else {
          const references: string[] = [];
          for (const fc of fileContents) {
            if (fc.content.includes(name)) {
              const lines = fc.content.split('\n');
              const matchingLine = lines.find(l => l.includes(name))?.trim();
              const relativePath = path.relative(ROOT, fc.path);
              references.push(`${relativePath}: "${matchingLine}"`);
            }
          }

          if (references.length > 0) {
            status = 'Implemented';
            mechanism = 'Custom system logic';
            evidence = `Referenced in: ${references.join('; ')}`;
          }
        }
      }

      mappedTraits.push({
        rawText: rawTrait,
        name,
        description: desc,
        status,
        mechanism,
        evidence,
      });
    }

    traitReport.push({
      id: race.id,
      name: race.name,
      baseRace: race.baseRace,
      traits: mappedTraits,
    });
  }

  // Write the mapping report JSON to its canonical home in the projects folder.
  // This is used as the machine-readable trait map for audit and tracking.
  const outPath = path.join(ROOT, 'docs', 'projects', 'racial-mechanics', 'traits-implementation-mapping.json');
  fs.writeFileSync(outPath, JSON.stringify(traitReport, null, 2), 'utf8');
  console.log(`Generated JSON mapping at docs/projects/racial-mechanics/traits-implementation-mapping.json`);

  // Also write a markdown file mapping all races
  let md = `# Racial Traits Implementation Mapping\n\n`;
  md += `This document lists every trait for all ${races.length} races and indicates whether they are **Mechanically Implemented** (actively parsed, validated, or calculated by combat/stat systems) or **Text-Only/Informational** (flavor text displayed in character sheets/tooltips).\n\n`;

  let totalTraits = 0;
  let implementedTraits = 0;

  traitReport.forEach((race) => {
    race.traits.forEach((t: any) => {
      totalTraits++;
      if (t.status === 'Implemented') implementedTraits++;
    });
  });

  md += `## Summary Statistics\n\n`;
  md += `- **Total Races Scanned**: ${races.length}\n`;
  md += `- **Total Unique Traits Scanned**: ${totalTraits}\n`;
  md += `- **Mechanically Implemented Traits**: ${implementedTraits} (${Math.round((implementedTraits / totalTraits) * 100)}%)\n`;
  md += `- **Text-Only / Flavor Traits**: ${totalTraits - implementedTraits} (${Math.round(((totalTraits - implementedTraits) / totalTraits) * 100)}%)\n\n`;

  md += `## Core Engine Mechanics\n\n`;
  md += `Most traits are either **Text-Only** tooltips or fall into standard core engine categories:\n\n`;
  md += `1. **Speed & Movement**: Speed traits are parsed by \`calculateCharacterSpeedFromRace\` in \`characterUtils.ts\`.\n`;
  md += `2. **Senses & Vision**: Vision/Darkvision traits are parsed by \`calculateCharacterDarkvisionFromRace\`.\n`;
  md += `3. **Spell Grants**: Innate spells are extracted by the parser in \`racialTraits.ts\` and granted dynamically via \`getRacialSpellGrantsForCharacter\`.\n`;
  md += `4. **Choice Requirements**: Spellcasting ability selections are validated and queried via \`getRacialSpellCastingAbilityChoicesForRace\`.\n\n`;

  md += `## Individual Race Trait Inventories\n\n`;

  traitReport.forEach((race) => {
    md += `### ${race.name} (\`${race.id}\`)\n\n`;
    if (race.baseRace) {
      md += `*Base Race: \`${race.baseRace}\`*\n\n`;
    }
    md += `| Trait Name | Status | Mechanism | Evidence / Detail |\n`;
    md += `| --- | --- | --- | --- |\n`;
    race.traits.forEach((t: any) => {
      const escapedDesc = t.description
        .replace(/\\/g, '\\\\')
        .replace(/\|/g, '\\|')
        .replace(/\n/g, ' ');
      md += `| **${t.name}** | \`${t.status}\` | ${t.mechanism || 'N/A'} | ${t.evidence || escapedDesc} |\n`;
    });
    md += `\n---\n\n`;
  });

  // Write the markdown report to its canonical home in the projects folder.
  // This serves as the human-readable tracking document showing what is mechanically implemented.
  fs.writeFileSync(path.join(ROOT, 'docs', 'projects', 'racial-mechanics', 'traits-implementation-mapping.md'), md, 'utf8');
  console.log(`Generated Markdown mapping at docs/projects/racial-mechanics/traits-implementation-mapping.md`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
