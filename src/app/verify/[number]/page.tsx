"use client";

import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import VerifyPage from "../page";

/** QR deep-link: /verify/CERT-2026-XXXXXX */
export default function VerifyByNumberPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading verifier…
        </div>
      }
    >
      <VerifyPage />
    </Suspense>
  );
}
