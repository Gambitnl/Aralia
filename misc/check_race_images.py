
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
    name_match = re.search(r"name:\s*['\"]([^'\"]+)['\"]", content)
    id_match = re.search(r"id:\s*['\"]([^'\"]+)['\"]", content)
    
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
    
    male_val_match = re.search(r"maleIllustrationPath:\s*['\"]([^'\"]+)['\"]", content)
    female_val_match = re.search(r"femaleIllustrationPath:\s*['\"]([^'\"]+)['\"]", content)
    
    male_path = male_val_match.group(1).strip() if male_val_match else None
    female_path = female_val_match.group(1).strip() if female_val_match else None

    # Check if paths are defined
    male_defined = bool(male_path)
    female_defined = bool(female_path)

    # Check if files exist
    male_exists = male_defined and os.path.exists(os.path.join('public', male_path))
    female_exists = female_defined and os.path.exists(os.path.join('public', female_path))
    
    if race_id == 'abyssal_tiefling':
        print(f"DEBUG: {race_id}")
        print(f"  Male Path: {os.path.join('public', male_path) if male_path else 'None'}")
        print(f"  Male Exists: {male_exists}")
        print(f"  Female Path: {os.path.join('public', female_path) if female_path else 'None'}")
        print(f"  Female Exists: {female_exists}")

    if not male_exists or not female_exists:
        MISSING_IMAGES.append({
            'name': name,
            'id': race_id,
            'file': filepath,
            'missing_male': not male_exists,
            'missing_female': not female_exists
        })

def main():
    for filename in os.listdir(RACE_DIR):
        if filename.endswith('.ts') and filename != 'index.ts' and filename != 'raceGroups.ts':
            check_file(os.path.join(RACE_DIR, filename))
            
    print(f"Found {len(MISSING_IMAGES)} races with missing images.")
    for item in MISSING_IMAGES:
        print(f"Race: {item['name']} (ID: {item['id']})")
        print(f"  File: {item['file']}")
        if item['missing_male']: print("  - Missing Male Image")
        if item['missing_female']: print("  - Missing Female Image")

if __name__ == '__main__':
    main()
