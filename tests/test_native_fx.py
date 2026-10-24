"""Real native smoke tests on synthetic, redistributable fixtures, never production audio."""
import json
import subprocess

import numpy as np
import pytest
import soundfile as sf

from sonariel.environment import sha256
from sonariel.local_engine import fx_binary


@pytest.mark.skipif(not fx_binary().is_file(),reason='Build native/fx before native integration tests')
def test_native_gain_bypass_order_and_immutable_source(tmp_path):
    source=tmp_path/'source.wav'
    samples=.1*np.sin(np.arange(24000)*2*np.pi*220/24000)
    sf.write(source,samples,24000,subtype='FLOAT')
    original=sha256(source)
    base=dict(name='Synthetic validation',schema_version=1,output_channels=2,tail_seconds=0,bypass=False,
              chain=[dict(wet=1,effect=dict(type='gain',db=-6.020599913))])
    def render(name,recipe):
        config=tmp_path/(name+'-preset.json');out=tmp_path/(name+'.wav')
        config.write_text(json.dumps(recipe))
        result=subprocess.run([str(fx_binary()),str(source),str(out),str(config)],capture_output=True,text=True)
        assert result.returncode==0,result.stderr
        assert sha256(source)==original
        return out
    out=render('gain',base)
    actual,sr=sf.read(out,always_2d=True)
    assert sr==24000 and actual.shape==(24000,2)
    np.testing.assert_allclose(actual[:,0],samples*.5,atol=1e-8)
    bypass=render('bypass',dict(base,bypass=True))
    assert sha256(bypass)==original
    again=render('again',base)
    assert sha256(out)==sha256(again)
    refused=subprocess.run([str(fx_binary()),str(source),str(out),str(tmp_path/'gain-preset.json')],capture_output=True)
    assert refused.returncode!=0
