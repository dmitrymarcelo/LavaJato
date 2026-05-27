# Advanced filters and password reset implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add free period filters to dashboard and vehicle history, plus manual and automatic temporary password reset.

**Architecture:** Keep dashboard filtering in React using already loaded bootstrap data. Apply vehicle history date filtering in the API so summaries, detail records, and CSV exports use the same interval. Add backend password reset helpers and routes so password updates, session invalidation, and optional email delivery stay server-side. Email delivery uses AWS SES when configured and falls back safely for administrator manual reset.

**Tech Stack:** React, TypeScript, Express, PostgreSQL, bcrypt, AWS SES v2 client.

---

### Task 1: Period Filters

**Files:**
- Modify: `src/components/Dashboard.tsx`
- Modify: `src/components/VehicleHistory.tsx`
- Modify/Test: `src/utils/dashboardMetrics.js`, `scripts/test-dashboard-metrics.mjs`

- [x] Add `custom` timeframe state with start/end dates.
- [x] Filter dashboard metrics by selected custom period.
- [x] Filter vehicle history cards, detail records, and CSV export by date range.
- [x] Keep `Total geral` available for lifetime reporting.

### Task 2: Password Reset Backend

**Files:**
- Create: `server/password-reset.mjs`
- Modify: `server/index.mjs`
- Modify: `.env.example`, `docker-compose.yml`, `package.json`
- Test: `scripts/test-password-reset.mjs`

- [x] Generate strong temporary passwords.
- [x] Add SES email sender gated by `PASSWORD_RESET_FROM_EMAIL`.
- [x] Add public forgot-password route with rate limit and generic response.
- [x] Add admin reset route that returns the temporary password and attempts email when requested.
- [x] Delete existing sessions for reset user after successful password update.

### Task 3: Password Reset UI

**Files:**
- Modify: `src/components/Login.tsx`
- Modify: `src/components/Settings.tsx`
- Modify: `src/services/api.ts`

- [x] Add forgot-password modal/form on login.
- [x] Add reset-password action per user in settings.
- [x] Show generated temporary password to administrators after manual reset.
- [x] Show email status without exposing secrets.

### Task 4: Verification and Deploy

- [x] Run password reset tests, dashboard tests, existing client registration tests, lint, docs check, build.
- [x] Update persistent docs.
- [ ] Commit, push to `main`, watch deploy, verify public SHA and health.
