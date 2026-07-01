import type { Metadata } from "next";
import type { JSX } from "react";

import { Providers } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "TaskFlow",
    template: "%s - TaskFlow",
  },
  description: "Project management with real-time collaboration and Kanban boards.",
};

/**
 * Root layout - HTML shell.
 * Server Component: no "use client" directive.
 *
 * <Providers> wraps children in the NextAuth v4 SessionProvider
 * (and later tRPC + ReactQuery)
 */
export default function RootLayout({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-white font-sans antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
