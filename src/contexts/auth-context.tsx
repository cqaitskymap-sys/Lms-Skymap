"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  type User,
} from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db, COLLECTIONS, connectEmulators } from "@/lib/firebase/client";
import type { UserProfile, UserRole } from "@/types";
import { hasPermission, type Permission } from "@/lib/rbac/permissions";
import { DEMO_USERS, isDemoMode } from "@/lib/demo/data";

interface AuthContextValue {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  role: UserRole | null;
  isDemo: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  can: (permission: Permission) => boolean;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);
const DEMO_SESSION_KEY = "pharma_lms_demo_session";

function buildBootstrapProfile(firebaseUser: User): UserProfile {
  const now = new Date().toISOString();
  const email = firebaseUser.email || "";
  return {
    id: firebaseUser.uid,
    uid: firebaseUser.uid,
    email,
    displayName:
      firebaseUser.displayName ||
      email.split("@")[0] ||
      "User",
    role: "super_admin",
    isActive: true,
    createdAt: now,
    updatedAt: now,
    createdBy: "bootstrap",
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const demo = isDemoMode();

  const fetchProfile = useCallback(async (firebaseUser: User) => {
    try {
      const snap = await getDoc(doc(db, COLLECTIONS.users, firebaseUser.uid));
      if (snap.exists()) {
        const data = { id: snap.id, ...snap.data() } as UserProfile;
        // Ensure role always present for sidebar
        if (!data.role) data.role = "super_admin";
        if (!data.displayName) {
          data.displayName =
            firebaseUser.displayName || data.email?.split("@")[0] || "User";
        }
        setProfile(data);
        return;
      }

      // First login: create Firestore profile so RBAC / sidebar work
      const provisional = buildBootstrapProfile(firebaseUser);
      try {
        await setDoc(doc(db, COLLECTIONS.users, firebaseUser.uid), provisional);
      } catch {
        // Rules may block create — still use in-memory profile for UI
      }
      setProfile(provisional);
    } catch {
      // Firestore unavailable / rules — keep UI usable
      setProfile(buildBootstrapProfile(firebaseUser));
    }
  }, []);

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

  const signIn = async (email: string, password: string) => {
    if (demo) {
      const entry = DEMO_USERS[email.toLowerCase()];
      if (!entry || entry.password !== password) {
        throw new Error("Invalid email or password");
      }
      localStorage.setItem(DEMO_SESSION_KEY, JSON.stringify(entry.profile));
      setProfile(entry.profile);
      setUser({ uid: entry.profile.uid, email: entry.profile.email } as User);
      return;
    }
    const cred = await signInWithEmailAndPassword(auth, email, password);
    await fetchProfile(cred.user);
  };

  const signOut = async () => {
    if (demo) {
      localStorage.removeItem(DEMO_SESSION_KEY);
      setProfile(null);
      setUser(null);
      return;
    }
    await firebaseSignOut(auth);
    setProfile(null);
  };

  const can = (permission: Permission) => {
    if (!profile?.role) return false;
    return hasPermission(profile.role, permission);
  };

  const refreshProfile = async () => {
    if (demo || !user) return;
    await fetchProfile(user);
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
        refreshProfile,
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
