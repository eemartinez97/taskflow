import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { ResetPasswordForm } from "@/app/(auth)/reset-password/_components/reset-password-form";
import { renderUI } from "../../helpers/render";
import { setupRouterMock } from "@/tests/support/render";
import { MOCK_RESET_RAW_TOKEN, VALID_RESET_PASSWORD_PAYLOAD } from "../../helpers/mock-data";

const mockFetch = vi.fn<typeof fetch>();

function makeJsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function fillForm(password = VALID_RESET_PASSWORD_PAYLOAD.password): void {
  fireEvent.change(screen.getByLabelText("New Password"), { target: { value: password } });
  fireEvent.change(screen.getByLabelText("Confirm New Password"), { target: { value: password } });
}

describe("ResetPasswordForm", () => {
  const { router: mockRouter } = setupRouterMock();

  beforeEach(() => {
    mockFetch.mockReset();
    vi.stubGlobal("fetch", mockFetch);
  });

  it("renders new-password and confirm-password fields", () => {
    renderUI(<ResetPasswordForm token={MOCK_RESET_RAW_TOKEN} />);
    expect(screen.getByLabelText("New Password")).toBeInTheDocument();
    expect(screen.getByLabelText("Confirm New Password")).toBeInTheDocument();
  });

  it("shows a validation error when passwords do not match", async () => {
    renderUI(<ResetPasswordForm token={MOCK_RESET_RAW_TOKEN} />);
    fireEvent.change(screen.getByLabelText("New Password"), { target: { value: "Str0ng!Pass1" } });
    fireEvent.change(screen.getByLabelText("Confirm New Password"), {
      target: { value: "Different1!" },
    });
    fireEvent.click(screen.getByRole("button", { name: /reset password/i }));
    await waitFor(() => {
      expect(screen.getByText(/do not match/i)).toBeInTheDocument();
    });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("submits the token and password to /api/auth/reset-password", async () => {
    mockFetch.mockResolvedValue(makeJsonResponse(200, { message: "Password updated." }));
    renderUI(<ResetPasswordForm token={MOCK_RESET_RAW_TOKEN} />);
    fillForm();
    fireEvent.click(screen.getByRole("button", { name: /reset password/i }));
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledOnce();
    });
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/auth/reset-password");
    expect(JSON.parse(init.body as string)).toMatchObject({
      token: MOCK_RESET_RAW_TOKEN,
      password: VALID_RESET_PASSWORD_PAYLOAD.password,
    });
  });

  it("redirects to /login?reset=1 on success", async () => {
    mockFetch.mockResolvedValue(makeJsonResponse(200, { message: "Password updated." }));
    renderUI(<ResetPasswordForm token={MOCK_RESET_RAW_TOKEN} />);
    fillForm();
    fireEvent.click(screen.getByRole("button", { name: /reset password/i }));
    await waitFor(() => {
      expect(mockRouter.push).toHaveBeenCalledWith("/login?reset=1");
    });
  });

  it("shows the server error when the token is expired (410)", async () => {
    mockFetch.mockResolvedValue(
      makeJsonResponse(410, { error: "This reset link is invalid or has expired." }),
    );
    renderUI(<ResetPasswordForm token={MOCK_RESET_RAW_TOKEN} />);
    fillForm();
    fireEvent.click(screen.getByRole("button", { name: /reset password/i }));
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/invalid or has expired/i);
    });
    expect(mockRouter.push).not.toHaveBeenCalled();
  });

  it("shows the generic fallback error when the response has no error field", async () => {
    mockFetch.mockResolvedValue(makeJsonResponse(500, {}));
    renderUI(<ResetPasswordForm token={MOCK_RESET_RAW_TOKEN} />);
    fillForm();
    fireEvent.click(screen.getByRole("button", { name: /reset password/i }));
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/something went wrong/i);
    });
  });

  it("disables the submit button while submitting", async () => {
    let resolveResponse!: (value: Response) => void;
    const pendingResponse = new Promise<Response>((res) => {
      resolveResponse = res;
    });
    mockFetch.mockReturnValueOnce(pendingResponse);
    renderUI(<ResetPasswordForm token={MOCK_RESET_RAW_TOKEN} />);
    fillForm();
    fireEvent.click(screen.getByRole("button", { name: /reset password/i }));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /reset password/i })).toBeDisabled();
    });
    resolveResponse(makeJsonResponse(410, { error: "expired" }));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /reset password/i })).not.toBeDisabled();
    });
  });
});
