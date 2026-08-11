import Link from 'next/link'
import { ArrowLeft, Clock } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import ModuloCliente from '@/components/blocos/ModuloCliente'
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
  const proximo = modulos.find((m) => atual && m.ordem === atual.ordem + 1) ?? null
  const ultimoModulo = Boolean(atual && atual.ordem === modulos.length)

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
        <Link
          href={`/trilha/${matriculaId}`}
          className="mt-4 inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Voltar à trilha
        </Link>
      </div>
    )
  }

  const blocos = (data ?? []) as BlocoAluno[]

  return (
    <div>
      <Link
        href={`/trilha/${matriculaId}`}
        className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Voltar à trilha
      </Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs text-subtle">
            Módulo {atual?.ordem} de {modulos.length}
          </p>
          <h1 className="mt-1 font-display text-2xl font-semibold text-ink">{atual?.titulo}</h1>
          {atual?.descricao && <p className="mt-2 text-muted">{atual.descricao}</p>}
        </div>
        {atual?.tempoMinutos && (
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border-strong px-3 py-1 text-xs text-muted">
            <Clock className="h-3.5 w-3.5" />~{atual.tempoMinutos} min
          </span>
        )}
      </div>

      <div className="mt-6">
        <ModuloCliente
          blocos={blocos}
          matriculaId={matriculaId}
          proximo={proximo}
          ultimoModulo={ultimoModulo}
        />
      </div>
    </div>
  )
}
