import Link from 'next/link'
import { ArrowLeft, Users } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { exigirAdmin } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export default async function AdminTurmasPage() {
  await exigirAdmin()
  const supabase = await createClient()

  const { data: turmas, error } = await supabase
    .from('turma')
    .select('id, identificador, tipo, status, encontro_data, curso(titulo, modalidade), instrutor:instrutor_id(nome_completo, email)')
    .order('status')

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
      <Link href="/admin" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft className="h-3.5 w-3.5" />
        Coordenação
      </Link>

      <h1 className="mt-4 font-display text-2xl font-semibold text-ink">Turmas</h1>
      <p className="mt-1 text-sm text-muted">
        Todas as turmas do sistema. A coordenação pode fechar, revisar e reabrir qualquer
        uma, mesmo sem ser a instrutora responsável.
      </p>

      <ul className="mt-6 space-y-3">
        {lista.map((t) => (
          <li key={t.id}>
            <Link
              href={`/professor/turmas/${t.id}`}
              className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-border bg-surface p-5 hover:border-border-strong"
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
                  <span className="text-subtle">
                    {t.instrutor?.nome_completo || t.instrutor?.email || 'sem instrutor'}
                  </span>
                </div>
              </div>
              <Users className="h-4 w-4 shrink-0 text-subtle" />
            </Link>
          </li>
        ))}
      </ul>

      {lista.length === 0 && (
        <p className="mt-6 text-sm text-muted">Nenhuma turma cadastrada ainda.</p>
      )}
    </div>
  )
}
