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
