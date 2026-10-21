import { NextRequest,NextResponse } from 'next/server';
import { configured,supabase } from '@/lib/supabase/server';
import { businessSchema } from '@/server/validators/foundation';
export async function GET(req:NextRequest){const slug=req.nextUrl.searchParams.get('slug')??'';if(!businessSchema.shape.slug.safeParse(slug).success)return NextResponse.json({disponivel:false});if(!configured())return NextResponse.json({disponivel:true,demo:true});const db=await supabase();const {data,error}=await db.rpc('slug_disponivel',{p_slug:slug});return NextResponse.json({disponivel:!error&&data===true});}
