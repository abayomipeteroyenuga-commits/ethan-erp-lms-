# ETHAN ERP & LMS — Consolidated Project Documentation

This file consolidates the previous root-level Markdown documentation to keep the GitHub browser upload below 100 files. Runtime course PDFs, narration files, application code, SQL, SSO, Supabase functions, and assets remain separate and unchanged.



---

## Source document: ADOBE-PHOTOSHOP-BASICS-FULL-VISUAL-v11.9.md

# Ethan ERP/LMS v11.9 - Adobe Photoshop Basics

Course #18 Adobe Photoshop Basics (EDA-PSB-118) added as a 45-page full visual study manual.

- 19 lessons
- 12 original instructional visuals
- Guided practicals, case studies, review questions and assignments
- 30-question quiz
- 100-mark final examination
- 100-mark final promotional design project
- Bundled PDF course reader
- Voice narration transcript included as both local TXT and bundled narration data
- Service worker cache v11.9



---

## Source document: ADVANCED-CANVA-DESIGN-v11.8.md

# Ethan ERP/LMS v11.8 - Advanced Canva Design

Added Course #17 Advanced Canva Design (EDA-ACD-117).

- 45-page full visual paid-enrollee manual
- 19 advanced lessons
- 12 original instructional visuals
- Guided practicals, case studies, review questions and assignments
- 30-question quiz
- 100-mark final examination
- 100-mark multi-format campaign capstone
- Full PDF course reader integration
- Voice narration transcript in both local TXT and bundled narration data
- Service-worker cache bumped to v11.8



---

## Source document: APPROVED-PAYMENT-ACCOUNTS-v9.1.md

# Approved Ethan Digital Academy Payment Accounts

1. United Bank for Africa (UBA)
   Account Number: 1021643438

2. Kuda Microfinance Bank
   Account Number: 3003847218

Course access remains locked until an authorized administrator verifies payment and allocates the paid course.



---

## Source document: AUDIT-v8.5.md

# ETHAN ERP & LMS v8.5 — Comprehensive Audit

## Fixed
- Removed legacy demo students, instructors, payments, announcements and notifications.
- Added migration cleanup for old demo data already stored in browser localStorage.
- Student, Professional and Business Owner remain learner categories under the protected learner role.
- Learner category is now stored in Supabase auth metadata and displayed correctly after sign-in.
- Fixed global search Enter-key behavior.
- Removed Parents from the main Admin navigation for the revised learner model.
- Admin/Super Admin now hydrate real students, courses, staff and payments from Supabase.
- Instructor portal hydrates real RLS-permitted course/student data instead of fake dashboard counts.
- Student portal loads real enrolments and payment history.
- Instructor accounts are managed through secure Staff Management instead of insecure local-only creation.
- Timetable, announcements, reports and settings no longer show fake sample records.
- Reports now route to live operational modules.
- Settings Save button works locally and shows real Supabase connection status.
- Notifications now show a clean empty state when no real notification exists.
- Portal UI has been restructured for consistent hierarchy across Student, Instructor, Admin and Super Admin.
- Service worker cache bumped to v8.5.

## Important production dependency
- Staff creation requires the `create-staff` Supabase Edge Function to be deployed.
- Database actions still depend on the SQL migrations/RLS already supplied in the project.

## Additional reliability checks
- JavaScript syntax validated with Node for both app.js and supabase-client.js.
- ZIP integrity and local asset references checked.
- Payment allocation now blocks cleanly if no learner or course exists.
- Course creation now writes to Supabase when connected instead of disappearing on refresh.
- Announcements now read/write Supabase when connected.
- Signed-in notification panel can load the user's real notifications.
- Admin learner list is aligned with the self-registration model; no insecure duplicate local account creation.



---

## Source document: BRAND-IDENTITY-DESIGN-v12.1.md

# Ethan ERP/LMS v12.1 - Brand Identity Design

Course #20 Brand Identity Design (EDA-BID-120) added as a full paid-enrollee visual study manual.

