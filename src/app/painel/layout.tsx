import { QueryProvider } from '@/components/query-provider';

export default function PainelLayout({ children }: { children: React.ReactNode }) {
  return <QueryProvider>{children}</QueryProvider>;
}
