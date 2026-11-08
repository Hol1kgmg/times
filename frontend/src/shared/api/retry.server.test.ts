import { describe, expect, it, vi } from "vitest";
import { retry, RetryableError } from "./retry.server";

describe(retry, () => {
  it("retries a transient failure up to three attempts", async () => {
    const run = vi.fn<() => Promise<never>>().mockRejectedValue(new RetryableError("503"));
    await expect(retry(run)).rejects.toBeInstanceOf(RetryableError);
    expect(run).toHaveBeenCalledTimes(3);
  });

  it("does not retry a non-transient failure", async () => {
    const run = vi.fn<() => Promise<never>>().mockRejectedValue(new Error("403"));
    await expect(retry(run)).rejects.toThrow("403");
    expect(run).toHaveBeenCalledOnce();
  });
});