- 19 lessons
- 12 original instructional visuals
- Guided practicals, Ethan Digital Academy case studies, review questions and assignments
- 30-question quiz
- 100-mark final examination
- 100-mark final Brand Identity Project
- PDF embedded in the course reader
- Voice narration transcript bundled in `course-narration-data.js` with local TXT fallback
- Service worker cache bumped to v12.1

Responsible-design emphasis: original identity work, licensed assets, accurate claims and appropriate trademark/domain checks before real commercial adoption.



---

## Source document: CANVA-GRAPHIC-DESIGN-FULL-VISUAL-v11.7.md

# Ethan ERP/LMS v11.7 - Canva Graphic Design

- Added Course #16 Canva Graphic Design (EDA-CGD-116).
- 45-page full visual paid-enrollee study manual with 19 lessons and 12 original instructional visuals.
- Added full PDF course-reader mapping and Print PDF mapping.
- Added local narration transcript and bundled narration data for reliable optional Voice Narration.
- Preserves payment/enrolment gating and Super Admin academic access.
- Service worker cache bumped to v11.7.



---

## Source document: CODING-PROGRAMMING-FUNDAMENTALS-v10.4.md

# Coding & Programming Fundamentals - EDA-COD-171

Completed as a full visual beginner programming manual using Python.
Includes 18 lessons, code examples, guided practicals, 12 instructional
visuals, final Student Result Manager project, 30-question quiz and
100-mark examination.

The existing catalogue entries Python for Beginners and Software Development
Basics can route to this foundation material where authorised.



---

## Source document: COMPUTER-HARDWARE-FUNDAMENTALS-v11.1.md

# Computer Hardware Fundamentals — v11.1

Course: Computer Hardware Fundamentals
Course Code: EDA-HDW-109
Full paid-enrollee visual study manual integrated into the LMS course reader.

- 19 lessons
- 12 original instructional visuals
- Safe guided practicals
- Review questions and assignments
- 30-question quiz
- 100-mark final examination
- Final hardware planning project
- Super Admin Upload Course facility retained
- Payment/enrolment gating retained



---

## Source document: COMPUTER-MAINTENANCE-FULL-VISUAL-v11.2.md

# Computer Maintenance - v11.2

Course #10 integrated into the Ethan ERP/LMS full course reader.

- Course code: EDA-MNT-110
- 19 lessons
- Full paid-enrollee PDF: assets/course-materials/Computer-Maintenance-EDA-MNT-110.pdf
- Bundled course routing added for Computer Maintenance
- Super Admin Upload Course workflow retained
- Learner payment/enrolment gating retained
- Service worker cache: v11.2



---

## Source document: CORELDRAW-ESSENTIALS-FULL-VISUAL-v12.0.md

# Ethan ERP/LMS v12.0 - CorelDRAW Essentials

- Added Course #19: CorelDRAW Essentials (EDA-CDR-119).
- 45-page paid-enrollee visual study manual with 19 lessons and 12 original instructional visuals.
- Added full PDF course reader mapping.
- Added bundled and local voice narration transcript.
- Includes guided practicals, assignments, 30-question quiz, 100-mark examination and 100-mark final project.
- Service worker cache bumped to v12.0.



---

## Source document: COURSE-1-VISUAL-MANUAL-v9.9.md

# Course 1 - Computer Appreciation Visual Manual

EDA-COM-101 has been rebuilt as the visual master standard for Ethan Digital Academy course materials.

Included:
- complete classroom study material
- 12 taught modules
- original instructional diagrams and screen-style examples
- practical activities
- review questions
- assignments
- real-life case study
- final practical project
- 20-question quiz
- 50-mark final examination
- paid-enrollee marking

The existing Computer Appreciation PDF route now opens this full visual manual.



---

## Source document: COURSE-2-MICROSOFT-WORD-VISUAL-v10.0.md

# Course 2 - Microsoft Word
EDA-WRD-102 is now a full visual study manual.
- 18 full lessons
- 12 instructional visuals
- step-by-step practicals
- workplace case studies
- review questions and assignments
- final professional project
- 30-question quiz
- 100-mark final examination
- paid-enrollee course material



