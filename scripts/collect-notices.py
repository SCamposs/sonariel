"""Collect installed dependency license texts for the distributed core."""
import importlib.metadata
import shutil
import json
import sys
import tomllib
import argparse
from pathlib import Path

root = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--output', type=Path, default=root / 'build/runtime/sonariel-core/licenses',
                    help='License folder for a separately packaged validation runtime')
output = parser.parse_args().output
output.mkdir(parents=True, exist_ok=True)
for distribution in importlib.metadata.distributions():
    name = distribution.metadata.get("Name", "unknown")
    if name.lower() in {"sonariel-core", "pytest", "pyinstaller-hooks-contrib", "setuptools", "pip", "pluggy", "iniconfig", "pygments"}:
        continue
    for file in distribution.files or []:
        if any(word in file.name.lower() for word in ("license", "copying", "notice")) and ".dist-info" in str(file):
            source = Path(distribution.locate_file(file))
            if source.is_file():
                destination = output / name / file.name
                destination.parent.mkdir(parents=True, exist_ok=True)
                shutil.copyfile(source, destination)
shutil.copyfile(root / "THIRD_PARTY_NOTICES.md", output / "THIRD_PARTY_NOTICES.md")
shutil.copyfile(root / "LICENSE", output / "SONARIEL-LICENSE.txt")
for font in ("barlow", "urbanist", "jetbrains-mono"):
    for file in (root / "node_modules/@fontsource" / font).glob("*LICENSE*"):
        shutil.copyfile(file, output / (font + "-" + file.name))

def copy_notices(source, destination):
    if not source.is_dir():
        return
    for file in source.iterdir():
        if file.is_file() and any(file.name.lower().startswith(word) for word in ("license", "licence", "copying", "notice", "copyright")):
            destination.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(file, destination / file.name)

copy_notices(Path(sys.base_prefix), output / "Python")
copy_notices(root / ".venv/Lib/site-packages/_soundfile_data", output / "libsndfile")
lock = json.loads((root / "package-lock.json").read_text(encoding="utf-8"))
for relative in lock["packages"]:
    if relative:
        copy_notices(root / relative, output / "npm" / relative.removeprefix("node_modules/"))
cargo = tomllib.loads((root / "src-tauri/Cargo.lock").read_text(encoding="utf-8"))
registry = Path.home() / ".cargo/registry/src"
for package in cargo["package"]:
    if package.get("source", "").startswith("registry+"):
        name = package["name"] + "-" + package["version"]
        for source in registry.glob("*/" + name):
            copy_notices(source, output / "cargo" / name)
native_lock = tomllib.loads((root / "native/fx/Cargo.lock").read_text(encoding="utf-8"))
for package in native_lock["package"]:
    if package.get("source", "").startswith("registry+"):
        name = package["name"] + "-" + package["version"]
        for source in registry.glob("*/" + name):
            copy_notices(source, output / "native-fx" / name)
for component in ("signalsmith-stretch", "signalsmith-linear"):
    copy_notices(root / "native/fx/vendor" / component, output / "native-fx" / component)
print("License texts collected")
