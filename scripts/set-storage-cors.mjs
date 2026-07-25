/**
 * Apply cors.json to the Firebase Storage bucket (no gsutil required).
 * Usage: node scripts/set-storage-cors.mjs [bucket-name]
 */
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const { GoogleAuth } = require("google-auth-library");

function loadEnvLocal() {
  const envPath = resolve(process.cwd(), ".env.local");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
}

loadEnvLocal();

const corsPath = resolve(process.cwd(), "cors.json");
const keyPath = resolve(
  process.cwd(),
  process.env.FIREBASE_ADMIN_CREDENTIALS_FILE || "firebase-service-account.json"
);

if (!existsSync(corsPath)) {
  console.error("Missing cors.json in project root");
  process.exit(1);
}
if (!existsSync(keyPath)) {
  console.error("Missing service account JSON:", keyPath);
  process.exit(1);
}

const cors = JSON.parse(readFileSync(corsPath, "utf8").replace(/^\uFEFF/, ""));
const sa = JSON.parse(readFileSync(keyPath, "utf8").replace(/^\uFEFF/, ""));

const bucket =
  process.argv[2] ||
  process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ||
  `${sa.project_id}.firebasestorage.app`;

const auth = new GoogleAuth({
  credentials: {
    client_email: sa.client_email,
    private_key: sa.private_key,
  },
  projectId: sa.project_id,
  scopes: ["https://www.googleapis.com/auth/devstorage.full_control"],
});

const client = await auth.getClient();
const { token } = await client.getAccessToken();
if (!token) {
  console.error("Failed to obtain access token from service account");
  process.exit(1);
}

const url = `https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(bucket)}`;
const res = await fetch(url, {
  method: "PATCH",
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ cors }),
});

const text = await res.text();
if (!res.ok) {
  console.error(`CORS update failed (${res.status}) for bucket ${bucket}`);
  console.error(text.slice(0, 500));
  process.exit(1);
}

console.log(`CORS applied to gs://${bucket}`);
console.log(JSON.stringify(cors, null, 2));
