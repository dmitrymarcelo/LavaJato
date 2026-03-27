# AGENTS.md - Lava Jato Norte Tech

Atualizado em: 2026-03-27
Commit de referencia: `37862b867c93a26098ca8e85d5b922a53c239362`

## Objetivo

Este documento e a referencia principal de agentes, skills, responsabilidades, guardrails e metricas operacionais do projeto Lava Jato Norte Tech. Ele existe para alinhar produto, operacao, engenharia e manutencao futura em uma unica fonte de verdade.

Escopo deste documento:

- mapear os agentes logicos que operam o produto hoje
- catalogar as skills reutilizaveis do sistema
- registrar principios de arquitetura e alinhamento com negocio
- definir como o documento deve ser mantido
- estabelecer KPIs para medir confiabilidade, produtividade e qualidade

## Leitura executiva

- O sistema atual nao e uma malha aberta de multiagentes. Ele e, na pratica, uma plataforma operacional deterministica com `1` agente generativo real e varios agentes logicos especializados em fluxos de negocio.
- O unico agente generativo em producao hoje e o `Assistente Bedrock`, usado para dicas e recomendacoes contextuais.
- Os demais agentes descritos abaixo sao agentes aplicacionais: modulos com responsabilidade, entradas, saidas, regras e fallbacks claros.
- O principio central do produto e `nao perder estado operacional`, principalmente em smartphone e rede instavel.
- O produto prioriza confiabilidade de campo, velocidade de atendimento, rastreabilidade do servico e visibilidade do cliente por base autorizada.

## Norte do negocio

O sistema precisa garantir cinco resultados de negocio sem ambiguidade:

1. cada lavagem deve existir uma unica vez e atravessar o ciclo operacional sem perda de estado
2. o time operacional deve conseguir trabalhar no smartphone mesmo com rede oscilando
3. o cliente deve ver apenas o que pertence as bases liberadas
4. faturamento, historico e evidencias fotograficas precisam permanecer rastreaveis
5. deploy, memoria operacional e continuidade do projeto precisam sobreviver a troca de maquina ou colaborador

## Estado atual do sistema

### Stack

- Frontend: `React + Vite + TypeScript`
- Backend: `Express + Node.js`
- Banco: `PostgreSQL`
- Proxy: `Nginx`
- Assistente AI: `AWS Bedrock` via backend
- Deploy: `GitHub Actions + AWS SSM + Docker Compose`

### Padroes de arquitetura atuais

- frontend orientado a componentes funcionais com `useState`, `useEffect` e `useRef`
- `src/App.tsx` atua como orquestrador principal de sessao, bootstrap, sincronizacao e navegacao
- componentes grandes concentram regras de negocio locais, com destaque para `Scheduling.tsx`, `Settings.tsx`, `InspectionPre.tsx` e `InspectionPost.tsx`
- backend monolitico em `server/index.mjs`, com rotas REST e helpers internos de persistencia/transacao
- modelo de dados relacional com campos `JSONB` para estruturas flexiveis como timeline, fotos, movimentos e configuracoes
- persistencia mobile resiliente usando fila local para fotos e transicoes operacionais
- deploy automatico em `main`, com memoria operacional sincronizada em `HANDOFF.md` e validacao de SHA real do frontend servido pela EC2

### Hotspots tecnicos

- `src/components/Scheduling.tsx` concentra agenda, fila, cards operacionais, modal de fotos e historico
- `src/App.tsx` concentra sessao, bootstrap, sincronizacao e roteamento
- `src/components/Settings.tsx` concentra regras de acesso, equipe, servicos e base de veiculos
- `server/index.mjs` concentra quase toda a superficie de API

### Requisitos de negocio ja consolidados

- o sistema abre no `Painel`
- `Agenda & Fila` abre em `Agendamentos`
- domingo e bloqueado
- sabado vai ate `12:00`
- capacidade por horario: `5` vagas totais, `2` caminhoes, `3` outros
- nao pode haver a mesma placa no mesmo horario em agendamento ativo
- `Inspecao Pre` e `Inspecao Pos` exigem no minimo `1` foto
- a foto `Frente` pode virar imagem principal do card
- cliente e filtrado por bases autorizadas
- a Base Taruma exige roteamento por area de lavagem

## Principios operacionais para agentes

Este projeto adota os seguintes principios, alinhados a boas praticas publicadas por OpenAI, Anthropic e Microsoft:

