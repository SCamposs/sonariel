import { useLayoutEffect, useRef } from "react";

/** Keep a module's own location without inheriting another module's scroll. */
export function useWorkspaceScroll(key: string) {
  const ref = useRef<HTMLElement>(null);
  const positions = useRef(new Map<string, number>());
  useLayoutEffect(() => {
    if (ref.current) ref.current.scrollTop = positions.current.get(key) ?? 0;
  }, [key]);
  return { ref, onScroll: () => { if (ref.current) positions.current.set(key, ref.current.scrollTop); } };
}
