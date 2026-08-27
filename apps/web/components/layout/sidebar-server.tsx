import { cookies } from "next/headers";
import type { JSX } from "react";

import {
  SIDEBAR_COLLAPSE_COOKIE,
  parseSidebarCollapsed,
} from "@/lib/utils/sidebar-collapse-cookie";
import { Sidebar } from "./sidebar";

/**
 * Reads the sidebar-collapsed cookie server-side and passes it into Sidebar
 * as `initialCollapsed`, matching whatever the server actually renders so
 * hydration doesn't flash from expanded to collapsed (or vice versa) for a
 * returning user. Kept as its own async component (rather than inlined in
 * the dashboard layout) so the dynamic `cookies()` read stays scoped to its
 * own <Suspense> boundary - see app/(dashboard)/layout.tsx - and so it's
 * independently testable via the same await-then-render pattern used for
 * SettingsLayout, instead of needing an async component inside another
 * component's JSX tree (unsupported by the plain client renderer tests run
 * under).
 *
 * Imports the cookie name/parser from `sidebar-collapse-cookie.ts`, NOT from
 * `use-sidebar-collapse.ts` - that hook file is "use client" (it uses
 * useSyncExternalStore), and Next's bundler pulls a Server Component's
 * entire import chain into the client build the moment it imports anything
 * from a "use client" module, which fails the build outright when that
 * module also imports a client-only React API.
 */
export async function SidebarServer(): Promise<JSX.Element> {
  const cookieStore = await cookies();
  const initialCollapsed = parseSidebarCollapsed(cookieStore.get(SIDEBAR_COLLAPSE_COOKIE)?.value);
  return <Sidebar initialCollapsed={initialCollapsed} />;
}