- comecar simples: usar fluxo deterministico ou agente unico antes de justificar multiagentes
- responsabilidades pequenas e explicitas: cada agente deve ter entradas, saidas, guardrails e owner claros
- estado duravel fora do modelo: o estado operacional deve viver em banco, fila local ou armazenamento versionado, nunca apenas no contexto da conversa
- ferramentas reutilizaveis e testaveis: skills devem ter contrato estavel e baixo acoplamento
- intervencao humana para alto risco: exclusoes, pagamentos, mudancas administrativas e acoes irreversiveis precisam de controle explicito
- avaliacao continua: toda capacidade nova precisa de KPI, criterio de sucesso e observabilidade minima
- documentacao sincronizada com deploy: arquitetura viva, nao documento esquecido

## Mapa de agentes

### A01. Agente Orquestrador de Aplicacao

- Tipo: deterministico
- Arquivos principais: `src/App.tsx`, `src/services/api.ts`, `src/utils/app.ts`
- Missao: iniciar a sessao, carregar bootstrap, manter estado global e coordenar sincronizacao local/remota
- Entradas: token, bootstrap da API, eventos de rede, foco/visibilidade, acoes do usuario
- Saidas: estado hidratado do app, reconciliacao de filas pendentes, navegacao consistente
- Guardrails: fallback local quando a API falha, recuperacao de sessao e eventos de nao autorizado
- Owner sugerido: frontend + plataforma

### A02. Agente de Agendamento e Fila

- Tipo: deterministico
- Arquivos principais: `src/components/Scheduling.tsx`, `server/index.mjs`, `server/schema.sql`
- Missao: gerenciar agenda, fila operacional, validacao de vagas, lotacao e regras por base
- Entradas: placa, base, data, horario, tipo do veiculo, status do servico
- Saidas: agendamentos validos, cards de fila, historico operacional e consultas por placa
- Guardrails: bloqueio de domingo, sabado reduzido, capacidade por faixa, unicidade de placa/slot, Base Taruma com area obrigatoria
- Owner sugerido: produto operacional + backend

### A03. Agente de Check-in e Cadastro Inicial

- Tipo: deterministico
- Arquivos principais: `src/components/CheckIn.tsx`, `src/services/api.ts`, `server/index.mjs`
- Missao: transformar chegada ou demanda espontanea em servico operacional pronto para fila
- Entradas: placa, modelo, cliente, servico escolhido, CPF terceiro quando aplicavel
- Saidas: servico com status `pending` e veiculo atualizado/cadastrado
- Guardrails: placa normalizada, validacao de CPF, consulta a base local/remota antes de duplicar cadastro
- Owner sugerido: operacoes + frontend

### A04. Agente de Inspecao Pre

- Tipo: deterministico com resiliencia mobile
- Arquivos principais: `src/components/InspectionPre.tsx`, `src/utils/app.ts`, `server/index.mjs`
- Missao: registrar evidencia inicial, responsavel pela lavagem e preparar a transicao para execucao
- Entradas: fotos obrigatorias, lavador, observacoes, dados do servico
- Saidas: fotos persistidas, timeline atualizada e transicao para lavagem
- Guardrails: minimo de `1` foto, fila local quando a rede oscila, compressao de imagem, bloqueio de duplo envio
- Owner sugerido: operacoes de campo + frontend mobile

### A05. Agente de Transicao de Lavagem

- Tipo: deterministico com fila local
- Arquivos principais: `src/utils/app.ts`, `src/App.tsx`, `src/services/api.ts`, `server/index.mjs`
- Missao: iniciar e finalizar etapas de lavagem sem depender do `upsert` completo do servico
- Entradas: acao `start-wash` ou `complete-wash`, horario, responsavel, id do servico
- Saidas: status atomico no backend e espelho local imediato no smartphone
- Guardrails: endpoints dedicados, reenvio automatico, protecao contra clique duplicado, recuperacao pos-offline
- Owner sugerido: backend + operacoes mobile

### A06. Agente de Inspecao Pos

- Tipo: deterministico com resiliencia mobile
- Arquivos principais: `src/components/InspectionPost.tsx`, `src/utils/app.ts`, `server/index.mjs`
- Missao: capturar evidencia final e preparar o servico para pagamento ou encerramento
- Entradas: fotos finais, observacoes, status do servico
- Saidas: `post_inspection_photos`, timeline e fechamento operacional
- Guardrails: minimo de `1` foto, upload atomico por foto, fallback local visivel ao usuario
- Owner sugerido: operacoes de campo + frontend mobile

