# Security Best Practices Report

Atualizado em: 2026-04-01

## Resumo executivo

Esta revisao foi guiada pelas licoes do experimento `1 HACKER VS 4 VIBECODERS`, com foco em riscos que IA costuma deixar passar em apps full-stack: autorizacao insuficiente, brute force, logica de negocio, uploads inseguros, rastreamento por imagens e validacao somente no frontend.

Resultado desta rodada:

- endurecimento aplicado nas rotas administrativas sensiveis
- rate limit de login adicionado no backend
- validacao de senha forte e email movida tambem para o servidor
- fallback de senha previsivel removido do fluxo de criacao/edicao de usuarios
- CORS saiu do modo permissivo e passou a aceitar mesmo-origem ou origens explicitamente liberadas
- URLs remotas arbitrarias de imagem deixaram de ser persistidas
- a sessao saiu de `sessionStorage` e passou para cookie `HttpOnly`
- a matriz `access_rules` passou a proteger rotas reais no backend
- mutacoes autenticadas passaram a validar origem confiavel
- dependencias de producao ficaram com `pnpm audit --prod` zerado

## Findings corrigidos

### SBP-001 - Autorizacao administrativa somente na UI

- Severidade: High
- Local: `server/index.mjs:1738`, `server/index.mjs:1752`, `server/index.mjs:1766`, `server/index.mjs:1788`, `server/index.mjs:1796`, `server/index.mjs:1833`, `server/index.mjs:2140`, `server/index.mjs:2152`, `server/index.mjs:2158`, `server/index.mjs:2164`, `server/index.mjs:2176`
- Evidencia: rotas de configuracao, frota, equipe e mutacoes de estoque agora usam `assertUserIsAdmin(req.user)`.
- Impacto anterior: qualquer usuario autenticado podia atingir endpoints administrativos direto pela API, mesmo com a UI escondendo alguns acessos.
- Correcao: guard central de papel administrativo no backend.
- Mitigacao adicional: se o projeto quiser granularidade real por papel, a proxima etapa e migrar de `admin-only` para enforcement completo da matriz `access_rules`.

### SBP-002 - Brute force no login sem controle de abuso

- Severidade: High
- Local: `server/index.mjs:254`, `server/index.mjs:1517`
- Evidencia: o login agora usa `buildLoginRateLimitKey(...)`, buckets por janela de tempo, bloqueio temporario e header `Retry-After`.
- Impacto anterior: tentativas ilimitadas facilitavam password spraying e enumeracao operacional.
- Correcao: limitacao em memoria por IP + identificador, com limpeza automatica.
- Mitigacao adicional: se houver multiplas instancias no futuro, mover o rate limit para Redis.

### SBP-003 - Fallback para senha previsivel na criacao de usuarios

- Severidade: High
- Local: `server/index.mjs:1236`, `server/index.mjs:1311`, `server/seed.mjs:10`
- Evidencia: `upsertTeamMemberRow` deixou de cair em `Admin@123456!` quando o payload vinha sem senha; o seed passou a aceitar `ADMIN_INITIAL_PASSWORD`.
- Impacto anterior: criacao/edicao insegura podia introduzir contas com senha padrao previsivel.
- Correcao: criacao de usuario agora exige senha ou hash existente; seed passa a ser configuravel por ambiente.
- Mitigacao adicional: em producao, sempre definir `ADMIN_INITIAL_PASSWORD` e rotacionar a conta seeded.

### SBP-004 - Validacao sensivel so no frontend

- Severidade: High
- Local: `server/index.mjs:1269`, `server/index.mjs:1278`
- Evidencia: o backend agora valida senha forte e formato de email ao persistir `team_members`.
- Impacto anterior: bastava chamar a API diretamente para contornar a regra de senha forte aplicada na tela.
- Correcao: as regras passaram a existir no backend, que e a fonte de verdade.

### SBP-005 - CORS permissivo e headers basicos ausentes no backend

- Severidade: Medium
- Local: `server/index.mjs:178`, `server/index.mjs:192`
- Evidencia: o middleware `resolveCorsOptions(req)` passou a aceitar somente mesmo-origem ou origens explicitamente listadas, e `/api` agora envia `Cache-Control: no-store`, `X-Content-Type-Options`, `X-Frame-Options` e `Referrer-Policy`.
- Impacto anterior: a API aceitava chamadas cross-origin abertas e respostas sensiveis podiam ser cacheadas mais do que o desejado.
- Correcao: CORS restritivo e headers defensivos leves, sem custo perceptivel de performance.

