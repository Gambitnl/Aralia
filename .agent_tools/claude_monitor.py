#!/usr/bin/env python3
import subprocess
import json
import time
import sys

TOPIC = "ag-ops-v2"
LAST_ID_FILE = "./.agent_tools/.claude_last_id"

def get_last_id():
    try:
        with open(LAST_ID_FILE, 'r') as f:
            return f.read().strip()
    except:
        return None

def save_last_id(id_val):
    with open(LAST_ID_FILE, 'w') as f:
        f.write(id_val)

def fetch_messages(last_id=None):
    if last_id:
        url = f"https://ntfy.sh/{TOPIC}/json?poll=1&since={last_id}"
    else:
        url = f"https://ntfy.sh/{TOPIC}/json?poll=1"
    
    result = subprocess.run(['curl', '-s', url], capture_output=True, text=True)
    messages = []
    for line in result.stdout.strip().split('\n'):
        if line and line != 'null':
            try:
                messages.append(json.loads(line))
            except:
                pass
    return messages

def format_message(msg):
    title = msg.get('title', 'Unknown')
    text = msg.get('message', '')[:150]
    return f"[{title}] {text}..."

print("Claude Code Monitor Started")
last_id = get_last_id()
check_count = 0

while True:
    try:
        messages = fetch_messages(last_id)
        for msg in messages:
            title = msg.get('title', '')
            if title != 'Claude Code':  # Don't show our own messages
                print(f"\n>>> {format_message(msg)}")
            last_id = msg.get('id', last_id)
            if last_id:
                save_last_id(last_id)
        
        check_count += 1
        if check_count % 2 == 0:
            print(f"✓ [{check_count} checks]", end='', flush=True)
        
        time.sleep(30)
    except KeyboardInterrupt:
        print("\nMonitor stopped")
        sys.exit(0)
    except Exception as e:
        print(f"Error: {e}")
        time.sleep(30)
