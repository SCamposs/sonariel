import { expect, it } from "vitest";
import type { Job } from "./api";
import { jobRecoveryKey } from "./workflow-state";

it("explains memory waiting without authorizing a new submission", () => {
  const job = { state: "queued", stage: "Aguardando 12 GiB de RAM livre", remote_id: null } as Job;
  expect(jobRecoveryKey(job)).toBe("waitingRamHelp");
  expect(jobRecoveryKey({ ...job, stage: "Na fila" })).toBe("queuedTaskHelp");
  expect(jobRecoveryKey({ ...job, state: "completed" })).toBeUndefined();
});

it("keeps remote identity uncertainty separate from local interruption", () => {
  const job = { state: "interrupted", stage: "Interrompida", remote_id: "remote-task" } as Job;
  expect(jobRecoveryKey(job)).toBe("uncertainTaskHelp");
  expect(jobRecoveryKey({ ...job, remote_id: null })).toBe("interruptedTaskHelp");
  expect(jobRecoveryKey({ ...job, state: "generating" })).toBeUndefined();
});
