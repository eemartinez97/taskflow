/**
 * POSTs JSON to `url` and returns whether it succeeded plus the parsed
 * `{ error? }` body.
 *
 * Single source of truth for the fetch+error-shape boilerplate previously
 * duplicated across every auth form's onSubmit (register, forgot-password,
 * reset-password, complete-registration). Every route so far only ever
 * needs the `error` field, so the response shape is fixed rather than
 * generic.
 */
export async function postJson(
  url: string,
  body: unknown,
): Promise<{ ok: boolean; status: number; body: { error?: string } }> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const responseBody = (await res.json()) as { error?: string };
  return { ok: res.ok, status: res.status, body: responseBody };
}
