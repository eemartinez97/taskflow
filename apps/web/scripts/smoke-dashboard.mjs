// Headless-browser smoke check for compose-smoke.yml. Unlike a plain curl,
// this runs a real Chromium instance against the full docker-compose stack
// (through nginx) so a client-side hydration crash or a broken bundle would
// fail this even if the server-rendered HTML that curl sees looks fine.
//
// /projects is the dashboard's landing page ((dashboard)/projects/page.tsx -
// the route GROUP "(dashboard)" itself never appears in the URL) and sits
// behind (dashboard)/layout.tsx's session guard, so we don't log in here -
// we only assert that opening it redirects to /login and that /login itself
// renders its real content, proving the whole Next.js SSR + hydration
// pipeline works end-to-end through nginx.
import { chromium } from "@playwright/test";

const baseURL = process.env.SMOKE_BASE_URL ?? "http://localhost";

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const consoleErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => consoleErrors.push(String(error)));

  try {
    const response = await page.goto(`${baseURL}/projects`, { waitUntil: "networkidle" });
    if (!response || !response.ok()) {
      throw new Error(`GET /projects returned ${response ? response.status() : "no response"}`);
    }
    if (!page.url().includes("/login")) {
      throw new Error(`Expected unauthenticated /projects to redirect to /login, landed on ${page.url()}`);
    }

    const emailField = page.getByLabel(/^email/i);
    await emailField.waitFor({ state: "visible", timeout: 10_000 });

    if (consoleErrors.length > 0) {
      throw new Error(`Console errors while rendering /login:\n${consoleErrors.join("\n")}`);
    }

    console.log(`[smoke-dashboard] OK - ${baseURL}/projects redirected to ${page.url()} and rendered cleanly.`);
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error("[smoke-dashboard] FAILED:", error);
  process.exit(1);
});
