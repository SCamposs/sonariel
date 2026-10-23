"""Real protocol smoke test. Generation only with explicit --generate flag."""
import argparse
import json
import subprocess
import sys
import time
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument("--generate", action="store_true")
parser.add_argument("--executable", type=Path, help="Test the distributed sonariel-core.exe instead of development Python")
args = parser.parse_args()
command = [str(args.executable.resolve(strict=True)), "mcp"] if args.executable else [sys.executable, "-m", "sonariel", "mcp"]
process = subprocess.Popen(command, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, encoding="utf-8")
counter = 0


def call(method, params=None):
    global counter
    counter += 1
    process.stdin.write(json.dumps({"jsonrpc": "2.0", "id": counter, "method": method, "params": params or {}}) + "\n")
    process.stdin.flush()
    result = json.loads(process.stdout.readline())
    assert "error" not in result, result
    return result["result"]


def tool(name, arguments=None):
    result = call("tools/call", {"name": "sonariel_" + name, "arguments": arguments or {}})
    assert not result.get("isError"), result
    return json.loads(result["content"][0]["text"])


try:
    handshake = call("initialize", {"protocolVersion": "2025-06-18", "capabilities": {}, "clientInfo": {"name": "sonariel-validation", "version": "1"}})
    tools = call("tools/list")["tools"]
    assert len(tools) >= 20
    status = tool("environment_status")
    print(json.dumps({"handshake": handshake["serverInfo"], "tool_count": len(tools), "linked_compatible": status["environment"]["compatible"]}), flush=True)
    if args.generate:
        projects = tool("projects_list")
        project = next((p for p in projects if p["name"] == "Verificação técnica"), None)
        project_id = project["id"] if project else tool("project_create", {"name": "Verificação técnica", "context": "Teste funcional do aplicativo. Não faz parte de uma soundtrack."})["project_id"]
        job = tool("generate", {"project_id": project_id, "request_key": "sonariel-acceptance-10s-1", "prompt": "Short original instrumental sound study. Gentle analog sine-like synthesizer, sustained quiet harmony, no vocals, no drums.", "seed": 4137, "duration": 10, "bpm": 70, "key_scale": "D minor", "time_signature": "4", "batch_size": 1})
        print(json.dumps(job), flush=True)
        for _ in range(600):
            result = tool("job_get", {"job_id": job["job_id"]})
            print(json.dumps({"state": result["state"], "stage": result["stage"], "metrics": result["metrics"]}), flush=True)
            if result["state"] == "completed":
                assert result["results"][0]["metadata"]["duration"] == 10
                print(json.dumps({"result": result["results"][0]["path"], "metrics": result["metrics"]}), flush=True)
                break
            if result["state"] == "interrupted":
                raise RuntimeError(result["error"])
            time.sleep(2)
        else:
            raise TimeoutError("Generation did not complete")
finally:
    process.stdin.close()
    process.wait(timeout=10)
