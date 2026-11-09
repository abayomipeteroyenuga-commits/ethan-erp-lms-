# ETHAN ERP — Standalone Academy Administration

ETHAN ERP is an independent academy administration application. It has its own Render service, Neon project, authentication tenant, database schema and sign-in experience. It is separate from ETHAN LMS.

## ERP scope
- Learner admissions and institutional learner records
- Programme directory and administration
- People and staff records
- Role-based administration access
- Finance ledger for income and expenses
- Invoice register
- Attendance registers
- Timetable and operational scheduling
- Administrative academic records
- Certificate issue register
- Announcements
- Management reports

## Not part of ERP
Course lessons, learner classroom, course PDFs, video lessons, learning progress, quizzes delivered to students and the learning experience stay in ETHAN LMS. ERP academic records are administrative summaries only.

## Backend
- Dedicated Neon project: ETHAN ERP
- Neon Auth with email/password
- Neon Data API
- Row Level Security on all ERP business tables
- Role assignment restricted to the Super Admin
- Initial Super Admin bootstrapped by the database

New users register independently in ERP and start with restricted Viewer access. The Super Admin can promote registered accounts to the appropriate operational role.

## Render
The Render Blueprint is render.yaml in this directory. Deploy this directory as the service root. It does not use the LMS database.
