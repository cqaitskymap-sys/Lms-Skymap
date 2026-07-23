import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, connectAuthEmulator, type Auth } from "firebase/auth";
import { getFirestore, connectFirestoreEmulator, type Firestore } from "firebase/firestore";
import { getStorage, connectStorageEmulator, type FirebaseStorage } from "firebase/storage";
import { getFunctions, connectFunctionsEmulator, type Functions } from "firebase/functions";
import { firebaseConfig } from "@/lib/firebase/config";

function createFirebaseApp(): FirebaseApp {
  if (getApps().length) return getApp();
  return initializeApp(firebaseConfig);
}

export const app = createFirebaseApp();
export const auth: Auth = getAuth(app);
export const db: Firestore = getFirestore(app);
export const storage: FirebaseStorage = getStorage(app);
export const functions: Functions = getFunctions(app);

let emulatorsConnected = false;

export function connectEmulators() {
  if (emulatorsConnected || typeof window === "undefined") return;
  if (process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR !== "true") return;

  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
  connectStorageEmulator(storage, "127.0.0.1", 9199);
  connectFunctionsEmulator(functions, "127.0.0.1", 5001);
  emulatorsConnected = true;
}

/** Firestore collection names — single source of truth */
export const COLLECTIONS = {
  users: "users",
  departments: "departments",
  employees: "employees",
  inductionModules: "induction_modules",
  inductionAssignments: "induction_assignments",
  jobDescriptions: "job_descriptions",
  tni: "training_need_identifications",
  sops: "sops",
  sopVersions: "sop_versions",
  trainers: "trainers",
  trainingSessions: "training_sessions",
  trainingAssignments: "training_assignments",
  questionBanks: "question_banks",
  questions: "questions",
  exams: "exams",
  assessmentAttempts: "assessment_attempts",
  certificates: "certificates",
  notifications: "notifications",
  auditLogs: "audit_logs",
} as const;
