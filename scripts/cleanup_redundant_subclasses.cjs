const fs = require('fs');
const path = require('path');

const spellsDir = path.join(process.cwd(), 'docs', 'spells', 'reference');
const files = fs.readdirSync(spellsDir, { recursive: true }).filter(f => f.endsWith('.md'));

let cleanupCount = 0;

files.forEach(f => {
  const filePath = path.join(spellsDir, f);
  let content = fs.readFileSync(filePath, 'utf8');
  
  const classMatch = content.match(/^- \*\*Classes\*\*: (.*)$/m);
  const subClassMatch = content.match(/^- \*\*Sub-Classes\*\*: (.*)$/m);
  
  if (classMatch && subClassMatch) {
    const classes = classMatch[1].split(',').map(c => c.trim().toLowerCase());
    const originalSubClasses = subClassMatch[1].split(',').map(c => c.trim()).filter(Boolean);
    
    if (originalSubClasses.length === 0) return;

    // Filter out subclasses where the base class is in the `Classes` list
    const cleanedSubClasses = originalSubClasses.filter(sc => {
      const base = sc.split(' - ')[0].toLowerCase().replace(' (legacy)', '');
      return !classes.includes(base);
    });

    if (cleanedSubClasses.length !== originalSubClasses.length) {
      const originalLine = `- **Sub-Classes**: ${originalSubClasses.join(', ')}`;
      
      let newLine = `- **Sub-Classes**: `;
      if (cleanedSubClasses.length > 0) {
        newLine += cleanedSubClasses.join(', ');
      }
      
      content = content.replace(originalLine, newLine);
      fs.writeFileSync(filePath, content, 'utf8');
      
      cleanupCount++;
      console.log(`Cleaned ${f} - removed ${originalSubClasses.length - cleanedSubClasses.length} redundant entries`);
    }
  }
});

console.log(`\nSuccessfully cleaned ${cleanupCount} markdown files.`);
