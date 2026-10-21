# DECISIONS.md — Registro de decisões técnicas

Toda decisão não especificada no briefing segue a opção mais simples e segura e é registrada aqui.

## Fase 1 – Fundação (2026-10-21)

1. **Projeto Supabase dedicado pendente.** A conta conectada possui dois projetos (`sifau-app` e `dg-senac's Project`) que não são do Agendaí. Nenhum deles foi alterado. Enquanto o projeto do Agendaí não é escolhido/criado, o app roda em **modo demonstração** (dados de exemplo no `localStorage`, selo visível na interface) e toda a integração real (Auth, RLS, RPCs, API) fica pronta para ligar via `.env.local`. *Bloqueio para declarar a Fase 1 100% validada:* executar o SQL num projeto real e testar login/CRUD/RLS de ponta a ponta.

2. **Um único SQL executável do zero.** `supabase/schema_completo.sql` contém extensões, tabelas, índices, constraint anti-sobreposição, funções, triggers, RLS, permissões, bucket de Storage e seeds de demonstração. O mesmo conteúdo versiona como migration `supabase/migrations/20261021000001_fase1_fundacao.sql`. Fases seguintes entram como novas migrations incrementais; o `schema_completo.sql` será regenerado ao fim de cada fase para continuar sendo "colar e rodar".

3. **Enums como `text` + `CHECK`** em vez de tipos `ENUM` do Postgres: evoluir valores no futuro não exige migração de tipo, e as mensagens de validação ficam sob nosso controle (Zod espelha as mesmas listas).

4. **`negocio_id` também em `horarios_trabalho`, `bloqueios` e `membro_servicos`** (desnormalizado): simplifica e acelera as policies de RLS (sem joins), seguindo a regra "todas as tabelas de negócio com `negocio_id`". A API garante a consistência (membro precisa pertencer ao negócio).

5. **Um usuário = um negócio (Fase 1).** Índice único parcial em `membros(user_id)`. Simplifica `auth_negocio_id()`. Multi-negócio por usuário pode ser revisitado depois com seletor de workspace.

6. **Exatamente um dono ativo por negócio** (índice único parcial). Transferência de propriedade fica para fase futura, se necessária.

7. **Um turno por dia da semana** (`unique(membro_id, dia_semana)`, com intervalo opcional). Cobre a imensa maioria dos pequenos negócios; múltiplos turnos podem ser liberados removendo a constraint e ajustando a RPC de disponibilidade (que já itera por linha de horário).

8. **Vínculo membro↔serviço com regra permissiva:** se o profissional não tem nenhum vínculo em `membro_servicos`, ele atende todos os serviços; se tem vínculos, só os vinculados. Evita fricção para negócios de uma pessoa só. A UI de vínculos chega junto da agenda (Fase 2).

9. **Criação do negócio apenas via RPC `criar_negocio`** (SECURITY DEFINER): garante atomicidade negócio+dono+trial e impede inserts órfãos; não há policy de INSERT em `negocios`.

10. **Super admin via `app_metadata.super_admin`** no JWT (definido manualmente no painel do Supabase Auth). Sem tabela extra; o painel `/admin` chega na Fase 5.

11. **Auditoria por trigger genérica** (`registrar_auditoria`) em `negocios`, `membros`, `servicos`, `pagamentos` e `assinaturas`, gravando antes/depois em JSONB. Cobre mudança de plano, exclusões e dinheiro desde já.

12. **Fontes:** o briefing pede Plus Jakarta Sans + Inter via `next/font`. Neste ambiente de build não há acesso ao Google Fonts, então a Fase 1 usa pilha de fontes do sistema para não quebrar o build; ativar `next/font/google` no primeiro deploy (Vercel baixa e self-hospeda). Registrado como pendência cosmética da Fase 5.

13. **Bibliotecas de animação adiadas com propósito:** GSAP/Lenis só entram na landing (Fase 5) e Motion nas microinterações das fases 2+; a Fase 1 usa CSS/transições leves para manter o bundle enxuto (ver `PERFORMANCE.md`). shadcn/ui é adotado como padrão de componentes próprios compatíveis (Button com `cva` + Radix Slot) sem CLI, para evitar dependências desnecessárias nesta fase.

14. **CSRF por checagem de `Origin` × `Host`** nas rotas de API com cookie de sessão (SameSite do Supabase + esta barreira). Webhooks (Fase 3) usarão assinatura do provedor, sem cookie.

15. **Rate limit, limites por plano e jobs** estão desenhados no schema (colunas e índices prontos) e serão **aplicados no back-end** nas Fases 2–4, junto dos fluxos que protegem — nada de regra só no front.

## Fase 2 – Núcleo (2026-10-21, modo demonstração por decisão do usuário)

16. **Prioridade de validação alterada pelo usuário:** seguir para a Fase 2 apenas em modo demonstração. Todo o caminho real (RPCs novas, APIs públicas, RLS) foi implementado junto, mas **ainda não foi testado num Supabase real** — segue como pendência bloqueante para produção, não para o desenvolvimento das próximas fases.

