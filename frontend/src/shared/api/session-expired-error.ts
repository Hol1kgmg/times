// トークン付きの要求が 401 (unauthorized)。session の期限切れ・失効
export class SessionExpiredError extends Error {
  override readonly name = "SessionExpiredError";
}
