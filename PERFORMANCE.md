# PERFORMANCE.md — Orçamento e medições

Metas (briefing §8.4): Lighthouse > 90 nas páginas públicas, JS inicial do fluxo público < 150 KB gzip, LCP < 2,5 s em 4G, CLS < 0,1. GSAP/Lenis **nunca** entram no bundle público/agendamento.

## Fase 1 — build de produção (2026-10-21, `next build`)

| Rota | Tamanho da rota | First Load JS |
|---|---|---|
| `/` (redireciona p/ painel) | 150 B | 103 kB |
| `/entrar` | 3,08 kB | 168 kB |
| `/cadastro` | 3,08 kB | 168 kB |
| `/onboarding` | 5,2 kB | 131 kB |
| `/painel` + `/painel/[section]` | 136 B (+ workspace compartilhado) | 167 kB |
| APIs (`/api/*`) | 150 B | — (server) |
| Middleware | — | 93,9 kB (edge, não vai ao navegador como JS de página) |
| Compartilhado (todas) | — | 103 kB |

Observações:
- Ainda **não existem** rotas públicas (`/[slug]`, fluxo de agendamento) — chegam na Fase 2 já sob o teto de 150 KB gzip; o painel (autenticado) não está sob esse teto, mas segue monitorado.
- Nenhuma biblioteca proibida (§8.1) foi instalada. GSAP/Lenis/Motion pesado ficam fora até as fases em que são previstos, sempre com `next/dynamic`.
- Lighthouse real será medido na Fase 5 (landing + página pública) e auditado na Fase 6.

## Fase 2 — build de produção (2026-10-21)

| Rota | Tamanho da rota | First Load JS |
|---|---|---|
| `/[slug]` (página pública + agendamento) | 177 B | **180 kB** ⚠️ (meta: 150 kB gzip) |
| `/agendamento/[token]` | 4,38 kB | 184 kB |
| `/painel` (+ agenda/clientes via dynamic) | 142 B | 170 kB |
| `/entrar`, `/cadastro` | 3,08 kB | 168 kB |
| `/onboarding` | 5,23 kB | 131 kB |
| Compartilhado | — | 103 kB |

Otimizações aplicadas: DayPicker + locale pt-BR, Embla e canvas-confetti fora do JS inicial (`next/dynamic`); Motion com `LazyMotion + domAnimation`; agenda/clientes do painel via dynamic import.
⚠️ **Pendência registrada:** `/[slug]` 30 kB acima da meta. Plano (Fase 6): medir gzip real com bundle analyzer, mover providers pesados (React Query) para layouts por grupo de rotas e reavaliar Motion no fluxo público.

## Fase 3 — build de produção (2026-10-21)

| Rota | First Load JS |
|---|---|
| `/[slug]` (pública + Pix) | 183 kB ⚠️ |
| `/agendamento/[token]` | 187 kB |
| `/painel` (+ financeiro/plano via dynamic) | 172 kB |
| `/entrar`, `/cadastro` | 169 kB |
| APIs de pagamento/webhook/cron | server-only (0 no cliente) |

A biblioteca `qrcode` entra **só sob demanda** na tela do Pix (import dinâmico) e apenas quando o provedor não devolve QR em base64. A pendência dos 150 kB permanece para a Fase 6.

## Fase 4 — build de produção (2026-10-21)

| Rota | First Load JS |
|---|---|
| `/[slug]` | ~183 kB ⚠️ (inalterado) |
| `/painel` (+ avaliações/notificações via dynamic) | 174 kB |
| APIs de cron/avaliações/convites | server-only |

Resend e React Email vivem **só no servidor** (worker) — zero impacto no bundle do navegador.

## Fase 5 — build de produção (2026-10-21)

| Rota | First Load JS |
|---|---|
| `/` (landing; GSAP/Lenis sob demanda) | 124 kB |
| `/admin` | 124 kB |
| `/[slug]` | 185 kB ⚠️ |
| `/painel` (+ relatórios/cmdk via dynamic) | 174 kB |
| `/privacidade`, `/termos` | 104 kB (estáticas) |

GSAP + Lenis **não entram no First Load** da landing: são chunks separados carregados em `useEffect` (~ animação progressiva — sem rede animada, a página já nasce completa). Relatórios e paleta de comandos também são chunks sob demanda no painel. A pendência dos 150 kB em `/[slug]` permanece para a Fase 6 (bundle analyzer + gzip real).

## Fase 6 — build de produção final (2026-10-21)

Medido com `@next/bundle-analyzer` (`npm run analyze`) + `app-build-manifest.json` por rota. Os números abaixo são o **First Load JS (gzip)** reportado pelo Next.

| Rota | Antes (F5) | **Fase 6** | Meta |
|---|---|---|---|
| `/[slug]` (pública) | 185 kB | **144 kB** ✅ | ≤ 150 kB |
| `/agendamento/[token]` | 187 kB | **139 kB** ✅ | ≤ 150 kB |
| `/` (landing) | 124 kB | 124 kB | — |
| `/painel` | 174 kB | 174 kB | — |
| `/admin` | 124 kB | 124 kB | — |
| Shared (React + Next) | 103 kB | 104 kB | piso da plataforma |

**O que cortou (página pública):**
1. **Motion fora do wizard (−41,5 kB gzip):** a transição entre etapas virou CSS (`.etapa-animada`). Motion segue no painel; GSAP, na landing.
2. **React Query fora do layout raiz:** provider movido para `painel/layout.tsx` (ninguém usava `useQuery` no cliente público).
3. **`SeletorHorario` extraído** de `publica.tsx`: a tela do cliente parou de baixar o wizard inteiro (−48 kB).
4. **`PublicaDemo` em chunk dinâmico próprio:** demo store + disponibilidade + automação só baixam no modo demonstração.

O Sentry do navegador é import dinâmico condicionado ao DSN — **0 kB** enquanto não houver conta. Pendência histórica dos 150 kB: **encerrada** 🎉. Core Web Vitals em campo ficam para o Lighthouse CI (`lighthouse.yml`, orçamentos em `.lighthouserc.json`) após o deploy.
