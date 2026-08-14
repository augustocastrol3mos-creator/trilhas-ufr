'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Pencil } from 'lucide-react'
import { autorizarPublicacao } from '../actions'
import GestaoCurso from './GestaoCurso'

export default function CardCurso({
  curso, autor, diagnostico,
}: {
  curso: { id: string; titulo: string; descricao: string | null; status: string; modalidade: string; carga_horaria: number }
  autor?: { nome_completo: string; email: string }
  diagnostico?: { pode: boolean; turmas: number; matriculas: number; certificados: number }
}) {
  const router = useRouter()
  const [motivo, setMotivo] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [pendente, iniciar] = useTransition()
  const emAnalise = curso.status === 'em_analise'

  function agir(aprovar: boolean) {
    iniciar(async () => {
      setErro(null)
      const r = await autorizarPublicacao(curso.id, aprovar, motivo || undefined)
      if (r.erro) setErro(r.erro)
      else if (!r.ok) setErro((r.pendencias ?? []).join(' '))
      else router.refresh()
    })
  }

  return (
    <li className={`rounded-lg border bg-surface p-5 ${emAnalise ? 'border-accent' : 'border-border'}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="font-display font-semibold text-ink">{curso.titulo}</p>
          <p className="mt-1 text-xs text-subtle">
            {autor?.nome_completo || autor?.email || 'sem autor'} ·{' '}
            {curso.modalidade === 'online' ? '100% online' : 'híbrido'} · {curso.carga_horaria}h
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
            curso.status === 'publicado'
              ? 'bg-primary text-white'
              : emAnalise
                ? 'bg-accent-soft text-accent'
                : 'border border-border-strong text-muted'
          }`}
        >
          {curso.status === 'em_analise' ? 'em análise' : curso.status}
        </span>
      </div>

      <div className="mt-3 flex items-center gap-4 border-t border-border pt-3">
        <Link
          href={`/professor/cursos/${curso.id}`}
          className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
        >
          <Pencil className="h-3.5 w-3.5" />
          Editar conteúdo
        </Link>
        <span className="text-xs text-subtle">
          A coordenação edita qualquer curso, mesmo sem ser a autora.
        </span>
      </div>

      {emAnalise && (
        <div className="mt-4 border-t border-border pt-4">
          <input
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Observação (obrigatória se for devolver)"
            className="w-full rounded-md border border-border-strong bg-surface px-3 py-2 text-sm text-ink"
          />
          <div className="mt-3 flex gap-3">
            <button
              disabled={pendente}
              onClick={() => agir(true)}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-50"
            >
              Autorizar publicação
            </button>
            <button
              disabled={pendente || motivo.trim().length < 5}
              onClick={() => agir(false)}
              className="rounded-md border border-border-strong px-4 py-2 text-sm text-ink hover:border-danger hover:text-danger disabled:opacity-40"
            >
              Devolver ao autor
            </button>
          </div>
        </div>
      )}

      {erro && <p className="mt-3 rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">{erro}</p>}

      {diagnostico && <GestaoCurso curso={curso} diagnostico={diagnostico} />}
    </li>
  )
}
