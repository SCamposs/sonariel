# Musical loop acceptance

A finite WAV, adjacent boundary samples and a reproducible render establish technical integrity. They do not establish musical continuity. Two private listening rounds in Phase 2.5 were rejected by the user for audible rhythmic discontinuity. Issue #3 remains open.

## Evidence behind the revised workflow

The [Audacity crossfade guide](https://manual.audacityteam.org/man/creating_a_crossfade.html) recommends aligning beats for rhythmic material before applying the overlap. Different tempi cannot keep all beats aligned through one simple crossfade. Its [crossfade reference](https://manual.audacityteam.org/man/crossfade_tracks.html) also distinguishes constant gain, which avoids added clipping but can dip in level, from constant power, which can raise peaks. Changing the fade curve does not by itself correct phrasing or tempo.

The [Ableton Live 12 manual](https://www.ableton.com/en/live-manual/12/audio-clips-tempo-and-warping/) describes beat/transient anchors, complete-bar loop boundaries and timing corrections. These are references for the editing principles, not dependencies or a claim that Sonariel implements transient warping. A generated file's requested BPM is not a verified measurement of the resulting performance.

The [FMOD authoring guide](https://www.fmod.com/docs/2.04/studio/authoring-events.html#logic-tracks) treats musical transitions in terms of tempo markers, bars and equivalent relative positions. The [composer's pre-entry/post-exit guide](https://edu.maximegoulet.com/en/pre-entry-and-post-exit/) explains why pickup notes and resonance/reverb tails need deliberate treatment to avoid doubled instruments or conflicting harmony. No middleware or Unity integration is added here.

## Acceptance sequence

1. Keep an unchanged source and a private manifest. Select a genuinely repeatable musical phrase; a pair of similar spectra is only a suggestion, not evidence of matching beats, chords or cadence.
2. Verify the downbeat, meter and timing by listening across the whole phrase. If the performance drifts, a fixed BPM grid cannot repair it. Do not silently time-stretch or invent tempo certainty.
3. Choose an integral musical phrase and check that the end leads into the starting chord/melody. A mathematically exact bar count is insufficient when the composition changes direction.
4. Preserve the intended cycle period. The legacy circular-overlap algorithm emits `region_frames − overlap_frames`. Selecting exactly N bars and then removing overlap shortens the musical cycle. For a verified audible anchor A, target cycle P and overlap L, select **A−L through A+P**. The existing render then starts at A and contains P frames, with head/tail overlap before the boundary. The optional bar-selection aid performs this compensation on the sample grid; it does not detect or repair musical timing.
5. Use the shortest suitable overlap for attacks and a deliberate longer transition only where the musical material supports it. Preserve pickups and tails without introducing doubled attacks, canceled notes or harmonic conflict. Do not apply a universal crossfade duration.
6. Render one cycle plus a separate three-cycle preview. Listen across every boundary using the player's join navigation, then listen through the complete cycles. Keep any navigation markers out of the WAV.
7. Verify source/output hashes, sample count, cycle duration, finite samples, headroom, lineage, export and deterministic reproduction. Record boundary measurements without presenting them as perceptual acceptance.
8. Obtain explicit user approval. Rejection keeps #3 open; preserve the rejected samples and parameters. Continue independent product work.

If no suitable phrase exists in a recording, document that limitation. Producing a musical transition or a new loop-ready arrangement is a separate production decision; do not conceal it behind an automatic “seamless” label.