### A07. Agente de Pagamento e Encerramento

- Tipo: deterministico
- Arquivos principais: `src/components/Payment.tsx`, `src/services/api.ts`, `server/index.mjs`
- Missao: converter servicos `waiting_payment` em `completed` com rastreabilidade
- Entradas: id do servico, forma de fechamento, contexto operacional
- Saidas: status final, datas de encerramento, historico confiavel
- Guardrails: fechamento centralizado no backend, consistencia da timeline
- Owner sugerido: operacoes + financeiro

### A08. Agente de Estoque e Produtos

- Tipo: deterministico
- Arquivos principais: `src/components/Inventory.tsx`, `src/services/api.ts`, `server/index.mjs`
- Missao: manter produtos, imagens, entradas, saidas e alertas de estoque
- Entradas: cadastro de produto, movimento manual, imagem, quantidade minima
- Saidas: saldo atualizado, movimentos do dia, alertas de baixo estoque
- Guardrails: quantidade inteira valida, baixa nao maior que estoque, processamento de imagem controlado
- Owner sugerido: operacoes internas + administrativo

### A09. Agente de Governanca, Acesso e Configuracao

- Tipo: deterministico
- Arquivos principais: `src/components/Login.tsx`, `src/components/Settings.tsx`, `server/index.mjs`, `server/seed.mjs`
- Missao: autenticar usuarios, gerenciar equipe, permissoes, tipos de servico e base de veiculos
- Entradas: credenciais, perfis, base autorizada, regras de acesso e dados mestres
- Saidas: sessao autenticada, usuarios atualizados, configuracoes persistidas
- Guardrails: sessoes persistidas em `auth_sessions`, filtro por base para clientes, validacoes de senha e email no frontend
- UX atual: a tela de configuracoes usa feedback visual proprio para erro, sucesso e confirmacao, evitando dialogos nativos do navegador
- Persistencia atual: importacao de CSV da base de veiculos usa `bulk upsert` transacional no backend e lotes no frontend, com estado de carregamento explicito apos refresh
- Correcao recente: o carregamento da base de veiculos em `Configuracoes` nao pode mais se autocancelar por mudanca da propria flag de loading; esse ciclo foi removido em `src/App.tsx`
- Risco atual: a autorizacao administrativa ainda precisa ser endurecida no backend e a senha padrao do seed deve ser removida em producao
- Owner sugerido: backend + seguranca + administracao

### A10. Agente de Historico, Analytics e Visibilidade

- Tipo: deterministico
- Arquivos principais: `src/components/Dashboard.tsx`, `src/components/VehicleHistory.tsx`, `src/components/ServiceHistory.tsx`, `server/index.mjs`
- Missao: transformar dados operacionais em visibilidade de produtividade, faturamento e historico por veiculo
- Entradas: servicos, agendamentos, equipe, produtos e timeline
- Saidas: KPIs do painel, rankings, faturamento, historico exportavel e contexto para clientes
- Guardrails: escopo por base para clientes, consultas separadas para historico detalhado
- Capacidade recente: o export de `Historico de Veiculos` passou a levar tipo de lavagem, status, responsaveis, ticket medio e tempos operacionais por resumo e por detalhe
- Owner sugerido: produto + gestao operacional

### A11. Agente Assistente Bedrock

- Tipo: generativo
- Arquivos principais: `server/assistant.mjs`, `src/services/geminiService.ts`, `src/components/Dashboard.tsx`
- Missao: fornecer dicas operacionais e recomendacoes contextuais de clima/atendimento
- Entradas: contexto basico do negocio, parametros climaticos e prompts internos
- Saidas: recomendacoes textuais para apoiar decisao humana
- Guardrails: o assistente e consultivo, nunca fonte de verdade para status, faturamento, estoque ou autorizacao
- Estado atual da UI: o CTA flutuante foi removido da casca principal do app; o agente segue disponivel apenas como capacidade de backend e base para usos futuros controlados
- Owner sugerido: produto + backend

### A12. Agente de Deploy e Memoria Operacional

