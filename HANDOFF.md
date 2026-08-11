# Handoff Lava Jato - Norte Tech

Atualizado em: 2026-08-11

## Estado atual

- Repositorio: `https://github.com/dmitrymarcelo/LavaJato`
- Branch principal: `main`
- Commit atual: `3318ac03e8a21f613b6dbdbd4f56cb0e21c8100e`
- Arquitetura Backend: **Supabase Serverless (Edge Functions + Postgres + Storage)** — sem dependência de EC2/AWS
- Project Ref Supabase: `vqutbhklwnvvpmvletqb`
- Edge Function API: `https://vqutbhklwnvvpmvletqb.supabase.co/functions/v1/api`
- Cloudflare Pages Proxy: `infra/cloudflare/pages-worker.js` (redireciona `/api/*` para Supabase Edge Function e `/uploads/*` para Supabase Storage)

## Como rodar localmente

1. Clonar o repositorio.
2. Rodar a aplicacao com Vite:

```powershell
npm run dev
```

3. Frontend disponivel em: `http://localhost:5173/` (ou porta informada pelo Vite).
4. API direta validada em: `https://vqutbhklwnvvpmvletqb.supabase.co/functions/v1/api/health`

## Arquitetura atual (Zero AWS)

- **Frontend**: React + Vite
- **Backend / API**: Supabase Edge Function (`supabase/functions/api/index.ts`) rodando Deno runtime
- **Autenticacao**: Bearer Token persistido no navegador via `auth_sessions` no Supabase
- **Banco de Dados**: PostgreSQL embutido no Supabase (`vqutbhklwnvvpmvletqb`)
- **Storage / Uploads**: Supabase Storage (bucket `uploads`)
- **Edge Routing**: Cloudflare Worker (`infra/cloudflare/pages-worker.js`)

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

