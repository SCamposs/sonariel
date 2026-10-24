"""Real protocol smoke test. Generation only with explicit --generate flag."""
import argparse
import json
import subprocess
import sys
import time
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument("--generate", action="store_true")
parser.add_argument("--fx-wav", type=Path, help="Explicit native FX/export test on a local WAV; no synthesis")
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
    engines = tool("engines_list")
    assert {e["category"] for e in engines} == {"music", "voice", "fx"}
    assert all("sonariel_"+name in {t["name"] for t in tools} for name in ["voice_generate","music_generate","fx_render","fx_preset_save","result_export"])
    print(json.dumps({"handshake": handshake["serverInfo"], "tool_count": len(tools), "linked_compatible": bool((status["environment"] or {}).get("compatible")), "engine_categories": sorted({e["category"] for e in engines})}), flush=True)
    if args.fx_wav:
        project_id = tool("project_create", {"name":"Native FX protocol validation"})["project_id"]
        source = tool("result_import", {"project_id":project_id,"path":str(args.fx_wav.resolve(strict=True)),"name":"Independent WAV"})
        recipe = dict(name="Gain and fades",schema_version=1,output_channels=2,tail_seconds=0,bypass=False,
            chain=[dict(wet=1,effect=dict(type="gain",db=-3)),dict(wet=1,effect=dict(type="fade",in_ms=100,out_ms=300))])
        job = tool("fx_render",dict(asset_id=source["id"],request_key="mcp-fx-"+project_id,recipe=recipe))
        for _ in range(120):
            result = tool("job_get",dict(job_id=job["job_id"]))
            if result["state"]=="completed":
                output = result["results"][0]
                assert output["parent_id"]==source["id"] and output["metadata"]["peak"]<1
                home = Path(tool("snapshot")["data_home"])
                exported = tool("result_export",dict(asset_id=output["id"],destination=str(home/("mcp-export-"+job["job_id"]+".wav"))))
                assert exported["sha256"]==output["metadata"]["sha256"]
                print(json.dumps(dict(native_fx="completed",export=exported,metrics=result["metrics"])),flush=True)
                break
            if result["state"]=="interrupted":raise RuntimeError(result["error"])
            time.sleep(.25)
        else:raise TimeoutError("Native FX protocol test timed out")
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
