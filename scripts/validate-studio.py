"""Opt-in real queue validation. Fixtures and reports stay outside the repository.

--fixtures is JSON [{source,preset,expected}] supplied by the operator, never
bundled creative production data. No synthesis unless --voice-text is provided.
"""
import argparse
import json
import sys
import time
from pathlib import Path

sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'core'))
from sonariel.environment import sha256
from sonariel.service import Service
from sonariel.store import Store


def wait(service, job_id, timeout=600):
    deadline=time.monotonic()+timeout
    while time.monotonic()<deadline:
        result=service.invoke('job_get',dict(job_id=job_id))
        if result['state']=='completed':return result
        if result['state'] in {'interrupted','error','cancelled'}:raise RuntimeError(result)
        time.sleep(.25)
    raise TimeoutError(service.store.job(job_id))


def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('--home',type=Path,required=True)
    ap.add_argument('--fixtures',type=Path)
    ap.add_argument('--voice-python')
    ap.add_argument('--voice-models')
    ap.add_argument('--voice-text')
    ap.add_argument('--install-voice',type=Path)
    ap.add_argument('--language')
    args=ap.parse_args()
    repo=Path(__file__).resolve().parents[1]
    if args.home.resolve().is_relative_to(repo) or args.home.exists():
        ap.error('Choose a NEW data directory outside the repository')
    service=Service(Store(args.home))
    report=[]
    try:
        project=service.invoke('project_create',dict(name='Private integration validation'))['project_id']
        if args.install_voice:
            service.invoke('voice_setup_install',dict(destination=str(args.install_voice),authorized=True,model_cache=args.voice_models or ''))
            deadline=time.monotonic()+3600
            while time.monotonic()<deadline:
                status=service.store.setting('setup_status')
                if status['state']=='completed':break
                if status['state']=='error':raise RuntimeError(status)
                time.sleep(1)
            else:raise TimeoutError('Voice installation timeout')
            installed=service.store.setting('voice_environment')
            args.voice_python=installed['python'];args.voice_models=installed['models']
            report.append(dict(kind='voice-install',status=status,environment=installed))
        for i,fixture in enumerate(json.loads(args.fixtures.read_text(encoding='utf-8')) if args.fixtures else []):
            source=Path(fixture['source']);expected=Path(fixture['expected'])
            before=sha256(source)
            asset=service.invoke('result_import',dict(project_id=project,path=str(source),name=f'Source {i+1}'))
            recipe=json.loads(Path(fixture['preset']).read_text(encoding='utf-8'))
            job=service.invoke('fx_render',dict(asset_id=asset['id'],request_key=f'golden-{i}',recipe=recipe))
            result=wait(service,job['job_id'])
            output=result['results'][0]
            assert output['parent_id']==asset['id']
            assert sha256(Path(output['path']))==sha256(expected),'Golden WAV differs byte-for-byte'
            assert sha256(source)==before
            report.append(dict(kind='fx-golden',expected_sha256=sha256(expected),job=result))
        if args.voice_text:
            if not all([args.voice_python,args.voice_models,args.language]):ap.error('Voice requires explicit environment and language')
            service.invoke('voice_environment_link',dict(python_path=args.voice_python,models=args.voice_models))
            job=service.invoke('voice_generate',dict(project_id=project,request_key='voice-real-1',text=args.voice_text,language=args.language,seed=2026102301))
            report.append(dict(kind='voice-real',job=wait(service,job['job_id'])))
        with (args.home/'validation.json').open('x',encoding='utf-8') as f:json.dump(report,f,ensure_ascii=False,indent=2)
        print(json.dumps(dict(data_home=str(args.home),tests=len(report),completed=True)))
    finally:
        service.stopping.set()
        if hasattr(service,'worker'):service.worker.join(timeout=5)


if __name__=='__main__':main()
