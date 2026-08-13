import { type MockInstance, vi } from "vitest";
import { makeProject } from "@/tests/support/factories";
import { api } from "@/lib/trpc/client";

// -- Query result mock factory --

export interface MockQueryResult<T> {
  data: T | undefined;
  isLoading: boolean;
  isPending: boolean;
  isFetching: boolean;
  isError: boolean;
  isSuccess: boolean;
  error: null;
  refetch: ReturnType<typeof vi.fn>;
}

export function makeMockQueryResult<T>(
  data?: T,
  overrides: Partial<MockQueryResult<T>> = {},
): MockQueryResult<T> {
  return {
    data,
    isLoading: false,
    isPending: false,
    isFetching: false,
    isError: false,
    isSuccess: true,
    error: null,
    refetch: vi.fn(),
    ...overrides,
  };
}

// -- Mutation result mock factory --

export interface MockMutationResult<T = unknown> {
  mutate: ReturnType<typeof vi.fn>;
  mutateAsync: ReturnType<typeof vi.fn>;
  isPending: boolean;
  isError: boolean;
  isSuccess: boolean;
  error: Error | null;
  data: T | undefined;
  reset: ReturnType<typeof vi.fn>;
}

export function makeMockMutationResult<T = unknown>(
  overrides: Partial<MockMutationResult<T>> = {},
): MockMutationResult<T> {
  return {
    mutate: vi.fn(),
    mutateAsync: vi.fn().mockResolvedValue(undefined),
    isPending: false,
    isError: false,
    isSuccess: false,
    error: null,
    data: undefined,
    reset: vi.fn(),
    ...overrides,
  };
}

/** Internal structural types - callers pass the resource object directly. */
interface QueryResource {
  useQuery: unknown;
}
interface MutationResource {
  useMutation: unknown;
}

/**
 * Mocks a tRPC `useQuery` hook and sets its return value in one call.
 * Accepts any tRPC resource object (e.g. `api.orgs.list`) directly.
 *
 * Usage:
 *   mockUseQuery(api.orgs.list, [org1, org2]);
 *   mockUseQuery(api.auth.me, user, { isPending: true });
 */
export function mockUseQuery<T>(
  resource: QueryResource,
  data?: T,
  overrides?: Partial<MockQueryResult<T>>,
): MockQueryResult<T> {
  const result = makeMockQueryResult<T>(data, overrides);
  (resource.useQuery as MockInstance).mockReturnValue(result);
  return result;
}

/**
 * Wires a factory-driven implementation into `api.useQueries`.
 */
export function mockUseQueries(returnValues: { data: unknown[] | undefined }[]): void {
  vi.mocked(api.useQueries).mockImplementation(makeUseQueriesMock(returnValues) as never);
}

/**
 * Wires a server tRPC mock into `getServerTRPC`.
 *
 * Usage:
 *   mockGetServerTRPC(vi.mocked(getServerTRPC), { orgs: { list: vi.fn().mockResolvedValue([]) } });
 */
export function mockGetServerTRPC(
  mock: MockInstance,
  overrides: ServerTRPCMockOverrides = {},
): void {
  mock.mockResolvedValue(buildServerTRPCMock(overrides));
}

/**
 * Wires a mock mutation result into the given tRPC resource's `useMutation`
 * and returns it for assertions.
 */
export function mockUseMutationResult<T = unknown>(
  resource: MutationResource,
  overrides: Partial<MockMutationResult<T>> = {},
): MockMutationResult<T> {
  const result = makeMockMutationResult<T>(overrides);
  (resource.useMutation as MockInstance).mockReturnValue(result);
  return result;
}

// -- Mutation callback capture --

export interface MutationMockResult {
  mutateMock: ReturnType<typeof vi.fn>;
  triggerSuccess: (data?: unknown, vars?: unknown) => void;
  triggerError: (err: { message: string }) => void;
}

/**
 * Sets up a `useMutation` mock that captures `onSuccess` and `onError`
 * callbacks passed to `useMutation(options)` so tests can trigger them programmatically.
 */
