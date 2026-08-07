import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, ClipboardCheck } from 'lucide-react'
import ReabrirTurma from './ReabrirTurma'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

type Aluno = {
  matriculaId: string
  nome: string
  email: string
  status: string
  percentualTrilha: number
  trilhaCompleta: boolean
  notaOnline: number | null
  presenca: boolean
  notaPresencial: number | null
  decisao: string | null
  fechada: boolean
}

export default async function TurmaPage({
  params,
}: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  const { data: perfil } = await supabase
    .from('usuario').select('papel').eq('id', user?.id ?? '').single()
  const ehAdmin = perfil?.papel === 'admin'

  const { data: turma } = await supabase
    .from('turma')
    .select('id, identificador, tipo, status, encontro_data, encontro_local, curso(titulo, modalidade)')
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

  const alunos = (data ?? []) as Aluno[]
  const aptos = alunos.filter((a) => a.trilhaCompleta).length
  const encerrada = (turma as any).status === 'encerrada'

  return (
    <div>
      <Link href="/professor" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft className="h-3.5 w-3.5" />
        Voltar
      </Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">
            {(turma as any).curso?.titulo}
          </h1>
          <p className="mt-1 text-sm text-muted">
            Turma {turma.identificador} · {alunos.length} inscritos · {aptos} com trilha completa
          </p>
        </div>

        {!encerrada && (turma as any).curso?.modalidade === 'hibrido' && (
          <Link
            href={`/professor/turmas/${id}/fechamento`}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-dark"
          >
            <ClipboardCheck className="h-4 w-4" />
            Fechar turma
          </Link>
        )}
      </div>

      {encerrada && ehAdmin && <ReabrirTurma turmaId={id} />}

      {encerrada && !ehAdmin && (
        <div className="mt-4 rounded-lg border border-primary-soft bg-primary-soft p-4 text-sm text-ink">
          Turma encerrada. As notas foram congeladas e os certificados emitidos. Reabrir é ação
          exclusiva da coordenação.
        </div>
      )}

      <div className="mt-6 overflow-x-auto rounded-lg border border-border bg-surface">
        <table className="w-full text-sm">
          <thead className="border-b border-border text-left text-xs text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Aluno</th>
              <th className="px-4 py-3 font-medium">Trilha</th>
              <th className="px-4 py-3 font-medium">Nota online</th>
              <th className="px-4 py-3 font-medium">Situação</th>
            </tr>
          </thead>
          <tbody>
            {alunos.map((a) => (
              <tr key={a.matriculaId} className="border-b border-border last:border-0">
                <td className="px-4 py-3">
                  <p className="font-medium text-ink">{a.nome || '(sem nome)'}</p>
                  <p className="text-xs text-subtle">{a.email}</p>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-16 overflow-hidden rounded-full bg-border">
                      <div className="h-full bg-primary" style={{ width: `${a.percentualTrilha}%` }} />
                    </div>
                    <span className="text-xs text-muted">{a.percentualTrilha}%</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-ink">
                  {a.notaOnline != null ? a.notaOnline : '—'}
                </td>
                <td className="px-4 py-3">
                  <Situacao aluno={a} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {alunos.length === 0 && (
          <p className="p-8 text-center text-sm text-muted">Nenhum aluno inscrito ainda.</p>
        )}
      </div>
    </div>
  )
}

function Situacao({ aluno }: { aluno: Aluno }) {
  if (aluno.status === 'certificado_emitido')
    return <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-white">Certificado emitido</span>
  if (aluno.status === 'aprovado' || aluno.decisao === 'aprovado')
    return <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-white">Aprovado</span>
  if (aluno.status === 'reprovado' || aluno.decisao === 'reprovado')
    return <span className="rounded-full bg-danger-soft px-2 py-0.5 text-xs font-medium text-danger">Reprovado</span>
  if (aluno.status === 'trilha_concluida')
    return <span className="rounded-full bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent">Apto ao encontro</span>
  if (aluno.trilhaCompleta)
    return <span className="rounded-full bg-primary-soft px-2 py-0.5 text-xs font-medium text-primary-dark">Trilha concluída</span>
  return <span className="rounded-full border border-border-strong px-2 py-0.5 text-xs text-muted">Em andamento</span>
}
