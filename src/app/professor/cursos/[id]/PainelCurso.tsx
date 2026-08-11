'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, Eye, EyeOff, ClipboardList } from 'lucide-react'
import Link from 'next/link'
import { alternarPublicacao } from '@/app/professor/cursos/actions'

export default function PainelCurso({
  curso, pendencias, podePublicar,
}: {
  curso: { id: string; titulo: string; descricao: string | null; status: string; modalidade: string; carga_horaria: number }
  pendencias: string[]
  podePublicar: boolean
}) {
  const router = useRouter()
  const [erro, setErro] = useState<string | null>(null)
  const [pendente, iniciar] = useTransition()
  const publicado = curso.status === 'publicado'
  const emAnalise = curso.status === 'em_analise'

  return (
    <div className="mt-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">{curso.titulo}</h1>
          <div className="mt-2 flex items-center gap-2 text-xs">
            {publicado ? (
              <span className="rounded-full bg-primary px-2 py-0.5 font-medium text-white">publicado</span>
            ) : emAnalise ? (
              <span className="rounded-full bg-accent-soft px-2 py-0.5 font-medium text-accent">
                aguardando autorização
              </span>
            ) : (
              <span className="rounded-full bg-accent-soft px-2 py-0.5 font-medium text-accent">rascunho</span>
            )}
            <span className="text-subtle">
              {curso.modalidade === 'online' ? '100% online' : 'híbrido'} · {curso.carga_horaria}h
            </span>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
        <Link
          href={`/professor/cursos/${curso.id}/revisar`}
          className="inline-flex items-center gap-2 rounded-md border border-border-strong px-4 py-2.5 text-sm font-medium text-ink hover:border-primary hover:text-primary"
        >
          <ClipboardList className="h-4 w-4" />
          Revisar e pré-visualizar
        </Link>
        <button
          disabled={pendente || (!publicado && !podePublicar)}
          onClick={() =>
            iniciar(async () => {
              setErro(null)
              const r = await alternarPublicacao(curso.id, !publicado)
              if (r.erro) setErro(r.erro)
              else if (!r.ok) setErro((r.pendencias ?? []).join(' '))
              else router.refresh()
            })
          }
          className={`inline-flex shrink-0 items-center gap-2 rounded-md px-4 py-2.5 text-sm font-medium disabled:opacity-40 ${
            publicado
              ? 'border border-border-strong text-ink hover:border-danger hover:text-danger'
              : 'bg-primary text-white hover:bg-primary-dark'
          }`}
        >
          {publicado ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          {pendente ? 'Salvando...' : publicado ? 'Despublicar' : emAnalise ? 'Reenviar para autorização' : 'Enviar para autorização'}
        </button>
        </div>
      </div>

      {emAnalise && (
        <div className="mt-4 rounded-lg border border-accent-soft bg-accent-soft p-4 text-sm text-ink">
          Enviado à coordenação. O curso fica invisível no catálogo até ser autorizado.
        </div>
      )}

      {!publicado && pendencias.length > 0 && (
        <div className="mt-4 rounded-lg border border-accent-soft bg-accent-soft p-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-accent" />
            <p className="text-sm font-medium text-ink">Falta para publicar</p>
          </div>
          <ul className="mt-2 space-y-1">
            {pendencias.map((p, i) => (
              <li key={i} className="text-sm text-ink">• {p}</li>
            ))}
          </ul>
        </div>
      )}

      {erro && <p className="mt-4 rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">{erro}</p>}
    </div>
  )
}
