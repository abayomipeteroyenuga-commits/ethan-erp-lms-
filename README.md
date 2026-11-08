# ETHAN ERP & LMS — Free Neon Edition

ETHAN ERP & LMS is deployed at https://app.ethandigitalacademy.org.

## Backend
- Independent Neon PostgreSQL 17 database
- Neon Managed Better Auth (email/password)
- Neon Data API with JWT-backed row-level security
- Private Neon Object Storage bucket: `ethan-lms-materials`
- Vercel API gateway signs upload and download URLs; storage credentials remain server-side.

## Free learner access
- Registration and learner accounts are free.
- All 100 published academy courses are free and available after registration.
- New students receive active enrolments in all published courses automatically.
- Study notes, uploaded PDF manuals, lessons and narration remain available after sign-in.
- No Ethan ID, shared Hub account, course payment, payment verification or admin allocation is required to access learning.
- Staff roles remain protected. Learners cannot promote themselves to staff.

## Staff management
Staff first create a free account using their own email. An authorized Admin or Super Admin can then promote that account to Instructor or Admin from Staff Management. An Admin can promote Instructors only.

The existing finance modules remain available for academy administration and historical records. They do not gate student learning.

## Environment variables (Vercel)
Set for Production, Preview and Development:
- `DATABASE_URL` (encrypted Neon connection string)
- `NEON_AUTH_JWKS_URL`
- `AWS_ENDPOINT_URL_S3`
- `AWS_REGION`
- `AWS_ACCESS_KEY_ID` (encrypted)
- `AWS_SECRET_ACCESS_KEY` (encrypted)
- `NEON_STORAGE_BUCKET`

Public Neon database URL is in `config.js`. Never expose the database connection string, S3 key or S3 secret in browser files.

## Migration notes
The old Supabase backend has not been deleted or modified. Supabase password hashes and user accounts are not imported. Existing users need to register a new free account in the independent Neon identity directory. Existing uploaded materials remain in the previous backend until exported; the bundled static course PDFs and narration assets remain in the repository.