---

## Source document: COURSE-3-MICROSOFT-EXCEL-VISUAL-v10.1.md

# Course 3 - Microsoft Excel
EDA-EXC-103 is now a complete visual study manual.
- 18 full lessons
- 12 instructional visuals
- formulas and functions
- practical worksheets and business examples
- IF logic, sorting/filtering, validation, charts, lookups and PivotTables
- dashboard design
- final professional project
- 30-question quiz
- 100-mark final examination
- paid-enrollee material



---

## Source document: COURSE-4-MICROSOFT-POWERPOINT-VISUAL-v10.5.md

# Microsoft PowerPoint - EDA-PPT-104

Rebuilt to the full Ethan Digital Academy visual study-manual standard.

- 18 full lessons
- 12 original instructional visuals
- slide layouts, typography, images, shapes, tables and charts
- themes, transitions, animations and Slide Master
- navigation, media, notes and Presenter View
- PDF/print/share workflow and presentation delivery
- final professional presentation project
- 30-question quiz and 100-mark examination
- paid-enrollee material



---

## Source document: COURSE-PDF-STANDARD-v9.5.md

# Ethan Digital Academy Course PDF Standard

Computer Appreciation (EDA-COM-101) is now the reference pattern for the Academy's course PDFs.

Required pattern: course identity, overview, learning objectives, course outline, full modules, definitions and explanations, examples, practical exercises, case studies, workplace application, final practical project, quiz, final examination and course completion outcome.

Full course PDFs remain paid-enrollee materials. Staff academic access remains available according to role permissions.



---

## Source document: COURSE-STUDY-NOTES-v8.8.md

# Course Study Notes v8.8

All allocated courses now have an in-app readable study note with:
- Introduction
- Definition
- Learning objectives
- Key concepts
- Tools/resources where relevant
- Worked example
- Case study
- Practical activity
- Review questions / assessment
- Summary

Digital Marketing includes a detailed Ethan Digital Academy campaign case study.

Access control:
- Public catalogue shows only course brief and fee.
- Full study notes are available through the signed-in learning area for allocated learners.
- Admin/Instructor can preview course study notes.

Exports:
- Download Word creates a Word-compatible .doc study copy.
- Save as PDF / Print opens a print-ready A4 study note for saving as PDF.



---

## Source document: COURSE-STUDY-NOTES-v8.9.md

# v8.9 Paid Enrollee Course Materials

- No public/free full course notes.
- Public catalogue remains course brief + fee only.
- Student course notes require an allocated course after verified payment.
- Admin, Super Admin and Instructor retain staff preview access.
- All 100 courses now use the same detailed academic structure as the Digital Marketing model:
  Introduction, Definition, 10 Learning Objectives, Key Concepts, Tools/Resources,
  Worked Example, Ethan Digital Academy Case Study, 10-step Practical Activity,
  8 Review/Assessment Questions, and Summary.
- Paid enrollees can read online, download a Word-compatible study copy, or save/print as PDF.



---

## Source document: COURSE-UPLOAD-v10.9.md

# v10.9 Full Course Upload

- Full bundled course PDFs now open inside the course page instead of only showing generated summary notes.
- Added Super Admin **Upload Course** navigation tab.
- Super Admin can attach a complete PDF study manual to an existing course.
- New uploads use private Supabase Storage and signed URLs.
- Active paid enrolment is required for learner access; staff retain academic access.
- Run `UPDATE-v10.9-COURSE-UPLOAD.sql` once in Supabase SQL Editor before using uploads.



---

## Source document: CYBERSECURITY-FULL-VISUAL-v10.2.md

# Cybersecurity Fundamentals - EDA-CYB-114

Completed as a 41-page defensive cybersecurity visual study manual.

The catalogue course "Cybersecurity Awareness" now opens this full paid-enrollee material for authorised learners. Super Admin/staff academic access remains governed by the existing LMS role logic.



---

## Source document: DIGITAL-LITERACY-FULL-VISUAL-v11.6.md

