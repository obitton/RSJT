export function requireToken(token: string | undefined) {
  if (!token) {
    throw new Error("Session required");
  }
  return token;
}

export function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Request failed";
}
