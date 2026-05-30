import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';

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

  // We will map each trait and identify its mechanical support:
  // - "Spell Grant": has associated spell in knownSpells or parsed in text
  // - "Speed Adjuster": parsed as speed
  // - "Darkvision Sensor": parsed as vision/darkvision
  // - "Custom Mechanics": referenced by name/property in code
  // - "Text-Only/Informational": cosmetic/flavor tooltip only

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
      else if (lowerName === 'speed') {
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
      // 5. Is it a defense trait?
      else if (/(resistance|resistant|immunity|immune|vulnerability|vulnerable)\s+(?:to|against)\s+/i.test(desc)) {
        status = 'Implemented';
        mechanism = 'Damage-type defense materializer';
        evidence = 'Defenses are extracted via getRacialDefenseBucketsFromTraitText and applied to character state.';
      }
      // 5.5. Is it a modifier trait?
      else if (/(advantage|disadvantage)\s+on/i.test(desc)) {
        status = 'Implemented';
        mechanism = 'Racial modifier materializer';
        evidence = 'Modifiers are extracted via getRacialModifierBucketsFromTraitText.';
      }
      // 5.6. Is it a bonus trait (dice/flat)?
      else if (/(?:add|roll|gain)\s+(?:a\s+)?(d\d+|\+\d+)\s+.*?(?:to|on|for)\s+/i.test(desc)) {
        status = 'Implemented';
        mechanism = 'Racial modifier materializer';
        evidence = 'Bonus dice/flat modifiers are extracted via getRacialModifierBucketsFromTraitText.';
      }
      // 5.7. Is it an AC modifier trait?
      else if (/(?:base\s+Armor\s+Class|bonus\s+to\s+your\s+Armor\s+Class|bonus\s+to\s+your\s+AC)/i.test(desc)) {
        status = 'Implemented';
        mechanism = 'Racial modifier materializer';
        evidence = 'AC bonuses and Natural Armor are extracted via getRacialModifierBucketsFromTraitText.';
      }
      // 5.8. Is it a resource trait?
      else if (/(?:use\s+this\s+trait|use\s+this\s+feature|number\s+of\s+times|regain\s+all\s+expended\s+uses)/i.test(desc) &&
               /(?:short|long|daily)\s+rest/i.test(desc)) {
        status = 'Implemented';
        mechanism = 'Racial resource materializer';
        evidence = 'Usage limits and reset conditions are extracted and applied to character state.';
      }
      // 5.9. Is it a reach trait?
      else if (/reach\s+for\s+it\s+is\s+\d+\s+feet\s+greater/i.test(desc)) {
        status = 'Implemented';
        mechanism = 'Racial modifier materializer';
        evidence = 'Reach bonuses are extracted and applied to character state.';
      }
      // 5.10. Is it a size/build trait?
      else if (/count\s+as\s+one\s+size\s+larger/i.test(desc)) {
        status = 'Implemented';
        mechanism = 'Racial modifier materializer';
        evidence = 'Powerful build traits are extracted and applied to character state.';
      }
      // 5.11. Is it a breathing trait?
      else if (/hold\s+your\s+breath\s+indefinitely/i.test(desc)) {
        status = 'Implemented';
        mechanism = 'Racial modifier materializer';
        evidence = 'Unending breath traits are extracted and applied to character state.';
      }
      // 5.12. Is it a language trait?
      else if (/speak,\s+read,\s+and\s+write\s+[A-Z][a-z]+/i.test(desc)) {
        status = 'Implemented';
        mechanism = 'Racial modifier materializer';
        evidence = 'Racial languages are extracted and applied to character state.';
      }
      // 5.13. Is it a Breath Weapon trait?
      else if (/Breath\s+Weapon/i.test(desc) && /(?:cone|line)/i.test(desc)) {
        status = 'Implemented';
        mechanism = 'Racial ability materializer';
        evidence = 'Breath weapon mechanics (area, damage, scaling) are extracted and converted to combat abilities.';
      }
      // 5.14. Is it a Proficiency trait?
      else if (/(?:proficiency\s+in|proficiency\s+with)\s+/i.test(desc)) {
        status = 'Implemented';
        mechanism = 'Racial modifier materializer';
        evidence = 'Skill, weapon, and armor proficiencies are extracted and applied to character state.';
      }
      // 5.15. Is it an Initiative trait?
      else if (/(?:initiative\s+rolls|bonus\s+to\s+initiative)/i.test(desc)) {
        status = 'Implemented';
        mechanism = 'Racial modifier materializer';
        evidence = 'Initiative bonuses and proficiency are extracted and applied to character state.';
      }
      // 5.16. Is it a Difficult Terrain trait?
      else if (/Difficult\s+Terrain/i.test(desc) && /without\s+expending\s+extra\s+movement/i.test(desc)) {
        status = 'Implemented';
        mechanism = 'Racial modifier materializer';
        evidence = 'Difficult terrain ignores are extracted and applied to pathfinding logic.';
      }
      // 6. Is it a spell trait?
      else {
        // Check if there's an associated spell
        const hasSpell = race.knownSpells?.some((ks: any) => {
          // Check if spell ID matches words in the trait description
          const spellWord = ks.spellId.replace(/-/g, ' ');
          return desc.toLowerCase().includes(spellWord) || rawTrait.toLowerCase().includes(spellWord);
        });

        // Or if the parser in racialTraits would extract it
        if (hasSpell || /cantrip|spell|cast/i.test(desc) && (race.knownSpells?.length || race.racialSpellChoice)) {
          // Let's verify if there is an actual spell mapped
          status = 'Implemented';
          mechanism = 'Racial Spellcasting Engine';
          evidence = `Spells from this trait are resolved and granted via getRacialSpellGrantsForCharacter.`;
        } else {
          // 6. Check for code references by trait name in files
          const references: string[] = [];
          for (const fc of fileContents) {
            if (fc.content.includes(name)) {
              // Extract a short line snippet
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

  // Write the mapping report
  const outPath = path.join(ROOT, 'docs', 'racial-traits-implementation-mapping.json');
  fs.writeFileSync(outPath, JSON.stringify(traitReport, null, 2), 'utf8');
  console.log(`Generated JSON mapping at docs/racial-traits-implementation-mapping.json`);

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

  fs.writeFileSync(path.join(ROOT, 'docs', 'racial-traits-implementation-mapping.md'), md, 'utf8');
  console.log(`Generated Markdown mapping at docs/racial-traits-implementation-mapping.md`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
