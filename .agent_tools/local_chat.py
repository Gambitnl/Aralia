import os
import json
import argparse
import re
from datetime import datetime
from pathlib import Path
from http.server import HTTPServer, BaseHTTPRequestHandler

# Configuration
CHAT_DIR = Path(".jules")
CHAT_FILE = CHAT_DIR / "LOCAL_CHAT.json"
PORT = 8000

def ensure_file():
    if not CHAT_DIR.exists():
        CHAT_DIR.mkdir(parents=True, exist_ok=True)
    if not CHAT_FILE.exists():
        with open(CHAT_FILE, "w", encoding="utf-8") as f:
            json.dump([], f)

def send_message(message):
    ensure_file()
    
    # Extract agent name: look for #Name at start
    agent = "Unknown"
    tags = []
    
    # Match #AgentName at the start
    agent_match = re.search(r'^#([a-zA-Z0-9_\-]+)', message)
    if agent_match:
        agent = agent_match.group(1)
        # Remove the tag from the message
        message = message[agent_match.end():].strip()
    
    # Match #Tag1,Tag2... after agent or at start
    tags_match = re.search(r'^#([a-zA-Z0-9_,\-]+)', message)
    if tags_match:
        tags = tags_match.group(1).split(",")
        message = message[tags_match.end():].strip()

    with open(CHAT_FILE, "r", encoding="utf-8") as f:
        messages = json.load(f)
    
    msg_obj = {
        "id": len(messages) + 1,
        "agent": agent,
        "message": message,
        "tags": tags,
        "timestamp": datetime.now().isoformat()
    }
    
    messages.append(msg_obj)
    
    with open(CHAT_FILE, "w", encoding="utf-8") as f:
        json.dump(messages, f, indent=2)
    print(f"[{agent}] message logged to {CHAT_FILE}")

def read_messages(count=10, since=None):
    ensure_file()
    with open(CHAT_FILE, "r", encoding="utf-8") as f:
        messages = json.load(f)
    
    if since is not None:
        filtered = [m for m in messages if m['id'] > since]
        print(f"--- {len(filtered)} new messages since ID {since} in {CHAT_FILE} ---")
        for msg in filtered:
            print(f"[{msg['timestamp']}] #{msg['agent']} ({','.join(msg['tags'])}): {msg['message']}")
    else:
        print(f"--- Last {min(len(messages), count)} messages in {CHAT_FILE} ---")
        for msg in messages[-count:]:
            print(f"[{msg['timestamp']}] #{msg['agent']} ({','.join(msg['tags'])}): {msg['message']}")

class ChatHandler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_POST(self):
        if self.path == "/api/messages":
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            try:
                data = json.loads(post_data.decode('utf-8'))
                message = data.get('message', '')
                if message:
                    # Enforce #Human prefix if not present to ensure user identity
                    if not message.startswith("#"):
                        message = f"#Human #user {message}"
                    send_message(message)
                    self.send_response(200)
                    self.send_header("Content-type", "application/json")
                    self.send_header("Access-Control-Allow-Origin", "*")
                    self.end_headers()
                    self.wfile.write(json.dumps({"status": "ok"}).encode())
                else:
                    self.send_error(400, "Missing message")
            except Exception as e:
                self.send_error(500, str(e))
        else:
            self.send_error(404)

    def do_GET(self):
        if self.path == "/api/messages":
            self.send_response(200)
            self.send_header("Content-type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            ensure_file()
            with open(CHAT_FILE, "r", encoding="utf-8") as f:
                self.wfile.write(f.read().encode())
        elif self.path == "/" or self.path == "/index.html":
            self.serve_file("index.html", "text/html")
        elif self.path == "/style.css":
            self.serve_file("style.css", "text/css")
        elif self.path == "/app.js":
            self.serve_file("app.js", "application/javascript")
        else:
            self.send_error(404)

    def serve_file(self, filename, content_type):
        file_path = Path(__file__).parent / "chat_app" / filename
        if file_path.exists():
            self.send_response(200)
            self.send_header("Content-type", content_type)
            self.end_headers()
            with open(file_path, "rb") as f:
                self.wfile.write(f.read())
        else:
            self.send_error(404)

def start_server():
    server = HTTPServer(("localhost", PORT), ChatHandler)
    print(f"Server started at http://localhost:{PORT}")
    server.serve_forever()

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Local Agent Chat Tool & Server")
    parser.add_argument("--send", type=str, help="Message body (start with #Name)")
    parser.add_argument("--read", action="store_true", help="Read last messages")
    parser.add_argument("--since", type=int, help="Read messages since this ID")
    parser.add_argument("--server", action="store_true", help="Start the chat web server")
    parser.add_argument("--clear", action="store_true", help="Clear chat history")

    # Legacy args
    parser.add_argument("--agent", type=str, help="DEPRECATED: Use #Name in --send")
    parser.add_argument("--tags", type=str, help="DEPRECATED: Use #Tag1,Tag2 in --send")

    args = parser.parse_known_args()[0]

    if args.clear:
        if CHAT_FILE.exists():
            CHAT_FILE.unlink()
        ensure_file()
        print("Chat history cleared.")
    elif args.send:
        full_msg = args.send
        if args.agent and not full_msg.startswith("#"):
            full_msg = f"#{args.agent} " + (f"#{args.tags} " if args.tags else "") + full_msg
        send_message(full_msg)
    elif args.read:
        read_messages(since=args.since)
    elif args.server:
        start_server()
    else:
        parser.print_help()
