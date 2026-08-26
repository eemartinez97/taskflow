import type { Metadata } from "next";
import type { JSX } from "react";

import { CursorPreference } from "../_components/cursor-preference";

export const metadata: Metadata = { title: "Preferences" };

export default function PreferencesSettingsPage(): JSX.Element {
  return (
    <>
      <h2 className="text-lg font-semibold text-gray-900">Preferences</h2>
      <CursorPreference />
    </>
  );
}
