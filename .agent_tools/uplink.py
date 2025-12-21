import urllib.request
import json
import sys
import argparse

# Configuration
TOPIC = "jules-ops-73918a"
BASE_URL = f"https://ntfy.sh/{TOPIC}"

def broadcast(message, title="Jules-Explorer", tags="robot", priority=3):
    """
    Broadcasts a message to the ntfy.sh topic.

    Args:
        message (str): The plain text message body.
        title (str): The title of the notification (maps to agent_id/type).
        tags (str): Comma-separated emojis or tag names (e.g., 'warning,skull').
        priority (int): Priority level (1=min, 3=default, 5=high).
    """
    try:
        # Encode message
        data = message.encode('utf-8')

        # Prepare request
        req = urllib.request.Request(BASE_URL, data=data)

        # Add Headers
        req.add_header("Title", title)
        req.add_header("Tags", tags)
        req.add_header("Priority", str(priority))

        # Send
        with urllib.request.urlopen(req) as response:
            if response.status == 200:
                print(f"Message sent successfully to {BASE_URL}")
            else:
                print(f"Failed to send message. Status: {response.status}", file=sys.stderr)

    except Exception as e:
        print(f"Error sending broadcast: {e}", file=sys.stderr)

def fetch_history():
    """
    Fetches the message history from the ntfy.sh topic.
    Returns a list of message objects.
    """
    # poll=1 ensures the connection closes after sending existing messages
    history_url = f"{BASE_URL}/json?since=all&poll=1"
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

    args, unknown = parser.parse_known_args()

    print(f"View URL: {BASE_URL}")

    if args.read:
        print("Fetching history...")
        history = fetch_history()
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
            priority=args.priority
        )
    else:
        # Default behavior: Print usage help
        parser.print_help()