export function setupMutationMock(resource: MutationResource): MutationMockResult {
  let capturedOnSuccess: ((data?: unknown, vars?: unknown) => void) | undefined;
  let capturedOnError: ((err: { message: string }) => void) | undefined;

  const mutateMock = vi.fn();

  (resource.useMutation as MockInstance).mockImplementation(
    (options?: {
      onSuccess?: (data?: unknown, vars?: unknown) => void;
      onError?: (err: { message: string }) => void;
    }) => {
      capturedOnSuccess = options?.onSuccess;
      capturedOnError = options?.onError;
      return {
        mutate: mutateMock,
        mutateAsync: vi.fn().mockResolvedValue(undefined),
        isPending: false,
        isError: false,
        error: null,
        data: undefined,
        reset: vi.fn(),
      };
    },
  );

  return {
    mutateMock,
    triggerSuccess(data?: unknown, vars?: unknown) {
      if (!capturedOnSuccess)
        throw new Error("onSuccess not captured - render the component first");
      capturedOnSuccess(data, vars);
    },
    triggerError(err) {
      if (!capturedOnError) throw new Error("onError not captured - render the component first");
      capturedOnError(err);
    },
  };
}

/**
 * Variant of setupMutationMock for mutations where the component passes
 * callbacks directly to mutate(vars, { onSettled }) instead of useMutation({ onSettled }).
 *
 * The onSettled callback passed to mutate() is invoked immediately,
 * simulating synchronous mutation completion in tests.
 *
 * WHY the internal `as never`:
 * UseMutateFunction's second parameter is MutateOptions<TData, TError, TVariables, TContext>
 * whose onSettled signature requires 4+ arguments. Importing those tRPC internal
 * types would tightly couple the test helper to the router. The cast lives here
 * once, not scattered across test files.
 */
export function setupMutationMockWithMutateCallbacks(
  resource: MutationResource,
): MutationMockResult {
  const mutateMock = vi.fn();
  let capturedOnSuccess: ((data?: unknown, vars?: unknown) => void) | undefined;
  let capturedOnError: ((err: { message: string }) => void) | undefined;

  (resource.useMutation as MockInstance).mockImplementation(
    (opts?: {
      onSuccess?: (data?: unknown, vars?: unknown) => void;
      onError?: (err: { message: string }) => void;
    }) => {
      capturedOnSuccess = opts?.onSuccess;
      capturedOnError = opts?.onError;
      return {
        mutate: (_vars: unknown, callOpts?: { onSettled?: () => void }) => {
          mutateMock();
          callOpts?.onSettled?.();
        },
        mutateAsync: vi.fn(),
        isPending: false,
        isError: false,
        error: null,
        data: undefined,
        reset: vi.fn(),
      };
    },
  );

  return {
    mutateMock,
    triggerSuccess(data?: unknown, vars?: unknown) {
      if (!capturedOnSuccess)
        throw new Error("onSuccess not captured - render the component first");
      capturedOnSuccess(data, vars);
    },
    triggerError(err) {
      if (!capturedOnError) throw new Error("onError not captured - render the component first");
      capturedOnError(err);
    },
  };
}

/**
 * Extracts the options object passed to the LAST `useMutation(options)` call
 * on a mocked tRPC mutation hook.
 */
// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- TOptions
export function getLastMutationOptions<TOptions extends object>(
  resource: MutationResource,
): TOptions {
  const mock = resource.useMutation as MockInstance;
  const options = mock.mock.calls.at(-1)?.[0] as TOptions | undefined;
  if (!options) throw new Error("useMutation was never called - render the component first");
  return options;
}

// -- Mock API Utils --

type MockFn = ReturnType<typeof vi.fn>;

interface UtilsInvalidate {
  invalidate: MockFn;
  setData: MockFn;
  getData: MockFn;
  cancel: MockFn;
}

/** Typed shape matching the api.useUtils() implementation in tests/mocks/trpc-api.tsx. */
export interface MockApiUtils {
  invalidate: MockFn;
  orgs: { list: UtilsInvalidate; members: UtilsInvalidate; formerAssignees: UtilsInvalidate };
  invitations: { listForOrg: UtilsInvalidate; listMine: UtilsInvalidate };
  projects: { list: UtilsInvalidate };
  boards: { list: UtilsInvalidate; get: UtilsInvalidate };
  tasks: {
    list: UtilsInvalidate;
    get: UtilsInvalidate;
    myTasks: UtilsInvalidate;
    labels: UtilsInvalidate;
    labelsByProject: UtilsInvalidate;
  };
  comments: { list: UtilsInvalidate };
  labels: { list: UtilsInvalidate };
  notifications: { list: UtilsInvalidate };
}

