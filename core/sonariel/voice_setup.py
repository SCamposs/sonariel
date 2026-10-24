"""Independent, pinned CPU recipe. Never installs into a linked existing engine."""
import json
import hashlib
import os
import shutil
import zipfile
from pathlib import Path

from .environment import recipe, run, sha256
from .setup import Setup, download, extract, resource


class VoiceSetup:
    def __init__(self, store):
        self.store=store

    def plan(self,destination):
        base=Setup(self.store).plan(destination)
        spec=json.loads(resource('chatterbox-cpu.json').read_text())
        return dict(destination=base['destination'],supported=base['supported'],recipe=spec,
                    requires_authorization=True,components=['Managed uv','Python 3.11.15','CPU PyTorch 2.6.0',
                    'Pinned headless Chatterbox V3 + official PerTh','Verified local model copies or pinned downloads'],
                    disk_required_gib=14,source_license='MIT',model_license='MIT',
                    dependency_notice='Python wheels include LGPL components; engine remains a separate environment.')

    def install(self,destination,authorized,model_cache=''):
        if not authorized:
            raise ValueError('Instalação de voz exige autorização explícita')
        plan=self.plan(destination)
        if not plan['supported']:
            raise ValueError('Receita de voz validada para Windows x64 / 24 GB')
        root=Path(plan['destination']);marker=root/'sonariel-voice-install.json'
        if root.exists() and any(root.iterdir()) and not marker.exists():
            raise ValueError('Pasta não vazia sem instalação Sonariel de voz; arquivos preservados')
        state=json.loads(marker.read_text()) if marker.exists() else dict(recipe=plan['recipe']['id'],steps=[])
        if state['recipe']!=plan['recipe']['id']:
            raise ValueError('Receita existente diferente; não será atualizada automaticamente')
        probe=root
        while not probe.exists():probe=probe.parent
        if shutil.disk_usage(probe).free<14*2**30 and not marker.exists():
            raise ValueError('Espaço insuficiente para ambiente isolado de voz')
        root.mkdir(parents=True,exist_ok=True)
        marker.write_text(json.dumps(state),encoding='utf-8')
        cache=self.store.home/'cache/voice-setup';cache.mkdir(parents=True,exist_ok=True)
        def stage(name):
            self.store.set('setup_status',dict(state='running',engine='chatterbox-v3',stage=name,destination=str(root)))
            self.store.event('setup',name)
        def command(args,env):
            run([str(a) for a in args],env=env,timeout=3600)
        stage('Verificar instalador isolado de voz')
        uv_spec=recipe()['uv']
        archive=download(uv_spec['url'],cache/'uv.zip',uv_spec['sha256'],self.store.event)
        extract(archive,root/'tools')
        uv=next((root/'tools').rglob('uv.exe'))
        env=os.environ.copy();env.update(UV_PYTHON_INSTALL_DIR=str(root/'python'),UV_CACHE_DIR=str(cache/'uv'))
        stage('Preparar Python 3.11.15 isolado')
        command([uv,'python','install','--no-bin','--no-registry','3.11.15'],env)
        python=root/'.venv/Scripts/python.exe'
        if not python.exists():command([uv,'venv','--python','3.11.15',root/'.venv'],env)
        stage('Instalar somente dependências CPU fixadas')
        command([uv,'pip','install','--python',python,'torch==2.6.0+cpu','torchaudio==2.6.0+cpu','--index-url','https://download.pytorch.org/whl/cpu'],env)
        command([uv,'pip','install','--python',python,'--no-deps','-r',resource('voice-requirements.txt')],env)
        # Build metadata is fixed separately, so upstream can never pull a CUDA
        # runtime or a moving git dependency as part of installation.
        command([uv,'pip','install','--python',python,'setuptools==71.1.0','wheel==0.45.1'],env)
        for name,spec in plan['recipe']['sources'].items():
            stage('Verificar fonte fixada: '+name)
            source=root/'sources'/name
            archive=download(spec['url'],cache/(name+'-'+spec['commit']+'.zip'),spec['sha256'],self.store.event)
            if not source.exists():
                staging=root/('extract-'+name);extract(archive,staging)
                original=next(p for p in staging.iterdir() if p.is_dir())
                source.parent.mkdir(exist_ok=True)
                shutil.move(str(original),source)
            # Prevent accepting altered sources on a retry.
            with zipfile.ZipFile(archive) as zipped:
                for entry in zipped.infolist():
                    if entry.is_dir():continue
                    relative=Path(*Path(entry.filename).parts[1:])
                    target=source/relative
                    if not target.is_file() or sha256(target)!=hashlib.sha256(zipped.read(entry)).hexdigest():
                        raise ValueError('Fonte instalada mudou; não será sobrescrita: '+name)
            command([uv,'pip','install','--python',python,'--no-deps','--no-build-isolation',source],env)
        stage('Copiar ou baixar checkpoints V3 verificados')
        model_spec=json.loads(resource('voice-models.json').read_text())
        models=root/'models';models.mkdir(exist_ok=True)
        for item in model_spec['files']:
            target=models/item['file'];target.parent.mkdir(parents=True,exist_ok=True)
            if target.exists() and sha256(target)==item['sha256']:continue
            cached_source=Path(model_cache)/item['file'] if model_cache else None
            if cached_source and cached_source.is_file() and sha256(cached_source)==item['sha256']:
                shutil.copyfile(cached_source,target)
            else:
                url=f"https://huggingface.co/{model_spec['repo']}/resolve/{model_spec['revision']}/{item['file']}"
                downloaded=download(url,cache/'models'/item['file'],item['sha256'],self.store.event)
                shutil.copyfile(downloaded,target)
        state.update(complete=True,python=str(python),models=str(models))
        marker.write_text(json.dumps(state,indent=2),encoding='utf-8')
        return dict(python_path=str(python),models=str(models))
