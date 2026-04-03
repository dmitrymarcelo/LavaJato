# SKILLS.md - Lava Jato Norte Tech

Atualizado em: 2026-04-03
Commit de referencia: `ca4ab15bf8bb1bfa364319be1409b79c712fed61`

## Objetivo

Este documento registra as `skills` persistentes do projeto. Aqui, skill significa uma capacidade tecnica reutilizavel que pode ser combinada por agentes, telas ou fluxos de backend para entregar resultado de negocio de forma previsivel.

Ele complementa o `AGENTS.md`:

- `AGENTS.md` responde `quem faz o que`
- `SKILLS.md` responde `como cada capacidade e aplicada`

## Principios de desenho de skills

- cada skill precisa ter contrato claro de entrada e saida
- cada skill precisa declarar dependencia tecnica e dependencia de negocio
- cada skill precisa ter modo de falha conhecido
- skills criticas de operacao devem sobreviver a rede instavel
- skills administrativas nunca podem depender apenas do frontend para seguranca
- assets de identidade visual que impactam confianca do usuario devem ficar versionados localmente no projeto
- skills generativas sao consultivas, nao autoritativas, salvo regra explicitamente aprovada

## Classificacao

### Skills criticas de operacao

- impactam fila, lavagem, fotos, pagamento ou agenda
- qualquer falha gera retrabalho ou perda operacional

### Skills de governanca

- controlam autenticacao, base autorizada, equipe, configuracoes e deploy

### Skills consultivas

- agregam contexto, recomendacao ou analise, sem alterar estado critico por conta propria

## Catalogo de skills

### S01. `auth-session-management`

- Tipo: governanca
- Objetivo: manter login, logout e expiracao de sessao consistentes
- Entradas: cookie de sessao, eventos `401`, credenciais, bootstrap autenticado
- Saidas: sessao valida, logout limpo, recuperacao de autenticacao
- Dependencias: `src/services/api.ts`, `src/App.tsx`, `server/index.mjs`
- Falha esperada: token expirado ou ausente
- Resposta esperada: limpar sessao e redirecionar sem corromper estado global
- Guardrails atuais: cookie `HttpOnly`, `credentials: include`, expiracao no backend e limpeza de legado em `sessionStorage`

### S02. `bootstrap-hydration`

- Tipo: operacao
- Objetivo: abrir o app rapido com dados suficientes para trabalhar
- Entradas: `/api/bootstrap`, token, base do usuario
- Saidas: servicos, agenda, equipe, produtos e configuracoes carregados
- Dependencias: `src/App.tsx`, `server/index.mjs`
- Falha esperada: API lenta, indisponivel ou sessao invalida
- Resposta esperada: erro visivel, sem travar o navegador, com chance de nova tentativa

### S03. `base-scoping`

- Tipo: governanca
- Objetivo: restringir visibilidade por base para clientes
- Entradas: usuario autenticado, `allowedBaseIds`, consultas de servico/agendamento
- Saidas: payload filtrado por base
- Dependencias: `server/index.mjs`, `src/data/bases.ts`
- Falha esperada: base ausente ou fora da lista permitida
- Resposta esperada: erro `403` ou resultado vazio seguro

### S03B. `permission-enforcement`

- Tipo: governanca
- Objetivo: impedir que a API dependa apenas do frontend para seguranca
- Entradas: `access_rules`, usuario autenticado, permissao requerida pela rota
- Saidas: `403` seguro ou execucao autorizada
- Dependencias: `server/index.mjs`, `src/lib/access.ts`, `src/App.tsx`, `src/components/Settings.tsx`
- Falha esperada: perfil sem permissao para a acao
- Resposta esperada: bloquear acesso no backend e refletir a restricao no frontend sem esconder inconsistencias

### S04. `vehicle-normalization`

- Tipo: operacao
- Objetivo: padronizar placa, tipo e cadastro de veiculo
- Entradas: placa digitada, tipo de origem, dados de cliente/modelo
- Saidas: chave de placa canonica e categoria compatibilizada
- Dependencias: `CheckIn.tsx`, `Settings.tsx`, `vehicle-type.mjs`, `POST /api/vehicles/bulk-upsert`
- Falha esperada: placa ou tipo inconsistente
- Resposta esperada: bloquear cadastro incompleto antes da persistencia e consolidar importacoes em lote sem perder o estado apos refresh

