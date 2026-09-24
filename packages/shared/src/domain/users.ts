import { z } from "zod";

export const UserRoleSchema = z.enum(["manager", "tech"]);

export const SessionUserSchema = z.object({
  id: z.string().uuid(),
  role: UserRoleSchema,
  displayName: z.string().min(1),
});

export const LoginRequestSchema = z.object({
  username: z.string().min(1),
  passcode: z.string().min(4),
});

export const LoginResponseSchema = z.object({
  token: z.string().min(24),
  user: SessionUserSchema,
});

export const AuthSessionResponseSchema = z.object({
  user: SessionUserSchema,
});

export type UserRole = z.infer<typeof UserRoleSchema>;
export type SessionUser = z.infer<typeof SessionUserSchema>;
export type LoginRequest = z.infer<typeof LoginRequestSchema>;
export type LoginResponse = z.infer<typeof LoginResponseSchema>;
export type AuthSessionResponse = z.infer<typeof AuthSessionResponseSchema>;
