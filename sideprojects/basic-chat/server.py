from __future__ import annotations

import base64
import http.server
import json
import mimetypes
import socket
import socketserver
import sys
import threading
import time
import urllib.parse
import uuid
from pathlib import Path


DATA_DIR_NAME = "data"
IMAGES_DIR_NAME = "images"
MESSAGES_FILE_NAME = "messages.json"

MAX_MESSAGES = 5000
MAX_UPLOAD_BYTES = 5_000_000


def _json_dumps(data: object) -> bytes:
    return (json.dumps(data, ensure_ascii=False, indent=2) + "\n").encode("utf-8")


class ChatStore:
    def __init__(self, data_dir: Path) -> None:
        self._data_dir = data_dir
        self._images_dir = data_dir / IMAGES_DIR_NAME
        self._messages_path = data_dir / MESSAGES_FILE_NAME
        self._lock = threading.Lock()
        self._messages: list[dict[str, object]] = []
        self._next_id = 1

        self._images_dir.mkdir(parents=True, exist_ok=True)
        self._data_dir.mkdir(parents=True, exist_ok=True)
        self._load()

    def _load(self) -> None:
        if not self._messages_path.exists():
            self._persist_unlocked()
            return

        try:
            raw = self._messages_path.read_text(encoding="utf-8")
            parsed = json.loads(raw) if raw.strip() else []
        except (OSError, json.JSONDecodeError):
            parsed = []

        if isinstance(parsed, list):
            self._messages = [m for m in parsed if isinstance(m, dict)]
        else:
            self._messages = []

        max_id = 0
        for m in self._messages:
            mid = m.get("id")
            if isinstance(mid, int) and mid > max_id:
                max_id = mid
        self._next_id = max_id + 1

    def _persist_unlocked(self) -> None:
        tmp_path = self._messages_path.with_suffix(".json.tmp")
        payload = self._messages[-MAX_MESSAGES:]
        tmp_path.write_bytes(_json_dumps(payload))
        tmp_path.replace(self._messages_path)

    def list_since(self, since_id: int) -> list[dict[str, object]]:
        with self._lock:
            if since_id <= 0:
                return list(self._messages)
            return [m for m in self._messages if isinstance(m.get("id"), int) and int(m["id"]) > since_id]

    def add_text(self, user: str, text: str) -> dict[str, object]:
        now_ms = int(time.time() * 1000)
        with self._lock:
            message = {
                "id": self._next_id,
                "ts": now_ms,
                "user": user,
                "kind": "text",
                "text": text,
            }
            self._next_id += 1
            self._messages.append(message)
            self._persist_unlocked()
            return message

    def add_image(self, user: str, caption: str, filename: str, content: bytes) -> dict[str, object]:
        if len(content) > MAX_UPLOAD_BYTES:
            raise ValueError(f"Image too large ({len(content)} bytes). Limit is {MAX_UPLOAD_BYTES} bytes.")

        ext = Path(filename).suffix.lower()
        if not ext or len(ext) > 10:
            ext = ".bin"
        safe_name = f"{int(time.time() * 1000)}-{uuid.uuid4().hex}{ext}"
        disk_path = self._images_dir / safe_name
        disk_path.write_bytes(content)

        now_ms = int(time.time() * 1000)
        with self._lock:
            message = {
                "id": self._next_id,
                "ts": now_ms,
                "user": user,
                "kind": "image",
                "text": caption or None,
                "imageUrl": f"/{DATA_DIR_NAME}/{IMAGES_DIR_NAME}/{safe_name}",
            }
            self._next_id += 1
            self._messages.append(message)
            self._persist_unlocked()
            return message


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    chat_store: ChatStore | None = None

    def _read_json_body(self) -> dict[str, object] | None:
        clen_raw = self.headers.get("Content-Length", "0")
        try:
            clen = int(clen_raw)
        except ValueError:
            clen = 0

        if clen <= 0:
            return None
        if clen > MAX_UPLOAD_BYTES * 3:
            return None

        try:
            payload = json.loads(self.rfile.read(clen).decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError):
            return None

        return payload if isinstance(payload, dict) else None

    def _parse_data_url(self, data_url: str) -> tuple[str, bytes] | None:
        if not data_url.startswith("data:"):
            return None
        if ";base64," not in data_url:
            return None
        header, b64 = data_url.split(";base64,", 1)
        mime = header[5:] or "application/octet-stream"
        try:
            decoded = base64.b64decode(b64, validate=True)
        except Exception:
            return None
        return mime, decoded

    def log_message(self, format: str, *args: object) -> None:  # noqa: A002
        # Suppress per-request logging to stdout/stderr to keep the dev server stable
        # in restricted harness environments.
        return

    def _send_json(self, status: int, data: object) -> None:
        body = _json_dumps(data)
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _send_error_json(self, status: int, message: str) -> None:
        self._send_json(status, {"error": message})

    def do_GET(self) -> None:  # noqa: N802
        parsed = urllib.parse.urlsplit(self.path)
        if parsed.path == "/api/messages":
            store = self.chat_store
            if store is None:
                self._send_error_json(500, "Chat store not initialized.")
                return
            query = urllib.parse.parse_qs(parsed.query)
            since_raw = (query.get("since") or ["0"])[0]
            try:
                since_id = int(since_raw)
            except ValueError:
                since_id = 0
            self._send_json(200, {"messages": store.list_since(since_id)})
            return

        if parsed.path == "/api/health":
            self._send_json(200, {"ok": True})
            return

        super().do_GET()

    def do_POST(self) -> None:  # noqa: N802
        parsed = urllib.parse.urlsplit(self.path)
        if parsed.path != "/api/messages":
            self._send_error_json(404, "Not found.")
            return

        store = self.chat_store
        if store is None:
            self._send_error_json(500, "Chat store not initialized.")
            return

        ctype = self.headers.get("Content-Type", "")
        if ctype.startswith("application/json"):
            payload = self._read_json_body()
            if payload is None:
                self._send_error_json(400, "Invalid JSON.")
                return

            user = str(payload.get("user") or "").strip()
            if not user:
                self._send_error_json(400, "Missing user.")
                return

            text = str(payload.get("text") or "").strip()
            image_data_url = payload.get("imageDataUrl")
            if isinstance(image_data_url, str) and image_data_url:
                parsed_url = self._parse_data_url(image_data_url)
                if parsed_url is None:
                    self._send_error_json(400, "Invalid imageDataUrl.")
                    return
                mime, content = parsed_url
                if len(content) > MAX_UPLOAD_BYTES:
                    self._send_error_json(413, f"Image too large ({len(content)} bytes). Limit is {MAX_UPLOAD_BYTES} bytes.")
                    return
                ext = mimetypes.guess_extension(mime) or ".bin"
                message = store.add_image(user, text, f"upload{ext}", content)
                self._send_json(201, {"message": message})
                return

            if not text:
                self._send_error_json(400, "Missing text.")
                return

            message = store.add_text(user, text)
            self._send_json(201, {"message": message})
            return

        self._send_error_json(415, f"Unsupported Content-Type: {ctype}")


class DualStackServer(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    address_family = socket.AF_INET6

    def server_bind(self) -> None:
        # Accept both IPv6 and IPv4 (via v4-mapped addresses) so `http://localhost`
        # doesn't stall while the browser falls back from ::1 to 127.0.0.1.
        try:
            self.socket.setsockopt(socket.IPPROTO_IPV6, socket.IPV6_V6ONLY, 0)
        except OSError:
            pass
        super().server_bind()


def main() -> int:
    port = 4173
    if len(sys.argv) > 1:
        try:
            port = int(sys.argv[1])
        except ValueError:
            print(f"Invalid port: {sys.argv[1]}", file=sys.stderr)
            return 2

    web_root = Path(__file__).resolve().parent
    QuietHandler.directory = str(web_root)
    QuietHandler.chat_store = ChatStore(web_root / DATA_DIR_NAME)

    with DualStackServer(("::", port), QuietHandler) as httpd:
        print(f"Serving {web_root} at http://localhost:{port}/")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            return 0

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
