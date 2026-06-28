/**
 * Mock for `next/link` - replaces Next.js `<Link>` with a `<a>`
 * during unit tests so components that use it don't require de full
 * Next.js router context.
 *
 * Activate per test file:
 *   vi.mock("next/link", () => import("../mocks/next-link.js"))
 */

import type { JSX } from "react";

export default function MockLink({
  href,
  children,
  className,
  ...rest
}: React.AnchorHTMLAttributes<HTMLAnchorElement>): JSX.Element {
  return (
    <a href={href} className={className} {...rest}>
      {children}
    </a>
  );
}
