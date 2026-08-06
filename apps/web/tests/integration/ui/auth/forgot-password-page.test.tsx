import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import ForgotPasswordPage from "@/app/(auth)/forgot-password/page";
import { renderUI } from "../../helpers/render";
import { VALID_FORGOT_PASSWORD_PAYLOAD } from "../../helpers/mock-data";

const mockFetch = vi.fn<typeof fetch>();

function makeJsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("ForgotPasswordPage", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    vi.stubGlobal("fetch", mockFetch);
  });

  it("renders the heading and email field", () => {
    renderUI(<ForgotPasswordPage />);
    expect(screen.getByRole("heading", { name: /forgot your password/i })).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
  });

  it("shows a validation error for an invalid email", async () => {
    renderUI(<ForgotPasswordPage />);
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "not-an-email" } });
    fireEvent.click(screen.getByRole("button", { name: /send reset link/i }));
    await waitFor(() => {
      expect(screen.getByText(/valid email/i)).toBeInTheDocument();
    });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("calls fetch and shows the generic confirmation on success", async () => {
    mockFetch.mockResolvedValue(makeJsonResponse(200, { message: "generic" }));
    renderUI(<ForgotPasswordPage />);
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: VALID_FORGOT_PASSWORD_PAYLOAD.email },
    });
    fireEvent.click(screen.getByRole("button", { name: /send reset link/i }));
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /check your email/i })).toBeInTheDocument();
    });
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/auth/forgot-password");
    expect(JSON.parse(init.body as string)).toEqual(VALID_FORGOT_PASSWORD_PAYLOAD);
  });

  it("shows the server error when the response is not OK", async () => {
    mockFetch.mockResolvedValue(
      makeJsonResponse(429, { error: "Too many requests. Please try again later." }),
    );
    renderUI(<ForgotPasswordPage />);
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: VALID_FORGOT_PASSWORD_PAYLOAD.email },
    });
    fireEvent.click(screen.getByRole("button", { name: /send reset link/i }));
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/too many requests/i);
    });
  });

  it("falls back to the generic error message when the response has no error field", async () => {
    mockFetch.mockResolvedValue(makeJsonResponse(500, {}));
    renderUI(<ForgotPasswordPage />);
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: VALID_FORGOT_PASSWORD_PAYLOAD.email },
    });
    fireEvent.click(screen.getByRole("button", { name: /send reset link/i }));
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/something went wrong/i);
    });
  });

  it("renders a link back to the login page", () => {
    renderUI(<ForgotPasswordPage />);
    expect(screen.getByRole("link", { name: /back to sign in/i })).toHaveAttribute(
      "href",
      "/login",
    );
  });
});
