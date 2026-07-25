# PharmaLMS Firestore Schema

## Entity relationship (logical)

```
users 1──1 employees
departments 1──* employees
employees 1──* induction_assignments *──1 induction_modules
employees 1──* job_descriptions
employees 1──* training_need_identifications *──1 job_descriptions
sops 1──* sop_versions
sops *──* departments (departmentIds[])
employees 1──* training_assignments *──1 sops
training_sessions 1──* attendance (embedded)
question_banks 1──* questions
exams *──1 question_banks
assessment_attempts *──1 exams
certificates 1──1 training_assignments
notifications *──1 users
audit_logs (append-only)
counters/employees — atomic EMP###### sequence
company_policies *──* policy_acceptances (first-login)
```

## Employee onboarding

| Field / collection | Purpose |
|---|---|
| `employees.employeeCode` | Sequential `EMP000001` from `counters/employees.seq` |
| `employees.username` | Equals employee code (login identifier) |
| `employees.employmentType` | permanent \| contract \| intern \| consultant \| temporary |
| `employees.onboardingStatus` | pending_first_login → in_progress → completed |
| `users.username` | Same as employee code for resolve-login |
| `users.mustChangePassword` | Forced on provisioned accounts |
| `users.mustUpdateProfile` | First-login profile confirmation |
| `users.mustAcceptPolicies` | First-login policy pack |
| `users.onboardingCompletedAt` | Cleared first-login gate |
| `policy_acceptances` | Append-only acceptance records (Admin SDK) |

Auth accounts are created via Admin SDK (`POST /api/employees/onboard`). Temporary passwords are returned once to HR and never persisted.

## Key indexes

See `firestore.indexes.json` for composite indexes on employees, training_assignments, sop_versions, notifications, questions, and sops.

Recommended single-field indexes (auto-created): `users.username`, `employees.employeeCode`, `employees.email`.

## Soft deletes / status

Prefer status fields (`obsolete`, `terminated`, `isActive`) over hard deletes for audit compliance.

## Timestamps

All mutable documents include `createdAt`, `updatedAt`, `createdBy`, optional `updatedBy` (ISO-8601 strings).
