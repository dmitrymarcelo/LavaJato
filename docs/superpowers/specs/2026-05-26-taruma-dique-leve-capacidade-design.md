# Taruma Dique Leve Capacidade Design

Atualizado em: 2026-05-26

## Objetivo

Atualizar a regra operacional da Base Taruma: o `Dique Pesada` nao e mais usado para novos agendamentos, e o `Dique Leve` passa a atender qualquer categoria com limite unico por horario.

## Regras

- Todo novo agendamento da Base Taruma deve gravar `washingZoneId=dique_leve`.
- A categoria do veiculo nao altera a capacidade da Base Taruma.
- Horarios `07:00`, `09:00`, `11:00`, `13:00` e `15:00`: maximo de `3` veiculos.
- Horario `17:00`: maximo de `1` veiculo leve.
- Agendamentos ativos sao `confirmed` e `pending`.
- Registros historicos com `dique_pesada` ou `estacionamento` continuam legiveis, mas nao devem abrir novas vagas nem aparecer como opcao para novos agendamentos.

## Arquitetura

A regra compartilhada fica em `src/utils/tarumaSchedulingRules.js`. A tela `Scheduling.tsx` usa esse modulo para mostrar lotacao e criar payloads sempre em `Dique Leve`. O backend `server/index.mjs` usa a mesma fonte para normalizar Taruma e bloquear overbooking antes de persistir o agendamento.

## Validacao

- `pnpm run test:taruma-rules`
- `pnpm run lint`
- `pnpm run build`
- validacao publica depois do deploy por `app-build-sha`, `/api/health` e consulta read-only de capacidade/dados.
