'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { moverItem } from '@/app/professor/cursos/actions'

export default function Reordenar({
  tipo, id, cursoId,
}: { tipo: 'modulo' | 'bloco'; id: string; cursoId: string }) {
  const router = useRouter()
  const [pendente, iniciar] = useTransition()

  const botao = 'rounded p-1 text-subtle hover:bg-canvas hover:text-ink disabled:opacity-40'

  return (
    <div className="flex shrink-0 flex-col">
      {[-1, 1].map((dir) => {
        const Icon = dir < 0 ? ChevronUp : ChevronDown
        return (
          <button
            key={dir}
            disabled={pendente}
            title={dir < 0 ? 'Mover para cima' : 'Mover para baixo'}
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              iniciar(async () => {
                await moverItem(cursoId, tipo, id, dir)
                router.refresh()
              })
            }}
            className={botao}
          >
            <Icon className="h-3.5 w-3.5" />
          </button>
        )
      })}
    </div>
  )
}
