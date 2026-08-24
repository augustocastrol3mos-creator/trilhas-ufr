import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import GestorEncontros, { type Aluno, type Encontro } from './GestorEncontros'
import { exigirProfessor } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export default async function EncontrosPage({
  params,
}: { params: Promise<{ id: string }> }) {
  await exigirProfessor()
  const { id } = await params
  const supabase = await createClient()

  const { data: turma } = await supabase
    .from('turma')
    .select('id, identificador, status, curso(titulo, modalidade)')
    .eq('id', id)
    .single()

  if (!turma) notFound()

  // A autorização mora na RPC (pode_gerir_encontros): instrutor da turma,
  // autor do curso ou coordenação. Se recusar, a tela nem renderiza.
  const { data, error } = await supabase.rpc('encontros_da_turma', { p_turma: id })
  if (error) notFound()

  const info = (data ?? {}) as {
    presencaMinima: number
    alunos: Aluno[]
    encontros: Encontro[]
  }

  const encerrada = (turma as any).status === 'encerrada'

  return (
    <div>
      <Link
        href={`/professor/turmas/${id}`}
        className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Turma {turma.identificador}
      </Link>

      <h1 className="mt-4 font-display text-2xl font-semibold text-ink">
        Encontros e chamada
      </h1>
      <p className="mt-1 text-sm text-muted">
        {(turma as any).curso?.titulo} · a presença de cada aluno é calculada a partir
        dos encontros em que ele esteve.
      </p>

      {encerrada && (
        <div className="mt-4 rounded-lg border border-primary-soft bg-primary-soft p-4 text-sm text-ink">
          Turma encerrada: os certificados já foram emitidos com base nesta presença.
          Alterar exige reabrir a turma, ação da coordenação.
        </div>
      )}

      <div className="mt-6">
        <GestorEncontros
          turmaId={id}
          alunos={info.alunos ?? []}
          encontros={info.encontros ?? []}
          presencaMinima={Number(info.presencaMinima ?? 75)}
          bloqueado={encerrada}
        />
      </div>
    </div>
  )
}
