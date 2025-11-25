// scripts/sync-imports.ts

import fs from 'fs';
import path from 'path';

// Purpose: This script automates the synchronization of the import map in index.html with the dependencies specified in package.json.
// Why: Manually updating the import map is error-prone and tedious. This script ensures consistency and simplifies dependency management.

const packageJsonPath = path.resolve(process.cwd(), 'package.json');
const indexPath = path.resolve(process.cwd(), 'index.html');

// Read and parse package.json
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
const dependencies = packageJson.dependencies;

// Generate the import map from dependencies
const importMap = {
  imports: Object.keys(dependencies).reduce((acc, dep) => {
    // We construct the import map using a CDN that supports esm modules, like esm.sh.
    // This allows us to use bare module specifiers in our code, just like in a Node.js environment.
    acc[dep] = `https://esm.sh/${dep}@${dependencies[dep]}`;
    acc[`${dep}/`] = `https://esm.sh/${dep}@${dependencies[dep]}/`;
    return acc;
  }, {}),
};

// Read index.html
let indexHtml = fs.readFileSync(indexPath, 'utf-8');

// Replace the placeholder with the generated import map
// Using a placeholder in the HTML makes it easy to find and replace the import map without complex parsing.
const importMapJson = JSON.stringify(importMap, null, 2);
const importMapScript = `<script type="importmap">\n${importMapJson}\n</script>`;

indexHtml = indexHtml.replace(
  /<script type="importmap-placeholder"><\/script>/,
  importMapScript
);

// Write the updated index.html
fs.writeFileSync(indexPath, indexHtml);

console.log('Import map in index.html has been successfully updated.');
