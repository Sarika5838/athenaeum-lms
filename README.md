# Athenaeum — Library Management System

A modern, staff-facing library management system built with TanStack Start, React 19, TypeScript, Tailwind v4, and Lovable Cloud (Postgres + Auth + RLS).

## Features

- **Auth** — Email/password sign-in with Remember Me and Forgot Password. The first user to sign up becomes **Admin**; subsequent staff join as **Librarian**.
- **Dashboard** — Live stats (titles, copies, students, on-loan, overdue, fines) with bar/pie charts and a recent-activity feed.
- **Books** — CRUD, search across title/author/ISBN, category filter, cover images, and Excel import/export.
- **Students** — CRUD with search across name, roll number, email, and department.
- **Issue & Return** — Atomic issue via a Postgres function; automatic fine calculation on return based on library policy.
- **Waiting Queue** — When a title is unavailable, students queue by request time; librarians clear entries on fulfillment.
- **Reports** — Excel and PDF exports for the catalog, student registry, active loans, overdue list, and returns/fines.
- **Global search** — Header search jumps into the Books view.
- **Settings** — Admin-editable library name, fine rate, loan period, and per-student limit.
- **Theme** — Warm cream/navy light mode and quiet dark mode, remembered per browser.

## Stack

| Layer | Tech |
| --- | --- |
| Framework | TanStack Start v1 (SSR-capable) + React 19 |
| Styling | Tailwind CSS v4 (CSS-first tokens in `src/styles.css`) |
| UI | shadcn/ui, Radix primitives, lucide icons, Recharts |
| Data | Lovable Cloud (Postgres, Auth, Row-Level Security) |
| Client cache | TanStack Query |
| Exports | `xlsx`, `jspdf`, `jspdf-autotable` |

## Database

Tables live in `public`:

- `profiles` (staff, references `auth.users`)
- `user_roles` (enum: `admin` / `librarian`) — checked via a `has_role` `SECURITY DEFINER` function
- `books`, `students`, `issues`, `waiting_queue`, `library_settings`

Two SQL functions guarantee correctness:
- `issue_book(book, student, due_date)` — decrements `available_copies` inside a row lock and inserts the loan.
- `return_book(issue_id)` — computes days late × `fine_per_day`, marks returned, restores the copy.

Row-Level Security is enabled on every table; staff read/write is scoped to authenticated users, and only Admins can update settings or manage roles.

## Getting started

```bash
bun install
bun run dev
```

Sign up once to create the Admin account, then invite librarians. Sample books and students are pre-seeded.

## Java Swing companion

A Java/Swing/MySQL Library Management System (MVC + JDBC + FlatLaf) generation is queued as a follow-up. It will land under `java-lms/` in this repo as source only — you'll build it locally with `mvn clean install`.
