import { cn } from "@/lib/utils";

interface DeveloperCreditProps {
  className?: string;
}

export function DeveloperCredit({ className }: DeveloperCreditProps) {
  return (
    <p className={cn("text-[11px] leading-relaxed tracking-wide", className)}>
      Developed by <span className="font-medium">Satyajit Patri</span> from Odisha
    </p>
  );
}
