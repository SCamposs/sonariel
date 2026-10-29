"""Real protocol smoke test. Generation only with explicit --generate flag."""
import argparse
import json
import hashlib
import os
import subprocess
import sys
import time
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument("--generate", action="store_true")
parser.add_argument("--music-recommendations", action="store_true", help="Save/review the public recipe in an isolated profile, without inference")
parser.add_argument("--storage", action="store_true", help="Synthetic native DSP, recoverable trash and permanent deletion, isolated profile only; no AI")
parser.add_argument("--fx-wav", type=Path, help="Explicit native FX/export test on a local WAV; no synthesis")
parser.add_argument("--executable", type=Path, help="Test the distributed sonariel-core.exe instead of development Python")
parser.add_argument("--stable-input-root", type=Path, help="Existing licensed LiteRT environment for one explicitly authorized synthetic 5s audio-input test")
parser.add_argument("--authorize-stable-input-generation", action="store_true")
args = parser.parse_args()
if args.storage or args.music_recommendations:
    if not os.environ.get('SONARIEL_HOME') or Path(os.environ['SONARIEL_HOME']).resolve() == (Path.home()/'.sonariel').resolve():
        parser.error('Storage validation requires an explicit isolated SONARIEL_HOME')
if args.stable_input_root:
    if not args.authorize_stable_input_generation or not os.environ.get("SONARIEL_HOME"):
        parser.error("Stable input generation requires explicit authorization and isolated SONARIEL_HOME")
    if Path(os.environ["SONARIEL_HOME"]).resolve() == (Path.home()/".sonariel").resolve():
        parser.error("Never run the Stable input validation in the production profile")
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
    if args.music_recommendations:
        before = tool("snapshot")
        assert not before["jobs"] and not before["environment"] and not before.get("stable_environment")
        recommendation, = tool("music_recommendations_list")
        assert recommendation["id"] == "medium-fp32-same-l-v1" and not recommendation["available"]
        assert recommendation["supported_modes"] == ["text2audio"]
        project = tool("project_create", dict(name="Public recipe protocol verification"))["project_id"]
        preset = tool("music_recommendation_save", dict(project_id=project, recommendation_id=recommendation["id"],
            name="Synthetic contract settings", prompt="An original abstract synth texture.", seed=17, duration=30))
        review = tool("music_preset_prepare", dict(project_id=project, preset_id=preset["id"]))
        assert review["parameters"]["quality_profile"] == "fidelity" and review["parameters"]["steps"] == 8
        assert review["origin_recommendation"]["checkpoints"] == recommendation["checkpoints"]
        assert tool("music_presets_list", dict(project_id=project))[0]["origin_recommendation"]["id"] == recommendation["id"]
        assert not tool("queue_list")
        print(json.dumps(dict(public_recipe_save_review="passed", jobs=0, inference=False, installed_models=False)), flush=True)
    if args.storage:
        import wave
        import math
        import struct
        home=Path(tool('snapshot')['data_home'])
        source=home/'storage-synthetic.wav'
        assert not source.exists(), 'Use a fresh validation profile'
        with wave.open(str(source),'wb') as stream:
            stream.setparams((1,2,48000,48000,'NONE','not compressed'))
            stream.writeframes(b''.join(struct.pack('<h',int(2000*math.sin(2*math.pi*220*n/48000))) for n in range(48000)))
        original_hash=hashlib.sha256(source.read_bytes()).hexdigest()
        project=tool('project_create',dict(name='Storage protocol verification'))['project_id']
        original=tool('result_import',dict(project_id=project,path=str(source),name='Synthetic external source'))
        recipe=dict(name='Storage fixture',schema_version=1,output_channels=2,tail_seconds=0,bypass=False,
            chain=[dict(wet=1,effect=dict(type='gain',db=-3))])
        job=tool('fx_render',dict(asset_id=original['id'],request_key='storage-fixture-'+project,recipe=recipe))
        for _ in range(120):
            result=tool('job_get',dict(job_id=job['job_id']))
            if result['state']=='completed': break
            if result['state']=='interrupted': raise RuntimeError(result['error'])
            time.sleep(.25)
        else: raise TimeoutError('Native synthetic DSP timed out')
        output=result['results'][0]
        original_plan=tool('storage_preview',dict(asset_ids=[original['id']]))
        assert original_plan['entries'][0]['blocked'], 'Parent dependency must be protected'
        plan=tool('storage_preview',dict(asset_ids=[output['id']]))
        assert plan['entries'][0]['action']=='move_to_trash' and plan['reclaimed_bytes']==0
        tool('storage_discard',dict(asset_ids=[output['id']],preview_token=plan['token'],confirmed=True))
        assert not Path(output['path']).exists()
        assert not any(a['id']==output['id'] for a in tool('results_list',dict(project_id=project)))
        tool('storage_restore',dict(asset_id=output['id']))
        assert hashlib.sha256(Path(output['path']).read_bytes()).hexdigest()==output['metadata']['sha256']
        assert hashlib.sha256(source.read_bytes()).hexdigest()==original_hash
        # Verify the destructive additions against synthetic files only, retaining
        # the original fixture and checking actual bytes rather than RPC success.
        plan=tool('storage_preview',dict(asset_ids=[output['id']]))
        tool('storage_discard',dict(asset_ids=[output['id']],preview_token=plan['token'],confirmed=True))
        purge_plan=tool('storage_purge_preview',dict(asset_ids=[output['id']]))
        trash_path=Path(purge_plan['entries'][0]['path'])
        assert trash_path.is_file() and purge_plan['reclaimed_bytes']>0
        purged=tool('storage_purge',dict(asset_ids=[output['id']],preview_token=purge_plan['token'],confirmed=True))
        assert output['id'] in purged['deleted'] and not trash_path.exists()
        assert not any(a['id']==output['id'] for a in tool('storage_list')['items'])
        # Purged child lineage must not permanently block its preserved source.
        plan=tool('storage_preview',dict(asset_ids=[original['id']]))
        assert not plan['entries'][0]['blocked'] and plan['entries'][0]['action']=='hide_record'
        plan=tool('storage_preview',dict(asset_ids=[original['id']],include_external_files=True))
        tool('storage_discard',dict(asset_ids=[original['id']],preview_token=plan['token'],confirmed=True,include_external_files=True))
        assert not source.exists()
        tool('storage_restore',dict(asset_id=original['id']))
        assert hashlib.sha256(source.read_bytes()).hexdigest()==original_hash
        receipt=dict(storage='passed',permanent_delete='passed',imported_move_restore='passed',
                     purged_child_lineage='passed',output=output['path'],external_unchanged=True,tool_count=len(tools),model_loaded=False)
        (home/'storage-acceptance.json').write_text(json.dumps(receipt,indent=2),encoding='utf-8')
        print(json.dumps(receipt),flush=True)
    if args.stable_input_root:
        import numpy as np
        import soundfile as sf
        schema=next(t for t in tools if t['name']=='sonariel_music_generate')['inputSchema']['properties']
        assert 'audio2audio' in schema['mode']['enum'] and 'source_id' in schema
        root=args.stable_input_root.resolve(strict=True)
        accepted=json.loads((root/'sonariel-stable-install.json').read_text())['accepted_licenses']
        linked=tool('stable_environment_link',dict(python_path=str(root/'.venv/Scripts/python.exe'),source=str(root/'source'),models=str(root/'models'),families=['medium'],accepted_licenses=accepted))
        assert linked['audio_input_ready']
        home=Path(tool('snapshot')['data_home'])
        wav=home/'synthetic-input-5s.wav'
        assert not wav.exists(),'Use a fresh test profile'
        sf.write(wav,.03*np.sin(np.arange(5*48000)*2*np.pi*220/48000),48000,subtype='FLOAT')
        original_hash=hashlib.sha256(wav.read_bytes()).hexdigest()
        project=tool('project_create',dict(name='Audio input protocol validation'))['project_id']
        source=tool('reference_register',dict(project_id=project,path=str(wav),name='Synthetic source'))
        params=dict(engine_id='stable-audio-3-medium',project_id=project,request_key='stable-input-5s',prompt='Quiet original sustained synthesizer tone, instrumental, no percussion.',seed=7024,duration=5,steps=8,batch_size=1,mode='audio2audio',source_id=source['id'],init_noise_level=.25)
        job=tool('music_generate',params)
        assert tool('music_generate',params)['job_id']==job['job_id']
        last=None
        for _ in range(1200):
            result=tool('job_get',dict(job_id=job['job_id']))
            if result['stage']!=last:
                print(json.dumps(dict(state=result['state'],stage=result['stage'],metrics=result['metrics'])),flush=True);last=result['stage']
            if result['state']=='completed':
                output=result['results'][0]
                assert output['parent_id']==source['id'] and output['metadata']['parameters']['source_sha256']==original_hash
                audio,rate=sf.read(output['path'],always_2d=True)
                assert rate==44100 and audio.shape==(5*44100,2) and np.isfinite(audio).all() and np.max(np.abs(audio))>1e-5
                assert hashlib.sha256(wav.read_bytes()).hexdigest()==original_hash
                (home/'acceptance.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
                print(json.dumps(dict(stable_audio_input='passed',output=output['path'],metrics=result['metrics'],source_unchanged=True)),flush=True)
                break
            if result['state']=='interrupted':raise RuntimeError(result['error'])
            time.sleep(.25)
        else:raise TimeoutError('Source-audio validation timed out; inspect queue before retrying')
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
