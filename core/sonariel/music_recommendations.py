"""Public starting recipes, not private musical directions or automatic defaults."""
from copy import deepcopy
import json
from pathlib import Path

RECOMMENDATION_ID = "medium-fp32-same-l-v1"
SOURCE_RECOMMENDATION_ID = "medium-fp32-same-l-audio-v1"
PARAMETERS = dict(quality_profile="fidelity", mode="text2audio", steps=8, batch_size=1)


def recommendation(recipe_id=RECOMMENDATION_ID):
    if recipe_id not in (RECOMMENDATION_ID, SOURCE_RECOMMENDATION_ID):
        raise ValueError("Unknown music recommendation")
    audio_input = recipe_id == SOURCE_RECOMMENDATION_ID
    manifest = json.loads(Path(__file__).with_name("recipes").joinpath("stable-models.json").read_text())
    paths = {"tflite/sa3-m/dit_fp32.tflite", "tflite/same-l/dec_fp32.tflite", "tflite/t5gemma/encoder_fp16.tflite"}
    if audio_input:
        paths.add('tflite/same-l/enc_fp32.tflite')
    return dict(id=recipe_id, revision=1, engine_id="stable-audio-3-medium",
        name="Medium FP32 + SAME-L FP32", parameters={**deepcopy(PARAMETERS), **(dict(mode='audio2audio', init_noise_level=.65) if audio_input else {})},
        required_parameters=["prompt", "seed", "duration"] + (["source_id"] if audio_input else []), supported_modes=["audio2audio" if audio_input else "text2audio"],
        min_duration=5, max_duration=120 if audio_input else 60, minimum_available_gib=12,
        optional_download_bytes=7596935760 + (1716519524 if audio_input else 0), model_revision=manifest["revision"], code_commit=manifest["code_commit"],
        checkpoints=[f for f in manifest["files"] if f["path"] in paths],
        runtime=dict(backend="LiteRT/XNNPACK CPU", threads=6, cfg=1, apg=1,
            precision="DiT fp32 / SAME-L fp32 / T5Gemma fp16", decoder_trim=12, decoder_max_rung=128,
            **(dict(encoder_precision='fp32', encoder='SAME-L', encoder_trim=12, encoder_max_rung=128) if audio_input else {}),
            output=dict(sample_rate=44100, channels=2, subtype="FLOAT")),
        evidence_scope="Maintainer local listening evaluation; not a universal quality guarantee or an isolated precision comparison.",
        issue_url="https://github.com/SCamposs/sonariel/issues/10")


def recommendations(store):
    environment = store.setting("stable_environment", {})
    ready = bool(environment.get("accepted_licenses") and "medium" in environment.get("families", [])
        and "fidelity" in environment.get("quality_profiles", []))
    values = [recommendation(), recommendation(SOURCE_RECOMMENDATION_ID)]
    for value in values:
        value['available'] = ready and (value['id'] == RECOMMENDATION_ID or bool(environment.get('fidelity_audio_input_ready')))
        value['available_modes'] = value['supported_modes'] if value['available'] else []
    return values
