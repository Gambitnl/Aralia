/**
 * @file generate-npc.ts
 * CLI Tool to generate functional NPC objects for the Aralia RPG.
 * Usage: npx tsx scripts/generate-npc.ts --role [role] --race [race] --level [n] --count [n]
 */
import { generateNPC, NPCGenerationConfig } from '../src/services/npcGenerator';
import { NPC } from '../src/types/world';

const args = process.argv.slice(2);

/**
 * Parses command line arguments into a generation configuration.
 */
function parseArgs(args: string[]) {
  const config: { 
    role?: string; 
    name?: string; 
    count: number; 
    race?: string; 
    occupation?: string;
    classId?: string;
    level?: number;
    backgroundId?: string;
  } = { count: 1 };
  
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--role') {
      config.role = args[i + 1];
      i++;
    } else if (args[i] === '--name') {
      config.name = args[i + 1];
      i++;
    } else if (args[i] === '--count') {
      config.count = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--race') {
      config.race = args[i + 1];
      i++;
    } else if (args[i] === '--occupation') {
      config.occupation = args[i + 1];
      i++;
    } else if (args[i] === '--class') {
      config.classId = args[i + 1];
      i++;
    } else if (args[i] === '--level') {
      config.level = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--background') {
      config.backgroundId = args[i + 1];
      i++;
    }
  }
  return config;
}

const parsed = parseArgs(args);
const validRoles = ['merchant', 'quest_giver', 'guard', 'civilian', 'unique'] as const;
type ValidRole = (typeof validRoles)[number];
const isValidRole = (value?: string): value is ValidRole =>
  !!value && validRoles.includes(value as ValidRole);

// Validate role if provided
if (parsed.role && !isValidRole(parsed.role)) {
    console.error(`Invalid role: ${parsed.role}. Valid roles are: ${validRoles.join(', ')}`);
    process.exit(1);
}

// Keep the CLI role constrained to the generator's allowed union.
const role: NPCGenerationConfig['role'] = isValidRole(parsed.role) ? parsed.role : 'civilian';
const generated: NPC[] = [];

// Generate the requested number of NPCs
for (let i = 0; i < parsed.count; i++) {
    const config: NPCGenerationConfig = {
        role: role,
        name: parsed.name,
        raceId: parsed.race,
        occupation: parsed.occupation,
        classId: parsed.classId,
        level: parsed.level,
        backgroundId: parsed.backgroundId
    };
    generated.push(generateNPC(config));
}

// Output the resulting array as JSON string
console.log(JSON.stringify(generated, null, 2));
