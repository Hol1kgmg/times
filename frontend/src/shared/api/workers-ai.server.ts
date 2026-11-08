interface Ai {
  run: (model: string, input: unknown) => Promise<unknown>;
}

const isAi = (v: unknown): v is Ai =>
  typeof v === "object" && v !== null && "run" in v && typeof v.run === "function";

export const workersAi = async (): Promise<Ai | null> => {
  let ai: unknown;
  try {
    const workers = await import("cloudflare:workers");
    ai = workers.env.AI;
  } catch {
    // ローカルの vite dev (Node) には無く、AI を使わないことが仕様 (011 方針 A、012 FR-012)
    return null;
  }
  return isAi(ai) ? ai : null;
};
