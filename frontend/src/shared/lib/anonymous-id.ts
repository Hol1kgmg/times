import { z } from "zod";

const KEY = "times.cid";

let current: string | undefined;

export const anonymousId = (): string => {
  if (current !== undefined) {
    return current;
  }
  try {
    const saved = z.uuid().safeParse(localStorage.getItem(KEY));
    current = saved.success ? saved.data : crypto.randomUUID();
    if (!saved.success) {
      localStorage.setItem(KEY, current);
    }
  } catch {
    // 保存を止めたブラウザではページの中だけで使い回す (specs/014 FR-003)
    current ??= crypto.randomUUID();
  }
  return current;
};
