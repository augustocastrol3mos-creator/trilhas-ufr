import Link from 'next/link'
import { ChevronRight, Users, Plus } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function ProfessorPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: turmas, error } = await supabase
    .from('turma')
    .select('id, identificador, tipo, status, encontro_data, encontro_local, curso(titulo, modalidade)')
    .eq('instrutor_id', user?.id ?? '')
    .order('identificador')

  if (error) {
    return (
      <div className="rounded-lg border border-danger-soft bg-danger-soft/40 p-4 text-sm text-danger">
        {error.message}
      </div>
    )
  }

  const lista = (turmas ?? []) as any[]

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">Área do professor</h1>
          <p className="mt-1 text-sm text-muted">Turmas sob sua responsabilidade.</p>
        </div>
        <Link
          href="/professor/cursos"
          className="inline-flex shrink-0 items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-dark"
        >
          <Plus className="h-4 w-4" />
          Criar e editar cursos
        </Link>
      </div>

      <ul className="mt-6 space-y-3">
        {lista.map((t) => (
          <li key={t.id}>
            <Link
              href={`/professor/turmas/${t.id}`}
              className="flex items-center justify-between gap-4 rounded-lg border border-border bg-surface p-5 hover:border-border-strong"
            >
              <div className="min-w-0">
                <p className="truncate font-display font-semibold text-ink">{t.curso?.titulo}</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
                  <span className="rounded-full border border-border-strong px-2 py-0.5 text-muted">
                    Turma {t.identificador}
                  </span>
                  {t.status === 'encerrada' ? (
                    <span className="rounded-full bg-primary px-2 py-0.5 font-medium text-white">encerrada</span>
                  ) : (
                    <span className="rounded-full bg-accent-soft px-2 py-0.5 font-medium text-accent">aberta</span>
                  )}
                  {t.encontro_data && (
                    <span className="text-subtle">
                      encontro em {new Date(t.encontro_data).toLocaleDateString('pt-BR')}
                    </span>
                  )}
                </div>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-subtle" />
            </Link>
          </li>
        ))}
      </ul>

      {lista.length === 0 && (
        <div className="mt-6 rounded-lg border border-dashed border-border-strong p-8 text-center">
          <Users className="mx-auto h-6 w-6 text-subtle" />
          <p className="mt-2 text-sm text-muted">Nenhuma turma atribuída a você.</p>
          <p className="mt-1 text-xs text-subtle">
            A coordenação define o instrutor responsável por cada turma.
          </p>
        </div>
      )}
    </div>
  )
}
