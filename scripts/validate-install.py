"""Real isolated setup check; uses verified model cache, never the linked baseline env."""
import argparse
import json
from pathlib import Path

from sonariel.setup import Setup
from sonariel.store import Store
from sonariel.service import Service
import time

parser = argparse.ArgumentParser()
parser.add_argument("destination")
parser.add_argument("--model-cache", required=True)
parser.add_argument("--audacity", default="")
parser.add_argument("--state-home", type=Path, help="Separate application state for first-run validation")
parser.add_argument("--through-service", action="store_true", help="Exercise the real asynchronous setup and first-run linking contract")
args = parser.parse_args()
store = Store(args.state_home)
if args.through_service:
    if store.setting("environment"):
        raise ValueError("First-run validation requires an unlinked --state-home")
    service = Service(store, start_worker=False)
    service.invoke("setup_install", {"destination": args.destination, "authorized": True, "model_cache": args.model_cache, "audacity_path": args.audacity})
    while service.setup_thread.is_alive():
        time.sleep(1)
    status = store.setting("setup_status")
    if status["state"] != "completed":
        raise RuntimeError(status["stage"])
    result = store.setting("environment")
    assert result and result["compatible"], "First-run setup did not link a usable environment"
else:
    setup = Setup(store)
    result = setup.install(args.destination, authorized=True, model_cache=args.model_cache, audacity=args.audacity)
print(json.dumps({"compatible": result["compatible"], "checks": result["checks"], "root": result["root"]}, indent=2))