# Reset de senha por email via AWS SES
PUBLIC_APP_URL="https://3-145-153-19.sslip.io/"
AWS_SES_REGION="us-east-2"
PASSWORD_RESET_FROM_EMAIL=""
PASSWORD_RESET_FROM_NAME="Lava Jato Norte Tech"
PASSWORD_RESET_REPLY_TO=""
```

Observacao:

- O frontend usa `VITE_API_URL=/api` em producao por causa do proxy Nginx.
- O backend real usa PostgreSQL.
- O Gemini no frontend nao e mais o caminho principal do assistente; o fluxo atual usa backend/AWS.
- Em producao, o primeiro seed administrativo agora depende de `ADMIN_INITIAL_PASSWORD`.
- A sessao do usuario agora e mantida por cookie `HttpOnly`, com configuracao por `SESSION_COOKIE_*`.

## Credencial padrao de teste

- Desenvolvimento local:
  - Matricula: `1001`
  - Senha: `Admin@123456!`
- Producao nova:
  - definir `ADMIN_INITIAL_PASSWORD` antes do primeiro seed
  - a senha padrao nao deve ser usada como referencia operacional

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
- Base Taruma:
  - nao usa mais `Dique Pesada`
  - todo veiculo agenda em `Dique Leve`
  - limite normal: `3` veiculos por horario (`2` leves + `1` caminhao)
  - caminhao exige intervalo minimo de `3h` entre agendamentos
  - `17:00`: `1` veiculo leve; caminhao nao e aceito nesse horario
- Base Flores:
  - nao atende segunda, quarta, sexta e domingo
  - terca e quinta: `08:00-12:00` e `14:00-18:00`
  - sabado: `08:00-12:00`
  - veiculo leve ocupa `1h30`; caminhao ocupa `2h`
  - a agenda bloqueia qualquer sobreposicao de intervalo
  - a regua de datas oculta dias fechados e move a selecao para o proximo dia aberto
- Nao pode existir a mesma placa no mesmo horario e mesma data em agendamento ativo.
- Os cards da fila possuem menu de `Editar` e `Excluir`.
- A foto `Frente` do checklist vira imagem principal do card do veiculo.
- `Inspecao Pre` e `Inspecao Pos` permitem iniciar e concluir sem fotos; os anexos permanecem opcionais.
- Regra visual permanente: criar telas em tons claros, com branco/cinza suave como base e ambar da marca como acento; evitar fundos escuros ou preto/navy pesado porque a gestao prefere uma experiencia leve e harmoniosa.
- Regra atual de perfis: `Administrador` permanece como acesso total protegido; `Colaboradores` e o perfil configuravel para funcionarios; `Lavador` fica para operacao de lavagem; `Clientes` permanece somente com agendamento nas bases liberadas.

## Correcoes estruturais recentes

### Permissoes e equipe

- `Acesso & Equipe` passou a separar `Colaboradores` de `Administrador`, mantendo administradores com acesso total e colaboradores com permissoes ligaveis/desligaveis.
- A matriz de permissoes foi ampliada para agenda/fila, criacao de agendamento, operacao de lavagem, pagamento, relatorios, base de veiculos, estoque, equipe, servicos/precos, exclusoes, bypass de inspecao e gerenciamento de permissoes.
- `Clientes` fica travado em `Agendamento do Cliente`, sem virar perfil administrativo por acidente.
- `Lavador` recebe `Ver Agenda & Fila` e `Operar Lavagens` na migracao das regras antigas para nao perder acesso operacional apos o deploy.
- A aba `Cadastros de Clientes` foi renomeada para `Base de Veiculos`, alinhando o nome ao conteudo real da tela.
- `Novo Colaborador` agora tambem mostra `Bases Permitidas`; colaboradores com bases marcadas ficam limitados a essas bases nas consultas e mutacoes por base, enquanto sem marcacao continuam com acesso geral.
- Novos agendamentos passam a gravar `created_by_id` e `created_by_name`; `Agenda & Fila` mostra `Agendado por ...` no card do agendamento.

### Identidade visual clara

- A tela de login deixou o visual escuro e passou a usar superficies brancas, painel institucional claro, chips com borda ambar e acoes mais harmonicas com a logomarca.
- A sidebar, clima, modais e acoes principais foram ajustados para tons claros com ambar controlado, reduzindo o peso visual do sistema.
- `src/index.css` passou a centralizar a cor primaria em ambar e a corrigir classes legadas do card de clima para manter contraste sobre fundo claro.
- Botoes que ainda puxavam azul escuro ou slate pesado foram trocados para estados ambar, preservando foco visual sem deixar a interface pesada.

### Painel e memoria operacional

- O `Painel` passou a exibir `Lavados ate hoje`, com total vitalicio de lavagens e quantidade de placas unicas no historico.
- A regra de contagem foi isolada em `src/utils/dashboardMetrics.js` e coberta por `pnpm run test:dashboard`.
- O `Painel` passou a ter filtro `Total Geral` junto de `Hoje`, `Semana` e `Mes`.
- A previsao de clima passou a ficar fixa na sidebar, em formato empilhado e mais detalhado (chuva, probabilidade e vento), com dados reais via `Open-Meteo` e fallback consultivo via `Assistente`, atualizando automaticamente.
- Titulos das paginas foram centralizados no header e os subtitulos foram removidos.
- Arquivos locais de chaves `*accessKeys*.csv` e `*access-keys*.csv` foram protegidos no `.gitignore` para reduzir risco de commit acidental.
- Foi criada memoria Obsidian em `C:\Users\dmitry.santos\Downloads\Lembranças\Lava Jato Norte Tech.md`, registrando infraestrutura, deploy, comandos e guardrails sem copiar segredos em texto puro.

### Performance

- O `bootstrap` inicial estava muito pesado porque trazia fotos completas dos servicos.
- Agora o `bootstrap` carrega servicos sem fotos pesadas, e o detalhe completo do servico e buscado sob demanda.
- O refresh do `bootstrap` a cada `30s` e executado em segundo plano: nao ativa a tela global de carregamento, nao altera a navegacao atual e nao apaga a sessao/dados por falha transitoria de rede.
- Medicao feita:
  - antes: cerca de `24s` e `5.3 MB`
  - depois: cerca de `2.7s` e `1.6 MB`

### Persistencia

- O fluxo de agendamento foi tornado transacional.
- O modal `Novo Agendamento` agora herda a data selecionada na regua principal de `Agenda & Fila`, inclusive pelo atalho `Agendar agora`, para evitar abertura com dia divergente do contexto visual.
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

### Seguranca

- A autenticacao do frontend deixou de usar `sessionStorage` para token.
- O backend agora cria sessao em `auth_sessions` e devolve cookie `HttpOnly`.
- A tela de login agora possui autocadastro de cliente: cria role `Clientes`, exige senha forte, base autorizada e pelo menos `1` veiculo, abre sessao imediatamente e rejeita placa ja existente para nao sobrescrever dados.
- A tela de login agora possui `Esqueceu senha?`: quando AWS SES/remetente estiver configurado, o cliente recebe uma senha temporaria no email cadastrado, sem revelar se o email existe.
- `Configuracoes` permite reset manual de senha por administrador: gera senha temporaria, invalida sessoes antigas, permite copiar a senha e tenta enviar email se o usuario tiver email cadastrado.
- O acesso `Clientes` agora filtra bootstrap, listas, historico e consulta de placa pelo dono do cadastro, impedindo que um cliente visualize placas/agendamentos de outros clientes na mesma base.
- Requisicoes mutantes em `/api` validam origem confiavel via `Origin`/`Referer` antes de alterar estado.
- O `bootstrap` agora entrega ao frontend o conjunto de permissoes do usuario autenticado.
- A matriz `access_rules` passou a fazer enforcement real no backend para:
  - `manage_access`
  - `manage_team`
  - `edit_services`
  - `delete_services`
  - `manage_inventory`
  - `view_analytics`
- `Historico de Veiculos` agora exige permissao de analytics tambem na API.
- Inicio e conclusao de lavagem nao exigem fotos para nenhum perfil com permissao `operate_wash`; `bypass_inspection` permanece apenas como ID legado nas regras persistidas.
- Exclusoes operacionais agora exigem permissao `delete_services`.
- Isso reduz o risco de o time reiniciar a mesma lavagem por falta de confirmacao imediata do servidor.
- A carga da base de veiculos em `Configuracoes` agora ignora respostas antigas da API quando a lista local ja mudou, evitando que um CSV importado suma da tela logo apos a importacao.
- A importacao da base de veiculos agora usa `bulk upsert` transacional no backend e envio em lotes no frontend.
- Isso reduz drasticamente o tempo para importar CSVs grandes e evita perder parte da base quando a rede oscila no meio da sincronizacao.
- A tela `Cadastros de Clientes` passou a mostrar `Carregando base de veiculos...` enquanto busca a lista remota, evitando o falso estado de vazio logo apos refresh.
- A causa raiz da lista presa em `Carregando base de veiculos...` era um efeito do React em `src/App.tsx` dependente da propria flag `isVehicleDbLoading`.
- Quando a busca comecava, a mudanca dessa flag disparava o cleanup do proprio efeito, cancelava a resposta valida de `/api/vehicles` e deixava a tela travada em loading infinito.
- A correcao foi remover essa dependencia ciclica do efeito de carga da base.
- A tela `Configuracoes` passou a usar feedback visual nativo do app para sucesso, erro e confirmacoes, evitando `alert` e `confirm` do navegador nessa area.
- O fluxo de `Notificacoes` deixou de ser apenas estrutural e passou a receber eventos operacionais reais.
  - O sino usa `toggle` dedicado, sem reaproveitar o handler de fechamento, o que evita comportamento confuso no clique.
- Inicio de lavagem, conclusao de lavagem, pagamento concluido e retomada de sincronizacao offline agora alimentam a central de notificacoes.
- Ao concluir uma lavagem, o app abre um popup leve de `Concluido` no topo da tela e segue direto para `Pagamento`, sem travar o operador.
- A confirmacao de lavagem concluida foi reforcada na propria tela `Pagamento`, com um banner leve por alguns segundos para o operador mobile nao perder o feedback durante a navegacao.
- O fluxo de `Pagamento` deixou de usar `alert` do navegador nesse caso e passou a manter o erro inline, preservando a velocidade e evitando interrupcao brusca no smartphone.
- As notificacoes agora fazem deduplicacao por `id`, reduzindo spam visual em replay offline ou retentativas.
- `Historico de Veiculos > Exportar CSV` agora leva mais contexto operacional:
  - tipo de veiculo
  - ultimo tipo de lavagem
  - ultimo status
  - ultimo valor
  - ultimo responsavel
  - ticket medio
  - media e ultimo tempo de lavagem
  - tempo de espera, pagamento e tempo total
- O CSV detalhado por veiculo tambem passou a incluir cliente, tipo de veiculo, responsaveis, terceiro, observacoes e tempos operacionais completos.
- O `Painel` agora tem `Periodo livre` alem de `Hoje`, `Semana`, `Mes` e `Total geral`; faturamento, volume, lavados, bases, ranking e recentes passam a respeitar o intervalo escolhido.
- O `Painel` foi reorganizado para remover o espaco vazio causado por cards esticados: demanda, resumo gerencial e top lavadores ficam em uma coluna independente, bases ficam na coluna lateral, e existe o botao `Relatorio completo` com indicadores prontos para apresentacao/print.
- `Historico de Veiculos` agora tambem tem `Periodo livre`; o filtro e enviado para a API, entao resumos, detalhes e CSVs usam o mesmo intervalo.
- Endpoints `PUT` em lote deixaram de usar `TRUNCATE` direto e passaram a usar substituicao transacional.
- Isso vale para:
  - `vehicles`
  - `services`
  - `appointments`
  - `products`
  - `team-members`

### Seguranca

- O backend deixou de aceitar `CORS` totalmente aberto.
- A API agora aceita somente mesmo-origem ou origens explicitamente listadas em `CORS_ALLOWED_ORIGINS`.
- Rotas administrativas sensiveis agora fazem autorizacao real de servidor via `assertUserIsAdmin`, reduzindo o risco de bypass da UI.
- A UI tambem passou a esconder `Configuracoes` para perfis nao administrativos, alinhando navegacao e backend.
- Isso vale para:
  - `access-rules`
  - `service-types`
  - `vehicles` administrativos
  - `products` de escrita
  - `team-members`
- O login passou a ter rate limit no backend por IP + identificador, com janela configuravel e `Retry-After`.
- O backend agora valida senha forte e email no `upsert` de usuarios, em vez de confiar apenas no frontend.
- O fallback de senha previsivel em `team-members/upsert` foi removido.
- O seed administrativo passou a aceitar `ADMIN_INITIAL_PASSWORD`.
- Se `NODE_ENV=production` e `ADMIN_INITIAL_PASSWORD` nao estiver definido, a API emite warning explicito no startup.
- `persistUploadedImage` nao aceita mais URL remota arbitraria; agora so hosts da allowlist `ALLOWED_REMOTE_IMAGE_HOSTS`.
- Placeholders remotos de logo, avatar e imagens padrao foram trocados por SVGs locais no frontend, e o seed deixou de gravar avatares/produtos apontando para Unsplash ou Pravatar.
- O login nao bloqueia mais senhas validas antigas por uma regra de senha forte aplicada indevidamente na tela de autenticacao.
- `pnpm audit --prod` ficou sem vulnerabilidades ativas apos atualizar o SDK Bedrock e forcar `path-to-regexp` seguro.
- Foi criado um relatorio dedicado em `security_best_practices_report.md` com riscos corrigidos e riscos residuais.

### HTTPS e acesso mobile

- O acesso mobile ainda dependia de HTTP puro, o que prejudicava camera, upload e armazenamento em navegadores de smartphone.
- A producao passou a ser endurecida para publicar em hostname publico derivado do IP:
  - `https://<ip-publico-formatado>.sslip.io/`
