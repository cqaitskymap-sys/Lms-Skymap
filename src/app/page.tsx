import Link from "next/link";
import { ArrowRight, Shield, FileCheck, Award, ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DeveloperCredit } from "@/components/shared/developer-credit";

export default function HomePage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-100 dark:bg-slate-950">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/brand/landing-bg.jpg"
        alt=""
        className="pointer-events-none absolute inset-0 h-full w-full object-cover"
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-white/92 via-white/78 to-white/40 dark:from-slate-950/90 dark:via-slate-950/75 dark:to-slate-950/45" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/30 via-transparent to-white/70 dark:from-slate-950/20 dark:to-slate-950/80" />

      <header className="relative mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2 font-semibold tracking-tight">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/skymap-logo.png"
            alt="SKYMAP"
            className="h-10 w-auto max-w-[180px] object-contain"
          />
        </div>
        <Button asChild className="rounded-full shadow-soft">
          <Link href="/login">
            Sign in <ArrowRight className="ml-1 h-4 w-4" />
          </Link>
        </Button>
      </header>

      <main className="relative mx-auto max-w-6xl px-6 pb-20 pt-16 md:pt-24">
        <div className="max-w-2xl space-y-6 animate-fade-in">
          <p className="inline-flex items-center rounded-full border border-primary/15 bg-white/70 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-primary shadow-sm backdrop-blur-md">
            Pharmaceutical Training Platform
          </p>
          <h1 className="font-display text-5xl font-semibold leading-[1.05] tracking-tight text-foreground drop-shadow-sm md:text-6xl lg:text-7xl">
            PharmaLMS
          </h1>
          <p className="max-w-xl text-lg leading-relaxed text-slate-600 md:text-xl dark:text-slate-300">
            GMP-compliant learning management — induction to certification, with SOP version
            control and full audit trails.
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <Button size="lg" className="rounded-full px-7 shadow-soft" asChild>
              <Link href="/login">Enter workspace</Link>
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="rounded-full bg-white/80 px-7 backdrop-blur-md"
              asChild
            >
              <Link href="/verify">Verify certificate</Link>
            </Button>
          </div>
        </div>

        <div className="mt-20 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              icon: Shield,
              title: "Role-based access",
              desc: "Super Admin, HR, QA, Dept Head, Trainer, Employee",
            },
            {
              icon: FileCheck,
              title: "SOP version control",
              desc: "Approve revisions and auto-reassign affected trainees",
            },
            {
              icon: ClipboardList,
              title: "Timed assessments",
              desc: "Randomized MCQs with pass/fail and retraining loops",
            },
            {
              icon: Award,
              title: "QR certificates",
              desc: "Digital signatures and public verification links",
            },
          ].map((f) => (
            <div
              key={f.title}
              className="group rounded-2xl border border-white/70 bg-white/80 p-5 shadow-soft backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:shadow-lift dark:border-white/10 dark:bg-slate-900/60"
            >
              <div className="mb-4 inline-flex rounded-xl bg-primary/10 p-2.5 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="font-semibold tracking-tight">{f.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </main>

      <footer className="relative mx-auto flex max-w-6xl flex-col gap-1 px-6 pb-8 pt-4 text-slate-500">
        <p className="text-xs">© 2026 SKYMAP · PharmaLMS</p>
        <DeveloperCredit />
      </footer>
    </div>
  );
}
