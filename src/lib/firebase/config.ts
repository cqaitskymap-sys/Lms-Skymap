/**
 * Firebase web config for project `lms-skymap`.
 * Prefers env vars; falls back to project defaults so Auth never gets `your_api_key`.
 */
export const firebaseConfig = {
  apiKey:
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY &&
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY !== "your_api_key"
      ? process.env.NEXT_PUBLIC_FIREBASE_API_KEY
      : "AIzaSyAVWM9KUt7fRwI2V-B-EG9RI-8ToaXCeIo",
  authDomain:
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN &&
    !process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN.includes("your_project")
      ? process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
      : "lms-skymap.firebaseapp.com",
  projectId:
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID &&
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID !== "your_project_id"
      ? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
      : "lms-skymap",
  storageBucket:
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET &&
    !process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET.includes("your_project")
      ? process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
      : "lms-skymap.firebasestorage.app",
  messagingSenderId:
    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID &&
    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID !== "your_sender_id"
      ? process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
      : "169801430729",
  appId:
    process.env.NEXT_PUBLIC_FIREBASE_APP_ID &&
    process.env.NEXT_PUBLIC_FIREBASE_APP_ID !== "your_app_id"
      ? process.env.NEXT_PUBLIC_FIREBASE_APP_ID
      : "1:169801430729:web:c1c9681b40307306de3f18",
};
