export class RetryableError extends Error {
  override readonly name = "RetryableError";
}

const ATTEMPTS = 3;

export const retry = async <T>(run: () => Promise<T>, attemptsLeft = ATTEMPTS): Promise<T> => {
  try {
    return await run();
  } catch (error) {
    if (error instanceof RetryableError && attemptsLeft > 1) {
      return await retry(run, attemptsLeft - 1);
    }
    throw error;
  }
};
