// Original small C ABI adapter to MIT-licensed Signalsmith Stretch.
// Planar buffers, deterministic seed, exact offline alignment. No TTS runtime.
#include "signalsmith-stretch.h"
#include <cstdint>
#include <cmath>
extern "C" int essence_stretch(const float *left, const float *right, int n,
    float *out_left, float *out_right, int out_n, int sr,
    float pitch_st, float formant_st, uint32_t seed) noexcept {
    if (!left || !right || !out_left || !out_right || n<=0 || out_n<=0 || sr<8000) return -1;
    try {
        signalsmith::stretch::SignalsmithStretch<float> stretch(static_cast<long>(seed));
        stretch.presetDefault(2, static_cast<float>(sr));
        stretch.setTransposeSemitones(pitch_st);
        stretch.setFormantSemitones(formant_st, true);
        stretch.setFormantBase(0); // Upstream estimator, not a made-up speaker F0.
        const float *inputs[2] = {left, right};
        float *outputs[2] = {out_left, out_right};
        return stretch.exact(inputs, n, outputs, out_n) ? 0 : -2;
    } catch (...) { return -3; } // Never unwind C++ across Rust ABI.
}
