import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const STATUS: Record<string, { rotulo: string; classe: string }> = {
  inscrito: { rotulo: 'Inscrito', classe: 'border border-border-strong text-muted' },
  em_andamento: { rotulo: 'Em andamento', classe: 'bg-accent-soft text-accent' },
  trilha_concluida: { rotulo: 'Aguardando encontro', classe: 'bg-accent-soft text-accent' },
  aprovado: { rotulo: 'Aprovado', classe: 'bg-primary text-white' },
  reprovado: { rotulo: 'Reprovado', classe: 'bg-danger-soft text-danger' },
  certificado_emitido: { rotulo: 'Certificado emitido', classe: 'bg-primary text-white' },
}

export default async function MeusCursosPage() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('matricula')
    .select('id, status, turma(identificador, curso(titulo, carga_horaria, modalidade))')
    .order('criado_em', { ascending: false })

  if (error) {
    return (
      <div className="rounded-lg border border-danger-soft bg-danger-soft/40 p-4 text-sm text-danger">
        {error.message}
      </div>
    )
  }

  const matriculas = (data ?? []) as any[]

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold text-ink">Meus cursos</h1>
      <p className="mt-1 text-sm text-muted">Suas matrículas e o progresso em cada trilha.</p>

      <ul className="mt-6 space-y-3">
        {matriculas.map((m) => {
          const status = STATUS[m.status] ?? { rotulo: m.status, classe: 'border border-border-strong text-muted' }
          return (
            <li key={m.id}>
              <Link
                href={`/trilha/${m.id}`}
                className="flex items-center justify-between gap-4 rounded-lg border border-border bg-surface p-5 hover:border-border-strong"
              >
                <div className="min-w-0">
                  <p className="truncate font-display text-base font-semibold text-ink">
                    {m.turma?.curso?.titulo}
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${status.classe}`}>
                      {status.rotulo}
                    </span>
                    <span className="text-xs text-subtle">{m.turma?.curso?.carga_horaria}h</span>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-subtle" />
              </Link>
            </li>
          )
        })}
      </ul>

      {matriculas.length === 0 && (
        <div className="mt-6 rounded-lg border border-dashed border-border-strong p-8 text-center">
          <p className="text-sm text-muted">Você ainda não se inscreveu em nenhum curso.</p>
          <Link href="/cursos" className="mt-2 inline-block text-sm font-medium text-primary hover:underline">
            Ver cursos disponíveis
          </Link>
        </div>
      )}
    </div>
  )
}
