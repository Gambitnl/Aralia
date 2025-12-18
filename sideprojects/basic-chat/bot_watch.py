from __future__ import annotations

import argparse
import json
import sys
import time
import urllib.error
import urllib.parse
import urllib.request


def _http_json(method: str, url: str, payload: dict[str, object] | None = None) -> dict[str, object]:
    data = None
    headers = {"Accept": "application/json"}
    if payload is not None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        data = body
        headers["Content-Type"] = "application/json; charset=utf-8"

    req = urllib.request.Request(url, method=method, data=data, headers=headers)
    with urllib.request.urlopen(req, timeout=5) as resp:
        raw = resp.read()
    parsed = json.loads(raw.decode("utf-8"))
    if not isinstance(parsed, dict):
        raise ValueError("Invalid JSON response")
    return parsed


def fetch_messages(base_url: str, since_id: int) -> list[dict[str, object]]:
    url = urllib.parse.urljoin(base_url, "/api/messages")
    if since_id > 0:
        url += "?" + urllib.parse.urlencode({"since": str(since_id)})
    data = _http_json("GET", url)
    msgs = data.get("messages")
    if not isinstance(msgs, list):
        return []
    out: list[dict[str, object]] = []
    for m in msgs:
        if isinstance(m, dict):
            out.append(m)
    return out


def post_text(base_url: str, user: str, text: str) -> None:
    url = urllib.parse.urljoin(base_url, "/api/messages")
    _http_json("POST", url, {"user": user, "text": text})


def _get_id(msg: dict[str, object]) -> int:
    mid = msg.get("id")
    if isinstance(mid, int):
        return mid
    try:
        return int(str(mid))
    except Exception:
        return 0


def _get_user(msg: dict[str, object]) -> str:
    u = msg.get("user")
    return u if isinstance(u, str) else ""


def _get_text(msg: dict[str, object]) -> str:
    t = msg.get("text")
    return t if isinstance(t, str) else ""


def main() -> int:
    ap = argparse.ArgumentParser(description="Basic Chat watcher bot (polls and replies).")
    ap.add_argument("--base-url", default="http://localhost:4173/", help="Chat server base URL")
    ap.add_argument("--user", default="CodexBot", help="Bot username to post as")
    ap.add_argument("--interval", type=int, default=30, help="Poll interval seconds")
    ap.add_argument("--idle-limit", type=int, default=10, help="Stop after N consecutive idle polls")
    ap.add_argument("--since", type=int, default=0, help="Start watching after this message id (0 = from latest)")
    args = ap.parse_args()

    base_url = args.base_url
    if not base_url.endswith("/"):
        base_url += "/"

    try:
        _http_json("GET", urllib.parse.urljoin(base_url, "/api/health"))
    except Exception as exc:
        print(f"[bot] server not reachable: {exc}", file=sys.stderr)
        return 2

    last_seen = max(0, int(args.since))
    if last_seen == 0:
        try:
            msgs = fetch_messages(base_url, 0)
            if msgs:
                last_seen = max(_get_id(m) for m in msgs)
        except Exception:
            last_seen = 0

    idle = 0
    print(f"[bot] watching {base_url} as {args.user} (since id {last_seen})")

    while idle < int(args.idle_limit):
        try:
            new_msgs = fetch_messages(base_url, last_seen)
        except (urllib.error.URLError, TimeoutError, ValueError) as exc:
            print(f"[bot] poll failed: {exc}", file=sys.stderr)
            time.sleep(int(args.interval))
            idle += 1
            continue

        new_msgs = sorted(new_msgs, key=_get_id)
        new_msgs = [m for m in new_msgs if _get_id(m) > last_seen]
        if not new_msgs:
            idle += 1
            print(f"[bot] idle {idle}/{args.idle_limit}")
            time.sleep(int(args.interval))
            continue

        idle = 0
        for m in new_msgs:
            mid = _get_id(m)
            last_seen = max(last_seen, mid)
            from_user = _get_user(m)
            if not from_user or from_user == args.user:
                continue
            txt = _get_text(m).strip()
            if not txt:
                continue
            reply = f"I saw your message (id {mid}) from {from_user}. (Bot will stop after {args.idle_limit} idle polls.)"
            try:
                post_text(base_url, args.user, reply)
            except Exception as exc:
                print(f"[bot] failed to post reply: {exc}", file=sys.stderr)

        time.sleep(1)

    print("[bot] stopping: idle limit reached")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