17. **Disponibilidade em duas camadas idênticas:** `src/lib/disponibilidade.ts` (TypeScript puro, testado com Vitest) espelha a RPC `horarios_disponiveis`. No modo real, o banco é a fonte da verdade (RPC + EXCLUDE constraint); no demo, `encontrarConflito` simula a mesma garantia. Fuso: banco usa `fuso_horario` do negócio; o demo usa o horário local do navegador (suficiente para demonstração).

18. **Agendamento público atômico via RPC** `criar_agendamento_publico`: valida o slot contra `horarios_disponiveis`, faz upsert do cliente por `(negocio_id, whatsapp)`, exige consentimento LGPD, aplica rate limit por WhatsApp (5/hora) e traduz `exclusion_violation` para mensagem em pt-BR. "Qualquer profissional" = primeiro slot livre por ordem de nome (balanceamento sofisticado fica para depois, se necessário).

19. **Rate limit por IP em memória** nas APIs públicas (primeira barreira, por instância serverless). A proteção forte é o limite por WhatsApp na RPC. Evolução para Upstash/Redis registrada para a Fase 6.

20. **Calendário próprio leve no painel** (dia/semana/mês com CSS grid) em vez de Schedule-X: menos dependências, controle total do drag & drop com `@dnd-kit/core` (semana: arrasta entre dias; dia: arrasta entre horas, mantendo os minutos). Arrastar nunca troca o profissional — só dia/hora — para evitar remarcações acidentais entre pessoas.

21. **Bundle da página pública:** DayPicker, Embla e confetti via `next/dynamic`/import dinâmico (fora do JS inicial). Mesmo assim `/[slug]` está em 180 kB de First Load (meta: 150 kB gzip). Restante vem de Motion + providers globais do layout raiz; otimização final (layouts por grupo de rotas e bundle analyzer) fica para a auditoria da Fase 6 — registrado em PERFORMANCE.md.

22. **Sinal na Fase 2 é apenas informativo:** serviços com `exige_sinal` geram agendamento `pendente_pagamento` (reserva) e a interface avisa que o Pix chega na Fase 3; a expiração automática da reserva (10 min) será ligada com o job da Fase 3/4.

## Fase 3 – Dinheiro (2026-10-21, modo demonstração)

23. **Camada `PaymentProvider`** (`src/lib/pagamentos/`): interface única (cobrança Pix, consulta, estorno, checkout de assinatura) com duas implementações — `MercadoPagoProvider` (API REST real, idempotency-key por pagamento) e `PagamentoSimulado` (copia e cola claramente marcado "SIMULADO-NAO-PAGUE"). Trocar para Stripe no futuro = nova classe, sem tocar nas rotas. Sem token MP do negócio ou da plataforma, o sistema usa o simulado e a interface avisa.

24. **Credenciais MP por negócio** na tabela `negocio_integracoes`, **sem nenhuma policy de leitura para usuários**: o dono grava via RPC `salvar_credenciais_mp` e só pergunta "estou conectado?" via `integracao_mp_status`; quem lê o token é o servidor com `service_role` (`src/lib/supabase/admin.ts`). Em produção, o passo seguinte é criptografar com Supabase Vault/pgsodium — registrado para a revisão de segurança da Fase 6. Nunca logamos o token.

25. **Webhook não confia no corpo:** valida assinatura HMAC (x-signature), registra em `webhooks_recebidos` com evento único (idempotência — reenvio responde 200 sem reprocessar), **reconsulta o pagamento na API do MP** e só então marca `pago` + confirma o agendamento. Valor divergente = erro registrado, sem confirmar.

26. **Limites por plano no banco (triggers)**, espelhados em `src/lib/planos.ts` para UX/demo: profissionais (1/3/∞), 30 agendamentos/mês no Grátis, sinal zerado à força fora de plano pago, CSV só Premium. `plano_efetivo`: trial válido = Pro; trial vencido/suspenso = Grátis; inadimplente mantém durante a carência de 7 dias (a virada automática é job da Fase 4).

27. **Assinatura do SaaS via preapproval do MP** (link de checkout). Sem credenciais da plataforma, a ativação é simulada e imediata — comportamento explícito na API (`simulado: true`) e na interface. Cancelamento mantém recursos até o fim do ciclo (campo já modelado; a expiração é job da Fase 4).

28. **Estornos:** negócio cancela → estorno automático do sinal pago; cliente cancela dentro do prazo → estorna se `config_estorno_cliente_no_prazo` (padrão ligado). No demo, o pagamento vira `estornado`; no real, a chamada `estornar` do provedor sai das rotas de cancelamento (best-effort com registro).

29. **Reserva de 10 min:** `pendente_pagamento` só bloqueia a agenda enquanto `reserva_expira_em` não vence (TS e SQL alinhados). A limpeza definitiva é `expirar_reservas()` (service_role), exposta via `/api/cron/expirar-reservas` (header `x-cron-secret`) e Edge Function equivalente — o agendamento pg_cron entra na Fase 4 junto dos lembretes.
