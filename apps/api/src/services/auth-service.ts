import { createHash, randomBytes } from "node:crypto";
import type { LoginResponse, SessionUser } from "@rsjt/shared";
import argon2 from "argon2";
import type { ApiConfig } from "../config.js";
import type { SessionsRepository } from "../repositories/sessions-repository.js";
import type { UsersRepository } from "../repositories/users-repository.js";

export type ActiveSession = {
  user: SessionUser;
};

export interface AuthSessionService {
  login(username: string, passcode: string): Promise<LoginResponse>;
  getSession(token: string): Promise<ActiveSession | null>;
  logout(token: string): Promise<void>;
}

export class InvalidLoginError extends Error {
  constructor() {
    super("Invalid login");
  }
}

export function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export class AuthService implements AuthSessionService {
  constructor(
    private readonly users: UsersRepository,
    private readonly sessions: SessionsRepository,
    private readonly config: ApiConfig,
  ) {}

  async login(username: string, passcode: string) {
    const user = await this.users.findActiveByUsername(username);

    if (!user) {
      throw new InvalidLoginError();
    }

    const valid = await argon2.verify(user.passcodeHash, passcode);

    if (!valid) {
      throw new InvalidLoginError();
    }

    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(
      Date.now() + this.config.SESSION_TTL_HOURS * 60 * 60 * 1000,
    );

    await this.sessions.create({
      userId: user.id,
      tokenHash: hashSessionToken(token),
      expiresAt,
    });

    return {
      token,
      user: {
        id: user.id,
        role: user.role,
        displayName: user.displayName,
      },
    };
  }

  async getSession(token: string) {
    return this.sessions.findActiveByTokenHash(hashSessionToken(token));
  }

  async logout(token: string) {
    await this.sessions.revokeByTokenHash(hashSessionToken(token));
  }
}
