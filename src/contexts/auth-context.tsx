"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  type User,
} from "firebase/auth";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { auth, db, COLLECTIONS, connectEmulators } from "@/lib/firebase/client";
import type { UserProfile, UserRole } from "@/types";
import { hasPermission, type Permission } from "@/lib/rbac/permissions";
import { getAllDemoUserEntries, isDemoMode } from "@/lib/demo/data";
import {
  clearSession,
  establishSession,
  precheckLogin,
  reportLoginFailure,
} from "@/lib/services/auth";
import { SESSION_IDLE_TIMEOUT_MS, SESSION_REFRESH_INTERVAL_MS } from "@/constants/auth";
import { logActivity } from "@/lib/services/activity";

interface AuthContextValue {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  role: UserRole | null;
  isDemo: boolean;
  signIn: (email: string, password: string) => Promise<UserProfile>;
  signOut: () => Promise<void>;
  can: (permission: Permission | Permission[]) => boolean;
  canAll: (permissions: Permission[]) => boolean;
  refreshProfile: () => Promise<void>;
  /** Update in-memory profile after local edits (demo + optimistic). */
  patchProfile: (patch: Partial<UserProfile>) => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);
const DEMO_SESSION_KEY = "pharma_lms_demo_session";
const DEMO_LOCKOUT_KEY = "pharma_lms_demo_lockouts";

function buildBootstrapProfile(firebaseUser: User): UserProfile {
  const now = new Date().toISOString();
  const email = firebaseUser.email || "";
  return {
    id: firebaseUser.uid,
    uid: firebaseUser.uid,
    email,
    displayName: firebaseUser.displayName || email.split("@")[0] || "User",
    role: "employee",
    isActive: true,
    createdAt: now,
    updatedAt: now,
    createdBy: "bootstrap",
  };
}

function getDemoLockouts(): Record<string, { failedAttempts: number; lockedUntil: string | null }> {
  try {
    return JSON.parse(localStorage.getItem(DEMO_LOCKOUT_KEY) || "{}");
  } catch {
    return {};
  }
}

