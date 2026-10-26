# Recovery and limits

These constraints describe v0.3.2. ACE-Step-specific limits below do not apply to every engine; see the [engine guide](ENGINES.md) for voice, Stable Audio and native DSP thresholds.

- **Not enough RAM:** the task remains queued with measured available memory and the start threshold. Do not close unrelated applications automatically or lower the limit silently.
- **CPU headroom:** cold startup now requires 12 GiB available, reduced from 16 at the owner's explicit request. This is a start threshold, not a measured safe minimum: the previous short acceptance run reached approximately 14 GiB engine working set and briefly exhausted free physical memory at the older 10 GiB gate. No new lower-memory model profile was introduced or benchmarked. Longer/source-conditioned tasks can use more RAM, and paging, slowdown or allocation failures remain possible. A subsequent job with the model already resident still requires 4 GiB available. The model loads only on demand; telemetry and single-job ownership remain enabled.
- **Core restart:** queued tasks persist. Confirmed remote IDs are queried again. A send without a confirmed response becomes interrupted, requiring inspection rather than a blind retry with a new request key.
- **Remote query uncertainty:** an interrupted job with a remote ID blocks additional generation and engine unloading, because inference might still be active. Inspect the engine log and recover deliberately.
- **External ACE-Step on port 8001:** the adapter refuses ownership. Stop it using the original environment command when safe, then retry through Sonariel.
- **Broken setup/download:** repeat the installation with the same destination. Receipt markers and hashes permit reuse. Unowned nonempty folders are never repurposed automatically.
- **Audacity busy/absent pipe:** preserve open projects; release the other pipe client or enable the module and restart Audacity only after saving in a safe condition. Sonariel does not force-close it.
- **Changed Audacity focus:** editing/export requires an identified Sonariel track. A mismatched project is rejected.
- **ACE-Step models:** Turbo CPU/DiT-only is the validated ACE profile; SFT remains pending. No AMD/NVIDIA driver changes, GPU acceleration, model training or LM planning is implemented. Other engines have separate experimental profiles.
- **ACE-Step task types:** its adapter exposes text2music and cover. Other upstream modes remain unavailable until explicitly implemented and validated.
- **Cancellation:** queued and not submitted only. Active inference interruption is unsupported.
- **Percentages:** the current API adapter exposes stage and elapsed time. There is no inferred percentage or ETA.
- **Distribution:** the Windows installer is unsigned unless a distributor supplies a signing certificate. Do not bypass OS warnings automatically.

Logs, database, caches, outputs, config backups and receipts are private user data under the application data home. No telemetry is included. Database backups should use SQLite backup, not copy a live WAL database. Live Audacity project files are never used as consistency-proven backups.