- Tipo: deterministico
- Arquivos principais: `.github/workflows/deploy.yml`, `scripts/update-handoff.mjs`, `scripts/check-handoff.mjs`, `HANDOFF.md`
- Missao: publicar em AWS, validar handoff e preservar continuidade entre maquinas, pessoas e deploys
- Entradas: push em `main`, segredos AWS, estado do repositorio e `HANDOFF.md`
- Saidas: deploy automatico, handoff sincronizado na EC2 e trilha historica recente
- Guardrails: `handoff:check` antes do deploy, health check da API, sincronizacao documental, limpeza controlada dos docs legados no checkout da EC2, `APP_BUILD_SHA` no HTML, build cacheado de `api` e `web`, `--force-recreate` e validacao por `curl localhost` para impedir deploy verde com frontend velho
- Owner sugerido: plataforma + engenharia

## Catalogo de SKILLS do projeto

Definicao adotada neste documento: `SKILL` e uma capacidade reutilizavel, documentada e acionavel por um agente logico ou fluxo operacional.

| Skill | Descricao tecnica | Quando usar | Implementacao principal | Exemplo pratico |
| --- | --- | --- | --- | --- |
| `auth-session-management` | Recupera token, propaga `Bearer`, trata expiracao e logout | login, refresh, erro `401` | `src/services/api.ts`, `src/App.tsx`, `server/index.mjs` | usuario volta ao app e retoma sessao ativa |
| `bootstrap-hydration` | Carrega estado inicial do app com servicos sem fotos pesadas | abertura do sistema, recarga, troca de usuario | `GET /api/bootstrap`, `src/App.tsx` | painel abre rapido sem baixar todas as fotos |
| `base-scoping` | Filtra dados por bases autorizadas para usuarios `Clientes` | agenda do cliente, historico, bootstrap | `server/index.mjs`, `src/data/bases.ts` | cliente so enxerga Taruma e Flores |
| `vehicle-normalization` | Normaliza placa, tipo de veiculo e dados de cadastro | check-in, agenda, importacao de frota | `CheckIn.tsx`, `Settings.tsx`, `vehicle-type.mjs` | placa `abc-1234` vira chave canonica |
| `scheduling-rules-engine` | Aplica regras de domingo, sabado, capacidade e conflito de placa | criar ou editar agendamento | `Scheduling.tsx`, `server/schema.sql` | sistema bloqueia slot lotado |
| `taruma-zone-routing` | Obriga selecao e inferencia de area na Base Taruma | agenda e fila da Taruma | `Scheduling.tsx`, `server/index.mjs` | caminhao vai para `dique_pesada` |
| `service-upsert-transaction` | Persiste servicos com consistencia transacional | edicao, sincronizacao, importacao | `server/index.mjs`, `withTransaction` | servico muda sem deixar agendamento orfao |
| `inspection-photo-atomic-save` | Salva cada foto de inspecao separadamente no backend | pre-inspecao, pos-inspecao | `POST /api/services/:id/inspection-photo` | foto de celular persiste mesmo com rede lenta |
| `offline-photo-retry` | Enfileira fotos localmente e tenta reenviar depois | offline, 4G oscilando, foco/visibilidade | `src/utils/app.ts`, `src/App.tsx` | foto aparece pendente e sincroniza depois |
| `offline-operational-retry` | Enfileira `start-wash` e `complete-wash` para replay seguro | queda de internet durante execucao | `src/utils/app.ts`, `src/App.tsx`, `server/index.mjs` | lavagem ja aparece iniciada no card |
| `atomic-stage-transition` | Move status operacional por endpoints dedicados | iniciar lavagem, concluir lavagem | `POST /api/services/:id/start-wash`, `POST /api/services/:id/complete-wash` | evita sobrescrever o servico inteiro |
| `payment-closeout` | Fecha pagamento e conclui servico com timeline integra | caixa, liberacao final | `Payment.tsx`, `server/index.mjs` | servico passa de `waiting_payment` para `completed` |
| `inventory-movement-ledger` | Registra entradas, saidas e minimo de estoque | controle de quimicos e insumos | `Inventory.tsx`, `server/index.mjs` | baixa manual atualiza saldo e historico |
| `vehicle-history-export` | Consolida historico por placa e exporta CSV | atendimento, auditoria, comercial | `VehicleHistory.tsx`, `GET /api/vehicle-history` | exportar lavagens de um cliente |
| `dashboard-analytics` | Gera KPIs de volume, faturamento, tempo medio e ranking | gestao diaria e analise de produtividade | `Dashboard.tsx` | ver melhor lavador e base mais demandada |
| `bedrock-advisory` | Gera dicas consultivas de clima e operacao | apoio a decisao, leitura do painel | `server/assistant.mjs` | sugerir reforco de equipe por chuva |
| `handoff-sync` | Atualiza memoria operacional com data, commit e historico | qualquer entrega relevante | `scripts/update-handoff.mjs` | registrar contexto para outro computador |
| `deploy-aws-ssm` | Publica build, sincroniza docs e valida o SHA real servido pela EC2 | push em `main` | `.github/workflows/deploy.yml`, `scripts/build-ssm-deploy-command.mjs`, `scripts/run-vite-build.mjs` | deploy automatico apos merge |