- O deploy agora prepara:
  - porta `443` no `docker-compose.yml`
  - emissao automatica de certificado Let's Encrypt via `certbot` para o proprio IP publico
  - renovacao automatica por cron na EC2
  - headers basicos de seguranca no Nginx
- A causa raiz da primeira queda do ambiente HTTPS foi estrutural:
  - a imagem oficial do Nginx processava automaticamente todos os arquivos em `/etc/nginx/templates`
  - isso fazia os templates HTTP e HTTPS serem carregados juntos
  - o container tentava subir configuracao TLS mesmo sem certificado emitido
  - resultado: queda total do `web`, inclusive em HTTP
- A correcao aplicada foi:
  - mover os templates para `/opt/lavajato/nginx`
  - gerar apenas `1` arquivo final em `/etc/nginx/conf.d/default.conf`
  - validar HTTP antes de pedir certificado
  - validar `nginx -t` antes do reload final
  - despejar `docker compose ps` e logs de `web/api` automaticamente se o SSM falhar
- A iteracao atual elimina a dependencia operacional de `sslip.io`:
  - o acesso final passa a ser o proprio IP da EC2
  - o certificado e emitido diretamente para esse IP
  - isso simplifica o uso no smartphone e reduz uma camada de DNS no caminho

## Commits recentes relevantes

