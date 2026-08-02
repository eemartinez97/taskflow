import type { RegisterInput, LoginInput } from "@/lib/auth/schemas";

/** A valid registration payload that passes every schema rule. */
export const VALID_REGISTER_PAYLOAD: RegisterInput = {
  name: "Alice Smith",
  email: "alice@taskflow.dev",
  password: "Secure@Password1",
  confirmPassword: "Secure@Password1",
};

/** A valid login payload. */
export const VALID_LOGIN_PAYLOAD: LoginInput = {
  email: "alice@taskflow.dev",
  password: "Secure@Password1",
};

/** Minimal user record the DB mock returns after a successful creation. */
export const MOCK_DB_USER = {
  id: "user-uuid-abc123",
  email: "alice@taskflow.dev",
  name: "Alice Smith",
} satisfies { id: string; email: string; name: string };
