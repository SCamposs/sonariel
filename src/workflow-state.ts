import type { Job } from "./api";

/** Explain existing queue states; never retry, cancel or change admission. */
export function jobRecoveryKey(job: Job): "waitingRamHelp" | "queuedTaskHelp" | "uncertainTaskHelp" | "interruptedTaskHelp" | undefined {
  if (job.state === "queued") return /Aguardando .*GiB|waiting .*RAM/i.test(job.stage) ? "waitingRamHelp" : "queuedTaskHelp";
  if (job.state === "interrupted") return job.remote_id ? "uncertainTaskHelp" : "interruptedTaskHelp";
  return undefined;
}