- `3318ac0` `Fix API URL fallback to use Supabase Edge Function directly in production (fixes 522 Cloudflare timeout)`
- `656e292` `fix(cloudflare): correct proxy URL resolution and sanitize HTML error responses`
- `ffec14e` `fix: add public/_worker.js for Cloudflare Pages proxy and optimize CORS OPTIONS`
- `00acaf6` `feat: migrar para Cloudflare Pages + Supabase Edge Functions (remover AWS)`
- `4e13262` `chore: prepare Supabase and Cloudflare migration`
- `b74c4bf` `fix: limitar Taruma as 17h a um veiculo`
- `80b0740` `fix: ajustar agenda da base flores`
- `e094862` `fix: tornar fotos opcionais nas inspecoes`

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
- `Dockerfile.web`
- `infra/nginx/http.conf.template`
- `infra/nginx/https.conf.template`
- `infra/nginx/render-config.sh`
- `infra/aws/renew-https.sh`
- `scripts/build-ssm-deploy-command.mjs`

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
- O deploy agora gera o payload SSM via `scripts/build-ssm-deploy-command.mjs` para reduzir erro de quoting e garantir que o SHA do GitHub seja enviado corretamente para a EC2.
- O build local e o build do container agora passam por `scripts/run-vite-build.mjs`, garantindo `VITE_APP_BUILD_SHA` padrao mesmo fora da AWS.
- Antes do `git pull`, a EC2 agora restaura `HANDOFF.md`, `AGENTS.md` e `SKILLS.md` diretamente do indice Git, evitando working tree suja sem apagar arquivos rastreados que ainda precisam ser copiados para `/opt/lavajato/runtime`.
- O frontend continua recebendo `APP_BUILD_SHA`, mas agora o `index.html` publica tambem a meta `app-build-sha` para validacao objetiva da build em producao.
- O deploy agora evita rebuild duplicado:
  - faz `docker compose build api web`
  - sobe com `docker compose up -d --force-recreate api web`
  - continua validando o SHA real servido em `http://localhost/`
