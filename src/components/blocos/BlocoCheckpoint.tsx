'use client'

import { useTransition } from 'react'
import { checkpointSchema } from '@/lib/blocos/schemas'
import { concluirBloco } from '@/app/trilha/actions'
import type { PropsBloco } from './BlocoRenderer'

export default function BlocoCheckpoint({ bloco, matriculaId, estado, onConcluir }: PropsBloco) {
  const parsed = checkpointSchema.safeParse(bloco.config)
  const concluido = estado === 'concluido'
  const [pendente, iniciar] = useTransition()

  if (!parsed.success) {
    return <p className="text-sm text-danger">Configuração inválida deste bloco.</p>
  }

  const { texto, rotuloBotao } = parsed.data

  return (
    <div className="rounded-lg border border-border bg-canvas p-4">
      <p className="text-ink">{texto}</p>
      {concluido ? (
        <p className="mt-3 text-sm text-primary">Confirmado.</p>
      ) : (
        <button
          disabled={pendente}
          onClick={() =>
            iniciar(async () => {
              const r = await concluirBloco(matriculaId, bloco.blocoId, {
                confirmadoEm: new Date().toISOString(),
              })
              if (!r.erro) onConcluir()
            })
          }
          className="mt-3 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-50"
        >
          {pendente ? 'Registrando...' : rotuloBotao}
        </button>
      )}
    </div>
  )
}
