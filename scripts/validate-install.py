"""Real isolated setup check; uses verified model cache, never the linked baseline env."""
import argparse
import json
from pathlib import Path

from sonariel.setup import Setup
from sonariel.store import Store

parser = argparse.ArgumentParser()
parser.add_argument("destination")
parser.add_argument("--model-cache", required=True)
parser.add_argument("--audacity", default="")
args = parser.parse_args()
setup = Setup(Store())
result = setup.install(args.destination, authorized=True, model_cache=args.model_cache, audacity=args.audacity)
print(json.dumps({"compatible": result["compatible"], "checks": result["checks"], "root": result["root"]}, indent=2))
