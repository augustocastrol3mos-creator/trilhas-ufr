'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, X } from 'lucide-react'
import { decidir } from './acoes'

export default function Decisao({ id }: { id: string }) {
  const router = useRouter()
  const [erro, setErro] = useState<string | null>(null)
  const [resposta, setResposta] = useState('')
  const [pendente, iniciar] = useTransition()

  function agir(aprovar: boolean) {
    setErro(null)
    iniciar(async () => {
      const r = await decidir(id, aprovar, resposta)
      if (!r.ok) setErro(r.erro ?? 'nao foi possivel concluir')
      else router.refresh()
    })
  }

  return (
    <div className="mt-4 border-t border-border pt-4">
      <label className="block text-xs font-medium text-muted">
        Resposta ao aluno
        <input
          value={resposta}
          onChange={(e) => setResposta(e.target.value)}
          placeholder="Obrigatória ao recusar; opcional ao aprovar"
          className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink"
        />
      </label>

      {erro && (
        <p className="mt-2 rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">{erro}</p>
      )}

      <div className="mt-3 flex items-center gap-3">
        <button
          onClick={() => agir(true)}
          disabled={pendente}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-50"
        >
          <Check className="h-3.5 w-3.5" />
          Aprovar e alterar o nome
        </button>
        <button
          onClick={() => agir(false)}
          disabled={pendente}
          className="inline-flex items-center gap-1.5 rounded-md border border-border-strong px-4 py-2 text-sm font-medium text-ink hover:bg-canvas disabled:opacity-50"
        >
          <X className="h-3.5 w-3.5" />
          Recusar
        </button>
      </div>
    </div>
  )
}
