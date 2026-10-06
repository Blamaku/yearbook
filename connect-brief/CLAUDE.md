# GLUK Connect — project brief for Claude

GLUK Connect is the official community platform for Great Lakes University of Kisumu (GLUK), Kenya.
It replaces the Yearbook 2026 app (old repo: `../gluk-yearbook`, plain HTML/JS + Firebase + Supabase).
This is a NEW codebase. Do not copy code from the old repo; carry over ideas, branding assets and (later) consented data.

Owner/developer: Blair Macharia — a medical student and self-taught builder. Explain steps in plain
language, say what each command does before running it, and prefer small, reviewable changes.

## Stack (decided)
- Next.js (App Router) + React + TypeScript, installable PWA, hosted on Vercel
- Supabase only: Auth, Postgres with row-level security (RLS), Storage, Edge Functions, Realtime
- No Firebase. One backend.
- Tests: pgTAP for database permissions, Playwright for pages
- Error tracking (e.g. Sentry); product analytics (e.g. PostHog)
- Two Supabase projects: `test` and `production`. Local dev via Supabase CLI + Docker.

## People and roles
Person types (one per account): student, academic_staff, non_teaching_staff, alumni, guest (later).
Roles (many per person, each scoped): class_rep (class), club_official (club), department_head (department),
office_head (office), communicator (platform), moderator (platform), admin (platform).
Stored in `role_assignments(person_id, role, scope_type, scope_id, granted_by, expires_at)`.
Every RLS policy uses one helper: `has_role(role, scope_type, scope_id)`.

## Sign-in and verification
- GLUK has NO student email accounts yet. Sign-in = email magic link or phone OTP. No passwords.
- Students claim a profile with their admission number, matched against the registrar's list (CSV upload by admin).
- Staff claim with a staff number matched against an HR list, then their head of department/office approves.
- No match or number already claimed -> admin review queue.
- One account per person: admission number, staff number and email are each unique.
- Accept privacy notice + community guidelines at first sign-in (store version + date in `consents`).

## Core tables (Phase 1)
Who: people, student_records, staff_records, role_assignments, consents
Where: departments, courses, classes, offices
What: clubs, memberships, posts, comments, announcements, events, rsvps
Trust: reports, audit_log (append-only), notifications
Engagement: reactions, mentions, polls, follows
Content lives in a "space": club | class | course | department | office.

## Rules that must never break
- Permissions are enforced in Postgres RLS, never only in the UI.
- The Supabase service-role key is used only inside Edge Functions, never in the browser.
- Sensitive actions run in Edge Functions and write to audit_log: profile claim, role grant/revoke,
  staff approval, graduation (class -> alumni), suspension, data export, account deletion.
- Every database change is a numbered migration in `supabase/migrations/`. Never edit the production DB by hand.
- Privacy: phone, WhatsApp, email, birthday each have visibility (everyone at GLUK / my class / staff / nobody).
  Birthdays store month-day only, never the year. WhatsApp numbers normalised to +254.
- Staff cannot see student phone/WhatsApp/birthday unless the student allows "staff". No staff-student DMs in Phase 1.
- Kenya Data Protection Act 2019 applies: collect the minimum, support "download my data" and "delete my account".
- Healthy engagement: chronological feed + pinned official posts, quiet hours 22:00-06:00 by default, no public follower counts.

## Performance targets
Budget Android phones on mobile data: page load under 3 s, images resized to max 1600 px WebP before upload,
"data saver" mode, offline reading of visited pages. Accessibility target WCAG 2.2 AA.

## Code layout
```
app/                 routes
modules/core|hub|staff|moderation|yearbook|alumni
components/ui/       GLUK design system
supabase/migrations|functions|tests
tests/               Playwright
```

## Phase 1 build order
1. Foundations: repo, Supabase projects, Vercel, CI checks, first design-system components
2. Core data: people, structure, role_assignments, has_role + pgTAP tests
3. Sign-in and claiming; admin CSV upload of student and staff lists
4. Profiles, privacy settings, people + staff directories, office hours
5. Spaces: department/course/class/office/club pages; posts, comments, replies
6. Announcements (verified badge, read receipts) + notifications (in-app, push, email)
7. Events + RSVP
8. Reports, moderation queue, audit log, admin console, staff approvals
9. PWA polish, offline, data saver, speed + accessibility pass
10. Pilot group, then demo to CRI (Centre for Research and Innovation, the university sponsor)

## Context
- Hosted on Blair's own domain first; moves to a GLUK domain on adoption. Keep the site URL in one env variable.
- Yearbook 2026 data moves over later, only for people who consent (see migration plan in the architecture doc).
- Full plans: "GLUK Connect — Blueprint" and "GLUK Connect — Technical Architecture" docs in Claude.