- Isso acelerou o deploy sem abrir mao da confirmacao de versao publicada.
- O deploy HTTPS agora:
  - calcula `APP_HOST` a partir do IP publico da EC2
  - sobe primeiro em HTTP
  - valida que o frontend e a API estao servindo corretamente em `localhost`
  - emite ou renova o certificado do proprio IP publico
  - renderiza o config HTTPS definitivo e recarrega o Nginx
- Se algo falhar nesse caminho, o payload SSM agora imprime diagnostico automatico de containers e logs.
- Em falha de deploy, o SSM tambem publica um diagnostico temporario em `http://IP_PUBLICO/deploy-debug.txt` para acelerar depuracao remota sem CLI da AWS.
- O primeiro bloqueio real encontrado nessa trilha foi documental e nao de infraestrutura: o SSM apagava `AGENTS.md` e `SKILLS.md` antes do `git pull` e depois falhava ao tentar sincroniza-los para a pasta de runtime.
- O segundo bloqueio real apareceu ja dentro do endurecimento HTTPS: a EC2 ficava sem espaco ao baixar a imagem `certbot`, entao o deploy agora faz limpeza controlada de `containers`, `images` e `builder cache` antes da etapa TLS e publica `docker system df` no diagnostico.
- O terceiro bloqueio real foi de configuracao: sem `HTTPS_CERT_EMAIL` valido, o `certbot` recusava o cadastro. O deploy e a renovacao agora aceitam email real quando existir e fazem fallback automatico para emissao sem email de contato quando o secret estiver ausente.
- O quarto bloqueio real foi de timing: depois do `docker compose up`, o Nginx ficava de pe antes da API e o `curl /api/health` falhava com `502` por alguns segundos. O deploy agora espera o health check HTTP estabilizar antes de avancar para TLS.
- O quinto bloqueio real aconteceu ja depois do certificado emitido: a renovacao estava presa a `/etc/cron.d`, mas a EC2 nao tinha essa estrutura pronta. O deploy agora registra a renovacao via `systemd timer`, que e nativo da instancia e nao depende de `crond`.
- O sexto ajuste foi no proprio GitHub Actions: a etapa `Check SSM command result` trocou `list-command-invocations` por `get-command-invocation` na instancia alvo, separando `Status`, `Stdout` e `Stderr` para o workflow nao cair depois de um deploy que ja terminou funcionalmente.
- O setimo ajuste fechou o criterio de sucesso do pipeline: a leitura de SSM continua como diagnostico nao bloqueante, mas o job agora fica verde quando a URL publica em `HTTPS` estiver servindo o `app-build-sha` do commit publicado e `/api/health` responder corretamente.
- Em 2026-04-03 o acesso HTTPS direto no IP voltou a se mostrar frágil. O fluxo passou a preferir um hostname publico derivado do IP via `sslip.io`, que permite certificado HTTPS normal para navegador sem depender de certificado IP curto.
- O timer de renovacao foi corrigido para rodar a cada `6h`, com primeira execucao `5min` apos boot.
- A logica de renovacao do `certbot` foi endurecida: se o certificado estiver ausente, expirado ou com menos de `24h` restantes, o deploy e o timer usam `--force-renewal` em vez de confiar apenas no `--keep-until-expiring`.
  - O handoff sincronizado fica no proprio repo da instancia em `/opt/lavajato/app/HANDOFF.md`.
