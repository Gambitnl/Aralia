
import os
import re

RACE_DIR = 'src/data/races'
MISSING_IMAGES = []

def check_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
        
    # Simple regex to find the Race object or export
    # We look for something that resembles export const X_DATA: Race = { ... }
    # inside that, we look for visual: { ... }
    
    # Check for name first to identify the race
    name_match = re.search(r"name:\s*['"]([^'"]+)['"]", content)
    id_match = re.search(r"id:\s*['"]([^'"]+)['"]", content)
    
    if not name_match:
        return # Probably not a race definition file
        
    name = name_match.group(1)
    race_id = id_match.group(1) if id_match else "unknown"

    # Check for visual block
    # This is a bit loose, but should work for the formatted code
    has_male = 'maleIllustrationPath' in content
    has_female = 'femaleIllustrationPath' in content
    
    # We might have matches but they could be empty strings or comments? 
    # Let's assume presence of key means it's set, but we should verify value if possible.
    # regex for keys
    
    male_val_match = re.search(r"maleIllustrationPath:\s*['"]([^'"]+)['"]", content)
    female_val_match = re.search(r"femaleIllustrationPath:\s*['"]([^'"]+)['"]", content)
    
    male_missing = not male_val_match or not male_val_match.group(1).strip()
    female_missing = not female_val_match or not female_val_match.group(1).strip()
    
    if male_missing or female_missing:
        MISSING_IMAGES.append({
            'name': name,
            'id': race_id,
            'file': filepath,
            'missing_male': male_missing,
            'missing_female': female_missing
        })

def main():
    for filename in os.listdir(RACE_DIR):
        if filename.endswith('.ts') and filename != 'index.ts' and filename != 'raceGroups.ts':
            check_file(os.path.join(RACE_DIR, filename))
            
    print(f"Found {len(MISSING_IMAGES)} races with missing images.")
    for item in MISSING_IMAGES:
        print(f"Race: {item['name']} (ID: {item['id']})")
        if item['missing_male']: print("  - Missing Male Image")
        if item['missing_female']: print("  - Missing Female Image")

if __name__ == '__main__':
    main()
