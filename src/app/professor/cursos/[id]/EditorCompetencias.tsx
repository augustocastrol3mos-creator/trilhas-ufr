'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Target } from 'lucide-react'
import { salvarCompetencias } from './acoes-capa'

export type Competencia = {
  id: string
  numero: number
  nome: string
  atributos: string[]
  ativa: boolean
}

const MAX = 3

export default function EditorCompetencias({
  cursoId, disponiveis, selecionadas,
}: {
  cursoId: string
  disponiveis: Competencia[]
  selecionadas: string[]
}) {
  const router = useRouter()
  const [ids, setIds] = useState<string[]>(selecionadas)
  const [erro, setErro] = useState<string | null>(null)
  const [salvo, setSalvo] = useState(false)
  const [pendente, iniciar] = useTransition()

  function alternar(id: string) {
    setSalvo(false)
    setIds((atual) =>
      atual.includes(id)
        ? atual.filter((x) => x !== id)
        : atual.length >= MAX
          ? atual
          : [...atual, id]
    )
  }

  const cheio = ids.length >= MAX

  return (
    <div className="rounded-lg border border-border bg-surface p-5">
      <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted">
        <Target className="h-3.5 w-3.5" aria-hidden="true" />
        Competências desenvolvidas
      </h2>

      <p className="mt-2 text-sm leading-relaxed text-muted">
        Escolha até <strong className="text-ink">{MAX}</strong>. Elas aparecem na página
        do curso e vão <strong className="text-ink">impressas no certificado</strong>.
      </p>
      <p className="mt-1 text-xs leading-relaxed text-subtle">
        O limite é proposital: um curso que declara desenvolver oito competências não
        desenvolve nenhuma de verdade, e um certificado com oito rótulos não diz nada.
        Escolha as que o aluno de fato exercita.
      </p>

      <ul className="mt-4 space-y-1.5">
        {disponiveis.map((c) => {
          const marcada = ids.includes(c.id)
          const bloqueada = !marcada && cheio

          return (
            <li key={c.id}>
              <label
                className={`flex cursor-pointer items-start gap-2.5 rounded-md border px-3 py-2.5 ${
                  marcada
                    ? 'border-primary bg-primary-soft'
                    : bloqueada
                      ? 'border-border opacity-40'
                      : 'border-border hover:border-border-strong'
                }`}
              >
                <input
                  type="checkbox"
                  checked={marcada}
                  disabled={bloqueada}
                  onChange={() => alternar(c.id)}
                  className="mt-0.5 h-4 w-4 accent-[var(--color-primary)]"
                />
                <span className="min-w-0">
                  <span className="text-sm font-medium text-ink">
                    {c.numero}. {c.nome}
                  </span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-muted">
                    {c.atributos.slice(0, 4).join(' · ')}
                    {c.atributos.length > 4 && ' · …'}
                  </span>
                </span>
              </label>
            </li>
          )
        })}
      </ul>

      {erro && (
        <p className="mt-3 rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">{erro}</p>
      )}

      <div className="mt-4 flex items-center gap-3">
        <button
          onClick={() => {
            setErro(null)
            iniciar(async () => {
              const r = await salvarCompetencias(cursoId, ids)
              if (!r.ok) setErro(r.erro ?? 'nao foi possivel salvar')
              else { setSalvo(true); router.refresh() }
            })
          }}
          disabled={pendente}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-50"
        >
          {pendente ? 'Salvando…' : 'Salvar competências'}
        </button>

        <span className="text-sm text-muted">
          {ids.length} de {MAX}
        </span>

        {salvo && !pendente && (
          <span className="flex items-center gap-1.5 text-sm text-success">
            <Check className="h-4 w-4" />
            Salvo
          </span>
        )}
      </div>
    </div>
  )
}