- As referencias operacionais adicionais ficam em:
  - `/opt/lavajato/app/AGENTS.md`
  - `/opt/lavajato/app/SKILLS.md`
- Copias operacionais tambem sao salvas em:
  - `/opt/lavajato/runtime/HANDOFF_AWS.md`
  - `/opt/lavajato/runtime/AGENTS_AWS.md`
  - `/opt/lavajato/runtime/SKILLS_AWS.md`
- Essas copias agora sao geradas diretamente a partir do checkout atualizado da EC2, sem reenviar os tres arquivos inteiros pelo payload SSM.
- Isso garante que a memoria persistente acompanhe o commit realmente implantado.

## Observacoes importantes

- Este arquivo nao guarda o chat literal. Ele guarda o contexto tecnico consolidado para continuar o trabalho.
- `AGENTS.md` passa a ser a referencia principal de agentes, skills, ownership, KPIs e guardrails do projeto.
- `SKILLS.md` passa a ser a referencia persistente de capacidades reutilizaveis e contratos tecnicos do projeto.
- O botao flutuante do assistente IA foi removido da UI principal; a integracao Bedrock segue existente no backend, mas sem CTA visivel no app.
- A logomarca oficial da empresa voltou para o login e para o canto superior esquerdo do sistema, mas agora empacotada localmente em `public/brand/nortetech-circle.png`, sem dependencia externa em runtime.
- A diretriz visual atual e `light-first`: branco, cinza muito suave e ambar; tons escuros devem ficar restritos a texto/contraste pontual, nunca como bloco dominante.
- O shell autenticado usa uma unica logomarca na barra lateral; a repeticao no cabecalho superior foi removida para reduzir ruido visual.
- O teste de interatividade usa apenas CSS e `requestAnimationFrame`: entrada curta das telas, contagem dos KPIs, elevacao sutil dos cards e resposta da navegacao, com fallback completo para `prefers-reduced-motion`.
- Rollback visual garantido pela tag Git `stable-before-motion-2026-06-22`, apontando para o commit `82565a0`.
- Correcao de responsividade dos formularios: `ModalSurface` e renderizado por portal diretamente no `document.body`, usa altura dinamica `100dvh` e rolagem interna. A animacao global `screen-enter` ficou somente em opacidade para nao criar um containing block que corte modais `fixed`.
- O cadastro de `Novo Veiculo` no acesso de cliente foi corrigido:
  - o backend agora aceita o `upsert` unitario desse fluxo sem liberar importacao/listagem administrativa
  - clientes nao podem sobrescrever veiculo ja pertencente a outro cadastro
  - o modal passou a exibir erro inline, sem `alert` de permissao do navegador
  - os precos de servico no modal e no seletor passaram a usar formatacao monetaria `pt-BR`, evitando textos como `80.75,00`
- A tela `Configuracoes > Cadastros de Clientes` trocou `alert/confirm` por feedback visual interno, leve e mais amigavel para smartphone, sem adicionar polling ou dependencias pesadas.
- O GitHub e a fonte principal da continuidade.
- Se mudar de computador, o ideal e continuar a partir do commit `3318ac0` ou posterior.
- Imagens enviadas ficam em `server/storage/uploads` (persistidas via volume Docker).
- Em producao, altere a senha do administrador imediatamente.

## Proximo ponto de investigacao sugerido

- Prioridade recomendada agora:
  - concluir a validacao publica do HTTPS direto no IP da EC2 e migrar o acesso mobile para o link seguro
  - endurecer autorizacao de backend nos endpoints administrativos
  - remover a senha padrao previsivel na criacao de usuarios
- Se ainda houver lentidao percebida, medir:
  - tempo de resposta do `bootstrap`
  - tempo de upload das fotos
  - tempo de persistencia de `upsertService` e `bookScheduling`
  - tamanho real dos payloads enviados nas inspeções