# Digital Literacy - v11.6

Course: Digital Literacy
Course Code: EDA-DLT-115
Manual: 45-page full visual paid-enrollee study manual
Lessons: 19
Visuals: 12 original instructional diagrams
Assessment: lesson practicals, assignments, 30-question quiz, 100-mark final exam, 100-mark final project
LMS reader: full PDF integrated
Voice narration: optional global narration enabled via Digital-Literacy-EDA-DLT-115.txt
Safety: authorised tools/accounts only; defensive digital safety; no credential sharing or bypass instructions.



---

## Source document: DIGITAL-MARKETING-FULL-VISUAL-v10.3.md

# Digital Marketing - EDA-DMK-130
Priority course completed as a full professional visual study manual.

Includes 20 lessons, instructional visuals, practical campaign exercises,
Ethan Digital Academy case study, final integrated campaign project,
30-question quiz and 100-mark examination.



---

## Source document: FILE-MANAGEMENT-CLOUD-STORAGE-FULL-VISUAL-v11.5.md

# v11.5 - File Management & Cloud Storage

- Added full 45-page paid-enrollee manual for Course 13.
- Course code: EDA-FCS-113.
- Added bundled PDF course-reader mapping.
- Added narration text so optional Voice Narration works with the new course.
- Existing Voice Narration remains available for previously integrated courses.
- Updated service-worker cache to v11.5.



---

## Source document: GOOGLE-WORKSPACE-FULL-VISUAL-v10.7.md

# Google Workspace Full Visual Study Manual - v10.7

- Course: Google Workspace
- Code: EDA-GWS-106
- 18 lessons with guided practicals, review questions and assignments.
- Includes original instructional visuals, Ethan Digital Academy case study, 30-question quiz, 100-mark final exam and final Workspace project.
- LMS PDF: assets/course-materials/Google-Workspace-EDA-GWS-106.pdf
- Paid-enrollee course gating remains unchanged.



---

## Source document: INSIDE-VIEW-v9.0.md

# v9.0 Logged-in Learner Portal

The Student / Professional / Business Owner logged-in dashboard is restructured around learning.

## Main learner view
- Welcome / learner account type
- Paid courses count
- Average progress
- Learning access status
- 100-course catalogue count
- "My Digital Courses" displayed prominently
- Each paid allocated course has Open Course + Learning Area
- "Digital Courses" catalogue visible inside the portal
- All catalogue courses remain locked until payment and allocation
- Search all 100 digital courses
- Currency selector for NGN, USD, GBP, EUR
- Quick access to Learning Area, Payments, Assignments, Certificates

No free full course material has been exposed.



---

## Source document: INTERNET-EMAIL-SKILLS-FULL-VISUAL-v10.8.md

# Internet & Email Skills Full Visual Manual - v10.8

Course: Internet & Email Skills
Course Code: EDA-IES-107
Level: Beginner to Professional Everyday Use
Duration: 6 Weeks (19 Lessons)

Integrated paid-enrollee study manual:
`assets/course-materials/Internet-Email-Skills-EDA-IES-107.pdf`

Includes guided practicals, original instructional visuals, Ethan Digital Academy case studies, review questions, assignments, 30-question quiz, 100-mark final examination and final project.



---

## Source document: IT-SUPPORT-FUNDAMENTALS-v11.3.md

# IT Support Fundamentals - v11.3

Course 11 full visual study manual integrated into the paid learner course reader.

- Course code: EDA-ITS-111
- Full PDF: assets/course-materials/IT-Support-Fundamentals-EDA-ITS-111.pdf
- Super Admin Upload Course workflow retained from v10.9+
- Learner payment/enrolment gating retained
- Defensive, authorised first-line support only



---

## Source document: MICROSOFT-ACCESS-FULL-VISUAL-v10.6.md

# Ethan ERP/LMS v10.6 - Microsoft Access Full Visual Manual

Integrated paid-enrollee manual: `assets/course-materials/Microsoft-Access-EDA-ACC-105.pdf`.

