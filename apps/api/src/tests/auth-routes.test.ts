import type { SessionUser } from "@rsjt/shared";
import { beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../app.js";
import type { ApiConfig } from "../config.js";
import { InvalidLoginError } from "../services/auth-service.js";

const managerUser: SessionUser = {
  id: "00000000-0000-4000-8000-000000000001",
  role: "manager",
  displayName: "Manager",
};

describe("auth routes", () => {
  let authService: StubAuthService;

  beforeEach(() => {
    authService = new StubAuthService();
  });

  it("logs in with valid credentials", async () => {
    const app = await buildApp(testConfig(), { authService });

    const response = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: {
        username: "manager",
        passcode: "manager-dev",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      token: "session-token-manager",
      user: managerUser,
    });

    await app.close();
  });

  it("rejects invalid credentials", async () => {
    const app = await buildApp(testConfig(), { authService });

    const response = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: {
        username: "manager",
        passcode: "wrong-passcode",
      },
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ error: "Invalid login" });

    await app.close();
  });

  it("returns the current bearer session", async () => {
    const app = await buildApp(testConfig(), { authService });

    const response = await app.inject({
      method: "GET",
      url: "/auth/session",
      headers: {
        authorization: "Bearer session-token-manager",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ user: managerUser });

    await app.close();
  });

  it("requires a valid bearer session", async () => {
    const app = await buildApp(testConfig(), { authService });

    const response = await app.inject({
      method: "GET",
      url: "/auth/session",
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ error: "Authentication required" });

    await app.close();
  });

  it("revokes the bearer session on logout", async () => {
    const app = await buildApp(testConfig(), { authService });

    const response = await app.inject({
      method: "POST",
      url: "/auth/logout",
      headers: {
        authorization: "Bearer session-token-manager",
      },
    });

    expect(response.statusCode).toBe(204);
    expect(authService.revokedTokens).toEqual(["session-token-manager"]);

    await app.close();
  });

  it("enforces role guards", async () => {
    const app = await buildApp(testConfig(), { authService });

    app.get("/test/manager-only", async (request) => {
      const user = await app.requireRole(request, ["manager"]);
      return { user };
    });

    const response = await app.inject({
      method: "GET",
      url: "/test/manager-only",
      headers: {
        authorization: "Bearer session-token-manager",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ user: managerUser });

    await app.close();
  });
});

class StubAuthService {
  readonly revokedTokens: string[] = [];

  async login(username: string, passcode: string) {
    if (username !== "manager" || passcode !== "manager-dev") {
      throw new InvalidLoginError();
    }

    return {
      token: "session-token-manager",
      user: managerUser,
    };
  }

  async getSession(token: string) {
    if (token !== "session-token-manager") {
      return null;
    }

    return { user: managerUser };
  }

  async logout(token: string) {
    this.revokedTokens.push(token);
  }
}

function testConfig(): ApiConfig {
  return {
    NODE_ENV: "test",
    DATABASE_URL: "postgres://rsjt:rsjt_local@localhost:54329/rsjt_dev",
    API_HOST: "127.0.0.1",
    API_PORT: 47630,
    SESSION_TTL_HOURS: 720,
    REPAIRSHOPR_TIMEOUT_MS: 10000,
  };
}
