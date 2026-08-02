import { Suspense, type JSX } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getServerTRPC } from "@/lib/trpc/server";
import OnboardingForm from "./_components/onboarding-form";
import { Card, CardContent, CardHeader, CardTitle } from "@taskflow/ui";

export const metadata: Metadata = { title: "Create your organization" };

/**
 * True first-run bootstrap: reached ONLY when the user has zero orgs (proxy
 * lets authenticated users through; this gate redirects them to /projects
 * once they belong to at least one). Creating an ADDITIONAL org no longer
 * routes here - it's handled by CreateOrgDialog (modal, with Cancel) from the
 * sidebar switcher and the Organizations page, which is far better UX than a
 * bare page with no way back except the browser's back button.
 */
export async function OnboardingGate(): Promise<JSX.Element> {
  const trpc = await getServerTRPC();
  const orgs = await trpc.orgs.list();

  if (orgs.length > 0) {
    redirect("/projects");
  }

  return <OnboardingForm />;
}

export default function OnboardingPage(): JSX.Element {
  return (
    <Suspense
      fallback={
        <Card>
          <CardHeader>
            <CardTitle>Create your organization</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-52 animate-pulse rounded-md bg-gray-100" />
          </CardContent>
        </Card>
      }
    >
      <OnboardingGate />
    </Suspense>
  );
}
