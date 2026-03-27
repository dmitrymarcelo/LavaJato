# Handoff Lava Jato - Norte Tech

Atualizado em: 2026-03-27

## Estado atual

- Repositorio: `https://github.com/dmitrymarcelo/LavaJato`
- Branch principal: `main`
- Commit atual: `16697dcd08d239b2f3550543a8de020cab88701a`
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

5. Verificar status rapido:

- `docker compose ps`
- `docker compose logs api --tail 50`

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

# Backend (AWS Bedrock)
# Opcional em desenvolvimento; necessario em producao se usar o assistente
AWS_REGION="us-east-2"
AWS_BEDROCK_REGION="us-east-2"
AWS_BEDROCK_MODEL_ID="us.amazon.nova-lite-v1:0"
```

Observacao:

- O frontend usa `VITE_API_URL=/api` em producao por causa do proxy Nginx.
- O backend real usa PostgreSQL.
- O Gemini no frontend nao e mais o caminho principal do assistente; o fluxo atual usa backend/AWS.
- O seed cria um usuario administrador com credenciais abaixo na primeira inicializacao da API.

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
- Fotos de inspecao no mobile agora usam salvamento atomico por foto para evitar sobrescrita entre requisicoes lentas.
- Se a rede oscilar, as fotos entram em fila local no aparelho e tentam sincronizar ao voltar conexao, foco, visibilidade da aba e em retentativas periodicas.
- O modal de fotos da fila/agendamento passou a exibir fallback local e avisar quando ainda existe sincronizacao pendente no aparelho.
- Inicio e finalizacao de lavagem no mobile agora usam transicoes atomicas separadas do `upsert` completo do servico.
- O backend passou a expor:
  - `POST /api/services/:id/start-wash`
  - `POST /api/services/:id/complete-wash`
- O smartphone tambem mantem fila local para essas transicoes operacionais.
- Se a internet cair depois de iniciar ou finalizar:
  - a etapa muda localmente no aparelho
  - a fila exibe aviso de sincronizacao pendente
  - o app reenvia automaticamente quando voltar conexao, foco ou visibilidade
- Isso reduz o risco de o time reiniciar a mesma lavagem por falta de confirmacao imediata do servidor.
- A carga da base de veiculos em `Configuracoes` agora ignora respostas antigas da API quando a lista local ja mudou, evitando que um CSV importado suma da tela logo apos a importacao.
- A tela `Configuracoes` passou a usar feedback visual nativo do app para sucesso, erro e confirmacoes, evitando `alert` e `confirm` do navegador nessa area.
- Endpoints `PUT` em lote deixaram de usar `TRUNCATE` direto e passaram a usar substituicao transacional.
- Isso vale para:
  - `vehicles`
  - `services`
  - `appointments`
  - `products`
  - `team-members`

## Commits recentes relevantes

- `16697dc` `ci: force fresh frontend rebuild on aws`
- `b7d644c` `docs: refresh persistence after settings feedback update`
- `305e31a` `feat: replace settings dialogs with in-app feedback`
- `b6634e9` `docs: refresh persistence after vehicle import fix`
- `8369a9a` `fix: preserve imported vehicles and remove ai button`
- `83c4cc9` `docs: refresh persistence files after sync automation`
- `e7acf00` `ci: sync persistence docs across aws`
- `80b404b` `docs: refresh HANDOFF after AGENTS guide`

## Arquivos centrais

- `AGENTS.md`
- `SKILLS.md`
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

### CI/CD automatico (GitHub Actions)

Agora o deploy e automatico a cada `push` na `main`:

- Workflow: `.github/workflows/deploy.yml`
- Regiao: `us-east-2`
- Instancia: `i-0ba1477cbbe3d986d`
- Requisito: configurar o segredo `AWS_ROLE_ARN` no repositorio, apontando para um IAM Role com permissao `ssm:SendCommand` na instancia alvo.

Permissoes minimas recomendadas do Role:

- `sts:AssumeRole` confiando no provedor OIDC do GitHub (`token.actions.githubusercontent.com`) com `sub: repo:dmitrymarcelo/LavaJato:*`
- `ssm:SendCommand`, `ssm:ListCommandInvocations`
- `ec2:DescribeInstances`

Com isso, qualquer alteracao publicada em `main` dispara o deploy via SSM no EC2.

### Handoff automatico na AWS

- Durante cada deploy em `main`, o GitHub Actions gera um handoff atualizado para o commit publicado.
- Em seguida, o workflow envia essa copia pronta para a EC2 via SSM.
- O mesmo fluxo agora sincroniza tambem `AGENTS.md` e `SKILLS.md` com metadados do commit implantado.
- O deploy do frontend agora injeta `APP_BUILD_SHA` no build e usa `docker compose up -d --build --force-recreate` para evitar que a web continue servindo bundles antigos apos publicacoes novas.
- O handoff sincronizado fica no proprio repo da instancia em `/opt/lavajato/app/HANDOFF.md`.
- As referencias operacionais adicionais ficam em:
  - `/opt/lavajato/app/AGENTS.md`
  - `/opt/lavajato/app/SKILLS.md`
- Uma copia operacional tambem e salva em `/opt/lavajato/runtime/HANDOFF_AWS.md`.
- Copias operacionais adicionais tambem sao salvas em:
  - `/opt/lavajato/runtime/AGENTS_AWS.md`
  - `/opt/lavajato/runtime/SKILLS_AWS.md`
- Isso garante que a memoria persistente acompanhe o commit realmente implantado.

## Observacoes importantes

- Este arquivo nao guarda o chat literal. Ele guarda o contexto tecnico consolidado para continuar o trabalho.
- `AGENTS.md` passa a ser a referencia principal de agentes, skills, ownership, KPIs e guardrails do projeto.
- `SKILLS.md` passa a ser a referencia persistente de capacidades reutilizaveis e contratos tecnicos do projeto.
- O botao flutuante do assistente IA foi removido da UI principal; a integracao Bedrock segue existente no backend, mas sem CTA visivel no app.
- O GitHub e a fonte principal da continuidade.
- Se mudar de computador, o ideal e continuar a partir do commit `16697dc` ou posterior.
- Imagens enviadas ficam em `server/storage/uploads` (persistidas via volume Docker).
- Em producao, altere a senha do administrador imediatamente.

## Proximo ponto de investigacao sugerido

- Prioridade recomendada agora:
  - habilitar HTTPS na producao para melhorar confiabilidade de camera/upload no celular
  - endurecer autorizacao de backend nos endpoints administrativos
  - remover a senha padrao previsivel na criacao de usuarios
- Se ainda houver lentidao percebida, medir:
  - tempo de resposta do `bootstrap`
  - tempo de upload das fotos
  - tempo de persistencia de `upsertService` e `bookScheduling`
  - tamanho real dos payloads enviados nas inspeções
