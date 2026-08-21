import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Exportação em CSV para a coordenação.
//
// É rota, não página, porque o navegador precisa BAIXAR um arquivo — e isso se
// faz com Content-Disposition, que só existe numa resposta HTTP. Uma página
// teria que montar o arquivo no cliente, o que exigiria trazer todos os dados
// para o navegador só para reescrevê-los.
//
// A autorização mora nas RPCs (e_admin). Se quem chamar não for coordenação,
// o banco recusa e devolvemos 403 — a rota não reimplementa a regra.

const MAPA: Record<string, { rpc: string; arquivo: string }> = {
  certificados: { rpc: 'exportar_certificados', arquivo: 'livro-de-certificados' },
  matriculas:   { rpc: 'exportar_matriculas',   arquivo: 'matriculas' },
  cursos:       { rpc: 'exportar_cursos',       arquivo: 'cursos' },
}

/**
 * Escapa um valor para CSV.
 *
 * O ponto que quase todo mundo erra: nome com vírgula ("Silva, João") quebra a
 * coluna, e aspas dentro do texto quebram o campo. A regra do RFC 4180 é
 * envolver em aspas e dobrar as aspas internas.
 */
function celula(v: unknown): string {
  if (v === null || v === undefined) return ''
  if (v instanceof Date) return v.toISOString()
  const s = String(v)
  return /[",;\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ tipo: string }> }
) {
  const { tipo } = await params
  const alvo = MAPA[tipo]
  if (!alvo) return NextResponse.json({ erro: 'exportacao desconhecida' }, { status: 404 })

  const supabase = await createClient()
  const { data, error } = await supabase.rpc(alvo.rpc)

  if (error) return NextResponse.json({ erro: error.message }, { status: 403 })

  const linhas = (data ?? []) as Record<string, unknown>[]
  const colunas = linhas.length > 0 ? Object.keys(linhas[0]) : ['sem_dados']

  // Ponto e vírgula, não vírgula: o Excel em português usa ";" como separador
  // padrão. Com vírgula, a planilha abre tudo numa coluna só e a pessoa conclui
  // que a exportação está quebrada.
  const csv = [
    colunas.join(';'),
    ...linhas.map((l) => colunas.map((c) => celula(l[c])).join(';')),
  ].join('\r\n')

  // BOM UTF-8: sem ele o Excel lê "Ciências" como "CiÃªncias".
  const corpo = '\uFEFF' + csv
  const data_ = new Date().toISOString().slice(0, 10)

  return new NextResponse(corpo, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${alvo.arquivo}-${data_}.csv"`,
      'Cache-Control': 'no-store',
    },
  })
}
