import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const ROTULO: Record<string, { texto: string; classe: string }> = {
  ajuste_nota: { texto: 'Ajuste de nota', classe: 'bg-accent-soft text-accent' },
  decisao_divergente: { texto: 'Decisão divergente', classe: 'bg-accent-soft text-accent' },
  revogacao: { texto: 'Revogação', classe: 'bg-danger-soft text-danger' },
  reabertura: { texto: 'Reabertura de turma', classe: 'bg-danger-soft text-danger' },
  papel: { texto: 'Papel concedido', classe: 'bg-primary-soft text-primary-dark' },
  publicacao: { texto: 'Publicação', classe: 'bg-primary-soft text-primary-dark' },
}

export default async function AuditoriaPage() {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('admin_auditoria', { p_limite: 100 })

  if (error) {
    return (
      <div className="rounded-lg border border-danger-soft bg-danger-soft/40 p-4 text-sm text-danger">
        {error.message}
      </div>
    )
  }

  const eventos = (data ?? []) as any[]

  return (
    <div>
      <Link href="/admin" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft className="h-3.5 w-3.5" />
        Coordenação
      </Link>

      <h1 className="mt-4 font-display text-2xl font-semibold text-ink">Auditoria</h1>
      <p className="mt-1 text-sm text-muted">
        Todo ato que reescreve uma nota, uma decisão ou um certificado fica aqui, com autor
        e justificativa.
      </p>

      <ol className="mt-6 space-y-3">
        {eventos.map((e, i) => {
          const r = ROTULO[e.tipo] ?? { texto: e.tipo, classe: 'border border-border-strong text-muted' }
          return (
            <li key={i} className="rounded-lg border border-border bg-surface p-5">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${r.classe}`}>
                  {r.texto}
                </span>
                <span className="text-xs text-subtle">
                  {e.criadoEm ? new Date(e.criadoEm).toLocaleString('pt-BR') : '—'} · {e.autor}
                </span>
              </div>
              <p className="mt-2 text-sm text-ink">{e.detalhe}</p>
              {e.justificativa && (
                <p className="mt-2 border-l-2 border-border pl-3 text-sm italic text-muted">
                  {e.justificativa}
                </p>
              )}
            </li>
          )
        })}
      </ol>

      {eventos.length === 0 && (
        <p className="mt-6 text-sm text-muted">Nenhum evento registrado ainda.</p>
      )}
    </div>
  )
}
