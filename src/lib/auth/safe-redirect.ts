/**
 * Allow only same-origin relative paths after login (blocks open redirects).
 */
export function safeInternalPath(
  value: string | null | undefined,
  fallback = "/dashboard"
): string {
  if (!value) return fallback;
  let path = value.trim();
  try {
    path = decodeURIComponent(path);
  } catch {
    return fallback;
  }
  if (!path.startsWith("/") || path.startsWith("//") || path.startsWith("/\\")) {
    return fallback;
  }
  if (path.includes("\\") || path.includes("://")) return fallback;
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(path)) return fallback;
  if (path === "/login" || path.startsWith("/login?")) return fallback;
  return path;
}
