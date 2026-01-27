import json
import re
import os

# Paths
META_PATH = r'C:\Users\gambi\Documents\Git\AraliaV4\Aralia\misc\mdi_meta.json'
JS_PATH = r'C:\Users\gambi\Documents\Git\AraliaV4\Aralia\misc\package\mdi.js'
OUTPUT_PATH = r'C:\Users\gambi\Documents\Git\AraliaV4\Aralia\misc\mdi_data.json'

def to_camel_case(text):
    """Converts hyphenated names to mdiCamelCase."""
    parts = text.split('-')
    return 'mdi' + ''.join(x.title() for x in parts)

def main():
    print("Reading metadata...")
    with open(META_PATH, 'r', encoding='utf-8') as f:
        meta_data = json.load(f)

    print("Reading JS paths...")
    with open(JS_PATH, 'r', encoding='utf-8') as f:
        js_content = f.read()

    # Regex to find: export var mdiXxx = "PATH";
    path_map = {}
    pattern = re.compile(r'export var (mdi[a-zA-Z0-9]+) = "([^"]+)";')
    for match in pattern.finditer(js_content):
        var_name, path = match.groups()
        path_map[var_name] = path

    print(f"Found {len(path_map)} paths in JS file.")

    # Merge
    consolidated = []
    missing_paths = 0
    
    for icon in meta_data:
        camel_name = to_camel_case(icon['name'])
        path = path_map.get(camel_name)
        
        if path:
            consolidated.append({
                "name": icon['name'],
                "path": path,
                "tags": icon.get('tags', []),
                "aliases": icon.get('aliases', []),
                "codepoint": icon.get('codepoint')
            })
        else:
            missing_paths += 1

    print(f"Merged {len(consolidated)} icons. {missing_paths} icons had no path match.")

    print(f"Writing to {OUTPUT_PATH}...")
    with open(OUTPUT_PATH, 'w', encoding='utf-8') as f:
        json.dump(consolidated, f, indent=2)
    
    print("Done!")

if __name__ == "__main__":
    main()