## Diretrizes de consistencia e alinhamento com objetivos de negocio

### Regras obrigatorias para qualquer novo agente ou skill

1. definir qual problema operacional ou de negocio ele resolve
2. declarar owner tecnico e owner funcional
3. explicitar a fonte de verdade do estado
4. descrever fallback em caso de falha de rede, API ou modelo
5. criar pelo menos um KPI objetivo para medir resultado
6. atualizar `AGENTS.md` e `HANDOFF.md` na mesma entrega

### Regras de arquitetura

- preferir fluxo deterministico quando a regra de negocio ja e conhecida
- usar AI generativa apenas onde existe valor em interpretacao, recomendacao ou decisao assistida
- nao permitir que o modelo generativo seja autoridade sobre status operacional, autenticacao, pagamento ou inventario
- todo estado critico deve sobreviver a refresh, troca de aba e oscilacao de rede
- toda acao sensivel precisa de validacao no backend, nunca apenas no frontend
- nenhuma nova skill deve depender de contexto implicito nao documentado

### Regras de UX operacional

- no smartphone, feedback local imediato vale mais que espera silenciosa por rede
- pendencia de sincronizacao deve ser visivel para o time
- erros nao devem apagar o progresso ja feito pelo usuario
- formularios devem bloquear duplicidade de acao quando isso gera dano operacional
- cliente nunca deve ver dado fora das bases autorizadas

### Regras de manutencao de codigo

- criar modulo novo quando a regra tiver segunda reutilizacao concreta
- reduzir componentes grandes por fronteira de dominio, nao por vaidade arquitetural
- manter SQL explicito e transacoes para operacoes que alteram agenda, servico, equipe ou estoque
- usar tipos compartilhados como contrato entre backend e frontend sempre que possivel
- preservar compatibilidade mobile como requisito de primeira classe

## Procedimento de manutencao e atualizacao deste documento

### Quando atualizar

Atualize `AGENTS.md` sempre que ocorrer pelo menos um destes eventos:

- criacao, remocao ou mudanca relevante de agente logico
- nova skill reutilizavel
- mudanca de regra de negocio
- alteracao de deploy, infraestrutura ou memoria persistente
- mudanca de ownership
- nova integracao AI, novo modelo ou novo fluxo sensivel

### Como atualizar

1. implementar ou revisar a mudanca no codigo
2. atualizar a secao de `Mapa de agentes`
3. atualizar a secao de `Catalogo de SKILLS`
4. revisar `Diretrizes` e `KPIs` se a mudanca alterar objetivo ou risco
5. atualizar `HANDOFF.md`
6. rodar `pnpm run docs:update`
7. validar o que for aplicavel para a mudanca
8. publicar e acompanhar o deploy automatico

### Cadencia recomendada

- revisao rapida: a cada entrega relevante
- revisao estrutural: semanal
- revisao de maturidade e backlog: mensal

### Definicao de pronto para documentacao

Uma mudanca so esta realmente pronta quando:

- o agente ou skill novo esta descrito aqui
- o `HANDOFF.md` registra o contexto operacional
- o `SKILLS.md` registra ou confirma a capacidade reutilizavel associada
- existe owner
- existe KPI
- existe fallback
- existe lista clara de riscos conhecidos

## KPIs e metricas de sucesso

### KPIs operacionais

| KPI | Meta recomendada | Motivo |
| --- | --- | --- |
| sucesso de persistencia de fotos no mobile | `>= 99.5%` eventual consistency | fotos sao evidencia operacional |
| sucesso de sincronizacao de `start-wash` e `complete-wash` | `>= 99.9%` | evitar retrabalho e reinicio indevido |
| taxa de duplicidade de inicio de lavagem | `< 0.2%` dos servicos | indica confiabilidade do fluxo mobile |
| tempo de bootstrap `p95` | `< 3s` rede boa, `< 5s` 4G | app precisa abrir rapido no campo |
| taxa de conflitos de agendamento legitimos | `< 1%` dos agendamentos validos | mede previsibilidade da agenda |
| tempo medio entre check-in e inicio real | acompanhar por base e turno | indica gargalo operacional |
| tempo medio entre fim da lavagem e pagamento | acompanhar por base | indica atrito no fechamento |

