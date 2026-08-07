import Link from 'next/link'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import BlocoRenderer from '@/components/blocos/BlocoRenderer'
import type { BlocoAluno, ModuloTrilha } from '@/lib/blocos/schemas'

export const dynamic = 'force-dynamic'

export default async function ModuloPage({
  params,
}: { params: Promise<{ matriculaId: string; moduloId: string }> }) {
  const { matriculaId, moduloId } = await params
  const supabase = await createClient()

  const { data: trilha } = await supabase.rpc('modulos_trilha', { p_matricula: matriculaId })
  const modulos = (trilha ?? []) as ModuloTrilha[]
  const atual = modulos.find((m) => m.moduloId === moduloId)
  const proximo = modulos.find((m) => atual && m.ordem === atual.ordem + 1)

  const { data, error } = await supabase.rpc('modulo_conteudo', {
    p_matricula: matriculaId,
    p_modulo: moduloId,
  })

  if (error) {
    return (
      <div>
        <div className="rounded-lg border border-danger-soft bg-danger-soft/40 p-4 text-sm text-danger">
          {error.message}
        </div>
        <Link href={`/trilha/${matriculaId}`} className="mt-4 inline-flex items-center gap-1.5 text-sm text-primary hover:underline">
          <ArrowLeft className="h-3.5 w-3.5" />
          Voltar à trilha
        </Link>
      </div>
    )
  }

  const blocos = (data ?? []) as BlocoAluno[]

  return (
    <div>
      <Link href={`/trilha/${matriculaId}`} className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft className="h-3.5 w-3.5" />
        Voltar à trilha
      </Link>

      <h1 className="mt-4 font-display text-2xl font-semibold text-ink">{atual?.titulo}</h1>
      {atual?.descricao && <p className="mt-2 text-muted">{atual.descricao}</p>}

      <div className="mt-8 rounded-lg border border-border bg-surface px-6">
        {blocos.map((b) => (
          <BlocoRenderer key={b.blocoId} bloco={b} matriculaId={matriculaId} />
        ))}
      </div>

      <div className="mt-6">
        {proximo?.liberado ? (
          <Link
            href={`/trilha/${matriculaId}/${proximo.moduloId}`}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-dark"
          >
            Próximo módulo: {proximo.titulo}
            <ArrowRight className="h-4 w-4" />
          </Link>
        ) : proximo ? (
          <p className="text-sm text-muted">
            Conclua os itens obrigatórios acima para liberar o próximo módulo. Atualize a página após concluí-los.
          </p>
        ) : (
          <p className="text-sm text-muted">Último módulo da trilha.</p>
        )}
      </div>
    </div>
  )
}
