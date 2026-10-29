"""Pinned, explicit LiteRT quality profiles; no model imports."""
PROFILES = ('compact', 'fidelity')
FIDELITY_PATHS = ('tflite/sa3-m/dit_fp32.tflite', 'tflite/same-l/dec_fp32.tflite')
FIDELITY_ENCODER = 'tflite/same-l/enc_fp32.tflite'


def profile_components(engine_id, quality_profile='compact'):
    if quality_profile not in PROFILES:
        raise ValueError('Unsupported Stable Audio quality profile')
    if quality_profile == 'fidelity':
        if engine_id != 'stable-audio-3-medium':
            raise ValueError('FP32/SAME-L requires Medium')
        return FIDELITY_PATHS, 'DiT fp32 / SAME-L fp32 / T5Gemma fp16'
    families = {'stable-audio-3-medium':'sa3-m', 'stable-audio-3-small-music':'sa3-sm-music'}
    return (f'tflite/{families[engine_id]}/dit_w8a8.tflite', 'tflite/same-s/dec_w8a8.tflite'), 'DiT w8a8 / SAME-S w8a8 / T5Gemma fp16'
