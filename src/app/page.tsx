import Link from "next/link";
import { ArrowRight, Shield, FileCheck, Award, ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-cyan-50 via-slate-50 to-slate-100 dark:from-slate-900 dark:via-slate-950 dark:to-black">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2 font-semibold tracking-tight">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
            PL
          </div>
          PharmaLMS
        </div>
        <Button asChild>
          <Link href="/login">
            Sign in <ArrowRight className="ml-1 h-4 w-4" />
          </Link>
        </Button>
      </header>

      <main className="mx-auto max-w-6xl px-6 pb-20 pt-16 md:pt-24">
        <div className="max-w-2xl space-y-6 animate-fade-in">
          <p className="text-sm font-medium uppercase tracking-widest text-primary">
            Pharmaceutical Training Platform
          </p>
          <h1 className="text-4xl font-bold tracking-tight text-foreground md:text-5xl lg:text-6xl">
            PharmaLMS
          </h1>
          <p className="text-lg text-muted-foreground md:text-xl">
            GMP-compliant learning management — induction to certification, with SOP version
            control and full audit trails.
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <Button size="lg" asChild>
              <Link href="/login">Enter workspace</Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/verify">Verify certificate</Link>
            </Button>
          </div>
        </div>

        <div className="mt-20 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
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
              className="rounded-lg border bg-card/80 p-5 backdrop-blur transition-shadow hover:shadow-md"
            >
              <f.icon className="mb-3 h-6 w-6 text-primary" />
              <h3 className="font-semibold">{f.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
