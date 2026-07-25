import "server-only";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { initializeApp, getApps, cert, type App, type ServiceAccount } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

type ServiceAccountJson = {
  project_id?: string;
  client_email?: string;
  private_key?: string;
};

function credentialsFilePath(): string | null {
  const raw =
    process.env.FIREBASE_ADMIN_CREDENTIALS_FILE ||
    process.env.GOOGLE_APPLICATION_CREDENTIALS ||
    "";
  if (!raw.trim()) return null;
  return resolve(process.cwd(), raw.trim());
}

function loadServiceAccountFromFile(): ServiceAccountJson | null {
  const filePath = credentialsFilePath();
  if (!filePath || !existsSync(filePath)) return null;
  try {
    return JSON.parse(readFileSync(filePath, "utf8")) as ServiceAccountJson;
  } catch (err) {
    console.error("[firebase-admin] Failed to read credentials file:", filePath, err);
    return null;
  }
}

function resolveServiceAccount(): {
  projectId: string;
  clientEmail: string;
  privateKey: string;
} | null {
  const fromFile = loadServiceAccountFromFile();
  if (fromFile?.client_email && fromFile?.private_key) {
    return {
      projectId:
        fromFile.project_id ||
        process.env.FIREBASE_ADMIN_PROJECT_ID ||
        process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
        "lms-skymap",
      clientEmail: fromFile.client_email,
      privateKey: fromFile.private_key.replace(/\\n/g, "\n"),
    };
  }

  const projectId =
    process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL?.trim();
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (projectId && clientEmail && privateKey) {
    return { projectId, clientEmail, privateKey };
  }
  return null;
}

/** True when a service account is available (env vars or credentials JSON file). */
export function isAdminConfigured(): boolean {
  return resolveServiceAccount() !== null;
}

function initAdmin(): App {
  if (getApps().length) return getApps()[0]!;

  const sa = resolveServiceAccount();
  if (sa) {
    const credential: ServiceAccount = {
      projectId: sa.projectId,
      clientEmail: sa.clientEmail,
      privateKey: sa.privateKey,
    };
    return initializeApp({
      credential: cert(credential),
      projectId: sa.projectId,
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    });
  }

  const projectId =
    process.env.FIREBASE_ADMIN_PROJECT_ID ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
    "pharma-lms-demo";
  console.warn(
    "[firebase-admin] No service account configured. Set FIREBASE_ADMIN_CREDENTIALS_FILE to your JSON path, or FIREBASE_ADMIN_CLIENT_EMAIL + FIREBASE_ADMIN_PRIVATE_KEY."
  );
  return initializeApp({ projectId });
}

let _app: App | null = null;

function getAdminApp() {
  if (!_app) _app = initAdmin();
  return _app;
}

export const adminAuth = new Proxy({} as ReturnType<typeof getAuth>, {
  get(_target, prop, receiver) {
    const auth = getAuth(getAdminApp());
    const value = Reflect.get(auth, prop, receiver);
    return typeof value === "function" ? value.bind(auth) : value;
  },
});

export const adminDb = new Proxy({} as ReturnType<typeof getFirestore>, {
  get(_target, prop, receiver) {
    const db = getFirestore(getAdminApp());
    const value = Reflect.get(db, prop, receiver);
    return typeof value === "function" ? value.bind(db) : value;
  },
});

export const adminStorage = new Proxy({} as ReturnType<typeof getStorage>, {
  get(_target, prop, receiver) {
    const storage = getStorage(getAdminApp());
    const value = Reflect.get(storage, prop, receiver);
    return typeof value === "function" ? value.bind(storage) : value;
  },
});
