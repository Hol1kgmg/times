import type { Problem } from "./schemas";

export class BackendProblemError extends Error {
  override readonly name = "BackendProblemError";
  readonly status: number;
  readonly problem: Problem | undefined;
  constructor(message: string, status: number, problem: Problem | undefined) {
    super(message);
    this.status = status;
    this.problem = problem;
  }
}
