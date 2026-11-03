import type { Digest } from "#/shared/api";

export const PAGE_SIZE = 7;

// page は新しい順で届き、画面はチャットログとして古い順に積む
export const prependPage = (current: Digest[], page: Digest[]) => ({
  digests: [...page.toReversed(), ...current],
  done: page.length < PAGE_SIZE,
});
