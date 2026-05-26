# Painel Visao Operacional Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a lifetime washed-vehicles metric to the dashboard, protect secret files, document operational memory, and deploy safely.

**Architecture:** Keep the counting rule in a small pure utility, render it from `Dashboard.tsx`, and avoid touching database state. Use existing GitHub Actions deployment to publish after local verification.

**Tech Stack:** React, Vite, TypeScript with `allowJs`, Node.js scripts, AWS SSM deploy.

---

### Task 1: Dashboard Metric Rule

**Files:**
- Create: `src/utils/dashboardMetrics.js`
- Create: `scripts/test-dashboard-metrics.mjs`
- Modify: `package.json`

- [x] Write a failing Node assertion test for completed, waiting-payment, timeline-completed, no-show, and pending services.
- [x] Implement `getLifetimeWashSummary(services)`.
- [x] Add `pnpm run test:dashboard`.
- [x] Run `pnpm run test:dashboard`.

### Task 2: Dashboard UI

**Files:**
- Modify: `src/components/Dashboard.tsx`

- [x] Import `getLifetimeWashSummary`.
- [x] Render `Lavados ate hoje` as a dedicated metric card.
- [x] Show unique plates as secondary context.
- [x] Remove the unused `motion` import.
- [x] Simplify the local demand bar helper to the horizontal-only behavior used by this component.
- [x] Cache dashboard advisory text briefly in `sessionStorage`.

### Task 3: Secret Hygiene

**Files:**
- Modify: `.gitignore`

- [x] Ignore `*accessKeys*.csv`.
- [x] Ignore `*access-keys*.csv`.
- [x] Do not read or copy secret CSV contents.

### Task 4: Obsidian Memory

**Files:**
- Create: Obsidian project memory note under the local notes area.

- [x] Record AWS IDs, repository, production URL, deploy path, snapshot, commands, and guardrails.
- [x] Reference secret locations without storing secret values.

### Task 5: Verification and Deploy

**Files:**
- Modify: `AGENTS.md`
- Modify: `SKILLS.md`
- Modify: `HANDOFF.md`

- [x] Run `pnpm run test:dashboard`.
- [x] Run `pnpm run lint`.
- [x] Run `pnpm run build`.
- [x] Run `pnpm run docs:update`.
- [ ] Commit changes.
- [ ] Push to `origin main`.
- [ ] Monitor GitHub Actions or validate AWS deployment directly.
- [ ] Confirm public `app-build-sha` and `/api/health`.
