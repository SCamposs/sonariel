// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  UPDATE_INTERVAL,
  UPDATE_PREFERENCE,
  useUpdates,
  type UpdateTransport,
} from "./updates";

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
function transport(): UpdateTransport {
  return {
    supported: true,
    check: vi.fn().mockResolvedValue(null),
    install: vi.fn().mockResolvedValue(undefined),
  };
}

describe("Optional release checks", () => {
  it("checks at launch and hourly, stops when disabled, and never installs automatically", async () => {
    const api = transport();
    const { result } = renderHook(() => useUpdates(api));
    await act(async () => {});
    expect(api.check).toHaveBeenCalledTimes(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(UPDATE_INTERVAL);
    });
    expect(api.check).toHaveBeenCalledTimes(2);
    act(() => result.current.changeAutomatic(false));
    expect(localStorage.getItem(UPDATE_PREFERENCE)).toBe("off");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2 * UPDATE_INTERVAL);
    });
    expect(api.check).toHaveBeenCalledTimes(2);
    expect(api.install).not.toHaveBeenCalled();
  });

  it("remembers manual mode across mounts, but still permits an explicit check", async () => {
    localStorage.setItem(UPDATE_PREFERENCE, "off");
    const api = transport();
    const { result } = renderHook(() => useUpdates(api));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(UPDATE_INTERVAL);
    });
    expect(api.check).not.toHaveBeenCalled();
    await act(async () => {
      await result.current.check();
    });
    expect(api.check).toHaveBeenCalledTimes(1);
    expect(result.current.checkedAt).toBeInstanceOf(Date);
  });

  it("keeps the available-version signal on a network error and requires explicit installation", async () => {
    const api = transport();
    vi.mocked(api.check)
      .mockResolvedValueOnce({ version: "0.3.0", notes: "An update" })
      .mockRejectedValueOnce(new Error("offline"));
    const { result } = renderHook(() => useUpdates(api));
    await act(async () => {});
    expect(result.current.available?.version).toBe("0.3.0");
    expect(api.install).not.toHaveBeenCalled();
    await act(async () => {
      await result.current.check();
    });
    expect(result.current.error).toContain("consultar as releases");
    expect(result.current.available?.version).toBe("0.3.0");
    await act(async () => {
      await result.current.install();
    });
    expect(api.install).toHaveBeenCalledWith("0.3.0", expect.any(Function));
  });

  it("does not contact an updater outside the installed desktop", async () => {
    const api = { ...transport(), supported: false };
    const { result } = renderHook(() => useUpdates(api));
    await act(async () => {
      await result.current.check();
      await vi.advanceTimersByTimeAsync(UPDATE_INTERVAL);
    });
    expect(api.check).not.toHaveBeenCalled();
  });
});