/**
 * Returns the last value yielded by api.useUtils().
 * Centralizes the cast so individual test files stay free of inline type assertions.
 */
export function getLastMockUtils(): MockApiUtils {
  const result = vi.mocked(api.useUtils).mock.results.at(-1);
  if (!result) throw new Error("api.useUtils was never called - render the component first");
  return result.value as MockApiUtils;
}

// -- useQueries mock factory --

type UseQueriesFactory = (t: { tasks: { list: ReturnType<typeof vi.fn> } }) => unknown;

export function makeUseQueriesMock(
  returnValues: { data: unknown[] | undefined }[],
): (factory: UseQueriesFactory) => { data: unknown[] | undefined }[] {
  return (factory: UseQueriesFactory) => {
    const builder = {
      tasks: {
        list: vi.fn(
          (_input: { orgId: string; columnId: string }, opts?: { initialData?: unknown[] }) => ({
            queryKey: ["tasks", "list"],
            queryFn: (): unknown[] => opts?.initialData ?? [],
            initialData: opts?.initialData,
          }),
        ),
      },
    };
    try {
      factory(builder);
    } catch {
      // Builder invocation may throw in some test scenarios - swallow intentionally
    }
    return returnValues;
  };
}

// -- Server tRPC mock factory --

export interface ServerTRPCMockOverrides {
  auth?: { checkResetToken?: ReturnType<typeof vi.fn> };
  orgs?: { list?: ReturnType<typeof vi.fn>; members?: ReturnType<typeof vi.fn> };
  invitations?: {
    listForOrg?: ReturnType<typeof vi.fn>;
    getByToken?: ReturnType<typeof vi.fn>;
    getByTokenPublic?: ReturnType<typeof vi.fn>;
  };
  projects?: { list?: ReturnType<typeof vi.fn>; get?: ReturnType<typeof vi.fn> };
  boards?: {
    getByProject?: ReturnType<typeof vi.fn>;
    list?: ReturnType<typeof vi.fn>;
    get?: ReturnType<typeof vi.fn>;
  };
  tasks?: { list?: ReturnType<typeof vi.fn>; myTasks?: ReturnType<typeof vi.fn> };
  labels?: { list?: ReturnType<typeof vi.fn> };
}

export interface ServerTRPCMock {
  auth: { checkResetToken: ReturnType<typeof vi.fn> };
  orgs: { list: ReturnType<typeof vi.fn>; members: ReturnType<typeof vi.fn> };
  invitations: {
    listForOrg: ReturnType<typeof vi.fn>;
    getByToken: ReturnType<typeof vi.fn>;
    getByTokenPublic: ReturnType<typeof vi.fn>;
  };
  projects: { list: ReturnType<typeof vi.fn>; get: ReturnType<typeof vi.fn> };
  boards: {
    getByProject: ReturnType<typeof vi.fn>;
    list: ReturnType<typeof vi.fn>;
    get: ReturnType<typeof vi.fn>;
  };
  tasks: { list: ReturnType<typeof vi.fn>; myTasks: ReturnType<typeof vi.fn> };
  labels: { list: ReturnType<typeof vi.fn> };
}

function buildServerTRPCMock(overrides: ServerTRPCMockOverrides = {}): ServerTRPCMock {
  return {
    auth: {
      checkResetToken: vi.fn().mockResolvedValue({ valid: false }),
      ...overrides.auth,
    },
    orgs: {
      list: vi.fn().mockResolvedValue([]),
      members: vi.fn().mockResolvedValue([]),
      ...overrides.orgs,
    },
    invitations: {
      listForOrg: vi.fn().mockResolvedValue([]),
      getByToken: vi.fn().mockResolvedValue(null),
      getByTokenPublic: vi.fn().mockResolvedValue(null),
      ...overrides.invitations,
    },
    projects: {
      list: vi.fn().mockResolvedValue([]),
      get: vi.fn().mockResolvedValue(makeProject()),
      ...overrides.projects,
    },
    boards: {
      getByProject: vi.fn().mockResolvedValue(null),
      list: vi.fn().mockResolvedValue([]),
      get: vi.fn().mockResolvedValue(null),
      ...overrides.boards,
    },
    tasks: {
      list: vi.fn().mockResolvedValue([]),
      myTasks: vi.fn().mockResolvedValue([]),
      ...overrides.tasks,
    },
    labels: {
      list: vi.fn().mockResolvedValue([]),
      ...overrides.labels,
    },
  };
}

