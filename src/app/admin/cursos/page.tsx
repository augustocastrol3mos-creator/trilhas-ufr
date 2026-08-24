import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import CardCurso from './CardCurso'
import { exigirAdmin } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export default async function AdminCursosPage() {
  await exigirAdmin()
  const supabase = await createClient()
  const { data: cursos } = await supabase
    .from('curso')
    .select('id, titulo, descricao, status, modalidade, carga_horaria, autor_id, destaque_nota')
    .order('criado_em', { ascending: false })

  const { data: autores } = await supabase.from('usuario').select('id, nome_completo, email')
  const mapa = new Map((autores ?? []).map((a) => [a.id, a]))

  const lista = cursos ?? []

  // Diagnóstico de exclusão por curso: quantas turmas, matrículas e
  // certificados existem. A tela precisa saber ANTES de mostrar o botão se o
  // curso é elegível — e, quando não é, por quê. Em paralelo porque são
  // independentes entre si; a lista de cursos da coordenação é curta.
  const diagnosticos = new Map<string, any>(
    await Promise.all(
      lista.map(async (c) => {
        const { data } = await supabase.rpc('pode_excluir_curso', { p_curso: c.id })
        return [c.id, data] as [string, any]
      })
    )
  )
  const emAnalise = lista.filter((c) => c.status === 'em_analise')
  const resto = lista.filter((c) => c.status !== 'em_analise')

  return (
    <div>
      <Link href="/admin" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft className="h-3.5 w-3.5" />
        Coordenação
      </Link>

      <h1 className="mt-4 font-display text-2xl font-semibold text-ink">Cursos</h1>
      <p className="mt-1 text-sm text-muted">
        Um curso publicado emite certificado em nome da UFR. A autorização é o ponto em
        que a instituição assume isso.
      </p>

      {emAnalise.length > 0 && (
        <>
          <h2 className="mt-8 font-display text-lg font-semibold text-ink">
            Aguardando autorização
          </h2>
          <ul className="mt-3 space-y-3">
            {emAnalise.map((c) => (
              <CardCurso key={c.id} curso={c as any} autor={mapa.get(c.autor_id!) as any} diagnostico={diagnosticos.get(c.id)} />
            ))}
          </ul>
        </>
      )}

      <h2 className="mt-8 font-display text-lg font-semibold text-ink">Todos os cursos</h2>
      <ul className="mt-3 space-y-3">
        {resto.map((c) => (
          <CardCurso key={c.id} curso={c as any} autor={mapa.get(c.autor_id!) as any} diagnostico={diagnosticos.get(c.id)} />
        ))}
      </ul>
    </div>
  )
}
