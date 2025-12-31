const fs = require('fs');
const path = require('path');

const worklogsDir = '.jules/worklogs';
const todayDate = '## 2025-12-26';

fs.readdir(worklogsDir, (err, files) => {
  if (err) {
    console.error('Error reading directory:', err);
    process.exit(1);
  }

  files.forEach(file => {
    if (file.startsWith('worklog_') && file.endsWith('.md')) {
      const filePath = path.join(worklogsDir, file);
      
      try {
        const content = fs.readFileSync(filePath, 'utf8');
        const newContent = `${todayDate}\n\n${content}`;
        fs.writeFileSync(filePath, newContent, 'utf8');
        console.log(`Updated ${file}`);
      } catch (readErr) {
        console.error(`Error processing ${file}:`, readErr);
      }
    }
  });
});
