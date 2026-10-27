"""The Windows development builder must refuse a live onedir before invoking tools."""
import os
import subprocess
from pathlib import Path

import pytest


@pytest.mark.skipif(os.name != 'nt', reason='Windows build preflight')
def test_builder_refuses_owned_runtime_before_cargo_or_pyinstaller():
    root = Path(__file__).resolve().parents[1]
    script = (root/'scripts/build.ps1').as_posix().replace("'", "''")
    runtime = str(root/'build/runtime/sonariel-core/sonariel-core.exe').replace("'", "''")
    command = f"""
function Get-Process {{ [pscustomobject]@{{ Path = '{runtime}' }} }}
function cargo {{ throw 'Cargo must not run before ownership preflight' }}
try {{ & '{script}' -CoreOnly; exit 2 }}
catch {{ if ($_.Exception.Message -like 'Build runtime is in use.*') {{ exit 0 }}; throw }}
"""
    result = subprocess.run(['powershell.exe','-NoProfile','-Command',command],
                            capture_output=True,text=True,timeout=20)
    assert result.returncode == 0, result.stdout+result.stderr
