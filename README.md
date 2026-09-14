# ETHAN ERP & LMS

This package contains a working browser-based ERP/LMS prototype with:
- Official Ethan Digital Academy logo
- Sign in / create account
- Role-aware portals (Admin, Student, Parent, Instructor navigation)
- Student, instructor, course, LMS classroom, assignment, attendance, payments, results, certificates, announcements, reports and settings screens
- Browser-local data persistence for preview/testing
- PWA manifest and service worker
- Supabase configuration placeholder in `config.js`

## Preview admin
For local preview only, the app seeds one administrator account:
- Email: admin@ethandigitalacademy.org
- Password: EthanAdmin2026!

Change or remove this seeded preview account before a public deployment.

## Supabase
Add your project URL and publishable key in `config.js`. A production build should replace browser-local authentication/data with Supabase Auth, PostgreSQL tables, Row Level Security and Storage.

## Run locally
Open `index.html` directly, or serve this folder using a simple local web server for full PWA support.


## v2 additions
- Supabase JavaScript SDK integration layer
- Production-ready SQL schema
- Row Level Security starter policies
- User profile auto-creation trigger
- Core ERP/LMS database entities
- Backend-ready auth methods
- Setup guide included


## v3 connection
This build is configured for:
- Supabase project URL: https://hsigpjyvuvqdmujklcvw.supabase.co
- Public publishable key configured in `config.js`

Before public deployment:
- Confirm Email provider is enabled in Supabase Authentication.
- Configure the Site URL and redirect URLs for the production domain.
- Revoke/rotate any secret key that was previously exposed.
