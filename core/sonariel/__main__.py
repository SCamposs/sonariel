from __future__ import annotations

import argparse
import json
import os
import secrets
import subprocess
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

import requests

from .environment import HIDDEN
from .service import METHODS, Service
from .store import Store, data_home


def launch_command(mode: str) -> list[str]:
    return [sys.executable, mode] if getattr(sys, "frozen", False) else [sys.executable, "-m", "sonariel", mode]


def connection(start: bool = True) -> dict:
    home = data_home()
    registry = home / "run/connection.json"
    def read():
        try:
            info = json.loads(registry.read_text())
            response = requests.get(info["url"] + "/health", headers={"Authorization": "Bearer " + info["token"]}, timeout=1)
            if response.status_code == 200:
                return info
        except (OSError, ValueError, requests.RequestException):
            pass
        return None
    found = read()
    if found:
        return found
    if not start:
        raise RuntimeError("Núcleo indisponível")
    home.mkdir(parents=True, exist_ok=True)
    (home / "logs").mkdir(exist_ok=True)
    with (home / "logs/core.log").open("ab") as log:
        subprocess.Popen(launch_command("serve"), stdin=subprocess.DEVNULL, stdout=log, stderr=log, **HIDDEN)
    for _ in range(150):
        found = read()
        if found:
            return found
        time.sleep(.1)
    raise RuntimeError("Núcleo não iniciou. Consulte logs/core.log no diretório de dados.")


def rpc(method: str, args: dict | None = None):
    info = connection()
    response = requests.post(info["url"] + "/rpc", headers={"Authorization": "Bearer " + info["token"]}, json={"method": method, "args": args or {}}, timeout=300)
    body = response.json()
    if "error" in body:
        raise RuntimeError(body["error"])
    return body["result"]


def serve():
    store = Store()
    lock = (store.home / "run/core.lock").open("a+b")
    lock.seek(0)
    if os.name == "nt":
        import msvcrt
        try:
            msvcrt.locking(lock.fileno(), msvcrt.LK_NBLCK, 1)
        except OSError:
            return
    else:
        import fcntl
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except OSError:
            return
    service = Service(store)
    token = secrets.token_urlsafe(32)

    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *_):
            pass

        def authorized(self):
            return secrets.compare_digest(self.headers.get("Authorization", ""), "Bearer " + token) or secrets.compare_digest(parse_qs(urlparse(self.path).query).get("token", [""])[0], token)

        def json(self, value, status=200):
            data = json.dumps(value, ensure_ascii=False).encode()
            self.send_response(status)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)

        def do_GET(self):
            if not self.authorized():
                return self.json({"error": "Unauthorized"}, 401)
            parsed = urlparse(self.path)
            if parsed.path == "/health":
                return self.json({"service": "Sonariel", "version": "0.1.0"})
            if parsed.path.startswith("/audio/"):
                try:
                    asset = store.asset(parsed.path.split("/")[-1])
                    path = Path(asset["path"])
                    size = path.stat().st_size
                    start, end = 0, size - 1
                    raw_range = self.headers.get("Range")
                    if raw_range:
                        import re
                        match = re.fullmatch(r"bytes=(\d+)-(\d*)", raw_range)
                        if not match:
                            return self.json({"error": "Invalid range"}, 416)
                        start = int(match[1])
                        end = min(int(match[2]), size - 1) if match[2] else size - 1
                        if start >= size or end < start:
                            return self.json({"error": "Invalid range"}, 416)
                    self.send_response(206 if raw_range else 200)
                    self.send_header("Content-Type", "audio/wav" if path.suffix.lower() == ".wav" else "application/octet-stream")
                    self.send_header("Accept-Ranges", "bytes")
                    self.send_header("Cache-Control", "private, max-age=3600")
                    self.send_header("Content-Length", str(end - start + 1))
                    if raw_range:
                        self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
                    self.end_headers()
                    with path.open("rb") as stream:
                        stream.seek(start)
                        remaining = end - start + 1
                        while remaining:
                            chunk = stream.read(min(1024 * 1024, remaining))
                            if not chunk:
                                break
                            self.wfile.write(chunk)
                            remaining -= len(chunk)
                except (OSError, ValueError):
                    return
                return
            self.json({"error": "Not found"}, 404)

        def do_POST(self):
            if not self.authorized():
                return self.json({"error": "Unauthorized"}, 401)
            if self.path != "/rpc":
                return self.json({"error": "Not found"}, 404)
            size = int(self.headers.get("Content-Length", "0"))
            if not 0 < size < 1024 * 1024:
                return self.json({"error": "Invalid payload size"}, 400)
            try:
                request = json.loads(self.rfile.read(size))
                result = service.invoke(request["method"], request.get("args"))
                self.json({"result": result})
            except Exception as error:
                self.json({"error": str(error)}, 400)

    server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    info = {"url": f"http://127.0.0.1:{server.server_port}", "token": token, "pid": os.getpid()}
    registry = store.home / "run/connection.json"
    temporary = registry.with_suffix(".tmp")
    temporary.write_text(json.dumps(info), encoding="utf-8")
    temporary.replace(registry)
    store.event("core", "Núcleo local iniciado; fila única disponível")
    try:
        server.serve_forever()
    finally:
        lock.close()


