import type { Metadata } from "next";
import type { JSX } from "react";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage(): JSX.Element {
  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-900">Settings</h2>
      <p className="mt-2 text-sm text-gray-500">Coming in a future release.</p>
    </div>
  );
}
