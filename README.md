# Outreach CRM

A personal recruiting CRM for managing HR, recruiter, and hiring manager contacts. Replace messy spreadsheets with a single intelligent dashboard.

## Features

- **Import** — Upload CSV/XLS/XLSX, paste tables from Google Sheets/Excel, or paste email lists
- **Contacts** — Virtualized table with 20k+ support, inline status, outreach tracking, notes, follow-ups
- **Companies** — Auto-linked company pages with role grouping (Recruiter/HR/Hiring Manager)
- **Duplicates** — Find and merge duplicate emails, companies, domains, and names
- **Analytics** — KPIs, charts, response/interview/offer rates
- **Activity** — Full audit timeline
- **Search** — Instant global search via Cmd+K
- **Export** — CSV and Excel export
- **Settings** — Theme, import rules, database backup/restore

## Tech Stack

- Next.js 16 (App Router), TypeScript, Tailwind CSS v4, shadcn/ui
- Prisma + SQLite (local-first, Supabase-ready architecture)
- TanStack Table + Virtual, React Query, React Hook Form, Zod, Recharts

## Getting Started

```bash
npm install
npx prisma migrate dev
npm run db:seed
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Architecture

```
src/lib/repositories/   — Data access layer (swap Prisma provider for Supabase)
src/lib/services/       — Business logic (import, dedup, analytics, export)
src/lib/parsers/        — Modular import providers (file, paste, email-list, google-sheet stub)
src/lib/services/ai/    — AI extension stubs for future features
```

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `⌘K` | Command palette / search |
| `G` then `C` | Go to Contacts |
| `G` then `I` | Go to Import |
| `G` then `D` | Go to Dashboard |
| `?` | Show shortcuts |

## Future: Supabase Migration

1. Change `provider` in `prisma/schema.prisma` to `postgresql`
2. Update `DATABASE_URL` to your Supabase connection string
3. Run `prisma migrate deploy`
4. Repository layer stays unchanged

## Future: AI Features

Stub interfaces in `src/lib/services/ai/` for:
- Company normalization
- Duplicate detection
- Role tagging
- Email generation
- Contact enrichment
- Outreach suggestions