Course: Microsoft Access | Code: EDA-ACC-105 | 18 lessons | 6 weeks | Beginner to Intermediate.
Includes relational database concepts, tables, fields/data types, primary keys, relationships, queries, forms, reports, import/export, maintenance, final project, 30-question quiz and 100-mark final examination.



---

## Source document: README.md

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

## v5 Payment-Controlled Learning Access
- New student accounts start with zero courses and zero progress.
- Registration alone never unlocks lessons/videos.
- Admin/Super Admin verifies payment and selects the exact paid course.
- Verified payment creates the student's enrolment/allocation.
- Student dashboard, courses, LMS, assignments, results and certificates no longer display sample academic history.
- Run `UPDATE-v5-PAYMENT-COURSE-GATING.sql` once in Supabase SQL Editor on an existing database.


## v6 Staff Access Upgrade

- One common email/password sign-in for all five roles: Super Admin, Admin, Instructor, Student and Parent.
- Public self-registration remains limited to Student and Parent.
- Super Admin can create Admin and Instructor accounts from Staff Management.
- Admin can create Instructor accounts only.
- Staff creation uses the protected Supabase Edge Function in `supabase/functions/create-staff/`; never place the Service Role key in `config.js`.
- New students begin with zero courses. Payment verification + course allocation controls lesson/video access.
- The old hard-coded student 4 courses / 42% progress demo dashboard was removed.

### Upgrade order from v5
1. Run `UPDATE-v6-STAFF-ACCESS.sql` once in Supabase SQL Editor.
2. Create your first Super Admin: register your own account, edit the email in `BOOTSTRAP-SUPER-ADMIN.sql`, and run it once.
3. Deploy the `create-staff` Supabase Edge Function. Supabase automatically provides its standard project environment secrets.
4. Replace the website files in GitHub with this v6 build and let Vercel redeploy.
5. Sign in as Super Admin, open Staff Management, and create Admin/Instructor accounts.



---

## Source document: SOCIAL-MEDIA-GRAPHICS-FULL-VISUAL-v12.2.md

# Ethan ERP/LMS v12.2 - Social Media Graphics

Adds Course 21: Social Media Graphics (EDA-SMG-121).

- Full 45-page visual study manual
- 19 lessons
- 12 original instructional visuals
- Guided practicals, assignments, 30-question quiz, 100-mark examination and 100-mark final campaign
- Full PDF course reader integration
- Voice narration transcript bundled for reliable playback
- Service worker cache bumped to v12.2



---

## Source document: SSO-SETUP.md

# Ethan ID SSO setup

This build adds secure, short-lived SSO handoff between Ethan Hub and Ethan ERP & LMS.

## One-time Supabase setup
1. In the same Supabase project used by Hub and ERP/LMS, create/deploy the Edge Function in `supabase/functions/ethan-sso/index.ts` with the function name `ethan-sso`.
2. Add an Edge Function secret named `SSO_SECRET`. Use a long random value of at least 32 characters. Do not put this secret in frontend files or GitHub.
3. Ensure the function has access to the standard `SUPABASE_URL` and `SUPABASE_ANON_KEY` environment variables.
4. Deploy Ethan Hub to `https://hub.ethandigitalacademy.org` and ERP/LMS to `https://app.ethandigitalacademy.org`.

## Flow
- User signs in once on Ethan Hub.
- Clicking ERP & LMS asks the Edge Function for a 60-second encrypted handoff ticket.
- The browser opens ERP/LMS with the opaque ticket.
- ERP/LMS exchanges it through the Edge Function and establishes the same Supabase session.
- The ticket is removed from the address bar immediately.

No password is sent between applications and no service-role key is placed in either frontend.

## Important
Use HTTPS in production. Keep `SSO_SECRET` private. This version uses a 60-second encrypted ticket; for stricter replay prevention later, add a server-side nonce store so every ticket can be consumed only once.



---

## Source document: SUPABASE-SETUP.md

# Supabase Setup for ETHAN ERP & LMS v2

