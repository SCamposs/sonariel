# Storage lifecycle and optional Medium fidelity profile

Implementation prepared for v0.5.0 after final maintainer-authorized review. Installer branding from commit `3888012` is preserved. See [the release review](releases/v0.5.0-validation.md) for independently repeated checks and remaining limits.

## Audio files

Discard reviews the exact paths and hashes before moving managed audio to the application's `tmp/trash/`. Imported files move only when the user enables the explicit external-file option. Otherwise their records are only hidden, retaining backward compatibility.

Moved files remain restorable for 30 days. The lightweight core checks expiry on startup and hourly while the queue is idle. Closing all core processes suspends cleanup; it resumes next time. Files already in trash receive at least 30 days from first activation of this lifecycle. The Windows temporary-directory cleaner is not used.

Permanent deletion has its own preview and confirmation. It removes the reviewed file bytes immediately. For older hidden imports, an explicit external-file option is required to unlink the original. Hidden imports are never automatically deleted. Purged entries retain metadata for job/lineage auditing and cannot be restored.

References, favorites, selections, dependent sources, shared paths and changed hashes remain protected. Symlinks, junctions, occupied restore paths and active queues fail closed. Interrupted cross-volume copies preserve their journal and can be restored. No operation recursively deletes directories.

## Optional model components

The existing `compact` profile remains the default. Optional `fidelity` is available for Medium text-to-audio only, with these additional pinned weights:

| Component | File | Bytes |
| --- | --- | ---: |
| Medium DiT FP32 | `tflite/sa3-m/dit_fp32.tflite` | 5,833,007,200 |
| SAME-L decoder FP32 | `tflite/same-l/dec_fp32.tflite` | 1,763,928,560 |

They are downloaded independently of the desktop installer and verified against SHA-256 hashes in the model manifest. Existing correct files are reused. Adding this profile to a complete environment verifies its installed runtime without reinstalling packages. Linking detects the optional files by size and hash; missing files do not disable compact mode. Existing model licensing conditions remain applicable.

Select the profile during setup. The MCP generation parameter is `quality_profile="fidelity"`, with engine `stable-audio-3-medium` and mode `text2audio`. The worker uses the Medium FP32 DiT, SAME-L FP32 decoder with trim 12 and maximum rung 128, and the unchanged T5Gemma FP16 text encoder. Source-audio input for this profile is deliberately rejected because a SAME-L encoder workflow has not been validated.

Generation metadata and captured music presets retain the profile, precision and checkpoint hashes. The FIFO queue, request-key idempotency and batch size 1 remain unchanged. Admission requires 12 GiB available RAM; the owned-child watchdog retains the 2.5 GiB available-memory floor and uses a 14.5 GiB process-RSS ceiling. These are safety limits, not guaranteed peak usage.

The earlier isolated 30-second musical audition exercised these components on CPU. That result establishes file validity and observed resource usage, not artistic approval or an end-to-end acceptance of a newly packaged release. No new musical generation is performed as part of automated UI tests.

## Validation of this local implementation

- 143 Python tests passed, including 30-day expiry, upgrade grace, imported-file moves, cross-volume handling, protected assets, restore, permanent deletion and purged-child lineage.
- 74 frontend tests passed; the 12 storage/studio tests passed again after the final interface text changes. TypeScript and production frontend compilation passed.
- Chrome headless exercised the real core in an isolated profile: protected favorite/reference controls, physical imported-file discard, restore, cancel and confirm permanent deletion, expiry display and Medium fidelity selection. Filesystem checks confirmed the actual moves/deletion; these were synthetic fixtures.
- The packaged MCP core passed initialization/tool discovery and synthetic native-DSP/storage smoke checks. Its new RPC endpoints physically moved and permanently deleted an imported fixture after its child had been purged. No music model was loaded.
- Existing local FP32/SAME-L files were detected by the real environment linker with pinned sizes and hashes. No additional musical generation was requested for this software verification.

The original implementation compiled a local installer without installing or publishing it. Final release packaging/publication is recorded separately in the release review. A fresh-machine optional-model download, full installer/updater lifecycle and a new musical generation through the newly packaged profile remain outside these checks.
