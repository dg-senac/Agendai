'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { toast } from 'sonner';
import { ArrowRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatarHora } from '@/lib/disponibilidade';

const Calendario = dynamic(() => import('./calendario'), { ssr: false, loading: () => <p className="muted" style={{ fontSize: 12, padding: 24 }}>Carregando calendário…</p> });

export type SlotPub = { membro_id: string; inicio: string; fim: string };
export type BuscarSlots = (data: Date, servicoId: string, membroId: string | null) => Promise<SlotPub[]>;

export function SeletorHorario({ cor, buscarSlots, servicoId, membroId, slotSel, onSelect, onContinuar }: {
  cor: string; buscarSlots: BuscarSlots; servicoId: string; membroId: string | null;
  slotSel: SlotPub | null; onSelect: (s: SlotPub) => void; onContinuar?: () => void;
}) {
  const [data, setData] = useState<Date | undefined>(undefined);
  const [slots, setSlots] = useState<SlotPub[]>([]);
  const [carregando, setCarregando] = useState(false);
  const hoje = useMemo(() => new Date(), []);
  const limite = useMemo(() => new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + 60), [hoje]);

  const carregar = useCallback(async (d: Date) => {
    setCarregando(true);
    try { setSlots(await buscarSlots(d, servicoId, membroId)); }
    catch { toast.error('Não foi possível buscar os horários deste dia.'); setSlots([]); }
    setCarregando(false);
  }, [buscarSlots, servicoId, membroId]);

  useEffect(() => { if (data) void carregar(data); }, [data, carregar]);

  const tempos = useMemo(() => {
    const mapa = new Map<string, SlotPub>();
    for (const s of slots) if (!mapa.has(s.inicio)) mapa.set(s.inicio, s);
    return [...mapa.values()];
  }, [slots]);

  return (
    <div className="mt-4">
      <h2 className="text-lg font-bold">Escolha o dia e o horário</h2>
      <div className="pub-calendario mt-4">
        <Calendario selected={data} onSelect={setData} hoje={hoje} limite={limite} />
      </div>
      {data && (
        <div className="mt-5">
          <p style={{ fontSize: 13, fontWeight: 700 }}>Horários livres — {data.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'short' })}</p>
          {carregando ? <p className="muted row mt-4" style={{ fontSize: 12 }}><Loader2 size={15} className="animate-spin" />Buscando horários…</p>
            : tempos.length === 0 ? <p className="muted mt-4" style={{ fontSize: 12, lineHeight: 1.7 }}>Nenhum horário livre neste dia. 😕<br />Experimente outra data — a agenda abre novas vagas toda semana.</p>
            : (
              <div className="flex flex-wrap gap-2 mt-3">
                {tempos.map((s) => {
                  const ativo = slotSel?.inicio === s.inicio;
                  return <button key={s.inicio} onClick={() => onSelect(s)} aria-pressed={ativo} className="badge" style={{ padding: '10px 14px', fontSize: 12, borderRadius: 10, background: ativo ? cor : 'var(--hover)', color: ativo ? '#fff' : 'var(--foreground)', border: `1px solid ${ativo ? cor : 'var(--border)'}` }}>{formatarHora(new Date(s.inicio))}</button>;
                })}
              </div>
            )}
          {onContinuar && <Button className="w-full mt-6" style={{ background: cor }} disabled={!slotSel || !data || new Date(slotSel.inicio).toDateString() !== data.toDateString()} onClick={onContinuar}>Continuar<ArrowRight size={15} /></Button>}
        </div>
      )}
      {!data && <p className="muted mt-4" style={{ fontSize: 12 }}>Toque em um dia do calendário para ver os horários livres.</p>}
    </div>
  );
}