function setDemoLockout(email: string, data: { failedAttempts: number; lockedUntil: string | null }) {
  const all = getDemoLockouts();
  all[email.toLowerCase()] = data;
  localStorage.setItem(DEMO_LOCKOUT_KEY, JSON.stringify(all));
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const demo = isDemoMode();
  const lastActivityRef = useRef(Date.now());
  const idleTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchProfile = useCallback(async (firebaseUser: User) => {
    try {
      const snap = await getDoc(doc(db, COLLECTIONS.users, firebaseUser.uid));
      if (snap.exists()) {
        const data = { id: snap.id, ...snap.data() } as UserProfile;
        if (!data.role) data.role = "employee";
        if (!data.displayName) {
          data.displayName =
            firebaseUser.displayName || data.email?.split("@")[0] || "User";
        }
        setProfile(data);
        return data;
      }

      const provisional = buildBootstrapProfile(firebaseUser);
      try {
        await setDoc(doc(db, COLLECTIONS.users, firebaseUser.uid), provisional);
      } catch {
        /* rules may block */
      }
      setProfile(provisional);
      return provisional;
    } catch {
      const fallback = buildBootstrapProfile(firebaseUser);
      setProfile(fallback);
      return fallback;
    }
  }, []);

  const signOut = useCallback(async () => {
    if (demo) {
      localStorage.removeItem(DEMO_SESSION_KEY);
      setProfile(null);
      setUser(null);
      return;
    }
    try {
      await clearSession();
    } catch {
      /* ignore */
    }
    if (user) {
      void logActivity({
        userId: user.uid,
        verb: "logout",
        summary: "Signed out",
      });
    }
    await firebaseSignOut(auth);
    setProfile(null);
    setUser(null);
  }, [demo, user]);

  // Idle session timeout
  useEffect(() => {
    if (demo || !user) return;

    const bump = () => {
      lastActivityRef.current = Date.now();
    };
    const events = ["mousedown", "keydown", "touchstart", "scroll"] as const;
    events.forEach((e) => window.addEventListener(e, bump, { passive: true }));

    idleTimerRef.current = setInterval(() => {
      if (Date.now() - lastActivityRef.current >= SESSION_IDLE_TIMEOUT_MS) {
        void logActivity({
          userId: user.uid,
          verb: "session_expired",
          summary: "Signed out due to inactivity",
        });
        void signOut();
      }
    }, 30_000);

    return () => {
      events.forEach((e) => window.removeEventListener(e, bump));
      if (idleTimerRef.current) clearInterval(idleTimerRef.current);
    };
  }, [demo, user, signOut]);

  // Keep client ID token warm. Do NOT recreate the httpOnly session cookie on
  // every refresh — Firebase createSessionCookie requires a recent sign-in and
  // otherwise returns 401 ("Invalid or expired token").
  useEffect(() => {
    if (demo) return;

    const refresh = setInterval(async () => {
      if (!auth.currentUser) return;
      try {
        await auth.currentUser.getIdToken(true);
      } catch {
        /* ignore */
      }
    }, SESSION_REFRESH_INTERVAL_MS);

    return () => {
      clearInterval(refresh);
    };
  }, [demo]);

  useEffect(() => {
    if (demo) {
      try {
        const raw = localStorage.getItem(DEMO_SESSION_KEY);
        if (raw) {
          const p = JSON.parse(raw) as UserProfile;
          setProfile(p);
          setUser({ uid: p.uid, email: p.email } as User);
        }
      } catch {
        /* ignore */
      }
      setLoading(false);
      return;
    }

    connectEmulators();
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        await fetchProfile(firebaseUser);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
    return () => unsub();
  }, [demo, fetchProfile]);

  const signIn = async (email: string, password: string): Promise<UserProfile> => {
    const normalized = email.trim().toLowerCase();

    if (demo) {
      const lock = getDemoLockouts()[normalized];
      if (lock?.lockedUntil && new Date(lock.lockedUntil).getTime() > Date.now()) {
        throw new Error(
          `Account temporarily locked. Try again after ${new Date(lock.lockedUntil).toLocaleTimeString()}.`
        );
      }

      const entry = getAllDemoUserEntries()[normalized];
      if (!entry || entry.password !== password) {
        const failedAttempts = (lock?.failedAttempts ?? 0) + 1;
        const lockedUntil =
          failedAttempts >= 5
            ? new Date(Date.now() + 15 * 60 * 1000).toISOString()
            : null;
        setDemoLockout(normalized, { failedAttempts, lockedUntil });
        if (lockedUntil) {
          throw new Error("Account locked after multiple failed attempts. Try again in 15 minutes.");
        }
        throw new Error(
          `Invalid email or password. ${5 - failedAttempts} attempt(s) remaining.`
        );
      }

      setDemoLockout(normalized, { failedAttempts: 0, lockedUntil: null });
      const now = new Date().toISOString();
      const withLogin: UserProfile = { ...entry.profile, lastLoginAt: now, updatedAt: now };
      localStorage.setItem(DEMO_SESSION_KEY, JSON.stringify(withLogin));
      setProfile(withLogin);
      setUser({ uid: withLogin.uid, email: withLogin.email } as User);
      return withLogin;
    }

    const gate = await precheckLogin(normalized);
    if (!gate.allowed) {
      throw new Error(gate.message || "Account is temporarily locked");
    }

    try {
      const cred = await signInWithEmailAndPassword(auth, normalized, password);
      const loaded = await fetchProfile(cred.user);

      if (loaded && loaded.isActive === false) {
        await firebaseSignOut(auth);
        throw new Error("Account is deactivated. Contact HR or your administrator.");
      }

      const token = await cred.user.getIdToken(true);
      const sessionResult = await establishSession(token);
      if (sessionResult.status === 403) {
        await firebaseSignOut(auth);
        throw new Error(sessionResult.error || "Account is deactivated");
      }

      const now = new Date().toISOString();
      const nextProfile: UserProfile = {
        ...(loaded || buildBootstrapProfile(cred.user)),
        lastLoginAt: now,
        updatedAt: now,
      };
      setProfile(nextProfile);
      try {
        await updateDoc(doc(db, COLLECTIONS.users, cred.user.uid), {
          lastLoginAt: now,
          updatedAt: now,
        });
      } catch {
        /* server path may have done this */
      }
      return nextProfile;
    } catch (err) {
      const code =
        err && typeof err === "object" && "code" in err
          ? String((err as { code?: string }).code)
          : "";
      let message = err instanceof Error ? err.message : "Sign in failed";

      if (code === "auth/user-not-found" || code === "auth/invalid-email") {
        message =
          "No Firebase Auth account for this user. Ask HR to onboard with Admin SDK configured, or sign in with an existing Auth email.";
      } else if (code === "auth/wrong-password" || code === "auth/invalid-credential") {
        message = "Incorrect email/username or password.";
      } else if (code === "auth/too-many-requests") {
        message = "Too many failed attempts. Try again later.";
      }

      if (
        !message.includes("deactivated") &&
        !message.includes("locked") &&
        !message.includes("temporarily locked")
      ) {
        const failure = await reportLoginFailure(normalized);
        throw new Error(failure.message || message);
      }
      throw err instanceof Error ? new Error(message) : new Error(message);
    }
  };

  const can = (permission: Permission | Permission[]) => {
    if (!profile?.role || profile.isActive === false) return false;
    const list = Array.isArray(permission) ? permission : [permission];
    return list.some((p) => hasPermission(profile.role, p));
  };

  const canAll = (permissions: Permission[]) => {
    if (!profile?.role || profile.isActive === false) return false;
    return permissions.every((p) => hasPermission(profile.role, p));
  };

  const refreshProfile = async () => {
    if (demo || !user) return;
    await fetchProfile(user);
  };

  const patchProfile = (patch: Partial<UserProfile>) => {
    setProfile((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...patch };
      if (demo) {
        localStorage.setItem(DEMO_SESSION_KEY, JSON.stringify(next));
      }
      return next;
    });
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        role: profile?.role ?? null,
        isDemo: demo,
        signIn,
        signOut,
        can,
        canAll,
        refreshProfile,
        patchProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
