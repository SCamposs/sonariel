"""Public starting recipes, not private musical directions or automatic defaults."""
from copy import deepcopy
import json
from pathlib import Path

RECOMMENDATION_ID = "medium-fp32-same-l-v1"
PARAMETERS = dict(quality_profile="fidelity", mode="text2audio", steps=8, batch_size=1)


def recommendation():
    manifest = json.loads(Path(__file__).with_name("recipes").joinpath("stable-models.json").read_text())
    paths = {"tflite/sa3-m/dit_fp32.tflite", "tflite/same-l/dec_fp32.tflite", "tflite/t5gemma/encoder_fp16.tflite"}
    return dict(id=RECOMMENDATION_ID, revision=1, engine_id="stable-audio-3-medium",
        name="Medium FP32 + SAME-L FP32", parameters=deepcopy(PARAMETERS),
        required_parameters=["prompt", "seed", "duration"], supported_modes=["text2audio"],
        min_duration=5, max_duration=60, minimum_available_gib=12,
        optional_download_bytes=7596935760, model_revision=manifest["revision"], code_commit=manifest["code_commit"],
        checkpoints=[f for f in manifest["files"] if f["path"] in paths],
        runtime=dict(backend="LiteRT/XNNPACK CPU", threads=6, cfg=1, apg=1,
            precision="DiT fp32 / SAME-L fp32 / T5Gemma fp16", decoder_trim=12, decoder_max_rung=128,
            output=dict(sample_rate=44100, channels=2, subtype="FLOAT")),
        evidence_scope="Maintainer local listening evaluation; not a universal quality guarantee or an isolated precision comparison.",
        issue_url="https://github.com/SCamposs/sonariel/issues/10")


def recommendations(store):
    value = recommendation()
    environment = store.setting("stable_environment", {})
    value["available"] = bool(environment.get("accepted_licenses") and "medium" in environment.get("families", [])
        and "fidelity" in environment.get("quality_profiles", []))
    # Do not inherit compact's audio2audio capability: SAME-L input is not integrated.
    value["available_modes"] = ["text2audio"] if value["available"] else []
    return [value]
