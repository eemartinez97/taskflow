import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { signIn } from "next-auth/react";
import RegisterPage from "@/app/(auth)/register/page";
import { renderUI } from "../../helpers/render";
import { MOCK_DB_USER, VALID_REGISTER_PAYLOAD } from "../../helpers/mock-data";
import { setupRouterMock } from "@/tests/support/render";

// -- Helpers --
const mockSignIn = vi.mocked(signIn);
const mockFetch = vi.fn<typeof fetch>();

/** Creates a fake Response with a JSON body and given status. */
function makeJsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** Fills all four register form fields. */
function fillForm(overrides: Partial<typeof VALID_REGISTER_PAYLOAD> = {}): void {
  const { name, email, password, confirmPassword } = {
    ...VALID_REGISTER_PAYLOAD,
    ...overrides,
  };
  fireEvent.change(screen.getByLabelText("Name"), { target: { value: name } });
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: email } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: password } });
  fireEvent.change(screen.getByLabelText("Confirm Password"), {
    target: { value: confirmPassword },
  });
}

describe("RegisterPage", () => {
  const { router: mockRouter } = setupRouterMock();

  beforeEach(() => {
    mockSignIn.mockReset();
    mockFetch.mockReset();
    vi.stubGlobal("fetch", mockFetch);
  });

  // -- Rendering --

  it("renders the 'Create your account' heading", () => {
    renderUI(<RegisterPage />);

    expect(screen.getByRole("heading", { name: /create your account/i })).toBeInTheDocument();
  });

  it("renders name, email, password and confirm-password fields", () => {
    renderUI(<RegisterPage />);

    expect(screen.getByLabelText("Name")).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(screen.getByLabelText("Confirm Password")).toBeInTheDocument();
  });

  it("renders a link to the login page", () => {
    renderUI(<RegisterPage />);

    expect(screen.getByRole("link", { name: /sign in/i })).toHaveAttribute("href", "/login");
  });

  // -- Client-side validation --

  it("shows a validation error for a name that is too short", async () => {
    renderUI(<RegisterPage />);
    fillForm({ name: "A" });
    fireEvent.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => {
      expect(screen.getByText(/at least 2 characters/i)).toBeInTheDocument();
    });

    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("shows a validation error for an invalid email", async () => {
    renderUI(<RegisterPage />);
    fillForm({ email: "not-an-email" });
    fireEvent.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => {
      expect(screen.getByText(/valid email/i)).toBeInTheDocument();
    });

    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("shows a validation error for a password that is too short", async () => {
    renderUI(<RegisterPage />);
    fillForm({ password: "Sh@rt1", confirmPassword: "Sh@rt1" });
    fireEvent.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => {
      expect(screen.getByText(/10 characters/i)).toBeInTheDocument();
    });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("shows a validation error when passwords do not match", async () => {
    renderUI(<RegisterPage />);
    fillForm({ confirmPassword: "Different@Password9" });
    fireEvent.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => {
      expect(screen.getByText(/do not match/i)).toBeInTheDocument();
    });

    expect(mockFetch).not.toHaveBeenCalled();
  });

  // -- Fetch call --

  it("calls fetch POST /api/auth/register with the form data as JSON", async () => {
    mockFetch.mockResolvedValue(makeJsonResponse(201, { user: MOCK_DB_USER }));
    mockSignIn.mockResolvedValue({ error: null, ok: true, status: 200, url: null });

    renderUI(<RegisterPage />);
    fillForm();
    fireEvent.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledOnce();
    });

    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/auth/register");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toMatchObject({
      email: VALID_REGISTER_PAYLOAD.email,
      password: VALID_REGISTER_PAYLOAD.password,
    });
  });

  // -- 409 - duplicate email --

  it("shows the 'already exists' error when the server returns 409", async () => {
    mockFetch.mockResolvedValue(
      makeJsonResponse(409, { error: "An account with that email already exists." }),
    );
    renderUI(<RegisterPage />);
    fillForm();
    fireEvent.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/already exists/i);
    });

    expect(mockSignIn).not.toHaveBeenCalled();
    expect(mockRouter.push).not.toHaveBeenCalled();
  });

  // -- Non-OK responses --

  it("shows body.error when the server returns a non-OK response with an error message", async () => {
    mockFetch.mockResolvedValue(makeJsonResponse(422, { error: "Email domain is not allowed." }));
    renderUI(<RegisterPage />);
    fillForm();
    fireEvent.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/email domain is not allowed/i);
    });
    expect(mockSignIn).not.toHaveBeenCalled();
  });

  it("shows the generic fallback error when the server response has no error field", async () => {
    mockFetch.mockResolvedValue(makeJsonResponse(500, {}));
    renderUI(<RegisterPage />);
    fillForm();
    fireEvent.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/something went wrong/i);
    });
  });

  // -- signIn after successful registration --

  it("redirects to /projects when registration and signIn both succeed", async () => {
    mockFetch.mockResolvedValue(makeJsonResponse(201, { user: MOCK_DB_USER }));
    mockSignIn.mockResolvedValue({ error: null, ok: true, status: 200, url: null });

    renderUI(<RegisterPage />);
    fillForm();
    fireEvent.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => {
      expect(mockRouter.push).toHaveBeenCalledWith("/projects");
    });
  });

  it("redirects to /login when registration succeeds but signIn returns an error", async () => {
    mockFetch.mockResolvedValue(makeJsonResponse(201, { user: MOCK_DB_USER }));
    mockSignIn.mockResolvedValue({
      error: "CredentialsSignin",
      ok: false,
      status: 401,
      url: null,
    });

    renderUI(<RegisterPage />);
    fillForm();
    fireEvent.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => {
      expect(mockRouter.push).toHaveBeenCalledWith("/login");
    });
  });

  it("calls signIn with the submitted email and password after a 201 response", async () => {
    mockFetch.mockResolvedValue(makeJsonResponse(201, { user: MOCK_DB_USER }));
    mockSignIn.mockResolvedValue({ error: null, ok: true, status: 200, url: null });

    renderUI(<RegisterPage />);
    fillForm();
    fireEvent.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => {
      expect(mockSignIn).toHaveBeenCalledWith("credentials", {
        email: VALID_REGISTER_PAYLOAD.email,
        password: VALID_REGISTER_PAYLOAD.password,
        redirect: false,
      });
    });
  });

  // -- Loading state --

  it("disables the submit button while the form is submitting", async () => {
    let resolveResponse!: (value: Response) => void;
    const pendingResponse = new Promise<Response>((res) => {
      resolveResponse = res;
    });
    mockFetch.mockReturnValueOnce(pendingResponse);

    renderUI(<RegisterPage />);
    fillForm();
    fireEvent.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /create account/i })).toBeDisabled();
    });

    // Resolve to prevent the test from hanging
    resolveResponse(makeJsonResponse(409, { error: "exists" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /create account/i })).not.toBeDisabled();
    });
  });

  // -- Error cleared on retry --

  it("clears the server error when the user resubmits the form", async () => {
    mockFetch
      .mockResolvedValueOnce(makeJsonResponse(409, { error: "already exists" }))
      .mockResolvedValueOnce(makeJsonResponse(201, { user: MOCK_DB_USER }));
    mockSignIn.mockResolvedValue({ error: null, ok: true, status: 200, url: null });

    renderUI(<RegisterPage />);
    fillForm();
    fireEvent.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });

    // Second submit clears the error before the new fetch resolves
    fireEvent.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => {
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });
  });
});
