import path from 'path';
import { validateRunPacket } from './roadmap-packet-validation.js';

function usage(): never {
  console.error('Usage: tsx scripts/roadmap-validate-packet.ts --run <run-directory>');
  process.exit(1);
}

function parseArgs() {
  const args = process.argv.slice(2);
  let runDir: string | null = null;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--run') {
      runDir = args[i + 1] ?? null;
      i++;
    } else if (arg === '--help' || arg === '-h') {
      usage();
    }
  }

  if (!runDir) usage();
  return { runDir: path.resolve(process.cwd(), runDir) };
}

function main() {
  const { runDir } = parseArgs();
  try {
    const packet = validateRunPacket(runDir);
    console.log(`Packet validation passed for run: ${packet.runDir}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exit(1);
  }
}

main();
