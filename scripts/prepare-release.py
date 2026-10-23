"""Prepare immutable public release assets outside Git; never handles private keys."""
import base64
import hashlib
import json
import re
import shutil
import tomllib
from datetime import datetime, timezone
from pathlib import Path

root = Path(__file__).resolve().parents[1]
package = json.loads((root / "package.json").read_text())
version = package["version"]
assert re.fullmatch(r"\d+\.\d+\.\d+", version), "Use a stable semantic version"
assert json.loads((root / "src-tauri/tauri.conf.json").read_text())["version"] == version
assert tomllib.loads((root / "src-tauri/Cargo.toml").read_text())["package"]["version"] == version
assert tomllib.loads((root / "pyproject.toml").read_text())["project"]["version"] == version
assert f'__version__ = "{version}"' in (root / "core/sonariel/__init__.py").read_text()
name = f"Sonariel_{version}_x64-setup.exe"
installer = root / "src-tauri/target/release/bundle/nsis" / name
signature_file = installer.with_suffix(".exe.sig")
signature = signature_file.read_text().strip()
decoded_signature = base64.b64decode(signature).decode()
assert f"\tversion:{version}" in decoded_signature, "Signature must bind the announced version"
release = Path.home() / ".sonariel/releases" / version
release.mkdir(parents=True, exist_ok=True)
digest = hashlib.sha256(installer.read_bytes()).hexdigest()
target = release / name
if target.exists() and hashlib.sha256(target.read_bytes()).hexdigest() != digest:
    raise RuntimeError("Release assets already exist with different bytes; never overwrite a release")
shutil.copyfile(installer, target)
shutil.copyfile(signature_file, release / signature_file.name)
notes = (root / "docs/releases" / f"v{version}.md").read_text(encoding="utf-8")
manifest = {
    "version": version,
    "notes": notes,
    "pub_date": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
    "platforms": {"windows-x86_64": {"signature": signature, "url": f"https://github.com/SCamposs/sonariel/releases/download/v{version}/{name}"}},
}
(release / "latest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
(release / "SHA256SUMS.txt").write_text(f"{digest}  {name}\n", encoding="utf-8")
shutil.copyfile(root / "LICENSE", release / "LICENSE.txt")
print(json.dumps({"version": version, "directory": str(release), "installer_sha256": digest, "signature_binds_version": True}, indent=2))