// -- api.useUtils() full-tree mock builder --

function makeUtilsInvalidate(overrides: Partial<UtilsInvalidate> = {}): UtilsInvalidate {
  return {
    invalidate: vi.fn(),
    setData: vi.fn(),
    getData: vi.fn(),
    cancel: vi.fn(),
    ...overrides,
  };
}

/** Deep-partial override shape accepted by mockApiUtils(). */
export interface MockApiUtilsOverrides {
  orgs?: {
    list?: Partial<UtilsInvalidate>;
    members?: Partial<UtilsInvalidate>;
    formerAssignees?: Partial<UtilsInvalidate>;
  };
  invitations?: { listForOrg?: Partial<UtilsInvalidate>; listMine?: Partial<UtilsInvalidate> };
  projects?: { list?: Partial<UtilsInvalidate> };
  boards?: { list?: Partial<UtilsInvalidate>; get?: Partial<UtilsInvalidate> };
  tasks?: {
    list?: Partial<UtilsInvalidate>;
    get?: Partial<UtilsInvalidate>;
    myTasks?: Partial<UtilsInvalidate>;
    labels?: Partial<UtilsInvalidate>;
    labelsByProject?: Partial<UtilsInvalidate>;
  };
  comments?: { list?: Partial<UtilsInvalidate> };
  labels?: { list?: Partial<UtilsInvalidate> };
  notifications?: { list?: Partial<UtilsInvalidate> };
  invalidate?: MockFn;
}

/**
 * Builds the full `api.useUtils()` return shape and wires it into the
 * mocked hook in one call. Only the leaves a test actually asserts on need
 * to be passed as overrides — every other branch defaults to a fresh, inert
 * set of vi.fn() spies. Replaces the ~25-line hand-rolled object (with
 * `as never` casts) that used to be repeated in every test file's beforeEach.
 *
 * Usage:
 *   const invalidateOrgsList = vi.fn();
 *   mockApiUtils({ orgs: { list: { invalidate: invalidateOrgsList } } });
 *   // ...render, interact, mutation.simulateSuccess()...
 *   expect(invalidateOrgsList).toHaveBeenCalled();
 */
export function mockApiUtils(overrides: MockApiUtilsOverrides = {}): MockApiUtils {
  const result: MockApiUtils = {
    invalidate: overrides.invalidate ?? vi.fn(),
    orgs: {
      list: makeUtilsInvalidate(overrides.orgs?.list),
      members: makeUtilsInvalidate(overrides.orgs?.members),
      formerAssignees: makeUtilsInvalidate(overrides.orgs?.formerAssignees),
    },
    invitations: {
      listForOrg: makeUtilsInvalidate(overrides.invitations?.listForOrg),
      listMine: makeUtilsInvalidate(overrides.invitations?.listMine),
    },
    projects: { list: makeUtilsInvalidate(overrides.projects?.list) },
    boards: {
      list: makeUtilsInvalidate(overrides.boards?.list),
      get: makeUtilsInvalidate(overrides.boards?.get),
    },
    tasks: {
      list: makeUtilsInvalidate(overrides.tasks?.list),
      get: makeUtilsInvalidate(overrides.tasks?.get),
      myTasks: makeUtilsInvalidate(overrides.tasks?.myTasks),
      labels: makeUtilsInvalidate(overrides.tasks?.labels),
      labelsByProject: makeUtilsInvalidate(overrides.tasks?.labelsByProject),
    },
    comments: { list: makeUtilsInvalidate(overrides.comments?.list) },
    labels: { list: makeUtilsInvalidate(overrides.labels?.list) },
    notifications: { list: makeUtilsInvalidate(overrides.notifications?.list) },
  };
  vi.mocked(api.useUtils).mockReturnValue(result as unknown as ReturnType<typeof api.useUtils>);
  return result;
}
