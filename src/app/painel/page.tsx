import { Workspace } from '@/components/workspace';
import { loadWorkspace } from '@/server/workspace';
export const dynamic = 'force-dynamic';
export default async function Page(){return <Workspace section="visao-geral" {...await loadWorkspace()}/>;}
