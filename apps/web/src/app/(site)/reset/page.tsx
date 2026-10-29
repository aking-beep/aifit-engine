import { Suspense } from "react";
import { ResetForm } from "@/components/app/reset-form";

export const metadata = { title: "Reset password — AI Fit", robots: { index: false } };

export default function Page() {
  return (
    <Suspense>
      <ResetForm />
    </Suspense>
  );
}
