# Handoff Lava Jato - Norte Tech

Atualizado em: 2026-03-09

## Estado atual

- Repositorio: `https://github.com/dmitrymarcelo/LavaJato`
- Branch principal: `main`
- Commit atual: `f91c376`
- Producao AWS atual: `http://3.145.153.19/`
- Regiao AWS: `us-east-2`
- Instancia usada no deploy: `i-0ba1477cbbe3d986d`

## Como continuar em outro computador

1. Clonar o repositorio.
2. Abrir este arquivo `HANDOFF.md`.
3. Rodar a aplicacao local com Docker:

```powershell
docker compose up -d --build
```

4. Acessar:

- Frontend: `http://localhost/` ou `http://localhost:80/`
- API: `http://localhost:4000/api/health`

## Arquitetura atual

- Frontend: React + Vite
- Backend: Express
- Banco: PostgreSQL
- Infra local: `docker-compose.yml`
- Proxy web: Nginx em `infra/nginx/default.conf`
- Assistente: AWS Bedrock via backend

## Variaveis principais

Base em `.env.example`:

```env
# Frontend
VITE_GEMINI_API_KEY="MY_GEMINI_API_KEY"
VITE_API_URL="/api"

# Backend
API_PORT=4000
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/lavajato"
```

Observacao:

- O frontend usa `VITE_API_URL=/api` em producao por causa do proxy Nginx.
- O backend real usa PostgreSQL.
- O Gemini no frontend nao e mais o caminho principal do assistente; o fluxo atual usa backend/AWS.

## Credencial padrao de teste

- Matricula: `1001`
- Senha: `Admin@123456!`

## Decisoes importantes tomadas

- O sistema sempre abre no `Painel`, aba `Hoje`.
- `Agenda & Fila` abre direto em `Agendamentos`.
- O agendamento escolhe a `Base` no proprio formulario.
- Sabado: atendimento ate `12:00`.
- Domingo: bloqueado.
- Capacidade por horario:
  - `2` caminhoes
  - `3` outros veiculos
  - `5` vagas totais
- Nao pode existir a mesma placa no mesmo horario e mesma data em agendamento ativo.
- Os cards da fila possuem menu de `Editar` e `Excluir`.
- A foto `Frente` do checklist vira imagem principal do card do veiculo.
- `Inspecao Pre` e `Inspecao Pos` exigem no minimo `1` foto.

## Correcoes estruturais recentes

### Performance

- O `bootstrap` inicial estava muito pesado porque trazia fotos completas dos servicos.
- Agora o `bootstrap` carrega servicos sem fotos pesadas, e o detalhe completo do servico e buscado sob demanda.
- Medicao feita:
  - antes: cerca de `24s` e `5.3 MB`
  - depois: cerca de `2.7s` e `1.6 MB`

### Persistencia

- O fluxo de agendamento foi tornado transacional.
- O `upsert` de `services` foi corrigido no campo `post_inspection_photos`.
- Uploads de fotos foram endurecidos:
  - compressao maior no frontend
  - limite maior na API
  - limite maior no Nginx
- Endpoints `PUT` em lote deixaram de usar `TRUNCATE` direto e passaram a usar substituicao transacional.
- Isso vale para:
  - `vehicles`
  - `services`
  - `appointments`
  - `products`
  - `team-members`

## Commits recentes relevantes

- `f91c376` `perf: trim bootstrap payload for dashboard`
- `7db96f9` `fix: make bulk persistence transactional`
- `3cdf139` `fix: harden wash completion photo uploads`
- `4ea3cbc` `feat: add queue card action menu`
- `3f6714a` `fix: default dashboard to today view`
- `a934d6f` `refactor: open scheduling directly from queue`
- `a959469` `fix: show real daily metrics in branch view`
- `eee1e9d` `fix: scope scheduling by selected base`

## Arquivos centrais

- `src/App.tsx`
- `src/components/Dashboard.tsx`
- `src/components/Scheduling.tsx`
- `src/components/InspectionPre.tsx`
- `src/components/InspectionPost.tsx`
- `src/components/Payment.tsx`
- `src/components/Inventory.tsx`
- `src/components/Settings.tsx`
- `src/services/api.ts`
- `src/utils/app.ts`
- `server/index.mjs`
- `server/schema.sql`
- `server/seed.mjs`
- `docker-compose.yml`
- `infra/nginx/default.conf`

## Deploy AWS

O deploy vinha sendo feito via AWS CloudShell com SSM.

Padrao usado:

```bash
aws ssm send-command --region us-east-2 --instance-ids i-0ba1477cbbe3d986d --document-name AWS-RunShellScript --comment "Deploy LavaJato <commit>" --parameters '{"commands":["cd /opt/lavajato/app","git fetch origin","git checkout main","git pull --ff-only origin main","docker compose up -d --build","docker compose ps"]}' --query "Command.CommandId" --output text
```

Depois consultar:

```bash
aws ssm list-command-invocations --region us-east-2 --command-id <command-id> --details --query "CommandInvocations[].{Status:Status,Output:CommandPlugins[0].Output}" --output json
```

## Observacoes importantes

- Este arquivo nao guarda o chat literal. Ele guarda o contexto tecnico consolidado para continuar o trabalho.
- O GitHub e a fonte principal da continuidade.
- Se mudar de computador, o ideal e continuar a partir do commit `f91c376` ou posterior.

## Proximo ponto de investigacao sugerido

- Se ainda houver lentidao percebida, medir:
  - tempo de resposta do `bootstrap`
  - tempo de upload das fotos
  - tempo de persistencia de `upsertService` e `bookScheduling`
  - tamanho real dos payloads enviados nas inspeções
