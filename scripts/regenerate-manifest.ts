/** Validate every authored runtime spell before updating the manifest and bundle together. */
import { generateSpellArtifacts } from './spells/artifacts';
generateSpellArtifacts(process.cwd(), process.argv.includes('--check')).catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
