import { describe, expect, it } from "vitest";
import { buildApp } from "../app.js";
import { createFakeAuthService } from "./support/fake-auth-service.js";
import { testConfig } from "./support/test-config.js";

describe("health routes", () => {
  it("returns API health", async () => {
    const app = await buildApp(testConfig(), {
      authService: createFakeAuthService({}),
    });

    const response = await app.inject({
      method: "GET",
      url: "/health",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ok: true });

    await app.close();
  });
});
