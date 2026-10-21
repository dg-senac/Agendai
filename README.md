# Agendaí 💜

Plataforma de agendamento online com cobrança via Pix para pequenos negócios brasileiros (barbearias, salões, manicures, personal trainers, pequenas clínicas). Cada negócio ganha sua página pública (`agendai.app/nome-do-negocio`) e um painel completo de gestão.

## Status das fases

| Fase | Escopo | Status |
|---|---|---|
| 1 – Fundação | Setup, design system/tema, SQL completo com RLS, autenticação, onboarding, CRUD de serviços/equipe/horários | 🟡 Código pronto; falta conectar um projeto Supabase dedicado |
| 2 – Núcleo | Disponibilidade, página pública + fluxo de agendamento, agenda do painel, clientes | 🟡 Pronta em modo demonstração; caminho real (RPCs/APIs) implementado, aguardando Supabase dedicado |
| 3 – Dinheiro | Pix (Mercado Pago), webhooks, financeiro, assinaturas e limites por plano | 🟡 Pronta em modo demonstração (Pix simulado); integração MP real implementada, aguardando credenciais + Supabase |
| 4 – Automação | E-mails, lembretes (pg_cron), avaliações, .ics, trial/inadimplência | 🟡 Pronta em modo demonstração (e-mails simulados); Resend/pg_cron implementados, aguardando chaves + Supabase |
| 5 – Crescimento | Landing page (GSAP/Lenis), relatórios, SEO, PWA, super admin, Ctrl+K | ⏳ |
| 6 – Qualidade | Testes E2E, Sentry, auditoria de performance e segurança | ⏳ |

Decisões técnicas registradas em [`DECISIONS.md`](./DECISIONS.md). Tamanhos de bundle por rota em [`PERFORMANCE.md`](./PERFORMANCE.md).

## Como rodar localmente

Pré-requisitos: Node 22+ e (para sair do modo demonstração) um projeto Supabase.

```bash
npm install
cp .env.example .env.local   # preencha as chaves do Supabase
npm run dev                  # http://localhost:3000
```

### Sem Supabase (modo demonstração)

Se `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` estiverem vazias, o app roda em **modo demonstração claramente identificado na tela**: dados de exemplo salvos no navegador (`localStorage`), sem tocar em nenhum servidor. Útil para avaliar a interface.

### Com Supabase (ambiente real)

