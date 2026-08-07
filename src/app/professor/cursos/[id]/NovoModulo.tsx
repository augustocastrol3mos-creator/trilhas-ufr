'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'
import { criarModulo } from '@/app/professor/cursos/actions'

export default function NovoModulo({ cursoId }: { cursoId: string }) {
  const router = useRouter()
  const [aberto, setAberto] = useState(false)
  const [pendente, iniciar] = useTransition()

  if (!aberto) {
    return (
      <button
        onClick={() => setAberto(true)}
        className="mt-4 inline-flex items-center gap-2 rounded-md border border-dashed border-border-strong px-4 py-2.5 text-sm text-muted hover:border-primary hover:text-primary"
      >
        <Plus className="h-4 w-4" />
        Adicionar módulo
      </button>
    )
  }

  return (
    <form
      action={(fd) =>
        iniciar(async () => {
          await criarModulo(cursoId, fd)
          setAberto(false)
          router.refresh()
        })
      }
      className="mt-4 rounded-lg border border-border bg-surface p-5"
    >
      <label className="block text-sm font-medium text-ink">
        Título do módulo
        <input
          name="titulo"
          required
          autoFocus
          className="mt-1.5 w-full rounded-md border border-border-strong bg-surface px-3 py-2 text-sm text-ink"
        />
      </label>
      <label className="mt-4 block text-sm font-medium text-ink">
        Descrição (opcional)
        <input
          name="descricao"
          className="mt-1.5 w-full rounded-md border border-border-strong bg-surface px-3 py-2 text-sm text-ink"
        />
      </label>
      <div className="mt-4 flex gap-3">
        <button
          disabled={pendente}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-50"
        >
          {pendente ? 'Criando...' : 'Criar'}
        </button>
        <button
          type="button"
          onClick={() => setAberto(false)}
          className="rounded-md border border-border-strong px-4 py-2 text-sm text-ink"
        >
          Cancelar
        </button>
      </div>
    </form>
  )
}
