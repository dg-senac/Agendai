import { notFound } from 'next/navigation';
import { Workspace } from '@/components/workspace';
import { loadWorkspace } from '@/server/workspace';
export const dynamic = 'force-dynamic';
export default async function Page({params}:{params:Promise<{section:string}>}){const {section}=await params;if(section!=='agenda'&&section!=='clientes'&&section!=='servicos'&&section!=='equipe'&&section!=='horarios'&&section!=='financeiro'&&section!=='avaliacoes'&&section!=='configuracoes')notFound();return <Workspace section={section} {...await loadWorkspace()}/>;}
