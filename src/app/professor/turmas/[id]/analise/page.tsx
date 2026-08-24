import Link from 'next/link'
import { ArrowLeft, TrendingDown } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { exigirProfessor } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export default async function AnalisePage({
  params,
}: { params: Promise<{ id: string }> }) {
  await exigirProfessor()
  const { id } = await params
  const supabase = await createClient()

  const { data, error } = await supabase.rpc('analise_quiz', { p_turma: id })

  if (error) {
    return (
      <div className="rounded-lg border border-danger-soft bg-danger-soft/40 p-4 text-sm text-danger">
        {error.message}
      </div>
    )
  }

  const quizzes = (data ?? []) as any[]

  return (
    <div>
      <Link
        href={`/professor/turmas/${id}`}
        className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Voltar à turma
      </Link>

      <h1 className="mt-4 font-display text-2xl font-semibold text-ink">Análise das questões</h1>
      <p className="mt-1 text-sm text-muted">
        Percentual de acerto na última tentativa de cada aluno. Questão com acerto muito baixo
        costuma indicar enunciado confuso ou conteúdo que não preparou para ela.
      </p>

      {quizzes.length === 0 && (
        <div className="mt-6 rounded-lg border border-dashed border-border-strong p-8 text-center">
          <p className="text-sm text-muted">Nenhuma resposta registrada ainda.</p>
          <p className="mt-1 text-xs text-subtle">
            A análise aparece assim que os alunos começarem a responder os quizzes.
          </p>
        </div>
      )}

      <div className="mt-6 space-y-6">
        {quizzes.map((q) => (
          <div key={q.blocoId} className="rounded-lg border border-border bg-surface p-5">
            <p className="font-display font-semibold text-ink">{q.blocoTitulo}</p>
            <p className="text-xs text-subtle">{q.modulo}</p>

            <ul className="mt-4 space-y-4">
              {(q.questoes ?? []).map((item: any) => {
                const pct = Number(item.percentual ?? 0)
                const critico = pct < 50
                return (
                  <li key={item.id}>
                    <div className="flex items-start justify-between gap-4">
                      <p className="text-sm text-ink">{item.enunciado}</p>
                      <span
                        className={`shrink-0 text-sm font-medium ${
                          critico ? 'text-danger' : pct < 75 ? 'text-accent' : 'text-primary'
                        }`}
                      >
                        {pct}%
                      </span>
                    </div>

                    <div className="mt-2 flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-border">
                        <div
                          className={`h-full ${
                            critico ? 'bg-danger' : pct < 75 ? 'bg-accent' : 'bg-primary'
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="shrink-0 text-xs text-subtle">
                        {item.acertos} de {item.respondentes}
                      </span>
                    </div>

                    {critico && (
                      <p className="mt-2 flex items-center gap-1.5 text-xs text-danger">
                        <TrendingDown className="h-3 w-3" />
                        Menos da metade acertou — vale revisar o enunciado ou o conteúdo.
                      </p>
                    )}
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}
