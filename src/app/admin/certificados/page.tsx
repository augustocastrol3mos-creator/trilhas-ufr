import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import LinhaCertificado from './LinhaCertificado'

export const dynamic = 'force-dynamic'

export default async function AdminCertificadosPage({
  searchParams,
}: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams
  const supabase = await createClient()

  let consulta = supabase
    .from('certificado')
    .select('id, codigo, nome_titular, curso_titulo, carga_horaria, emitido_em, revogado_em, revogado_motivo')
    .order('emitido_em', { ascending: false })
    .limit(50)

  if (q) consulta = consulta.or(`codigo.ilike.%${q}%,nome_titular.ilike.%${q}%`)

  const { data: certificados } = await consulta

  return (
    <div>
      <Link href="/admin" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft className="h-3.5 w-3.5" />
        Coordenação
      </Link>

      <h1 className="mt-4 font-display text-2xl font-semibold text-ink">Certificados</h1>
      <p className="mt-1 text-sm text-muted">
        Certificado emitido não se edita. Erro se corrige revogando e reemitindo com código novo.
      </p>

      <form className="mt-6">
        <input
          name="q"
          defaultValue={q ?? ''}
          placeholder="Buscar por código ou nome do titular"
          className="w-full rounded-md border border-border-strong bg-surface px-3 py-2 text-sm text-ink"
        />
      </form>

      <ul className="mt-4 space-y-3">
        {(certificados ?? []).map((c) => (
          <LinhaCertificado key={c.id} certificado={c as any} />
        ))}
      </ul>

      {(certificados ?? []).length === 0 && (
        <p className="mt-6 text-sm text-muted">Nenhum certificado encontrado.</p>
      )}
    </div>
  )
}
