import type { ReactElement } from "react";
import { render, toPlainText } from "react-email";
import type { EmailSender } from "./types";
import { EmailDeliveryError } from "./errors";

interface RenderAndSendEmailParams {
  sender: EmailSender;
  to: string;
  subject: string;
  element: ReactElement;
  /** Used in the thrown error message, e.g. "verification email". */
  failureContext: string;
}

/**
 * Renders `element` to html ONCE and derives the plain-text alternative from
 * that html via toPlainText - calling render(element, { plainText: true })
 * separately would re-run the full ReactDOMServer render pass over the same
 * tree just to reach the same html-to-text conversion step internally.
 *
 * Single source of truth for the render+send+throw-on-failure scaffold
 * shared by every "send an email" function.
 */
export async function renderAndSendEmail({
  sender,
  to,
  subject,
  element,
  failureContext,
}: RenderAndSendEmailParams): Promise<void> {
  const html = await render(element);
  const text = toPlainText(html);

  const result = await sender.send({ to, subject, html, text });
  if (!result.success) {
    throw new EmailDeliveryError(
      `Failed to send ${failureContext}: ${result.error ?? "unknown error"}`,
    );
  }
}
