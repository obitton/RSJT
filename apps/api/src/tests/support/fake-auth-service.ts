import type { SessionUser } from "@rsjt/shared";
import type { AuthSessionService } from "../../services/auth-service.js";

export function createFakeAuthService(
  sessions: Record<string, SessionUser>,
): AuthSessionService {
  return {
    async login() {
      throw new Error("Unexpected login call");
    },
    async getSession(token: string) {
      const user = sessions[token];
      return user ? { user } : null;
    },
    async logout() {},
  };
}
