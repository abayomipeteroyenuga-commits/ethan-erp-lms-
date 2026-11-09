# ETHAN LEARN — Independent Learning Platform

ETHAN LEARN is the free learning and academy-management portal for Ethan Digital Academy.

## Hosting
- A dedicated Render Node.js service serves the ETHAN LEARN frontend and protected course-material signing API. The ERP runs as a different service with its own database and deployment root.
- `render.yaml` defines the Render Blueprint in Frankfurt.
- `server.js` serves only browser-required files and `/api/storage/presign`.
- The health endpoint is `/healthz`.
- Render deploys commits from `main` automatically.
- Attach the production domain only after the Render service is deployed and verified.

## Backend
- Independent Neon PostgreSQL 17 database.
- Neon Managed Better Auth (email/password).
- Neon Data API with JWT-backed row-level security.
- Private Neon Object Storage bucket: `ethan-lms-materials`.
- The Node API signs upload and download URLs. Storage credentials stay server-side.

## Free learner access
- Registration and learner accounts are free.
- All 100 published academy courses are free and available after registration.
- New students receive active enrolments in all published courses automatically.
- Study notes, bundled PDF manuals, lessons and narration remain available after sign-in.
- No Ethan ID, shared Hub account, course payment, payment verification or admin allocation is required to access learning.
- Staff roles remain protected. Learners cannot promote themselves to staff.

## Staff management
Staff first create a free account using their own email. An authorized Admin or Super Admin can then promote that account to Instructor or Admin from Staff Management. An Admin can promote Instructors only.

The existing finance modules remain available for academy administration and historical records. They do not gate student learning.

## Render environment variables
Set these securely in the Render service environment. Do not commit secret values:
- `DATABASE_URL` (encrypted Neon connection string)
- `NEON_AUTH_JWKS_URL`
- `AWS_ENDPOINT_URL_S3`
- `AWS_REGION` (set to `eu-central-1`)
- `AWS_ACCESS_KEY_ID` (private storage credential)
- `AWS_SECRET_ACCESS_KEY` (private storage credential)
- `NEON_STORAGE_BUCKET` (set to `ethan-lms-materials`)
- `APP_ORIGIN` (set to `https://lms.ethandigitalacademy.org` after the custom domain is attached)

The Blueprint marks private values as unsynchronized so Render prompts for secure entry. Never put secrets in GitHub or browser files.

## Migration notes
The old Supabase backend has not been deleted or modified. Supabase password hashes and user accounts are not imported. Existing users need to register a new free account in the independent Neon identity directory. Existing privately uploaded materials remain in the previous backend until exported; the bundled course PDFs and narration assets remain in this repository.
