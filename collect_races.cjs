const fs = require('fs');
const path = require('path');

const RACE_DIR = 'src/data/races';
const GLOSSARY_FILE = 'public/data/glossary/index/character_races.json';
const PUBLIC_DIR = 'public';

function fileExists(relativePath) {
    if (!relativePath) return false;
    // Remove query params or anchors if any (unlikely for local files but good practice)
    const cleanPath = relativePath.split('?')[0].split('#')[0];
    // Remove leading slash if present to make it relative to public/
    const normalizedPath = cleanPath.startsWith('/') ? cleanPath.slice(1) : cleanPath;
    const fullPath = path.join(PUBLIC_DIR, normalizedPath);
    return fs.existsSync(fullPath);
}

function getCreatorRaces() {
    const races = {};
    const files = fs.readdirSync(RACE_DIR);
    
    files.forEach(filename => {
        if (filename.endsWith('.ts') && filename !== 'index.ts' && filename !== 'raceGroups.ts') {
            const filepath = path.join(RACE_DIR, filename);
            const content = fs.readFileSync(filepath, 'utf8');
            
            const idMatch = content.match(/id:\s*['"]([^'"]+)['"]/);
            const nameMatch = content.match(/name:\s*['"]([^'"]+)['"]/);
            const maleMatch = content.match(/maleIllustrationPath:\s*['"]([^'"]+)['"]/);
            const femaleMatch = content.match(/femaleIllustrationPath:\s*['"]([^'"]+)['"]/);
            
            if (idMatch && nameMatch) {
                const raceId = idMatch[1];
                races[raceId] = {
                    name: nameMatch[1],
                    id: raceId,
                    source: 'Creator',
                    maleImgPath: maleMatch ? maleMatch[1] : null,
                    femaleImgPath: femaleMatch ? femaleMatch[1] : null
                };
            }
        }
    });
    return races;
}

function getGlossaryRaces() {
    const content = fs.readFileSync(GLOSSARY_FILE, 'utf8');
    const data = JSON.parse(content);
    const races = {};
    
    function processEntry(entry) {
        let maleImg = null;
        let femaleImg = null;
        
        if (entry.filePath) {
            // Read the detail file
            const detailPath = path.join(PUBLIC_DIR, entry.filePath);
            if (fs.existsSync(detailPath)) {
                try {
                    const detailContent = fs.readFileSync(detailPath, 'utf8');
                    const detailJson = JSON.parse(detailContent);
                    maleImg = detailJson.maleImageUrl;
                    femaleImg = detailJson.femaleImageUrl;
                } catch (e) {
                    console.error(`Error reading ${detailPath}: ${e.message}`);
                }
            }
        }

        races[entry.id] = {
            name: entry.title,
            id: entry.id,
            source: 'Glossary',
            maleImgPath: maleImg,
            femaleImgPath: femaleImg
        };
        
        if (entry.subEntries) {
            entry.subEntries.forEach(processEntry);
        }
    }
    
    data.forEach(processEntry);
    return races;
}

function main() {
    const creatorRaces = getCreatorRaces();
    const glossaryRaces = getGlossaryRaces();
    
    // Merge list to handle unique races
    const allRaceIds = new Set([...Object.keys(creatorRaces), ...Object.keys(glossaryRaces)]);
    
    console.log(`Total Unique Races Found: ${allRaceIds.size}`);
    
    let missingCount = 0;
    
    allRaceIds.forEach(raceId => {
        const creator = creatorRaces[raceId];
        const glossary = glossaryRaces[raceId];
        
        const name = creator ? creator.name : glossary.name;
        
        const missing = [];
        
        // Check Male
        let malePath = null;
        if (creator && creator.maleImgPath) malePath = creator.maleImgPath;
        else if (glossary && glossary.maleImgPath) malePath = glossary.maleImgPath;
        
        if (!malePath || !fileExists(malePath)) {
            missing.push("Male");
        }
        
        // Check Female
        let femalePath = null;
        if (creator && creator.femaleImgPath) femalePath = creator.femaleImgPath;
        else if (glossary && glossary.femaleImgPath) femalePath = glossary.femaleImgPath;
        
        if (!femalePath || !fileExists(femalePath)) {
            missing.push("Female");
        }
        
        if (missing.length > 0) {
            missingCount++;
            console.log(`MISSING_IMAGE: ${name} (${raceId}) [${missing.join(', ')}]`);
        }
    });
    
    const todoContent = [];
    todoContent.push("# Race Image Generation TODO List");
    todoContent.push(`Total Unique Races: ${allRaceIds.size}`);
    todoContent.push(`Missing Images: ${missingCount}`);
    todoContent.push(`\n## Missing Images\n`);

    allRaceIds.forEach(raceId => {
        const creator = creatorRaces[raceId];
        const glossary = glossaryRaces[raceId];
        
        const name = creator ? creator.name : glossary.name;
        
        const missing = [];
        
        // Check Male
        let malePath = null;
        if (creator && creator.maleImgPath) malePath = creator.maleImgPath;
        else if (glossary && glossary.maleImgPath) malePath = glossary.maleImgPath;
        
        if (!malePath || !fileExists(malePath)) {
            missing.push("Male");
        }
        
        // Check Female
        let femalePath = null;
        if (creator && creator.femaleImgPath) femalePath = creator.femaleImgPath;
        else if (glossary && glossary.femaleImgPath) femalePath = glossary.femaleImgPath;
        
        if (!femalePath || !fileExists(femalePath)) {
            missing.push("Female");
        }
        
        if (missing.length > 0) {
            todoContent.push(`- [ ] **${name}** (${raceId}) - Missing: ${missing.join(', ')}`);
        }
    });

    fs.writeFileSync('RACE_IMAGES_TODO.md', todoContent.join('\n'));
    console.log(`Generated RACE_IMAGES_TODO.md with ${missingCount} entries.`);
}

main();