### SBP-006 - URL externa arbitraria persistida como imagem

- Severidade: Medium
- Local: `server/index.mjs:281`, `server/index.mjs:315`
- Evidencia: `persistUploadedImage(...)` agora rejeita hosts remotos fora de `ALLOWED_REMOTE_IMAGE_HOSTS`.
- Impacto anterior: um usuario podia persistir URL externa arbitraria em avatar/imagem e usar isso para rastreamento ou conteudo de origem nao confiavel.
- Correcao: allowlist de hosts remotos confiaveis e recusa explicita do restante.
- Mitigacao adicional: manter a allowlist curta e preferir sempre `/uploads` ou placeholders locais.

### SBP-007 - Placeholders e logos de terceiros na interface

- Severidade: Medium
- Local: `src/lib/placeholders.ts`, `src/components/Login.tsx`, `src/components/Sidebar.tsx`, `src/components/Dashboard.tsx`, `src/components/CheckIn.tsx`, `src/components/Scheduling.tsx`, `src/components/Inventory.tsx`, `src/components/Settings.tsx`, `server/seed.mjs`
- Evidencia: o app agora gera placeholders SVG locais para logo, servicos, produtos e avatares, e o seed deixou imagens externas vazias para cair nesses placeholders internos.
- Impacto anterior: mesmo sem persistir URL arbitraria, a interface ainda dependia de terceiros para logo, avatares e imagens padrao, expondo IP/metadata e variando mais em rede movel.
- Correcao: placeholders locais e sanitizacao de placeholders remotos historicos na UI.

### SBP-008 - Tela de login barrando senha valida por politica de criacao

- Severidade: Medium
- Local: `src/components/Login.tsx:94`
- Evidencia: a tela de login nao exige mais regra de senha forte no navegador; ela apenas envia a senha cadastrada.
- Impacto anterior: contas antigas ou importadas podiam ficar impedidas de autenticar mesmo com senha correta.
- Correcao: a politica forte continua na criacao/edicao, nao no login.

### SBP-009 - Dependencias com advisories de producao

- Severidade: Medium
- Local: `package.json:19`, `package.json:40`
- Evidencia: `@aws-sdk/client-bedrock-runtime` foi atualizado e foi adicionado override seguro de `path-to-regexp`.
- Impacto anterior: `pnpm audit --prod` reportava advisories ativos em dependencia transitiva do Bedrock SDK e do Express router.
- Correcao: `pnpm audit --prod --json` ficou sem vulnerabilidades reportadas.

## Riscos residuais recomendados para a proxima rodada

### SBP-R01 - Ainda podem existir URLs remotas historicas em registros antigos

- Severidade: Medium
- Local: dados operacionais ja persistidos antes desta rodada
- Impacto: registros antigos alimentados manualmente com URL remota customizada ainda podem apontar para terceiros.
- Recomendacao: executar uma limpeza de dados historicos e preferir somente `/uploads` ou placeholders internos.

### SBP-R02 - A matriz de permissoes ainda nao cobre toda a superficie de negocio

- Severidade: Medium
- Local: `src/components/Settings.tsx`, `server/index.mjs`
- Impacto: as rotas principais sensiveis ja usam permissao real, mas ainda existem fluxos operacionais gerais que continuam autorizados por contexto/base e nao por uma matriz mais detalhada.
- Recomendacao: se o negocio quiser granularidade ainda maior, modelar permissoes adicionais para agenda, pagamento e cadastro operacional fino sem afetar produtividade do campo.

## Validacoes executadas

- `pnpm run lint`
- `pnpm run build`
- `node --check server/index.mjs`
- `pnpm audit --prod --json`

## Resultado pratico desta rodada

O projeto saiu mais proximo do que o video recomenda para producao real:

- menos confianca em regra so de frontend
- mais protecao contra abuso de credencial
- mais validacao no backend
- mais protecao contra logica administrativa exposta
- menos superficie para rastreamento por imagens arbitrarias
- dependencias de producao sem advisories ativos no audit atual
