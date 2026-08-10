# iFixLab251 — Gadget Repair Operations

A responsive, role-aware Next.js operations dashboard for a gadget repair shop.
The current prototype includes Admin, Technician, and Front Desk views; repair
intake and ticket lifecycle controls; inventory visibility rules; POS views;
customer search; and admin reporting.

## Getting started

1. Open the project folder:
   ```bash
   cd /Users/mac/Documents/Projects/gadget-repair
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the local development server:
   ```bash
   npm run dev
   ```
4. Open http://localhost:3002 in your browser.

## PostgreSQL setup

1. Copy `.env.example` to `.env` and set `DATABASE_URL` to your PostgreSQL database.
2. Run `npm run db:generate`.
3. On this local Homebrew setup, run `npm run db:init:local` once. On other
   environments, use `npm run db:migrate -- --name init`.
4. Run `npm run db:seed`.

The seed creates three staff accounts. Passwords come from environment variables
and are never stored in source control:

- `admin@ifixlab251.local` — `ADMIN_INITIAL_PASSWORD`
- `technician@ifixlab251.local` — `TECHNICIAN_INITIAL_PASSWORD`
- `frontdesk@ifixlab251.local` — `FRONT_DESK_INITIAL_PASSWORD`

Set `AUTH_SECRET` to a long random production secret used to sign eight-hour
staff sessions. Rerunning `npm run db:seed` updates the three account passwords.

## Password reset email

Password reset links expire after 30 minutes and can only be used once. Configure
the backend with these environment variables in production:

- `RESEND_API_KEY` — API key used to deliver reset emails
- `RESET_EMAIL_FROM` — verified sender, for example `iFixLab251 <support@example.com>`
- `FRONTEND_URL` — public frontend URL used in reset links

Without `RESEND_API_KEY`, local development returns a visible test reset link.
Production refuses reset requests until email delivery is configured.

## Project structure

- `frontend/app/page.js` — role-aware dashboard and interactive workflows
- `frontend/app/components/` — frontend-only feature views and shared UI
- `backend/src/` — standalone HTTP API, RBAC, and business services
- `backend/prisma/` — PostgreSQL schema and seed
- `frontend/app/layout.js` — root layout and metadata
- `frontend/app/globals.css` — responsive dashboard styling
- `frontend/next.config.js` — Next.js configuration
- `package.json` — scripts and dependencies

## Implementation boundary

The UI loads its workspace from `http://127.0.0.1:4000/api/workspace` and sends
repair mutations to the standalone backend. Business rules, role filtering,
dashboard calculations, status transitions, Prisma access, and audit events live
exclusively under `backend/`. Staff authentication uses signed, expiring bearer
sessions. Receipt delivery remains a future production integration.