### S05. `scheduling-rules-engine`

- Tipo: operacao
- Objetivo: aplicar regras de horario e capacidade sem ambiguidade
- Entradas: data, hora, placa, tipo, base, area
- Saidas: agendamento validado ou bloqueado com motivo
- Dependencias: `Scheduling.tsx`, `server/schema.sql`, `server/index.mjs`
- Falha esperada: slot lotado, domingo, sabado fora da janela, duplicidade
- Resposta esperada: feedback imediato e nenhuma gravacao parcial

### S06. `taruma-zone-routing`

- Tipo: operacao
- Objetivo: garantir roteamento correto na Base Taruma
- Entradas: base `taruma`, tipo do veiculo, area escolhida
- Saidas: `washingZoneId` coerente
- Dependencias: `Scheduling.tsx`, `server/index.mjs`
- Falha esperada: area ausente
- Resposta esperada: impedir continuidade ate a definicao da area

### S07. `service-upsert-transaction`

- Tipo: operacao
- Objetivo: persistir servico com consistencia entre servico e agenda relacionada
- Entradas: payload do servico, dados de inspeção, horario, timeline
- Saidas: servico salvo e relacionamentos coerentes
- Dependencias: `server/index.mjs`, `withTransaction`
- Falha esperada: erro parcial de banco ou conflito de consistencia
- Resposta esperada: rollback completo

### S08. `inspection-photo-atomic-save`

- Tipo: operacao critica
- Objetivo: salvar cada foto sem sobrescrever o servico inteiro
- Entradas: id do servico, etapa, tipo da foto, imagem
- Saidas: foto persistida e resposta individual
- Dependencias: `POST /api/services/:id/inspection-photo`, `InspectionPre.tsx`, `InspectionPost.tsx`
- Falha esperada: upload interrompido, rede lenta ou refresh do aparelho
- Resposta esperada: falha isolada da foto, nao perda do resto do servico

### S09. `offline-photo-retry`

- Tipo: operacao critica
- Objetivo: nao perder evidencias quando a rede oscila
- Entradas: fotos pendentes, eventos de conectividade, foco, visibilidade
- Saidas: fila local e sincronizacao posterior
- Dependencias: `src/utils/app.ts`, `src/App.tsx`
- Falha esperada: navegador fechado, cache limpo ou storage indisponivel
- Resposta esperada: manter feedback visual de pendencia enquanto houver dado local

### S10. `offline-operational-retry`

- Tipo: operacao critica
- Objetivo: garantir que inicio e fim da lavagem sobrevivam ao offline
- Entradas: `start-wash`, `complete-wash`, id do servico, horario
- Saidas: fila local e replay seguro
- Dependencias: `src/utils/app.ts`, `src/App.tsx`, `server/index.mjs`
- Falha esperada: perda de conectividade apos tocar em iniciar/finalizar
- Resposta esperada: card muda localmente e sincroniza depois

### S11. `atomic-stage-transition`

- Tipo: operacao critica
- Objetivo: separar transicao operacional de edicao completa do servico
- Entradas: endpoint dedicado e contexto da etapa
- Saidas: status atualizado atomica e auditavelmente
- Dependencias: `POST /api/services/:id/start-wash`, `POST /api/services/:id/complete-wash`
- Falha esperada: clique repetido ou retry tardio
- Resposta esperada: operacao idempotente ou facilmente reconciliavel

### S12. `payment-closeout`

- Tipo: operacao
- Objetivo: concluir o ciclo financeiro do servico
- Entradas: id do servico, dados de pagamento, contexto do atendimento
- Saidas: servico `completed`
- Dependencias: `Payment.tsx`, `server/index.mjs`
- Falha esperada: tentativa de fechar servico em etapa errada
- Resposta esperada: bloqueio de transicao invalida

### S13. `inventory-movement-ledger`

- Tipo: operacao
- Objetivo: registrar entradas e saidas manuais com trilha de saldo
- Entradas: produto, quantidade, tipo de movimento
- Saidas: saldo atualizado e movimentos anexados ao item
- Dependencias: `Inventory.tsx`, `server/index.mjs`
- Falha esperada: quantidade invalida ou baixa acima do saldo
- Resposta esperada: bloqueio no frontend e consistencia no backend

### S14. `vehicle-history-export`

