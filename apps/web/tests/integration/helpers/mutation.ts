import { type MockInstance, vi } from "vitest";

interface MutationOptions {
  onSuccess?: (...args: unknown[]) => void;
  onError?: (...args: unknown[]) => void;
  onSettled?: (...args: unknown[]) => void;
  meta?: unknown;
}

/** Structural type for any tRPC resource exposing `useMutation` (e.g. `api.orgs.update`). */
interface MutationResource {
  useMutation: unknown;
}

export interface CapturableMutation {
  /** Pass to vi.mocked(api.x.useMutation).mockImplementation */
  useMutationImpl: ReturnType<typeof vi.fn>;
  /** Spy on the mutate call to assert args */
  mutate: ReturnType<typeof vi.fn>;
  /** Spy on the reset call */
  reset: ReturnType<typeof vi.fn>;
  /** Invoke the onSuccess callback captured from useMutation options */
  simulateSuccess: (...args: unknown[]) => void;
  mockReturn: {
    mutate: ReturnType<typeof vi.fn>;
    mutateAsync: ReturnType<typeof vi.fn>;
    isPending: boolean;
    isError: boolean;
    isSuccess: boolean;
    error: null | { message: string };
    data: unknown;
    reset: ReturnType<typeof vi.fn>;
  };
}

/**
 * Creates a tRPC useMutation mock that captures the onSuccess/onError/onSettled
 * callbacks passed to useMutation and exposes simulateSuccess() to invoke them.
 *
 * Usage:
 *   const mutation = createCapturableMutation();
 *   vi.mocked(api.orgs.update.useMutation).mockImplementation(mutation.useMutationImpl as never);
 *   // ... render, interact ...
 *   mutation.simulateSuccess(responseData, variables);
 */
function createCapturableMutation(
  overrides: Partial<CapturableMutation["mockReturn"]> = {},
): CapturableMutation {
  const captured: MutationOptions = {};
  const mutate = vi.fn();
  const reset = vi.fn();

  const mockReturn: CapturableMutation["mockReturn"] = {
    mutate,
    mutateAsync: vi.fn().mockResolvedValue(undefined),
    isPending: false,
    isError: false,
    isSuccess: false,
    error: null,
    data: undefined,
    reset,
    ...overrides,
  };

  const useMutationImpl = vi.fn((opts?: MutationOptions) => {
    if (opts?.onSuccess) captured.onSuccess = opts.onSuccess;
    if (opts?.onError) captured.onError = opts.onError;
    if (opts?.onSettled) captured.onSettled = opts.onSettled;
    return mockReturn;
  });

  return {
    useMutationImpl,
    mutate,
    reset,
    simulateSuccess: (...args: unknown[]) => captured.onSuccess?.(...args),
    mockReturn,
  };
}

/**
 * Creates a capturable mutation AND wires it into the given tRPC resource's
 * `useMutation` in a single call. Replaces the two-line, cast-heavy pattern
 * repeated in every dialog/panel test file's `beforeEach`:
 *
 *   const updateMutation = createCapturableMutation();
 *   vi.mocked(api.orgs.update.useMutation).mockImplementation(
 *     updateMutation.useMutationImpl as never,
 *   );
 *
 * Usage:
 *   const updateMutation = wireCapturableMutation(api.orgs.update);
 *   // ... render, interact ...
 *   updateMutation.simulateSuccess();
 */
export function wireCapturableMutation(
  resource: MutationResource,
  overrides: Partial<CapturableMutation["mockReturn"]> = {},
): CapturableMutation {
  const mutation = createCapturableMutation(overrides);
  (resource.useMutation as MockInstance).mockImplementation(mutation.useMutationImpl as never);
  return mutation;
}

/**
 * Overrides an already-wired capturable mutation's returned state with
 * arbitrary partial overrides (isPending, isSuccess, isError/error, etc).
 * Single source of truth for the repeated pattern:
 *
 *   vi.mocked(api.orgs.update.useMutation).mockReturnValue({
 *     ...updateMutation.mockReturn,
 *     isPending: true,
 *   } as never);
 *
 * Usage:
 *   mockMutationState(api.orgs.update, updateMutation, { isPending: true });
 *   mockMutationState(api.orgs.update, updateMutation, { isSuccess: true });
 */
export function mockMutationState(
  resource: MutationResource,
  mutation: CapturableMutation,
  overrides: Partial<CapturableMutation["mockReturn"]>,
): void {
  (resource.useMutation as MockInstance).mockReturnValue({
    ...mutation.mockReturn,
    ...overrides,
  });
}

/** Convenience wrapper around mockMutationState for the common error-display case. */
export function mockMutationError(
  resource: MutationResource,
  mutation: CapturableMutation,
  message: string,
): void {
  mockMutationState(resource, mutation, { isError: true, error: { message } });
}
