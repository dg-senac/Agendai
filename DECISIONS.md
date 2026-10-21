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