- Tipo: consultiva
- Objetivo: transformar historico em informacao acionavel por placa
- Entradas: placa, periodo, escopo de consulta
- Saidas: cards, metricas e CSV enriquecido com tipo de lavagem, responsaveis, ticket medio e tempos operacionais
- Dependencias: `VehicleHistory.tsx`, `GET /api/vehicle-history`
- Falha esperada: historico incompleto ou filtro incorreto
- Resposta esperada: manter consulta segura e rastreavel

### S15. `dashboard-analytics`

- Tipo: consultiva
- Objetivo: fornecer visao executiva de operacao e faturamento
- Entradas: servicos, equipe, produtos, agenda
- Saidas: KPIs, rankings e comparativos
- Dependencias: `Dashboard.tsx`
- Falha esperada: leituras parciais ou bootstrap incompleto
- Resposta esperada: apresentar tendencia sem virar fonte unica de auditoria

### S16. `bedrock-advisory`

- Tipo: consultiva generativa
- Objetivo: orientar operacao com dicas e contexto textual
- Entradas: prompt interno, clima e contexto basico
- Saidas: texto aconselhativo
- Dependencias: `server/assistant.mjs`, `src/services/geminiService.ts`
- Falha esperada: indisponibilidade do modelo ou timeout externo
- Resposta esperada: fallback deterministico e nunca bloquear o app
- Exposicao atual: a capacidade segue implementada, mas o botao flutuante do assistente foi removido da UI principal

### S17. `handoff-sync`

- Tipo: governanca
- Objetivo: manter memoria tecnica viva a cada entrega
- Entradas: data, commit, historico recente
- Saidas: `HANDOFF.md` atualizado
- Dependencias: `scripts/update-handoff.mjs`
- Falha esperada: commit sem handoff
- Resposta esperada: pipeline falha antes do deploy

### S18. `persistence-doc-sync`

- Tipo: governanca
- Objetivo: manter `HANDOFF.md`, `AGENTS.md` e `SKILLS.md` alinhados localmente e na AWS
- Entradas: commit atual, metadados de documentacao, workflow de deploy
- Saidas: docs sincronizados no repo e em `/opt/lavajato/runtime`
- Dependencias: `scripts/update-persistence-docs.mjs`, `scripts/check-persistence-docs.mjs`, `.github/workflows/deploy.yml`
- Falha esperada: commit sem atualizar docs persistentes
- Resposta esperada: impedir deploy e forcar sincronizacao documental

### S19. `vehicle-bulk-sync`

- Tipo: operacao critica
- Objetivo: persistir importacoes grandes da base de veiculos com velocidade e consistencia transacional
- Entradas: lista normalizada de veiculos, delta de placas alteradas, refresh da tela de configuracoes
- Saidas: lote persistido, lista estavel apos reload e carregamento visivel enquanto a API responde
- Dependencias: `src/App.tsx`, `src/components/Settings.tsx`, `src/services/api.ts`, `server/index.mjs`
- Falha esperada: CSV muito grande, rede oscilando ou usuario atualizar a pagina durante a sincronizacao
- Resposta esperada: envio em lotes no frontend, `bulk upsert` transacional no backend, feedback claro de carregamento na tela e nenhum efeito do React que recancele a propria busca por depender da flag de loading

### S20. `frontend-build-refresh`

- Tipo: governanca
- Objetivo: garantir que o frontend publicado na AWS reflita o commit mais recente e fique acessivel por HTTPS estavel no mobile
- Entradas: `APP_BUILD_SHA`, meta `app-build-sha`, `APP_HOST`, `docker compose build web`, `docker compose up -d --force-recreate`, `certbot`, verificador SSM e arquivos do frontend
- Saidas: bundle web recompilado, HTML marcado com o SHA da build, runtime docs copiados do checkout atualizado, proxy HTTP valido antes da emissao do certificado e HTTPS ativo no proprio IP publico apos a renovacao
- Dependencias: `index.html`, `package.json`, `Dockerfile.web`, `docker-compose.yml`, `infra/nginx/http.conf.template`, `infra/nginx/https.conf.template`, `infra/nginx/render-config.sh`, `infra/aws/renew-https.sh`, `.github/workflows/deploy.yml`, `scripts/build-ssm-deploy-command.mjs`, `scripts/run-vite-build.mjs`
- Falha esperada: deploy verde com HTML ainda apontando para assets antigos, proxy tentando subir TLS sem certificado ou HTTPS nao publicado para smartphone
- Resposta esperada: validar HTTP antes do `certbot`, esperar a API sair do `502` inicial com retentativa controlada, restaurar `HANDOFF.md`, `AGENTS.md` e `SKILLS.md` pelo Git antes do `git pull`, liberar espaco do Docker antes da etapa TLS, aceitar `HTTPS_CERT_EMAIL` valido quando existir e fazer fallback sem email quando nao existir, emitir certificado diretamente para o IP publico com perfil short-lived, registrar a renovacao por `systemd timer` em janela curta de `6h`, consultar o resultado do SSM com `get-command-invocation` apenas como diagnostico, renderizar apenas `1` config final do Nginx por vez, executar `nginx -t` antes do reload e exigir no workflow que o `app-build-sha` em HTTPS e o `/api/health` correspondam ao commit publicado, com `curl -k` apenas no runner quando o acesso publico ainda estiver preso ao IP

