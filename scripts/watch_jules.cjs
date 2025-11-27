const { exec } = require('child_process');

const INTERVAL_MS = 70000; // Check every 70 seconds
let lastStatuses = {};

function checkJules() {
  exec('jules remote list --session', (error, stdout, stderr) => {
    if (error) {
      console.error(`Error executing jules: ${error}`);
      return;
    }

    const lines = stdout.split('\n').filter(line => line.trim() !== '');
    // Skip header
    const dataLines = lines.slice(1);

    const currentStatuses = {};
    let hasUpdates = false;

    // console.log(`[${new Date().toLocaleTimeString()}] Checking Jules status...`);

    dataLines.forEach(line => {
      // Naive parsing based on whitespace, assuming ID is first and Status is last
      // ID is usually long int. 
      const parts = line.trim().split(/\s{2,}/); // Split by 2 or more spaces to separate columns
      
      if (parts.length >= 5) {
        const id = parts[0];
        const description = parts[1];
        const repo = parts[2];
        const lastActive = parts[3];
        const status = parts[4];

        currentStatuses[id] = status;

        if (lastStatuses[id] && lastStatuses[id] !== status) {
          console.log(`UPDATE: Task "${description}" changed status: ${lastStatuses[id]} -> ${status}`);
          if (status.toLowerCase().includes('input') || status.toLowerCase().includes('question')) {
             console.log(`ACTION REQUIRED: Check https://jules.google.com/session/${id}`);
          }
          process.exit(0); // Exit so the agent can report back
        } else if (!lastStatuses[id]) {
           // New or first run
           // console.log(`Tracking task: ${id} (${status})`);
        }
      }
    });

    lastStatuses = currentStatuses;
    
    if (!hasUpdates) {
        // Optional: clean output or just show a dot
        // process.stdout.write('.');
    }
  });
}

// console.log("Starting Jules Watcher... (Ctrl+C to stop)");
// console.log("Checking every 70 seconds.");
checkJules();
setInterval(checkJules, INTERVAL_MS);
