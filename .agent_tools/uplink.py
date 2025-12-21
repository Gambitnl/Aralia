import urllib.request
import json
import sys
import argparse
import re
import random
import string
from datetime import datetime
from pathlib import Path

# Configuration
DEFAULT_TOPIC = "jules-ops-73918a"

def get_topic_from_roster():
    """
    Reads the current batch topic from _ROSTER.md.
    Falls back to DEFAULT_TOPIC if not found or if placeholder.
    """
    roster_paths = [
        Path(".jules/_ROSTER.md"),
        Path(__file__).parent.parent / ".jules" / "_ROSTER.md",
    ]
    
    for roster_path in roster_paths:
        if roster_path.exists():
            content = roster_path.read_text(encoding='utf-8')
            # Match topic name with letters, numbers, hyphens, and underscores
            match = re.search(r'https://ntfy\.sh/([a-zA-Z0-9_-]+)', content)
            if match:
                topic = match.group(1)
                # Skip if it's the placeholder
                if "PLACEHOLDER" not in topic:
                    return topic
    
    return DEFAULT_TOPIC

def generate_topic():
    """
    Generates a unique batch topic name.
    Format: jules-batch-YYYYMMDD-HHMMSS-XXXXX
    """
    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    suffix = ''.join(random.choices(string.ascii_lowercase + string.digits, k=5))
    return f"jules-batch-{timestamp}-{suffix}"

def get_base_url(topic=None):
    """Returns the base URL for the topic."""
    if topic is None:
        topic = get_topic_from_roster()
    return f"https://ntfy.sh/{topic}"

def broadcast(message, title="Jules-Explorer", tags="robot", priority=3, topic=None):
    """
    Broadcasts a message to the ntfy.sh topic.

    Args:
        message (str): The plain text message body.
        title (str): The title of the notification (maps to agent_id/type).
        tags (str): Comma-separated emojis or tag names (e.g., 'warning,skull').
        priority (int): Priority level (1=min, 3=default, 5=high).
        topic (str): Optional topic override.
    """
    base_url = get_base_url(topic)
    try:
        # Encode message
        data = message.encode('utf-8')

        # Prepare request
        req = urllib.request.Request(base_url, data=data)

        # Add Headers
        req.add_header("Title", title)
        req.add_header("Tags", tags)
        req.add_header("Priority", str(priority))

        # Send
        with urllib.request.urlopen(req) as response:
            if response.status == 200:
                print(f"Message sent successfully to {base_url}")
            else:
                print(f"Failed to send message. Status: {response.status}", file=sys.stderr)

    except Exception as e:
        print(f"Error sending broadcast: {e}", file=sys.stderr)

def fetch_history(topic=None):
    """
    Fetches the message history from the ntfy.sh topic.
    Returns a list of message objects.
    """
    base_url = get_base_url(topic)
    # poll=1 ensures the connection closes after sending existing messages
    history_url = f"{base_url}/json?since=all&poll=1"
    messages = []

    try:
        with urllib.request.urlopen(history_url) as response:
            if response.status == 200:
                # ntfy.sh returns newline-delimited JSON
                for line in response:
                    if line.strip():
                        try:
                            msg = json.loads(line)
                            # Filter for actual 'message' events (skips 'open', 'keepalive')
                            if msg.get('event') == 'message':
                                messages.append(msg)
                        except json.JSONDecodeError:
                            continue
            else:
                print(f"Failed to fetch history. Status: {response.status}", file=sys.stderr)

    except Exception as e:
        print(f"Error fetching history: {e}", file=sys.stderr)

    return messages

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Agent Uplink Tool")
    parser.add_argument("--read", action="store_true", help="Read message history")
    parser.add_argument("--message", type=str, help="Message to broadcast")
    parser.add_argument("--title", type=str, default="Jules-Explorer", help="Agent Title/ID")
    parser.add_argument("--tags", type=str, default="robot", help="Status tags (emojis)")
    parser.add_argument("--priority", type=int, default=3, help="Priority level (1-5)")
    parser.add_argument("--topic", type=str, help="Override topic (default: read from _ROSTER.md)")
    parser.add_argument("--generate-topic", action="store_true", help="Generate a new unique topic name")

    args, unknown = parser.parse_known_args()

    if args.generate_topic:
        new_topic = generate_topic()
        print(f"Generated topic: {new_topic}")
        print(f"URL: https://ntfy.sh/{new_topic}")
        sys.exit(0)

    # Determine topic
    topic = args.topic if args.topic else None
    base_url = get_base_url(topic)
    print(f"Using topic: {base_url}")

    if args.read:
        print("Fetching history...")
        history = fetch_history(topic)
        if not history:
            print("No messages found.")
        for msg in history:
            # Extract relevant fields
            timestamp = msg.get('time', 'N/A')
            title = msg.get('title', 'No Title')
            tags = msg.get('tags', [])
            body = msg.get('message', '')

            # Format output
            print(f"[{timestamp}] {title} ({','.join(tags)}): {body}")

    elif args.message:
        broadcast(
            message=args.message,
            title=args.title,
            tags=args.tags,
            priority=args.priority,
            topic=topic
        )
    else:
        # Default behavior: Print usage help
        parser.print_help()

