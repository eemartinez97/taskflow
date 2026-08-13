import { redirect } from "next/navigation";
import type { JSX } from "react";

/** /settings has no content of its own - Profile is the default section. */
export default function SettingsPage(): JSX.Element {
  redirect("/settings/profile");
}
