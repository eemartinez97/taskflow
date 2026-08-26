import type { Metadata } from "next";
import type { JSX } from "react";

import { ProfileForm } from "../_components/profile-form";

export const metadata: Metadata = { title: "Profile" };

export default function ProfileSettingsPage(): JSX.Element {
  return (
    <>
      <h2 className="text-lg font-semibold text-gray-900">Profile</h2>
      <ProfileForm />
    </>
  );
}