### KPIs de negocio

| KPI | Meta recomendada | Motivo |
| --- | --- | --- |
| servicos concluidos no mesmo dia | `>= 95%` dos servicos do dia | velocidade operacional |
| taxa de no-show | monitorar por base e cliente | qualidade da agenda |
| aderencia de cliente a base correta | `100%` | governanca comercial |
| acuracia de historico por placa | `>= 99%` | atendimento e auditoria |
| divergencia de estoque fisico x sistema | `< 2%` | controle administrativo |

### KPIs de plataforma e engenharia

| KPI | Meta recomendada | Motivo |
| --- | --- | --- |
| deploy com health check verde | `100%` | confiabilidade de publicacao |
| deploy com `app-build-sha` igual ao commit publicado | `100%` | evitar pagina antiga em producao |
| handoff atualizado em toda entrega relevante | `100%` | continuidade operacional |
| `AGENTS.md` atualizado quando arquitetura muda | `100%` | memoria de sistema viva |
| incidentes causados por permissao apenas no frontend | `0` | seguranca minima aceitavel |
| falhas de acoes sensiveis sem fallback | `0` | resiliencia operacional |

## Lacunas atuais e backlog recomendado

### Prioridade imediata

- endurecer autorizacao de backend para endpoints administrativos
- remover a senha padrao previsivel do seed e da criacao de usuarios
- habilitar `HTTPS` em producao para melhorar confiabilidade de camera, upload e sessao no smartphone
- endurecer `CORS` e estrategia de sessao

### Prioridade alta

- substituir `alert` e `confirm` por componentes de feedback e confirmacao do proprio app
- modularizar `App.tsx`, `Scheduling.tsx` e `Settings.tsx` por dominio
- revisar `README.md`, que ainda carrega legado de Gemini/AI Studio
- instrumentar logs e metricas para fotos pendentes, transicoes pendentes e latencia de bootstrap

### Prioridade media

- transformar a matriz de permissoes em enforcement real, nao apenas configuracao visual
- criar trilha de auditoria mais explicita para alteracoes administrativas
- padronizar metricas de UX mobile e registrar `p50`, `p95` e taxa de retry

## Checklist para qualquer iniciativa futura

- qual agente sera alterado ou criado
- qual skill sera reutilizada ou criada
- qual KPI precisa melhorar
- qual risco operacional pode piorar
- qual fallback o smartphone tera
- quais documentos precisam ser atualizados
- se o novo fluxo realmente precisa de AI ou se a regra deterministica basta

## Referencias externas usadas para este documento

- OpenAI, `A practical guide to building agents`: [https://cdn.openai.com/business-guides-and-resources/a-practical-guide-to-building-agents.pdf](https://cdn.openai.com/business-guides-and-resources/a-practical-guide-to-building-agents.pdf)
- OpenAI, `Agent Builder`: [https://developers.openai.com/api/docs/guides/agent-builder](https://developers.openai.com/api/docs/guides/agent-builder)
- OpenAI, `Safety in building agents`: [https://developers.openai.com/api/docs/guides/agent-builder-safety](https://developers.openai.com/api/docs/guides/agent-builder-safety)
- OpenAI, `Trace grading`: [https://developers.openai.com/api/docs/guides/trace-grading](https://developers.openai.com/api/docs/guides/trace-grading)
- Anthropic, `Building effective agents`: [https://www.anthropic.com/engineering/building-effective-agents](https://www.anthropic.com/engineering/building-effective-agents)
- Microsoft Learn, `AI Agent Orchestration Patterns`: [https://learn.microsoft.com/en-us/azure/architecture/ai-ml/guide/ai-agent-design-patterns](https://learn.microsoft.com/en-us/azure/architecture/ai-ml/guide/ai-agent-design-patterns)

## Nota final

Se houver qualquer conflito entre o codigo e este documento, o codigo e a operacao real ganham no curto prazo, mas o documento deve ser corrigido no mesmo ciclo. `AGENTS.md` nao pode virar aspiracional; ele precisa espelhar a realidade operacional do sistema.
