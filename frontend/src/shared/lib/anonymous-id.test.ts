import { beforeEach, describe, expect, it, vi } from "vitest";

const SAVED = "0b6c2f4e-8a1d-4c3b-9e5f-7a2d1c0b9e8f";

const storage = (initial: Record<string, string>) => {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
    values,
  };
};

const load = async () => {
  const mod = await import("./anonymous-id");
  return mod.anonymousId;
};

const fail = () => {
  throw new DOMException("denied", "SecurityError");
};

describe("匿名 ID", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
  });

  it("reuses the id already saved in this browser", async () => {
    vi.stubGlobal("localStorage", storage({ "times.cid": SAVED }));
    const anonymousId = await load();
    expect(anonymousId()).toBe(SAVED);
  });

  it("replaces a saved value that is not a UUID", async () => {
    const s = storage({ "times.cid": "broken" });
    vi.stubGlobal("localStorage", s);
    const anonymousId = await load();
    const id = anonymousId();
    expect(id).toMatch(/^[\da-f-]{36}$/u);
    expect(s.values.get("times.cid")).toBe(id);
  });

  it("keeps one id within the page when storage throws", async () => {
    vi.stubGlobal("localStorage", { getItem: fail, setItem: fail });
    const anonymousId = await load();
    expect(anonymousId()).toBe(anonymousId());
  });
});
