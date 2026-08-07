import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import TabelaFechamento, { type AlunoFechamento } from './TabelaFechamento'

export const dynamic = 'force-dynamic'

export default async function FechamentoPage({
  params,
}: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: turma } = await supabase
    .from('turma')
    .select('id, identificador, status, encontro_data, encontro_local, curso(titulo, peso_online, peso_presencial, nota_minima_final, exige_presenca)')
    .eq('id', id)
    .single()

  if (!turma) notFound()

  const { data, error } = await supabase.rpc('turma_alunos', { p_turma: id })
  if (error) {
    return (
      <div className="rounded-lg border border-danger-soft bg-danger-soft/40 p-4 text-sm text-danger">
        {error.message}
      </div>
    )
  }

  const curso = (turma as any).curso
  const alunos = (data ?? []) as AlunoFechamento[]

  if (turma.status === 'encerrada') {
    return (
      <div>
        <Link href={`/professor/turmas/${id}`} className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
          <ArrowLeft className="h-3.5 w-3.5" />
          Voltar à turma
        </Link>
        <div className="mt-6 rounded-lg border border-border bg-surface p-8 text-center">
          <p className="font-display font-semibold text-ink">Turma já encerrada</p>
          <p className="mt-1 text-sm text-muted">
            Reabrir uma turma encerrada é ação da coordenação, e fica registrada.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <Link href={`/professor/turmas/${id}`} className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft className="h-3.5 w-3.5" />
        Voltar à turma
      </Link>

      <h1 className="mt-4 font-display text-2xl font-semibold text-ink">Fechamento de turma</h1>
      <p className="mt-1 text-sm text-muted">
        {curso?.titulo} · turma {turma.identificador}
      </p>

      <div className="mt-4 rounded-lg border border-border bg-surface p-4 text-sm text-muted">
        Nota final = online × {curso?.peso_online}% + presencial × {curso?.peso_presencial}%.
        Mínimo para aprovação: {curso?.nota_minima_final}.
        {curso?.exige_presenca && ' Presença no encontro é obrigatória.'}
        {' '}O sistema sugere a decisão; divergir dela exige justificativa.
      </div>

      <TabelaFechamento
        turmaId={id}
        alunos={alunos}
        pesoOnline={Number(curso?.peso_online ?? 60)}
        pesoPresencial={Number(curso?.peso_presencial ?? 40)}
        notaMinima={Number(curso?.nota_minima_final ?? 60)}
        exigePresenca={Boolean(curso?.exige_presenca)}
      />
    </div>
  )
}
