const CREDENTIALS_KEY = "skymap_remember_login";
const SESSION_PREF_KEY = "skymap_remember_session";

export type RememberedLogin = {
  identifier: string;
  password: string;
};

function canUseStorage(): boolean {
  return typeof window !== "undefined";
}

export function loadRememberedLogin(): RememberedLogin | null {
  if (!canUseStorage()) return null;
  try {
    const raw = localStorage.getItem(CREDENTIALS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<RememberedLogin>;
    if (!parsed.identifier || typeof parsed.identifier !== "string") return null;
    return {
      identifier: parsed.identifier,
      password: typeof parsed.password === "string" ? parsed.password : "",
    };
  } catch {
    return null;
  }
}

export function saveRememberedLogin(identifier: string, password: string): void {
  if (!canUseStorage()) return;
  localStorage.setItem(
    CREDENTIALS_KEY,
    JSON.stringify({ identifier, password } satisfies RememberedLogin)
  );
}

export function clearRememberedLogin(): void {
  if (!canUseStorage()) return;
  localStorage.removeItem(CREDENTIALS_KEY);
}

export function setRememberSessionPref(remember: boolean): void {
  if (!canUseStorage()) return;
  if (remember) localStorage.setItem(SESSION_PREF_KEY, "1");
  else localStorage.removeItem(SESSION_PREF_KEY);
}

export function getRememberSessionPref(): boolean {
  if (!canUseStorage()) return false;
  return localStorage.getItem(SESSION_PREF_KEY) === "1";
}
