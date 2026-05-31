import type { LoginResponse, SessionUser, UserRole } from "@rsjt/shared";

const USER_ROLES = ["manager", "tech"] as const satisfies readonly UserRole[];

export function toLoginResponse(value: unknown): LoginResponse | null {
  if (!isRecord(value) || typeof value.token !== "string") {
    return null;
  }

  if (value.token.length < 24) {
    return null;
  }

  const user = toSessionUser(value.user);
  if (!user) {
    return null;
  }

  return {
    token: value.token,
    user,
  };
}

export function toSessionUser(value: unknown): SessionUser | null {
  if (!isRecord(value)) {
    return null;
  }

  if (
    typeof value.id !== "string" ||
    typeof value.displayName !== "string" ||
    !isUserRole(value.role)
  ) {
    return null;
  }

  return {
    id: value.id,
    role: value.role,
    displayName: value.displayName,
  };
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isUserRole(value: unknown): value is UserRole {
  return USER_ROLES.some((role) => role === value);
}
