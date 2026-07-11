import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/lib/trpc/client", () => import("@/tests/mocks/trpc-api"));
vi.mock("@taskflow/ui", () => import("@/tests/mocks/taskflow-ui"));

import { CreateProjectDialog } from "@/app/(dashboard)/projects/_components/create-project-dialog";
import { setupMutationMock, VALID_ORG_ID } from "@/tests/helpers";
import { api } from "@/tests/mocks/trpc-api";

// -- Fixtures --

const defaultProps = {
  orgId: VALID_ORG_ID,
  open: true,
  onClose: vi.fn(),
  onCreated: vi.fn(),
};

const VALID_FORM = { name: "Alpha Project", key: "ALPHA", slug: "alpha-project" } as const;

// -- Helpers --

async function fillAndSubmit(
  values: typeof VALID_FORM = VALID_FORM,
  user = userEvent.setup({ delay: null }),
): Promise<void> {
  await user.type(screen.getByLabelText(/^name/i), values.name);
  await user.type(screen.getByLabelText(/^key/i), values.key);
  await user.type(screen.getByLabelText(/^slug/i), values.slug);
  await user.click(screen.getByRole("button", { name: /^create$/i }));
}

// -- Shared mutation callback capture --

describe("CreateProjectDialog", () => {
  beforeEach(() => vi.clearAllMocks());

  // -- Visibility --

  it("renders when open=true", () => {
    render(<CreateProjectDialog {...defaultProps} />);
    expect(screen.getByRole("heading", { name: /create project/i })).toBeInTheDocument();
  });

  it("does NOT render form content when open=false", () => {
    render(<CreateProjectDialog {...defaultProps} open={false} />);
    // Dialog mock returns null when open=false
    expect(screen.queryByRole("heading", { name: /create project/i })).not.toBeInTheDocument();
  });

  // -- handleClose (Cancel button) --

  it("Cancel button calls onClose", async () => {
    const onClose = vi.fn();
    render(<CreateProjectDialog {...defaultProps} onClose={onClose} />);
    await userEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("Cancel button resets the form (name field cleared)", async () => {
    render(<CreateProjectDialog {...defaultProps} />);

    const nameInput = screen.getByLabelText(/^name/i);

    await userEvent.type(nameInput, "Typed text");
    expect(nameInput).toHaveValue("Typed text");
    await userEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(defaultProps.onClose).toHaveBeenCalled();
    expect(nameInput).toHaveValue("");
  });

  // -- onSubmit --

  it("Submit calls mutation.mutate with form data", async () => {
    const { mutateMock } = setupMutationMock(api.projects.create);

    render(<CreateProjectDialog {...defaultProps} />);
    await fillAndSubmit();

    expect(mutateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        orgId: VALID_ORG_ID,
        data: expect.objectContaining({
          name: VALID_FORM.name,
          key: VALID_FORM.key,
          slug: VALID_FORM.slug,
        }) as unknown,
      }),
    );
  });

  it("Submit clears any previous serverError", async () => {
    let callCount = 0;
    let capturedOnError: ((err: { message: string }) => void) | undefined;

    const mutateMock = vi.fn((_input: unknown) => {
      callCount++;
      // Only fire onError on the first submit.
      // Second submit: onSubmit() calls setServerError(null) BEFORE mutate(),
      // so the alert should be gone even though mutate() is called again.
      if (callCount === 1) capturedOnError?.({ message: "Something broke" });
    });

    vi.mocked(api.projects.create.useMutation).mockImplementation(
      (options?: { onError?: (err: { message: string }) => void }) => {
        capturedOnError = options?.onError;
        return {
          mutate: mutateMock,
          mutateAsync: vi.fn(),
          isPending: false,
          isError: false,
          error: null,
          data: undefined,
          reset: vi.fn(),
        };
      },
    );

    render(<CreateProjectDialog {...defaultProps} />);

    // First submit — onError fires synchronously -> alert appears
    await fillAndSubmit();
    expect(screen.getByRole("alert")).toBeInTheDocument();

    await userEvent.clear(screen.getByLabelText(/^name/i));
    await userEvent.clear(screen.getByLabelText(/^key/i));
    await userEvent.clear(screen.getByLabelText(/^slug/i));

    // Second submit — onSubmit clears serverError before calling mutate()
    // mutateMock does NOT fire onError on call #2 -> alert disappears
    await fillAndSubmit();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(mutateMock).toHaveBeenCalledTimes(2);
  });

  // -- onSuccess callback --

  it("onSuccess calls onCreated and onClose", () => {
    const onCreated = vi.fn();
    const onClose = vi.fn();
    const { triggerSuccess } = setupMutationMock(api.projects.create);

    render(<CreateProjectDialog {...defaultProps} onCreated={onCreated} onClose={onClose} />);

    triggerSuccess();

    expect(onCreated).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("onSuccess invalidates projects.list cache", () => {
    const invalidateMock = vi.fn();
    vi.mocked(api.useUtils).mockReturnValue({
      invalidate: vi.fn(),
      projects: { list: { invalidate: invalidateMock, setData: vi.fn() } },
      tasks: { list: { invalidate: vi.fn(), setData: vi.fn() } },
    });

    const { triggerSuccess } = setupMutationMock(api.projects.create);
    render(<CreateProjectDialog {...defaultProps} />);

    triggerSuccess();

    expect(invalidateMock).toHaveBeenCalledOnce();
  });

  // -- onError callback --

  it("onError displays the server error message", async () => {
    const { mutateMock, triggerError } = setupMutationMock(api.projects.create);
    mutateMock.mockImplementation(() => {
      triggerError({ message: "A project with that key already exists." });
    });

    render(<CreateProjectDialog {...defaultProps} />);
    await fillAndSubmit();

    // State update happened synchronously inside userEvent's act() — alert is in DOM
    expect(screen.getByRole("alert")).toHaveTextContent(/already exists/i);
  });

  it("onError does not call onClose", async () => {
    const onClose = vi.fn();

    // mutateMock fires onError synchronously inside form submit -> within act() boundary
    const { mutateMock, triggerError } = setupMutationMock(api.projects.create);
    mutateMock.mockImplementation(() => {
      triggerError({ message: "Some error" });
    });

    render(<CreateProjectDialog {...defaultProps} onClose={onClose} />);
    await fillAndSubmit();

    // onError was called (error message shown) but onClose must NOT have been called
    expect(onClose).not.toHaveBeenCalled();
  });

  // -- Loading state --

  it("Create button shows loading state when mutation isPending", () => {
    vi.mocked(api.projects.create.useMutation).mockReturnValue({
      mutate: vi.fn(),
      mutateAsync: vi.fn(),
      isPending: true, // ← pending
      isError: false,
      error: null,
      data: undefined,
      reset: vi.fn(),
    });

    render(<CreateProjectDialog {...defaultProps} />);
    // Button is disabled when loading (our Button mock sets disabled when loading)
    expect(screen.getByRole("button", { name: /^create$/i })).toBeDisabled();
  });
});
