import { NextResponse } from 'next/server'
import { chavePublicaJwk } from '@/lib/credencial'

// Chave pública do emissor, no formato JWKS.
//
// É o que permite a qualquer pessoa verificar uma credencial sem falar conosco.
// Publicar a chave pública é seguro por definição: ela só serve para CONFERIR
// assinatura, nunca para produzir uma.
//
// Se a plataforma um dia sair do ar, esta chave precisa continuar publicada em
// algum lugar estável — por isso ela também é impressa pelo script que a gera,
// para ficar guardada junto da documentação da coordenação.

export async function GET() {
  const jwk = chavePublicaJwk()

  if (!jwk) {
    return NextResponse.json(
      { keys: [], aviso: 'nenhuma chave de assinatura configurada neste servidor' },
      { status: 200 }
    )
  }

  return NextResponse.json(
    { keys: [jwk] },
    {
      headers: {
        'Cache-Control': 'public, max-age=3600',
        'Access-Control-Allow-Origin': '*',
      },
    }
  )
}
