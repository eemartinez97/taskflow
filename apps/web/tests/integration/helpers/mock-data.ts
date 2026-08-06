import type {
  ForgotPasswordInput,
  LoginInput,
  RegisterInput,
  ResetPasswordInput,
} from "@/lib/auth/schemas";

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

/** Minimal user record the DB mock returns after account creation. */
export const MOCK_DB_USER = {
  id: "user-uuid-abc123",
  email: "alice@taskflow.dev",
  name: "Alice Smith",
} satisfies { id: string; email: string; name: string };

/** Raw (unhashed) token the mocked issueAuthToken returns. */
export const MOCK_RAW_TOKEN = "raw-verification-token-xyz";

/** A valid forgot-password payload. */
export const VALID_FORGOT_PASSWORD_PAYLOAD: ForgotPasswordInput = {
  email: "alice@taskflow.dev",
};

/** A valid reset-password payload, as if reached from an emailed link. */
export const VALID_RESET_PASSWORD_PAYLOAD: ResetPasswordInput = {
  token: "valid-reset-token",
  password: "Secure@Password1",
  confirmPassword: "Secure@Password1",
};

/** Raw (unhashed) token the mocked issueAuthToken returns for password resets. */
export const MOCK_RESET_RAW_TOKEN = "raw-reset-token-xyz";
