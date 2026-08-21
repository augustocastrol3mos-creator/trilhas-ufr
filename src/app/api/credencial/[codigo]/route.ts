import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { montarCredencial, assinarCredencial, type DadosCredencial } from '@/lib/credencial'

// Rota PÚBLICA, sem login. Credencial verificável que exige conta não serve
// para nada: quem verifica é justamente quem não tem conta aqui — a comissão de
// atividades complementares, um empregador, outra instituição.

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ codigo: string }> }
) {
  const { codigo } = await params
  const supabase = await createClient()

  const { data, error } = await supabase.rpc('dados_credencial', { p_codigo: codigo })
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ erro: 'certificado nao encontrado' }, { status: 404 })

  const d = data as DadosCredencial
  const credencial = montarCredencial(d)
  const jwt = assinarCredencial(credencial, `${d.urlBase}/emissor`)

  const corpo = jwt
    ? { ...credencial, proof: { type: 'JsonWebSignature2020', jws: jwt } }
    : {
        ...credencial,
        _aviso:
          'Esta credencial NÃO está assinada: a chave de assinatura não foi configurada no servidor. Os dados estão corretos, mas não podem ser verificados offline — use o endereço de validação online.',
      }

  return new NextResponse(JSON.stringify(corpo, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="credencial-${d.codigo}.json"`,
      // Cache curto: o conteúdo é imutável, exceto por revogação — que precisa
      // aparecer rápido para não circular credencial revogada como válida.
      'Cache-Control': 'public, max-age=300',
      'Access-Control-Allow-Origin': '*',
    },
  })
}
