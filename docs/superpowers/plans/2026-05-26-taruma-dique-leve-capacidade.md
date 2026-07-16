# Taruma Dique Leve Capacidade Implementation Plan

**Goal:** Replace Taruma heavy-dike scheduling with a single `Dique Leve` capacity rule: 3 vehicles per slot, 1 light vehicle at 17:00.

**Architecture:** Add a small shared utility for Taruma scheduling rules, then connect it to frontend slot display and backend booking validation.

---

### Task 1: Rule Test

**Files:**
- Create: `scripts/test-taruma-scheduling-rules.mjs`
- Modify: `package.json`

- [x] Add a failing test for Taruma default zone, capacity, and mixed-category counting.
- [x] Verify the test fails before implementation.

### Task 2: Shared Rule Utility

**Files:**
- Create: `src/utils/tarumaSchedulingRules.js`

- [x] Export the single Taruma zone, active statuses, capacity helper, usage helper, and full-slot helper.
- [x] Verify `pnpm run test:taruma-rules` passes.

### Task 3: Frontend Scheduling

**Files:**
- Modify: `src/components/Scheduling.tsx`

- [x] Remove the selectable Taruma `Dique Pesada` path for new appointments.
- [x] Display Taruma as `Dique Leve` with 3 slots, except 1 light vehicle at `17:00`.
- [x] Count every active Taruma appointment in the same slot regardless of vehicle category.

### Task 4: Backend Guardrail

**Files:**
- Modify: `server/index.mjs`
- Modify: `server/schema.sql`

- [x] Normalize new Taruma writes to `dique_leve`.
- [x] Reject Taruma overbooking in the API before persistence.
- [x] Stop schema backfill from inferring `dique_pesada` for missing Taruma zones.

### Task 5: Verification and Deploy

- [x] Run local tests and build.
- [x] Update persistent docs.
- [x] Commit and push.
- [x] Validate GitHub Actions deploy.
- [x] Validate production health and public SHA.
