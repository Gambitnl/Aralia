import urllib.request
import json
import sys

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

if __name__ == "__main__":
    print(f"View URL: {BASE_URL}")
    broadcast(
        message="System Initialized: Uplink Active.",
        title="Jules-Setup",
        tags="rocket,white_check_mark",
        priority=3
    )