1. Create a Supabase project.
2. Open SQL Editor and run `schema.sql`.
3. Open `config.js`.
4. Add:
   - `supabaseUrl`
   - `supabasePublishableKey`
5. In Authentication > Providers, enable Email.
6. Configure your Site URL and allowed redirect URLs for your deployed domain.
7. In Storage, create the buckets you need for course files, assignments, avatars and certificates.
8. Do not place the Supabase service-role key in frontend files.

When credentials are present, the app can authenticate through Supabase. Without them, it stays in browser-local preview mode.

## Existing installation upgrade to v5
If you already ran `schema.sql`, do NOT rerun the whole schema. Run only:
`UPDATE-v5-PAYMENT-COURSE-GATING.sql`

This creates missing student/parent operational rows and locks modules/lessons to paid/allocated enrolments.



---

## Source document: SUPER-ADMIN-ACCESS-v9.2.md

# v9.2 Super Admin Full Academic Access

Super Admin now has:
- Access to the complete course library, including all 100 Ethan catalogue courses
- Full course study-note access without payment/allocation restrictions
- PDF/Print access
- Word download access
- Ability to create new courses
- Super Admin academic-control panel on dashboard
- Direct Open Material and PDF/Word buttons
- Existing learner payment gating remains unchanged

Learners still require verified payment + course allocation before course materials unlock.



---

## Source document: SUPER-ADMIN-HARD-FIX-v9.4.md

# v9.4 Super Admin Portal Hard Fix
Confirmed Super Admin: fedora4jesus@gmail.com

The role is normalized at the central portal entry point, so a stale browser/local Student record can no longer override the confirmed Super Admin identity. The fix applies to fresh Supabase login, restored Supabase session, local fallback session, role label, navigation and dashboard routing.



---

## Source document: TYPING-KEYBOARD-MASTERY-FULL-VISUAL-v11.0.md

# Typing & Keyboard Mastery - v11.0

Course: Typing & Keyboard Mastery
Course code: EDA-TYP-108
Full paid-enrollee visual study manual integrated into the LMS course reader.

- 19 lessons
- Guided typing drills and practicals
- Original instructional visuals
- Review questions and assignments
- 30-question quiz
- 100-mark final examination
- 100-mark final practical project
- Bundled PDF available to authorised course readers
- Super Admin Upload Course tab from v10.9 retained



---

## Source document: VOICE-NARRATION-HOTFIX-v11.6.1.md

# Voice Narration Hotfix v11.6.1

- Fixes “Voice narration text is not available for this course yet.” on Digital Literacy.
- Bundles narration transcripts directly with the web app instead of depending only on a runtime TXT fetch.
- Applies the reliability fix to all currently bundled narration transcripts.
- Keeps TXT fetch as a fallback for future/dynamically uploaded course narration.
- Bumps service-worker cache to v11.6.1 so deployed browsers receive the fix.



---

## Source document: VOICE-NARRATION-HOTFIX-v11.6.2.md

# Voice Narration Hotfix v11.6.2

- Resolves narration by course title to the canonical bundled PDF/transcript.
- Works even when the visible course PDF URL is a signed/uploaded URL with a different filename.
- Transcript fetch is resolved relative to the deployed app path.
- Separates missing-transcript errors from browser speech-engine errors.
- Preserves bundled transcript data and per-course TXT fallback.
- Cache bumped to v11.6.2.



---

## Source document: VOICE-NARRATION-v11.4.md

# Ethan LMS v11.4 - Optional Voice Narration

- Voice narration is OFF by default and controlled by each learner.
- Available for every bundled full course manual, including Courses 1-12 and the previously completed Cybersecurity, Digital Marketing and Coding manuals.
- Controls: Play/Pause/Resume, Stop, Previous/Next narration section, speed (0.75x-2x), and available device voice selection.
- Narration uses the browser/device Web Speech API; available voices vary by browser and operating system.
- Full manual narration text is bundled locally under `assets/course-narration/`.
- Narration does not mark a lesson or course complete.
- PDF remains visible for normal reading while narration is optional.

