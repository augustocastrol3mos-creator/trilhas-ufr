import Link from 'next/link'
import { ArrowLeft, Check, Circle, Clock, Minus } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { exigirProfessor } from '@/lib/auth'
import VereditoCompetencias, { type Linha } from './VereditoCompetencias'

export const dynamic = 'force-dynamic'

const ROTULO_TIPO: Record<string, string> = {
  texto: 'Texto', video: 'Vídeo', quiz: 'Quiz',
  checkpoint: 'Confirmação', material: 'Material', envio: 'Envio',
}

export default async function AlunoPage({
  params,
}: { params: Promise<{ id: string; matriculaId: string }> }) {
  await exigirProfessor()
  const { id, matriculaId } = await params
  const supabase = await createClient()

  const [{ data, error }, { data: compsRaw, error: erroComps }] = await Promise.all([
    supabase.rpc('progresso_aluno', { p_matricula: matriculaId }),
    supabase.rpc('competencias_da_matricula', { p_matricula: matriculaId }),
  ])

  // Lição 4.9: erro engolido já escondeu três defeitos neste projeto.
  if (erroComps) console.error('competencias_da_matricula:', erroComps.message)

  if (error) {
    return (
      <div className="rounded-lg border border-danger-soft bg-danger-soft/40 p-4 text-sm text-danger">
        {error.message}
      </div>
    )
  }

  const { aluno, modulos } = data as any
  // Vazio quando o curso não declara nenhuma competência — o componente some
  // sozinho nesse caso, em vez de mostrar um cartão sem conteúdo.
  const competencias = (compsRaw ?? []) as Linha[]
  const dias = aluno.ultimaAtividade
    ? Math.floor((Date.now() - new Date(aluno.ultimaAtividade).getTime()) / 86400000)
    : null

  return (
    <div>
      <Link
        href={`/professor/turmas/${id}`}
        className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Voltar à turma
      </Link>

      <h1 className="mt-4 font-display text-2xl font-semibold text-ink">
        {aluno.nome || '(sem nome)'}
      </h1>
      <p className="mt-1 text-sm text-muted">{aluno.email}</p>

      <div className="mt-4 flex flex-wrap gap-3">
        <span className="rounded-full border border-border-strong px-3 py-1 text-xs text-muted">
          Nota online: {aluno.notaOnline ?? '—'}
        </span>
        {dias !== null && (
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs ${
              dias > 14 ? 'bg-accent-soft text-accent' : 'border border-border-strong text-muted'
            }`}
          >
            <Clock className="h-3 w-3" />
            {dias === 0 ? 'ativo hoje' : `última atividade há ${dias} ${dias === 1 ? 'dia' : 'dias'}`}
          </span>
        )}
        {dias === null && (
          <span className="rounded-full bg-accent-soft px-3 py-1 text-xs text-accent">
            nunca abriu a trilha
          </span>
        )}
      </div>

      {/* Antes do percurso: o veredito é o que o professor vem fazer aqui
          quando a turma está fechando, e o percurso é a evidência que ele
          consulta para decidir. */}
      {competencias.length > 0 && (
        <div className="mt-8">
          <VereditoCompetencias matriculaId={matriculaId} linhas={competencias} />
        </div>
      )}

      <div className="mt-8 space-y-5">
        {(modulos ?? []).map((m: any) => (
          <div key={m.ordem} className="rounded-lg border border-border bg-surface p-5">
            <p className="font-display font-semibold text-ink">
              {m.ordem}. {m.titulo}
            </p>

            <ul className="mt-3 space-y-2">
              {(m.blocos ?? []).map((b: any, i: number) => (
                <li key={i} className="flex items-center gap-3 border-t border-border pt-2 first:border-t-0 first:pt-0">
                  <span className="shrink-0">
                    {b.estado === 'concluido' ? (
                      <Check className="h-4 w-4 text-primary" />
                    ) : b.estado === 'em_andamento' ? (
                      <Circle className="h-4 w-4 text-accent" />
                    ) : (
                      <Minus className="h-4 w-4 text-subtle" />
                    )}
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-ink">{b.titulo}</span>
                    <span className="block text-xs text-subtle">
                      {ROTULO_TIPO[b.tipo] ?? b.tipo}
                      {b.obrigatorio ? ' · obrigatório' : ' · opcional'}
                      {b.tentativas > 0 &&
                        ` · ${b.tentativas} ${b.tentativas === 1 ? 'tentativa' : 'tentativas'}`}
                    </span>
                  </span>

                  {b.nota != null && (
                    <span className="shrink-0 text-sm font-medium text-ink">{b.nota}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}
