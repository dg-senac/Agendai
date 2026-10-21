'use client';
import { DayPicker } from 'react-day-picker';
import { ptBR } from 'date-fns/locale';
import 'react-day-picker/style.css';

/** Calendário isolado para carregamento sob demanda (fora do JS inicial). */
export default function Calendario({ selected, onSelect, hoje, limite }: {
  selected: Date | undefined; onSelect: (d: Date | undefined) => void; hoje: Date; limite: Date;
}) {
  return (
    <DayPicker mode="single" locale={ptBR} selected={selected} onSelect={onSelect}
      disabled={[{ before: hoje }, { after: limite }]} startMonth={hoje} endMonth={limite} autoFocus={false} />
  );
}
