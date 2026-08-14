'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { UserCheck, Check } from 'lucide-react'
import { registrarPresenca } from './actions-presenca'

type Item = { matriculaId: string; nome: string; presenca: boolean }

export default function ChamadaPresenca({
  turmaId,
  alunos,
}: {
  turmaId: string
  alunos: Item[]
}) {
  const [marcados, setMarcados] = useState<Record<string, boolean>>(
    Object.fromEntries(alunos.map((a) => [a.matriculaId, a.presenca]))
  )
  const [erro, setErro] = useState<string | null>(null)
  const [salvo, setSalvo] = useState(false)
  const [pendente, iniciar] = useTransition()
  const router = useRouter()

  const total = Object.values(marcados).filter(Boolean).length

  function alternar(id: string) {
    setSalvo(false)
    setMarcados((m) => ({ ...m, [id]: !m[id] }))
  }

  function todos(valor: boolean) {
    setSalvo(false)
    setMarcados(Object.fromEntries(alunos.map((a) => [a.matriculaId, valor])))
  }

  function salvar() {
    setErro(null)
    iniciar(async () => {
      const r = await registrarPresenca(
        turmaId,
        alunos.map((a) => ({ matricula: a.matriculaId, presente: !!marcados[a.matriculaId] }))
      )
      if (!r.ok) {
        setErro(r.erro ?? 'nao foi possivel salvar')
        return
      }
      setSalvo(true)
      router.refresh()
    })
  }

  return (
    <div className="mt-6 rounded-lg border border-border bg-surface p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-display text-base font-semibold text-ink">
            <UserCheck className="h-4 w-4" />
            Chamada do encontro
          </h2>
          <p className="mt-1 text-xs text-muted">
            {total} de {alunos.length} com presença confirmada. O aluno vê o próprio
            registro em Meus cursos assim que você salvar.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => todos(true)}
            className="text-sm font-medium text-primary hover:text-primary-dark"
          >
            Marcar todos
          </button>
          <button
            onClick={() => todos(false)}
            className="text-sm font-medium text-muted hover:text-ink"
          >
            Limpar
          </button>
        </div>
      </div>

      <ul className="mt-4 grid gap-2 sm:grid-cols-2">
        {alunos.map((a) => (
          <li key={a.matriculaId}>
            <label className="flex cursor-pointer items-center gap-2.5 rounded-md border border-border px-3 py-2 text-sm hover:border-border-strong">
              <input
                type="checkbox"
                checked={!!marcados[a.matriculaId]}
                onChange={() => alternar(a.matriculaId)}
                className="h-4 w-4 accent-[var(--color-primary)]"
              />
              <span className="text-ink">{a.nome || '(sem nome)'}</span>
            </label>
          </li>
        ))}
      </ul>

      {erro && (
        <p className="mt-3 rounded-md border border-danger-soft bg-danger-soft/40 px-3 py-2 text-sm text-danger">
          {erro}
        </p>
      )}

      <div className="mt-4 flex items-center gap-3">
        <button
          onClick={salvar}
          disabled={pendente}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-50"
        >
          {pendente ? 'Salvando…' : 'Salvar chamada'}
        </button>
        {salvo && !pendente && (
          <span className="flex items-center gap-1.5 text-sm text-primary">
            <Check className="h-4 w-4" />
            Chamada salva
          </span>
        )}
      </div>
    </div>
  )
}
