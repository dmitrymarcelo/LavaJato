# Interacoes Leves Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tornar o sistema mais vivo e responsivo sem alterar dados, regras, identidade visual ou estabilidade operacional.

**Architecture:** A animacao sera limitada ao frontend. Utilitarios numericos puros dirigem a contagem dos KPIs, classes CSS controlam entrada e resposta de superficies, e `prefers-reduced-motion` desativa os movimentos para acessibilidade.

**Tech Stack:** React 19, TypeScript, CSS/Tailwind, requestAnimationFrame, testes Node.

---

### Task 1: Proteger o comportamento visual

**Files:**
- Create: `scripts/test-ui-motion.mjs`
- Modify: `package.json`

- [x] Criar teste para interpolacao numerica, classes de entrada e fallback `prefers-reduced-motion`.
- [x] Executar `pnpm run test:ui-motion` e confirmar falha antes da implementacao.

### Task 2: Implementar animacoes leves

**Files:**
- Create: `src/utils/uiMotion.js`
- Modify: `src/index.css`
- Modify: `src/App.tsx`
- Modify: `src/components/Dashboard.tsx`
- Modify: `src/components/Sidebar.tsx`

- [x] Implementar interpolacao com easing para KPIs.
- [x] Animar entrada de telas e cards sem alterar dimensoes.
- [x] Aplicar resposta de hover somente em dispositivos que suportam hover.
- [x] Desativar animacoes quando o sistema solicitar movimento reduzido.

### Task 3: Validar e publicar

**Files:**
- Modify: `AGENTS.md`
- Modify: `SKILLS.md`
- Modify: `HANDOFF.md`

- [x] Executar teste visual, TypeScript, testes existentes e build.
- [ ] Conferir desktop e mobile no navegador.
- [ ] Publicar em `main`, validar SHA e API.
- [ ] Comparar desempenho e manter a tag `stable-before-motion-2026-06-22` como rollback.
