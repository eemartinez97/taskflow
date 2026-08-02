import superjson, { type SuperJSONResult } from "superjson";

/**
 * Shapes of the JSON envelope produced by the tRPC Express adapter over HTTP.
 * Centralized so unit (error branch) and integration (success branch) tests
 * share one source of truth instead of re-declaring the shape inline.
 */

/** Success envelope: `result.data` is a SuperJSON-serialized payload. */
export interface TRPCHttpSuccess {
  result: { data: SuperJSONResult };
}

/** Error envelope: `error.json.data` carries the code and optional cause. */
export interface TRPCHttpError {
  error: { json: { data: { code: string; cause: { message: string } | null } } };
}

/** Narrows a supertest response body to the error envelope. */
export const trpcError = (res: { body: unknown }): TRPCHttpError => res.body as TRPCHttpError;

/**
 * Deserializes the SuperJSON `result.data` of a success envelope.
 * Returns `unknown` on purpose: the caller owns the assertion (toMatchObject),
 * so a generic type parameter here would only be a disguised cast.
 */
export function trpcResult(body: unknown): unknown {
  return superjson.deserialize((body as TRPCHttpSuccess).result.data);
}
