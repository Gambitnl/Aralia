import os
import re
import json

RACE_DIR = 'src/data/races'
GLOSSARY_FILE = 'public/data/glossary/index/character_races.json'

def get_creator_races():
    races = {}
    for filename in os.listdir(RACE_DIR):
        if filename.endswith('.ts') and filename != 'index.ts' and filename != 'raceGroups.ts':
            filepath = os.path.join(RACE_DIR, filename)
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()
            
            # Extract ID
            id_match = re.search(r"id:\s*['"]([^'"]+)['"]", content)
            # Extract Name
            name_match = re.search(r"name:\s*['"]([^'"]+)['"]", content)
            
            # Extract Images
            male_match = re.search(r"maleIllustrationPath:\s*['"]([^'"]+)['"]", content)
            female_match = re.search(r"femaleIllustrationPath:\s*['"]([^'"]+)['"]", content)
            
            if id_match and name_match:
                race_id = id_match.group(1)
                races[race_id] = {
                    'name': name_match.group(1),
                    'id': race_id,
                    'file': filename,
                    'male_img': male_match.group(1) if male_match else None,
                    'female_img': female_match.group(1) if female_match else None
                }
    return races

def get_glossary_races():
    with open(GLOSSARY_FILE, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    races = {}
    
    def process_entry(entry):
        # We assume the ID in glossary matches ID in creator, or close to it
        races[entry['id']] = {
            'name': entry['title'],
            'id': entry['id'],
            'filePath': entry.get('filePath')
        }
        if 'subEntries' in entry and entry['subEntries']:
            for sub in entry['subEntries']:
                process_entry(sub)

    for entry in data:
        process_entry(entry)
        
    return races

def main():
    creator_races = get_creator_races()
    glossary_races = get_glossary_races()
    
    print(f"Total Creator Races: {len(creator_races)}")
    print(f"Total Glossary Races: {len(glossary_races)}")
    
    print("\n--- Missing Images in Character Creator ---")
    missing_images_count = 0
    for race_id, race in creator_races.items():
        missing = []
        if not race['male_img']:
            missing.append("Male")
        if not race['female_img']:
            missing.append("Female")
        
        if missing:
            missing_images_count += 1
            print(f"{race['name']} ({race_id}): Missing {', '.join(missing)}")

    print(f"\nTotal races with missing images: {missing_images_count}")

    print("\n--- Races in Creator but NOT in Glossary ---")
    for race_id in creator_races:
        if race_id not in glossary_races:
            # Check if maybe it's under a different ID or grouped
            # Some creator races might be subraces in glossary
            print(f"{creator_races[race_id]['name']} ({race_id})")

if __name__ == '__main__':
    main()
