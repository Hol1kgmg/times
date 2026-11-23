import { Result } from "@praha/byethrow";
import { notFound } from "@tanstack/react-router";
import { digest } from "#/shared/api";
import type { BackendError } from "#/shared/api/index.server";
import { BackendProblemError, unwrapBackend } from "#/shared/api/index.server";

export const digestOf = async (result: Result.Result<Response, BackendError>) => {
  if (
    Result.isFailure(result) &&
    result.error instanceof BackendProblemError &&
    result.error.status === 404
  ) {
    throw notFound();
  }
  return digest.parse(await unwrapBackend(result).json());
};