### S21. `security-hardening-baseline`

- Tipo: governanca
- Objetivo: reduzir a diferenca entre app funcional e app resiliente contra abuso real
- Entradas: credenciais, role do usuario, origem da requisicao, payload administrativo e URL/imagem enviada
- Saidas: login com rate limit, backend com headers/CORS defensivos, rotas sensiveis protegidas e validacao server-side de usuario
- Dependencias: `server/index.mjs`, `server/seed.mjs`, `src/components/Login.tsx`, `package.json`, `.env.example`
- Falha esperada: brute force, bypass de UI para rotas admin, senha previsivel, URL remota arbitraria em imagem ou dependencia com advisory ativo
- Resposta esperada: limitar tentativas, exigir `Administrador` nas rotas sensiveis, eliminar fallback de senha padrao, recusar host remoto fora da allowlist e manter `pnpm audit --prod` limpo

### S22. `settings-in-app-feedback`

- Tipo: governanca
- Objetivo: substituir dialogos nativos por feedback visual leve e consistente na tela de configuracoes
- Entradas: validacoes de formulario, confirmacoes de exclusao e resultado de persistencia
- Saidas: toast local de sucesso/erro e modal de confirmacao do proprio app
- Dependencias: `src/components/Settings.tsx`, `ModalSurface`, `AnimatePresence`
- Falha esperada: acao sensivel sem confirmacao explicita ou erro silencioso
- Resposta esperada: mensagem clara, sem bloquear o app inteiro e sem custo perceptivel de performance

### S23. `operational-notification-feedback`

- Tipo: operacao
- Objetivo: avisar o operador sobre marcos criticos sem atrasar a execucao do servico
- Entradas: inicio de lavagem, conclusao de lavagem, pagamento concluido e sincronizacao offline retomada
- Saidas: central de notificacoes coerente, popup nao bloqueante de `Concluido` e reforco visual temporario na tela `Pagamento`
- Dependencias: `src/App.tsx`, `src/components/Notifications.tsx`, `src/components/Payment.tsx`
- Falha esperada: evento repetido por retentativa, clique ambiguuo no sino ou sincronizacao silenciosa demais
- Resposta esperada: deduplicar por `id`, usar toggle explicito no botao de notificacoes, exibir feedback leve no topo sem interromper o redirecionamento para `Pagamento` e evitar `alert` bloqueante no mobile

## Procedimento operacional

### Ao criar uma skill nova

1. nomear a skill de forma curta e estavel
2. descrever objetivo de negocio
3. declarar arquivos e rotas usados
4. registrar falha esperada e fallback
5. registrar em `AGENTS.md` se a skill criar ou alterar ownership de um agente
6. atualizar `HANDOFF.md`

### Ao alterar uma skill existente

1. verificar impacto em smartphone
2. revisar se muda KPI ou SLO
3. atualizar este documento
4. sincronizar docs via automacao

## KPIs recomendados para skills

- tempo de execucao `p95` por skill critica
- taxa de sucesso por skill critica
- taxa de retry por skill mobile
- taxa de fallback por skill generativa
- taxa de erro por skill administrativa

## Sincronizacao AWS

Em producao, este documento deve existir:

- no repositorio da instancia: `/opt/lavajato/app/SKILLS.md`
- na memoria operacional da EC2: `/opt/lavajato/runtime/SKILLS_AWS.md`

Se esse arquivo divergir do commit implantado, a documentacao esta desatualizada e precisa ser regenerada no proximo ciclo.