def mcp():
    connection()  # Does not load the heavy engine.
    protocol = "2024-11-05"
    for line in sys.stdin:
        request = None
        try:
            request = json.loads(line)
            method = request.get("method")
            params = request.get("params", {})
            if "id" not in request:
                continue
            if method == "initialize":
                supported = {"2024-11-05", "2025-03-26", "2025-06-18", "2025-11-25"}
                protocol = params.get("protocolVersion", protocol)
                if protocol not in supported:
                    protocol = "2025-11-25"
                result = {"protocolVersion": protocol, "capabilities": {"tools": {"listChanged": False}}, "serverInfo": {"name": "sonariel", "version": "0.1.0"}, "instructions": "Local CPU audio workflow. Query environment and project context before generating. generate returns a persistent job_id. Poll job_get; never resubmit with a different request_key after uncertainty."}
                rpc("mcp_heartbeat", {"client": params.get("clientInfo", {}).get("name", "MCP client"), "protocol": protocol})
            elif method == "ping":
                result = {}
            elif method == "tools/list":
                result = {"tools": [{"name": "sonariel_" + name, **spec} for name, spec in METHODS.items() if name != "mcp_heartbeat"]}
            elif method == "tools/call":
                name = params["name"]
                if not name.startswith("sonariel_") or name[9:] not in METHODS or name[9:] == "mcp_heartbeat":
                    raise ValueError("Unknown tool")
                try:
                    value = rpc(name[9:], params.get("arguments", {}))
                    result = {"content": [{"type": "text", "text": json.dumps(value, ensure_ascii=False)}], "isError": False}
                except Exception as error:
                    result = {"content": [{"type": "text", "text": str(error)}], "isError": True}
            else:
                print(json.dumps({"jsonrpc": "2.0", "id": request["id"], "error": {"code": -32601, "message": "Method not found"}}), flush=True)
                continue
            print(json.dumps({"jsonrpc": "2.0", "id": request["id"], "result": result}, ensure_ascii=False), flush=True)
        except Exception as error:
            print(json.dumps({"jsonrpc": "2.0", "id": request.get("id") if isinstance(request, dict) else None, "error": {"code": -32602, "message": str(error)}}), flush=True)


def main():
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    if hasattr(sys.stdin, "reconfigure"):
        sys.stdin.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser()
    parser.add_argument("mode", choices=["serve", "mcp", "rpc", "connection"])
    parser.add_argument("method", nargs="?")
    parser.add_argument("arguments", nargs="?", default="{}")
    args = parser.parse_args()
    if args.mode == "serve":
        serve()
    elif args.mode == "mcp":
        mcp()
    elif args.mode == "connection":
        print(json.dumps(connection()))
    else:
        try:
            print(json.dumps({"result": rpc(args.method, json.loads(args.arguments))}, ensure_ascii=False))
        except Exception as error:
            print(json.dumps({"error": str(error)}, ensure_ascii=False))
            sys.exit(1)


if __name__ == "__main__":
    main()
