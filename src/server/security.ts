import { NextRequest, NextResponse } from 'next/server';
export function sameOrigin(request:NextRequest){const origin=request.headers.get('origin');const host=request.headers.get('x-forwarded-host')??request.headers.get('host');if(!origin||new URL(origin).host!==host)return NextResponse.json({error:'Origem da solicitação não autorizada.'},{status:403});return null;}
