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
```

## Key indexes

See `firestore.indexes.json` for composite indexes on employees, training_assignments, sop_versions, notifications, questions, and sops.

## Soft deletes / status

Prefer status fields (`obsolete`, `terminated`, `isRevoked`) over hard deletes for audit compliance.

## Timestamps

All mutable documents include `createdAt`, `updatedAt`, `createdBy`, optional `updatedBy` (ISO-8601 strings).
