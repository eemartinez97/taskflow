import type { JSX, ReactNode } from "react";
import { Button } from "react-email";

export interface EmailButtonProps {
  href: string;
  children: ReactNode;
}

/** Shared CTA button style for every TaskFlow email. */
export function EmailButton({ href, children }: EmailButtonProps): JSX.Element {
  return (
    <Button
      href={href}
      className="mt-2 box-border block rounded-md bg-indigo-600 px-5 py-3 text-center font-medium text-white no-underline"
    >
      {children}
    </Button>
  );
}
