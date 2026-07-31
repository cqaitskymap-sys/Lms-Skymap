# PharmaLMS — Enterprise Pharmaceutical Learning Management System

GMP/GDP-oriented LMS for pharmaceutical companies: induction → department handover → JD/TNI → SOP training → assessment → certificate, with version-controlled SOPs and a full audit trail.

## Stack

- **Next.js 15** (App Router) + React 19 + TypeScript
- **Tailwind CSS** + **shadcn/ui**
- **Firebase** Auth, Firestore, Storage, Cloud Functions
- **Role-based access** (Super Admin, HR, QA, Department Head, Trainer, Employee)

## Quick start (Demo mode)

No Firebase project required — seeded demo accounts and data.

```bash
npm install
cp .env.example .env.local
# Demo mode is enabled when Firebase keys are unset / placeholder
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) → **Sign in**.

| Role | Email | Password |
|------|-------|----------|
| Super Admin | `admin@pharma.local` | `Admin@123` |
| HR | `hr@pharma.local` | `Hr@12345` |
| QA | `qa@pharma.local` | `Qa@12345` |
| Department Head | `dept@pharma.local` | `Dept@123` |
| Trainer | `trainer@pharma.local` | `Train@123` |
| Employee | `employee@pharma.local` | `Emp@12345` |

## Production Firebase setup

1. Create a Firebase project and enable **Authentication (Email/Password)**, **Firestore**, **Storage**, **Functions**.
2. Copy `.env.example` → `.env.local` and fill `NEXT_PUBLIC_FIREBASE_*` + Admin SDK credentials.
3. Set `NEXT_PUBLIC_DEMO_MODE=false`.
4. Deploy rules & functions:

```bash
firebase login
firebase use <project-id>
firebase deploy --only firestore:rules,firestore:indexes,storage,functions
cd functions && npm install && npm run build
```

5. Seed an initial Super Admin user document in `users/{uid}` after creating the Auth user.

## Workflow (implemented)

1. HR creates employee  
2. HR assigns induction modules + documents  
3. Employee completes induction + assessment  
4. HR hands over to department  
5. Department Head creates JD & TNI  
6. QA manages SOPs with version control  
7. Department Head assigns SOP training + Trainer  
8. Employee studies materials  
9. Trainer conducts session, marks attendance, completes  
10. Employee takes timed randomized exam  
11. System auto-evaluates (Cloud Function + client engine)  
12. Fail → auto-retraining  
13. Pass → QR certificate + digital signature  
14. SOP revision → auto-reassign affected trainees  
15. Audit logs for all critical actions  

## Architecture

```
src/
  app/                  # App Router pages (dashboard modules)
  components/
    ui/                 # shadcn primitives
    layout/             # Sidebar, header, theme
    shared/             # Stat cards, PDF/video, timeline, toolbar
    exams/              # Exam timer
    certificates/       # Certificate view
    auth/               # Guards & permission gates
  contexts/             # Auth provider (Firebase + demo)
  lib/
    firebase/           # Client + Admin SDK
    rbac/               # Permissions matrix & API middleware
    services/           # Employees, induction, SOPs, assessments, training
    demo/               # Seed data for local demo
  types/                # Domain models
functions/              # Cloud Functions (SOP revision, scoring, reminders)
firestore.rules         # Security rules
storage.rules
```

## Firestore collections

| Collection | Purpose |
|------------|---------|
| `users` | Auth-linked profiles + roles |
| `departments` | Org units |
| `employees` | HR employee lifecycle |
| `induction_modules` / `induction_assignments` | Onboarding |
| `job_descriptions` | JD |
| `training_need_identifications` | TNI |
| `sops` / `sop_versions` | Controlled documents |
| `trainers` | Trainer profiles |
| `training_sessions` / `training_assignments` | Delivery & tracking |
| `question_banks` / `questions` / `exams` | Assessment engine |
| `assessment_attempts` | Timed attempts |
| `certificates` | Issued certificates |
| `notifications` | In-app alerts |
| `audit_logs` | Append-only compliance log |

## Modules

Authentication · Employees · Induction · Handover · JD · TNI · SOP Version Control · Trainers · Training Matrix · Assessments · Question Bank · Exams · Certificates · Reports · Notifications · Audit Trail · Dashboards · RBAC

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Next.js dev (Turbopack) |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm run emulators` | Firebase emulators |
| `npm run functions:deploy` | Deploy Cloud Functions |

## Compliance notes

- Audit logs are append-only in security rules  
- Certificate issuance is Functions-owned in production  
- SOP revision triggers automatic retraining reassignment  
- Timed exams with shuffle; server-side scoring callable available  
- Public certificate verification at `/verify`  

## License

Proprietary — SkyMap / internal use.
