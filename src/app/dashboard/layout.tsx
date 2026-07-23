"use client";

import { useState } from "react";
import { AuthGuard } from "@/components/auth/auth-guard";
import { AppProviders } from "@/components/providers/app-providers";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <AppProviders>
      <AuthGuard>
        <div className="flex h-screen overflow-hidden">
          <Sidebar open={mobileOpen} onClose={() => setMobileOpen(false)} />
          <div className="flex flex-1 flex-col overflow-hidden">
            <Header onMenuClick={() => setMobileOpen(true)} />
            <main className="flex-1 overflow-y-auto bg-background p-4 md:p-6">
              <div className="mx-auto max-w-7xl animate-fade-in">{children}</div>
            </main>
          </div>
        </div>
      </AuthGuard>
    </AppProviders>
  );
}