1. Crie um projeto novo em [supabase.com](https://supabase.com) (região São Paulo, se disponível).
2. Abra **SQL Editor**, cole todo o conteúdo de [`supabase/schema_completo.sql`](./supabase/schema_completo.sql) e execute. Ele cria tabelas, RLS, RPCs, triggers, bucket de Storage e um negócio de demonstração (`studio-beleza-natural` — apague em produção com o comando indicado no fim do arquivo).
3. Em **Authentication → URL Configuration**, adicione `http://localhost:3000/api/auth/callback` (e a URL de produção depois).
4. (Opcional) Ative o provedor **Google** em Authentication → Providers.
5. Copie `Project URL` e `anon key` (Project Settings → API) para o `.env.local`.
6. `npm run dev` → crie sua conta em `/cadastro` → o onboarding cria o negócio (RPC `criar_negocio`, trial Pro de 14 dias).

Para virar **super admin** (Fase 5): no painel do Supabase Auth, edite seu usuário e defina `app_metadata = {"super_admin": true}`.

## Arquitetura (resumo)

- **Next.js 15 (App Router) + TypeScript + Tailwind 4** — rotas em `src/app`, componentes em `src/components`, regras/validações em `src/server`, clientes externos em `src/lib`.
- **Multi-tenant por `negocio_id`** em todas as tabelas de negócio; isolamento garantido por **RLS** com helpers `auth_negocio_id()` / `auth_membro_id()` / `eh_dono()`. Papel `anon` não lê nenhuma tabela — só executa RPCs públicas controladas (`negocio_publico`, `horarios_disponiveis`, `slug_disponivel`).
- **Sem double-booking**: constraint `EXCLUDE USING gist` em `agendamentos` impede sobreposição de horários ativos do mesmo profissional, mesmo sob concorrência.
- **Disponibilidade no banco**: RPC `horarios_disponiveis` gera slots de 15 min no fuso do tenant removendo intervalos, bloqueios, conflitos e antecedência mínima.
- **Dinheiro em centavos** (inteiros) em todo o sistema; formatação `pt-BR` só na exibição.
- **Segurança**: Zod em toda entrada (cliente e servidor), checagem de origem (CSRF) nas rotas de API, headers de segurança, `service_role` apenas no servidor (jobs/webhooks das próximas fases), auditoria automática via triggers em entidades sensíveis.

## Scripts

| Comando | O que faz |
|---|---|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` / `npm start` | Build e servidor de produção |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript sem emitir arquivos |
| `npm test` | Vitest (testes unitários em `tests/`) |

CI no GitHub Actions (`.github/workflows/ci.yml`): lint, typecheck, testes e build a cada push/PR.

## Testar a Fase 4 (automação — demonstração)

1. Faça um agendamento na página pública: no dashboard, o card **"Lembretes & avisos"** mostra a confirmação como "Simulada" e os lembretes agendados; quando um lembrete de WhatsApp vence, envie com 1 clique.
2. Na agenda, **conclua** um atendimento e abra o link do cliente: formulário de **avaliação** (estrelas + comentário). Depois, em `/painel/avaliacoes`, responda e publique — ela aparece na página pública.
3. Em Configurações → Plano, simule o status da assinatura e ajuste datas pelo DevTools (`agendai-demo-v3`) para ver trial vencendo → Grátis e a carência de 7 dias.
4. Adicione um profissional com e-mail em `/painel/equipe` (no modo real, dispara o convite do Supabase Auth).
5. Modo real: defina `RESEND_API_KEY`, `EMAIL_FROM` e `CRON_SECRET`, rode a migration 0004 (pg_cron é opcional) e agende `POST /api/cron/jobs` a cada minuto (Edge Function `processar-notificacoes` incluída).

## Testar a Fase 3 (dinheiro — demonstração)

1. Em `/studio-beleza-natural`, agende **Coloração completa** (exige sinal): ao confirmar, aparece a tela do Pix com QR Code, copia e cola e contagem de 10:00. Use **"Já paguei (simular)"** para confirmar ou **"Simular expiração"** para ver o horário ser liberado.
2. Em `/painel/financeiro`: filtros por período/status, totais, **Registrar recebimento** manual e o botão de CSV bloqueado (Premium).
3. Em `/painel/configuracoes`: troque o plano para **Premium** e o CSV libera; mude para **Grátis** e tente adicionar um 2º profissional (bloqueado) ou agendar coloração (sem sinal). Simule **inadimplência** e veja o banner de carência.
4. Cancele (pelo link do cliente ou na agenda) um agendamento com sinal pago e confira o **estorno** no Financeiro.
5. Para resetar a demonstração, apague a chave `agendai-demo-v3` do localStorage.

## Testar a Fase 5 (demonstração)

1. Abra `/`: a **landing** animada (GSAP + Lenis) — hero com mockup flutuante, bento, planos com borda animada, FAQ e contadores. Com `prefers-reduced-motion` ativado no sistema, tudo fica estático (teste no DevTools → Rendering).
2. Em `/painel/relatorios` (Premium): receita por dia, top serviços/profissionais, horários de pico, comparecimento e novos clientes. Troque o plano para Grátis em `/painel/configuracoes` e volte: aparece o upsell com prévia borrada.
3. No painel, aperte **Ctrl+K** (ou ⌘K): busque por uma página, pelo nome de um cliente ou por "novo serviço".
4. **PWA:** em produção, o navegador oferece "Instalar aplicativo"; ícones e manifesto em `/manifest.webmanifest`; offline, páginas já visitadas abrem do cache (APIs nunca são cacheadas).
5. SEO: `/sitemap.xml`, `/robots.txt`, além de `/privacidade` e `/termos`.
6. `/admin`: em demonstração explica o pré-requisito; com Supabase + perfil super admin, mostra MRR/churn e suspende/reativa negócios (auditado).

## Testar a Fase 2 (demonstração)

1. Abra `/studio-beleza-natural` e faça um agendamento completo (serviço → profissional → dia/hora → dados → resumo). Horários ocupados, intervalo de almoço e antecedência mínima já são respeitados.
2. Na confirmação, abra o link do cliente (`/agendamento/<token>`): remarque e cancele (respeita o limite de 4h), baixe o `.ics`.
3. No painel: `/painel/agenda` (arraste atendimentos entre dias/horas, crie agendamento manual, bloqueie uma folga e veja o horário sumir da página pública), `/painel/clientes` (histórico, WhatsApp, exportar/excluir — LGPD), e os chips de "serviços que atende" em `/painel/equipe`.
4. Os dados persistem no navegador (`localStorage`, chave `agendai-demo-v2`). Para resetar a demonstração, apague essa chave no DevTools.

## Testar a Fase 1

1. `npm run dev` e abra `/painel` — no modo demonstração, crie/edite/exclua serviços, equipe e horários; altere os dados em Configurações; alternância de tema no topo.
2. Acesse `/cadastro`, `/entrar` e `/onboarding` para ver os fluxos (no demo, eles simulam e levam ao painel).
3. Com Supabase conectado: cadastre-se, complete o onboarding (verificação de slug em tempo real), confira no painel do Supabase as linhas em `negocios`, `membros`, `servicos` e `horarios_trabalho`.
4. Isolamento entre tenants: siga `tests/sql/rls_isolamento_tenant.sql`.
5. `npm test`, `npm run typecheck`, `npm run lint`, `npm run build` — tudo verde.
