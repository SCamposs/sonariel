"""Read-only, pattern-based publication hygiene check; never prints secret contents.

This is not a complete vulnerability audit or proof that every possible secret
was detected. Dependency licensing must be reviewed separately.
"""
import json
import re
import subprocess
import sys
from pathlib import Path

root = Path(__file__).resolve().parents[1]


def git(*args):
    return subprocess.check_output(["git", *args], cwd=root)


patterns = {
    "private_key": re.compile(rb"-----BEGIN (?:RSA |EC |OPENSSH |DSA |ENCRYPTED )?PRIVATE KEY-----"),
    "github_token": re.compile(rb"(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,})"),
    "provider_token": re.compile(rb"(?:sk-(?:proj-|ant-)?[A-Za-z0-9_-]{32,}|hf_[A-Za-z0-9]{30,}|AKIA[A-Z0-9]{16}|xox[baprs]-[A-Za-z0-9-]{20,})"),
    "personal_windows_path": re.compile(rb"[A-Za-z]:[\\/]+Users[\\/]+(?!Public[\\/]|Default[\\/]|<)[A-Za-z0-9_.-]+[\\/]"),
    "credential_url": re.compile(rb"https?://[^\s/@:]+:[^\s/@]+@"),
}
findings = []
seen = set()
for entry in git("rev-list", "--objects", "--all").decode().splitlines():
    oid, _, name = entry.partition(" ")
    if not name or oid in seen or git("cat-file", "-t", oid).strip() != b"blob":
        continue
    seen.add(oid)
    contents = git("cat-file", "blob", oid)
    for kind, pattern in patterns.items():
        if pattern.search(contents):
            findings.append({"scope": "history", "path": name, "blob": oid, "category": kind})
    if Path(name).suffix.lower() in {".wav", ".mp3", ".flac", ".aup3", ".sqlite3", ".safetensors", ".dpapi", ".key"}:
        findings.append({"scope": "history", "path": name, "category": "private_or_large_asset"})

names = (git("ls-files", "-z") + git("ls-files", "--others", "--exclude-standard", "-z")).decode().split("\0")
for name in filter(None, names):
    file = root / name
    if file.is_file():
        for kind, pattern in patterns.items():
            if pattern.search(file.read_bytes()):
                findings.append({"scope": "working_tree", "path": name, "category": kind})

authors = set(git("log", "--all", "--format=%ae%n%ce").decode().splitlines())
print(json.dumps({"reachable_blobs_checked": len(seen), "working_files_checked": len(list(filter(None, names))), "commit_email_count": len(authors), "all_commit_emails_are_github_noreply": all(email.endswith("@users.noreply.github.com") for email in authors), "findings": findings, "limitations": "Pattern-based privacy/secret check, not a complete security audit."}, indent=2))
sys.exit(1 if findings else 0)
