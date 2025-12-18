from __future__ import annotations

import http.server
import socket
import socketserver
import sys
from pathlib import Path


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format: str, *args: object) -> None:  # noqa: A002
        # Suppress per-request logging to stdout/stderr to keep the dev server stable
        # in restricted harness environments.
        return


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

    with DualStackServer(("::", port), QuietHandler) as httpd:
        print(f"Serving {web_root} at http://localhost:{port}/")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            return 0

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
