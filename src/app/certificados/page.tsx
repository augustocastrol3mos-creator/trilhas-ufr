import Link from 'next/link'
import { Award, ChevronRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { sessaoAtual } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export default async function CertificadosPage() {
  const supabase = await createClient()
  const user = await sessaoAtual()

  const { data, error } = await supabase
    .from('certificado')
    .select('id, codigo, curso_titulo, carga_horaria, emitido_em, revogado_em, matricula!inner(usuario_id)')
    .eq('matricula.usuario_id', user?.id ?? '')
    .order('emitido_em', { ascending: false })

  if (error) {
    return (
      <div className="rounded-lg border border-danger-soft bg-danger-soft/40 p-4 text-sm text-danger">
        {error.message}
      </div>
    )
  }

  const certificados = data ?? []

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold text-ink">Certificados</h1>
      <p className="mt-1 text-sm text-muted">
        Emitidos automaticamente ao concluir um curso, ou pelo professor após o encontro presencial.
      </p>

      <ul className="mt-6 space-y-3">
        {certificados.map((c) => (
          <li key={c.id}>
            <Link
              href={`/certificados/${c.id}`}
              className="flex items-center justify-between gap-4 rounded-lg border border-border bg-surface p-5 hover:border-border-strong"
            >
              <div className="flex min-w-0 items-center gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-soft">
                  <Award className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="truncate font-display font-semibold text-ink">{c.curso_titulo}</p>
                  <p className="mt-0.5 text-xs text-subtle">
                    {c.carga_horaria}h · código {c.codigo}
                    {c.revogado_em && ' · revogado'}
                  </p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-subtle" />
            </Link>
          </li>
        ))}
      </ul>

      {certificados.length === 0 && (
        <div className="mt-6 rounded-lg border border-dashed border-border-strong p-8 text-center">
          <p className="text-sm text-muted">Nenhum certificado ainda.</p>
          <Link href="/meus-cursos" className="mt-2 inline-block text-sm font-medium text-primary hover:underline">
            Ver meus cursos
          </Link>
        </div>
      )}
    </div>
  )
}
