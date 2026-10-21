// Rate limit simples em memória (por instância). Em produção serverless ele é
// uma primeira barreira; a proteção forte por WhatsApp está na RPC do banco e
// pode evoluir para Upstash/Redis na Fase 6 (registrado em DECISIONS.md).
const janela = new Map<string, number[]>();
export function dentroDoLimite(chave: string, maximo: number, janelaMs: number): boolean {
  const agora = Date.now();
  const lista = (janela.get(chave) ?? []).filter((t) => agora - t < janelaMs);
  if (lista.length >= maximo) { janela.set(chave, lista); return false; }
  lista.push(agora);
  janela.set(chave, lista);
  return true;
}
export const ipDaRequisicao = (req: Request) =>
  req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'desconhecido';
