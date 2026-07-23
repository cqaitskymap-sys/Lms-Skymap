import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/** Re-export for shadcn compatibility */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
