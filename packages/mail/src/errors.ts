/**
 * Thrown by renderAndSendEmail when the underlying EmailSender reports
 * failure (`result.success === false`) - as opposed to any other exception
 * (a network/DB error before the send was even attempted). Callers that
 * apply a rate-limit "refund on failure" policy need this distinction: an
 * infra hiccup upstream of the send should refund the caller's quota, but a
 * failed send itself should not, or an attacker can drain send quota for
 * free by triggering send failures (e.g. exhausting the provider's own rate
 * limit) - see apps/web's auth routes for the consuming side of this.
 */
export class EmailDeliveryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EmailDeliveryError";
  }
}
