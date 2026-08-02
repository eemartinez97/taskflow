import { render, type RenderOptions, type RenderResult } from "@testing-library/react";
import type { ReactElement } from "react";

/**
 * Renders a component for integration UI tests.
 * All external dependencies (tRPC, next-auth, router) are mocked
 * at the test-file level - no provider wrapper is needed here.
 */
export function renderUI(ui: ReactElement, options?: Omit<RenderOptions, "wrapper">): RenderResult {
  return render(ui, options);
}
