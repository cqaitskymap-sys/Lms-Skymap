import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, connectAuthEmulator, type Auth } from "firebase/auth";
import {
  getFirestore,
  initializeFirestore,
  connectFirestoreEmulator,
  type Firestore,
} from "firebase/firestore";
import { getStorage, connectStorageEmulator, type FirebaseStorage } from "firebase/storage";
import { getFunctions, connectFunctionsEmulator, type Functions } from "firebase/functions";
import { firebaseConfig } from "@/lib/firebase/config";

function createFirebaseApp(): FirebaseApp {
  if (getApps().length) return getApp();
  return initializeApp(firebaseConfig);
}

function createFirestore(firebaseApp: FirebaseApp): Firestore {
  // Browser: auto-detect buffering proxies / AV that break WebChannel Listen
  // (common source of Listen/channel HTTP 400 with t=1). Server keeps defaults.
  if (typeof window !== "undefined") {
    try {
      return initializeFirestore(firebaseApp, {
        experimentalAutoDetectLongPolling: true,
      });
    } catch {
      // Already initialized in this runtime (HMR / duplicate import).
      return getFirestore(firebaseApp);
    }
  }
  return getFirestore(firebaseApp);
}

export const app = createFirebaseApp();
export const auth: Auth = getAuth(app);
export const db: Firestore = createFirestore(app);
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
  roles: "roles",
  permissions: "permissions",
  departments: "departments",
  employees: "employees",
  inductionModules: "induction_modules",
  inductionAssignments: "induction_assignments",
  jobDescriptions: "job_descriptions",
  tni: "training_need_identifications",
  sops: "sops",
  sopVersions: "sop_versions",
  sopViews: "sop_views",
  sopAcknowledgements: "sop_acknowledgements",
  trainers: "trainers",
  trainingSessions: "training_sessions",
  trainingAssignments: "training_assignments",
  questionBanks: "question_banks",
  questions: "questions",
  exams: "exams",
  assessmentAttempts: "assessment_attempts",
  examResults: "exam_results",
  examLeaderboards: "exam_leaderboards",
  certificates: "certificates",
  notifications: "notifications",
  auditLogs: "audit_logs",
  activityLogs: "activity_logs",
  loginLockouts: "login_lockouts",
  lifecycleEvents: "lifecycle_events",
  lifecycleApprovals: "lifecycle_approvals",
  counters: "counters",
  companyPolicies: "company_policies",
  policyAcceptances: "policy_acceptances",
} as const;
