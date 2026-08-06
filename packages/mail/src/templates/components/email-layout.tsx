import type { ReactNode, JSX } from "react";
import { Body, Container, Head, Hr, Html, Preview, Tailwind, Text } from "react-email";

export interface EmailLayoutProps {
  previewText: string;
  children: ReactNode;
}

/** Shared shell for every TaskFlow email - single source of truth for branding. */
export function EmailLayout({ previewText, children }: EmailLayoutProps): JSX.Element {
  return (
    <Html lang="en">
      <Head />
      <Preview>{previewText}</Preview>
      <Tailwind>
        <Body className="bg-gray-50 font-sans">
          <Container className="mx-auto max-w-xl px-4 py-12">
            <Text className="text-xl font-bold text-gray-900">TaskFlow</Text>
            <div className="mt-6 rounded-lg bg-white p-6 shadow-sm">{children}</div>
            <Hr className="my-8 border-gray-200" />
            <Text className="text-xs text-gray-400">
              TaskFlow - Project management with real-time collaboration.
            </Text>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}
