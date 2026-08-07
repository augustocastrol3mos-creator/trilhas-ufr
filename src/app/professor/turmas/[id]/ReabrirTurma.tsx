'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle } from 'lucide-react'
import { reabrirTurma } from '@/app/professor/actions'

export default function ReabrirTurma({ turmaId }: { turmaId: string }) {
  const router = useRouter()
  const [abrindo, setAbrindo] = useState(false)
  const [justificativa, setJustificativa] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [pendente, iniciar] = useTransition()

  if (!abrindo) {
    return (
      <div className="mt-4 rounded-lg border border-primary-soft bg-primary-soft p-4">
        <p className="text-sm text-ink">
          Turma encerrada. As notas foram congeladas e os certificados emitidos.
        </p>
        <button
          onClick={() => setAbrindo(true)}
          className="mt-3 text-sm font-medium text-primary-dark hover:underline"
        >
          Reabrir turma
        </button>
      </div>
    )
  }

  return (
    <div className="mt-4 rounded-lg border border-accent-soft bg-accent-soft p-4">
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
        <p className="text-sm text-ink">
          Reabrir permite lançar novas notas e fechar de novo, mas certificados já emitidos
          não são apagados — se a nota mudar, revogue e reemita em Coordenação → Certificados.
        </p>
      </div>

      <textarea
        value={justificativa}
        onChange={(e) => setJustificativa(e.target.value)}
        placeholder="Justificativa da reabertura (mínimo 20 caracteres)"
        rows={2}
        className="mt-3 w-full rounded-md border border-border-strong bg-surface px-3 py-2 text-sm text-ink"
      />

      <div className="mt-3 flex gap-3">
        <button
          disabled={pendente || justificativa.trim().length < 20}
          onClick={() =>
            iniciar(async () => {
              setErro(null)
              const r = await reabrirTurma(turmaId, justificativa)
              if (r.erro) setErro(r.erro)
              else router.refresh()
            })
          }
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-40"
        >
          {pendente ? 'Reabrindo...' : 'Confirmar reabertura'}
        </button>
        <button
          onClick={() => setAbrindo(false)}
          className="rounded-md border border-border-strong px-4 py-2 text-sm text-ink"
        >
          Cancelar
        </button>
      </div>

      {erro && <p className="mt-3 rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">{erro}</p>}
    </div>
  )
}
