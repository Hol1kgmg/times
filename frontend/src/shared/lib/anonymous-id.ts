import { z } from "zod";

const KEY = "times.cid";

let current: string | undefined;

const read = () => {
  try {
    return localStorage.getItem(KEY);
  } catch {
    // 保存を止めたブラウザではページの中だけで使い回す (specs/014 FR-003)
    return null;
  }
};

const write = (id: string) => {
  try {
    localStorage.setItem(KEY, id);
  } catch {
    // 保存を止めたブラウザではページの中だけで使い回す (specs/014 FR-003)
  }
};

export const anonymousId = (): string => {
  if (current !== undefined) {
    return current;
  }
  const saved = z.uuid().safeParse(read());
  if (saved.success) {
    current = saved.data;
    return current;
  }
  current = crypto.randomUUID();
  write(current);
  return current;
};
