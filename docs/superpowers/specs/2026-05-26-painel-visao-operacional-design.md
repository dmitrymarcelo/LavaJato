# Painel Visao Operacional Design

Atualizado em: 2026-05-26

## Objetivo

Melhorar a leitura executiva do `Painel` sem alterar dados de producao, adicionando uma metrica vitalicia de lavagens e limpando codigo local que nao agrega comportamento.

## Escopo

- Exibir no `Painel` o total de veiculos lavados ate hoje.
- Mostrar tambem quantas placas unicas existem nesse historico.
- Considerar como lavado o servico `completed`, `waiting_payment` ou com marcos de conclusao de lavagem/pos-inspecao/pagamento na timeline.
- Excluir `no_show`.
- Criar teste automatizado da regra de contagem.
- Reutilizar cache curto da dica inteligente para reduzir chamadas repetidas ao assistente quando o usuario volta ao `Painel`.
- Proteger o repositorio contra commit acidental de arquivos CSV de chaves.
- Criar memoria Obsidian do projeto sem copiar segredos em texto puro.

## Fora de escopo

- Alterar banco de dados ou apagar registros.
- Reestruturar componentes grandes como `App.tsx`, `Scheduling.tsx` ou `Settings.tsx`.
- Guardar senhas, tokens, access keys ou secrets em Obsidian.
- Trocar o fluxo de deploy atual.

## Arquitetura

A regra de contagem vitalicia fica em `src/utils/dashboardMetrics.js`, como funcao pura reutilizavel e testavel. O `Dashboard.tsx` consome essa funcao para renderizar um novo card no grid de metricas. A protecao contra chaves entra no `.gitignore`; a memoria operacional externa entra no vault Obsidian local.

## Validacao

- `pnpm run test:dashboard`
- `pnpm run lint`
- `pnpm run build`
- verificacao visual local em `http://localhost:3000/`
- deploy em `main`
- validacao publica por `app-build-sha` e `/api/health`
