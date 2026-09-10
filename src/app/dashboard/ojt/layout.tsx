"use client";

import { OjtNav } from "@/components/ojt/ojt-nav";
import { RequirePermission } from "@/components/auth/require-permission";

export default function OjtLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequirePermission permission="ojt:read">
      <div className="space-y-6">
        <OjtNav />
        <p className="text-xs text-muted-foreground">
          Practical shop-floor training (demonstrate → score → sign off). This is not a classroom MCQ exam.
        </p>
        {children}
      </div>
    </RequirePermission>
  );
}
