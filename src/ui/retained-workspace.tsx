import { useState, type ReactNode } from "react";

/** Mount on first visit, then keep the local draft while navigating modules.
 * The caller keys this boundary by project; no draft is persisted to disk.
 */
export function RetainedWorkspace({ active, children }: { active: boolean; children: ReactNode }) {
  const [visited, setVisited] = useState(active);
  if (active && !visited) setVisited(true);
  return active || visited ? <div hidden={!active}>{children}</div> : null;
}
